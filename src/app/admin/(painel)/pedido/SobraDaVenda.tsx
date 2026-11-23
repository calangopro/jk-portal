"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { COR_DO_TOM } from "@/lib/painel/tons";
import type { LinhaDaCascata, OrigemDoNumero } from "@/lib/vendas/cascata";
import { COR_DA_CASCATA, preenchimentoDaCascata } from "@/lib/vendas/cascata-visual";
import type { SobraDoPedido } from "@/lib/vendas/sobra";
import { fecharHistoricoDoPedido } from "./abrir";
import { sobraDoPedido } from "./sobra-actions";

/**
 * Quanto sobrou de UMA venda, na gaveta do pedido (cartão 80). Só o administrador
 * recebe os dados: para os outros o bloco não aparece, sem erro.
 *
 * A COR NÃO É O ÚNICO SINAL. Cada parte do valor tem a cor e a legenda com o
 * número escrito; o que é estimativa vem hachurado, o que falta vem tracejado, e
 * cada linha diz "lido", "estimado" ou "falta". Nenhuma cor é verde ou vermelha
 * por si: verde e vermelho ficam para bom e ruim (`COR_DO_TOM`).
 */

const reais = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (f: number) => `${(f * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

const ROTULO_DA_ORIGEM: Record<OrigemDoNumero, string> = { real: "lido", estimado: "estimado", falta: "falta" };
/** O custo não é lido de lugar nenhum: sai da conta da Margem. */
const rotuloDaOrigem = (l: LinhaDaCascata) => (l.tipo === "custo" && l.origem === "real" ? "da Margem" : ROTULO_DA_ORIGEM[l.origem]);
const COR = COR_DA_CASCATA;
const preenchimento = preenchimentoDaCascata;

function Amostra({ cor, origem }: { cor: string; origem: OrigemDoNumero }) {
  return <span aria-hidden="true" className="mt-0.5 block h-3 w-3 shrink-0 rounded-[3px]" style={preenchimento(cor, origem)} />;
}

export function SobraDaVenda({ numero }: { numero: number }) {
  const [dado, setDado] = useState<SobraDoPedido | { tipo: "sem_acesso" } | { tipo: "erro" } | "carregando">("carregando");

  useEffect(() => {
    let vivo = true;
    sobraDoPedido(numero)
      .then((r) => vivo && setDado(r))
      .catch(() => vivo && setDado({ tipo: "erro" }));
    return () => {
      vivo = false;
    };
  }, [numero]);

  if (dado === "carregando") {
    return (
      <p className="mt-3 flex items-center gap-2 text-xs text-muted" role="status">
        <Loader2 size={13} className="animate-spin" aria-hidden="true" /> Calculando quanto sobrou da venda
      </p>
    );
  }
  if (dado.tipo !== "ok") return null;
  return <QuantoSobrou dado={dado} />;
}

/** O desenho, separado da leitura: é o que as telas de exemplo e o teste de tela usam. */
export function QuantoSobrou({ dado }: { dado: Extract<SobraDoPedido, { tipo: "ok" }> }) {
  const { cascata: c } = dado;
  const prejuizo = c.sobra < 0;
  const partes = c.linhas.filter((l): l is LinhaDaCascata & { valor: number } => l.valor !== null && l.valor > 0);
  const base = Math.max(c.total, c.descontos, 0.01);

  return (
    <section aria-label="Quanto sobrou desta venda" className="glass mt-3 rounded-[16px] p-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <p className="text-xs font-semibold text-muted">{c.completa ? "Quanto sobrou desta venda" : "Sobra parcial desta venda"}</p>
        <p className="text-[0.68rem] text-muted">de {reais(c.total)} que o cliente pagou</p>
      </div>
      <p
        className="numeros mt-1 text-2xl font-semibold"
        style={{ color: prejuizo ? COR_DO_TOM.ruim.texto : "var(--color-ink, #1b1b1b)" }}
      >
        {prejuizo ? "Prejuízo de " : ""}
        {reais(Math.abs(c.sobra))}
        {c.fracao !== null ? <span className="ml-2 text-sm font-medium text-muted">{pct(c.fracao)}</span> : null}
      </p>
      <p className="mt-0.5 text-xs leading-snug text-muted">
        {c.completa
          ? "Com todas as linhas abaixo preenchidas. Antecipação, saque e estorno não entram: a Appmax não entrega esses por pedido."
          : `Sobra parcial: ainda falta ${c.faltam.join(", ").toLowerCase()}, e o que faltar tiraria mais.`}
      </p>

      {/* Para onde foi cada real. */}
      <div
        role="img"
        aria-label={`Do total de ${reais(c.total)}: ${partes.map((p) => `${p.rotulo} ${reais(p.valor)}`).join(", ")}; sobra ${reais(c.sobra)}`}
        className="mt-3 flex h-3.5 w-full overflow-hidden rounded-full bg-ink/[0.07]"
      >
        {partes.map((p) => (
          <span key={p.tipo} title={`${p.rotulo}: ${reais(p.valor)}`} style={{ width: `${(p.valor / base) * 100}%`, ...preenchimento(COR[p.tipo], p.origem), borderRadius: 0 }} />
        ))}
        {c.sobra > 0 ? <span title={`Sobra: ${reais(c.sobra)}`} style={{ width: `${(c.sobra / base) * 100}%`, background: COR.sobra }} /> : null}
      </div>

      <ul className="mt-3 space-y-2.5">
        {c.linhas.map((l) => (
          <li key={l.tipo} className="flex items-start gap-2">
            <Amostra cor={COR[l.tipo]} origem={l.origem} />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-baseline justify-between gap-x-2">
                <span className="text-sm font-medium text-ink">
                  {l.rotulo} <span className="ml-1 rounded-full bg-ink/[0.07] px-1.5 py-0.5 text-[0.62rem] font-semibold uppercase tracking-wide text-muted">{rotuloDaOrigem(l)}</span>
                </span>
                <span className="numeros text-sm font-semibold text-ink">
                  {l.valor === null ? <span className="text-muted">sem número</span> : `− ${reais(l.valor)}`}
                  {l.valor !== null && c.total > 0 ? <span className="ml-1.5 text-xs font-normal text-muted">{pct(l.valor / c.total)}</span> : null}
                </span>
              </p>
              <p className="text-[0.68rem] leading-snug text-muted [overflow-wrap:anywhere]">{l.detalhe}</p>
            </div>
          </li>
        ))}
        <li className="flex items-start gap-2 border-t border-ink/[0.08] pt-2.5">
          <span aria-hidden="true" className="mt-0.5 block h-3 w-3 shrink-0 rounded-[3px]" style={{ background: COR.sobra }} />
          <p className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-2">
            <span className="text-sm font-semibold text-ink">{c.completa ? "Sobrou" : "Sobrou até aqui"}</span>
            <span className="numeros text-sm font-semibold text-ink">{reais(c.sobra)}</span>
          </p>
        </li>
      </ul>

      {dado.semParametros.length > 0 ? (
        <p className="mt-3 rounded-[10px] px-2.5 py-2 text-xs leading-snug" style={{ background: COR_DO_TOM.atencao.fundo, color: COR_DO_TOM.atencao.texto }}>
          Para a conta fechar, falta preencher na Margem: {dado.semParametros.join(", ")}.{" "}
          <Link href="/admin/margem" onClick={fecharHistoricoDoPedido} className="font-semibold underline">
            Abrir a Margem
          </Link>
        </p>
      ) : null}
    </section>
  );
}
