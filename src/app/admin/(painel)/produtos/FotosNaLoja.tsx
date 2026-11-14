"use client";

import { useState, useTransition } from "react";
import { ArrowRight, Check, Clock, ImageUp, Loader2, TriangleAlert } from "lucide-react";
import type { PreviaDeFotos, ResultadoDeFotos } from "@/lib/loja/alterar";
import type { Troca } from "@/lib/loja/imagens";

/**
 * Levar as fotos aprovadas para a loja, direto pela API, de dentro da gaveta.
 *
 * É o mesmo desenho de "Editar na loja", em dois passos que não se pulam:
 *   1. conferir: o painel lê as fotos que a loja mostra AGORA e diz, posição
 *      por posição, qual foto sai e qual entra. A foto nova substitui a que
 *      está naquele lugar, então a pessoa precisa ver o que vai perder;
 *   2. enviar: as fotos vão para a Tray e o painel espera até vê-las no
 *      produto. A Tray responde "enviado" mesmo quando descarta a foto, e por
 *      isso o resultado aqui é o que o painel leu de volta, não o que ela disse.
 *
 * As ações vêm de fora, como propriedade, para a tela poder ser vista sem sessão.
 */

type Acoes = {
  prever: (productId: string) => Promise<PreviaDeFotos>;
  levar: (productId: string) => Promise<ResultadoDeFotos>;
};

const NOME: Record<Troca["tipo"], string> = { produto: "Produto", face: "Face", uso: "Uso" };
const NAO_AUTORIZADA =
  "A loja ainda não está ligada ao painel para alterações. Isso se faz em Integrações, no cartão da Tray, depois de a Tray liberar o aplicativo. Enquanto isso, as fotos vão pela planilha.";

function Miniatura({ url, rotulo }: { url: string | null; rotulo: string }) {
  return (
    <figure className="min-w-0 flex-1">
      <div className="grid aspect-square w-full place-items-center overflow-hidden rounded-[10px] border border-border bg-white">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="h-full w-full object-contain" loading="lazy" />
        ) : (
          <span className="px-2 text-center text-[0.68rem] text-muted">Sem foto nessa posição</span>
        )}
      </div>
      <figcaption className="mt-1 text-center text-[0.68rem] text-muted">{rotulo}</figcaption>
    </figure>
  );
}

function LinhaDaTroca({ t }: { t: Troca }) {
  return (
    <li className="rounded-[12px] border border-border bg-white/70 p-3">
      <p className="text-xs font-semibold text-ink">
        {NOME[t.tipo]} <span className="font-normal text-muted">na posição {t.ficaEm}</span>
      </p>
      {t.jaEsta ? (
        <div className="mx-auto mt-2 max-w-[7.5rem]">
          <Miniatura url={t.depois} rotulo="Já é a foto da loja" />
          <p className="mt-1.5 flex items-center justify-center gap-1 text-[0.68rem] font-semibold text-[#046c4e]">
            <Check size={12} aria-hidden="true" /> Não vai de novo
          </p>
        </div>
      ) : (
        <div className="mt-2 flex items-center gap-2">
          <Miniatura url={t.antes?.miniatura ?? null} rotulo={t.antes ? "Sai da loja" : "Hoje"} />
          <ArrowRight size={16} className="shrink-0 text-muted" aria-hidden="true" />
          <Miniatura url={t.depois} rotulo="Entra" />
        </div>
      )}
    </li>
  );
}

export function FotosNaLoja({ productId, acoes, onFeito }: { productId: string; acoes: Acoes; onFeito?: () => void }) {
  const [previa, setPrevia] = useState<Extract<PreviaDeFotos, { estado: "previa" }> | null>(null);
  const [resultado, setResultado] = useState<Extract<ResultadoDeFotos, { estado: "ok" }> | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, comecar] = useTransition();
  const [enviando, setEnviando] = useState(false);

  const conferir = () =>
    comecar(async () => {
      setErro(null);
      setResultado(null);
      const r = await acoes.prever(productId);
      if (r.estado === "previa") setPrevia(r);
      else if (r.estado === "nao_autorizada") setErro(NAO_AUTORIZADA);
      else if (r.estado === "nao_achado") setErro("A Tray não achou este produto. Ele pode ter sido apagado na loja.");
      else setErro(r.erro);
    });

  const enviar = () =>
    comecar(async () => {
      setErro(null);
      setEnviando(true);
      try {
        const r = await acoes.levar(productId);
        if (r.estado === "ok") {
          setResultado(r);
          setPrevia(null);
          if (r.entraram.length > 0) onFeito?.();
        } else if (r.estado === "nao_autorizada") setErro(NAO_AUTORIZADA);
        else if (r.estado === "nao_achado") setErro("A Tray não achou este produto. Ele pode ter sido apagado na loja.");
        else setErro(r.erro);
      } catch {
        setErro("O envio demorou mais do que o painel espera. Abra o produto na loja para ver se as fotos entraram antes de mandar de novo.");
      } finally {
        setEnviando(false);
      }
    });

  return (
    <section className="mt-6 rounded-[14px] border border-border bg-white/60 p-4" aria-label="Levar as fotos para a loja">
      <p className="flex items-center gap-2 text-sm font-semibold text-ink">
        <ImageUp size={15} className="shrink-0 text-brand-nav" aria-hidden="true" /> Levar as fotos aprovadas para a loja
      </p>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        Direto pela Tray, sem planilha. Produto vai na posição 1, face na 2 e uso na 3. A foto nova entra no lugar da que a
        loja mostra hoje naquela posição.
      </p>

      {resultado ? (
        <div className="mt-3 space-y-2">
          {resultado.entraram.length > 0 ? (
            <p className="flex items-start gap-2 rounded-[10px] bg-[#e3f4ec] p-3 text-xs font-semibold text-[#046c4e]">
              <Check size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>
                {resultado.entraram.length === 1 ? "1 foto já aparece" : `${resultado.entraram.length} fotos já aparecem`} no produto, na loja:{" "}
                {resultado.entraram.map((t) => NOME[t.tipo].toLowerCase()).join(", ")}.
              </span>
            </p>
          ) : null}
          {resultado.pendentes.length > 0 ? (
            <p className="flex items-start gap-2 rounded-[10px] bg-[#fcefd9] p-3 text-xs font-semibold text-[#9a4a07]">
              <Clock size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>
                A Tray recebeu, mas {resultado.pendentes.length === 1 ? "1 foto ainda não apareceu" : `${resultado.pendentes.length} fotos ainda não apareceram`} no
                produto: {resultado.pendentes.map((t) => NOME[t.tipo].toLowerCase()).join(", ")}. Ela pode levar alguns minutos. Confira na
                loja e, se não entrar, envie de novo: {resultado.pendentes.length === 1 ? "a foto continua" : "as fotos continuam"} como aprovada aqui.
              </span>
            </p>
          ) : null}
        </div>
      ) : null}

      {erro ? (
        <p className="mt-3 flex items-start gap-2 rounded-[10px] bg-[#fde8e8] p-3 text-xs font-semibold text-[#b01919]">
          <TriangleAlert size={14} className="mt-0.5 shrink-0" aria-hidden="true" /> <span>{erro}</span>
        </p>
      ) : null}

      {previa ? (
        <div className="mt-3">
          <ul className="grid gap-2 sm:grid-cols-3">
            {previa.trocas.map((t) => (
              <LinhaDaTroca key={t.fotoId} t={t} />
            ))}
          </ul>
          {previa.avisos.length > 0 ? (
            <ul className="mt-3 space-y-1.5">
              {previa.avisos.map((a) => (
                <li key={a} className="flex items-start gap-2 text-xs leading-relaxed text-[#9a4a07]">
                  <TriangleAlert size={13} className="mt-0.5 shrink-0" aria-hidden="true" /> <span>{a}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <p className="mt-2 text-[0.7rem] text-muted">
            A loja mostra {previa.atuais.length === 0 ? "nenhuma foto" : previa.atuais.length === 1 ? "1 foto" : `${previa.atuais.length} fotos`} neste produto hoje.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={enviar}
              disabled={ocupado}
              className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2 text-xs font-semibold text-ink transition-colors hover:bg-brand-light disabled:opacity-60"
            >
              {enviando ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : null}
              {enviando ? "Enviando e conferindo na loja" : previa.trocas.every((t) => t.jaEsta) ? "Dar baixa nas fotos" : "Enviar para a loja"}
            </button>
            <button
              type="button"
              onClick={() => setPrevia(null)}
              disabled={ocupado}
              className="rounded-full border border-ink/15 bg-white/60 px-4 py-2 text-xs font-semibold text-ink disabled:opacity-60"
            >
              Cancelar
            </button>
            {enviando ? <span className="text-[0.7rem] text-muted">Pode levar até meio minuto: o painel espera a Tray mostrar as fotos.</span> : null}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={conferir}
          disabled={ocupado}
          className="mt-3 inline-flex items-center gap-2 rounded-full border border-ink/15 bg-white px-4 py-2 text-xs font-semibold text-ink transition-colors hover:border-brand/50 disabled:opacity-60"
        >
          {ocupado ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : null}
          {resultado ? "Conferir de novo" : "Conferir o que muda na loja"}
        </button>
      )}
    </section>
  );
}
