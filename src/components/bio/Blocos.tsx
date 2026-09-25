import { ChevronDown, ChevronRight, MapPin, Phone } from "lucide-react";
import { comBasePath } from "@/lib/seo/base-path";
import { SITE } from "@/lib/seo/site";
import { linkDeTelefone } from "@/lib/data/rotas";
import { fimDoDiaEmSaoPaulo } from "@/lib/bio/agenda";
import type { BlocoDe, ItemDeLink } from "@/lib/bio/tipos";
import type { Location } from "@/lib/content/types";
import { Contador } from "./Contador";
import { IconeDaRede, IconeDoLink, IconeWhatsapp, nomeDaRede } from "./Icones";

/**
 * Os blocos da bio que não precisam de JavaScript.
 *
 * Tudo aqui sai pronto no HTML. O único estado de tela (a lista de lojas
 * aberta ou fechada) é um `<details>`, que o navegador resolve sozinho.
 *
 * Os cliques são medidos pelo `data-evento`, lido por `RastreioCliques`. A
 * posição do clique vem do `data-regiao` da seção, que aqui é o id do bloco
 * (`bio-links`, `bio-lojas`), para o relatório dizer QUAL parte da bio levou a
 * pessoa para a loja.
 */

/** Evento de um link, pelo destino. O painel não precisa escolher isso. */
export function eventoDoLink(href: string): "clique_produto" | "clique_whatsapp" | "clique_link" {
  if (/^https?:\/\/(wa\.me|api\.whatsapp\.com|chat\.whatsapp\.com)\//i.test(href)) {
    return "clique_whatsapp";
  }
  try {
    const u = new URL(href);
    // Loja da Tray é o mesmo domínio, fora do /guias.
    if (/(^|\.)jkaliancas\.com\.br$/i.test(u.hostname) && !u.pathname.startsWith("/guias")) {
      return "clique_produto";
    }
  } catch {
    // Caminho interno ("/medidor-de-aliancas") não é URL completa.
  }
  return "clique_link";
}

/**
 * Link da bio, sempre `<a>` comum, na mesma aba.
 *
 * Página do portal ("/medidor-de-aliancas") recebe o /guias na mão. Não vai
 * pelo `next/link` de propósito: na bio, o GA4 é configurado com o endereço
 * etiquetado pela origem (ver `OrigemDaBio`), e numa troca de página sem
 * recarregar ele continuaria reportando esse endereço, contando o medidor como
 * se fosse a bio. Com o carregamento completo, a página seguinte se mede com o
 * próprio endereço, e a origem da sessão já está gravada.
 */
function LinkDaBio({
  href,
  className,
  children,
  destino,
}: {
  href: string;
  className: string;
  children: React.ReactNode;
  destino: string;
}) {
  const interno = href.startsWith("/") && !href.startsWith("//");
  return (
    <a
      href={interno ? comBasePath(href) : href}
      className={className}
      data-evento={eventoDoLink(href)}
      data-destino={destino}
    >
      {children}
    </a>
  );
}

export function Cabecalho({ nome, frase }: { nome: string; frase: string }) {
  return (
    <header className="text-center">
      <h1>
        {/* SVG vai sem `next/image`: o otimizador não toca em SVG e o `src`
            sairia sem o /guias (armadilha registrada no CLAUDE.md). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={comBasePath("/logo.svg")}
          alt={nome}
          width={156}
          height={52}
          className="mx-auto h-[52px] w-[156px]"
        />
      </h1>
      {frase ? <p className="mt-2 text-[0.85rem] text-[var(--bio-apoio)]">{frase}</p> : null}
    </header>
  );
}

export function BlocoCampanha({
  bloco,
  fimDaCampanha,
}: {
  bloco: BlocoDe<"campanha">;
  /** Último dia da campanha em que o bloco está, para o contador sem data própria. */
  fimDaCampanha: string | null;
}) {
  const contaAte = bloco.contador ? (bloco.contadorAte ?? fimDaCampanha) : null;
  return (
    <section
      data-regiao={`bio-${bloco.id}`}
      className="relative overflow-hidden rounded-[24px] border border-[var(--bio-linha-forte)] bg-[color-mix(in_srgb,var(--bio-superficie)_80%,transparent)] px-5 py-6 text-center backdrop-blur-md"
    >
      {/* Vidro: nas campanhas de data, o enfeite que passa por trás aparece
          desfocado, sem cortar o texto. Luz, não fogo: o brilho é um degradê
          suave atrás do título. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-24 mx-auto h-48 w-72 rounded-full bg-[var(--bio-brilho)] blur-3xl"
      />
      <div className="relative">
        {bloco.eyebrow ? (
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-[var(--bio-acento)]">
            {bloco.eyebrow}
          </p>
        ) : null}
        <h2 className="mt-2 text-[1.5rem] font-medium leading-[1.15] tracking-[-0.02em]">{bloco.titulo}</h2>
        {bloco.texto ? (
          <p className="mx-auto mt-2 max-w-[22rem] text-[0.88rem] leading-relaxed text-[var(--bio-apoio)]">
            {bloco.texto}
          </p>
        ) : null}
        {contaAte ? <Contador ate={fimDoDiaEmSaoPaulo(contaAte)} rotulo={bloco.rotuloContador} /> : null}
        {bloco.botao ? (
          <LinkDaBio
            href={bloco.botao.href}
            destino={bloco.botao.rotulo}
            className="mt-5 inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-[var(--bio-acento)] px-6 text-[0.85rem] font-semibold text-[var(--bio-texto)] transition-colors hover:bg-[var(--bio-acento)] hover:text-[var(--bio-fundo)]"
          >
            {bloco.botao.rotulo}
            <ChevronRight size={16} aria-hidden />
          </LinkDaBio>
        ) : null}
      </div>
    </section>
  );
}

export function TituloDaVitrine({
  titulo,
  verTudo,
}: {
  titulo: string;
  verTudo: { rotulo: string; href: string } | null;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="min-w-0 text-[1.05rem] font-medium">{titulo}</h2>
      {verTudo ? (
        <LinkDaBio
          href={verTudo.href}
          destino={`${titulo}: ${verTudo.rotulo}`}
          className="shrink-0 text-[0.8rem] font-semibold text-[var(--bio-acento)] underline-offset-4 hover:underline"
        >
          {verTudo.rotulo}
        </LinkDaBio>
      ) : null}
    </div>
  );
}

function CartaoDeLink({ item }: { item: ItemDeLink }) {
  const destaque = item.destaque;
  return (
    <LinkDaBio
      href={item.href}
      destino={item.rotulo}
      className={`group flex min-h-[3.75rem] items-center gap-3 rounded-[18px] border px-3.5 py-3 transition-colors ${
        destaque
          ? "border-transparent bg-[var(--bio-acao)] text-[var(--bio-acao-texto)] hover:bg-[var(--bio-acao-realce)]"
          : "border-[var(--bio-linha)] bg-[var(--bio-superficie)] hover:border-[var(--bio-linha-forte)]"
      }`}
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
          destaque ? "bg-[var(--bio-acao-texto)]/10" : "bg-[var(--bio-superficie-alta)] text-[var(--bio-acento)]"
        }`}
      >
        <IconeDoLink icone={item.icone} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.92rem] font-medium leading-tight">{item.rotulo}</span>
        {item.detalhe ? (
          <span
            className={`mt-0.5 block text-[0.75rem] leading-snug ${
              destaque ? "opacity-85" : "text-[var(--bio-apoio)]"
            }`}
          >
            {item.detalhe}
          </span>
        ) : null}
      </span>
      <ChevronRight size={18} aria-hidden className="shrink-0 opacity-70 transition-transform group-hover:translate-x-0.5" />
    </LinkDaBio>
  );
}

export function BlocoLinks({ bloco }: { bloco: BlocoDe<"links"> }) {
  if (bloco.itens.length === 0) return null;
  return (
    <section data-regiao={`bio-${bloco.id}`}>
      {bloco.titulo ? <h2 className="mb-3 text-[1.05rem] font-medium">{bloco.titulo}</h2> : null}
      <ul className="space-y-2.5">
        {bloco.itens.map((item) => (
          <li key={item.id}>
            <CartaoDeLink item={item} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * WhatsApp da unidade com a mensagem da bio.
 *
 * Só usa o campo `whatsapp`. O `linkDoWhatsapp` do site cai para o telefone
 * quando falta o WhatsApp, e duas das dez lojas estão assim: telefone fixo no
 * `wa.me` abre uma conversa que não existe. Aqui, sem WhatsApp, o botão vira
 * "Ligar".
 */
function whatsappDaLoja(l: Location, mensagem: string): string | null {
  const numero = (l.whatsapp ?? "").replace(/\D/g, "");
  if (!numero) return null;
  const texto = mensagem.replaceAll("{loja}", l.name);
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

export function BlocoLojas({ bloco, lojas }: { bloco: BlocoDe<"lojas">; lojas: Location[] }) {
  if (lojas.length === 0) return null;
  return (
    <section data-regiao={`bio-${bloco.id}`}>
      <details className="group/lojas overflow-hidden rounded-[18px] border border-[var(--bio-linha)] bg-[var(--bio-superficie)] open:border-[var(--bio-linha-forte)]">
        <summary className="flex min-h-[3.75rem] cursor-pointer list-none items-center gap-3 px-3.5 py-3 [&::-webkit-details-marker]:hidden">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--bio-superficie-alta)] text-[var(--bio-acento)]">
            <MapPin size={18} aria-hidden strokeWidth={1.6} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[0.92rem] font-medium leading-tight">{bloco.titulo}</span>
            {bloco.detalhe ? (
              <span className="mt-0.5 block text-[0.75rem] leading-snug text-[var(--bio-apoio)]">{bloco.detalhe}</span>
            ) : null}
          </span>
          <ChevronDown
            size={18}
            aria-hidden
            className="shrink-0 opacity-70 transition-transform group-open/lojas:rotate-180"
          />
        </summary>

        <ul className="divide-y divide-[var(--bio-linha)] border-t border-[var(--bio-linha)]">
          {lojas.map((l) => {
            const whats = whatsappDaLoja(l, bloco.mensagem);
            const tel = whats ? null : linkDeTelefone(l);
            return (
              <li key={l.id} className="flex items-center gap-3 px-3.5 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.85rem] font-medium leading-tight">{l.name}</span>
                  {l.addressLocality ? (
                    <span className="mt-0.5 block text-[0.72rem] text-[var(--bio-apoio)]">{l.addressLocality}</span>
                  ) : null}
                </span>
                {whats ? (
                  <a
                    href={whats}
                    data-evento="clique_whatsapp"
                    data-destino={l.slug}
                    aria-label={`WhatsApp da loja ${l.name}`}
                    className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full bg-[var(--bio-acao)] px-3.5 text-[0.78rem] font-semibold text-[var(--bio-acao-texto)] hover:bg-[var(--bio-acao-realce)]"
                  >
                    <IconeWhatsapp size={15} />
                    WhatsApp
                  </a>
                ) : tel ? (
                  <a
                    href={tel}
                    data-evento="clique_telefone"
                    data-destino={l.slug}
                    aria-label={`Ligar para a loja ${l.name}`}
                    className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-[var(--bio-linha-forte)] px-3.5 text-[0.78rem] font-semibold hover:border-[var(--bio-acento)]"
                  >
                    <Phone size={14} aria-hidden />
                    Ligar
                  </a>
                ) : null}
              </li>
            );
          })}
        </ul>

        <a
          href={comBasePath("/lojas")}
          data-evento="clique_link"
          data-destino="Endereços e horários das lojas"
          className="flex items-center justify-center gap-1 border-t border-[var(--bio-linha)] px-3.5 py-3 text-[0.8rem] font-semibold text-[var(--bio-acento)] hover:underline"
        >
          Ver endereços e horários
          <ChevronRight size={15} aria-hidden />
        </a>
      </details>
    </section>
  );
}

export function Rodape() {
  return (
    <footer data-regiao="bio-rodape" className="mt-10 text-center">
      <ul className="flex justify-center gap-2">
        {SITE.sameAs.map((url) => (
          <li key={url}>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              data-evento="clique_link"
              data-destino={nomeDaRede(url)}
              aria-label={`${SITE.name} no ${nomeDaRede(url)}`}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--bio-linha)] text-[var(--bio-apoio)] transition-colors hover:border-[var(--bio-acento)] hover:text-[var(--bio-acento)]"
            >
              <IconeDaRede url={url} />
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-5 text-[0.75rem] text-[var(--bio-apoio)]">
        Loja oficial:{" "}
        <a
          href={SITE.lojaUrl}
          data-evento="clique_produto"
          data-destino="Loja oficial"
          className="font-semibold text-[var(--bio-texto)] underline-offset-4 hover:underline"
        >
          jkaliancas.com.br
        </a>
      </p>
    </footer>
  );
}
