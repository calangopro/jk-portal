"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ClipboardCopy, Loader2, MessageSquareWarning, Plus, Search, X } from "lucide-react";
import type { FilaDaFabrica, PedidoDaFabrica } from "@/lib/fabrica/dados";
import {
  ETAPAS_DE_FABRICA, NOME_DO_TIPO, PRIORIDADES, SEM_FILTRO, TIPOS, ehFinal, etapasAtivas, filtrarFila, fraseParaOCliente,
  nomeDaEtapa, ordenarFila, tempoNaEtapa,
} from "@/lib/fabrica/etapas";
import { avisarOTime } from "@/lib/time/ao-vivo";
import { nomeLimpo } from "@/lib/vendas/origem";
import { AlteracoesDoTrabalho } from "../fabrica/Alteracoes";
import { nomeDoTrabalho } from "../fabrica/Lista";
import { BotaoDoHistorico } from "../pedido/abrir";
import { ProducaoDaVenda, type ProdutoDoFormulario } from "../registrar-venda/ProducaoDaVenda";
import { BotaoDeGarantia } from "../fabrica/BotaoDeGarantia";
import { emitirGarantiaNaVenda, type AbrirOs, type PedirAlteracao } from "./actions";

/**
 * Na fábrica, do lado de quem vende. O desenho; a leitura fica em `page.tsx`.
 *
 * Uma lista de busca, não de etapas: quem vende chega com o cliente na outra
 * ponta perguntando por UM pedido. Cada cartão diz a etapa em cor, há quanto
 * tempo está nela, e traz a frase pronta para copiar e mandar.
 *
 * "Pedir alteração" é o único jeito de mudar alguma coisa depois que o pedido
 * foi para a fábrica: o cartão de lá fica vermelho até alguém tocar em
 * "Ciente". O vendedor vê aqui se a fábrica já viu.
 */

const campo = "w-full rounded-[10px] border border-border bg-white px-3 py-2 text-sm text-ink";
const rotulo = "block text-[0.68rem] font-semibold uppercase tracking-wider text-muted";

export function TelaNaFabrica({
  fila, hoje, buscaInicial = "", produtos, lojas, abrir, pedirAlteracao,
}: {
  fila: FilaDaFabrica | null;
  hoje: string;
  buscaInicial?: string;
  produtos: ProdutoDoFormulario[];
  lojas: string[];
  abrir: AbrirOs;
  pedirAlteracao: PedirAlteracao;
}) {
  const [busca, setBusca] = useState(buscaInicial);
  const [quais, setQuais] = useState<"andando" | "sairam">("andando");
  const [abrindo, setAbrindo] = useState(false);
  const [aberta, setAberta] = useState<number | null>(null);
  const etapas = fila?.etapas ?? ETAPAS_DE_FABRICA;
  const pedidos = useMemo(() => fila?.pedidos ?? [], [fila]);
  const [agora] = useState(() => Date.now());

  const buscando = busca.trim().length > 0;
  const visiveis = useMemo(() => {
    const base = buscando ? pedidos : pedidos.filter((p) => (quais === "sairam" ? ehFinal(p.etapa) : !ehFinal(p.etapa)));
    const achados = filtrarFila(base, { ...SEM_FILTRO, busca }, hoje);
    return quais === "sairam" && !buscando ? [...achados].reverse() : ordenarFila(achados);
  }, [pedidos, quais, busca, buscando, hoje]);
  const comAlteracao = pedidos.filter((p) => p.alteracoes.some((a) => !a.cienteEm)).length;

  return (
    <div>
      <header>
        <p className="eyebrow">Vendas</p>
        <h1 className="font-display mt-2 text-3xl text-ink sm:text-4xl">Na fábrica</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted sm:text-base">
          Em que etapa está cada pedido, com a frase pronta para mandar ao cliente. Troca, peça com problema, ajuste, upgrade
          e polimento entram por Abrir OS. Mudou alguma coisa depois de o pedido ir para a fábrica? Peça a alteração no cartão.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setAbrindo((a) => !a)}
            aria-expanded={abrindo}
            className="painel-toque painel-aba-ativa inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-semibold"
          >
            {abrindo ? <X size={15} aria-hidden="true" /> : <Plus size={15} aria-hidden="true" />} {abrindo ? "Fechar" : "Abrir OS"}
          </button>
        </div>
      </header>

      {abrindo ? <FormularioDeOs produtos={produtos} lojas={lojas} abrir={abrir} onAberta={(os) => { setAberta(os); setAbrindo(false); }} /> : null}
      {aberta ? (
        <p role="status" className="mt-3 flex items-center gap-2 rounded-[12px] bg-[#e3f4ec] p-3 text-sm font-semibold text-[#046c4e]">
          <Check size={16} aria-hidden="true" /> OS {aberta} aberta. Ela já está na fila da fábrica, em {nomeDaEtapa("a_produzir", etapas)}.
        </p>
      ) : null}

      {fila === null ? (
        <p className="glass mt-6 rounded-[18px] p-5 text-sm text-muted">
          <span className="font-semibold text-ink">Não deu para ler a fábrica agora.</span> Recarregue a página em alguns segundos.
        </p>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <label className="relative min-w-0 flex-1 basis-60">
              <span className="sr-only">Buscar pedido, OS ou cliente</span>
              <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
              <input
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Número do pedido, OS, cliente ou peça"
                className="h-11 w-full rounded-full border border-ink/12 bg-white pl-10 pr-4 text-sm text-ink outline-none placeholder:text-muted focus:border-[var(--setor)]"
              />
            </label>
            {buscando ? null : (
              <div role="group" aria-label="Quais pedidos" className="flex gap-1 rounded-full border border-border bg-surface/60 p-1">
                {(["andando", "sairam"] as const).map((q) => (
                  <button
                    key={q}
                    type="button"
                    aria-pressed={quais === q}
                    onClick={() => setQuais(q)}
                    className={"whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold " + (quais === q ? "painel-aba-ativa" : "text-muted hover:text-ink")}
                  >
                    {q === "andando" ? "Na fábrica agora" : "Já saíram"}
                  </button>
                ))}
              </div>
            )}
          </div>
          <p className="mt-2 text-xs text-muted" aria-live="polite">
            {buscando ? `${visiveis.length} com "${busca.trim()}", em todas as etapas.` : `${visiveis.length} ${visiveis.length === 1 ? "trabalho" : "trabalhos"}.`}
            {comAlteracao > 0 ? ` ${comAlteracao} com alteração que a fábrica ainda não viu.` : ""}
          </p>

          <ul className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
            {visiveis.slice(0, 120).map((p) => (
              <CartaoDoVendedor key={p.ref} p={p} etapas={etapas} agora={agora} pedirAlteracao={pedirAlteracao} />
            ))}
          </ul>
          {visiveis.length > 120 ? <p className="mt-3 text-xs text-muted">Mostrando 120. Busque pelo número para achar o resto.</p> : null}
          {visiveis.length === 0 ? <p className="glass mt-3 rounded-[18px] p-6 text-sm text-muted">Nenhum trabalho aqui. Confira o número ou busque pelo nome do cliente.</p> : null}
        </>
      )}
    </div>
  );
}

function CartaoDoVendedor({ p, etapas, agora, pedirAlteracao }: { p: PedidoDaFabrica; etapas: FilaDaFabrica["etapas"]; agora: number; pedirAlteracao: PedirAlteracao }) {
  const router = useRouter();
  const [ocupado, comecar] = useTransition();
  const [copiada, setCopiada] = useState(false);
  const [pedindo, setPedindo] = useState(false);
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const etapa = etapas.find((e) => e.chave === p.etapa);
  const nome = nomeDaEtapa(p.etapa, etapas);
  const frase = fraseParaOCliente({ cliente: p.cliente, pedido: p.pedido ?? p.pedidoOrigem, etapa: p.etapa, nomeDaEtapa: nome, rastreio: p.rastreio });
  const tempo = tempoNaEtapa(p.etapaEm, agora);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(frase);
      setCopiada(true);
      setTimeout(() => setCopiada(false), 2500);
    } catch {
      setErro("O navegador não deixou copiar. Selecione a frase e copie.");
    }
  };

  const enviar = () =>
    comecar(async () => {
      setErro(null);
      const r = await pedirAlteracao(p.ref, texto);
      if (r.ok) {
        setTexto("");
        setPedindo(false);
        avisarOTime("fila-da-fabrica");
        router.refresh();
      } else setErro(r.erro);
    });

  return (
    <li className="glass flex min-w-0 flex-col rounded-[16px] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          {p.os ? (
            <p className="numeros text-xl font-bold leading-none text-ink">
              <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-muted">OS</span>
              {p.os}
            </p>
          ) : null}
          <p className="numeros mt-1 text-sm font-bold text-ink">{nomeDoTrabalho(p)}</p>
          <p className="break-words text-xs text-muted">{p.cliente ?? "Cliente sem nome"}</p>
        </div>
        <p
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold text-white"
          style={{ background: etapa?.cor ?? "#5b6472" }}
        >
          {nome}
          {tempo && !ehFinal(p.etapa) ? <span className="font-semibold opacity-90">há {tempo}</span> : null}
        </p>
      </div>

      {p.tipo !== "venda_nova" || p.prioridade !== "normal" ? (
        <p className="mt-2 text-xs font-bold" style={{ color: "#8a3b06" }}>
          {[p.tipo !== "venda_nova" ? NOME_DO_TIPO[p.tipo] : null, p.prioridade === "urgente" ? "Urgente" : p.prioridade === "motoboy" ? "Motoboy" : null].filter(Boolean).join(" / ")}
        </p>
      ) : null}
      <p className="mt-2 text-xs text-ink">{p.pecas.map((x) => `${x.quantidade}× ${nomeLimpo(x.nome)}`).join(", ")}</p>

      {/* A linha do tempo das etapas: onde o pedido está e o que falta. */}
      <ol className="mt-3 flex flex-wrap gap-1" aria-label="Etapas">
        {etapasAtivas(etapas)
          .filter((e) => e.chave !== "entregue")
          .map((e) => {
            const ordem = etapasAtivas(etapas).map((x) => x.chave);
            const passou = ordem.indexOf(e.chave) < ordem.indexOf(p.etapa);
            const aqui = e.chave === p.etapa;
            return (
              <li
                key={e.chave}
                aria-current={aqui ? "step" : undefined}
                title={e.nome}
                className="h-1.5 min-w-4 flex-1 rounded-full"
                style={{ background: aqui || passou ? e.cor : "rgba(26,24,21,0.12)", opacity: passou ? 0.55 : 1 }}
              />
            );
          })}
      </ol>

      <AlteracoesDoTrabalho lista={p.alteracoes} />

      <blockquote className="mt-3 rounded-[10px] border border-ink/10 bg-white p-2.5 text-xs leading-relaxed text-ink">{frase}</blockquote>

      {pedindo ? (
        <div className="mt-3 space-y-2">
          <label className="block">
            <span className={rotulo}>O que o cliente pediu para mudar</span>
            <textarea value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={500} rows={3} autoFocus placeholder="Ex.: trocar a gravação do aro 02 para Maria e João" className={`${campo} mt-1`} />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={ocupado || texto.trim().length < 3} onClick={enviar} className="painel-toque painel-aba-ativa inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-xs font-semibold disabled:opacity-60">
              {ocupado ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : null} Mandar para a fábrica
            </button>
            <button type="button" onClick={() => setPedindo(false)} className="painel-toque inline-flex h-10 items-center rounded-full border border-ink/12 bg-white px-4 text-xs font-semibold text-ink">
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={copiar} className="painel-toque inline-flex h-10 items-center gap-1.5 rounded-full border border-ink/12 bg-white px-3.5 text-xs font-semibold text-ink">
            {copiada ? <Check size={14} aria-hidden="true" /> : <ClipboardCopy size={14} aria-hidden="true" />} {copiada ? "Copiada" : "Copiar a frase"}
          </button>
          {ehFinal(p.etapa) ? null : (
            <button type="button" onClick={() => setPedindo(true)} className="painel-toque inline-flex h-10 items-center gap-1.5 rounded-full border border-ink/12 bg-white px-3.5 text-xs font-semibold text-ink">
              <MessageSquareWarning size={14} aria-hidden="true" /> Pedir alteração
            </button>
          )}
          {p.pedido !== null ? <BotaoDoHistorico numero={p.pedido} /> : null}
          <BotaoDeGarantia referencia={p.ref} emitir={emitirGarantiaNaVenda} className="painel-toque inline-flex h-10 items-center gap-1.5 rounded-full border border-ink/12 bg-white px-3.5 text-xs font-semibold text-ink disabled:opacity-60" />
        </div>
      )}
      {erro ? <p className="mt-2 text-xs font-semibold text-[#b01919]">{erro}</p> : null}
    </li>
  );
}

function FormularioDeOs({ produtos, lojas, abrir, onAberta }: { produtos: ProdutoDoFormulario[]; lojas: string[]; abrir: AbrirOs; onAberta: (os: number) => void }) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [ocupado, comecar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  // `onSubmit`, não `action`: com `action` o React apaga o formulário quando a ação volta com erro (ver CLAUDE.md).
  const enviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const dados = new FormData(e.currentTarget);
    comecar(async () => {
      setErro(null);
      const r = await abrir(dados);
      if (r.ok) {
        avisarOTime("fila-da-fabrica");
        onAberta(r.os);
        router.refresh();
      } else setErro(r.erro);
    });
  };

  return (
    <form ref={form} onSubmit={enviar} className="glass mt-4 grid grid-cols-1 gap-3 rounded-[18px] p-4 sm:grid-cols-2">
      <h2 className="text-base font-semibold text-ink sm:col-span-2">Abrir OS na fábrica</h2>
      <div className="min-w-0">
        <label className={rotulo} htmlFor="os-tipo">O que é</label>
        <select id="os-tipo" name="tipo" defaultValue="troca" className={campo}>
          {TIPOS.map((t) => (
            <option key={t.chave} value={t.chave}>{t.nome}</option>
          ))}
        </select>
      </div>
      <div className="min-w-0">
        <label className={rotulo} htmlFor="os-prioridade">Prioridade</label>
        <select id="os-prioridade" name="prioridade" defaultValue="normal" className={campo}>
          {PRIORIDADES.map((p) => (
            <option key={p.chave} value={p.chave}>{p.nome}</option>
          ))}
        </select>
      </div>
      <div className="min-w-0">
        <label className={rotulo} htmlFor="os-origem">Pedido de origem (se houver)</label>
        <input id="os-origem" name="pedido_origem" inputMode="numeric" maxLength={12} placeholder="Ex.: 11389" className={`${campo} numeros`} />
      </div>
      <div className="min-w-0">
        <label className={rotulo} htmlFor="os-prazo">Cliente precisa até</label>
        <input id="os-prazo" name="prazo" type="date" className={`${campo} numeros`} />
      </div>
      <div className="min-w-0">
        <label className={rotulo} htmlFor="os-nome">Nome do cliente</label>
        <input id="os-nome" name="cliente_nome" maxLength={120} placeholder="Sem pedido de origem, é obrigatório" className={campo} />
      </div>
      <div className="min-w-0">
        <label className={rotulo} htmlFor="os-telefone">WhatsApp do cliente</label>
        <input id="os-telefone" name="cliente_telefone" inputMode="tel" maxLength={30} placeholder="(11) 99999-9999" className={`${campo} numeros`} />
      </div>
      <div className="min-w-0 sm:col-span-2">
        <label className={rotulo} htmlFor="os-relato">O que fazer (o que o cliente disse)</label>
        <textarea id="os-relato" name="relato" maxLength={1000} rows={3} placeholder="Ex.: a pedra do solitário caiu; trocar a aliança do 16 pelo 17" className={campo} />
      </div>
      <ProducaoDaVenda produtos={produtos} lojas={lojas} sempreLigada />
      <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
        <button type="submit" disabled={ocupado} className="painel-toque painel-aba-ativa inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold disabled:opacity-60">
          {ocupado ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : null} Abrir a OS
        </button>
        {erro ? <p role="alert" className="text-sm font-semibold text-[#b01919]">{erro}</p> : null}
      </div>
    </form>
  );
}
