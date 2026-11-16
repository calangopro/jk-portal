import Link from "next/link";
import { Flame } from "lucide-react";
import { SeloDaRede } from "@/components/redes/Selo";
import { CRITERIOS, FATOR_ACIMA, NOME_DO_GRUPO, fatorEmPalavra, valorDoCriterio, type Conteudo, type Criterio, type GrupoDeFormato } from "@/lib/redes/conteudos";
import type { ContaDoConteudo } from "@/lib/redes/conteudos-dados";
import { ehRede, nomeDaRede, nomeDoFormatoNaRede, type Formato, type RedeId } from "@/lib/redes/redes";
import { compacto } from "@/lib/redes/resumo";
import { Capa } from "./Capa";

/**
 * "Em alta", só o desenho. Cada publicação do período em cartão, na ordem que
 * a pessoa escolheu, com o selo de "acima do normal" quando rendeu o dobro do
 * normal da própria conta no mesmo tipo (`lib/redes/conteudos.ts`).
 *
 * Os filtros são links: a página é do servidor, volta e avança funcionam, e o
 * endereço pode ser mandado para alguém.
 */

export type FiltroDoEmAlta = { dias: number; rede: RedeId | null; grupo: GrupoDeFormato | null; ordem: Criterio; todos: boolean };

const GRUPOS: GrupoDeFormato[] = ["video", "foto", "story"];
const FORMATOS: Formato[] = ["post", "carrossel", "video_curto", "story", "video", "texto"];
const MOSTRAR = 40;

export function formatoNaRede(formato: string | null, rede: RedeId): string {
  return formato && FORMATOS.includes(formato as Formato) ? nomeDoFormatoNaRede(formato as Formato, rede) : "Publicação";
}

export const dataCurta = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" }) : "");

function enderecoCom(f: FiltroDoEmAlta, mudanca: Partial<FiltroDoEmAlta>): string {
  const n = { ...f, ...mudanca };
  const q = new URLSearchParams();
  if (n.dias !== 28) q.set("dias", String(n.dias));
  if (n.rede) q.set("rede", n.rede);
  if (n.grupo) q.set("tipo", n.grupo);
  if (n.ordem !== "visualizacoes") q.set("ordem", n.ordem);
  if (n.todos) q.set("todos", "1");
  const s = q.toString();
  return s ? `?${s}` : "?";
}

function Chip({ href, ativo, children }: { href: string; ativo: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={ativo ? "page" : undefined}
      className={"flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold " + (ativo ? "border-transparent bg-ink text-white" : "border-ink/12 bg-white text-ink hover:border-ink/30")}
    >
      {children}
    </Link>
  );
}

/** O número da ordem escolhida, do jeito que se lê no cartão. */
function principal(c: Conteudo, ordem: Criterio): { valor: string; rotulo: string } | null {
  const v = valorDoCriterio(c, ordem);
  if (v === null) return null;
  if (ordem === "taxa") return { valor: v.toLocaleString("pt-BR", { maximumFractionDigits: 1 }), rotulo: "interações a cada 100 que viram" };
  if (ordem === "visualizacoes") return { valor: compacto(v), rotulo: c.visualizacoes !== null ? "visualizações" : "pessoas alcançadas" };
  return { valor: compacto(v), rotulo: CRITERIOS.find((x) => x.id === ordem)?.curto ?? "" };
}

function CartaoDoConteudo({ c, ordem }: { c: Conteudo; ordem: Criterio }) {
  const p = principal(c, ordem);
  const legenda = (c.legenda ?? "").trim();
  return (
    <li className="min-w-0">
      <Link href={`/admin/redes/conteudos/${c.id}`} className="group block rounded-[16px] focus-visible:outline-2 focus-visible:outline-offset-2">
        {/* Mesma proporção para todos: Reels e foto lado a lado em alturas diferentes desalinham a grade. */}
        <div className="relative aspect-[4/5] overflow-hidden rounded-[14px] bg-ink/[0.06]">
          <Capa src={c.miniatura_url} rede={c.rede} />
          {c.acima && c.fator !== null ? (
            <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-1 text-[0.68rem] font-bold shadow-sm" style={{ color: "#046c4e" }}>
              <Flame size={12} aria-hidden="true" /> {fatorEmPalavra(c.fator)} o normal
            </span>
          ) : null}
          <span className="absolute right-2 top-2 rounded-full bg-white/95 p-0.5 shadow-sm">
            <SeloDaRede id={c.rede} tamanho={20} />
          </span>
        </div>
        <div className="mt-2 min-w-0 px-0.5">
          {p ? (
            <p className="numeros leading-tight">
              <span className="font-display text-lg text-ink">{p.valor}</span> <span className="text-[0.7rem] text-muted">{p.rotulo}</span>
            </p>
          ) : (
            <p className="text-[0.72rem] leading-snug text-muted">A rede ainda não informou este número.</p>
          )}
          <p className="mt-0.5 truncate text-[0.7rem] text-muted">
            {formatoNaRede(c.formato, c.rede)} · {dataCurta(c.publicado_em)}
            {ordem !== "comentarios" && c.comentarios ? ` · ${compacto(c.comentarios)} coment.` : ""}
          </p>
          {legenda ? <p className="mt-0.5 line-clamp-2 break-words text-xs leading-snug text-ink group-hover:underline">{legenda}</p> : null}
        </div>
      </Link>
    </li>
  );
}

export function TelaEmAlta({ conteudos, contas, filtro, periodos }: { conteudos: Conteudo[] | null; contas: ContaDoConteudo[]; filtro: FiltroDoEmAlta; periodos: number[] }) {
  const redesComConta = [...new Set(contas.map((c) => c.rede))];
  const lista = conteudos ?? [];
  const acima = lista.filter((c) => c.acima).length;
  const mostrados = filtro.todos ? lista : lista.slice(0, MOSTRAR);

  return (
    <div data-painel-largo>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow">Social Media</p>
          <h1 className="font-display mt-2 text-3xl text-ink sm:text-4xl">Em alta</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted sm:text-base">
            O que mais rendeu, post a post. Cada publicação é comparada com o normal da própria conta no mesmo tipo (vídeo, foto ou story), nos últimos 90 dias: o selo verde é de quem rendeu {FATOR_ACIMA} vezes o normal ou mais.
          </p>
        </div>
        <nav aria-label="Período" className="flex max-w-full gap-1 overflow-x-auto rounded-full border border-border bg-surface/60 p-1">
          {periodos.map((d) => (
            <Link
              key={d}
              href={enderecoCom(filtro, { dias: d, todos: false })}
              scroll={false}
              aria-current={d === filtro.dias ? "page" : undefined}
              className={"shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold sm:px-3.5 " + (d === filtro.dias ? "painel-aba-ativa" : "text-muted hover:text-ink")}
            >
              {d} dias
            </Link>
          ))}
        </nav>
      </header>

      <div className="mt-5 space-y-2">
        <nav aria-label="Ordem" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {CRITERIOS.map((c) => (
            <Chip key={c.id} href={enderecoCom(filtro, { ordem: c.id, todos: false })} ativo={filtro.ordem === c.id}>
              {c.nome}
            </Chip>
          ))}
        </nav>
        <nav aria-label="Rede e tipo" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          <Chip href={enderecoCom(filtro, { rede: null, todos: false })} ativo={!filtro.rede}>
            Todas as redes
          </Chip>
          {redesComConta.map((r) => (
            <Chip key={r} href={enderecoCom(filtro, { rede: r, todos: false })} ativo={filtro.rede === r}>
              <SeloDaRede id={r} tamanho={16} /> {nomeDaRede(r)}
            </Chip>
          ))}
          <span className="mx-1 w-px shrink-0 self-stretch bg-ink/10" aria-hidden="true" />
          <Chip href={enderecoCom(filtro, { grupo: null, todos: false })} ativo={!filtro.grupo}>
            Todos os tipos
          </Chip>
          {GRUPOS.map((g) => (
            <Chip key={g} href={enderecoCom(filtro, { grupo: g, todos: false })} ativo={filtro.grupo === g}>
              {NOME_DO_GRUPO[g]}
            </Chip>
          ))}
        </nav>
      </div>

      {conteudos === null ? (
        <p className="glass mt-6 rounded-[18px] p-5 text-sm text-muted">
          <span className="font-semibold text-ink">Não deu para ler as publicações agora.</span> Recarregue a página em alguns segundos.
        </p>
      ) : lista.length === 0 ? (
        <div className="glass mt-6 rounded-[20px] px-5 py-10 text-center sm:py-14">
          <p className="font-display text-xl text-ink">Nenhuma publicação neste filtro.</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">Troque o período, a rede ou o tipo. As publicações aparecem aqui depois que uma rede é ligada e o painel faz a primeira leitura.</p>
        </div>
      ) : (
        <>
          <p className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink">
            <span>
              <span className="font-semibold">{lista.length.toLocaleString("pt-BR")}</span> {lista.length === 1 ? "publicação" : "publicações"} em {filtro.dias} dias
            </span>
            {acima ? (
              <span className="inline-flex items-center gap-1 font-semibold" style={{ color: "#046c4e" }}>
                <Flame size={14} aria-hidden="true" /> {acima} acima do normal
              </span>
            ) : (
              <span className="text-muted">nenhuma acima do normal</span>
            )}
          </p>
          <ol className="mt-4 grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
            {mostrados.map((c) => (
              <CartaoDoConteudo key={c.id} c={c} ordem={filtro.ordem} />
            ))}
          </ol>
          {!filtro.todos && lista.length > MOSTRAR ? (
            <div className="mt-6 text-center">
              <Link href={enderecoCom(filtro, { todos: true })} scroll={false} className="painel-toque inline-flex rounded-full border border-ink/15 bg-white px-5 py-2.5 text-sm font-semibold text-ink">
                Ver as {lista.length.toLocaleString("pt-BR")} publicações
              </Link>
            </div>
          ) : null}
          <p className="mt-6 max-w-3xl text-[0.7rem] leading-relaxed text-muted">
            Os números de cada post são lidos de meia em meia hora, um lote por vez: post recém-publicado pode aparecer ainda sem visualizações. Stories só têm número enquanto estão no ar. O YouTube não informa alcance.
          </p>
        </>
      )}
    </div>
  );
}

export function filtroDoEndereco(sp: { dias?: string; rede?: string; tipo?: string; ordem?: string; todos?: string }, periodos: number[]): FiltroDoEmAlta {
  const dias = periodos.includes(Number(sp.dias)) ? Number(sp.dias) : 28;
  return {
    dias,
    rede: ehRede(sp.rede) ? sp.rede : null,
    grupo: GRUPOS.includes(sp.tipo as GrupoDeFormato) ? (sp.tipo as GrupoDeFormato) : null,
    ordem: CRITERIOS.some((c) => c.id === sp.ordem) ? (sp.ordem as Criterio) : "visualizacoes",
    todos: sp.todos === "1",
  };
}
