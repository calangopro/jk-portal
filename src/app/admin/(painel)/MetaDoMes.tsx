import { CircleAlert, CircleCheck, Target } from "lucide-react";
import type { Andamento } from "@/lib/painel/meta";
import { nomeDoMes } from "@/lib/vendas/periodo";
import { BotaoDeAcao } from "./recuperacao/BotaoDeAcao";

/**
 * Meta do mês no topo do painel: quanto já entrou, onde a barra deveria estar
 * hoje e onde o mês fecha se o ritmo continuar.
 *
 * A barra tem um risco na posição de "hoje": se o preenchimento não chegou
 * nele, a loja está atrás, e dá para ver isso sem ler número nenhum. O estado
 * vem sempre com ícone e palavra, nunca só com a cor.
 *
 * O que se compara com a meta é o faturamento pago lido da Tray MAIS as vendas
 * registradas por fora da loja (0058), e o texto diz quanto veio de cada lado.
 */

const BOM = "#047857";
const PROBLEMA = "#b91c1c";
const reais = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function Formulario({ acao, atual }: { acao: (f: FormData) => Promise<void>; atual?: number }) {
  return (
    <form action={acao} className="mt-3 flex flex-wrap items-center gap-2">
      <label className="text-xs text-muted" htmlFor="valor-da-meta">Faturamento que a loja quer no mês</label>
      <input
        id="valor-da-meta"
        name="valor"
        required
        inputMode="decimal"
        pattern="[0-9.,]+"
        placeholder="0,00"
        defaultValue={atual ? atual.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : undefined}
        className="numeros w-36 rounded-[8px] border border-border bg-white px-2.5 py-1.5 text-sm text-ink"
      />
      <BotaoDeAcao forte>Salvar a meta</BotaoDeAcao>
    </form>
  );
}

export function MetaDoMes({
  andamento, hoje, porFora = 0, acao,
}: {
  andamento: Andamento | null;
  hoje: string;
  /** Quanto do que já entrou veio de venda registrada por fora da loja. */
  porFora?: number;
  /** Só quem pode definir a meta recebe a ação. */
  acao?: (f: FormData) => Promise<void>;
}) {
  if (!andamento) {
    if (!acao) return null;
    return (
      <section className="glass mt-9 rounded-[18px] p-5" aria-label="Meta do mês">
        <p className="eyebrow flex items-center gap-1.5"><Target size={14} aria-hidden /> Meta de {nomeDoMes(hoje)}</p>
        <p className="mt-2 text-sm text-muted">
          Ainda não há meta para este mês. Com ela, o painel passa a dizer se a loja está no ritmo e quanto precisa
          vender por dia.
        </p>
        <Formulario acao={acao} />
      </section>
    );
  }

  const a = andamento;
  const estado =
    a.situacao === "batida"
      ? { nome: "Meta batida", cor: BOM, Icone: CircleCheck }
      : a.situacao === "no_ritmo"
        ? { nome: "No ritmo", cor: BOM, Icone: CircleCheck }
        : { nome: "Atrás do ritmo", cor: PROBLEMA, Icone: CircleAlert };

  return (
    <section className="glass mt-9 rounded-[18px] p-5" aria-label="Meta do mês">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className="eyebrow flex items-center gap-1.5"><Target size={14} aria-hidden /> Meta de {nomeDoMes(hoje)}</p>
        <p className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider" style={{ color: estado.cor }}>
          <estado.Icone size={14} aria-hidden /> {estado.nome}
        </p>
      </div>

      <p className="font-display numeros mt-2 text-[clamp(1.5rem,2.6vw,2.2rem)] leading-tight text-ink">
        {reais(a.feito)} <span className="text-base text-muted">de {reais(a.meta)}</span>
      </p>

      <div
        className="relative mt-4 h-4 rounded-full bg-border/70"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(a.fracao * 100)}
        aria-valuetext={`${Math.round(a.fracao * 100)}% da meta, no dia ${a.dia} de ${a.diasNoMes}`}
      >
        <div className="h-4 rounded-full" style={{ width: `${Math.max(a.fracao * 100, 1)}%`, background: estado.cor }} />
        {a.situacao !== "batida" ? (
          <div className="absolute -top-1 h-6 w-0.5 bg-ink" style={{ left: `${a.esperado * 100}%` }} aria-hidden />
        ) : null}
      </div>
      <p className="mt-1.5 flex justify-between text-[0.68rem] text-muted">
        <span>{Math.round(a.fracao * 100)}% da meta</span>
        <span>o risco preto marca onde a barra deveria estar hoje, dia {a.dia} de {a.diasNoMes}</span>
      </p>

      <ul className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        <li>
          <span className="block text-xs text-muted">{a.situacao === "batida" ? "Passou da meta em" : "Falta"}</span>
          <span className="numeros font-semibold text-ink">{reais(a.situacao === "batida" ? a.feito - a.meta : a.falta)}</span>
        </li>
        <li>
          <span className="block text-xs text-muted">
            {a.diasQueFaltam > 0 ? `Precisa por dia, nos ${a.diasQueFaltam} dias que faltam` : "Precisa entrar hoje"}
          </span>
          <span className="numeros font-semibold text-ink">
            {reais(a.precisaPorDia)} <span className="font-normal text-muted">(hoje vem {reais(a.ritmo)} por dia)</span>
          </span>
        </li>
        <li>
          <span className="block text-xs text-muted">No ritmo atual, o mês fecha em</span>
          <span className="numeros font-semibold text-ink">{reais(a.projecao)}</span>
        </li>
      </ul>

      <p className="mt-3 text-xs text-muted">
        Conta o faturamento pago da loja virtual mais as vendas registradas por fora dela
        {porFora > 0 ? ` (${reais(porFora)} até agora)` : " (nenhuma registrada neste mês)"}.
      </p>

      {acao ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-semibold text-brand-nav hover:underline">Mudar a meta</summary>
          <Formulario acao={acao} atual={a.meta} />
        </details>
      ) : null}
    </section>
  );
}
