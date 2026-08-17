import Link from "next/link";
// `Map` sai renomeado: importado com o nome original, ele sombreia o `Map`
// nativo do JavaScript, e o agrupamento por cluster e por cidade mais abaixo
// quebra com um erro que não parece ter relação com ícone nenhum.
import { ArrowUpRight, Map as IconeMapa, MapPin, Ruler, ShoppingBag } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { CampoDeBusca } from "@/components/busca/CampoDeBusca";
import { SITE } from "@/lib/seo/site";
import { IconeAlianca } from "./IconeAlianca";
import { Vitrine } from "./Vitrine";
import type { ProdutoDaVitrine } from "@/lib/data/produtos";
import { tempoDeLeitura, dataLonga } from "@/lib/content/leitura";
import { INSTITUCIONAL, anosDeMercado } from "@/lib/content/institucional";
import type { Content, Location } from "@/lib/content/types";
import { listaDeTexto, numero, texto, type Bloco } from "@/lib/blocos/tipos";

export type DadosDaHome = {
  guias: Content[];
  lojas: Location[];
  produtos: ProdutoDaVitrine[];
};

function meta(g: Content) {
  const data = dataLonga(g.publishedAt);
  return (
    <>
      {data ? <time dateTime={g.publishedAt ?? undefined}>{data}</time> : null}
      <span>{tempoDeLeitura(g.bodyHtml ?? g.bodyMd)} min de leitura</span>
    </>
  );
}

/* ------------------------------------------------------------------ hero */

function Widget({
  href,
  Icone,
  titulo,
  apoio,
  externo = false,
  dourado = false,
}: {
  href: string;
  Icone: () => React.ReactElement;
  titulo: string;
  apoio?: string;
  externo?: boolean;
  dourado?: boolean;
}) {
  return (
    <Link
      href={href}
      {...(externo
        ? { target: "_blank", rel: "noopener noreferrer", "data-evento": "clique_produto" }
        : {})}
      className={`group flex w-full items-center gap-3.5 rounded-[20px] p-3.5 text-left transition-[transform,box-shadow] duration-500 ease-[cubic-bezier(.2,.75,.25,1)] hover:-translate-y-1 ${
        dourado
          ? // Texto em tinta escura, não branco: branco sobre este dourado dá
            // 2,61:1 e reprova no contraste (manual da marca).
            "bg-gradient-to-br from-brand-light to-brand text-ink shadow-[var(--jk-sombra-acao)] hover:shadow-[var(--jk-sombra-acao-alta)]"
          : "border border-white/70 bg-white/60 backdrop-blur-xl shadow-[var(--jk-sombra-widget)] hover:shadow-[var(--jk-sombra-widget-alta)]"
      }`}
    >
      <span
        aria-hidden
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] ${
          dourado ? "bg-ink/10 text-ink" : "bg-brand/12 text-brand-strong"
        }`}
      >
        <Icone />
      </span>

      <span className="min-w-0 flex-1">
        <span
          className={`font-display block truncate text-[1.02rem] leading-tight ${
            dourado ? "font-semibold" : "text-ink transition-colors group-hover:text-brand-strong"
          }`}
        >
          {titulo}
        </span>
        {apoio ? (
          <span className="mt-1 line-clamp-2 block text-nota leading-snug text-muted">{apoio}</span>
        ) : null}
      </span>

      <ArrowUpRight
        size={15}
        aria-hidden
        className={`shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 ${
          dourado ? "text-ink/70" : "text-muted"
        }`}
      />
    </Link>
  );
}

function HeroDeBusca({ p }: { p: Record<string, unknown> }) {
  const widgets = (
    /*
      Três widgets do MESMO tamanho, alinhados pela direita e com o mesmo
      espaçamento entre eles.

      A primeira versão escalonava largura e recuo para imitar a área de
      trabalho do macOS, e o resultado leu como desalinhamento, não como
      intenção: cartão de widget ali é sempre da mesma família, o que varia é o
      conteúdo. O que dá a sensação de flutuar é a sombra de duas camadas e o
      fato de estarem fora do fluxo, não o desencontro.
    */
    <div
      className="mx-auto mt-12 flex max-w-6xl flex-col gap-3 px-5 sm:px-8 xl:absolute xl:inset-y-0 xl:right-6 xl:mx-0 xl:mt-0 xl:w-[17.5rem] xl:max-w-none xl:justify-center xl:px-0 2xl:right-12 2xl:w-[19rem]"
      aria-label="Atalhos"
      role="group"
    >
      <Widget
        href="/medidor-de-aliancas"
        Icone={() => <IconeAlianca size={21} />}
        titulo={texto(p, "atalhoMedidorTitulo", "Medidor de aliança")}
        apoio={texto(p, "atalhoMedidorApoio", "Descubra seu aro pela tela, com uma moeda de R$ 1.")}
      />
      <Widget
        href="/lojas"
        Icone={() => <IconeMapa size={19} />}
        titulo={texto(p, "atalhoLojasTitulo", "Lojas físicas")}
        apoio={texto(p, "atalhoLojasApoio", "Aro de prova, ajuste de tamanho e atendimento presencial.")}
      />
      <Widget
        href={`${SITE.lojaUrl}?utm_source=portal&utm_medium=home&utm_campaign=widget`}
        Icone={() => <ShoppingBag size={18} />}
        titulo={texto(p, "atalhoLojaTitulo", "Comprar na loja oficial")}
        externo
        dourado
      />
    </div>
  );

  return (
    <section className="grain relative overflow-hidden">
      <Container size="wide" className="relative py-16 sm:py-24 xl:py-32">
        <div className="mx-auto w-full max-w-[44rem] text-center xl:max-w-[38rem]">
          <p className="eyebrow">{texto(p, "eyebrow", "Guia JK Alianças")}</p>
          {/* Sem animação de entrada: este h1 define o LCP, e começar em
              opacity 0 atrasa a métrica de graça. */}
          <h1 className="font-display mx-auto mt-5 max-w-[18ch] text-display text-ink">
            {texto(p, "titulo", "Tudo sobre alianças, joias e semijoias")}
          </h1>
          <p className="mx-auto mt-5 max-w-[50ch] text-lede leading-relaxed text-muted">
            {texto(p, "lede", "Tamanho, largura, material e preço, explicado por quem fabrica.")}
          </p>

          <div className="mt-9">
            <CampoDeBusca
              placeholder={texto(p, "placeholder", "Ex.: como descobrir meu aro")}
              sugestoes={listaDeTexto(p, "sugestoes", [])}
            />
          </div>
        </div>
      </Container>

      {/* Fora do Container: assim os widgets se posicionam pela SEÇÃO e ocupam a
          margem que sobra ao lado da coluna de leitura. */}
      {widgets}
    </section>
  );
}

/* --------------------------------------------------------- últimos guias */

function UltimosConteudos({ p, guias }: { p: Record<string, unknown>; guias: Content[] }) {
  if (guias.length === 0) return null;

  const quantos = numero(p, "quantidade", 6);
  const lista = guias.slice(0, quantos);

  return (
    <section>
      <Container size="wide" className="py-14 sm:py-20">
        {/*
          Cabeçalho de seção: título, filete e link. No desktop os três ficam na
          mesma linha, com o filete esticando e o link colado na direita. No
          celular isso não cabe, e o arranjo abaixo é o que faz a coisa quebrar
          sem abrir barra de rolagem horizontal. Mexer numa peça sozinha traz o
          defeito de volta.

          O título NÃO leva `shrink-0`. Com ele, o texto ficava travado na
          largura de conteúdo máximo e vazava a tela inteira num aparelho de
          320 px, porque quem não encolhe também não quebra linha. Junto vão
          `min-w-0` e `break-words`, que só resolvem em par: item de flex tem
          largura mínima automática igual à palavra mais longa, `min-w-0` deixa
          a caixa encolher abaixo disso, e aí é o texto que passa por fora, até
          `break-words` partir a palavra, e só quando não há outro jeito. Isso
          vale menos pelo título de fábrica e mais pelo que vem do banco: o nome
          do grupo em `/dicas` e o título gravado pelo `/admin/home`.

          Filete e link moram no MESMO div, e é isso que os faz descer juntos.
          Soltos como irmãos do título, o filete cabia no fim da primeira linha
          e o link caía sozinho na linha de baixo, encostado na esquerda, com o
          filete apontando para o nada. Como um item só, ou os dois ficam ao
          lado do título ou os dois descem, e o link continua na direita nos
          dois casos, porque o filete cresce dentro do grupo. O `min-w-32` é o
          ponto de quebra: abaixo disso o grupo prefere descer a espremer o
          filete até virar um toco.
        */}
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-3">
          <h2 className="font-display min-w-0 break-words text-titulo-secao text-ink">
            {texto(p, "titulo", "Últimos posts")}
          </h2>
          <div className="flex min-w-32 flex-1 items-baseline gap-4">
            <span aria-hidden className="hairline flex-1" />
            <Link
              href="/dicas"
              className="shrink-0 text-apoio font-semibold text-brand-nav hover:underline"
            >
              {texto(p, "verTodos", "Ver todos")}
            </Link>
          </div>
        </div>

        {/*
          Grade de cartões do mesmo tamanho, e não uma capa gigante seguida de
          uma lista. Com um guia publicado, a capa em 16:9 ocupava quase uma
          tela inteira para entregar um link, e a home parecia vazia por
          excesso de espaço, não por falta de conteúdo. O cartão aguenta um
          item ou doze sem mudar de cara.
        */}
        <ul className="mt-9 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {lista.map((g, i) => (
            <li key={g.id} className="rise" style={{ animationDelay: `${i * 70}ms` }}>
              <Card
                href={`/${g.slug}`}
                imagem={g.capa}
                titulo={g.title}
                resumo={g.excerpt}
                etiqueta={
                  g.cluster ? (
                    <Pill>{g.cluster.charAt(0).toUpperCase() + g.cluster.slice(1)}</Pill>
                  ) : null
                }
                meta={meta(g)}
              />
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

/* --------------------------------------------------------------- vitrine */

function VitrineDeProdutos({
  p,
  produtos,
}: {
  p: Record<string, unknown>;
  produtos: ProdutoDaVitrine[];
}) {
  if (produtos.length === 0) return null;

  return (
    <section>
      <Container size="wide" className="pb-14 sm:pb-20">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-3">
          <h2 className="font-display min-w-0 break-words text-titulo-secao text-ink">
            {texto(p, "titulo", "Da nossa fábrica")}
          </h2>
          <div className="flex min-w-32 flex-1 items-baseline gap-4">
            <span aria-hidden className="hairline flex-1" />
            <a
              href={`${SITE.lojaUrl}?utm_source=portal&utm_medium=vitrine&utm_campaign=ver_tudo`}
              target="_blank"
              rel="noopener noreferrer"
              data-evento="clique_produto"
              className="shrink-0 text-apoio font-semibold text-brand-nav hover:underline"
            >
              Ver a loja
            </a>
          </div>
        </div>
        <p className="mt-2 max-w-[52ch] leading-relaxed text-muted">
          {texto(p, "subtitulo", "Uma amostra do catálogo.")}
        </p>

        <div className="mt-7">
          <Vitrine produtos={produtos} rotuloBotao={texto(p, "botao", "Ver produto")} />
        </div>
      </Container>
    </section>
  );
}

/* ---------------------------------------------------------------- trilhas */

function Trilhas({ p, guias }: { p: Record<string, unknown>; guias: Content[] }) {
  // As trilhas saem dos clusters que EXISTEM. Uma porta que leva a lugar
  // nenhum é pior que porta nenhuma.
  const contagem = new Map<string, number>();
  for (const g of guias) {
    if (!g.cluster) continue;
    contagem.set(g.cluster, (contagem.get(g.cluster) ?? 0) + 1);
  }
  if (contagem.size === 0) return null;

  return (
    <section>
      <Container size="wide" className="pb-14 sm:pb-20">
        <h2 className="font-display text-titulo-secao text-ink">
          {texto(p, "titulo", "Por onde começar")}
        </h2>
        <p className="mt-2 max-w-[52ch] leading-relaxed text-muted">
          {texto(p, "subtitulo", "Escolha o assunto e comece por aí.")}
        </p>
        <ul className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...contagem].map(([cluster, n]) => (
            <li key={cluster}>
              <Link
                href={`/dicas#${cluster}`}
                className="glass-card group flex h-full flex-col justify-between rounded-lg p-5"
              >
                <span className="font-display text-titulo-bloco text-ink transition-colors group-hover:text-brand-strong">
                  {cluster.charAt(0).toUpperCase() + cluster.slice(1)}
                </span>
                <span className="mt-3 text-nota text-muted">
                  {n} {n === 1 ? "post" : "posts"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

/* --------------------------------------------------------------- medidor */

function Medidor({ p }: { p: Record<string, unknown> }) {
  return (
    <section>
      <Container size="wide" className="pb-14 sm:pb-20">
        <div className="glass relative overflow-hidden rounded-xl p-8 sm:p-12">
          <div
            aria-hidden
            className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-brand/20 blur-3xl"
          />
          <div className="relative flex flex-col items-start gap-7 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-xl">
              <span className="flex h-11 w-11 items-center justify-center rounded-sm border border-brand/30 bg-brand/10 text-brand-nav">
                <Ruler size={20} aria-hidden />
              </span>
              <h2 className="font-display mt-5 text-titulo-secao text-ink">
                {texto(p, "titulo", "Descubra o tamanho da sua aliança pela tela")}
              </h2>
              <p className="mt-3 leading-relaxed text-muted">{texto(p, "texto", "")}</p>
            </div>
            <Button href="/medidor-de-aliancas" size="lg" icone={<Ruler size={18} />}>
              {texto(p, "botao", "Medir minha aliança")}
            </Button>
          </div>
        </div>
      </Container>
    </section>
  );
}

/* ----------------------------------------------------------------- lojas */

function Lojas({ p, lojas }: { p: Record<string, unknown>; lojas: Location[] }) {
  if (lojas.length === 0) return null;

  const cidades = new Map<string, number>();
  for (const l of lojas) {
    const cidade = l.addressLocality?.trim();
    if (cidade) cidades.set(cidade, (cidades.get(cidade) ?? 0) + 1);
  }

  return (
    <section>
      <Container size="wide" className="pb-14 sm:pb-20">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-3">
          <h2 className="font-display min-w-0 break-words text-titulo-secao text-ink">
            {texto(p, "titulo", "Experimente antes de comprar")}
          </h2>
          <div className="flex min-w-32 flex-1 items-baseline gap-4">
            <span aria-hidden className="hairline flex-1" />
            <Link href="/lojas" className="shrink-0 text-apoio font-semibold text-brand-nav hover:underline">
              Ver as {lojas.length} lojas
            </Link>
          </div>
        </div>
        <p className="mt-2 max-w-[52ch] leading-relaxed text-muted">
          {texto(p, "subtitulo", "Atendimento presencial, aro de prova e ajuste na hora.")}
        </p>

        <ul className="mt-7 flex flex-wrap gap-2.5">
          {[...cidades].map(([cidade, n]) => (
            <li key={cidade}>
              <Pill href="/lojas" tom="neutro" icone={<MapPin size={13} />}>
                {cidade}
                {n > 1 ? ` (${n})` : ""}
              </Pill>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

/* ----------------------------------------------------------------- prova */

function Prova({ p }: { p: Record<string, unknown> }) {
  // Sai de `institucional.ts`, que é o único lugar com fonte registrada. O
  // "+17 mil avaliações" que vivia escrito na home só volta quando a JK
  // aprovar a origem do número (REGRAS.md §1).
  const itens = [
    { k: "Fábrica própria", v: "Controle de cada detalhe" },
    { k: `${INSTITUCIONAL.lojasFisicas} lojas físicas`, v: "Atendimento presencial" },
    { k: `${anosDeMercado()} anos de mercado`, v: `Desde ${INSTITUCIONAL.fundadaEmTexto}` },
  ];

  return (
    <section>
      <Container size="wide" className="pb-14 sm:pb-20">
        <div className="glass rounded-xl p-7 sm:p-9">
          {/* h2, e não p: seção sem cabeçalho fura a hierarquia de headings que o
              REGRAS.md exige e some do sumário que leitor de tela monta. A classe
              `eyebrow` mantém a aparência de rótulo. */}
          <h2 className="eyebrow">{texto(p, "titulo", "Por que a JK")}</h2>
          <ul className="mt-6 grid gap-5 sm:grid-cols-3">
            {itens.map((item) => (
              <li key={item.k} className="border-b border-border/70 pb-5 sm:border-b-0 sm:pb-0">
                <span className="font-display block text-titulo-bloco text-brand-strong">{item.k}</span>
                <span className="mt-1 block text-apoio text-muted">{item.v}</span>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-nota text-muted">Fonte: {INSTITUCIONAL.fonte}</p>
        </div>
      </Container>
    </section>
  );
}

/* ------------------------------------------------------------------- cta */

function Cta({ p }: { p: Record<string, unknown> }) {
  return (
    <section>
      <Container size="wide" className="pb-8">
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-charcoal via-charcoal to-wine-deep px-8 py-14 text-white sm:px-14 sm:py-16">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand/20 blur-3xl"
          />
          <div className="relative flex flex-col items-start gap-8 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-lg">
              <p className="eyebrow text-brand-light">{texto(p, "eyebrow", "Onde comprar")}</p>
              <h2 className="font-display mt-3 text-titulo-secao leading-tight">
                {texto(p, "titulo", "Experimente na loja mais perto de você")}
              </h2>
              <p className="mt-4 text-white/70">{texto(p, "texto", "")}</p>
            </div>
            <Button href="/lojas">{texto(p, "botao", "Ver as lojas")}</Button>
          </div>
        </div>
      </Container>
    </section>
  );
}

/* -------------------------------------------------------------- despacho */

/**
 * Renderiza um bloco do layout.
 *
 * Tipo desconhecido devolve `null` em silêncio no site e nada quebra. É o modo
 * seguro: um bloco removido do código não pode derrubar a página inteira só
 * porque ainda existe no JSON gravado.
 */
export function RenderizarBloco({ bloco, dados }: { bloco: Bloco; dados: DadosDaHome }) {
  if (!bloco.visivel) return null;
  const p = bloco.props;

  switch (bloco.tipo) {
    case "hero-busca":
      return <HeroDeBusca p={p} />;
    case "ultimos-conteudos":
      return <UltimosConteudos p={p} guias={dados.guias} />;
    case "vitrine":
      return <VitrineDeProdutos p={p} produtos={dados.produtos} />;
    case "trilhas":
      return <Trilhas p={p} guias={dados.guias} />;
    case "medidor":
      return <Medidor p={p} />;
    case "lojas":
      return <Lojas p={p} lojas={dados.lojas} />;
    case "prova":
      return <Prova p={p} />;
    case "cta":
      return <Cta p={p} />;
    default:
      return null;
  }
}
