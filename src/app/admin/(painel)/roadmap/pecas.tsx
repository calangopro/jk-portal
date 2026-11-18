import { Bot, RefreshCw, ShieldAlert, Sparkles, TriangleAlert, Wrench, type LucideIcon } from "lucide-react";
import { COR_DO_TOM } from "@/lib/painel/tons";
import { NOME_DA_COLUNA, NOME_DA_PRIORIDADE, NOME_DO_TIPO, cruzamentoEmPalavras, type Conflito, type Prioridade, type Tipo } from "@/lib/roadmap/roadmap";
import { SeloDeTom } from "../Pecas";

/** Pedaços que o quadro e a gaveta do cartão dividem. */

export const ICONE_DO_TIPO: Record<Tipo, LucideIcon> = {
  correcao: Wrench,
  melhoria: Sparkles,
  atualizacao: RefreshCw,
  seguranca: ShieldAlert,
};

/** O tipo é o que o cartão é, não um estado: vai em cinza, com ícone e palavra. */
export function ChipDoTipo({ tipo }: { tipo: Tipo }) {
  const Icone = ICONE_DO_TIPO[tipo];
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-ink/[0.06] px-2 py-0.5 text-[0.68rem] font-semibold text-ink">
      <Icone size={11} aria-hidden="true" />
      {NOME_DO_TIPO[tipo]}
    </span>
  );
}

/** Só urgente e alta ganham cor (vermelho e âmbar, com ícone e palavra). Média e baixa não chamam atenção. */
export function SeloDaPrioridade({ prioridade, sempre = false }: { prioridade: Prioridade; sempre?: boolean }) {
  if (prioridade === "urgente") return <SeloDeTom tom="ruim">Urgente</SeloDeTom>;
  if (prioridade === "alta") return <SeloDeTom tom="atencao">Alta</SeloDeTom>;
  return sempre ? <SeloDeTom tom="neutro">{NOME_DA_PRIORIDADE[prioridade]}</SeloDeTom> : null;
}

/** A inicial de quem pegou, na cor do setor. */
export function Inicial({ nome }: { nome: string | null }) {
  return (
    <span
      aria-hidden="true"
      className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[0.62rem] font-bold text-white"
      style={{ background: "var(--setor, #55606e)" }}
    >
      {(nome ?? "?").trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

/** Quem está com o cartão, e se é o Claude dessa pessoa. */
export function Dono({ nome, viaClaude, sessao, compacto = false }: { nome: string | null; viaClaude: boolean; sessao?: string | null; compacto?: boolean }) {
  if (!nome) return <span className="text-muted">Sem dono</span>;
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <Inicial nome={nome} />
      <span className="truncate font-semibold text-ink">{nome}</span>
      {viaClaude ? (
        <span className="inline-flex shrink-0 items-center gap-0.5 text-muted" title={sessao ?? "Pelo Claude"}>
          <Bot size={12} aria-hidden="true" />
          {compacto ? <span className="sr-only">pelo Claude</span> : <span>pelo Claude</span>}
        </span>
      ) : null}
    </span>
  );
}

export const quando = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/**
 * O aviso de cruzamento: cada cartão em trabalho que mexe no mesmo lugar, com
 * os caminhos que se sobrepõem. É aviso (âmbar), não trava.
 */
export function ListaDeCruzamentos({ conflitos: todos, titulo }: { conflitos: Conflito[]; titulo: string }) {
  if (todos.length === 0) return null;
  const conflitos = todos.filter((c) => !c.soComum);
  const deTodos = todos.filter((c) => c.soComum);
  const tom = COR_DO_TOM.atencao;
  const leve = deTodos.length ? (
    <p className="text-xs text-muted">
      Só arquivo de todos em comum com {deTodos.map((c) => `o cartão ${c.id}`).join(", ")} ({[...new Set(deTodos.flatMap((c) => c.cruzam.map((x) => x.meu)))].slice(0, 3).join(", ")}): o git costuma juntar sozinho; quem juntar depois traz o main antes.
    </p>
  ) : null;
  if (conflitos.length === 0) return leve;
  return (
    <>
    <div role="status" className="rounded-[12px] px-3 py-2.5 text-sm" style={{ background: tom.fundo, color: tom.texto }}>
      <p className="flex items-start gap-1.5 font-semibold">
        <TriangleAlert size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
        <span>{titulo}</span>
      </p>
      <ul className="mt-1.5 grid grid-cols-1 gap-1.5 pl-5">
        {conflitos.map((c) => (
          <li key={c.id} className="min-w-0 text-ink">
            <span className="font-semibold">
              {c.id}. {c.titulo}
            </span>
            <span className="text-muted">
              {" "}
              ({NOME_DA_COLUNA[c.coluna]}, com {c.responsavel ?? "ninguém"}
              {c.viaClaude ? ", pelo Claude" : ""}
              {c.ramo ? `, ramo ${c.ramo}` : ""})
            </span>
            <ul className="mt-0.5">
              {c.cruzam.filter((x) => !x.comum).slice(0, 8).map((x) => (
                <li key={`${x.meu}|${x.dele}`} className="font-mono text-[0.72rem] [overflow-wrap:anywhere]">
                  {cruzamentoEmPalavras(x)}
                </li>
              ))}
              {c.cruzam.filter((x) => !x.comum).length > 8 ? <li className="text-[0.72rem]">e mais {c.cruzam.filter((x) => !x.comum).length - 8}</li> : null}
            </ul>
          </li>
        ))}
      </ul>
    </div>
    {leve}
    </>
  );
}

/** Uma seleção com rótulo em cima, no jeito do painel. */
export function Selecao({
  rotulo, valor, aoMudar, opcoes,
}: {
  rotulo: string;
  valor: string;
  aoMudar: (v: string) => void;
  opcoes: [string, string][];
}) {
  return (
    <label className="block min-w-0">
      <span className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted">{rotulo}</span>
      <select value={valor} onChange={(e) => aoMudar(e.target.value)} className="mt-1 w-full rounded-[10px] border border-border bg-white px-2.5 py-2 text-sm text-ink">
        {opcoes.map(([v, nome]) => (
          <option key={v} value={v}>{nome}</option>
        ))}
      </select>
    </label>
  );
}
