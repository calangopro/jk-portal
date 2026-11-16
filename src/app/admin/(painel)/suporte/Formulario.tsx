"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ImagePlus, Loader2, Phone, Search, Send, X } from "lucide-react";
import { COR_DO_TOM } from "@/lib/painel/tons";
import { ASSUNTOS, MAXIMO_DE_PRINTS, conferirCaso } from "@/lib/suporte/casos";
import { NOME_DA_ETAPA, TIPOS_DE_IMAGEM, diaCurto, type PedidoAchado } from "@/lib/time/chat";
import { Ficha, botaoCheio, botaoClaro, campo } from "../biblioteca/pecas";
import { Miniaturas, useImagens } from "../chat/Imagens";
import { BotaoDoHistorico } from "../pedido/abrir";
import type { ApiDoSuporte } from "./api";

/**
 * Passar o caso para o suporte. Uma tela, cinco coisas, para caber no meio do
 * atendimento (inclusive na janela flutuante do chat):
 *
 *   1. o assunto, numa lista curta;
 *   2. o PEDIDO do cliente, achado pela MESMA busca do "/pedido" do chat
 *      (número ou nome), ou o telefone quando não há pedido. Com o pedido, o
 *      caso entra no histórico dele (`historico_do_pedido`, 0103);
 *   3. o que o cliente disse;
 *   4. o print da conversa, colado no texto ou escolhido (é como o vendedor
 *      já pergunta no grupo);
 *   5. se o cliente está esperando resposta agora.
 *
 * O que vai junto é o que o gerente precisaria perguntar de volta. A
 * conferência roda aqui antes de ir ao banco, que confere de novo.
 */

export type ClienteEscolhido = { ref: string; titulo: string; apoio?: string | null };

export function FormularioDoCaso({
  api, meuId, clienteInicial, onPassado, onCancelar,
}: {
  api: ApiDoSuporte;
  meuId: string;
  /** Quem chega da ficha do cliente já vem com o pedido escolhido. */
  clienteInicial?: ClienteEscolhido | null;
  onPassado: (id: number) => void;
  onCancelar?: () => void;
}) {
  const id = useId();
  const [assunto, setAssunto] = useState("");
  const [cliente, setCliente] = useState<ClienteEscolhido | null>(clienteInicial ?? null);
  const [porTelefone, setPorTelefone] = useState(false);
  const [busca, setBusca] = useState("");
  const [achados, setAchados] = useState<PedidoAchado[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [telefone, setTelefone] = useState("");
  const [nome, setNome] = useState("");
  const [relato, setRelato] = useState("");
  const [urgente, setUrgente] = useState(false);
  const imagens = useImagens(MAXIMO_DE_PRINTS);
  const arquivo = useRef<HTMLInputElement>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // A busca do pedido espera a pessoa parar de digitar.
  useEffect(() => {
    const termo = busca.trim();
    if (cliente || porTelefone || termo.length === 0 || (!/^#?\d+$/.test(termo) && termo.length < 2)) {
      setAchados([]);
      setBuscando(false);
      return;
    }
    setBuscando(true);
    let vivo = true;
    const espera = setTimeout(async () => {
      const r = await api.buscarPedidos(termo);
      if (!vivo) return;
      setAchados(r);
      setBuscando(false);
    }, 300);
    return () => {
      vivo = false;
      clearTimeout(espera);
    };
  }, [busca, cliente, porTelefone, api]);

  const passar = async () => {
    const problema = conferirCaso({
      assunto,
      relato,
      ref: cliente?.ref ?? "",
      telefone: porTelefone ? telefone : "",
      nome: porTelefone ? nome : "",
      imagens: imagens.lista.length,
    });
    if (problema) return setErro(problema);
    setErro(null);
    setEnviando(true);
    let caminhos: string[] = [];
    if (imagens.lista.length > 0) {
      const subidos = await api.subirPrints(meuId, imagens.lista.map((i) => i.arquivo));
      if (!subidos.ok) {
        setEnviando(false);
        return setErro(subidos.erro);
      }
      caminhos = subidos.caminhos;
    }
    const r = await api.abrir({
      assunto,
      relato: relato.trim(),
      ref: cliente?.ref ?? null,
      nome: porTelefone ? nome.trim() || null : null,
      telefone: porTelefone ? telefone : null,
      urgente,
      imagens: caminhos,
    });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    api.avisar();
    onPassado(r.id);
  };

  const rotulo = "block text-xs font-semibold text-ink";

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void passar();
      }}
    >
      <fieldset>
        <legend className={rotulo}>Assunto</legend>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {ASSUNTOS.map((a) => (
            <Ficha key={a.chave} ativa={assunto === a.chave} onClick={() => setAssunto(a.chave)}>
              {a.nome}
            </Ficha>
          ))}
        </div>
      </fieldset>

      <div>
        <p className={rotulo} id={`${id}-cliente`}>
          Pedido do cliente
        </p>
        {cliente ? (
          <p className="mt-1.5 flex items-center gap-2 rounded-[12px] border border-ink/12 bg-white px-3 py-2">
            <span className="min-w-0 flex-1 text-sm leading-snug text-ink">
              <span className="font-semibold">{cliente.titulo}</span>
              {cliente.apoio ? <span className="block truncate text-xs text-muted">{cliente.apoio}</span> : null}
            </span>
            {/^p\d+$/.test(cliente.ref) ? <BotaoDoHistorico numero={Number(cliente.ref.slice(1))} /> : null}
            <button type="button" onClick={() => setCliente(null)} aria-label="Trocar o cliente" className="painel-toque grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted hover:bg-ink/[0.06]">
              <X size={14} aria-hidden="true" />
            </button>
          </p>
        ) : porTelefone ? (
          <div className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="min-w-0">
              <span className="sr-only">Telefone do cliente</span>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="off"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="Telefone com DDD"
                className={campo}
              />
            </label>
            <label className="min-w-0">
              <span className="sr-only">Nome do cliente (se souber)</span>
              <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome (se souber)" maxLength={120} autoComplete="off" className={campo} />
            </label>
            <p className="sm:col-span-2">
              <button type="button" onClick={() => setPorTelefone(false)} className="text-xs font-semibold text-ink underline decoration-ink/30 underline-offset-2">
                Tem pedido? Buscar pelo pedido
              </button>
            </p>
          </div>
        ) : (
          <div className="mt-1.5">
            <label className="relative block">
              <span className="sr-only">Número do pedido ou nome do cliente</span>
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 mt-0.5 -translate-y-1/2 text-muted" aria-hidden="true" />
              <input
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Número do pedido ou nome do cliente"
                autoComplete="off"
                aria-describedby={`${id}-cliente`}
                className={`${campo} pl-9`}
              />
            </label>
            {buscando ? (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted" role="status">
                <Loader2 size={12} className="animate-spin" aria-hidden="true" /> Buscando
              </p>
            ) : achados.length > 0 ? (
              <ul className="mt-1.5 overflow-hidden rounded-[12px] border border-ink/10 bg-white" aria-label="Pedidos achados">
                {achados.map((p) => (
                  <li key={p.numero} className="border-b border-ink/[0.06] last:border-b-0">
                    <button
                      type="button"
                      onClick={() => {
                        setCliente({
                          ref: `p${p.numero}`,
                          titulo: `Pedido ${p.numero}${p.cliente ? `, ${p.cliente}` : ""}`,
                          apoio: [diaCurto(p.dia), p.peca, p.etapa ? NOME_DA_ETAPA[p.etapa] ?? null : null].filter(Boolean).join(" · ") || null,
                        });
                        setBusca("");
                      }}
                      className="painel-toque block w-full px-3 py-2 text-left hover:bg-ink/[0.03]"
                    >
                      <span className="block text-sm font-semibold text-ink">
                        Pedido {p.numero}
                        {p.cliente ? <span className="font-normal">, {p.cliente}</span> : null}
                      </span>
                      <span className="block truncate text-xs text-muted">{[diaCurto(p.dia), p.peca].filter(Boolean).join(" · ")}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : busca.trim().length >= 2 ? (
              <p className="mt-1.5 text-xs text-muted">Nenhum pedido com esse número ou nome.</p>
            ) : null}
            <p className="mt-1.5">
              <button type="button" onClick={() => setPorTelefone(true)} className="inline-flex items-center gap-1 text-xs font-semibold text-ink underline decoration-ink/30 underline-offset-2">
                <Phone size={12} aria-hidden="true" /> Não tem pedido? Passar pelo telefone
              </button>
            </p>
          </div>
        )}
      </div>

      <label className="block">
        <span className={rotulo}>O que o cliente disse</span>
        <textarea
          value={relato}
          onChange={(e) => setRelato(e.target.value)}
          onPaste={imagens.aoColar}
          rows={3}
          maxLength={2000}
          placeholder="Em uma ou duas frases. Pode colar o print aqui."
          className={`${campo} min-h-[5.5rem] resize-y`}
        />
      </label>

      <div>
        <input
          ref={arquivo}
          type="file"
          accept={TIPOS_DE_IMAGEM.join(",")}
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            const arquivos = Array.from(e.target.files ?? []);
            e.target.value = "";
            if (arquivos.length > 0) imagens.juntar(arquivos);
          }}
        />
        <button type="button" onClick={() => arquivo.current?.click()} className={botaoClaro}>
          <ImagePlus size={15} aria-hidden="true" /> {imagens.lista.length > 0 ? "Mais um print" : "Mandar o print da conversa"}
        </button>
        <Miniaturas imagens={imagens} ocupado={enviando} />
        {imagens.erro ? (
          <p role="alert" className="mt-1 text-xs font-semibold" style={{ color: COR_DO_TOM.ruim.texto }}>
            {imagens.erro}
          </p>
        ) : null}
      </div>

      <label className="flex cursor-pointer items-start gap-2.5 rounded-[12px] border border-ink/10 bg-white px-3 py-2.5">
        <input type="checkbox" checked={urgente} onChange={(e) => setUrgente(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--setor)]" />
        <span className="text-sm leading-snug text-ink">
          <span className="font-semibold">O cliente está esperando resposta agora</span>
          <span className="block text-xs text-muted">O caso vai para o topo da fila.</span>
        </span>
      </label>

      {erro ? (
        <p role="alert" className="rounded-[10px] px-3 py-2 text-xs font-semibold leading-relaxed" style={{ background: COR_DO_TOM.ruim.fundo, color: COR_DO_TOM.ruim.texto }}>
          {erro}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={enviando} className={botaoCheio}>
          {enviando ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Send size={14} aria-hidden="true" />}
          {enviando ? "Passando" : "Passar para o suporte"}
        </button>
        {onCancelar ? (
          <button type="button" onClick={onCancelar} disabled={enviando} className={botaoClaro}>
            Cancelar
          </button>
        ) : null}
      </div>
    </form>
  );
}
