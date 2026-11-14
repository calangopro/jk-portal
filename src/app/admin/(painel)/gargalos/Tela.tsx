import Link from "next/link";
import { ArrowRight, CircleAlert, CircleCheck, Info, TrendingUp, TriangleAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Etapas } from "@/lib/ga4/funil";
import { NOME_DA_FAIXA, type Situacao } from "@/lib/painel/gargalos";
import type { GargalosDaTela } from "@/lib/painel/gargalos-dados";
import { IMPOSTO_DA_FATURA } from "@/lib/painel/premissas";
import { diaCurto, type ChaveDePeriodo } from "@/lib/vendas/periodo";
import { SeletorDePeriodo } from "../SeletorDePeriodo";
import { reais } from "../vendas/PainelDeVendas";

/**
 * Gargalos: onde o dinheiro vaza, do anúncio até o pagamento.
 *
 * É a versão ao vivo da análise de 09/11/2026. A ordem é a de quem precisa
 * decidir: primeiro o mapa (o que está grave e quanto custa), depois o funil de
 * ponta a ponta, o pagamento, a plataforma contra a loja e a conta da margem.
 *
 * DESENHADA PARA O CELULAR PRIMEIRO, sem tabela. Toda barra desta tela é uma
 * TAXA (quanto passou da etapa anterior, ou quanto foi cancelado), nunca
 * largura decorativa, e todas as barras são da mesma cor. Vermelho, âmbar,
 * azul e verde são só de situação, e vêm com ícone e palavra.
 */

const BARRA = "#1f86b0";
const PERDA = "#b91c1c";
const SITUACAO: Record<Situacao, { nome: string; cor: string; Icone: LucideIcon }> = {
  grave: { nome: "Grave", cor: "#b91c1c", Icone: CircleAlert },
  medio: { nome: "Médio", cor: "#b45309", Icone: TriangleAlert },
  atencao: { nome: "Atenção", cor: "#1f86b0", Icone: Info },
  ok: { nome: "Indo bem", cor: "#047857", Icone: CircleCheck },
};

const inteiro = (n: number) => Math.round(n).toLocaleString("pt-BR");
const pct = (n: number) => `${(n * 100).toLocaleString("pt-BR", { maximumFractionDigits: n < 0.1 ? 1 : 0 })}%`;
const pct1 = (n: number) => `${(n * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

function Barra({ taxa, cor = BARRA }: { taxa: number; cor?: string }) {
  return (
    <span className="mt-1 block h-2 rounded-full bg-border/60" aria-hidden>
      <span className="block h-2 rounded-full" style={{ width: `${Math.min(Math.max(taxa * 100, 1), 100)}%`, background: cor }} />
    </span>
  );
}

function Numero({ rotulo, children, forte = false }: { rotulo: string; children: React.ReactNode; forte?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[0.66rem] leading-tight text-muted">{rotulo}</dt>
      <dd className={`numeros text-sm text-ink ${forte ? "font-semibold" : ""}`}>{children}</dd>
    </div>
  );
}

/** As etapas do funil, da entrada no site até o pedido pago na Tray. */
function Funil({ site, criados, pagos }: { site: Etapas | null; criados: number; pagos: number }) {
  const etapas: { nome: string; n: number; fonte: string }[] = [];
  if (site) {
    etapas.push(
      { nome: "Entraram na loja", n: site.entraram, fonte: "GA4" },
      { nome: "Viram um produto", n: site.viramProduto, fonte: "GA4" },
      { nome: "Puseram no carrinho", n: site.carrinho, fonte: "GA4" },
      { nome: "Começaram o pagamento", n: site.pagamento, fonte: "GA4" },
    );
  }
  etapas.push({ nome: "Fecharam pedido", n: criados, fonte: "Tray" }, { nome: "Pagaram", n: pagos, fonte: "Tray" });

  const taxas = etapas.map((e, i) => (i === 0 || etapas[i - 1].n <= 0 ? null : e.n / etapas[i - 1].n));
  // A maior perda é a menor passagem, entre as etapas com gente o bastante para contar.
  let pior = -1;
  taxas.forEach((t, i) => {
    if (t !== null && etapas[i - 1].n >= 30 && (pior < 0 || t < (taxas[pior] ?? 1))) pior = i;
  });

  return (
    <ol className="mt-3 divide-y divide-border/50">
      {etapas.map((e, i) => (
        <li key={e.nome} className="py-2.5">
          <p className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className={`text-sm text-ink ${i === pior ? "font-bold" : "font-semibold"}`}>
              {e.nome} <span className="text-[0.66rem] font-normal text-muted">{e.fonte}</span>
            </span>
            <span className="numeros text-sm text-ink">{inteiro(e.n)}</span>
          </p>
          {taxas[i] !== null ? (
            <>
              <p className="flex flex-wrap items-center gap-x-2 text-[0.72rem]" style={{ color: i === pior ? PERDA : "var(--color-muted)" }}>
                {i === pior ? <CircleAlert size={12} aria-hidden /> : null}
                <span className={i === pior ? "font-semibold" : ""}>
                  {pct(taxas[i]!)} da etapa anterior{i === pior ? ". É a maior perda do caminho" : ""}
                </span>
              </p>
              <Barra taxa={taxas[i]!} cor={i === pior ? PERDA : BARRA} />
            </>
          ) : (
            <p className="text-[0.72rem] text-muted">o começo do caminho</p>
          )}
        </li>
      ))}
    </ol>
  );
}

export function TelaDeGargalos({
  chave, de, ate, totais, faixas, meios, repetidos, site, plataformas, margem, empate, gargalos, vencedores, pessimos,
}: GargalosDaTela & { chave: ChaveDePeriodo }) {
  const problemas = gargalos.filter((g) => g.situacao !== "ok");
  const bons = gargalos.filter((g) => g.situacao === "ok");
  const ticket = totais && totais.pagos > 0 ? totais.valor_pago / totais.pagos : null;
  const maximoPorVenda = ticket !== null ? ticket * margem : null;
  const celular = site.funil?.celular;
  const computador = site.funil?.computador;

  return (
    <div data-painel-largo>
      <header>
        <p className="eyebrow">Diretoria</p>
        <h1 className="font-display mt-2 text-3xl text-ink sm:text-4xl">Gargalos</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted sm:text-base">
          Onde o dinheiro vaza, do anúncio até o pagamento, cruzando a loja, o GA4 e as plataformas de anúncio.
        </p>
      </header>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="font-display text-xl text-ink sm:text-2xl">De {diaCurto(de)} a {diaCurto(ate)}</p>
        <SeletorDePeriodo atual={chave} />
      </div>

      <section className="mt-5" aria-label="Mapa de gargalos">
        <p className="eyebrow">Mapa de gargalos, do que mais custa para o que menos custa</p>
        {problemas.length === 0 ? (
          <p className="glass mt-3 rounded-[16px] p-4 text-sm text-muted">Nenhum gargalo passou da régua neste período, com os dados que o painel tem.</p>
        ) : (
          <ul className="mt-3 grid gap-3 lg:grid-cols-2">
            {problemas.map((g) => {
              const s = SITUACAO[g.situacao];
              return (
                <li key={g.chave} className="glass rounded-[16px] border-l-4 p-4" style={{ borderLeftColor: s.cor }}>
                  <p className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <span className="text-[0.66rem] font-semibold uppercase tracking-wider text-muted">{g.sistema}</span>
                    <span className="inline-flex items-center gap-1 text-[0.68rem] font-bold uppercase tracking-wider" style={{ color: s.cor }}>
                      <s.Icone size={13} aria-hidden /> {s.nome}
                    </span>
                  </p>
                  <p className="mt-1.5 text-sm font-semibold leading-snug text-ink">{g.titulo}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted">{g.texto}</p>
                  {g.link ? (
                    <Link href={g.link.href} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-nav hover:underline">
                      {g.link.rotulo} <ArrowRight size={12} aria-hidden />
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        {bons.length > 0 ? (
          <ul className="mt-3 space-y-1.5">
            {bons.map((g) => (
              <li key={g.chave} className="flex items-start gap-1.5 text-xs text-ink">
                <CircleCheck size={14} className="mt-0.5 shrink-0" style={{ color: SITUACAO.ok.cor }} aria-hidden />
                <span><span className="font-semibold">Indo bem:</span> {g.titulo}.</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="glass mt-6 rounded-[18px] p-4 sm:p-5" aria-label="Funil de ponta a ponta">
        <p className="eyebrow">O caminho inteiro, da visita ao pagamento</p>
        {site.funil === null ? (
          <p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-ink">
            <TriangleAlert size={14} className="mt-0.5 shrink-0" style={{ color: SITUACAO.medio.cor }} aria-hidden />
            <span>O pedaço do site não veio do GA4: {site.problema} Abaixo fica só o que a Tray enxerga, do pedido para frente.</span>
          </p>
        ) : null}
        <Funil site={site.funil?.tudo ?? null} criados={totais?.pedidos ?? 0} pagos={totais?.pagos ?? 0} />
        {celular && computador && celular.viramProduto >= 100 && computador.viramProduto >= 100 ? (
          <p className="mt-3 text-xs leading-relaxed text-muted">
            Do produto para o carrinho: {pct(celular.carrinho / celular.viramProduto)} no celular e{" "}
            {pct(computador.carrinho / computador.viramProduto)} no computador.
          </p>
        ) : null}
        <p className="mt-2 max-w-3xl text-[0.7rem] leading-relaxed text-muted">
          As etapas do GA4 contam pessoas, e as da Tray contam pedidos: a passagem do GA4 para a Tray é aproximada. A barra
          de cada etapa mostra quanto da anterior passou para ela.
        </p>
      </section>

      {totais && totais.pedidos > 0 ? (
        <section className="glass mt-6 rounded-[18px] p-4 sm:p-5" aria-label="Pagamento">
          <p className="eyebrow">Pagamento: onde o pedido deixa de virar venda</p>

          <p className="mt-4 text-sm font-semibold text-ink">Por valor do pedido</p>
          <ul className="mt-1 divide-y divide-border/50">
            {faixas.map((f) => (
              <li key={f.faixa} className="py-2.5">
                <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                  <span className="font-semibold text-ink">{NOME_DA_FAIXA[f.faixa]}</span>
                  <span className="numeros text-ink">{pct(f.pedidos > 0 ? f.cancelados / f.pedidos : 0)} cancelados</span>
                </p>
                <Barra taxa={f.pedidos > 0 ? f.cancelados / f.pedidos : 0} />
                <p className="numeros mt-1 text-[0.72rem] text-muted">
                  {f.cancelados} de {f.pedidos} pedidos, {reais(f.valor_cancelado)} cancelados
                </p>
              </li>
            ))}
          </ul>

          <p className="mt-5 text-sm font-semibold text-ink">Por meio de pagamento</p>
          <ul className="mt-1 divide-y divide-border/50">
            {meios.filter((m) => m.pedidos >= 3).map((m) => (
              <li key={m.nome} className="py-2.5">
                <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                  <span className="font-semibold text-ink">{m.nome}</span>
                  <span className="numeros text-ink">{pct(m.cancelados / m.pedidos)} cancelados</span>
                </p>
                <Barra taxa={m.cancelados / m.pedidos} />
                <p className="numeros mt-1 text-[0.72rem] text-muted">{m.pagos} pagos de {m.pedidos} pedidos</p>
              </li>
            ))}
          </ul>

          {repetidos && repetidos.pedidos_a_mais > 0 ? (
            <p className="mt-4 max-w-3xl text-xs leading-relaxed text-muted">
              <span className="font-semibold text-ink">A mesma pessoa tenta de novo:</span> {repetidos.clientes} clientes fizeram
              outro pedido em menos de 72 horas, somando {repetidos.pedidos_a_mais} pedidos a mais. Por cliente, {totais.clientes}{" "}
              fecharam pedido e {totais.clientes_que_pagaram} pagaram.
            </p>
          ) : null}
        </section>
      ) : null}

      {plataformas.length > 0 ? (
        <section className="glass mt-6 rounded-[18px] p-4 sm:p-5" aria-label="A plataforma contra a loja">
          <p className="eyebrow">A plataforma contra a loja</p>
          <ul className="mt-2 divide-y divide-border/60">
            {plataformas.map((p) => (
              <li key={p.plataforma} className="py-3.5">
                <p className="text-sm font-semibold text-ink">{p.nome}</p>
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-4">
                  <Numero rotulo={p.gastoComImposto > p.gasto ? "Gasto, com o imposto da fatura" : "Gasto"}>{reais(p.gastoComImposto)}</Numero>
                  <Numero rotulo={`O ${p.nome} diz que vendeu`}>{reais(p.valorInformado)}</Numero>
                  <Numero rotulo="A loja recebeu, pago, com a etiqueta">{reais(p.valorPago)}</Numero>
                  <Numero rotulo="Cancelado com a etiqueta">{reais(p.valorCancelado)}</Numero>
                  <Numero rotulo="Venda paga por R$ 1 de anúncio" forte>{p.volta === null ? "·" : reais(p.volta)}</Numero>
                  <Numero rotulo="Para empatar, precisa de">{reais(empate)}</Numero>
                  <Numero rotulo="Custo por venda paga" forte>{p.custoPorVendaPaga === null ? "·" : reais(p.custoPorVendaPaga)}</Numero>
                  <Numero rotulo="Pedidos pagos e criados">{p.pagos} de {p.criados}</Numero>
                </dl>
              </li>
            ))}
          </ul>
          <p className="mt-2 max-w-3xl text-[0.7rem] leading-relaxed text-muted">
            A loja só enxerga o pedido que chegou com a etiqueta da plataforma, então a venda real é um pouco maior. O
            imposto de {pct1(IMPOSTO_DA_FATURA.meta)} do Meta e a margem de {pct(margem)} são premissas da análise de 09/11, não medidas.
          </p>
        </section>
      ) : null}

      {ticket !== null && maximoPorVenda !== null ? (
        <section className="glass mt-6 rounded-[18px] p-4 sm:p-5" aria-label="A conta da margem">
          <p className="eyebrow">Por que o anúncio fica caro: a conta da margem</p>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-4">
            <Numero rotulo="Ticket médio do pedido pago">{reais(ticket)}</Numero>
            <Numero rotulo={`Máximo por venda, com margem de ${pct(margem)}`} forte>{reais(maximoPorVenda)}</Numero>
            <Numero rotulo="O mesmo, no Gerenciador do Meta (sem imposto)" forte>{reais(maximoPorVenda / (1 + IMPOSTO_DA_FATURA.meta))}</Numero>
            {plataformas.filter((p) => p.custoPorVendaPaga !== null).map((p) => (
              <Numero key={p.plataforma} rotulo={`Custou cada venda paga do ${p.nome}`} forte>{reais(p.custoPorVendaPaga!)}</Numero>
            ))}
          </dl>
          <p className="mt-3 max-w-3xl text-[0.7rem] leading-relaxed text-muted">
            Com esse ticket e essa margem, é o que sobra por venda para pagar anúncio, frete grátis, cupom e taxa do cartão.
            A margem certa de cada peça entra quando a planilha de custos for preenchida em Margem.
          </p>
        </section>
      ) : null}

      {vencedores.length + pessimos.length > 0 ? (
        <section className="glass mt-6 rounded-[18px] p-4 sm:p-5" aria-label="Anúncios vencedores e péssimos">
          <p className="eyebrow">Anúncios: o que puxa para cima e o que puxa para baixo</p>
          <div className="mt-3 grid gap-5 md:grid-cols-2">
            {(
              [
                { titulo: "Vencedores", lista: vencedores, cor: SITUACAO.ok.cor, Icone: TrendingUp },
                { titulo: "Péssimos", lista: pessimos, cor: SITUACAO.grave.cor, Icone: CircleAlert },
              ] as const
            ).map((g) => (
              <div key={g.titulo} className="min-w-0">
                <p className="flex items-center gap-1.5 text-[0.68rem] font-bold uppercase tracking-wider" style={{ color: g.cor }}>
                  <g.Icone size={14} aria-hidden /> {g.titulo}
                </p>
                {g.lista.length === 0 ? (
                  <p className="mt-2 text-xs text-muted">Nada fora da média da conta no período.</p>
                ) : (
                  <ul className="mt-2 space-y-2.5">
                    {g.lista.map((a, n) => (
                      <li key={n} className="rounded-[12px] border-l-4 bg-white/50 p-3" style={{ borderLeftColor: g.cor }}>
                        <p className="text-[0.66rem] font-semibold uppercase tracking-wider text-muted">{a.plataforma}</p>
                        <p className="break-words text-sm font-semibold leading-snug text-ink">{a.nome || "Sem nome"}</p>
                        <p className="mt-1 text-xs leading-relaxed text-ink/85">{a.texto}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
          <Link href="/admin/trafego/campanhas" className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-brand-nav hover:underline">
            Ver todas as campanhas, conjuntos e anúncios <ArrowRight size={12} aria-hidden />
          </Link>
        </section>
      ) : null}
    </div>
  );
}
