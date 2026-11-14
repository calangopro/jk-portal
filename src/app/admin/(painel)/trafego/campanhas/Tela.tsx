import Link from "next/link";
import { CircleAlert, Megaphone, Receipt, ShoppingBag, Store, Target, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { itensQueVenderam, type ItemQueVendeu } from "@/lib/origem/anotado";
import { IMPOSTO_DA_FATURA, MARGEM_DE_REFERENCIA, voltaParaEmpatar } from "@/lib/painel/premissas";
import type { CampanhasDaTela } from "@/lib/trafego/dados";
import { resultadoEmPalavra, type Achado, type Avaliado } from "@/lib/trafego/diagnostico";
import { COR_DO_TOM as TOM, type Tom } from "@/lib/painel/tons";
import { achatar, tomDaVoltaDaLoja } from "@/lib/trafego/linhas";
import { diaCurto, type ChaveDePeriodo } from "@/lib/vendas/periodo";
import { ICONE_DO_TOM } from "../../Pecas";
import { SeletorDePeriodo } from "../../SeletorDePeriodo";
import { haQuantoTempo, reais } from "../../vendas/PainelDeVendas";
import { TabelaDeAnuncios } from "./Tabela";

/**
 * Campanhas, conjuntos e anúncios de uma plataforma.
 *
 * A ORDEM DA TELA É A ORDEM DA DECISÃO. Em cima, cinco números: quanto saiu,
 * quanto a loja recebeu de verdade e a volta, com cor. Depois os vencedores e
 * o que rever, lado a lado. Depois a tabela, no jeito de gerenciador de
 * anúncio (`Tabela.tsx`), para quem quer ordenar, filtrar e descer até o
 * anúncio. No fim, o que explica os números: o que a loja ligou a cada
 * anúncio, para onde vai a verba, o funil e o quanto dá para confiar.
 *
 * CORES. Verde, âmbar e vermelho são só de bom, atenção e ruim, e vêm sempre
 * com ícone e palavra. As regras de cor moram em `lib/trafego/linhas.ts`. As
 * barras usam o azul do gasto, uma cor só.
 */

const BARRA = "#1f86b0";
const PALAVRA_DO_TOM: Record<Tom, string> = { bom: "Paga a conta", atencao: "Não cobre a margem", ruim: "Gastou mais do que vendeu", neutro: "" };

const NOME_DA_PLATAFORMA = { meta: "Meta", google: "Google Ads" } as const;
const NOME_DO_NIVEL = { campanha: "Campanha", conjunto: "Conjunto", anuncio: "Anúncio" } as const;

const inteiro = (n: number) => Math.round(n).toLocaleString("pt-BR");
const umaCasa = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const porcento = (n: number) => `${(n * 100).toLocaleString("pt-BR", { maximumFractionDigits: n < 0.1 ? 1 : 0 })}%`;
const vezes = (n: number) => `${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}x`;

/** Um dos cinco números do topo. Com tom, o cartão inteiro ganha a cor e a palavra. */
function Indicador({
  Icone, rotulo, valor, apoio, tom = "neutro",
}: {
  Icone: LucideIcon;
  rotulo: string;
  valor: string;
  apoio: React.ReactNode;
  tom?: Tom;
}) {
  const t = TOM[tom];
  const IconeDoTom = ICONE_DO_TOM[tom];
  return (
    <div className="glass min-w-0 rounded-[16px] p-3.5 sm:p-4" style={tom === "neutro" ? undefined : { background: t.fundo, borderColor: "transparent" }}>
      <p className="flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-wider text-muted">
        <span className="painel-selo grid h-6 w-6 shrink-0 place-items-center rounded-[8px]">
          <Icone size={13} aria-hidden="true" />
        </span>
        <span className="min-w-0 truncate">{rotulo}</span>
      </p>
      <p className="font-display numeros mt-2 text-[clamp(1.15rem,5vw,1.6rem)] leading-none lg:text-[1.2rem] xl:text-[1.45rem]" style={{ color: t.texto }}>
        {valor}
      </p>
      {tom !== "neutro" && IconeDoTom ? (
        <p className="mt-1.5 inline-flex items-center gap-1 text-[0.7rem] font-bold" style={{ color: t.texto }}>
          <IconeDoTom size={12} aria-hidden="true" /> {PALAVRA_DO_TOM[tom]}
        </p>
      ) : null}
      <p className="numeros mt-1 text-[0.7rem] leading-snug text-muted">{apoio}</p>
    </div>
  );
}

function ListaDeAchados({ titulo, vazio, achados, Icone, tom }: { titulo: string; vazio: string; achados: Achado[]; Icone: LucideIcon; tom: Tom }) {
  const t = TOM[tom];
  const PRIMEIROS = 2;
  const item = (a: Achado, n: number) => (
    <li key={`${a.nivel}-${a.nome}-${n}`} className="rounded-[12px] border-l-4 bg-white p-3" style={{ borderLeftColor: t.texto }}>
      <p className="text-[0.66rem] font-semibold uppercase tracking-wider text-muted">{NOME_DO_NIVEL[a.nivel]}</p>
      <p className="break-words text-sm font-semibold leading-snug text-ink">{a.nome || "Sem nome"}</p>
      {a.dentroDe ? <p className="break-words text-[0.7rem] text-muted">em {a.dentroDe}</p> : null}
      <p className="mt-1 text-xs leading-relaxed text-ink/85">{a.texto}</p>
    </li>
  );
  return (
    <section className="min-w-0 rounded-[18px] p-4 sm:p-5" style={{ background: t.fundo }} aria-label={titulo}>
      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider" style={{ color: t.texto }}>
        <Icone size={15} aria-hidden="true" /> {titulo}
      </p>
      {achados.length === 0 ? (
        <p className="mt-2 text-xs text-ink/75">{vazio}</p>
      ) : (
        <>
          <ul className="mt-3 space-y-2">{achados.slice(0, PRIMEIROS).map(item)}</ul>
          {achados.length > PRIMEIROS ? (
            // Os dois primeiros ficam à vista e o resto abre no toque: cinco
            // cartões de cada lado empurravam a tabela para longe no celular.
            <details className="group mt-2">
              <summary className="cursor-pointer list-none text-xs font-bold [&::-webkit-details-marker]:hidden" style={{ color: t.texto }}>
                <span className="group-open:hidden">Ver mais {achados.length - PRIMEIROS}</span>
                <span className="hidden group-open:inline">Mostrar menos</span>
              </summary>
              <ul className="mt-2 space-y-2">{achados.slice(PRIMEIROS).map(item)}</ul>
            </details>
          ) : null}
        </>
      )}
    </section>
  );
}

/** Um item que teve pedido ligado, com o que a loja recebeu e o que ele gastou. */
function LinhaDeVenda({ v }: { v: ItemQueVendeu }) {
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
        <p className="min-w-0 break-words text-sm font-semibold leading-snug text-ink">{v.nome}</p>
        <p className="numeros shrink-0 text-sm font-semibold text-ink">{reais(v.valor)}</p>
      </div>
      {v.dentroDe ? <p className="break-words text-[0.7rem] text-muted">em {v.dentroDe}</p> : null}
      <p className="numeros mt-1 text-[0.72rem] leading-relaxed text-muted">
        {v.pagos === 0 ? "Nenhum pago" : `${inteiro(v.pagos)} ${v.pagos === 1 ? "pago" : "pagos"}`} de {inteiro(v.criados)}{" "}
        {v.criados === 1 ? "pedido criado" : "pedidos criados"}
        {v.gasto === null ? ", sem gasto neste período" : `, gastou ${reais(v.gasto)}`}
        {v.volta !== null && v.valor > 0 ? `, voltou ${reais(v.volta)} por R$ 1` : ""}
        {v.ativo === false ? ". Pausado" : ""}.
      </p>
    </li>
  );
}

/**
 * O que a LOJA recebeu de verdade, por anúncio. Vem antes do "o que fazer"
 * porque é o número em que dá para confiar: pedido pago, ligado ao anúncio
 * pela chegada que a própria loja anotou.
 */
function VendeuDeFato({ campanhas, anotado, nome }: { campanhas: Avaliado[]; anotado: NonNullable<CampanhasDaTela["anotado"]>; nome: string }) {
  const anuncios = itensQueVenderam(campanhas, anotado.itens, "anuncio");
  const dasCampanhas = itensQueVenderam(campanhas, anotado.itens, "campanha");
  const c = anotado.cobertura;

  if (anuncios.length === 0 && dasCampanhas.length === 0) {
    return (
      <section className="glass mt-5 rounded-[18px] p-4 sm:p-5" aria-label="O que vendeu de fato, pela loja">
        <p className="eyebrow">O que vendeu de fato, pela loja</p>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink">
          Ainda não há pedido ligado a anúncio do {nome} neste período.
        </p>
        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted">
          Quando houver, este bloco mostra quanto cada anúncio vendeu em pedido PAGO, ao lado do que ele gastou. O que já
          funciona e o que falta está em{" "}
          <Link href="/admin/trafego" className="font-semibold text-brand-nav hover:underline">Tráfego</Link>, no bloco
          Origem anotada pela loja.
        </p>
      </section>
    );
  }

  const lista = anuncios.length > 0 ? anuncios : dasCampanhas;
  return (
    <section className="glass mt-5 rounded-[18px] p-4 sm:p-5" aria-label="O que vendeu de fato, pela loja">
      <p className="eyebrow">O que vendeu de fato, pela loja</p>
      <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted">
        Pedidos que a loja ligou a cada {anuncios.length > 0 ? "anúncio" : "campanha"} pela chegada anotada, do que mais
        vendeu pago para o que menos. Não é o número do {nome}: aqui só conta o que foi pago.
      </p>
      <ul className="mt-2 divide-y divide-border/60">
        {lista.slice(0, 10).map((v) => <LinhaDeVenda key={v.id} v={v} />)}
      </ul>
      {anuncios.length > 0 && dasCampanhas.length > 0 ? (
        <details className="group mt-2">
          <summary className="cursor-pointer list-none text-xs font-semibold text-brand-nav [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">Ver por campanha</span>
            <span className="hidden group-open:inline">Esconder as campanhas</span>
          </summary>
          <ul className="mt-1 divide-y divide-border/60">
            {dasCampanhas.slice(0, 10).map((v) => <LinhaDeVenda key={v.id} v={v} />)}
          </ul>
        </details>
      ) : null}
      <p className="numeros mt-3 max-w-3xl text-[0.7rem] leading-relaxed text-muted">
        No período, {inteiro(c.pagos_com_anuncio)} de {inteiro(c.pagos)} pedidos pagos da loja têm anúncio reconhecido, somando todas as
        plataformas. Compra de quem só viu o anúncio, trocou de aparelho ou fechou pelo WhatsApp não entra aqui.
      </p>
    </section>
  );
}

export function TelaDeCampanhas({
  plataforma, de, ate, diagnostico, loja, anotado, chave, lidaEm,
}: CampanhasDaTela & { chave: ChaveDePeriodo; lidaEm: string | null }) {
  const nome = NOME_DA_PLATAFORMA[plataforma];
  const d = diagnostico;
  const rever = (d?.achados ?? []).filter((a) => a.tipo === "rever").slice(0, 5);
  const crescer = (d?.achados ?? []).filter((a) => a.tipo === "crescer").slice(0, 5);
  const fator = d && d.totais.valor > 0 ? loja.valor / d.totais.valor : null;

  const linhas = d ? achatar(d.campanhas, anotado?.itens ?? {}) : [];
  const gasto = d?.totais.gasto ?? 0;
  const empate = voltaParaEmpatar();
  const voltaDaLoja = gasto > 0 ? loja.valor / gasto : null;
  // A média da conta nas campanhas de venda: é contra ela que a volta de cada item ganha cor.
  const deVenda = (d?.campanhas ?? []).filter((c) => c.objetivo === "venda");
  const gastoDeVenda = deVenda.reduce((s, c) => s + c.gasto, 0);
  const mediaDaVolta = d && gastoDeVenda > 0 && d.totais.valor > 0 ? d.totais.valor / gastoDeVenda : null;
  const imposto = IMPOSTO_DA_FATURA[plataforma] ?? 0;

  return (
    <div data-painel-largo>
      <header>
        <p className="eyebrow">Tráfego</p>
        <h1 className="font-display mt-2 text-3xl text-ink sm:text-4xl">Campanhas e anúncios</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted sm:text-base">
          O que cada campanha, conjunto e anúncio gastou e trouxe. Verde é o que puxa o resultado para cima, vermelho é o
          que queima verba.
        </p>
      </header>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Plataforma" className="flex gap-1 rounded-full border border-border bg-surface/60 p-1">
          {(["meta", "google"] as const).map((p) => (
            <Link
              key={p}
              href={`?plataforma=${p}&periodo=${chave}`}
              scroll={false}
              aria-current={p === plataforma ? "page" : undefined}
              className={"whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-semibold " + (p === plataforma ? "bg-ink text-white" : "text-muted hover:text-ink")}
            >
              {NOME_DA_PLATAFORMA[p]}
            </Link>
          ))}
        </nav>
        <SeletorDePeriodo atual={chave} extra={`&plataforma=${plataforma}`} />
      </div>
      <p className="mt-2 text-xs text-muted">
        De {diaCurto(de)} a {diaCurto(ate)}.{" "}
        {lidaEm ? `Lido do ${nome} ${haQuantoTempo(lidaEm)}.` : `Ainda não houve leitura das campanhas do ${nome}.`}
      </p>

      {d === null ? (
        <p className="glass mt-6 rounded-[18px] p-5 text-sm text-muted">Não deu para ler as campanhas agora. Recarregue a página em alguns segundos.</p>
      ) : d.campanhas.length === 0 ? (
        <p className="glass mt-6 rounded-[18px] p-5 text-sm text-muted">
          <span className="font-semibold text-ink">Nenhuma campanha do {nome} com gasto neste período.</span> A leitura roda de
          hora em hora. Para puxar agora, use o botão Ler agora em Gasto e retorno.
        </p>
      ) : (
        <>
          <section className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5" aria-label="Resumo do período">
            <Indicador
              Icone={Receipt}
              rotulo="Gasto"
              valor={reais(gasto)}
              apoio={imposto > 0 ? `na fatura, com o imposto de ${porcento(imposto)}: ${reais(gasto * (1 + imposto))}` : "como o Google cobra"}
            />
            <Indicador
              Icone={Store}
              rotulo="Loja recebeu, pago"
              valor={reais(loja.valor)}
              apoio={`${loja.pagos} pagos de ${loja.criados} pedidos com a etiqueta do ${nome}`}
            />
            <Indicador
              Icone={Target}
              rotulo="Volta na loja"
              valor={voltaDaLoja === null ? "·" : vezes(voltaDaLoja)}
              tom={tomDaVoltaDaLoja(voltaDaLoja, empate)}
              apoio={`venda paga por R$ 1 gasto. Empate em ${vezes(empate)}, pela premissa de margem de ${porcento(MARGEM_DE_REFERENCIA)}`}
            />
            <Indicador
              Icone={Megaphone}
              rotulo={`Venda pelo ${nome}`}
              valor={reais(d.totais.valor)}
              apoio={
                d.totais.compras > 0
                  ? `${umaCasa(d.totais.compras)} ${plataforma === "meta" ? "compras" : "conversões"}${mediaDaVolta !== null ? `, ${vezes(mediaDaVolta)} por real` : ""}. Conta pedido criado`
                  : "nenhuma compra informada no período"
              }
            />
            <div className="col-span-2 lg:col-span-1">
              <Indicador
                Icone={ShoppingBag}
                rotulo="Custo por compra"
                valor={d.totais.compras > 0 && gastoDeVenda > 0 ? reais(gastoDeVenda / d.totais.compras) : "·"}
                apoio={`pelo ${nome}, nas campanhas de venda (${reais(gastoDeVenda)} de gasto)`}
              />
            </div>
          </section>

          <div className="mt-5 grid items-start gap-3 md:grid-cols-2">
            <ListaDeAchados titulo="Vencedores: tem espaço para crescer" vazio="Nada ligado está bem melhor que a média da conta." achados={crescer} Icone={TrendingUp} tom="bom" />
            <ListaDeAchados titulo="Para rever ou pausar" vazio="Nada ligado está muito pior que a média da conta." achados={rever} Icone={CircleAlert} tom="ruim" />
          </div>
          <p className="mt-2 text-[0.7rem] text-muted">
            Só entra o que está ligado. Quando a campanha inteira está ruim, os conjuntos e anúncios dela não se repetem aqui.
          </p>

          <TabelaDeAnuncios linhas={linhas} plataforma={plataforma} empate={empate} mediaDaVolta={mediaDaVolta} />
          <p className="mt-2 max-w-4xl text-[0.7rem] leading-relaxed text-muted">
            Clique no nome para descer da campanha ao conjunto e do conjunto ao anúncio. O veredito e a cor do custo comparam
            o item com a média da própria conta para o mesmo objetivo. A volta na loja usa só pedido pago ligado ao item pelo
            coletor de origem: fica verde do empate para cima e vermelha abaixo de 1.
          </p>

          {anotado ? <VendeuDeFato campanhas={d.campanhas} anotado={anotado} nome={nome} /> : null}

          <section className="glass mt-5 rounded-[18px] p-4 sm:p-5" aria-label="Para onde vai a verba">
            <p className="eyebrow">Para onde vai a verba</p>
            <ul className="mt-3 space-y-3">
              {d.verba.map((v) => {
                const p = resultadoEmPalavra(v.objetivo, plataforma);
                return (
                  <li key={v.objetivo}>
                    <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                      <span className="font-semibold text-ink">{v.nome}</span>
                      <span className="numeros text-ink">{reais(v.gasto)} <span className="text-xs text-muted">({porcento(v.fatia)})</span></span>
                    </p>
                    <span className="mt-1 block h-2 rounded-full bg-border/60" aria-hidden>
                      <span className="block h-2 rounded-full" style={{ width: `${Math.max(v.fatia * 100, 1)}%`, background: BARRA }} />
                    </span>
                    <p className="numeros mt-1 text-[0.72rem] text-muted">
                      {v.objetivo === "engajamento"
                        ? "sem resultado medido no painel (interação em publicação, vídeo ou live)"
                        : `${umaCasa(v.resultados)} ${v.resultados === 1 ? p.um : p.varios}${v.custo !== null ? `, ${reais(v.custo)} por ${p.um}` : ""}`}{" "}
                      em {v.itens} {v.itens === 1 ? "campanha" : "campanhas"}
                    </p>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 max-w-3xl text-[0.7rem] leading-relaxed text-muted">
              O objetivo é o que a campanha declara na plataforma. Só o primeiro grupo mede venda: nos outros, o painel sabe
              quanto custou a conversa ou o clique, mas não o que virou venda depois.
            </p>
          </section>

          {d.funil.some((f) => f.quantidade > 0) ? (
            <section className="glass mt-5 rounded-[18px] p-4 sm:p-5" aria-label="Funil das campanhas de venda">
              <p className="eyebrow">Funil das campanhas de venda</p>
              <ol className="mt-3 divide-y divide-border/50">
                {d.funil.map((f) => (
                  <li key={f.etapa} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-0.5 py-2.5">
                    <span className="text-sm font-semibold text-ink">{f.nome}</span>
                    <span className="numeros text-sm text-ink">{f.etapa === "compra" ? umaCasa(f.quantidade) : inteiro(f.quantidade)}</span>
                    <span className="text-[0.72rem] text-muted">{f.taxa === null ? "o começo do funil" : `${porcento(f.taxa)} da etapa anterior`}</span>
                    <span className="numeros text-[0.72rem] text-muted">
                      {f.custo === null ? "" : f.etapa === "impressao" ? `${reais(f.custo)} por mil` : `${reais(f.custo)} cada`}
                    </span>
                    {f.taxa !== null && f.etapa !== "clique" ? (
                      <span className="col-span-2 mt-1 block h-1.5 rounded-full bg-border/60" aria-hidden>
                        <span className="block h-1.5 rounded-full" style={{ width: `${Math.min(Math.max(f.taxa * 100, 1), 100)}%`, background: BARRA }} />
                      </span>
                    ) : null}
                  </li>
                ))}
              </ol>
              {d.maiorPerda ? <p className="mt-3 text-sm font-semibold leading-relaxed text-ink">{d.maiorPerda}</p> : null}
              <p className="mt-2 text-[0.7rem] text-muted">A barra mostra quanto da etapa anterior passou para esta. Campanha de conversa e de visita fica fora deste funil.</p>
            </section>
          ) : null}

          {d.totais.compras > 0 ? (
            <section className="glass mt-5 rounded-[18px] p-4 sm:p-5" aria-label="O que a plataforma diz e o que a loja recebeu">
              <p className="eyebrow">Quanto dá para confiar no número do {nome}</p>
              <p className="mt-2 max-w-3xl text-xs leading-relaxed text-muted">
                {fator !== null ? `Para cada R$ 1 de venda que o ${nome} mostra, a loja viu ${reais(fator)} pago com a etiqueta dele. ` : ""}
                A plataforma conta pedido criado e também a venda de quem só viu o anúncio. Por isso os vereditos comparam
                cada item com a média da própria conta, e não com um número absoluto: o exagero pega todos por igual, e a
                comparação entre eles continua valendo.
              </p>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
