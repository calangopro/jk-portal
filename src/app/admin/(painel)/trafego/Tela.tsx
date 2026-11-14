import Link from "next/link";
import { ArrowRight, CircleAlert, CircleCheck, Megaphone, Minus, Scale, Tag, TrendingUp, TriangleAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { TrafegoDaTela } from "@/lib/trafego/dados";
import type { Conexao } from "@/lib/trafego/plataformas";
import { PLATAFORMAS, type LinhaDeRetorno } from "@/lib/trafego/retorno";
import { diaCurto, type ChaveDePeriodo } from "@/lib/vendas/periodo";
import { BotaoDeAcao } from "../recuperacao/BotaoDeAcao";
import { SeletorDePeriodo } from "../SeletorDePeriodo";
import { Cartao, Dinheiro, haQuantoTempo, reais } from "../vendas/PainelDeVendas";
import type { OrigemDosPedidos, SaudeDoColetor } from "@/lib/origem/anotado";
import { LerAgora } from "./LerAgora";
import { OrigemAnotada } from "./OrigemAnotada";

/**
 * A parte da tela de tráfego que só desenha.
 *
 * CORES. O mesmo par validado do painel: dourado para a venda, azul para o
 * gasto. Verde, âmbar e vermelho são só de estado e vêm com ícone e palavra.
 * Venda e gasto dividem o MESMO eixo no gráfico porque os dois são reais: é o
 * que deixa ver a olho quanto a venda passa do gasto em cada dia.
 */

const VENDA = "#b8841f";
const GASTO = "#1f86b0";
const BOM = "#047857";
const ATENCAO = "#b45309";
const PROBLEMA = "#b91c1c";

const reaisCurto = (n: number) =>
  n >= 1000 ? `R$ ${(n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : `R$ ${Math.round(n)}`;

const SITUACAO: Record<LinhaDeRetorno["situacao"], { nome: string; cor: string; Icone: LucideIcon }> = {
  positivo: { nome: "Vendeu mais do que gastou", cor: BOM, Icone: CircleCheck },
  prejuizo: { nome: "Vendeu menos do que gastou", cor: PROBLEMA, Icone: CircleAlert },
  sem_venda: { nome: "Nenhuma venda com etiqueta", cor: ATENCAO, Icone: TriangleAlert },
  sem_gasto: { nome: "Gasto não lançado", cor: "var(--color-muted)", Icone: Minus },
};

function PorDia({ dias }: { dias: TrafegoDaTela["porDia"] }) {
  const L = 900, A = 240, esq = 72, dir = 8, topo = 14, base = 26;
  const max = Math.max(...dias.map((d) => Math.max(d.venda, d.gasto)), 1);
  const larg = (L - esq - dir) / dias.length;
  const y = (v: number) => topo + (1 - v / max) * (A - topo - base);
  const linha = dias.map((d, i) => `${esq + i * larg + larg / 2},${y(d.gasto)}`).join(" ");
  const passo = Math.ceil(dias.length / 8);

  return (
    <svg viewBox={`0 0 ${L} ${A}`} className="mt-4 h-auto w-full" role="img" aria-label="Venda paga da loja e gasto em anúncio, por dia, na mesma escala em reais">
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={esq} x2={L - dir} y1={y(max * f)} y2={y(max * f)} stroke="var(--color-border)" strokeDasharray={f === 0 ? undefined : "3 4"} />
          <text x={esq - 8} y={y(max * f) + 4} textAnchor="end" fontSize="11" fill="var(--color-muted)">{reaisCurto(max * f)}</text>
        </g>
      ))}
      {dias.map((d, i) => (
        <g key={d.dia}>
          {d.venda > 0 ? (
            <rect x={esq + i * larg + 1} y={y(d.venda)} width={Math.max(larg - 2, 2)} height={A - base - y(d.venda)} rx="2.5" fill={VENDA} />
          ) : null}
          {i % passo === 0 ? (
            <text x={esq + i * larg + larg / 2} y={A - 8} textAnchor="middle" fontSize="11" fill="var(--color-muted)">{diaCurto(d.dia)}</text>
          ) : null}
        </g>
      ))}
      <polyline points={linha} fill="none" stroke={GASTO} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {dias.map((d, i) => (
        <rect key={d.dia} x={esq + i * larg} y={topo} width={larg} height={A - topo - base} fill="transparent">
          <title>{`${diaCurto(d.dia)}: ${reais(d.venda)} de venda paga, ${reais(d.gasto)} de anúncio.`}</title>
        </rect>
      ))}
    </svg>
  );
}

const NOME_DA_CONEXAO = { meta: "Meta (Instagram e Facebook)", google: "Google Ads" } as const;

/** Uma linha por plataforma: lida há quanto tempo, ou o que falta para ligar. */
function Ligacao({ c }: { c: Conexao }) {
  const ligada = Boolean(c.lidaEm) && !c.problema;
  const estado = ligada
    ? { nome: "Ligada", cor: BOM, Icone: CircleCheck }
    : c.lidaEm
      ? { nome: "Parou de ler", cor: PROBLEMA, Icone: CircleAlert }
      : { nome: "Ainda não ligada", cor: ATENCAO, Icone: TriangleAlert };
  const falta =
    c.problema ??
    (c.plataforma === "meta"
      ? "Falta colar o token do Meta em Integrações."
      : c.configurada
        ? "Ainda não houve leitura. Use o botão abaixo para testar."
        : "Falta a conta de serviço do Google neste deploy.");
  return (
    <li className="py-3">
      <p className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="text-sm font-semibold text-ink">{NOME_DA_CONEXAO[c.plataforma]}</span>
        <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider" style={{ color: estado.cor }}>
          <estado.Icone size={13} aria-hidden /> {estado.nome}
        </span>
      </p>
      <p className="mt-0.5 text-xs leading-relaxed text-muted">
        {ligada ? `Gasto lido direto da plataforma ${haQuantoTempo(c.lidaEm!)}.` : falta}
        {!ligada && c.lidaEm ? ` A última leitura boa foi ${haQuantoTempo(c.lidaEm)}.` : ""}
      </p>
    </li>
  );
}

const campo = "w-full rounded-[10px] border border-border bg-white px-3 py-2 text-sm text-ink";
const rotulo = "block text-[0.68rem] font-semibold uppercase tracking-wider text-muted";

export function TelaDeTrafego({
  chave, hoje, acao, conexoes, origem, saude, de, ate, comparacao, gasto, gastoAnterior, linhas, vendaDaLoja, porFora, semEtiqueta, porDia,
}: TrafegoDaTela & {
  /** A origem anotada pelo coletor no período, e como o coletor está. Sem `saude` (prévia), o bloco não aparece. */
  origem?: OrigemDosPedidos | null;
  saude?: SaudeDoColetor | null;
  chave: ChaveDePeriodo;
  hoje: string;
  acao: (f: FormData) => Promise<void>;
  /** Estado da leitura por API de cada plataforma. Sem ele (prévia), o bloco não aparece. */
  conexoes?: Conexao[] | null;
}) {
  const total = gasto?.gasto ?? 0;
  const comEtiqueta = linhas.reduce((s, l) => s + l.faturamento, 0);
  const pedidos = linhas.reduce((s, l) => s + l.pedidos, 0);
  const d = gastoAnterior && gastoAnterior > 0 ? Math.round(((total - gastoAnterior) / gastoAnterior) * 100) : null;
  const diasSemGasto = porDia.length - (gasto?.dias_com_gasto ?? 0);
  const maiorGasto = Math.max(...linhas.map((l) => l.gasto), 1);
  const tudo = vendaDaLoja + porFora;

  return (
    <div data-painel-largo>
      <header>
        <p className="eyebrow">Tráfego</p>
        <h1 className="font-display mt-2 text-4xl text-ink">Tráfego</h1>
        <p className="mt-3 max-w-3xl text-muted">
          Quanto foi gasto em anúncio e quanto de venda paga voltou. A conta usa só pedido pago na loja: o painel do Meta
          e o do Google contam pedido criado, e quatro em cada dez são cancelados depois.
        </p>
      </header>

      <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
        <h2 className="font-display text-2xl text-ink">De {diaCurto(de)} a {diaCurto(ate)}</h2>
        <SeletorDePeriodo atual={chave} />
      </div>

      <Link
        href={`/admin/trafego/campanhas?periodo=${chave === "7d" ? "30d" : chave}`}
        className="glass mt-5 flex items-center justify-between gap-3 rounded-[16px] p-4 transition-colors hover:border-brand/50"
      >
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-ink">Ver campanhas, conjuntos e anúncios</span>
          <span className="block text-xs text-muted">O que está bom, o que está ruim e em que etapa do funil cada um perde.</span>
        </span>
        <ArrowRight size={16} className="shrink-0 text-brand-nav" aria-hidden />
      </Link>

      {gasto === null ? (
        <p className="glass mt-6 rounded-[18px] p-6 text-sm text-muted">Não deu para ler o gasto agora. Recarregue a página em alguns segundos.</p>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-4">
            <Cartao
              Icone={Megaphone}
              rotulo="Gasto em anúncio"
              apoio={total === 0 ? "nada lançado neste período" : d === null ? `em ${gasto.dias_com_gasto} de ${porDia.length} dias` : `${d > 0 ? "+" : ""}${d}% ${comparacao}`}
            >
              <Dinheiro valor={total} />
            </Cartao>
            <Cartao Icone={Tag} rotulo="Venda de anúncio" apoio={`${pedidos} ${pedidos === 1 ? "pedido pago" : "pedidos pagos"} com etiqueta de anúncio`}>
              <Dinheiro valor={comEtiqueta} />
            </Cartao>
            <Cartao Icone={TrendingUp} rotulo="Volta por R$ 1, no mínimo" apoio="só a venda que chegou com etiqueta de anúncio">
              {total > 0 ? <Dinheiro valor={comEtiqueta / total} /> : <span className="text-muted">Sem gasto</span>}
            </Cartao>
            <Cartao Icone={Scale} rotulo="Volta por R$ 1, no máximo" apoio="tudo o que a loja e os vendedores venderam">
              {total > 0 ? <Dinheiro valor={tudo / total} /> : <span className="text-muted">Sem gasto</span>}
            </Cartao>
          </div>

          {total > 0 && diasSemGasto > 0 ? (
            <p className="glass mt-5 flex items-start gap-2 rounded-[14px] border-l-4 p-4 text-sm text-ink" style={{ borderLeftColor: ATENCAO }}>
              <TriangleAlert size={16} className="mt-0.5 shrink-0" style={{ color: ATENCAO }} aria-hidden />
              <span>
                <span className="font-semibold">Atenção:</span> {diasSemGasto} {diasSemGasto === 1 ? "dia do período está" : "dias do período estão"} sem
                gasto lançado. Enquanto faltar, a volta por real aparece maior do que é.
              </span>
            </p>
          ) : null}

          <section className="glass mt-6 rounded-[18px] p-5" aria-label="Por plataforma">
            <p className="eyebrow">Por plataforma</p>
            {linhas.length === 0 ? (
              <p className="mt-3 text-sm text-muted">Nenhum gasto lançado e nenhuma venda com etiqueta de anúncio no período.</p>
            ) : (
              <>
              {/* No celular, tabela de seis colunas vira rolagem de lado e ninguém
                  lê. Cada plataforma vira um cartão, com os mesmos números. */}
              <ul className="mt-3 divide-y divide-border/60 md:hidden">
                {linhas.map((l) => {
                  const s = SITUACAO[l.situacao];
                  return (
                    <li key={l.plataforma} className="py-3">
                      <p className="text-sm font-semibold text-ink">{l.nome}</p>
                      <p className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold" style={{ color: s.cor }}>
                        <s.Icone size={12} aria-hidden /> {s.nome}
                      </p>
                      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <div><dt className="text-[0.68rem] text-muted">Gasto</dt><dd className="numeros text-ink">{l.gasto > 0 ? reais(l.gasto) : "·"}</dd></div>
                        <div><dt className="text-[0.68rem] text-muted">Venda paga com etiqueta</dt><dd className="numeros text-ink">{reais(l.faturamento)} <span className="text-xs text-muted">({l.pedidos})</span></dd></div>
                        <div><dt className="text-[0.68rem] text-muted">Volta por R$ 1</dt><dd className="numeros font-semibold text-ink">{l.retorno === null ? "·" : reais(l.retorno)}</dd></div>
                        <div><dt className="text-[0.68rem] text-muted">Gasto por pedido</dt><dd className="numeros text-ink">{l.custoPorPedido === null ? "·" : reais(l.custoPorPedido)}</dd></div>
                      </dl>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-3 hidden overflow-x-auto md:block">
                <table className="w-full min-w-[46rem] border-collapse">
                  <thead>
                    <tr className="border-b border-border text-left text-[0.68rem] uppercase tracking-wider text-muted">
                      <th scope="col" className="py-2 pr-4 font-semibold">Plataforma</th>
                      <th scope="col" className="w-1/4 py-2 pr-4 font-semibold">Gasto</th>
                      <th scope="col" className="py-2 pr-4 text-right font-semibold">Venda paga com etiqueta</th>
                      <th scope="col" className="py-2 pr-4 text-right font-semibold">Pedidos</th>
                      <th scope="col" className="py-2 pr-4 text-right font-semibold">Volta por R$ 1</th>
                      <th scope="col" className="py-2 text-right font-semibold">Gasto por pedido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhas.map((l) => {
                      const s = SITUACAO[l.situacao];
                      const lancado = gasto.por_plataforma.find((p) => p.plataforma === l.plataforma);
                      return (
                        <tr key={l.plataforma} className="border-b border-border/50 align-top last:border-0">
                          <td className="py-3 pr-4">
                            <span className="block text-sm font-semibold text-ink">{l.nome}</span>
                            <span className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold" style={{ color: s.cor }}>
                              <s.Icone size={12} aria-hidden /> {s.nome}
                            </span>
                            {lancado ? (
                              <span className="block text-xs text-muted">
                                {lancado.por_api ? "lido da plataforma" : "lançado à mão"} até {diaCurto(lancado.ultimo_dia)}, {lancado.dias} {lancado.dias === 1 ? "dia" : "dias"}
                              </span>
                            ) : null}
                          </td>
                          <td className="py-3 pr-4">
                            <span className="numeros block text-sm text-ink">{l.gasto > 0 ? reais(l.gasto) : "·"}</span>
                            {l.gasto > 0 ? (
                              <span className="mt-1 block h-2 rounded-full bg-border/60">
                                <span className="block h-2 rounded-full" style={{ width: `${Math.max((l.gasto / maiorGasto) * 100, 1)}%`, background: GASTO }} />
                              </span>
                            ) : null}
                          </td>
                          <td className="numeros py-3 pr-4 text-right text-sm text-ink">{reais(l.faturamento)}</td>
                          <td className="numeros py-3 pr-4 text-right text-sm text-ink">{l.pedidos}</td>
                          <td className="numeros py-3 pr-4 text-right text-sm font-semibold text-ink">{l.retorno === null ? "·" : reais(l.retorno)}</td>
                          <td className="numeros py-3 text-right text-sm text-muted">{l.custoPorPedido === null ? "·" : reais(l.custoPorPedido)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              </>
            )}
            <p className="mt-3 max-w-3xl text-xs leading-relaxed text-muted">
              A venda entra na plataforma pela etiqueta de origem do pedido.
              {vendaDaLoja > 0 && semEtiqueta > 0
                ? ` Neste período, ${reais(semEtiqueta)} (${Math.round((semEtiqueta / vendaDaLoja) * 100)}% do que a loja vendeu) chegaram sem etiqueta: parte disso também veio de anúncio, e por isso a volta por plataforma é o mínimo, não o valor exato.`
                : " Venda que perde a etiqueta no caminho não aparece para a plataforma, e por isso a volta por plataforma é o mínimo, não o valor exato."}{" "}
              Voltar mais de R$ 1 ainda não é lucro: dessa venda sai o custo da peça, o frete e a taxa do pagamento.
            </p>
          </section>

          {porDia.some((x) => x.venda > 0 || x.gasto > 0) ? (
            <section className="glass mt-6 rounded-[18px] p-5" aria-label="Por dia">
              <p className="eyebrow">Por dia</p>
              <PorDia dias={porDia} />
              <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
                <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: VENDA }} aria-hidden /> Venda paga da loja (barras)</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 rounded-full" style={{ background: GASTO }} aria-hidden /> Gasto em anúncio (linha)</span>
              </p>
            </section>
          ) : null}
        </>
      )}

      <OrigemAnotada origem={origem ?? null} saude={saude ?? null} />

      {conexoes ? (
        <section className="glass mt-6 rounded-[18px] p-5" aria-label="Leitura automática">
          <p className="eyebrow">Leitura automática</p>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted">
            De hora em hora o painel busca o gasto direto no Meta e no Google Ads e regrava os últimos sete dias, porque
            as plataformas corrigem o gasto dos dias recentes. Plataforma ligada não precisa de lançamento à mão.
          </p>
          <ul className="mt-2 divide-y divide-border/60">
            {conexoes.map((c) => <Ligacao key={c.plataforma} c={c} />)}
          </ul>
          <LerAgora />
        </section>
      ) : null}

      <section className="glass mt-6 rounded-[18px] p-5" aria-label="Lançar gasto">
        <p className="eyebrow">Lançar gasto à mão</p>
        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted">
          Para plataforma que ainda não está ligada, ou que não tem leitura automática (Pinterest, TikTok). Para um dia
          só, preencha só o primeiro dia. Para o total de um período (a fatura do mês, por exemplo), preencha os dois: o
          valor é dividido por igual entre os dias. Lançar de novo o mesmo dia troca o valor, não soma.
        </p>
        <form action={acao} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_auto] lg:items-end">
          <div>
            <label className={rotulo} htmlFor="gasto-plataforma">Plataforma</label>
            <select id="gasto-plataforma" name="plataforma" defaultValue="meta" className={`${campo} max-w-full`}>
              {PLATAFORMAS.map((p) => <option key={p.chave} value={p.chave}>{p.nome}</option>)}
            </select>
          </div>
          <div>
            <label className={rotulo} htmlFor="gasto-valor">Valor gasto</label>
            <input id="gasto-valor" name="valor" required inputMode="decimal" pattern="[0-9.,]+" placeholder="0,00" className={`${campo} numeros`} />
          </div>
          <div>
            <label className={rotulo} htmlFor="gasto-de">Dia (ou primeiro dia)</label>
            <input id="gasto-de" name="de" type="date" required max={hoje} defaultValue={hoje} className={`${campo} numeros`} />
          </div>
          <div>
            <label className={rotulo} htmlFor="gasto-ate">Último dia (opcional)</label>
            <input id="gasto-ate" name="ate" type="date" max={hoje} className={`${campo} numeros`} />
          </div>
          <div className="lg:pb-0.5">
            <BotaoDeAcao forte>Lançar</BotaoDeAcao>
          </div>
        </form>
      </section>
    </div>
  );
}
