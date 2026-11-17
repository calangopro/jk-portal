"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRightLeft, BadgeCheck, Bot, CircleUserRound, Contact, Hammer, HandCoins, LifeBuoy, Loader2, MessageCircle, MessagesSquare, MousePointerClick,
  PackageCheck, RotateCcw, ShoppingBag, Store, TriangleAlert, Truck, UserCheck, type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { COR_DO_TOM } from "@/lib/painel/tons";
import {
  lerHistorico, nomeDaEtapa, pessoasDoPedido, quemEmPalavra, textoDoEvento, type EventoDoPedido, type HistoricoDoPedido, type LeituraDoHistorico,
} from "@/lib/pedidos/historico";
import { linkDoWhatsapp, telefoneLegivel } from "@/lib/suporte/casos";
import { diaCurto, diaDe, horaCurta, rotuloDoDia, textoLimpo } from "@/lib/time/chat";
import { NOME_DO_CANAL, canalDaOrigem, nomeLimpo, type Canal } from "@/lib/vendas/origem";
import { SeloDeTom } from "../Pecas";
import { botaoCheio, botaoClaro } from "../biblioteca/pecas";
import { CascaDoHistorico } from "./Casca";
import { OrigemDoPedido } from "./Origem";
import { avisarQueOPedidoMudou, fecharHistoricoDoPedido } from "./abrir";

/**
 * A gaveta do histórico do pedido. Tudo vem de UMA função do banco
 * (`historico_do_pedido`, 0103), chamada do navegador com a sessão da
 * pessoa: ela junta o que já está gravado em cada lugar e corta o que a
 * pessoa não pode ver (telefone para a fábrica, valor para quem não é de
 * vendas). Ninguém escreve log à mão; a única coisa que se marca aqui é quem
 * vendeu, porque a Tray não guarda.
 */

const SEM_REDE = "Não deu para falar com o servidor. Confira a conexão e tente de novo.";

async function ler(numero: number): Promise<LeituraDoHistorico | null> {
  try {
    const { data, error } = await createClient().rpc("historico_do_pedido", { p_numero: numero });
    return error ? null : lerHistorico(data, numero);
  } catch {
    return null;
  }
}

async function marcar(numero: number, vendedor: string | null): Promise<{ ok: true } | { ok: false; erro: string }> {
  try {
    const { data, error } = await createClient().rpc("pedido_marcar_vendedor", { p_numero: numero, p_vendedor: vendedor });
    if (error) return { ok: false, erro: SEM_REDE };
    const d = (data ?? {}) as { ok?: boolean; erro?: string };
    return d.ok ? { ok: true } : { ok: false, erro: d.erro ?? "Não deu para gravar agora." };
  } catch {
    return { ok: false, erro: SEM_REDE };
  }
}

const nomeDoCanal = (c: string) => (Object.hasOwn(NOME_DO_CANAL, c) ? NOME_DO_CANAL[c as Canal] : c);
const PARCEIRO: Record<string, string> = { "1516": "Catálogo do Instagram e Facebook", "1517": "Google Shopping" };
const reais = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Por onde o pedido veio: a chegada anotada pela loja vale mais; depois a etiqueta da exportação; depois o catálogo. */
function porOnde(h: HistoricoDoPedido): { texto: string; apoio: string | null } {
  const o = h.origem;
  if (o.canalAnotado) {
    const anuncio = o.campanha ? `Anúncio: ${o.campanha}` : null;
    return { texto: nomeDoCanal(o.canalAnotado), apoio: anuncio ?? "Anotado pela própria loja na chegada" };
  }
  if (o.utmSource) return { texto: nomeDoCanal(canalDaOrigem(o.utmSource)), apoio: `Etiqueta "${o.utmSource}" na loja` };
  if (o.parceiro && PARCEIRO[o.parceiro]) return { texto: PARCEIRO[o.parceiro], apoio: null };
  return { texto: "Sem origem anotada", apoio: "Pedido sem etiqueta e sem chegada registrada (busca do Google ou acesso direto, quase sempre)" };
}

function quando(e: EventoDoPedido, agora: number): string {
  if (e.tipo === "pago" || e.tipo === "envio") {
    const hoje = diaDe(agora);
    return e.dia === hoje ? "hoje" : diaCurto(e.dia);
  }
  const dia = diaDe(e.em);
  const nome = dia === diaDe(agora) ? "hoje" : rotuloDoDia(dia, agora).toLowerCase();
  return `${nome} às ${horaCurta(e.em)}`;
}

const ICONE: Record<EventoDoPedido["tipo"], LucideIcon> = {
  criado: Store,
  chegada: MousePointerClick,
  pago: BadgeCheck,
  status: ArrowRightLeft,
  envio: Truck,
  fabrica: Hammer,
  recuperacao: RotateCcw,
  venda_fora: HandCoins,
  suporte: LifeBuoy,
  vendedor: UserCheck,
  chat: MessagesSquare,
};

export default function Gaveta({ numero }: { numero: number }) {
  const [leitura, setLeitura] = useState<LeituraDoHistorico | null | "carregando">("carregando");
  const recarregar = useCallback(async () => {
    setLeitura(await ler(numero));
  }, [numero]);
  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  if (leitura === "carregando") {
    return (
      <CascaDoHistorico titulo={`Pedido ${numero}`}>
        <p className="flex items-center gap-2 text-sm text-muted" role="status">
          <Loader2 size={15} className="animate-spin" aria-hidden="true" /> Juntando o histórico do pedido
        </p>
      </CascaDoHistorico>
    );
  }
  if (!leitura || leitura.tipo !== "ok") {
    const frase =
      leitura === null
        ? SEM_REDE
        : leitura.tipo === "nao_achado"
          ? `O pedido ${numero} não está no painel. Os pedidos chegam da loja a cada hora; confira o número.`
          : "O seu acesso não abre o histórico de pedidos.";
    return (
      <CascaDoHistorico titulo={`Pedido ${numero}`}>
        <p role="alert" className="flex items-start gap-2 rounded-[12px] p-3 text-sm" style={{ background: COR_DO_TOM.atencao.fundo, color: COR_DO_TOM.atencao.texto }}>
          <TriangleAlert size={15} className="mt-0.5 shrink-0" aria-hidden="true" /> {frase}
        </p>
        {leitura === null ? (
          <button type="button" onClick={() => void recarregar()} className={`${botaoCheio} mt-3`}>
            Tentar de novo
          </button>
        ) : null}
      </CascaDoHistorico>
    );
  }
  return <Historico h={leitura.h} recarregar={recarregar} />;
}

export function Historico({ h, recarregar }: { h: HistoricoDoPedido; recarregar: () => Promise<void> }) {
  const agora = Date.now();
  const pessoas = pessoasDoPedido(h);
  const origem = porOnde(h);
  const whatsapp = linkDoWhatsapp(h.cliente.telefone);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [outro, setOutro] = useState("");

  const marcarVendedor = async (vendedor: string | null) => {
    setOcupado(true);
    setErro(null);
    const r = await marcar(h.numero, vendedor);
    setOcupado(false);
    if (!r.ok) return setErro(r.erro);
    setOutro("");
    avisarQueOPedidoMudou();
    await recarregar();
  };

  const situacao =
    h.situacao === "pago"
      ? { tom: "bom" as const, nome: "Pago" }
      : h.situacao === "cancelado"
        ? { tom: "ruim" as const, nome: "Cancelado" }
        : { tom: "atencao" as const, nome: h.situacao ? h.situacao.replace(/_/g, " ") : "Sem situação" };

  const dl = "grid grid-cols-1 gap-x-3 gap-y-0.5 py-2.5 sm:grid-cols-[8.5rem_1fr]";
  const dt = "text-xs font-semibold text-muted";
  const dd = "min-w-0 text-sm leading-snug text-ink [overflow-wrap:anywhere]";

  return (
    <CascaDoHistorico
      titulo={`Pedido ${h.numero}`}
      apoio={
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <SeloDeTom tom={situacao.tom}>{situacao.nome}</SeloDeTom>
          {h.dia ? <span>feito em {diaCurto(h.dia)}</span> : null}
          {h.status ? <span>na loja: {h.status.toLowerCase()}</span> : null}
        </span>
      }
    >
      {/* O cliente e os atalhos. */}
      <section aria-label="Cliente" className="glass rounded-[16px] p-3.5">
        <p className="flex items-start gap-2 text-sm text-ink">
          <CircleUserRound size={16} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" />
          <span className="min-w-0 [overflow-wrap:anywhere]">
            <span className="font-semibold">{h.cliente.nome ?? "Cliente sem nome"}</span>
            {h.cliente.telefone ? <span className="text-muted">, {telefoneLegivel(h.cliente.telefone)}</span> : null}
            {h.cidade ? <span className="text-muted">, {h.cidade}{h.uf ? ` (${h.uf})` : ""}</span> : null}
          </span>
        </p>
        <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
          {h.etapa ? <span>Fábrica: {nomeDaEtapa(h.etapa).toLowerCase()}</span> : null}
          {h.entrega ? <span>Entrega: {h.entrega}</span> : null}
          {h.rastreio ? <span className="numeros">Rastreio {h.rastreio}</span> : null}
          {h.total !== null ? <span className="numeros font-semibold text-ink">{reais(h.total)}{h.pagamento ? `, ${h.pagamento}` : ""}</span> : null}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {whatsapp ? (
            <a href={whatsapp} target="_blank" rel="noreferrer noopener" className={botaoClaro}>
              <MessageCircle size={14} aria-hidden="true" /> WhatsApp
            </a>
          ) : null}
          {h.pode.ficha ? (
            <Link href={`/admin/clientes/${h.cliente.ref}`} onClick={fecharHistoricoDoPedido} className={botaoClaro}>
              <Contact size={14} aria-hidden="true" /> Ficha do cliente
            </Link>
          ) : null}
          {h.pode.fabrica ? (
            <Link href={`/admin/fabrica?busca=${h.numero}`} onClick={fecharHistoricoDoPedido} className={botaoClaro}>
              <Hammer size={14} aria-hidden="true" /> Na fábrica
            </Link>
          ) : null}
          {h.pode.suporte ? (
            <Link href={`/admin/suporte?cliente=p${h.numero}`} onClick={fecharHistoricoDoPedido} className={botaoClaro}>
              <LifeBuoy size={14} aria-hidden="true" /> Passar para o suporte
            </Link>
          ) : null}
        </div>
      </section>

      {h.pecas.length > 0 ? (
        <section aria-label="Peças" className="mt-3">
          <ul className="grid grid-cols-1 gap-2">
            {h.pecas.map((p, i) => (
              <li key={i} className="flex min-w-0 items-center gap-2.5 rounded-[12px] bg-white px-2.5 py-2">
                {p.foto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.foto} alt="" className="h-10 w-10 shrink-0 rounded-[8px] border border-ink/10 object-cover" />
                ) : (
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[8px] bg-ink/[0.05]" aria-hidden="true">
                    <ShoppingBag size={15} className="text-muted" />
                  </span>
                )}
                <span className="min-w-0 text-sm leading-snug text-ink [overflow-wrap:anywhere]">
                  {p.quantidade ? <span className="numeros font-semibold">{p.quantidade}× </span> : null}
                  {nomeLimpo(p.nome)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Quem e por onde. */}
      <section aria-label="Quem e por onde" className="glass mt-3 rounded-[16px] px-3.5 py-1">
        <dl className="divide-y divide-ink/[0.06]">
          <div className={dl}>
            <dt className={dt}>Quem vendeu</dt>
            <dd className={dd}>
              {h.vendedor ? (
                <>
                  <span className="font-semibold">{h.vendedor.nome ?? "Alguém do time"}</span>
                  <span className="block text-xs text-muted">
                    {h.vendedor.proprio ? "Marcou que vendeu" : `Marcado por ${quemEmPalavra(h.vendedor.porNome)}`} em {diaCurto(diaDe(h.vendedor.em))}
                  </span>
                </>
              ) : h.vendasPorFora.length > 0 ? (
                <>
                  <span className="font-semibold">{h.vendasPorFora.map((v) => v.nome ?? "Alguém do time").join(", ")}</span>
                  <span className="block text-xs text-muted">Venda registrada por fora, ligada a este pedido</span>
                </>
              ) : (
                <span className="text-muted">Ninguém marcou. A loja não guarda quem vendeu.</span>
              )}
              {(h.pode.marcar && !h.vendedor) || h.pode.atribuir ? (
                <span className="mt-2 flex flex-wrap items-center gap-2">
                  {h.pode.marcar && !h.vendedor ? (
                    <button type="button" disabled={ocupado} onClick={() => void marcarVendedor(null)} className={botaoCheio}>
                      {ocupado ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <UserCheck size={14} aria-hidden="true" />} Fui eu que vendi
                    </button>
                  ) : null}
                  {h.pode.atribuir && h.vendedores.length > 0 ? (
                    <span className="flex w-full flex-wrap items-center gap-1.5 sm:w-auto">
                      <label className="sr-only" htmlFor={`vendedor-${h.numero}`}>
                        Marcar a venda como de outra pessoa
                      </label>
                      <select
                        id={`vendedor-${h.numero}`}
                        value={outro}
                        onChange={(e) => setOutro(e.target.value)}
                        className="h-10 w-full min-w-0 rounded-full border border-ink/15 bg-white px-3 text-base text-ink sm:w-auto sm:max-w-[14rem] sm:text-sm"
                      >
                        <option value="">{h.vendedor ? "Trocar o vendedor" : "Outra pessoa vendeu"}</option>
                        {h.vendedores
                          .filter((v) => v.id !== h.vendedor?.id)
                          .map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.nome}
                            </option>
                          ))}
                      </select>
                      {outro ? (
                        <button type="button" disabled={ocupado} onClick={() => void marcarVendedor(outro)} className={botaoClaro}>
                          Marcar
                        </button>
                      ) : null}
                    </span>
                  ) : null}
                </span>
              ) : null}
              {h.pode.marcar && !h.vendedor && h.situacao === "pago" ? (
                <span className="mt-1.5 block text-xs text-muted">Entra no ranking de Vendedores.</span>
              ) : null}
              {erro ? (
                <span role="alert" className="mt-1.5 block text-xs font-semibold" style={{ color: COR_DO_TOM.ruim.texto }}>
                  {erro}
                </span>
              ) : null}
            </dd>
          </div>
          <div className={dl}>
            <dt className={dt}>Por onde veio</dt>
            <dd className={dd}>
              <span className="font-semibold">{origem.texto}</span>
              {origem.apoio ? <span className="block text-xs text-muted">{origem.apoio}</span> : null}
            </dd>
          </div>
          {pessoas.direcionou.length > 0 ? (
            <div className={dl}>
              <dt className={dt}>Passou ao suporte</dt>
              <dd className={dd}>{pessoas.direcionou.join(", ")}</dd>
            </div>
          ) : null}
          {pessoas.atendeu.length > 0 ? (
            <div className={dl}>
              <dt className={dt}>Quem atendeu</dt>
              <dd className={dd}>{pessoas.atendeu.join(", ")}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      {/* A campanha, o conjunto e o anúncio a que a UTM foi ligada, e as chegadas do visitante (0112). */}
      <OrigemDoPedido numero={h.numero} />

      {/* A linha do tempo. */}
      <section aria-label="O que aconteceu com o pedido" className="mt-5">
        <h3 className="eyebrow">O que aconteceu, do mais novo para o mais velho</h3>
        <ol className="mt-3">
          {h.eventos.map((e, i) => {
            const t = textoDoEvento(e.tipo === "chat" ? { ...e, texto: textoLimpo(e.texto) } : e, nomeDoCanal);
            const Icone = ICONE[e.tipo] ?? PackageCheck;
            const ultimo = i === h.eventos.length - 1;
            return (
              <li key={i} className="relative flex gap-3 pb-4">
                {!ultimo ? <span className="absolute bottom-0 left-[15px] top-8 w-px bg-ink/10" aria-hidden="true" /> : null}
                <span className="painel-selo grid h-8 w-8 shrink-0 place-items-center rounded-full" aria-hidden="true">
                  {e.tipo === "chegada" && e.plataforma ? <Bot size={14} /> : <Icone size={14} />}
                </span>
                <div className="min-w-0 flex-1 pt-1">
                  <p className="text-sm font-semibold leading-snug text-ink">{t.titulo}</p>
                  {t.detalhe ? <p className="mt-0.5 whitespace-pre-line text-sm leading-snug text-ink/80 [overflow-wrap:anywhere]">{t.detalhe}</p> : null}
                  <p className="mt-0.5 text-xs text-muted">
                    {quando(e, agora)}
                    {t.quem ? `, por ${quemEmPalavra(t.quem)}` : ""}
                    {e.tipo === "chat" ? (
                      <>
                        {" · "}
                        <Link href={`/admin/chat?sala=${e.sala}&m=${e.mensagem}`} onClick={fecharHistoricoDoPedido} className="font-semibold text-ink underline decoration-ink/30 underline-offset-2">
                          ver no chat
                        </Link>
                      </>
                    ) : null}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
        <p className="text-[0.7rem] leading-relaxed text-muted">
          Montado na hora com o que está gravado na loja, na fábrica, no suporte, na recuperação, nas vendas por fora e no chat. O status da loja mostra só a última
          troca.
        </p>
      </section>
    </CascaDoHistorico>
  );
}
