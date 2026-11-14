import Link from "next/link";
import { CircleCheck, HandCoins, MessageCircle, PhoneCall, RotateCcw, Search } from "lucide-react";
import { SUBDOMINIO_KOMMO } from "@/lib/leads/chaves";
import { legivel } from "@/lib/leads/telefone";
import { canalDaOrigem, NOME_DO_CANAL, nomeLimpo } from "@/lib/vendas/origem";
import {
  JANELAS,
  MOTIVOS_DE_DESCARTE,
  type Caso,
  type Fase,
  type FilaDeRecuperacao,
  type Janela,
} from "@/lib/vendas/recuperacao";
import { Cartao, Dinheiro, haQuantoTempo, reais } from "../vendas/PainelDeVendas";
import { BotaoDeAcao } from "./BotaoDeAcao";

/**
 * A parte da fila de recuperação que só desenha. Sem `acao` (na prévia de
 * desenvolvimento) os botões de decisão não aparecem.
 *
 * A fila é ordenada por valor, do maior para o menor: quem trava no cartão em
 * compra alta é o caso que mais vale uma conversa, e é ele que tem que ficar
 * no topo, não o mais recente.
 */

type Acao = (formData: FormData) => Promise<void>;

/** O que travou, dito do jeito que o vendedor fala. */
function oQueTravou(c: Caso): string {
  const meio = (c.pagamento ?? "").toLowerCase();
  if (c.aguardando) return meio.startsWith("pix") ? "Pix gerado, ainda pode pagar" : "Esperando pagamento";
  if (meio.startsWith("cart")) return "Cartão não aprovado";
  if (meio.startsWith("pix")) return "Pix não pago";
  if (meio.startsWith("boleto")) return "Boleto não pago";
  return "Pedido não pago";
}

function Periodos({ atual }: { atual: Janela }) {
  return (
    <nav aria-label="Período" className="flex gap-1 rounded-full border border-border bg-surface/60 p-1">
      {JANELAS.map((d) => (
        <Link
          key={d}
          href={`?dias=${d}`}
          scroll={false}
          aria-current={d === atual ? "page" : undefined}
          className={
            d === atual
              ? "painel-aba-ativa rounded-full px-3.5 py-1.5 text-xs font-semibold"
              : "rounded-full px-3.5 py-1.5 text-xs font-semibold text-muted hover:text-ink"
          }
        >
          {d} dias
        </Link>
      ))}
    </nav>
  );
}

function Contatos({ c }: { c: Caso }) {
  const ligacao = "inline-flex items-center gap-1 text-xs font-semibold text-brand-nav hover:underline";
  if (!c.telefone) return <span className="text-xs text-muted">{c.email ?? "Sem telefone nem e-mail"}</span>;
  return (
    <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <span className="numeros text-xs text-ink">{legivel(c.telefone)}</span>
      <a href={`https://wa.me/${c.telefone}`} target="_blank" rel="noreferrer" className={ligacao}>
        <MessageCircle size={13} aria-hidden /> Abrir no WhatsApp
      </a>
      <a
        // Os oito últimos dígitos acham o contato em qualquer formato gravado na Kommo.
        href={`https://${SUBDOMINIO_KOMMO}.kommo.com/contacts/list/contacts/?term=${c.telefone.slice(-8)}`}
        target="_blank"
        rel="noreferrer"
        className={ligacao}
      >
        <Search size={13} aria-hidden /> Procurar na Kommo
      </a>
    </span>
  );
}

function Decisoes({ c, acao }: { c: Caso; acao: Acao }) {
  const campo = "max-w-full rounded-[8px] border border-border bg-white px-2.5 py-1.5 text-xs text-ink";
  return (
    <div className="mt-3 flex flex-wrap items-start gap-2 border-t border-border/60 pt-3">
      {c.fase === "a_recuperar" ? (
        <form action={acao}>
          <input type="hidden" name="pedido" value={c.pedido} />
          <input type="hidden" name="estado" value="em_contato" />
          <BotaoDeAcao forte>Estou falando com a pessoa</BotaoDeAcao>
        </form>
      ) : (
        <form action={acao}>
          <input type="hidden" name="pedido" value={c.pedido} />
          <input type="hidden" name="estado" value="a_recuperar" />
          <BotaoDeAcao>Voltar para a fila</BotaoDeAcao>
        </form>
      )}

      <details className="group">
        <summary className="inline-block cursor-pointer list-none rounded-full border border-ink/15 bg-white/60 px-3.5 py-1.5 text-xs font-semibold text-ink hover:border-brand/60 hover:text-brand-nav">
          Pagou por fora da loja
        </summary>
        <form action={acao} className="mt-2 flex flex-wrap items-center gap-2">
          <input type="hidden" name="pedido" value={c.pedido} />
          <input type="hidden" name="estado" value="pago_por_fora" />
          <input type="hidden" name="cliente" value={c.cliente ?? ""} />
          <input type="hidden" name="telefone" value={c.telefone ?? ""} />
          <input type="hidden" name="produto" value={c.itens ? c.itens.split(" + ").map(nomeLimpo).join(" + ").slice(0, 300) : ""} />
          <label className="sr-only" htmlFor={`forma-${c.pedido}`}>Como pagou</label>
          <select id={`forma-${c.pedido}`} name="forma" defaultValue="pix" className={campo}>
            <option value="pix">Pix</option>
            <option value="link_de_pagamento">Link de pagamento</option>
            <option value="cartao">Cartão</option>
            <option value="dinheiro">Dinheiro</option>
          </select>
          <label className="text-xs text-muted" htmlFor={`valor-${c.pedido}`}>Quanto entrou</label>
          <input
            id={`valor-${c.pedido}`}
            name="valor"
            required
            inputMode="decimal"
            placeholder="0,00"
            pattern="[0-9.,]+"
            className={`${campo} numeros w-28`}
          />
          <BotaoDeAcao forte>Registrar</BotaoDeAcao>
        </form>
      </details>

      <details className="group">
        <summary className="inline-block cursor-pointer list-none rounded-full border border-ink/15 bg-white/60 px-3.5 py-1.5 text-xs font-semibold text-ink hover:border-brand/60 hover:text-brand-nav">
          Tirar da fila
        </summary>
        <form action={acao} className="mt-2 flex flex-wrap items-center gap-2">
          <input type="hidden" name="pedido" value={c.pedido} />
          <input type="hidden" name="estado" value="descartado" />
          <label className="sr-only" htmlFor={`motivo-${c.pedido}`}>Motivo</label>
          <select id={`motivo-${c.pedido}`} name="nota" className={campo} defaultValue={MOTIVOS_DE_DESCARTE[0]}>
            {MOTIVOS_DE_DESCARTE.map((m) => <option key={m}>{m}</option>)}
          </select>
          <BotaoDeAcao>Tirar</BotaoDeAcao>
        </form>
      </details>
    </div>
  );
}

/** Quem está cuidando e há quanto tempo. Passou de um dia sem desfecho, fica vermelho. */
function EmContato({ c }: { c: Caso }) {
  const parado = Date.now() - Date.parse(c.estado_em as string) > 24 * 3_600_000;
  return (
    <span className="font-semibold" style={{ color: parado ? "#b91c1c" : "#047857" }}>
      {parado ? "Parado: " : ""}com {c.quem ?? "alguém da equipe"} {haQuantoTempo(c.estado_em as string)}
    </span>
  );
}

function CartaoDoCaso({ c, acao }: { c: Caso; acao?: Acao }) {
  const itens = c.itens ? c.itens.split(" + ").map(nomeLimpo).join(" + ") : null;
  return (
    <li className="glass rounded-[16px] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{c.cliente ?? "Sem nome"}</p>
          <p className="mt-0.5 text-xs text-muted">
            {[[c.cidade, c.uf].filter(Boolean).join(", "), `pedido ${c.pedido}`].filter(Boolean).join(" · ")}
          </p>
        </div>
        <p className="font-display numeros text-2xl leading-none text-ink">{reais(Number(c.maior_valor))}</p>
      </div>

      {itens ? <p className="mt-2 truncate text-xs text-ink/80" title={itens}>{itens}</p> : null}

      <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
        <span className="font-semibold text-ink">{oQueTravou(c)}</span>
        <span>{c.tentativas > 1 ? `${c.tentativas} tentativas` : "1 tentativa"}</span>
        <span>última {haQuantoTempo(c.ultima)}</span>
        <span>veio de: {NOME_DO_CANAL[canalDaOrigem(c.origem)]}</span>
        {c.fase === "em_contato" && c.estado_em ? <EmContato c={c} /> : null}
      </p>

      <div className="mt-2">
        <Contatos c={c} />
      </div>

      {acao ? <Decisoes c={c} acao={acao} /> : null}
    </li>
  );
}

function ListaDeCasos({ casos, acao, visiveis = 20 }: { casos: Caso[]; acao?: Acao; visiveis?: number }) {
  const primeiros = casos.slice(0, visiveis);
  const resto = casos.slice(visiveis);
  return (
    <>
      <ul className="mt-4 space-y-3">
        {primeiros.map((c) => <CartaoDoCaso key={c.pedido} c={c} acao={acao} />)}
      </ul>
      {resto.length > 0 ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-semibold text-brand-nav hover:underline">
            Ver os outros {resto.length}, de valor menor
          </summary>
          <ul className="mt-3 space-y-3">
            {resto.map((c) => <CartaoDoCaso key={c.pedido} c={c} acao={acao} />)}
          </ul>
        </details>
      ) : null}
    </>
  );
}

const FECHADOS: { fase: Fase; titulo: string; valor: (c: Caso) => string }[] = [
  { fase: "recuperado", titulo: "Voltaram e pagaram na loja", valor: (c) => `pagou ${reais(Number(c.pago_valor ?? 0))} no pedido ${c.pago_pedido}` },
  { fase: "pago_por_fora", titulo: "Pagaram por fora da loja", valor: (c) => `entrou ${reais(Number(c.valor_fora ?? 0))}${c.quem ? `, com ${c.quem}` : ""}` },
  { fase: "descartado", titulo: "Tirados da fila", valor: (c) => c.nota ?? "sem motivo" },
];

function Fechados({ casos, acao }: { casos: Caso[]; acao?: Acao }) {
  return (
    <>
      {FECHADOS.map(({ fase, titulo, valor }) => {
        const lista = casos.filter((c) => c.fase === fase);
        if (lista.length === 0) return null;
        return (
          <details key={fase} className="glass mt-4 rounded-[16px] p-4 sm:p-5">
            <summary className="cursor-pointer text-sm font-semibold text-ink">
              {titulo} <span className="numeros font-normal text-muted">({lista.length})</span>
            </summary>
            <ul className="mt-3 divide-y divide-border/60">
              {lista.map((c) => (
                <li key={c.pedido} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5">
                  <span className="min-w-0 text-sm text-ink">
                    {c.cliente ?? "Sem nome"}
                    <span className="block text-xs text-muted">
                      tentou {reais(Number(c.maior_valor))}, {valor(c)}
                    </span>
                  </span>
                  {acao && fase === "descartado" ? (
                    <form action={acao}>
                      <input type="hidden" name="pedido" value={c.pedido} />
                      <input type="hidden" name="estado" value="a_recuperar" />
                      <BotaoDeAcao>Voltar para a fila</BotaoDeAcao>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          </details>
        );
      })}
    </>
  );
}

export function PainelDeRecuperacao({
  fila, janela, acao,
}: {
  fila: FilaDeRecuperacao | null;
  janela: Janela;
  acao?: Acao;
}) {
  const r = fila?.resumo ?? {};
  const n = (fase: Fase) => r[fase]?.clientes ?? 0;
  const v = (fase: Fase) => Number(r[fase]?.valor ?? 0);
  const pessoas = (q: number) => `${q} ${q === 1 ? "cliente" : "clientes"}`;
  const paraChamar = (fila?.casos ?? []).filter((c) => c.fase === "a_recuperar");
  const emContato = (fila?.casos ?? []).filter((c) => c.fase === "em_contato");
  const total = (fila?.casos ?? []).length;
  const voltaram = n("recuperado") + n("pago_por_fora");

  return (
    <div data-painel-largo>
      <header>
        <p className="eyebrow">Vendas</p>
        <h1 className="font-display mt-2 text-4xl text-ink">Recuperação</h1>
        <p className="mt-3 max-w-3xl text-muted">
          Quem criou pedido na loja, não pagou e não voltou, do maior valor para o menor. A pessoa sai da lista
          sozinha quando paga um pedido novo. A lista acompanha os pedidos trazidos da Tray, de hora em hora, das 8h às 23h.
        </p>
      </header>

      {fila === null ? (
        <p className="glass mt-8 rounded-[18px] p-6 text-sm text-muted">
          <span className="font-semibold text-ink">Não deu para ler a fila agora.</span> Recarregue a página em alguns
          segundos. Se continuar, avise quem cuida do painel.
        </p>
      ) : (
        <>
          <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="eyebrow">Pedidos não pagos</p>
              <h2 className="font-display mt-1 text-2xl text-ink">Últimos {fila.dias} dias</h2>
            </div>
            <Periodos atual={janela} />
          </div>

          <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <Cartao
              Icone={PhoneCall}
              rotulo="Para chamar"
              tom={n("a_recuperar") > 0 ? "atencao" : "neutro"}
              aviso="Ninguém chamou ainda"
              apoio={`${pessoas(n("a_recuperar"))} sem ninguém falando`}
            >
              <Dinheiro valor={v("a_recuperar")} />
            </Cartao>
            <Cartao Icone={MessageCircle} rotulo="Em contato" apoio={pessoas(n("em_contato"))}>
              <Dinheiro valor={v("em_contato")} />
            </Cartao>
            <Cartao
              Icone={CircleCheck}
              rotulo="Voltaram e pagaram"
              tom={v("recuperado") > 0 ? "bom" : "neutro"}
              aviso="Recuperado"
              apoio={`${pessoas(n("recuperado"))}, em pedido novo na loja`}
            >
              <Dinheiro valor={v("recuperado")} />
            </Cartao>
            <Cartao
              Icone={HandCoins}
              rotulo="Pagaram por fora"
              tom={v("pago_por_fora") > 0 ? "bom" : "neutro"}
              aviso="Recuperado por fora"
              apoio={`${pessoas(n("pago_por_fora"))}, com venda registrada`}
            >
              <Dinheiro valor={v("pago_por_fora")} />
            </Cartao>
          </div>

          {total > 0 ? (
            <p className="mt-3 text-xs text-muted">
              De {pessoas(total)} que não pagaram no período, {voltaram} {voltaram === 1 ? "voltou" : "voltaram"} (
              {Math.round((voltaram / total) * 100)}%).
            </p>
          ) : null}

          <section className="mt-10" aria-labelledby="para-chamar">
            <h2 id="para-chamar" className="font-display flex items-center gap-2 text-2xl text-ink">
              <RotateCcw size={18} className="text-brand-nav" aria-hidden /> Para chamar
            </h2>
            <p className="mt-1 max-w-3xl text-xs text-muted">
              O atendimento é feito pela Kommo. Ache o contato pelo telefone, converse e marque aqui o que aconteceu.
              Cartão não aprovado em compra alta costuma se resolver com Pix ou com o valor dividido em dois cartões.
            </p>
            {paraChamar.length > 0 ? (
              <ListaDeCasos casos={paraChamar} acao={acao} />
            ) : (
              <p className="glass mt-4 rounded-[16px] p-5 text-sm text-muted">Ninguém na fila neste período.</p>
            )}
          </section>

          {emContato.length > 0 ? (
            <section className="mt-10" aria-labelledby="em-contato">
              <h2 id="em-contato" className="font-display text-2xl text-ink">Em contato</h2>
              <ListaDeCasos casos={emContato} acao={acao} visiveis={50} />
            </section>
          ) : null}

          <section className="mt-10" aria-label="Casos encerrados">
            <Fechados casos={fila.casos} acao={acao} />
          </section>
        </>
      )}
    </div>
  );
}
