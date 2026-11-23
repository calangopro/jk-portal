import Link from "next/link";
import { COR_DO_TOM } from "@/lib/painel/tons";
import type { TipoDaLinha } from "@/lib/vendas/cascata";
import { COR_DA_CASCATA, ROTULO_DA_LINHA, preenchimentoDaCascata } from "@/lib/vendas/cascata-visual";
import type { SobraDoPeriodo as Dado } from "@/lib/vendas/sobra";

/**
 * Para onde vai cada venda, em média, no período escolhido (cartão 80). Custo e
 * taxa da empresa: só o administrador recebe os dados, e a página nem chama a
 * leitura para os outros.
 *
 * A pergunta que responde: de cada R$ 100 que o cliente paga, quanto sobra
 * depois de taxa, imposto, peça, frete, embalagem e anúncio. Linha sem número
 * sai tracejada e escrita "falta", nunca como zero. Com linha faltando, a sobra
 * vem como "parcial", e nunca verde: ela ainda não desconta o que falta.
 */

const reais = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (f: number) => `${(f * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const TIPOS: TipoDaLinha[] = ["custo", "taxa", "imposto", "frete", "embalagem", "anuncio"];

export function SobraDoPeriodo({ d }: { d: Dado }) {
  if (d.vendas === 0 || d.ticketMedio === null || d.sobraMedia === null || d.fracao === null) {
    return (
      <p className="glass mt-6 rounded-[18px] p-5 text-sm text-muted">
        Sem venda paga neste período para calcular quanto sobra de cada uma.
      </p>
    );
  }
  const completa = d.completas === d.vendas;
  const prejuizo = d.sobraMedia < 0;
  const base = Math.max(d.ticketMedio, 0.01);
  const linhas = TIPOS.map((t) => ({ tipo: t, valor: d.porTipo[t] }));
  const somaDosDescontos = linhas.reduce((s, l) => s + (l.valor ?? 0), 0);
  const escala = Math.max(base, somaDosDescontos);
  const faltam = linhas.filter((l) => l.valor === null).map((l) => ROTULO_DA_LINHA[l.tipo]);

  return (
    <section aria-label="Para onde vai cada venda" className="glass mt-6 rounded-[18px] p-5">
      <p className="eyebrow">Para onde vai cada venda</p>
      <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="numeros text-3xl font-semibold" style={{ color: prejuizo ? COR_DO_TOM.ruim.texto : undefined }}>
          {prejuizo ? "Prejuízo de " : ""}
          {reais(Math.abs(d.sobraMedia))}
          <span className="ml-2 text-base font-medium text-muted">{pct(d.fracao)}</span>
        </p>
        <p className="text-sm text-muted">
          {completa ? "sobra por venda" : "sobra parcial por venda"}, de um ticket médio de {reais(d.ticketMedio)}
        </p>
      </div>
      <p className="mt-1 text-sm text-muted">
        {completa
          ? `De cada R$ 100 que o cliente paga, sobram R$ ${(d.fracao * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}, antes da antecipação, do saque e do estorno.`
          : `De cada R$ 100, sobram R$ ${(d.fracao * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} até aqui. Ainda falta ${faltam.length ? faltam.join(", ").toLowerCase() : "preencher o que as vendas pedem"}, e o que faltar tira mais.`}
      </p>

      <div
        role="img"
        aria-label={`Ticket médio de ${reais(d.ticketMedio)}: ${linhas.filter((l) => l.valor !== null).map((l) => `${ROTULO_DA_LINHA[l.tipo]} ${reais(l.valor as number)}`).join(", ")}; sobra ${reais(d.sobraMedia)}`}
        className="mt-4 flex h-4 w-full overflow-hidden rounded-full bg-ink/[0.07]"
      >
        {linhas.map((l) =>
          l.valor !== null && l.valor > 0 ? (
            <span key={l.tipo} title={`${ROTULO_DA_LINHA[l.tipo]}: ${reais(l.valor)}`} style={{ width: `${(l.valor / escala) * 100}%`, ...preenchimentoDaCascata(COR_DA_CASCATA[l.tipo], l.tipo === "taxa" && d.comTaxaLida === d.vendas ? "real" : l.tipo === "custo" && d.completas === d.vendas ? "real" : "estimado") }} />
          ) : null,
        )}
        {d.sobraMedia > 0 ? <span title={`Sobra: ${reais(d.sobraMedia)}`} style={{ width: `${(d.sobraMedia / escala) * 100}%`, background: COR_DA_CASCATA.sobra }} /> : null}
      </div>

      <ul className="mt-4 grid grid-cols-1 gap-x-8 gap-y-2.5 sm:grid-cols-2">
        {linhas.map((l) => (
          <li key={l.tipo} className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="block h-3 w-3 shrink-0 rounded-[3px]"
              style={preenchimentoDaCascata(COR_DA_CASCATA[l.tipo], l.valor === null ? "falta" : "estimado")}
            />
            <span className="min-w-0 flex-1 text-sm text-ink">{ROTULO_DA_LINHA[l.tipo]}</span>
            <span className="numeros text-sm font-semibold text-ink">
              {l.valor === null ? <span className="font-normal text-muted">falta</span> : `− ${reais(l.valor)}`}
              {l.valor !== null ? <span className="ml-1.5 text-xs font-normal text-muted">{pct(l.valor / d.ticketMedio!)}</span> : null}
            </span>
          </li>
        ))}
        <li className="flex items-center gap-2.5 border-t border-ink/[0.08] pt-2.5 sm:col-span-2">
          <span aria-hidden="true" className="block h-3 w-3 shrink-0 rounded-[3px]" style={{ background: COR_DA_CASCATA.sobra }} />
          <span className="min-w-0 flex-1 text-sm font-semibold text-ink">{completa ? "Sobra por venda" : "Sobra parcial por venda"}</span>
          <span className="numeros text-sm font-semibold text-ink">{reais(d.sobraMedia)}</span>
        </li>
      </ul>

      <p className="mt-4 text-xs leading-relaxed text-muted">
        Média de {d.vendas.toLocaleString("pt-BR")} vendas pagas{d.cortado ? " (o período tem mais; a conta para nas mais recentes)" : ""}. Taxa lida na Appmax em{" "}
        {d.comTaxaLida.toLocaleString("pt-BR")} delas, o resto usa a média da Margem. Custo das peças inteiro em {d.inteiras.custo.toLocaleString("pt-BR")} das vendas: nas outras a conta soma só as peças que têm custo, então o custo real é maior. O anúncio é o gasto do período dividido pelas vendas, não o anúncio de cada pedido. Hachurado é estimativa, tracejado é o que falta.
      </p>
      {d.semParametros.length > 0 ? (
        <p className="mt-3 rounded-[10px] px-3 py-2 text-xs leading-snug" style={{ background: COR_DO_TOM.atencao.fundo, color: COR_DO_TOM.atencao.texto }}>
          Para a conta fechar, falta preencher na Margem: {d.semParametros.join(", ")}.{" "}
          <Link href="/admin/margem" className="font-semibold underline">
            Abrir a Margem
          </Link>
        </p>
      ) : null}
    </section>
  );
}
