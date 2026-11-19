"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CircleCheck, ExternalLink, Hammer, Loader2, TriangleAlert, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { COR_DO_TOM, type Tom } from "@/lib/painel/tons";
import { PERIODOS_DO_PEDIDO, intervaloDoPedido, type PeriodoDoPedido } from "@/lib/pedidos/do-site";
import {
  MOTIVOS, NOME_DA_ACAO, NOME_DO_ESTADO, acoesDoMotivo, lerListaDaKommo,
  type AcaoDaGerencia, type Estado, type ListaDaKommo, type NaFila, type VendaDaKommo,
} from "@/lib/kommo/vendas";
import type { FaltaNaFabrica } from "@/lib/kommo/fabrica";
import { SeloDeTom } from "../Pecas";
import { Ficha, botaoCheio, botaoClaro, campo } from "../biblioteca/pecas";
import { BotaoDoHistorico } from "../pedido/abrir";

/**
 * As vendas que vieram da Kommo e a fila de conferência (cartão 47).
 *
 * O painel registra sozinho o negócio que entra em "Venda ganha" num funil de
 * venda: marca o pedido do site quando o campo "Pedido Tray" casa, ou lança a
 * venda por fora. O que ele não registra sem gente olhar (responsável sem
 * pessoa no painel, sem valor, parecido com venda já lançada, desfeito depois
 * de registrado) cai na fila, e a gerência resolve aqui, pelas mesmas portas
 * de Registrar venda e de Pedidos do site.
 *
 * O valor só chega do banco para quem vê o faturamento ou na venda da própria
 * pessoa.
 */

type Feito = { ok: true } | { ok: false; erro: string };

export type ApiDaKommo = {
  listar: (de: string, ate: string) => Promise<ListaDaKommo | null>;
  resolver: (a: { negocio: number; acao: AcaoDaGerencia; vendedor: string | null; pedido: number | null }) => Promise<Feito>;
};

const SEM_REDE = "Não deu para falar com o servidor. Confira a conexão e tente de novo.";

const apiReal: ApiDaKommo = {
  async listar(de, ate) {
    try {
      const { data, error } = await createClient().rpc("kommo_vendas_lista", { p_de: de, p_ate: ate });
      return error ? null : lerListaDaKommo(data);
    } catch {
      return null;
    }
  },
  async resolver(a) {
    try {
      const { data, error } = await createClient().rpc("kommo_venda_resolver", {
        p_negocio: a.negocio, p_acao: a.acao, p_vendedor: a.vendedor, p_pedido: a.pedido,
      });
      if (error) return { ok: false, erro: SEM_REDE };
      const d = (data ?? {}) as { ok?: boolean; erro?: string };
      return d.ok ? { ok: true } : { ok: false, erro: d.erro ?? "Não deu agora." };
    } catch {
      return { ok: false, erro: SEM_REDE };
    }
  },
};

const reais = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const diaCurto = (d: string | null) => (d && /^\d{4}-\d{2}-\d{2}/.test(d) ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : "");

const TOM_DO_ESTADO: Record<Estado, Tom> = {
  marcada: "bom",
  registrada: "bom",
  aguardando_pedido: "atencao",
  conferir: "atencao",
  desfeita: "neutro",
  ignorada: "neutro",
};

export function TelaDasVendasDaKommo({
  inicial, hoje, api = apiReal, faltasNaFabrica = [],
}: {
  inicial: ListaDaKommo | null;
  hoje: string;
  api?: ApiDaKommo;
  /** Venda por fora vinda da Kommo que não foi sozinha para a fábrica (cartão 51). `null` quando a leitura falhou. */
  faltasNaFabrica?: FaltaNaFabrica[] | null;
}) {
  const [periodo, setPeriodo] = useState<PeriodoDoPedido>("30d");
  const [lista, setLista] = useState<ListaDaKommo | null>(inicial);
  const [carregando, setCarregando] = useState(false);
  const [aviso, setAviso] = useState<{ tom: "bom" | "ruim"; texto: string } | null>(null);

  const vez = useRef(0);
  const ler = useCallback(async () => {
    const minha = ++vez.current;
    setCarregando(true);
    const { de, ate } = intervaloDoPedido(periodo, hoje);
    const r = await api.listar(de, ate);
    if (minha !== vez.current) return;
    setCarregando(false);
    if (r) setLista(r);
    else setAviso({ tom: "ruim", texto: "Não deu para ler as vendas da Kommo agora." });
  }, [api, periodo, hoje]);

  const primeira = useRef(true);
  useEffect(() => {
    if (primeira.current) {
      primeira.current = false;
      return;
    }
    void ler();
  }, [ler]);

  const resolver = async (f: NaFila, acao: AcaoDaGerencia, vendedor: string | null, pedido: number | null): Promise<boolean> => {
    setAviso(null);
    const r = await api.resolver({ negocio: f.negocio_id, acao, vendedor, pedido });
    if (!r.ok) {
      setAviso({ tom: "ruim", texto: r.erro });
      return false;
    }
    setAviso({
      tom: "bom",
      texto:
        acao === "ignorar" ? "Tirado da fila." : acao === "estornar" ? "Venda estornada." : "Pronto. A venda já conta no mês e no ranking.",
    });
    await ler();
    return true;
  };

  if (!lista) {
    return (
      <div className="min-w-0">
        <Cabecalho />
        <div className="glass mt-4 rounded-[16px] p-4" role="alert">
          <p className="text-sm font-semibold text-ink">Não deu para ler as vendas da Kommo agora.</p>
          <button type="button" onClick={() => void ler()} className={`${botaoCheio} mt-3`}>
            Tentar de novo
          </button>
        </div>
      </div>
    );
  }

  const r = lista.resumo;
  return (
    <div className="min-w-0">
      <Cabecalho desde={lista.desde} />

      <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Numero rotulo="Pedidos do site marcados" valor={r.marcadas} />
        <Numero rotulo="Vendas por fora lançadas" valor={r.registradas} />
        <Numero rotulo="Na conferência" valor={r.na_fila} tom={r.na_fila > 0 ? "atencao" : "neutro"} />
        <Numero rotulo="Esperando o pedido" valor={r.esperando_pedido} />
      </div>
      {r.valor !== null ? (
        <p className="mt-2 text-sm text-muted">
          Somam <span className="numeros font-semibold text-ink">{reais(r.valor)}</span> no período, já contados uma vez só no faturamento e no ranking.
        </p>
      ) : null}

      {aviso ? (
        <p
          role={aviso.tom === "ruim" ? "alert" : "status"}
          className="mt-3 flex items-start gap-2 rounded-[12px] px-3 py-2.5 text-sm leading-relaxed"
          style={{ background: COR_DO_TOM[aviso.tom].fundo, color: COR_DO_TOM[aviso.tom].texto }}
        >
          {aviso.tom === "bom" ? <CircleCheck size={16} className="mt-0.5 shrink-0" aria-hidden="true" /> : <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />}
          <span className="min-w-0 flex-1">{aviso.texto}</span>
          <button type="button" onClick={() => setAviso(null)} aria-label="Fechar o aviso" className="shrink-0">
            <X size={14} aria-hidden="true" />
          </button>
        </p>
      ) : null}

      <section className="mt-6" aria-labelledby="fila-kommo">
        <h2 id="fila-kommo" className="text-lg font-bold text-ink">
          Fila de conferência
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          {lista.pode.resolver
            ? "O que o painel não registrou sozinho. Confira na Kommo e resolva aqui."
            : "O que o painel não registrou sozinho. Quem resolve é a gerência; se for venda sua, avise."}
        </p>
        {lista.fila.length === 0 ? (
          <div className="glass mt-3 rounded-[16px] p-4 text-sm text-muted">Nada esperando conferência.</div>
        ) : (
          <ul className="mt-3 grid grid-cols-1 gap-3">
            {lista.fila.map((f) => (
              <ItemDaFila key={f.negocio_id} f={f} lista={lista} onResolver={resolver} />
            ))}
          </ul>
        )}
      </section>

      <FaltaNaFabricaSecao faltas={faltasNaFabrica} />

      <section className="mt-7" aria-labelledby="vendas-kommo">
        <h2 id="vendas-kommo" className="text-lg font-bold text-ink">
          Vendas que vieram da Kommo
        </h2>
        <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Período">
          {PERIODOS_DO_PEDIDO.map((p) => (
            <Ficha key={p.chave} ativa={periodo === p.chave} onClick={() => setPeriodo(p.chave)}>
              {p.nome}
            </Ficha>
          ))}
          {carregando ? <Loader2 size={16} className="ml-1 self-center animate-spin text-muted" aria-label="Lendo" /> : null}
        </div>
        {lista.vendas.length === 0 ? (
          <div className="glass mt-3 rounded-[16px] p-4 text-sm text-muted">Nenhuma venda ganha na Kommo entrou no painel neste período.</div>
        ) : (
          <ul className={`mt-3 grid grid-cols-1 gap-3 ${carregando ? "opacity-60" : ""}`}>
            {lista.vendas.map((v) => (
              <ItemDaVenda key={v.negocio_id} v={v} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Cabecalho({ desde }: { desde?: string | null }) {
  return (
    <header>
      <p className="eyebrow">Vendas</p>
      <h1 className="font-display mt-2 text-3xl text-ink sm:text-4xl">Vendas da Kommo</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
        Negócio que entra em &quot;Venda ganha&quot; na Kommo entra aqui sozinho: com o campo Pedido Tray, o pedido do site vira venda do vendedor; sem
        ele, vira venda por fora. Não precisa lançar de novo em Registrar venda.
        {desde ? ` Vale para o que foi ganho desde ${diaCurto(desde.slice(0, 10))}.` : ""}
      </p>
    </header>
  );
}

function Numero({ rotulo, valor, tom = "neutro" }: { rotulo: string; valor: number; tom?: Tom }) {
  return (
    <div className="glass min-w-0 rounded-[16px] p-3">
      <p className="text-xs leading-snug text-muted">{rotulo}</p>
      <p className="numeros mt-1 text-2xl font-bold" style={{ color: tom === "neutro" ? undefined : COR_DO_TOM[tom].texto }}>
        {valor}
      </p>
    </div>
  );
}

function LinkDaKommo({ href }: { href: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={botaoClaro}>
      <ExternalLink size={14} aria-hidden="true" /> Abrir na Kommo
    </a>
  );
}

function ItemDaVenda({ v }: { v: VendaDaKommo }) {
  return (
    <li className="glass min-w-0 rounded-[16px] p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
        <div className="min-w-0">
          <p className="text-base font-bold leading-tight text-ink [overflow-wrap:anywhere]">
            {v.cliente ?? v.negocio ?? `Negócio ${v.negocio_id}`}
            <span className="ml-2 text-xs font-normal text-muted">{diaCurto(v.dia)}</span>
          </p>
          <p className="mt-0.5 text-sm text-muted [overflow-wrap:anywhere]">
            {v.vendedor ? `Venda de ${v.vendedor}` : "Sem vendedor"}
            {v.funil ? `, ${v.funil}` : ""}
            {v.pedido ? `, pedido ${v.pedido}` : ""}
          </p>
        </div>
        <SeloDeTom tom={TOM_DO_ESTADO[v.estado]}>{NOME_DO_ESTADO[v.estado]}</SeloDeTom>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {v.valor !== null ? <span className="numeros mr-auto text-sm font-semibold text-ink">{reais(v.valor)}</span> : null}
        {v.pedido ? <BotaoDoHistorico numero={v.pedido} rotulo="Histórico" className={botaoClaro} /> : null}
        <LinkDaKommo href={v.link} />
      </div>
    </li>
  );
}

function ItemDaFila({
  f, lista, onResolver,
}: {
  f: NaFila;
  lista: ListaDaKommo;
  onResolver: (f: NaFila, acao: AcaoDaGerencia, vendedor: string | null, pedido: number | null) => Promise<boolean>;
}) {
  const [vendedor, setVendedor] = useState(f.vendedor_id ?? "");
  const [pedido, setPedido] = useState(f.pedido ? String(f.pedido) : "");
  const [confirmando, setConfirmando] = useState<AcaoDaGerencia | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const acoes = acoesDoMotivo(f.motivo);
  const pedeVendedor = acoes.some((a) => a === "lancar" || a === "marcar_pedido");
  const pedePedido = acoes.includes("marcar_pedido");
  const numeroDoPedido = /^\d{3,9}$/.test(pedido.trim()) ? Number(pedido.trim()) : null;

  const fazer = async (a: AcaoDaGerencia) => {
    if (confirmando !== a) return setConfirmando(a);
    setOcupado(true);
    await onResolver(f, a, vendedor || null, numeroDoPedido);
    setOcupado(false);
    setConfirmando(null);
  };

  return (
    <li className="glass min-w-0 rounded-[16px] p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
        <div className="min-w-0">
          <p className="text-base font-bold leading-tight text-ink [overflow-wrap:anywhere]">
            {f.cliente ?? f.negocio ?? `Negócio ${f.negocio_id}`}
            <span className="ml-2 text-xs font-normal text-muted">{diaCurto(f.dia)}</span>
          </p>
          <p className="mt-0.5 text-sm text-muted [overflow-wrap:anywhere]">
            {f.responsavel ? `Na Kommo: ${f.responsavel}` : "Sem responsável na Kommo"}
            {f.funil ? `, ${f.funil}` : ""}
          </p>
        </div>
        {f.valor !== null ? <span className="numeros text-sm font-semibold text-ink">{reais(f.valor)}</span> : null}
      </div>
      <p
        className="mt-2 flex items-start gap-1.5 rounded-[10px] px-2.5 py-2 text-sm leading-snug"
        style={{ background: COR_DO_TOM.atencao.fundo, color: COR_DO_TOM.atencao.texto }}
      >
        <TriangleAlert size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
        <span className="min-w-0 [overflow-wrap:anywhere]">
          {MOTIVOS[f.motivo] ?? f.motivo}
          {f.parecida_com ? `: ${f.parecida_com}` : ""}
          {f.motivo === "pedido_de_outro" && f.erro ? `. ${f.erro}` : ""}
          {f.pedido_tray && (f.motivo === "pedido_ambiguo" || f.motivo === "pedido_nao_encontrado") ? ` (campo: "${f.pedido_tray}")` : ""}
        </span>
      </p>

      {lista.pode.resolver ? (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {pedeVendedor ? (
            <label className="block min-w-0 text-xs font-semibold text-muted">
              Vendedor
              <select value={vendedor} onChange={(e) => setVendedor(e.target.value)} className={campo}>
                <option value="">Escolha</option>
                {lista.vendedores.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nome}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {pedePedido ? (
            <label className="block min-w-0 text-xs font-semibold text-muted">
              Pedido do site
              <input value={pedido} onChange={(e) => setPedido(e.target.value)} inputMode="numeric" placeholder="Só se foi pelo site" className={campo} />
            </label>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {lista.pode.resolver
          ? acoes.map((a) => {
              const falta = (a === "lancar" && !vendedor) || (a === "marcar_pedido" && (!vendedor || !numeroDoPedido));
              return (
                <button
                  key={a}
                  type="button"
                  disabled={ocupado || falta}
                  onClick={() => void fazer(a)}
                  className={a === acoes[0] ? botaoCheio : botaoClaro}
                >
                  {ocupado && confirmando === a ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : null}
                  {confirmando === a ? "Toque de novo para confirmar" : NOME_DA_ACAO[a]}
                </button>
              );
            })
          : null}
        {f.pedido ? <BotaoDoHistorico numero={f.pedido} rotulo="Histórico" className={botaoClaro} /> : null}
        <LinkDaKommo href={f.link} />
      </div>
    </li>
  );
}

/**
 * A venda por fora vinda da Kommo que não foi sozinha para a fábrica (cartão
 * 51, 0176): faltou numeração, não deu para saber a peça, ou a peça não leva
 * numeração nem gravação. O painel não palpita: diz o motivo e leva ao
 * formulário de Registrar venda com a venda já escolhida. Completar os campos
 * na própria Kommo também destrava, na rodada seguinte.
 */
function FaltaNaFabricaSecao({ faltas }: { faltas: FaltaNaFabrica[] | null }) {
  if (faltas === null) {
    return (
      <section className="mt-7" aria-labelledby="fabrica-kommo">
        <h2 id="fabrica-kommo" className="text-lg font-bold text-ink">Falta a produção para a fábrica</h2>
        <div className="glass mt-3 rounded-[16px] p-4 text-sm text-muted" role="alert">Não deu para ler o que falta para a fábrica agora.</div>
      </section>
    );
  }
  const incompletas = faltas.filter((f) => f.estado === "incompleta");
  const fora = faltas.filter((f) => f.estado === "fora");
  return (
    <section className="mt-7" aria-labelledby="fabrica-kommo">
      <h2 id="fabrica-kommo" className="text-lg font-bold text-ink">Falta a produção para a fábrica</h2>
      <p className="mt-1 text-sm leading-relaxed text-muted">
        A venda por fora que vem da Kommo vai sozinha para a fila da fábrica quando o negócio diz a peça e a numeração de cada aro. Quando
        falta alguma coisa, ela espera aqui: complete pelo formulário, ou preencha os campos na Kommo e espere a próxima leitura.
      </p>
      {incompletas.length === 0 ? (
        <div className="glass mt-3 rounded-[16px] p-4 text-sm text-muted">Nenhuma venda esperando a produção.</div>
      ) : (
        <ul className="mt-3 grid grid-cols-1 gap-3">
          {incompletas.map((f) => (
            <ItemDaFabrica key={f.venda_id} f={f} />
          ))}
        </ul>
      )}
      {fora.length > 0 ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-semibold text-ink">
            {fora.length} {fora.length === 1 ? "venda sem numeração nem gravação, que não foi" : "vendas sem numeração nem gravação, que não foram"} para a fábrica
          </summary>
          <ul className="mt-3 grid grid-cols-1 gap-3">
            {fora.map((f) => (
              <ItemDaFabrica key={f.venda_id} f={f} />
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

function ItemDaFabrica({ f }: { f: FaltaNaFabrica }) {
  return (
    <li className="glass min-w-0 rounded-[16px] p-4">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <p className="break-words text-sm font-bold text-ink [overflow-wrap:anywhere]">{f.cliente ?? f.negocio ?? `Negócio ${f.negocio_id}`}</p>
          <p className="mt-0.5 text-xs text-muted">
            {[diaCurto(f.dia), f.vendedor ? `vendida por ${f.vendedor}` : null].filter(Boolean).join(", ")}
          </p>
        </div>
        <SeloDeTom tom={f.estado === "incompleta" ? "atencao" : "neutro"} titulo={f.estado === "incompleta" ? "Esperando a produção" : "Fora da fábrica"}>
          {f.estado === "incompleta" ? "Esperando a produção" : "Fora da fábrica"}
        </SeloDeTom>
      </div>
      <ul className="mt-2 space-y-1">
        {f.motivos.map((m) => (
          <li key={m} className="text-sm leading-relaxed text-ink [overflow-wrap:anywhere]">{m}</li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {f.pode_completar ? (
          <Link href={`/admin/registrar-venda?producao=${f.venda_id}`} className={`${botaoCheio} inline-flex items-center gap-1.5`}>
            <Hammer size={14} aria-hidden="true" /> {f.estado === "incompleta" ? "Completar a produção" : "Mandar para a fábrica"}
          </Link>
        ) : null}
        <a href={f.link} target="_blank" rel="noopener noreferrer" className={`${botaoClaro} inline-flex items-center gap-1.5`}>
          <ExternalLink size={14} aria-hidden="true" /> Abrir na Kommo
        </a>
      </div>
    </li>
  );
}
