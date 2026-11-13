import Link from "next/link";
import { ArrowDownRight, ArrowRight, ArrowUpRight, CircleAlert, CircleCheck, Lightbulb, Minus, TriangleAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ResumoDeVendas } from "@/lib/vendas/dados";
import { agruparPorCanal } from "@/lib/vendas/origem";
import { diaCurto, diasEntre } from "@/lib/vendas/periodo";
import { porDiaDaSemana, taxaDeCancelamento, variacao, type Gravidade, type Sinal } from "@/lib/painel/sinais";

/**
 * Painel visual da Visão geral: os números do período contra o período
 * anterior, o que está errado, onde dá para crescer e os gráficos.
 *
 * Só desenha. A leitura e as regras ficam fora (`page.tsx` e
 * `lib/painel/sinais.ts`), para o desenho poder ser visto sem sessão durante o
 * desenvolvimento.
 *
 * CORES. O dourado da marca é apagado demais para gráfico (não passou no
 * validador de paleta: lê como cinza ao lado de outra série). O par abaixo foi
 * validado para daltonismo e contraste: dourado para o período atual, azul para
 * o anterior. Verde, âmbar e vermelho ficam RESERVADOS para estado (bom,
 * atenção, problema) e sempre vêm com ícone e palavra, nunca só a cor.
 */

const ATUAL = "#b8841f";
const ANTERIOR = "#1f86b0";
const BOM = "#047857";
const ATENCAO = "#b45309";
const PROBLEMA = "#b91c1c";

const reais = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const reaisCurto = (n: number) =>
  n >= 1000 ? `R$ ${(n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : `R$ ${Math.round(n)}`;
const inteiro = (n: number) => n.toLocaleString("pt-BR");

/** Selo de variação. `bomSeSobe` falso inverte a cor (cancelamento subir é ruim). */
function Variacao({ d, bomSeSobe = true, sufixo = "%" }: { d: number | null; bomSeSobe?: boolean; sufixo?: string }) {
  if (d === null) return <span className="text-xs text-muted">sem comparação</span>;
  const valor = sufixo === "%" ? Math.round(d * 100) : Math.round(d * 10) / 10;
  if (valor === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted">
        <Minus size={12} aria-hidden /> igual
      </span>
    );
  }
  const subiu = valor > 0;
  const bom = subiu === bomSeSobe;
  const Icone = subiu ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-semibold" style={{ color: bom ? BOM : PROBLEMA }}>
      <Icone size={13} aria-hidden />
      {subiu ? "subiu" : "caiu"} {Math.abs(valor).toLocaleString("pt-BR")}
      {sufixo}
    </span>
  );
}

function Linhazinha({ valores }: { valores: number[] }) {
  const max = Math.max(...valores, 1);
  const pontos = valores
    .map((v, i) => `${(i / Math.max(valores.length - 1, 1)) * 100},${26 - (v / max) * 24}`)
    .join(" ");
  return (
    <svg viewBox="0 0 100 28" preserveAspectRatio="none" className="mt-3 h-7 w-full" aria-hidden>
      <polyline points={pontos} fill="none" stroke={ATUAL} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

function Numero({
  rotulo, valor, children, serie,
}: {
  rotulo: string;
  valor: string;
  children: React.ReactNode;
  serie?: number[];
}) {
  return (
    <div className="glass min-w-0 rounded-[18px] p-5">
      <p className="eyebrow truncate text-[0.62rem]">{rotulo}</p>
      <p className="font-display numeros mt-2 text-[clamp(1.5rem,2.4vw,2.1rem)] leading-tight text-ink">{valor}</p>
      <p className="mt-1">{children}</p>
      {serie ? <Linhazinha valores={serie} /> : null}
    </div>
  );
}

const SELO: Record<Gravidade, { nome: string; cor: string; Icone: LucideIcon }> = {
  problema: { nome: "Problema", cor: PROBLEMA, Icone: CircleAlert },
  atencao: { nome: "Atenção", cor: ATENCAO, Icone: TriangleAlert },
  oportunidade: { nome: "Oportunidade", cor: ANTERIOR, Icone: Lightbulb },
  bom: { nome: "Indo bem", cor: BOM, Icone: CircleCheck },
};

function CartaoDeSinal({ s }: { s: Sinal }) {
  const selo = SELO[s.gravidade];
  return (
    <li className="glass rounded-[14px] border-l-4 p-4" style={{ borderLeftColor: selo.cor }}>
      <p className="flex items-center gap-1.5 text-[0.68rem] font-bold uppercase tracking-wider" style={{ color: selo.cor }}>
        <selo.Icone size={14} aria-hidden /> {selo.nome}
      </p>
      <p className="mt-1.5 text-sm font-semibold text-ink">{s.titulo}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted">{s.texto}</p>
      {s.link ? (
        <Link href={s.link.href} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-nav hover:underline">
          {s.link.rotulo} <ArrowRight size={12} aria-hidden />
        </Link>
      ) : null}
    </li>
  );
}

/** Barras do período atual com a linha do período anterior por cima, na mesma escala. */
function Comparacao({ atual, anterior, dias }: { atual: { dia: string; valor: number }[]; anterior: number[]; dias: number }) {
  const L = 900, A = 240, esq = 72, dir = 8, topo = 14, base = 26;
  const max = Math.max(...atual.map((d) => d.valor), ...anterior, 1);
  const larg = (L - esq - dir) / atual.length;
  const y = (v: number) => topo + (1 - v / max) * (A - topo - base);
  const linha = anterior.map((v, i) => `${esq + i * larg + larg / 2},${y(v)}`).join(" ");
  const passo = Math.ceil(atual.length / 8);

  return (
    <svg viewBox={`0 0 ${L} ${A}`} className="mt-4 h-auto w-full" role="img" aria-label={`Faturamento pago por dia nos últimos ${dias} dias, comparado com os ${dias} dias anteriores`}>
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={esq} x2={L - dir} y1={y(max * f)} y2={y(max * f)} stroke="var(--color-border)" strokeDasharray={f === 0 ? undefined : "3 4"} />
          <text x={esq - 8} y={y(max * f) + 4} textAnchor="end" fontSize="11" fill="var(--color-muted)">{reaisCurto(max * f)}</text>
        </g>
      ))}
      {atual.map((d, i) => {
        const h = A - base - y(d.valor);
        return (
          <g key={d.dia}>
            {d.valor > 0 ? <rect x={esq + i * larg + 1} y={y(d.valor)} width={Math.max(larg - 2, 2)} height={h} rx="2.5" fill={ATUAL} /> : null}
            {i % passo === 0 ? (
              <text x={esq + i * larg + larg / 2} y={A - 8} textAnchor="middle" fontSize="11" fill="var(--color-muted)">{diaCurto(d.dia)}</text>
            ) : null}
          </g>
        );
      })}
      <polyline points={linha} fill="none" stroke={ANTERIOR} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {atual.map((d, i) => (
        // Área de toque da coluna inteira, por cima de tudo: a dica aparece mesmo em dia de barra baixa.
        <rect key={d.dia} x={esq + i * larg} y={topo} width={larg} height={A - topo - base} fill="transparent">
          <title>{`${diaCurto(d.dia)}: ${reais(d.valor)}. No período anterior: ${reais(anterior[i] ?? 0)}.`}</title>
        </rect>
      ))}
    </svg>
  );
}

function Legenda() {
  return (
    <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
      <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: ATUAL }} aria-hidden /> Período atual (barras)</span>
      <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 rounded-full" style={{ background: ANTERIOR }} aria-hidden /> Período anterior (linha)</span>
    </p>
  );
}

export type DadosDeVendas = { atual: ResumoDeVendas; anterior: ResumoDeVendas | null; dias: number; de: string; ate: string };

export function PainelGeral({ vendas, sinais }: { vendas: DadosDeVendas | null; sinais: Sinal[] }) {
  const problemas = sinais.filter((s) => s.gravidade === "problema" || s.gravidade === "atencao");
  const chances = sinais.filter((s) => s.gravidade === "oportunidade" || s.gravidade === "bom");

  if (!vendas) {
    return sinais.length > 0 ? (
      <section className="mt-9" aria-label="O que pede atenção">
        <ul className="grid gap-3 md:grid-cols-2">{sinais.map((s) => <CartaoDeSinal key={s.chave} s={s} />)}</ul>
      </section>
    ) : null;
  }

  const { atual, anterior, dias, de, ate } = vendas;
  const t = atual.totais;
  const ta = anterior?.totais ?? null;
  const porDia = new Map(atual.por_dia.map((d) => [d.dia, Number(d.valor_pago)]));
  const serie = diasEntre(de, ate).map((dia) => ({ dia, valor: porDia.get(dia) ?? 0 }));
  const porDiaAntes = new Map((anterior?.por_dia ?? []).map((d) => [d.dia, Number(d.valor_pago)]));
  const serieAntes = serie.map((_, i) => {
    const d = new Date(`${de}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - dias + i);
    return porDiaAntes.get(d.toISOString().slice(0, 10)) ?? 0;
  });

  const ticket = t.pagos ? Number(t.valor_pago) / t.pagos : 0;
  const ticketAntes = ta && ta.pagos ? Number(ta.valor_pago) / ta.pagos : 0;
  const cancel = taxaDeCancelamento(t);
  const cancelAntes = ta ? taxaDeCancelamento(ta) : null;
  const criados = t.pagos + t.aguardando + t.cancelados;
  const partes = [
    { nome: "Pagos", n: t.pagos, valor: Number(t.valor_pago), cor: BOM },
    { nome: "Aguardando", n: t.aguardando, valor: Number(t.valor_aguardando), cor: ATENCAO },
    { nome: "Cancelados", n: t.cancelados, valor: Number(t.valor_cancelado), cor: PROBLEMA },
  ];

  const canais = agruparPorCanal(atual.por_origem).filter((c) => c.valor > 0);
  const canaisAntes = new Map((anterior ? agruparPorCanal(anterior.por_origem) : []).map((c) => [c.canal, c.valor]));
  const maiorCanal = Math.max(...canais.map((c) => c.valor), 1);
  const semana = porDiaDaSemana(atual.por_dia).sort((a, b) => ((a.dia + 6) % 7) - ((b.dia + 6) % 7));
  const maiorDia = Math.max(...semana.map((d) => d.media), 1);

  return (
    <>
      <section className="mt-9" aria-label="Números do período">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Loja virtual</p>
            <h2 className="font-display mt-1 text-2xl text-ink">Últimos {dias} dias, contra os {dias} anteriores</h2>
          </div>
          <Link href="/admin/vendas?periodo=30d" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-nav hover:underline">
            Abrir as vendas <ArrowRight size={12} aria-hidden />
          </Link>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Numero rotulo="Faturamento pago" valor={reais(Number(t.valor_pago))} serie={serie.map((d) => d.valor)}>
            <Variacao d={ta ? variacao(Number(t.valor_pago), Number(ta.valor_pago)) : null} />
          </Numero>
          <Numero rotulo="Pedidos pagos" valor={inteiro(t.pagos)}>
            <Variacao d={ta ? variacao(t.pagos, ta.pagos) : null} />
          </Numero>
          <Numero rotulo="Ticket médio" valor={reais(ticket)}>
            <Variacao d={ticketAntes ? variacao(ticket, ticketAntes) : null} />
          </Numero>
          <Numero rotulo="Pedidos que não viraram venda" valor={`${Math.round(cancel * 100)}%`}>
            <Variacao d={cancelAntes === null ? null : (cancel - cancelAntes) * 100} bomSeSobe={false} sufixo=" pontos" />
          </Numero>
        </div>
      </section>

      {sinais.length > 0 ? (
        <section className="mt-8 grid gap-6 lg:grid-cols-2" aria-label="Problemas e oportunidades">
          <div>
            <h2 className="font-display text-xl text-ink">Onde está o problema</h2>
            {problemas.length > 0 ? (
              <ul className="mt-3 space-y-3">{problemas.map((s) => <CartaoDeSinal key={s.chave} s={s} />)}</ul>
            ) : (
              <p className="glass mt-3 rounded-[14px] p-4 text-sm text-muted">Nenhum alerta nos números de hoje.</p>
            )}
          </div>
          <div>
            <h2 className="font-display text-xl text-ink">Onde dá para crescer</h2>
            {chances.length > 0 ? (
              <ul className="mt-3 space-y-3">{chances.map((s) => <CartaoDeSinal key={s.chave} s={s} />)}</ul>
            ) : (
              <p className="glass mt-3 rounded-[14px] p-4 text-sm text-muted">Nenhuma oportunidade nova nos números de hoje.</p>
            )}
          </div>
        </section>
      ) : null}

      <section className="glass mt-8 rounded-[18px] p-5" aria-label="Faturamento por dia">
        <p className="eyebrow">Faturamento pago por dia</p>
        <Legenda />
        <Comparacao atual={serie} anterior={serieAntes} dias={dias} />
        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-semibold text-brand-nav hover:underline">Ver em tabela</summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[26rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[0.68rem] uppercase tracking-wider text-muted">
                  <th scope="col" className="py-2 pr-4 font-semibold">Dia</th>
                  <th scope="col" className="py-2 pr-4 text-right font-semibold">Período atual</th>
                  <th scope="col" className="py-2 text-right font-semibold">Período anterior</th>
                </tr>
              </thead>
              <tbody>
                {[...serie].reverse().map((d, i) => (
                  <tr key={d.dia} className="border-b border-border/50 last:border-0">
                    <td className="py-1.5 pr-4 text-ink">{diaCurto(d.dia)}</td>
                    <td className="numeros py-1.5 pr-4 text-right text-ink">{reais(d.valor)}</td>
                    <td className="numeros py-1.5 text-right text-muted">{reais(serieAntes[serie.length - 1 - i] ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      <section className="mt-6 grid gap-5 lg:grid-cols-2">
        <div className="glass rounded-[18px] p-5">
          <p className="eyebrow">O que acontece com cada pedido criado</p>
          <p className="mt-1 text-xs text-muted">{inteiro(criados)} pedidos criados no período.</p>
          {criados > 0 ? (
            <>
              <div className="mt-4 flex h-5 gap-[2px] overflow-hidden rounded-full" aria-hidden>
                {partes.filter((p) => p.n > 0).map((p) => (
                  <div key={p.nome} style={{ width: `${(p.n / criados) * 100}%`, background: p.cor }} />
                ))}
              </div>
              <ul className="mt-4 space-y-2">
                {partes.map((p) => (
                  <li key={p.nome} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="inline-flex items-center gap-2 text-ink">
                      <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: p.cor }} aria-hidden />
                      {p.nome}
                    </span>
                    <span className="numeros text-xs text-muted">
                      {inteiro(p.n)} · {Math.round((p.n / criados) * 100)}% · {reais(p.valor)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>

        <div className="glass rounded-[18px] p-5">
          <p className="eyebrow">De onde vieram as vendas</p>
          <p className="mt-1 text-xs text-muted">Faturamento pago por canal, com a variação sobre o período anterior.</p>
          <ul className="mt-4 space-y-3">
            {canais.map((c) => (
              <li key={c.canal}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate text-ink">{c.nome}</span>
                  <span className="flex shrink-0 items-baseline gap-3">
                    <Variacao d={variacao(c.valor, canaisAntes.get(c.canal) ?? 0)} />
                    <span className="numeros text-xs text-muted">{reais(c.valor)}</span>
                  </span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-border/60">
                  <div className="h-2 rounded-full" style={{ width: `${Math.max((c.valor / maiorCanal) * 100, 1)}%`, background: ATUAL }} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="glass mt-6 rounded-[18px] p-5" aria-label="Dia da semana">
        <p className="eyebrow">Faturamento médio por dia da semana</p>
        <ul className="mt-4 grid grid-cols-7 items-end gap-2" style={{ height: "9.5rem" }}>
          {semana.map((d) => (
            <li key={d.dia} className="flex h-full min-w-0 flex-col items-center justify-end gap-1" title={`${d.nome}: ${reais(d.media)} por dia`}>
              <span className="numeros text-[0.62rem] text-muted">{reaisCurto(d.media).replace("R$ ", "")}</span>
              <span className="w-full max-w-12 rounded-t-[4px]" style={{ height: `${Math.max((d.media / maiorDia) * 70, 2)}%`, background: ATUAL }} aria-hidden />
              <span className="truncate text-[0.68rem] text-ink">{d.nome.slice(0, 3)}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
