import Link from "next/link";
import { ArrowUpRight, Banknote, CalendarDays, CircleSlash, HandCoins, Receipt, ShoppingBag, Sun, Sunrise } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  DIA_ZERADO,
  type Dia,
  type PedidoRecente,
  type ProdutoVendido,
  type ResumoDeVendas,
  type UltimaImportacao,
  type VendasDaTela,
} from "@/lib/vendas/dados";
import { agruparPorCanal, canalDaOrigem, NOME_DO_CANAL, nomeLimpo } from "@/lib/vendas/origem";
import {
  PERIODOS,
  diaCurto,
  diasEntre,
  intervaloDoPeriodo,
  nomeDoMes,
  primeiroDoMes,
  somarDias,
  type ChaveDePeriodo,
} from "@/lib/vendas/periodo";
import { SeletorDePeriodo } from "../SeletorDePeriodo";
import { Barras, type Barra } from "./Barras";

/**
 * A parte da tela de vendas que só desenha. Fica separada da leitura para
 * poder ser vista sem sessão durante o desenvolvimento e para o mesmo desenho
 * servir a outra fonte quando a API da Tray chegar.
 */

export const reais = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const inteiro = (n: number) => n.toLocaleString("pt-BR");
const DIAS_DA_SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const diaDaSemana = (dia: string) => DIAS_DA_SEMANA[new Date(`${dia}T12:00:00Z`).getUTCDay()];

export function haQuantoTempo(iso: string): string {
  const min = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (min < 2) return "agora há pouco";
  if (min < 60) return `há ${min} minutos`;
  const h = Math.round(min / 60);
  if (h < 24) return h === 1 ? "há 1 hora" : `há ${h} horas`;
  const d = Math.round(h / 24);
  return d === 1 ? "há 1 dia" : `há ${d} dias`;
}

function variacao(agora: number, antes: number, comparacao: string): string {
  if (!antes) return "sem venda no período de comparação";
  const pct = ((agora - antes) / antes) * 100;
  return `${pct > 0 ? "+" : ""}${pct.toFixed(0)}% ${comparacao}`;
}

/** Número de dinheiro com os centavos menores, para o valor caber no cartão. */
export function Dinheiro({ valor }: { valor: number }) {
  const [inteiros, centavos] = reais(valor).split(",");
  return (
    <span className="numeros">
      {inteiros}
      <span className="text-[0.55em] text-muted">,{centavos}</span>
    </span>
  );
}

export function Cartao({
  Icone, rotulo, children, apoio,
}: {
  Icone: LucideIcon;
  rotulo: string;
  children: React.ReactNode;
  apoio: string;
}) {
  return (
    // No celular os cartões andam de dois em dois: some o ícone, o rótulo pode
    // quebrar linha (cortado com reticências ele não dizia o que era o número)
    // e o valor encolhe para caber em meia tela.
    <div className="glass min-w-0 rounded-[16px] p-3.5 sm:rounded-[18px] sm:p-5">
      <div className="flex items-center gap-2">
        <span className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-[8px] border border-brand/30 bg-brand/10 text-brand-nav sm:flex">
          <Icone size={14} aria-hidden />
        </span>
        <p className="eyebrow min-w-0 break-words text-[0.6rem] leading-snug sm:truncate sm:text-[0.62rem]">{rotulo}</p>
      </div>
      <p className="font-display mt-2 text-[clamp(1.2rem,5.4vw,1.6rem)] leading-tight text-ink sm:mt-3 sm:text-[clamp(1.6rem,2.6vw,2.25rem)]">{children}</p>
      <p className="mt-1 text-[0.7rem] leading-snug text-muted sm:text-xs">{apoio}</p>
    </div>
  );
}

function pedidosEticket(pagos: number, valor: number): string {
  if (!pagos) return "nenhum pedido pago";
  return `${inteiro(pagos)} ${pagos === 1 ? "pedido pago" : "pedidos pagos"}, ticket de ${reais(valor / pagos)}`;
}


function Atualizacao({ ultima }: { ultima: UltimaImportacao }) {
  if (!ultima) {
    return (
      <p className="mt-4 rounded-[12px] border border-brand/40 bg-brand/10 px-4 py-3 text-sm text-ink">
        Os pedidos ainda não foram trazidos da Tray. O passo a passo está em{" "}
        <code className="text-brand-strong">docs/tray-exportar-pedidos.md</code>.
      </p>
    );
  }
  const horas = (Date.now() - Date.parse(ultima.quando)) / 3_600_000;
  // A rotina roda de hora em hora, das 8h às 23h: o maior vão normal é o da madrugada, de 9 horas.
  const atrasado = horas > 12;
  if (!atrasado && ultima.ok) {
    return <p className="mt-2 text-xs text-muted">Pedidos trazidos da Tray {haQuantoTempo(ultima.quando)}.</p>;
  }
  return (
    <p className="mt-4 rounded-[12px] border border-brand/40 bg-brand/10 px-4 py-3 text-sm text-ink">
      {ultima.ok
        ? `A última leitura da Tray foi ${haQuantoTempo(ultima.quando)}. Os números abaixo podem estar atrasados.`
        : `A última leitura da Tray, ${haQuantoTempo(ultima.quando)}, deu erro: ${ultima.erro ?? "sem detalhe"}.`}{" "}
      A rotina roda de hora em hora, das 8h às 23h, com o computador ligado e a Tray aberta no Chrome.
    </p>
  );
}

function TabelaDeDias({ dias }: { dias: Dia[] }) {
  return (
    <details className="mt-4">
      <summary className="cursor-pointer text-xs font-semibold text-brand-nav hover:underline">Ver em tabela</summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[34rem] border-collapse">
          <thead>
            <tr className="border-b border-border text-left text-[0.68rem] uppercase tracking-wider text-muted">
              <th scope="col" className="py-2 pr-4 font-semibold">Dia</th>
              <th scope="col" className="py-2 pr-4 text-right font-semibold">Pagos</th>
              <th scope="col" className="py-2 pr-4 text-right font-semibold">Faturamento</th>
              <th scope="col" className="py-2 pr-4 text-right font-semibold">Aguardando</th>
              <th scope="col" className="py-2 text-right font-semibold">Cancelados</th>
            </tr>
          </thead>
          <tbody>
            {[...dias].reverse().map((d) => (
              <tr key={d.dia} className="border-b border-border/50 last:border-0">
                <td className="py-2 pr-4 text-sm text-ink">
                  {diaCurto(d.dia)} <span className="text-xs text-muted">{diaDaSemana(d.dia)}</span>
                </td>
                <td className="numeros py-2 pr-4 text-right text-sm text-ink">{inteiro(d.pagos)}</td>
                <td className="numeros py-2 pr-4 text-right text-sm text-ink">{reais(d.valor_pago)}</td>
                <td className="numeros py-2 pr-4 text-right text-sm text-muted">
                  {d.aguardando ? `${d.aguardando} (${reais(d.valor_aguardando)})` : "·"}
                </td>
                <td className="numeros py-2 text-right text-sm text-muted">
                  {d.cancelados ? `${d.cancelados} (${reais(d.valor_cancelado)})` : "·"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function ListaComBarra({
  linhas, total,
}: {
  linhas: { chave: string; nome: string; direita: string; valor: number; apoio?: string }[];
  total: number;
}) {
  return (
    <ul className="mt-4 space-y-3">
      {linhas.map((l) => {
        const pct = total ? (l.valor / total) * 100 : 0;
        return (
          <li key={l.chave}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-ink">{l.nome}</span>
              <span className="numeros shrink-0 text-xs text-muted">{l.direita}</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-border/60">
              <div className="h-1.5 rounded-full bg-brand" style={{ width: `${Math.max(pct, l.valor > 0 ? 0.5 : 0)}%` }} />
            </div>
            {l.apoio ? <p className="mt-1 text-[0.7rem] text-muted">{l.apoio}</p> : null}
          </li>
        );
      })}
    </ul>
  );
}

function LinhaDeProduto({ p }: { p: ProdutoVendido }) {
  const nome = nomeLimpo(p.nome);
  return (
    <tr className="border-b border-border/50 last:border-0">
      <td className="max-w-[26rem] py-2.5 pr-4">
        {p.url ? (
          <a href={p.url} target="_blank" rel="noreferrer" className="block truncate text-sm text-ink hover:text-brand-nav hover:underline" title={nome}>
            {nome}
          </a>
        ) : (
          <span className="block truncate text-sm text-ink" title={nome}>{nome}</span>
        )}
      </td>
      <td className="numeros py-2.5 pr-4 text-right text-sm text-ink">{inteiro(Number(p.quantidade))}</td>
      <td className="numeros py-2.5 pr-4 text-right text-sm text-muted">{inteiro(p.pedidos)}</td>
      <td className="numeros py-2.5 text-right text-sm text-ink">{Number(p.valor) > 0 ? reais(Number(p.valor)) : "brinde"}</td>
    </tr>
  );
}

const SELO: Record<PedidoRecente["situacao"], { nome: string; classe: string }> = {
  pago: { nome: "Pago", classe: "bg-emerald-100 text-emerald-800" },
  aguardando: { nome: "Aguardando", classe: "bg-brand/15 text-brand-strong" },
  cancelado: { nome: "Cancelado", classe: "bg-border/70 text-muted" },
};

function LinhaDePedido({ p }: { p: PedidoRecente }) {
  const quando = new Date(p.feito_em).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
  const selo = SELO[p.situacao];
  const itens = p.itens ? p.itens.split(" + ").map(nomeLimpo).join(" + ") : null;
  return (
    <tr className="border-b border-border/50 align-top last:border-0">
      <td className="numeros py-2.5 pr-4 text-sm text-ink">
        {p.pedido}
        <span className="block text-xs text-muted">{quando}</span>
      </td>
      <td className="max-w-[22rem] py-2.5 pr-4">
        <span className="block truncate text-sm text-ink">{p.cliente ?? "Sem nome"}</span>
        <span className="block truncate text-xs text-muted" title={itens ?? undefined}>
          {itens ?? [p.cidade, p.uf].filter(Boolean).join(", ")}
        </span>
      </td>
      <td className="py-2.5 pr-4 text-xs text-muted">
        {NOME_DO_CANAL[canalDaOrigem(p.origem)]}
        <span className="block">{(p.pagamento ?? "").replace(/\s*-\s*Appmax$/i, "")}</span>
      </td>
      <td className="numeros py-2.5 pr-4 text-right text-sm text-ink">{reais(Number(p.total))}</td>
      <td className="py-2.5 text-right">
        <span className={`inline-block rounded-full px-2 py-0.5 text-[0.68rem] font-semibold ${selo.classe}`} title={p.status}>
          {selo.nome}
        </span>
      </td>
    </tr>
  );
}

function TabelaDePedidos({ pedidos }: { pedidos: PedidoRecente[] }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[42rem] border-collapse">
        <thead>
          <tr className="border-b border-border text-left text-[0.68rem] uppercase tracking-wider text-muted">
            <th scope="col" className="py-2 pr-4 font-semibold">Pedido</th>
            <th scope="col" className="py-2 pr-4 font-semibold">Cliente e itens</th>
            <th scope="col" className="py-2 pr-4 font-semibold">Origem</th>
            <th scope="col" className="py-2 pr-4 text-right font-semibold">Total</th>
            <th scope="col" className="py-2 text-right font-semibold">Situação</th>
          </tr>
        </thead>
        <tbody>
          {pedidos.map((p) => <LinhaDePedido key={p.pedido} p={p} />)}
        </tbody>
      </table>
    </div>
  );
}

function Periodo({
  resumo, anterior, de, ate, comparacao,
}: {
  resumo: ResumoDeVendas;
  anterior: ResumoDeVendas | null;
  de: string;
  ate: string;
  comparacao: string;
}) {
  const t = resumo.totais;
  const criados = t.pagos + t.aguardando + t.cancelados;
  const porDia = new Map(resumo.por_dia.map((d) => [d.dia, d]));
  const dias = diasEntre(de, ate).map((d) => porDia.get(d) ?? DIA_ZERADO(d));
  const maiorDia = dias.reduce((m, d) => (Number(d.valor_pago) > Number(m.valor_pago) ? d : m), dias[0]);

  const barrasDeDia: Barra[] = dias.map((d) => ({
    chave: d.dia,
    eixo: d.dia.slice(8, 10),
    valor: Number(d.valor_pago),
    titulo: `${diaCurto(d.dia)}, ${diaDaSemana(d.dia)}`,
    detalhe: d.pagos ? `${reais(Number(d.valor_pago))} em ${d.pagos} ${d.pagos === 1 ? "pedido" : "pedidos"}` : "sem venda paga",
  }));

  const porHora = new Map(resumo.por_hora.map((h) => [h.hora, h]));
  const barrasDeHora: Barra[] = Array.from({ length: 24 }, (_, hora) => {
    const h = porHora.get(hora);
    return {
      chave: String(hora),
      eixo: hora % 3 === 0 ? `${hora}h` : "",
      valor: h?.pagos ?? 0,
      titulo: `das ${hora}h às ${hora + 1}h`,
      detalhe: h ? `${h.pagos} ${h.pagos === 1 ? "pedido" : "pedidos"}, ${reais(Number(h.valor))}` : "nenhum pedido",
    };
  });
  const pico = barrasDeHora.reduce((m, b) => (b.valor > m.valor ? b : m), barrasDeHora[0]);

  const canais = agruparPorCanal(resumo.por_origem);
  const produtos = resumo.produtos;

  return (
    <>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-4">
        <Cartao Icone={Banknote} rotulo="Faturamento pago" apoio={variacao(Number(t.valor_pago), Number(anterior?.totais.valor_pago ?? 0), comparacao)}>
          <Dinheiro valor={Number(t.valor_pago)} />
        </Cartao>
        <Cartao Icone={ShoppingBag} rotulo="Pedidos pagos" apoio={variacao(t.pagos, anterior?.totais.pagos ?? 0, comparacao)}>
          <span className="numeros">{inteiro(t.pagos)}</span>
        </Cartao>
        <Cartao Icone={Receipt} rotulo="Ticket médio" apoio={`${inteiro(t.clientes)} ${t.clientes === 1 ? "cliente" : "clientes"} no período`}>
          <Dinheiro valor={t.pagos ? Number(t.valor_pago) / t.pagos : 0} />
        </Cartao>
        <Cartao
          Icone={CircleSlash}
          rotulo="Cancelados"
          apoio={criados ? `${inteiro(t.cancelados)} de ${inteiro(criados)} pedidos criados, ${reais(Number(t.valor_cancelado))}` : "nenhum pedido criado"}
        >
          <span className="numeros">{criados ? `${Math.round((t.cancelados / criados) * 100)}%` : "0%"}</span>
        </Cartao>
      </div>

      <div className="glass mt-6 rounded-[18px] p-5">
        <p className="eyebrow">Faturamento pago por dia</p>
        <p className="mt-1 text-xs text-muted">
          {Number(maiorDia.valor_pago) > 0
            ? `Melhor dia: ${diaCurto(maiorDia.dia)}, ${diaDaSemana(maiorDia.dia)}, com ${reais(Number(maiorDia.valor_pago))}.`
            : "Nenhuma venda paga no período."}
        </p>
        <Barras barras={barrasDeDia} topo={reais(Number(maiorDia.valor_pago))} descricao="Faturamento pago em cada dia do período" />
        <TabelaDeDias dias={dias} />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <div className="glass rounded-[18px] p-5">
          <p className="eyebrow">De onde vieram as vendas</p>
          <p className="mt-1 text-xs text-muted">
            Pela etiqueta que a Tray grava no pedido. Busca do Google e acesso direto chegam sem etiqueta.
          </p>
          {canais.length > 0 ? (
            <ListaComBarra
              total={Number(t.valor_pago)}
              linhas={canais.map((c) => ({
                chave: c.canal,
                nome: c.nome,
                valor: c.valor,
                direita: `${reais(c.valor)} · ${inteiro(c.pagos)} ${c.pagos === 1 ? "pago" : "pagos"}`,
              }))}
            />
          ) : (
            <p className="mt-4 text-sm text-muted">Nenhum pedido no período.</p>
          )}
        </div>

        <div className="glass rounded-[18px] p-5">
          <p className="eyebrow">Forma de pagamento</p>
          <p className="mt-1 text-xs text-muted">Quanto cada meio faturou e quanto dos pedidos criados nele foi cancelado.</p>
          {resumo.por_pagamento.length > 0 ? (
            <ListaComBarra
              total={Number(t.valor_pago)}
              linhas={resumo.por_pagamento.map((f) => ({
                chave: f.tipo,
                nome: f.tipo.replace(/\s*-\s*Appmax$/i, ""),
                valor: Number(f.valor),
                direita: `${reais(Number(f.valor))} · ${inteiro(f.pagos)} ${f.pagos === 1 ? "pago" : "pagos"}`,
                apoio: f.criados
                  ? `${inteiro(f.cancelados)} de ${inteiro(f.criados)} cancelados (${Math.round((f.cancelados / f.criados) * 100)}%)`
                  : undefined,
              }))}
            />
          ) : (
            <p className="mt-4 text-sm text-muted">Nenhum pedido no período.</p>
          )}
        </div>
      </div>

      <div className="glass mt-6 rounded-[18px] p-5">
        <p className="eyebrow">Horário dos pedidos pagos</p>
        <p className="mt-1 text-xs text-muted">
          {pico.valor > 0 ? `A hora mais forte foi ${pico.titulo}, com ${pico.valor} ${pico.valor === 1 ? "pedido" : "pedidos"}.` : "Nenhum pedido pago no período."}{" "}
          Hora em que a pessoa fechou o pedido no site.
        </p>
        <Barras barras={barrasDeHora} topo={`${pico.valor} ${pico.valor === 1 ? "pedido" : "pedidos"}`} descricao="Pedidos pagos por hora do dia" />
      </div>

      <div className="glass mt-6 rounded-[18px] p-5">
        <p className="eyebrow">Produtos que mais faturaram</p>
        <p className="mt-1 text-xs text-muted">
          Só pedidos pagos.
          {t.com_itens < t.pagos
            ? ` A lista de produtos existe em ${inteiro(t.com_itens)} dos ${inteiro(t.pagos)} pedidos do período: os anteriores a 14/10 foram importados sem ela.`
            : ""}
        </p>
        {produtos.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[34rem] border-collapse">
              <thead>
                <tr className="border-b border-border text-left text-[0.68rem] uppercase tracking-wider text-muted">
                  <th scope="col" className="py-2 pr-4 font-semibold">Produto</th>
                  <th scope="col" className="py-2 pr-4 text-right font-semibold">Unidades</th>
                  <th scope="col" className="py-2 pr-4 text-right font-semibold">Pedidos</th>
                  <th scope="col" className="py-2 text-right font-semibold">Faturamento</th>
                </tr>
              </thead>
              <tbody>
                {produtos.map((p) => <LinhaDeProduto key={p.produto_tray_id ?? p.nome} p={p} />)}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted">Sem lista de produtos para o período.</p>
        )}
      </div>

      <div className="glass mt-6 rounded-[18px] p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow">Últimos pedidos do período</p>
            <p className="mt-1 text-xs text-muted">Os {resumo.pedidos.length} mais recentes, pagos ou não.</p>
          </div>
          <a
            href="https://www.jkaliancas.com.br/admin/sales/orders"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold text-brand-nav hover:underline"
          >
            Abrir na Tray <ArrowUpRight size={13} aria-hidden />
          </a>
        </div>
        {resumo.pedidos.length > 0 ? (
          <>
            <TabelaDePedidos pedidos={resumo.pedidos.slice(0, 12)} />
            {resumo.pedidos.length > 12 ? (
              <details className="mt-3">
                <summary className="cursor-pointer text-xs font-semibold text-brand-nav hover:underline">
                  Ver os outros {resumo.pedidos.length - 12}
                </summary>
                <TabelaDePedidos pedidos={resumo.pedidos.slice(12)} />
              </details>
            ) : null}
          </>
        ) : (
          <p className="mt-4 text-sm text-muted">Nenhum pedido no período.</p>
        )}
      </div>
    </>
  );
}

export function PainelDeVendas({
  chave, hoje, topo, resumo, anterior, ultima, porFora,
}: VendasDaTela & { chave: ChaveDePeriodo; hoje: string }) {
  const ontem = somarDias(hoje, -1);
  const inicioDoMes = primeiroDoMes(hoje);
  const intervalo = intervaloDoPeriodo(chave, hoje);

  const doDia = (dia: string) => topo?.por_dia.find((d) => d.dia === dia) ?? DIA_ZERADO(dia);
  const dHoje = doDia(hoje);
  const dOntem = doDia(ontem);
  const doMes = (topo?.por_dia ?? []).filter((d) => d.dia >= inicioDoMes);
  const mes = {
    pagos: doMes.reduce((s, d) => s + d.pagos, 0),
    valor: doMes.reduce((s, d) => s + Number(d.valor_pago), 0),
  };

  return (
    <div data-painel-largo>
      <header>
        <p className="eyebrow">Loja</p>
        <h1 className="font-display mt-2 text-4xl text-ink">Vendas</h1>
        <p className="mt-3 max-w-3xl text-muted">
          Pedidos pagos na loja virtual, lidos da Tray. Pedido cancelado ou esperando pagamento não entra no
          faturamento. O que é fechado por fora da loja entra por{" "}
          <Link href="/admin/registrar-venda" className="font-semibold text-brand-nav hover:underline">Registrar venda</Link>{" "}
          e aparece no último cartão.
        </p>
        <Atualizacao ultima={ultima} />
      </header>

      {topo === null || resumo === null ? (
        <p className="glass mt-8 rounded-[18px] p-6 text-sm text-muted">
          <span className="font-semibold text-ink">Não deu para ler as vendas agora.</span> Recarregue a página em
          alguns segundos. Se continuar, o banco está fora do ar ou a migration 0053 não foi aplicada.
        </p>
      ) : (
        <>
          <section className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4" aria-label="Hoje, ontem e o mês">
            <Cartao
              Icone={Sun}
              rotulo={`Hoje, ${diaCurto(hoje)}`}
              apoio={
                pedidosEticket(dHoje.pagos, Number(dHoje.valor_pago)) +
                (dHoje.aguardando ? `. Aguardando pagamento: ${reais(Number(dHoje.valor_aguardando))}` : "")
              }
            >
              <Dinheiro valor={Number(dHoje.valor_pago)} />
            </Cartao>
            <Cartao Icone={Sunrise} rotulo={`Ontem, ${diaCurto(ontem)}`} apoio={pedidosEticket(dOntem.pagos, Number(dOntem.valor_pago))}>
              <Dinheiro valor={Number(dOntem.valor_pago)} />
            </Cartao>
            <Cartao Icone={CalendarDays} rotulo={`${nomeDoMes(hoje)} na loja`} apoio={pedidosEticket(mes.pagos, mes.valor)}>
              <Dinheiro valor={mes.valor} />
            </Cartao>
            <Cartao
              Icone={HandCoins}
              rotulo={`${nomeDoMes(hoje)} por fora`}
              apoio={
                porFora
                  ? `${porFora.vendas} ${porFora.vendas === 1 ? "venda registrada" : "vendas registradas"}. Com a loja: ${reais(mes.valor + porFora.valor)}`
                  : "não deu para ler agora"
              }
            >
              <Dinheiro valor={porFora?.valor ?? 0} />
            </Cartao>
          </section>

          <section className="mt-10">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="min-w-0">
                <p className="eyebrow">No período</p>
                <h2 className="font-display mt-1 text-2xl text-ink">
                  De {diaCurto(intervalo.de)} a {diaCurto(intervalo.ate)}
                </h2>
              </div>
              <SeletorDePeriodo atual={chave} />
            </div>
            <Periodo resumo={resumo} anterior={anterior} de={intervalo.de} ate={intervalo.ate} comparacao={intervalo.comparacao} />
          </section>
        </>
      )}
    </div>
  );
}
