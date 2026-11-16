"use client";

import { useState } from "react";
import Link from "next/link";
import { BookCheck, BookPlus, Check, CircleUserRound, Hand, Images, Loader2, MessageCircle, Undo2, X } from "lucide-react";
import { COR_DO_TOM } from "@/lib/painel/tons";
import { ABERTOS, NOME_DO_ASSUNTO, esperaDoCaso, linkDoWhatsapp, rascunhoDaBiblioteca, telefoneLegivel, type Caso } from "@/lib/suporte/casos";
import { NOME_DA_ETAPA, diaDe, horaCurta, rotuloDoDia } from "@/lib/time/chat";
import { SeloDeTom } from "../Pecas";
import { FormularioDeResposta } from "../biblioteca/FormularioDeResposta";
import { botaoCheio, botaoClaro, campo } from "../biblioteca/pecas";
import type { ApiDoSuporte } from "./api";

/**
 * Um caso de suporte, do jeito que o gerente precisa para não perguntar de
 * novo: o assunto, o relógio, o cliente (com o WhatsApp e a ficha), o que ele
 * disse e o print. Para quem atende, os botões de assumir e de fechar; para
 * quem passou, o estado e a nota de quem fechou.
 *
 * O relógio é a régua de `esperaDoCaso`, sempre com ícone e palavra. Fechar
 * pede a nota, porque é ela que o vendedor lê.
 */

function quando(iso: string | null, agora: number): string {
  if (!iso) return "";
  const dia = diaDe(iso);
  const nome = dia === diaDe(agora) ? "hoje" : rotuloDoDia(dia, agora).toLowerCase();
  return `${nome} às ${horaCurta(iso)}`;
}

const primeiro = (nome: string | null) => (nome ?? "").trim().split(/\s+/)[0] || "alguém";

export function CartaoDoCaso({
  c, agora, atende, meuId, api, novo, onMudou,
}: {
  c: Caso;
  agora: number;
  atende: boolean;
  meuId: string;
  api: ApiDoSuporte;
  /** Fechou e quem passou ainda não tinha visto: ganha a marca "Novo" nesta visita. */
  novo?: boolean;
  onMudou: () => void;
}) {
  const [fechando, setFechando] = useState(false);
  const [nota, setNota] = useState("");
  const [ocupado, setOcupado] = useState<null | "assumir" | "resolvido" | "devolvido">(null);
  const [erro, setErro] = useState<string | null>(null);
  const [prints, setPrints] = useState<string[] | null>(null);
  const [buscandoPrints, setBuscandoPrints] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const aberto = ABERTOS.includes(c.estado);
  const meu = c.assumidoPor === meuId && c.estado === "com_suporte";
  // O caso que está com a própria pessoa diz "Com você", e não o nome dela.
  const espera = esperaDoCaso(meu ? { ...c, assumidoPorNome: "você" } : c, agora);
  const whatsapp = linkDoWhatsapp(c.cliente.telefone);

  const assumir = async () => {
    setOcupado("assumir");
    setErro(null);
    const r = await api.assumir(c.id);
    setOcupado(null);
    if (!r.ok) return setErro(r.erro);
    api.avisar();
    onMudou();
  };

  const fechar = async (resultado: "resolvido" | "devolvido") => {
    setOcupado(resultado);
    setErro(null);
    const r = await api.fechar(c.id, resultado, nota);
    setOcupado(null);
    if (!r.ok) return setErro(r.erro);
    setFechando(false);
    setNota("");
    api.avisar();
    onMudou();
  };

  const verPrints = async () => {
    if (prints) return setPrints(null);
    setBuscandoPrints(true);
    const links = await api.prints(c.id);
    setBuscandoPrints(false);
    if (links.length === 0) return setErro("Não deu para abrir os prints agora. Tente de novo.");
    setPrints(links);
  };

  const cliente = [c.cliente.nome, telefoneLegivel(c.cliente.telefone)].filter(Boolean).join(", ") || "Cliente sem nome";
  const pedido = c.cliente.pedido
    ? `Pedido ${c.cliente.pedido}${c.cliente.etapa ? `, ${NOME_DA_ETAPA[c.cliente.etapa] ?? c.cliente.etapa}` : c.cliente.situacao ? `, ${c.cliente.situacao}` : ""}`
    : null;

  return (
    <li className="glass min-w-0 rounded-[16px] p-3.5 sm:p-4" aria-label={`Caso ${c.id}: ${NOME_DO_ASSUNTO[c.assunto]}`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <span className="text-[0.68rem] font-bold uppercase tracking-wider text-muted">Caso {c.id}</span>
        {novo ? (
          <span className="rounded-full bg-wine px-1.5 py-0.5 text-[0.62rem] font-bold leading-none text-white">Novo</span>
        ) : null}
        {c.urgente && aberto ? <SeloDeTom tom="ruim">Cliente esperando</SeloDeTom> : null}
        <span className="ml-auto">
          <SeloDeTom tom={espera.tom}>{espera.palavra}</SeloDeTom>
        </span>
      </div>

      <p className="mt-1.5 text-[1.02rem] font-bold leading-snug text-ink">{NOME_DO_ASSUNTO[c.assunto]}</p>
      <p className="mt-0.5 text-sm leading-snug text-ink [overflow-wrap:anywhere]">
        <CircleUserRound size={13} className="mr-1 inline-block -translate-y-px text-muted" aria-hidden="true" />
        {cliente}
        {pedido ? <span className="text-muted"> · {pedido}</span> : null}
      </p>

      <blockquote className="mt-2 whitespace-pre-line rounded-[12px] bg-ink/[0.04] px-3 py-2 text-sm leading-relaxed text-ink [overflow-wrap:anywhere]">
        {c.relato}
      </blockquote>

      {c.imagens > 0 ? (
        <div className="mt-2">
          <button type="button" onClick={() => void verPrints()} aria-expanded={prints !== null} className={botaoClaro}>
            {buscandoPrints ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Images size={14} aria-hidden="true" />}
            {prints ? "Esconder os prints" : c.imagens === 1 ? "Ver o print" : `Ver os ${c.imagens} prints`}
          </button>
          {prints ? (
            <ul className="mt-2 flex flex-wrap gap-2">
              {prints.map((url, i) => (
                <li key={url}>
                  <a href={url} target="_blank" rel="noreferrer noopener" className="block" aria-label={`Abrir o print ${i + 1} em outra aba`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`Print ${i + 1} da conversa com o cliente`} className="h-24 w-24 rounded-[10px] border border-ink/12 bg-white object-cover" />
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <p className="mt-2 text-xs leading-relaxed text-muted">
        Passado por {c.abertoPor === meuId ? "você" : primeiro(c.abertoPorNome)} {quando(c.abertoEm, agora)}
        {c.assumidoEm && c.estado === "com_suporte" ? `. Com ${meu ? "você" : primeiro(c.assumidoPorNome)} desde ${quando(c.assumidoEm, agora)}` : ""}.
      </p>

      {!aberto && c.nota ? (
        <p
          className="mt-2 rounded-[12px] px-3 py-2 text-sm leading-relaxed [overflow-wrap:anywhere]"
          style={c.estado === "resolvido" ? { background: COR_DO_TOM.bom.fundo, color: COR_DO_TOM.bom.texto } : { background: COR_DO_TOM.atencao.fundo, color: COR_DO_TOM.atencao.texto }}
        >
          <span className="font-bold">
            {c.estado === "resolvido" ? `Resolvido por ${primeiro(c.fechadoPorNome)}` : `Voltou para ${c.abertoPor === meuId ? "você" : "o vendedor"}`} {quando(c.fechadoEm, agora)}:
          </span>{" "}
          {c.nota}
        </p>
      ) : null}

      {/* O que dá para fazer com o caso. */}
      <div className="mt-3 flex flex-wrap gap-2">
        {atende && whatsapp ? (
          <a href={whatsapp} target="_blank" rel="noreferrer noopener" className={botaoClaro}>
            <MessageCircle size={14} aria-hidden="true" /> WhatsApp do cliente
          </a>
        ) : null}
        {c.cliente.ref ? (
          <Link href={`/admin/clientes/${c.cliente.ref}`} className={botaoClaro}>
            <CircleUserRound size={14} aria-hidden="true" /> Ficha
          </Link>
        ) : null}
        {atende && aberto && !meu ? (
          <button type="button" disabled={ocupado !== null} onClick={() => void assumir()} className={c.estado === "na_fila" ? botaoCheio : botaoClaro}>
            {ocupado === "assumir" ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Hand size={14} aria-hidden="true" />}
            {c.estado === "na_fila" ? "Assumir" : "Assumir no lugar"}
          </button>
        ) : null}
        {atende && aberto && !fechando ? (
          <button type="button" onClick={() => setFechando(true)} className={meu ? botaoCheio : botaoClaro}>
            <Check size={14} aria-hidden="true" /> Fechar o caso
          </button>
        ) : null}
        {atende && c.estado === "resolvido" && !c.naBiblioteca && !guardando ? (
          <button type="button" onClick={() => setGuardando(true)} className={botaoClaro}>
            <BookPlus size={14} aria-hidden="true" /> Guardar na biblioteca
          </button>
        ) : null}
        {c.naBiblioteca ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: COR_DO_TOM.bom.texto }}>
            <BookCheck size={13} aria-hidden="true" /> Na biblioteca, a confirmar
          </span>
        ) : null}
      </div>

      {fechando ? (
        <div className="mt-3 rounded-[12px] border border-ink/10 bg-white p-3">
          <label className="block">
            <span className="text-xs font-semibold text-ink">O que foi feito (o vendedor lê isto)</span>
            <textarea
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              rows={2}
              maxLength={1000}
              autoFocus
              placeholder="Ex.: Pedi para trazer na loja; a fábrica repõe a pedra em 5 dias."
              className={`${campo} resize-y`}
            />
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" disabled={ocupado !== null} onClick={() => void fechar("resolvido")} className={botaoCheio}>
              {ocupado === "resolvido" ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Check size={14} aria-hidden="true" />} Resolvido
            </button>
            <button type="button" disabled={ocupado !== null} onClick={() => void fechar("devolvido")} className={botaoClaro} title="Não é suporte: o caso volta ao vendedor, com o motivo">
              {ocupado === "devolvido" ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Undo2 size={14} aria-hidden="true" />} Devolver ao vendedor
            </button>
            <button type="button" disabled={ocupado !== null} onClick={() => setFechando(false)} className={botaoClaro}>
              <X size={14} aria-hidden="true" /> Cancelar
            </button>
          </div>
        </div>
      ) : null}

      {guardando ? (
        <div className="mt-3 rounded-[12px] border border-ink/10 bg-white p-3">
          <p className="text-sm font-semibold text-ink">Guardar na biblioteca</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted">A próxima pessoa acha na busca, e o tutor passa a usar. Entra como &quot;a confirmar&quot;.</p>
          <div className="mt-3">
            <FormularioDeResposta
              comOrigem={false}
              inicial={rascunhoDaBiblioteca(c)}
              rotuloDoBotao="Salvar na biblioteca"
              aviso={
                <p className="rounded-[10px] p-2.5 text-xs font-semibold leading-relaxed" style={{ background: COR_DO_TOM.atencao.fundo, color: COR_DO_TOM.atencao.texto }}>
                  Tire nome, telefone e número de pedido, e escreva do jeito que serve para o próximo caso. A origem (este caso) é escrita sozinha.
                </p>
              }
              onSalvar={async (r) => {
                const feito = await api.virarResposta(c.id, r);
                if (!feito.ok) return feito;
                setGuardando(false);
                onMudou();
                return { ok: true };
              }}
              onCancelar={() => setGuardando(false)}
            />
          </div>
        </div>
      ) : null}

      {erro ? (
        <p role="alert" className="mt-2 text-xs font-semibold" style={{ color: COR_DO_TOM.ruim.texto }}>
          {erro}
        </p>
      ) : null}
    </li>
  );
}
