import Link from "next/link";
import { ArrowLeft, ChevronDown, Circle, CircleAlert, CircleCheck, Minus, Pause, Store, TrendingUp, TriangleAlert, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { chaveDoItem, itensQueVenderam, type ItemQueVendeu, type VendaDoItem } from "@/lib/origem/anotado";
import type { CampanhasDaTela } from "@/lib/trafego/dados";
import { resultadoEmPalavra, type Achado, type Avaliado, type Veredito } from "@/lib/trafego/diagnostico";
import { diaCurto, type ChaveDePeriodo } from "@/lib/vendas/periodo";
import { SeletorDePeriodo } from "../../SeletorDePeriodo";
import { haQuantoTempo, reais } from "../../vendas/PainelDeVendas";

/**
 * Campanhas, conjuntos e anúncios de uma plataforma, com o veredito de cada um.
 *
 * DESENHADA PARA O CELULAR PRIMEIRO. Não há tabela: cada item é um bloco que
 * abre e fecha (`<details>`, sem JavaScript), com os números em grade de duas
 * colunas que vira quatro no computador. Uma tabela de dez colunas com três
 * níveis não cabe em 375 px e ninguém leria.
 *
 * A ORDEM DA TELA É A ORDEM DA DECISÃO: primeiro o quanto dá para confiar no
 * número da plataforma, depois o que fazer, depois para onde vai a verba, o
 * funil, e só no fim a lista inteira para quem quer conferir.
 *
 * CORES. Verde, âmbar e vermelho são só de veredito e vêm sempre com ícone e
 * palavra. As barras usam o azul do gasto, uma cor só.
 */

const BARRA = "#1f86b0";
const VEREDITO: Record<Veredito, { nome: string; cor: string; Icone: LucideIcon }> = {
  bom: { nome: "Bom", cor: "#047857", Icone: CircleCheck },
  na_media: { nome: "Na média", cor: "var(--color-muted)", Icone: Minus },
  atencao: { nome: "Atenção", cor: "#b45309", Icone: TriangleAlert },
  ruim: { nome: "Ruim", cor: "#b91c1c", Icone: CircleAlert },
  sem_dado: { nome: "Pouco dado", cor: "var(--color-muted)", Icone: Circle },
};

const NOME_DO_TIPO: Record<string, string> = {
  vendas: "Vendas", mensagens: "Mensagens", trafego: "Tráfego", engajamento: "Engajamento", cadastros: "Cadastros", alcance: "Alcance",
  pesquisa: "Pesquisa", shopping: "Shopping", pmax: "Performance Max", display: "Display", video: "Vídeo", demand_gen: "Geração de demanda", outro: "Outro",
};
const NOME_DA_PLATAFORMA = { meta: "Meta", google: "Google Ads" } as const;
const NOME_DO_NIVEL = { campanha: "Campanha", conjunto: "Conjunto", anuncio: "Anúncio" } as const;

const inteiro = (n: number) => Math.round(n).toLocaleString("pt-BR");
const umaCasa = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const porcento = (n: number) => `${(n * 100).toLocaleString("pt-BR", { maximumFractionDigits: n < 0.1 ? 1 : 0 })}%`;
const conversas = (n: number) => `${inteiro(n)} ${Math.round(n) === 1 ? "conversa" : "conversas"}`;

function Selo({ v }: { v: Veredito }) {
  const s = VEREDITO[v];
  return (
    <span className="inline-flex shrink-0 items-center gap-1 text-[0.68rem] font-bold uppercase tracking-wider" style={{ color: s.cor }}>
      <s.Icone size={13} aria-hidden /> {s.nome}
    </span>
  );
}

function Numero({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[0.66rem] leading-tight text-muted">{rotulo}</dt>
      <dd className="numeros text-sm text-ink">{children}</dd>
    </div>
  );
}

type Vendas = Record<string, VendaDoItem>;

/** O que a loja recebeu de verdade com este item, pela origem anotada. Só aparece quando há pedido ligado. */
function NaLoja({ venda, gasto }: { venda: VendaDoItem | undefined; gasto: number }) {
  if (!venda) return null;
  return (
    <p className="numeros mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-ink">
      <Store size={13} className="mt-0.5 shrink-0 text-brand-nav" aria-hidden />
      <span>
        <span className="font-semibold">Na loja, pago:</span> {reais(venda.valor)} em {inteiro(venda.pagos)} de {inteiro(venda.criados)}{" "}
        {venda.criados === 1 ? "pedido ligado a ele" : "pedidos ligados a ele"}
        {gasto > 0 && venda.valor > 0 ? `, ${reais(venda.valor / gasto)} por R$ 1 gasto` : ""}.
      </span>
    </p>
  );
}

/** Os números de um item. O mesmo bloco serve aos três níveis. */
function Numeros({ i, plataforma, vendas }: { i: Avaliado; plataforma: "meta" | "google"; vendas: Vendas }) {
  const p = resultadoEmPalavra(i.objetivo, plataforma);
  const naLoja = <NaLoja venda={vendas[chaveDoItem(i.nivel, i.id)]} gasto={i.gasto} />;
  const funilDoSite = plataforma === "meta" && i.objetivo === "venda";
  if (i.objetivo === "engajamento") {
    return (
      <>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        <Numero rotulo="Gasto">{reais(i.gasto)}</Numero>
        <Numero rotulo="Viram o anúncio">{inteiro(i.impressoes)}</Numero>
        <Numero rotulo="Custo por mil que viram">{i.impressoes > 0 ? reais((i.gasto / i.impressoes) * 1000) : "·"}</Numero>
        <Numero rotulo="Cliques no anúncio">{inteiro(i.cliques_todos ?? i.cliques)}</Numero>
      </dl>
      {naLoja}
      </>
    );
  }
  return (
    <>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        <Numero rotulo="Gasto">{reais(i.gasto)}</Numero>
        <Numero rotulo={p.varios.charAt(0).toUpperCase() + p.varios.slice(1)}>{umaCasa(i.resultados)}</Numero>
        <Numero rotulo={`Custo por ${p.um}`}>{i.custo === null ? "·" : reais(i.custo)}</Numero>
        {i.objetivo === "venda" ? (
          <Numero rotulo={`Volta por R$ 1, pelo ${NOME_DA_PLATAFORMA[plataforma]}`}>{i.retorno === null ? "·" : reais(i.retorno)}</Numero>
        ) : (
          <Numero rotulo="Viram o anúncio">{inteiro(i.impressoes)}</Numero>
        )}
      </dl>
      {funilDoSite ? (
        <p className="numeros mt-2 text-[0.72rem] leading-relaxed text-muted">
          {inteiro(i.cliques)} cliques, {inteiro(i.visitas ?? 0)} chegaram na página, {inteiro(i.carrinhos ?? 0)} no carrinho,{" "}
          {inteiro(i.checkouts ?? 0)} começaram a compra, {umaCasa(i.compras ?? 0)} compraram
          {(i.conversas ?? 0) > 0 ? `. Também ${conversas(i.conversas ?? 0)}` : ""}.
        </p>
      ) : (
        <p className="numeros mt-2 text-[0.72rem] leading-relaxed text-muted">
          {inteiro(i.impressoes)} viram, {inteiro(i.cliques > 0 ? i.cliques : (i.cliques_todos ?? 0))} clicaram
          {i.objetivo !== "conversa" && (i.conversas ?? 0) > 0 ? `, ${conversas(i.conversas ?? 0)}` : ""}
          {i.objetivo !== "venda" && (i.compras ?? 0) > 0 ? `, ${umaCasa(i.compras ?? 0)} compras pelo pixel` : ""}.
        </p>
      )}
      {naLoja}
      {i.gargalo ? (
        <p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-ink">
          <Wrench size={13} className="mt-0.5 shrink-0 text-brand-nav" aria-hidden />
          <span><span className="font-semibold">Onde perde:</span> {i.gargalo.texto}</span>
        </p>
      ) : null}
    </>
  );
}

function Cabeca({ i, comSeta }: { i: Avaliado; comSeta: boolean }) {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 break-words text-sm font-semibold leading-snug text-ink">{i.nome || "Sem nome"}</p>
        {comSeta ? <ChevronDown size={16} className="mt-0.5 shrink-0 text-muted transition-transform group-open:rotate-180" aria-hidden /> : null}
      </div>
      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
        <Selo v={i.veredito} />
        {i.nivel === "campanha" && i.tipo ? <span className="text-[0.68rem] text-muted">{NOME_DO_TIPO[i.tipo] ?? i.tipo}</span> : null}
        {i.ativo === false ? (
          <span className="inline-flex items-center gap-1 text-[0.68rem] font-semibold text-muted"><Pause size={11} aria-hidden /> Pausado</span>
        ) : null}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-muted">{i.motivo}</p>
    </>
  );
}

/** Um item da árvore. Com filhos, abre e fecha; sem filhos, é só o bloco. */
function Bloco({ i, plataforma, vendas }: { i: Avaliado; plataforma: "meta" | "google"; vendas: Vendas }) {
  const borda = i.nivel === "campanha" ? "" : "border-l-2 border-border pl-3 sm:pl-4";
  if (i.filhos.length === 0) {
    return (
      <li className={`py-3 ${borda}`}>
        <Cabeca i={i} comSeta={false} />
        <Numeros i={i} plataforma={plataforma} vendas={vendas} />
      </li>
    );
  }
  const filho = i.nivel === "campanha" ? "conjunto" : "anúncio";
  return (
    <li className={`py-3 ${borda}`}>
      <details className="group">
        <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
          <Cabeca i={i} comSeta />
          <Numeros i={i} plataforma={plataforma} vendas={vendas} />
          <p className="mt-2 text-xs font-semibold text-brand-nav">
            <span className="group-open:hidden">Ver {i.filhos.length} {i.filhos.length === 1 ? filho : `${filho}s`}</span>
            <span className="hidden group-open:inline">Esconder {i.filhos.length === 1 ? `o ${filho}` : `os ${filho}s`}</span>
          </p>
        </summary>
        <ul className="mt-2 divide-y divide-border/50">
          {i.filhos.map((f) => <Bloco key={f.id} i={f} plataforma={plataforma} vendas={vendas} />)}
        </ul>
      </details>
    </li>
  );
}

function ListaDeAchados({ titulo, vazio, achados, Icone, cor }: { titulo: string; vazio: string; achados: Achado[]; Icone: LucideIcon; cor: string }) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 text-[0.68rem] font-bold uppercase tracking-wider" style={{ color: cor }}>
        <Icone size={14} aria-hidden /> {titulo}
      </p>
      {achados.length === 0 ? (
        <p className="mt-2 text-xs text-muted">{vazio}</p>
      ) : (
        <ul className="mt-2 space-y-2.5">
          {achados.map((a, n) => (
            <li key={n} className="rounded-[12px] border-l-4 bg-white/50 p-3" style={{ borderLeftColor: cor }}>
              <p className="text-[0.66rem] font-semibold uppercase tracking-wider text-muted">{NOME_DO_NIVEL[a.nivel]}</p>
              <p className="break-words text-sm font-semibold leading-snug text-ink">{a.nome || "Sem nome"}</p>
              {a.dentroDe ? <p className="break-words text-[0.7rem] text-muted">em {a.dentroDe}</p> : null}
              <p className="mt-1 text-xs leading-relaxed text-ink/85">{a.texto}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
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
  const vendas: Vendas = anotado?.itens ?? {};
  const rever = (d?.achados ?? []).filter((a) => a.tipo === "rever").slice(0, 5);
  const crescer = (d?.achados ?? []).filter((a) => a.tipo === "crescer").slice(0, 5);
  const fator = d && d.totais.valor > 0 ? loja.valor / d.totais.valor : null;

  return (
    <div data-painel-largo>
      <header>
        <Link href={`/admin/trafego?periodo=${chave}`} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-nav hover:underline">
          <ArrowLeft size={12} aria-hidden /> Tráfego
        </Link>
        <h1 className="font-display mt-2 text-3xl text-ink sm:text-4xl">Campanhas</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted sm:text-base">
          Cada campanha, conjunto e anúncio comparado com a média da própria conta, para ver o que puxa o resultado para
          cima e o que puxa para baixo.
        </p>
      </header>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
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
          hora em hora. Para puxar agora, use o botão Ler agora em Tráfego.
        </p>
      ) : (
        <>
          {d.totais.compras > 0 ? (
            <section className="glass mt-5 rounded-[18px] p-4 sm:p-5" aria-label="O que a plataforma diz e o que a loja recebeu">
              <p className="eyebrow">Quanto dá para confiar no número do {nome}</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="min-w-0">
                  <p className="text-[0.68rem] leading-tight text-muted">O {nome} diz que vendeu</p>
                  <p className="font-display numeros text-[clamp(1.1rem,5vw,1.7rem)] leading-tight text-ink">{reais(d.totais.valor)}</p>
                  <p className="text-[0.7rem] text-muted">{umaCasa(d.totais.compras)} {plataforma === "meta" ? "compras" : "conversões"}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-[0.68rem] leading-tight text-muted">A loja recebeu, pago, com a etiqueta dele</p>
                  <p className="font-display numeros text-[clamp(1.1rem,5vw,1.7rem)] leading-tight text-ink">{reais(loja.valor)}</p>
                  <p className="text-[0.7rem] text-muted">{loja.pagos} pagos de {loja.criados} pedidos criados</p>
                </div>
              </div>
              <p className="mt-3 max-w-3xl text-xs leading-relaxed text-muted">
                {fator !== null ? `Para cada R$ 1 de venda que o ${nome} mostra, a loja viu ${reais(fator)} pago com a etiqueta dele. ` : ""}
                A plataforma conta pedido criado e também a venda de quem só viu o anúncio. Por isso os vereditos abaixo
                comparam cada item com a média da própria conta, e não com um número absoluto: o exagero pega todos por
                igual, e a comparação entre eles continua valendo.
              </p>
            </section>
          ) : null}

          {anotado ? <VendeuDeFato campanhas={d.campanhas} anotado={anotado} nome={nome} /> : null}

          <section className="glass mt-5 rounded-[18px] p-4 sm:p-5" aria-label="O que fazer agora">
            <p className="eyebrow">O que fazer agora</p>
            <div className="mt-3 grid gap-5 md:grid-cols-2">
              <ListaDeAchados titulo="Rever ou pausar" vazio="Nada ligado está muito pior que a média da conta." achados={rever} Icone={CircleAlert} cor="#b91c1c" />
              <ListaDeAchados titulo="Tem espaço para crescer" vazio="Nada ligado está bem melhor que a média da conta." achados={crescer} Icone={TrendingUp} cor="#047857" />
            </div>
            <p className="mt-3 text-[0.7rem] text-muted">
              Só entra o que está ligado. Quando a campanha inteira está ruim, os conjuntos e anúncios dela não se repetem aqui.
            </p>
          </section>

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

          <section className="glass mt-5 rounded-[18px] p-4 sm:p-5" aria-label="Todas as campanhas">
            <p className="eyebrow">Todas as campanhas, da que mais gastou para a que menos</p>
            <ul className="mt-1 divide-y divide-border/60">
              {d.campanhas.map((c) => <Bloco key={c.id} i={c} plataforma={plataforma} vendas={vendas} />)}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
