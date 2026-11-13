import Link from "next/link";
import { ArrowRight, CircleAlert, Scale, TriangleAlert } from "lucide-react";
import type { ContaDoMes } from "@/lib/custos/conta";
import { nomeDoMes } from "@/lib/vendas/periodo";

/**
 * Resultado do mês na Visão geral: o que entrou, o que saiu e o que sobra.
 *
 * É um extrato com barra, e não um gráfico de pizza, porque a pergunta é de
 * subtração: do que foi vendido, quanto cada grupo de custo levou. Todas as
 * barras dividem a mesma escala (a maior entre o vendido e o custo), então dá
 * para comparar no olho.
 *
 * A sobra é ANTES do custo das peças, e o bloco repete isso no título da linha
 * e no rodapé: sem esse custo, o número não é lucro. Só administrador vê,
 * porque custo é da empresa.
 *
 * O ESTADO NUNCA É VERDE. Sobrar dinheiro antes do custo das peças não diz se
 * o mês deu lucro, e um selo verde seria lido como "está tudo bem". Enquanto o
 * custo das peças não entra, sobra positiva sai em âmbar, como conta
 * incompleta. Faltar para cobrir os custos já é problema sem precisar de mais
 * nada, e sai em vermelho.
 *
 * CORES. O par validado do painel: dourado para o que entrou, azul para o que
 * saiu. Âmbar e vermelho só no estado, com ícone e palavra.
 */

const ENTROU = "#b8841f";
const SAIU = "#1f86b0";
const ATENCAO = "#b45309";
const PROBLEMA = "#b91c1c";
const reais = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export type Resultado = {
  hoje: string;
  diasNoMes: number;
  loja: number;
  porFora: number;
  pedidosPagos: number;
  conta: ContaDoMes;
  /** Quantos custos da lista são estimativa, de quantos. */
  estimativas: number;
  itens: number;
};

function Linha({ nome, detalhe, valor, base, cor }: { nome: string; detalhe: string; valor: number; base: number; cor: string }) {
  return (
    <li className="grid gap-x-4 gap-y-1 py-2.5 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_auto] sm:items-center">
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink">{nome}</span>
        <span className="block text-xs text-muted">{detalhe}</span>
      </span>
      <span className="block h-2.5 rounded-full bg-border/60" aria-hidden>
        <span className="block h-2.5 rounded-full" style={{ width: `${Math.max((valor / base) * 100, valor > 0 ? 1 : 0)}%`, background: cor }} />
      </span>
      <span className="numeros text-sm text-ink sm:min-w-[7.5rem] sm:text-right">{reais(valor)}</span>
    </li>
  );
}

export function ResultadoDoMes({ r }: { r: Resultado }) {
  const dia = Number(r.hoje.slice(8, 10));
  const vendido = r.loja + r.porFora;
  const c = r.conta;
  const sobra = vendido - c.total;
  const base = Math.max(vendido, c.total, 1);
  const positivo = sobra >= 0;
  const fatia = vendido > 0 ? Math.round((Math.abs(sobra) / vendido) * 100) : null;
  const estado = positivo
    ? { nome: "Conta incompleta: falta o custo das peças", cor: ATENCAO, Icone: TriangleAlert }
    : { nome: "Não cobre os custos", cor: PROBLEMA, Icone: CircleAlert };

  return (
    <section className="glass mt-6 rounded-[18px] p-5" aria-label="Resultado do mês">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className="eyebrow flex items-center gap-1.5"><Scale size={14} aria-hidden /> Resultado de {nomeDoMes(r.hoje)}, até hoje</p>
        <p className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider" style={{ color: estado.cor }}>
          <estado.Icone size={14} aria-hidden /> {estado.nome}
        </p>
      </div>

      <p className="mt-3 text-[0.68rem] font-semibold uppercase tracking-wider text-muted">Entrou</p>
      <ul>
        <Linha nome="Vendido" detalhe={`${reais(r.loja)} pagos na loja e ${reais(r.porFora)} registrados por fora`} valor={vendido} base={base} cor={ENTROU} />
      </ul>

      <p className="mt-2 text-[0.68rem] font-semibold uppercase tracking-wider text-muted">Saiu</p>
      <ul className="divide-y divide-border/50">
        <Linha nome="Custos do mês" detalhe={`${dia} de ${r.diasNoMes} dias de pessoas, plataformas, estrutura, impostos e taxas`} valor={c.fixoAteHoje} base={base} cor={SAIU} />
        <Linha
          nome="Anúncio"
          detalhe={
            c.diasComGastoReal > 0
              ? `gasto lançado em Tráfego em ${c.diasComGastoReal} ${c.diasComGastoReal === 1 ? "dia" : "dias"}${c.diasSoNaEstimativa > 0 ? `, mais a estimativa de ${c.diasSoNaEstimativa} ${c.diasSoNaEstimativa === 1 ? "dia" : "dias"}` : ""}`
              : "estimativa da lista de custos, sem gasto lançado em Tráfego"
          }
          valor={c.anuncioAteHoje}
          base={base}
          cor={SAIU}
        />
        <Linha nome="Embalagem e garantia" detalhe={`${r.pedidosPagos} ${r.pedidosPagos === 1 ? "pedido pago" : "pedidos pagos"} na loja`} valor={c.porPedidoAteHoje} base={base} cor={SAIU} />
      </ul>

      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-t border-border pt-3">
        <p className="text-sm font-semibold text-ink">{positivo ? "Sobra antes do custo das peças" : "Falta para cobrir os custos, antes do custo das peças"}</p>
        <p className="font-display numeros text-[clamp(1.4rem,2.2vw,1.9rem)] leading-tight" style={{ color: positivo ? "var(--color-ink)" : PROBLEMA }}>
          {reais(Math.abs(sobra))}
          {fatia !== null ? <span className="ml-2 font-sans text-xs font-normal text-muted">{fatia}% do vendido</span> : null}
        </p>
      </div>

      <p className="mt-3 max-w-3xl text-xs leading-relaxed text-muted">
        Isto ainda não é lucro: falta tirar o custo das peças vendidas, que depende da planilha de custos em Margem. Venda
        por fora só entra se foi registrada. {r.estimativas} de {r.itens} custos da lista são estimativa.{" "}
        <Link href="/admin/custos" className="inline-flex items-center gap-1 font-semibold text-brand-nav hover:underline">
          Ver os custos <ArrowRight size={12} aria-hidden />
        </Link>
      </p>
    </section>
  );
}
