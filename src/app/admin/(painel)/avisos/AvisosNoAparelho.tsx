"use client";

import { useState } from "react";
import Link from "next/link";
import { BellOff, BellRing, CircleCheck, Laptop, Loader2, Send, Share, Smartphone, SquarePlus, TriangleAlert, Volume2, VolumeX } from "lucide-react";
import { COR_DO_TOM } from "@/lib/painel/tons";
import { CATEGORIAS, NOME_DA_CATEGORIA, type Categoria } from "@/lib/avisos/push";
import { desligarAparelho, desligarPush, escolherAvisos, ligarPush, ligarSom, testarPush, usePush, useSom, type AparelhoLigado } from "@/lib/avisos/cliente";
import { botaoCheio, botaoClaro } from "../biblioteca/pecas";

/**
 * Ligar o aviso por push neste aparelho (cartão 59): o bloco do chat
 * (`compacto`) e a tela Avisos, do Time.
 *
 * O que a tela oferece sai da CAPACIDADE do navegador (`estadoDoPush`), nunca
 * do nome do aparelho. No iPhone fora do app instalado não há push: a tela
 * ensina a adicionar à tela de início e só depois oferece ligar.
 *
 * `categorias` são as que a pessoa pode receber (o suporte e a Kommo dependem
 * do acesso), para a escolha do que avisa. Ligar liga tudo: o banco só manda o
 * que o acesso da pessoa permite.
 */
export function AvisosNoAparelho({ compacto = false, categorias = ["chat"] }: { compacto?: boolean; categorias?: readonly Categoria[] }) {
  const p = usePush();
  const som = useSom();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [recado, setRecado] = useState<{ tom: "bom" | "ruim"; texto: string } | null>(null);

  const rodar = async (qual: string, f: () => Promise<string | null>, ok?: string) => {
    setOcupado(qual);
    setRecado(null);
    const erro = await f();
    setOcupado(null);
    if (erro) setRecado({ tom: "ruim", texto: erro });
    else if (ok) setRecado({ tom: "bom", texto: ok });
  };

  const deste = p.aparelhos.find((a) => a.endpoint === p.endpoint) ?? null;
  const outros = p.aparelhos.filter((a) => a.endpoint !== p.endpoint);
  const caixa = "rounded-[12px] border border-ink/[0.07] bg-white p-3";
  const titulo = "flex items-center gap-1.5 text-xs font-bold";
  const texto = "mt-1 text-[0.72rem] leading-relaxed text-muted";

  const botaoDoSom = (
    <button type="button" onClick={() => ligarSom(!som)} aria-pressed={som} className={`${botaoClaro} h-9`}>
      {som ? <Volume2 size={13} aria-hidden="true" /> : <VolumeX size={13} aria-hidden="true" />}
      {som ? "Som ligado com o painel aberto" : "Som desligado"}
    </button>
  );

  const recadoNaTela = recado ? (
    <p role="status" className="mt-2 rounded-[10px] px-2.5 py-1.5 text-[0.72rem] font-medium" style={{ background: COR_DO_TOM[recado.tom].fundo, color: COR_DO_TOM[recado.tom].texto }}>
      {recado.texto}
    </p>
  ) : null;

  let principal: React.ReactNode;
  if (p.carregando) {
    principal = (
      <div className={caixa}>
        <p className={`${titulo} text-muted`}>
          <Loader2 size={13} className="animate-spin" aria-hidden="true" /> Conferindo os avisos deste aparelho
        </p>
      </div>
    );
  } else if (p.estado === "instalar") {
    principal = (
      <div className={caixa}>
        <p className={`${titulo} text-ink`}>
          <Smartphone size={13} className="painel-cor" aria-hidden="true" /> No iPhone, o aviso só chega com o painel instalado
        </p>
        <p className={texto}>Leva um minuto, e só uma vez:</p>
        <ol className="mt-2 space-y-2 text-[0.75rem] leading-snug text-ink">
          <li className="flex gap-2">
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-ink text-[0.65rem] font-bold text-brand-light">1</span>
            <span>
              No Safari, toque em <b>Compartilhar</b> <Share size={12} className="inline align-[-1px]" aria-label="(o quadrado com a seta para cima)" />, na barra de baixo.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-ink text-[0.65rem] font-bold text-brand-light">2</span>
            <span>
              Escolha <b>Adicionar à Tela de Início</b> <SquarePlus size={12} className="inline align-[-1px]" aria-hidden="true" /> e confirme em Adicionar.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-ink text-[0.65rem] font-bold text-brand-light">3</span>
            <span>
              Abra o painel pelo ícone <b>Painel JK</b> que apareceu na tela de início, entre de novo e volte aqui: o botão de ligar aparece.
            </span>
          </li>
        </ol>
        <p className={`${texto} mt-2`}>Precisa do iOS 16.4 ou mais novo. Se o botão não aparecer no app, atualize o iPhone em Ajustes, Geral, Atualização de Software.</p>
      </div>
    );
  } else if (p.estado === "sem_suporte") {
    principal = (
      <div className={caixa}>
        <p className={`${titulo} text-ink`}>
          <BellOff size={13} aria-hidden="true" /> Este navegador não recebe aviso com o painel fechado
        </p>
        <p className={texto}>No computador, use o Chrome, o Edge, o Safari ou o Firefox atualizados. No celular Android, o Chrome. No iPhone, o painel instalado na tela de início.</p>
      </div>
    );
  } else if (p.estado === "bloqueado") {
    principal = (
      <div className="rounded-[12px] p-3" style={{ background: COR_DO_TOM.atencao.fundo, color: COR_DO_TOM.atencao.texto }}>
        <p className={titulo}>
          <TriangleAlert size={13} aria-hidden="true" /> O aviso deste site foi bloqueado neste aparelho
        </p>
        <p className="mt-1 text-[0.72rem] leading-relaxed">
          No computador, clique no cadeado ao lado do endereço e libere as notificações. No celular, abra os ajustes de notificação do navegador (ou do app Painel JK) e libere. Depois, recarregue a página.
        </p>
      </div>
    );
  } else if (p.estado === "desligado") {
    principal = (
      <div className={caixa}>
        <p className={`${titulo} text-ink`}>
          <BellRing size={13} className="painel-cor" aria-hidden="true" /> Avisos neste aparelho
        </p>
        <p className={texto}>
          Receba aviso de mensagem do time{categorias.length > 1 ? ", de caso de suporte e de cliente esperando" : ""} mesmo com o painel fechado, com o som do aparelho. O aviso mostra só quem escreveu e o começo do texto, nunca telefone ou valor de cliente.
        </p>
        <button type="button" disabled={ocupado !== null} onClick={() => rodar("ligar", () => ligarPush(), "Avisos ligados neste aparelho.")} className={`${botaoCheio} mt-2 h-9`}>
          {ocupado === "ligar" ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <BellRing size={13} aria-hidden="true" />}
          {ocupado === "ligar" ? "Esperando o aparelho" : "Ligar os avisos neste aparelho"}
        </button>
      </div>
    );
  } else {
    principal = (
      <div className={caixa}>
        <p className={titulo} style={{ color: COR_DO_TOM.bom.texto }}>
          <CircleCheck size={13} aria-hidden="true" /> Avisos ligados neste aparelho
        </p>
        <p className={texto}>Com o painel fechado ou em segundo plano, o aparelho avisa e toca. Com o painel à vista, não chega aviso: a tela já mostra.</p>
        {!compacto && deste && categorias.length > 1 ? (
          <fieldset className="mt-2">
            <legend className="text-[0.72rem] font-semibold text-ink">O que avisa aqui</legend>
            <div className="mt-1 flex flex-wrap gap-2">
              {CATEGORIAS.filter((c) => categorias.includes(c)).map((c) => {
                const marcado = deste.avisar.includes(c);
                return (
                  <label key={c} className="inline-flex min-h-9 items-center gap-2 rounded-full border border-ink/12 bg-white px-3 text-xs text-ink">
                    <input
                      type="checkbox"
                      checked={marcado}
                      disabled={ocupado !== null}
                      onChange={() => rodar("escolher", () => escolherAvisos(marcado ? deste.avisar.filter((x) => x !== c) : [...deste.avisar, c]))}
                      className="h-4 w-4 accent-[var(--setor)]"
                    />
                    {NOME_DA_CATEGORIA[c]}
                  </label>
                );
              })}
            </div>
          </fieldset>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" disabled={ocupado !== null} onClick={() => rodar("teste", testarPush, "Aviso de teste enviado. Deve chegar em alguns segundos.")} className={`${botaoCheio} h-9`}>
            {ocupado === "teste" ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Send size={13} aria-hidden="true" />}
            Mandar um aviso de teste
          </button>
          <button type="button" disabled={ocupado !== null} onClick={() => rodar("desligar", desligarPush)} className={`${botaoClaro} h-9`}>
            <BellOff size={13} aria-hidden="true" /> Desligar aqui
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {principal}
      {recadoNaTela}
      <div className="flex flex-wrap items-center gap-2">
        {botaoDoSom}
        {compacto ? (
          <Link href="/admin/avisos" className="text-xs font-semibold text-brand-nav underline underline-offset-2">
            Mais opções de aviso
          </Link>
        ) : null}
      </div>
      {!compacto && outros.length > 0 ? <ListaDeAparelhos aparelhos={outros} ocupado={ocupado} rodar={rodar} /> : null}
    </div>
  );
}

function ListaDeAparelhos({
  aparelhos,
  ocupado,
  rodar,
}: {
  aparelhos: AparelhoLigado[];
  ocupado: string | null;
  rodar: (qual: string, f: () => Promise<string | null>, ok?: string) => Promise<void>;
}) {
  const quando = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }) : "ainda não recebeu";
  return (
    <section className="rounded-[12px] border border-ink/[0.07] bg-white p-3" aria-label="Outros aparelhos ligados">
      <p className="text-xs font-bold text-ink">Outros aparelhos com aviso ligado</p>
      <ul className="mt-2 divide-y divide-ink/[0.06]">
        {aparelhos.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <div className="flex min-w-0 items-center gap-2">
              {a.tipo === "celular" ? <Smartphone size={15} className="shrink-0 text-muted" aria-hidden="true" /> : <Laptop size={15} className="shrink-0 text-muted" aria-hidden="true" />}
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-ink">{a.navegador ?? (a.tipo === "celular" ? "Celular" : "Computador")}</p>
                <p className="text-[0.68rem] text-muted">
                  Último aviso: {quando(a.usado_em)}
                  {a.ultimo_erro ? " · com erro na última tentativa" : ""}
                </p>
              </div>
            </div>
            <button type="button" disabled={ocupado !== null} onClick={() => rodar(`d${a.id}`, () => desligarAparelho(a.id), "Aparelho desligado.")} className={`${botaoClaro} h-9`}>
              {ocupado === `d${a.id}` ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <BellOff size={13} aria-hidden="true" />}
              Desligar
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
