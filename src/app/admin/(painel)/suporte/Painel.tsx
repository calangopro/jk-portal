"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, CircleCheck, LifeBuoy, Loader2, TriangleAlert, X } from "lucide-react";
import { COR_DO_TOM } from "@/lib/painel/tons";
import { ABERTOS, limitesDoSuportePorExtenso, ordenarCasos, type Caso, type ListaDoSuporte } from "@/lib/suporte/casos";
import { aoAvisar } from "@/lib/time/ao-vivo";
import { botaoCheio, botaoClaro, useAgora } from "../biblioteca/pecas";
import { apiDoSuporte, type ApiDoSuporte } from "./api";
import { CartaoDoCaso } from "./Caso";
import { FormularioDoCaso, type ClienteEscolhido } from "./Formulario";

/**
 * O suporte pós-venda, desenhado: passar um caso e ver os casos. É a mesma
 * peça na tela `/admin/suporte` e na janela flutuante do chat (`compacta`).
 *
 * Quem ATENDE (área `suporte`: gerente e diretoria) vê a fila: o que está sem
 * dono, o que está com ele e o que está com outra pessoa. Quem PASSA (área
 * `lancar_venda`) vê os casos dele, abertos e fechados, e é avisado quando
 * um fecha (o número do menu e o aviso do sistema). Abrir esta peça com caso
 * fechado ainda não visto conta como ver.
 *
 * A lista anda sozinha: o canal ao vivo avisa quando alguém mexe no suporte
 * (`avisarOTime("suporte")`), e um relógio de um minuto cobre o aviso perdido.
 */
export function PainelDoSuporte({
  inicial, meuId, api = apiDoSuporte, compacta = false, clienteInicial,
}: {
  inicial: ListaDoSuporte | null;
  meuId: string;
  api?: ApiDoSuporte;
  compacta?: boolean;
  /** Quem chega da ficha do cliente começa com o formulário aberto e o pedido escolhido. */
  clienteInicial?: ClienteEscolhido | null;
}) {
  const [lista, setLista] = useState<ListaDoSuporte | null>(inicial);
  const [erro, setErro] = useState(false);
  const [passando, setPassando] = useState(Boolean(clienteInicial));
  const [passado, setPassado] = useState<number | null>(null);
  const [verFechados, setVerFechados] = useState(false);
  const agora = useAgora(lista?.agora ?? new Date().toISOString());

  const recarregar = useCallback(async () => {
    const l = await api.lista();
    if (l) {
      setLista(l);
      setErro(false);
    } else {
      setErro(true);
    }
  }, [api]);

  useEffect(() => {
    if (!inicial) void recarregar();
    // Só na chegada: a lista que veio do servidor já está na tela.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(
    () =>
      aoAvisar((a) => {
        if ((a.tipo === "mensagem" && a.sala === "suporte") || a.tipo === "voltou") void recarregar();
      }),
    [recarregar],
  );
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void recarregar();
    }, 60_000);
    return () => clearInterval(id);
  }, [recarregar]);

  // O caso que fechou e quem passou ainda não tinha visto: ver aqui conta como ver. Ele fica marcado como novo nesta visita.
  const novos = useMemo(
    () => new Set((lista?.casos ?? []).filter((c) => c.abertoPor === meuId && !c.visto && !ABERTOS.includes(c.estado)).map((c) => c.id)),
    [lista, meuId],
  );
  const marcados = useRef(new Set<number>());
  const [novosDaVisita, setNovosDaVisita] = useState<Set<number>>(new Set());
  useEffect(() => {
    const faltam = [...novos].filter((n) => !marcados.current.has(n));
    if (faltam.length === 0) return;
    faltam.forEach((n) => marcados.current.add(n));
    setNovosDaVisita((s) => new Set([...s, ...faltam]));
    void api.marcarVisto();
  }, [novos, api]);

  if (!lista) {
    return erro ? (
      <div className="glass rounded-[16px] p-4" role="alert">
        <p className="flex items-center gap-2 text-sm font-bold" style={{ color: COR_DO_TOM.ruim.texto }}>
          <TriangleAlert size={15} aria-hidden="true" /> Não deu para abrir o suporte agora
        </p>
        <p className="mt-1 text-sm text-ink">Costuma ser a conexão.</p>
        <button type="button" onClick={() => void recarregar()} className={`${botaoCheio} mt-3`}>
          Tentar de novo
        </button>
      </div>
    ) : (
      <p className="flex items-center gap-2 p-4 text-sm text-muted" role="status">
        <Loader2 size={15} className="animate-spin" aria-hidden="true" /> Abrindo o suporte
      </p>
    );
  }

  const casos = ordenarCasos(lista.casos);
  const abertos = casos.filter((c) => ABERTOS.includes(c.estado));
  const fechados = casos.filter((c) => !ABERTOS.includes(c.estado));
  const cartao = (c: Caso) => (
    <CartaoDoCaso key={c.id} c={c} agora={agora} atende={lista.atende} meuId={meuId} api={api} novo={novosDaVisita.has(c.id)} onMudou={() => void recarregar()} />
  );
  const grupo = (titulo: string, itens: Caso[], vazio?: string) =>
    itens.length > 0 || vazio ? (
      <section className={compacta ? "mt-5" : "mt-7"} aria-label={titulo}>
        <h2 className="eyebrow">
          {titulo}
          {itens.length > 0 ? <span className="ml-1.5 text-muted">{itens.length}</span> : null}
        </h2>
        {itens.length > 0 ? <ul className="mt-2.5 grid grid-cols-1 gap-3">{itens.map(cartao)}</ul> : <p className="mt-2 text-sm text-muted">{vazio}</p>}
      </section>
    ) : null;

  return (
    <div className="min-w-0">
      {lista.abre ? (
        <section aria-label="Passar um caso para o suporte">
          {passado ? (
            <p role="status" className="mb-3 flex items-start gap-2 rounded-[12px] px-3 py-2.5 text-sm leading-relaxed" style={{ background: COR_DO_TOM.bom.fundo, color: COR_DO_TOM.bom.texto }}>
              <CircleCheck size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="font-bold">Caso {passado} passado para o suporte.</span> O cliente agora é do suporte, e você recebe aviso quando o caso fechar.
              </span>
              <button type="button" onClick={() => setPassado(null)} aria-label="Fechar o aviso" className="shrink-0">
                <X size={14} aria-hidden="true" />
              </button>
            </p>
          ) : null}
          {passando ? (
            <div className="glass rounded-[16px] p-4">
              <p className="mb-3 text-sm font-bold text-ink">Passar um caso para o suporte</p>
              <FormularioDoCaso
                api={api}
                meuId={meuId}
                clienteInicial={clienteInicial}
                onPassado={(id) => {
                  setPassando(false);
                  setPassado(id);
                  void recarregar();
                }}
                onCancelar={() => setPassando(false)}
              />
            </div>
          ) : (
            <div className={`glass flex flex-wrap items-center gap-3 rounded-[16px] ${compacta ? "p-3.5" : "p-4"}`}>
              <span className="painel-selo grid h-10 w-10 shrink-0 place-items-center rounded-full" aria-hidden="true">
                <LifeBuoy size={18} />
              </span>
              <p className="min-w-0 flex-1 basis-48 text-sm leading-snug text-ink">
                <span className="block font-semibold">Pedra, ajuste, troca, garantia, atraso?</span>
                <span className="text-muted">Passe o caso para o suporte e volte a vender. Você é avisado quando fechar.</span>
              </p>
              <button type="button" onClick={() => setPassando(true)} className={botaoCheio}>
                Passar um caso
              </button>
            </div>
          )}
        </section>
      ) : null}

      {lista.atende ? (
        <>
          {grupo("Na fila, sem dono", abertos.filter((c) => c.estado === "na_fila"), "Ninguém na fila agora.")}
          {grupo("Com você", abertos.filter((c) => c.estado === "com_suporte" && c.assumidoPor === meuId))}
          {grupo("Com outras pessoas", abertos.filter((c) => c.estado === "com_suporte" && c.assumidoPor !== meuId))}
        </>
      ) : (
        grupo("Seus casos abertos", abertos, "Nenhum caso seu aberto.")
      )}

      {fechados.length > 0 ? (
        <section className={compacta ? "mt-5" : "mt-7"} aria-label="Casos fechados">
          <button type="button" onClick={() => setVerFechados((v) => !v)} aria-expanded={verFechados} className={botaoClaro}>
            {verFechados ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
            {lista.atende ? "Fechados nos últimos 7 dias" : "Seus casos fechados (30 dias)"} ({fechados.length})
            {novosDaVisita.size > 0 && !verFechados ? <span className="ml-1 rounded-full bg-wine px-1.5 py-0.5 text-[0.62rem] font-bold leading-none text-white">{novosDaVisita.size} novo{novosDaVisita.size === 1 ? "" : "s"}</span> : null}
          </button>
          {verFechados || novosDaVisita.size > 0 ? (
            <ul className="mt-2.5 grid grid-cols-1 gap-3">{(verFechados ? fechados : fechados.filter((c) => novosDaVisita.has(c.id))).map(cartao)}</ul>
          ) : null}
        </section>
      ) : null}

      {lista.atende ? <p className="mt-6 text-[0.7rem] leading-relaxed text-muted">{limitesDoSuportePorExtenso()}</p> : null}
    </div>
  );
}
