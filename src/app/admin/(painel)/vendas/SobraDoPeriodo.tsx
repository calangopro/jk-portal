import Link from "next/link";
import { COR_DO_TOM } from "@/lib/painel/tons";
import type { CpaIdeal } from "@/lib/custos/medias";
import type { TipoDaLinha } from "@/lib/vendas/cascata";
import { COR_DA_CASCATA, ROTULO_DA_LINHA, preenchimentoDaCascata } from "@/lib/vendas/cascata-visual";
import type { SobraDoPeriodo as Dado } from "@/lib/vendas/sobra";

/**
 * Para onde vai cada venda, em média, no período escolhido, e o CPA ideal que
 * sai disso (cartões 80 e 81). Custo e taxa da empresa: só o administrador
 * recebe os dados, e a página nem chama a leitura para os outros.
 *
 * O exato onde existe (a taxa lida na Appmax), a média onde não existe (a lista
 * de Custos dividida pelo que se vendeu). Cada linha diz de onde veio. Linha sem
 * número sai tracejada e escrita "falta", nunca como zero. Com linha faltando, a
 * sobra e o CPA vêm como "parciais", e nunca verdes: ainda não descontam o que falta.
 */

const reais = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (f: number) => `${(f * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const TIPOS: TipoDaLinha[] = ["custo", "taxa", "imposto", "frete", "embalagem", "anuncio"];

/** De onde veio a média de cada linha, em uma frase, com os números da lista de Custos. */
function deOnde(t: TipoDaLinha, d: Dado): string | null {
  const m = d.medias;
  switch (t) {
    case "taxa":
      return m.taxa ? `Lida na Appmax em ${d.comTaxaLida.toLocaleString("pt-BR")} de ${d.vendas.toLocaleString("pt-BR")} vendas; nas outras, a média lida (${pct(m.taxa.fracao)} do vendido).` : null;
    case "custo":
      return `Custo inteiro em ${d.exatas.custo.toLocaleString("pt-BR")} de ${d.vendas.toLocaleString("pt-BR")} vendas.${m.pecas?.confiavel ? ` Nas outras, a média das que têm: ${pct(m.pecas.fracaoDaReceita)} do preço.` : " Nas outras, só as peças com custo entram, então o real é maior."}`;
    case "imposto":
      return m.imposto ? `${pct(m.imposto.fracao)} do faturamento: ${reais(m.imposto.valorNoPeriodo)} de imposto no período, da lista de Custos.` : null;
    case "frete":
      return m.frete
        ? `Frete do mês na lista de Custos: ${reais(m.frete.custoNoPeriodo)}. Os clientes pagaram ${reais(m.frete.cobradoNoPeriodo)}${m.frete.porVendaGratis !== null ? `; o frete grátis custa ${reais(m.frete.porVendaGratis)} por pedido` : ""}.`
        : null;
    case "embalagem":
      return m.embalagem ? `${reais(m.embalagem.porPedido)} por pedido na lista de Custos${m.embalagem.mensalRateada > 0 ? ` mais ${reais(m.embalagem.mensalRateada)} da parte mensal dividida pelas vendas` : ""}.` : null;
    case "anuncio":
      return m.anuncio ? `${reais(m.anuncio.gasto)} de anúncio lançados no período, divididos pelas ${d.vendas.toLocaleString("pt-BR")} vendas.` : null;
  }
}

export function SobraDoPeriodo({ d }: { d: Dado }) {
  if (d.vendas === 0 || d.ticketMedio === null || d.sobraMedia === null || d.fracao === null) {
    return (
      <p className="glass mt-6 rounded-[18px] p-5 text-sm text-muted">
        Sem venda paga neste período para calcular quanto sobra de cada uma.
      </p>
    );
  }
  const completa = d.completas === d.vendas && d.faltaEm.custo === 0;
  const prejuizo = d.sobraMedia < 0;
  const linhas = TIPOS.map((t) => ({ tipo: t, valor: d.faltaEm[t] > d.vendas / 2 ? null : d.porTipo[t] }));
  const somaDosDescontos = linhas.reduce((s, l) => s + (l.valor ?? 0), 0);
  const escala = Math.max(d.ticketMedio, somaDosDescontos, 0.01);
  // "Falta" é a linha sem número em alguma venda, não só em todas: o custo das peças pode ter valor em duas vendas e faltar em 215.
  const faltam = linhas.filter((l) => d.faltaEm[l.tipo] > 0).map((l) => `${ROTULO_DA_LINHA[l.tipo].toLowerCase()} (em ${d.faltaEm[l.tipo].toLocaleString("pt-BR")} de ${d.vendas.toLocaleString("pt-BR")} vendas)`);
  const exato = (t: TipoDaLinha) => d.exatas[t] === d.vendas;
  // Linha em falta em mais da metade das vendas não ganha número: o valor médio só vale para as poucas que têm.
  const semCobertura = (t: TipoDaLinha) => d.faltaEm[t] > d.vendas / 2;

  return (
    <>
      <section aria-label="Para onde vai cada venda" className="glass mt-6 rounded-[18px] p-5">
        <p className="eyebrow">Para onde vai cada venda, em média</p>
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
            ? `De cada R$ 100 que o cliente paga, sobram R$ ${(d.fracao * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}, antes do custo fixo, da antecipação, do saque e do estorno.`
            : `De cada R$ 100, sobram R$ ${(d.fracao * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} até aqui. Ainda falta ${faltam.length ? faltam.join(", ") : "preencher o que as vendas pedem"}, e o que faltar tira mais.`}
        </p>

        <div
          role="img"
          aria-label={`Ticket médio de ${reais(d.ticketMedio)}: ${linhas.filter((l) => l.valor !== null).map((l) => `${ROTULO_DA_LINHA[l.tipo]} ${reais(l.valor as number)}`).join(", ")}; sobra ${reais(d.sobraMedia)}`}
          className="mt-4 flex h-4 w-full overflow-hidden rounded-full bg-ink/[0.07]"
        >
          {linhas.map((l) =>
            l.valor !== null && l.valor > 0 ? (
              <span key={l.tipo} title={`${ROTULO_DA_LINHA[l.tipo]}: ${reais(l.valor)}`} style={{ width: `${(l.valor / escala) * 100}%`, ...preenchimentoDaCascata(COR_DA_CASCATA[l.tipo], exato(l.tipo) ? "real" : "media") }} />
            ) : null,
          )}
          {d.sobraMedia > 0 ? <span title={`Sobra: ${reais(d.sobraMedia)}`} style={{ width: `${(d.sobraMedia / escala) * 100}%`, background: COR_DA_CASCATA.sobra }} /> : null}
        </div>

        <ul className="mt-4 space-y-3">
          {linhas.map((l) => {
            const origem = deOnde(l.tipo, d);
            return (
              <li key={l.tipo} className="flex items-start gap-2.5">
                <span aria-hidden="true" className="mt-0.5 block h-3 w-3 shrink-0 rounded-[3px]" style={preenchimentoDaCascata(COR_DA_CASCATA[l.tipo], l.valor === null ? "falta" : exato(l.tipo) ? "real" : "media")} />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="text-sm text-ink">{ROTULO_DA_LINHA[l.tipo]}</span>
                    <span className="numeros text-sm font-semibold text-ink">
                      {l.valor === null ? <span className="font-normal text-muted">falta</span> : `− ${reais(l.valor)}`}
                      {l.valor !== null ? <span className="ml-1.5 text-xs font-normal text-muted">{pct(l.valor / d.ticketMedio!)}</span> : null}
                    </span>
                  </p>
                  {origem ? <p className="text-[0.68rem] leading-snug text-muted [overflow-wrap:anywhere]">{origem}</p> : l.valor === null ? <p className="text-[0.68rem] leading-snug text-muted">Sem número na lista de Custos nem na Margem.</p> : null}
                  {semCobertura(l.tipo) ? <p className="text-[0.68rem] leading-snug text-muted">Em falta na maioria das vendas, por isso não entra na barra. Cada venda sem este custo deixa a sobra maior do que é.</p> : null}
                </div>
              </li>
            );
          })}
          <li className="flex items-center gap-2.5 border-t border-ink/[0.08] pt-3">
            <span aria-hidden="true" className="block h-3 w-3 shrink-0 rounded-[3px]" style={{ background: COR_DA_CASCATA.sobra }} />
            <span className="min-w-0 flex-1 text-sm font-semibold text-ink">{completa ? "Sobra por venda" : "Sobra parcial por venda"}</span>
            <span className="numeros text-sm font-semibold text-ink">{reais(d.sobraMedia)}</span>
          </li>
          {d.medias.fixo ? (
            <li className="flex items-start gap-2.5 text-xs text-muted">
              <span aria-hidden="true" className="mt-0.5 block h-3 w-3 shrink-0" />
              <span>
                Custo fixo (pessoas, estrutura, plataformas, serviços): {reais(d.medias.fixo.porVenda)} por venda, {reais(d.medias.fixo.noPeriodo)} no período. Não entra na sobra acima, porque não muda com cada venda.
              </span>
            </li>
          ) : null}
        </ul>

        <p className="mt-4 text-xs leading-relaxed text-muted">
          Média de {d.vendas.toLocaleString("pt-BR")} vendas pagas{d.cortado ? " (o período tem mais; a conta para nas mais recentes)" : ""}. Onde existe o valor exato da venda (a taxa lida na Appmax, o frete que o cliente pagou, o custo da peça), ele entra; onde não existe, entra a média do período. Hachurado é média ou estimativa, tracejado é o que falta.
        </p>
        {d.semParametros.length > 0 ? (
          <p className="mt-3 rounded-[10px] px-3 py-2 text-xs leading-snug" style={{ background: COR_DO_TOM.atencao.fundo, color: COR_DO_TOM.atencao.texto }}>
            Ainda vazio na Margem (a média da lista de Custos cobre o que ela tem): {d.semParametros.join(", ")}.{" "}
            <Link href="/admin/margem" className="font-semibold underline">
              Abrir a Margem
            </Link>
          </p>
        ) : null}
      </section>

      {d.cpa ? <CpaIdealDoPeriodo cpa={d.cpa} /> : null}
    </>
  );
}

const TOM_DA_SITUACAO = {
  dentro: { tom: "bom" as const, texto: "O anúncio está dentro do que a venda aguenta." },
  acima_do_ideal: { tom: "atencao" as const, texto: "O anúncio já passa do CPA ideal: ainda não dá prejuízo na contribuição, mas o custo fixo não fecha." },
  acima_do_empate: { tom: "ruim" as const, texto: "O anúncio custa mais por venda do que a venda deixa antes do anúncio." },
  sem_gasto: { tom: "atencao" as const, texto: "Sem gasto de anúncio lançado no período para comparar." },
};

/** O CPA ideal do período contra o real, numa régua: o que cada venda deixa antes do anúncio e quanto o anúncio custa. */
export function CpaIdealDoPeriodo({ cpa }: { cpa: CpaIdeal }) {
  const ideal = cpa.cpaDeLucro ?? cpa.cpaComMargem ?? cpa.cpaDeEmpate;
  const nomeDoIdeal = cpa.cpaDeLucro !== null ? "CPA de lucro" : cpa.cpaComMargem !== null ? "CPA com a margem mínima" : "CPA de empate";
  // Verde só quando a conta está inteira: com custo faltando, o ideal está otimista.
  const s = TOM_DA_SITUACAO[cpa.situacao];
  const tom = cpa.parcial && s.tom === "bom" ? ("atencao" as const) : s.tom;
  const texto = cpa.parcial && cpa.situacao === "dentro" ? "O anúncio está dentro do ideal parcial, mas esse ideal ainda não desconta tudo." : s.texto;
  const maximo = Math.max(cpa.contribuicao, cpa.cpaReal ?? 0, ideal, 1);
  const x = (v: number) => `${Math.max(0, Math.min(100, (v / maximo) * 100))}%`;

  return (
    <section aria-label="CPA ideal" className="glass mt-6 rounded-[18px] p-5">
      <p className="eyebrow">CPA ideal</p>
      <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="numeros text-3xl font-semibold" style={{ color: ideal < 0 ? COR_DO_TOM.ruim.texto : undefined }}>
          {ideal < 0 ? "Sem folga: " : ""}
          {reais(ideal)}
          <span className="ml-2 text-base font-medium text-muted">por venda</span>
        </p>
        <p className="text-sm text-muted">{cpa.parcial ? `${nomeDoIdeal} parcial` : nomeDoIdeal}</p>
      </div>
      <p className="mt-1 text-sm text-muted">
        É o máximo que dá para gastar de anúncio para trazer uma venda e ainda ter {cpa.cpaDeLucro !== null ? "lucro depois do custo fixo" : cpa.cpaComMargem !== null ? "a margem mínima" : "a contribuição zerada"}. Sai do ticket médio de {reais(cpa.ticket)} menos o que muda com cada venda.
      </p>

      {/* A régua: da contribuição inteira até zero, com o ideal e o real marcados. */}
      <div className="relative mt-5 h-3 rounded-full bg-ink/[0.07]" role="img" aria-label={`Régua do CPA: ideal ${reais(ideal)}, empate ${reais(cpa.cpaDeEmpate)}${cpa.cpaReal !== null ? `, real ${reais(cpa.cpaReal)}` : ""}`}>
        <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: x(Math.max(ideal, 0)), background: "#1b1b1b" }} />
        <span className="absolute inset-y-0 rounded-r-full" style={{ left: x(Math.max(ideal, 0)), width: `calc(${x(Math.max(cpa.cpaDeEmpate, 0))} - ${x(Math.max(ideal, 0))})`, ...preenchimentoDaCascata("#1b1b1b", "media") }} />
        {cpa.cpaReal !== null ? (
          <span className="absolute -top-1.5 h-6 w-1 rounded-full" style={{ left: `calc(${x(cpa.cpaReal)} - 2px)`, background: COR_DO_TOM[tom].texto }} aria-hidden="true" title={`CPA real: ${reais(cpa.cpaReal)}`} />
        ) : null}
      </div>
      <div className="mt-1 flex justify-between text-[0.68rem] text-muted">
        <span>R$ 0</span>
        <span>empate {reais(cpa.cpaDeEmpate)}</span>
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-2.5 sm:grid-cols-2">
        <Linha rotulo="CPA de empate" valor={cpa.cpaDeEmpate} apoio={cpa.roasDeEmpate ? `ROAS ${cpa.roasDeEmpate.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}` : null} dica="o que a venda deixa antes do anúncio e do custo fixo" />
        {cpa.cpaComMargem !== null ? <Linha rotulo="Com a margem mínima" valor={cpa.cpaComMargem} apoio={null} dica="o de empate menos a margem mínima sobre o ticket" /> : null}
        {cpa.cpaDeLucro !== null ? <Linha rotulo="Lucro depois do fixo" valor={cpa.cpaDeLucro} apoio={cpa.roasDeLucro ? `ROAS ${cpa.roasDeLucro.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}` : null} dica="o de empate menos o custo fixo rateado por venda" /> : null}
        <Linha rotulo="CPA real do período" valor={cpa.cpaReal} apoio={cpa.roasReal ? `ROAS ${cpa.roasReal.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}` : null} dica="o gasto de anúncio lançado dividido pelas vendas" />
      </dl>

      <p className="mt-4 rounded-[10px] px-3 py-2 text-xs leading-snug" style={{ background: COR_DO_TOM[tom].fundo, color: COR_DO_TOM[tom].texto }}>
        {texto}
        {cpa.parcial ? ` Ainda falta ${cpa.faltam.join(", ")}: o ideal está otimista até esses custos entrarem.` : ""}
      </p>
      <p className="mt-3 text-xs leading-relaxed text-muted">
        O custo fixo não entra no CPA de empate porque não muda com a venda. Entra só no CPA de lucro. Os dois usam as médias acima, não o custo de um pedido específico.
      </p>
    </section>
  );
}

function Linha({ rotulo, valor, apoio, dica }: { rotulo: string; valor: number | null; apoio: string | null; dica: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <dt className="text-sm text-ink">{rotulo}</dt>
        <dd className="numeros text-sm font-semibold text-ink">
          {valor === null ? <span className="font-normal text-muted">sem número</span> : reais(valor)}
          {apoio ? <span className="ml-1.5 text-xs font-normal text-muted">{apoio}</span> : null}
        </dd>
      </div>
      <p className="text-[0.68rem] leading-snug text-muted">{dica}</p>
    </div>
  );
}
