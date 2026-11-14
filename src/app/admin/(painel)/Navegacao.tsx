"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useLinkStatus } from "next/link";
import type { LucideIcon } from "lucide-react";
import { ExternalLink, Loader2, MoreHorizontal, X } from "lucide-react";
import { LinkRapido } from "@/components/ui/LinkRapido";
import { comBasePath } from "@/lib/seo/base-path";
import { abasDaBarra, nomeDoSetor, type ItemDoSetor, type Setor } from "@/lib/painel/setores";
import { BotaoSair } from "./BotaoSair";

/**
 * As quatro peças de navegação do painel. Todas leem a mesma lista
 * (`lib/painel/setores.ts`) e recebem de `Moldura` os setores que a pessoa
 * enxerga e onde ela está.
 *
 *   Lateral        computador: os setores, com as telas do setor aberto
 *   AbasDoSetor    celular: as telas do setor em que a pessoa está
 *   BarraDeBaixo   celular: os setores, como em aplicativo
 *   FolhaMais      celular: tudo, mais a conta e o sair
 */

/** A cor do setor desce por variável, para o CSS pintar sem saber qual é. */
export function corDoSetor(setor: Pick<Setor, "cor"> | null): CSSProperties {
  const cor = setor?.cor ?? CARVAO;
  // Sobre a cor cheia vai branco. A Diretoria é carvão, e sobre carvão a casa
  // usa o dourado da marca.
  return { "--setor": cor, "--sobre-setor": cor === CARVAO ? "#d8b877" : "#fff" } as CSSProperties;
}

const CARVAO = "#1a1815";

/**
 * Ícone que vira giro enquanto a página não chega.
 *
 * `useLinkStatus` só funciona DENTRO do Link, por isso é um componente e não
 * um `if` no pai. Com a busca antecipada do `LinkRapido` o giro quase não
 * aparece, mas em rede ruim é ele que diz "recebi o toque".
 */
function IconeDoLink({ Icone, size, className }: { Icone: LucideIcon; size: number; className?: string }) {
  const { pending } = useLinkStatus();
  if (!pending) return <Icone size={size} className={className} aria-hidden="true" />;
  return (
    <>
      <Loader2 size={size} className={`animate-spin ${className ?? ""}`} aria-hidden="true" />
      <span className="sr-only">Carregando</span>
    </>
  );
}

/** O quadradinho colorido que identifica o setor. Cheio quando é o setor aberto. */
function SeloDoSetor({ setor, ativo, tamanho = 36 }: { setor: Setor; ativo: boolean; tamanho?: number }) {
  return (
    <span
      className={`painel-selo grid shrink-0 place-items-center rounded-[11px] ${ativo ? "painel-selo-ativo" : ""}`}
      style={{ width: tamanho, height: tamanho }}
    >
      <IconeDoLink Icone={setor.Icone} size={Math.round(tamanho * 0.47)} />
    </span>
  );
}

function Contador({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span className="shrink-0 rounded-full bg-wine px-1.5 py-0.5 text-[0.62rem] font-bold leading-none text-white">
      {n > 99 ? "99+" : n}
      <span className="sr-only"> aguardando</span>
    </span>
  );
}

/** Comentário esperando moderação aparece no item e no setor que o guarda. */
const pendentesDoItem = (item: ItemDoSetor, pendentes: number) => (item.href === "/admin/comentarios" ? pendentes : 0);
const pendentesDoSetor = (setor: Setor, pendentes: number) =>
  setor.itens.some((i) => i.href === "/admin/comentarios") ? pendentes : 0;

// ---------------------------------------------------------------- computador

export function Lateral({
  setores, atual, item, pendentes,
}: {
  setores: Setor[];
  atual: Setor | null;
  item: ItemDoSetor | null;
  pendentes: number;
}) {
  return (
    <nav aria-label="Setores" className="space-y-1">
      {setores.map((s) => {
        const aberto = atual?.id === s.id;
        return (
          <div key={s.id} style={corDoSetor(s)}>
            <LinkRapido
              href={s.itens[0].href}
              aria-current={aberto && s.itens.length === 1 ? "page" : undefined}
              className={`flex items-center gap-3 rounded-[14px] px-2.5 py-2 transition-colors ${
                aberto ? "bg-white shadow-[0_1px_2px_rgb(23_21_18/0.06),0_6px_18px_-12px_rgb(23_21_18/0.25)]" : "hover:bg-white/70"
              }`}
            >
              <SeloDoSetor setor={s} ativo={aberto} />
              <span className="min-w-0 flex-1">
                <span className={`block text-sm leading-tight ${aberto ? "font-semibold text-ink" : "font-medium text-ink/85"}`}>
                  {nomeDoSetor(s)}
                </span>
                <span className="mt-0.5 block truncate text-[0.7rem] leading-tight text-muted">{s.frase}</span>
              </span>
              {!aberto ? <Contador n={pendentesDoSetor(s, pendentes)} /> : null}
            </LinkRapido>

            {aberto && s.itens.length > 1 ? (
              <ul className="painel-ramo my-1 ml-[1.72rem] space-y-0.5 pl-3">
                {s.itens.map((i) => {
                  const ativo = item?.href === i.href;
                  return (
                    <li key={i.href}>
                      <LinkRapido
                        href={i.href}
                        aria-current={ativo ? "page" : undefined}
                        title={i.desc}
                        className={`flex items-center gap-2.5 rounded-[10px] px-2.5 py-1.5 text-sm transition-colors ${
                          ativo ? "painel-item-ativo font-semibold" : "text-ink/75 hover:bg-white/70 hover:text-ink"
                        }`}
                      >
                        <IconeDoLink Icone={i.Icone} size={15} className="shrink-0" />
                        <span className="min-w-0 flex-1 truncate">{i.label}</span>
                        <Contador n={pendentesDoItem(i, pendentes)} />
                      </LinkRapido>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}

// ------------------------------------------------------------------- celular

/**
 * As telas do setor, em fila que rola de lado, logo abaixo da barra de topo.
 * A aba aberta é trazida para o meio da fila, senão quem entra direto na
 * última tela do setor não vê em que aba está.
 */
export function AbasDoSetor({ setor, item, pendentes }: { setor: Setor; item: ItemDoSetor | null; pendentes: number }) {
  const fila = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const ativa = fila.current?.querySelector<HTMLElement>('[aria-current="page"]');
    const caixa = fila.current;
    if (!ativa || !caixa) return;
    // Conta na mão em vez de `scrollIntoView`, que também rolaria a página.
    caixa.scrollTo({ left: ativa.offsetLeft - (caixa.clientWidth - ativa.offsetWidth) / 2 });
  }, [item?.href]);

  if (setor.itens.length < 2) return null;
  return (
    <div ref={fila} className="painel-fila flex gap-1.5 overflow-x-auto px-4 pb-2.5 lg:hidden" style={corDoSetor(setor)}>
      {setor.itens.map((i) => {
        const ativa = item?.href === i.href;
        return (
          <LinkRapido
            key={i.href}
            href={i.href}
            aria-current={ativa ? "page" : undefined}
            className={`painel-toque inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[0.82rem] font-semibold ${
              ativa ? "painel-aba-ativa" : "border border-ink/10 bg-white text-ink/75"
            }`}
          >
            <IconeDoLink Icone={i.Icone} size={14} />
            {i.curto ?? i.label}
            <Contador n={pendentesDoItem(i, pendentes)} />
          </LinkRapido>
        );
      })}
    </div>
  );
}

/**
 * Barra de baixo, como em aplicativo: o polegar alcança, e o lugar de cada
 * setor não muda nunca.
 *
 * É `fixed` e por isso mora FORA de qualquer elemento de vidro: dentro de
 * `backdrop-filter` um `fixed` se ancora no pai, não na janela.
 */
export function BarraDeBaixo({
  setores, atual, item, pendentes, maisAberto, onMais,
}: {
  setores: Setor[];
  atual: Setor | null;
  item: ItemDoSetor | null;
  pendentes: number;
  maisAberto: boolean;
  onMais: () => void;
}) {
  const abas = abasDaBarra(setores);
  const porSetor = setores.length >= 3;
  const algumaAtiva = abas.some((a) => (porSetor ? a.setor === atual?.id : a.href === item?.href));
  // O que ficou de fora da barra mora no "Mais": o aviso de comentário vai junto.
  const foraDaBarra = setores.filter((s) => !abas.some((a) => a.setor === s.id));
  const pendentesNoMais = foraDaBarra.reduce((n, s) => n + pendentesDoSetor(s, pendentes), 0);

  return (
    <nav aria-label="Setores" className="painel-barra fixed inset-x-0 bottom-0 z-40 lg:hidden">
      <ul className="mx-auto flex max-w-lg items-stretch justify-around px-1">
        {abas.map((a) => {
          const ativa = porSetor ? a.setor === atual?.id : a.href === item?.href;
          return (
            <li key={a.href} className="min-w-0 flex-1" style={corDoSetor(a)}>
              <LinkRapido
                href={a.href}
                aria-current={ativa ? "page" : undefined}
                className={`painel-toque flex h-[3.6rem] flex-col items-center justify-center gap-0.5 ${ativa ? "painel-tab-ativa" : "text-ink/60"}`}
              >
                <span className="painel-tab-pilula grid h-7 w-14 place-items-center rounded-full">
                  <IconeDoLink Icone={a.Icone} size={21} />
                </span>
                <span className={`max-w-full truncate px-1 text-[0.68rem] leading-none ${ativa ? "font-bold" : "font-medium"}`}>{a.label}</span>
              </LinkRapido>
            </li>
          );
        })}
        <li className="min-w-0 flex-1" style={corDoSetor(atual)}>
          <button
            type="button"
            onClick={onMais}
            aria-expanded={maisAberto}
            aria-controls="folha-mais"
            className={`painel-toque relative flex h-[3.6rem] w-full flex-col items-center justify-center gap-0.5 ${
              maisAberto || !algumaAtiva ? "painel-tab-ativa" : "text-ink/60"
            }`}
          >
            <span className="painel-tab-pilula relative grid h-7 w-14 place-items-center rounded-full">
              <MoreHorizontal size={21} aria-hidden="true" />
              {pendentesNoMais > 0 ? <span className="absolute right-2.5 top-0.5 h-2 w-2 rounded-full bg-wine" /> : null}
            </span>
            <span className={`text-[0.68rem] leading-none ${maisAberto || !algumaAtiva ? "font-bold" : "font-medium"}`}>Mais</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}

/**
 * Folha que sobe de baixo com TUDO: os setores, as telas de cada um, a conta e
 * o sair. É o mapa do escritório no celular.
 *
 * Vai por portal para o `body`, fecha no Esc, no toque fora e ao trocar de
 * página, e enquanto está aberta a página de trás não rola.
 */
export function FolhaMais({
  aberta, onFechar, setores, atual, item, pendentes, nome, papel, sair,
}: {
  aberta: boolean;
  onFechar: () => void;
  setores: Setor[];
  atual: Setor | null;
  item: ItemDoSetor | null;
  pendentes: number;
  nome: string;
  papel: string;
  sair: () => Promise<void>;
}) {
  const [montado, setMontado] = useState(false);
  const fechar = useRef<HTMLButtonElement>(null);
  useEffect(() => setMontado(true), []);

  useEffect(() => {
    if (!aberta) return;
    const noEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFechar();
    };
    const rolagem = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", noEsc);
    const quemAbriu = document.activeElement as HTMLElement | null;
    fechar.current?.focus();
    return () => {
      document.body.style.overflow = rolagem;
      document.removeEventListener("keydown", noEsc);
      quemAbriu?.focus?.();
    };
  }, [aberta, onFechar]);

  if (!aberta || !montado) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 lg:hidden">
      <button type="button" aria-label="Fechar" className="painel-fundo absolute inset-0 bg-ink/45" onClick={onFechar} />
      <div
        id="folha-mais"
        role="dialog"
        aria-modal="true"
        aria-label="Todos os setores"
        className="painel-folha absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col rounded-t-[26px] shadow-2xl"
        style={{ background: "rgb(var(--jk-bg-rgb))" }}
      >
        <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-ink/15" aria-hidden="true" />
        <div className="flex shrink-0 items-center justify-between gap-3 px-5 pb-3 pt-3">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold leading-tight text-ink">{nome}</p>
            <p className="text-xs leading-tight text-muted">{papel}</p>
          </div>
          <button
            ref={fechar}
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="painel-toque grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-ink shadow-sm"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
          {setores.map((s) => (
            <section key={s.id} style={corDoSetor(s)} aria-label={nomeDoSetor(s)}>
              <div className="flex items-center gap-2.5 px-1">
                <span className={`painel-selo grid h-7 w-7 place-items-center rounded-[9px] ${atual?.id === s.id ? "painel-selo-ativo" : ""}`}>
                  <s.Icone size={14} aria-hidden="true" />
                </span>
                <h2 className="text-sm font-bold text-ink">{nomeDoSetor(s)}</h2>
                <Contador n={pendentesDoSetor(s, pendentes)} />
              </div>
              <ul className="mt-2 grid grid-cols-2 gap-2">
                {s.itens.map((i) => {
                  const ativo = item?.href === i.href;
                  return (
                    <li key={i.href}>
                      <LinkRapido
                        href={i.href}
                        onClick={onFechar}
                        aria-current={ativo ? "page" : undefined}
                        className={`painel-toque flex h-full min-h-[3.4rem] items-center gap-2.5 rounded-[14px] bg-white px-3 py-2.5 ${
                          ativo ? "painel-cartao-ativo" : "border border-ink/[0.07]"
                        }`}
                      >
                        <span className="painel-icone-do-setor shrink-0">
                          <IconeDoLink Icone={i.Icone} size={17} />
                        </span>
                        <span className="min-w-0 flex-1 text-[0.82rem] font-semibold leading-tight text-ink">{i.label}</span>
                        <Contador n={pendentesDoItem(i, pendentes)} />
                      </LinkRapido>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}

          <div className="flex items-center justify-between gap-3 border-t border-ink/10 pt-4">
            {/* `<a>` comum: o site público é outro layout, e abre em outra aba. */}
            <a
              href={comBasePath("/")}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-nav"
            >
              Ver o site <ExternalLink size={13} aria-hidden="true" />
            </a>
            <form action={sair}>
              <BotaoSair />
            </form>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
