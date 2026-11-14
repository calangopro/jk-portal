"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, ArrowRight, Loader2, NotebookPen } from "lucide-react";
import { ACAO_PARA, ETAPAS, proximaEtapa, type Etapa } from "@/lib/fabrica/etapas";

/**
 * Os botões de um pedido da fábrica: levar para a etapa seguinte, mudar para
 * qualquer outra etapa e anotar.
 *
 * "Mudar etapa" existe porque a fila nem sempre anda de degrau em degrau:
 * pedido que já saiu vai de "a produzir" direto para "enviado", e pedido
 * movido por engano volta. A função do banco sempre aceitou qualquer destino.
 *
 * O botão principal é grande de propósito: é o que se toca com a peça na outra
 * mão. Marcar como enviado abre o campo do rastreio antes de gravar, e o campo
 * pode ficar vazio (motoboy e retirada em loja não têm código).
 *
 * A ação vem de fora, como propriedade, para a tela poder ser vista sem sessão.
 */
type Mover = (ref: string, etapa: string, extras?: { rastreio?: string; nota?: string }) => Promise<{ ok: true } | { ok: false; erro: string }>;

export function AcoesDoPedido({
  pedido, etapa, nota, rastreio, mover,
}: {
  /** A referência do trabalho: número do pedido da loja ou "v" mais o código da venda por fora. */
  pedido: string;
  etapa: Etapa;
  nota: string | null;
  rastreio: string | null;
  mover: Mover;
}) {
  const router = useRouter();
  const [ocupado, comecar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [aberto, setAberto] = useState<"envio" | "nota" | "etapa" | null>(null);
  const [codigo, setCodigo] = useState(rastreio ?? "");
  const [texto, setTexto] = useState(nota ?? "");

  const proxima = proximaEtapa(etapa);

  const levar = (destino: Etapa, extras?: { rastreio?: string; nota?: string }) =>
    comecar(async () => {
      setErro(null);
      const r = await mover(pedido, destino, extras);
      if (r.ok) {
        setAberto(null);
        router.refresh();
      } else setErro(r.erro);
    });

  const botaoSecundario = "painel-toque inline-flex h-10 items-center gap-1.5 rounded-full border border-ink/12 bg-white px-3.5 text-xs font-semibold text-ink disabled:opacity-60";

  return (
    <div className="border-t border-ink/[0.07] pt-3">
      {aberto === "envio" ? (
        <div className="space-y-2">
          <label className="block">
            <span className="text-xs font-semibold text-ink">Código de rastreio</span>
            <span className="block text-[0.7rem] text-muted">Pode ficar vazio em motoboy e retirada na loja.</span>
            <input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              maxLength={80}
              autoFocus
              placeholder="Ex.: AA123456789BR"
              className="numeros mt-1.5 h-11 w-full rounded-[10px] border border-ink/15 bg-white px-3 text-sm text-ink outline-none focus:border-[var(--setor)]"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={ocupado} onClick={() => levar("enviado", { rastreio: codigo })} className="painel-toque painel-aba-ativa inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold disabled:opacity-60">
              {ocupado ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : null} Confirmar o envio
            </button>
            <button type="button" disabled={ocupado} onClick={() => setAberto(null)} className={botaoSecundario}>
              Cancelar
            </button>
          </div>
        </div>
      ) : aberto === "etapa" ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-ink">Levar este pedido direto para</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {ETAPAS.filter((e) => e.chave !== etapa).map((e) => (
              <button
                key={e.chave}
                type="button"
                disabled={ocupado}
                // Enviado passa pelo campo do rastreio, como no botão principal.
                onClick={() => (e.chave === "enviado" ? setAberto("envio") : levar(e.chave))}
                className={`${botaoSecundario} justify-center`}
              >
                {e.nome}
              </button>
            ))}
            <button type="button" disabled={ocupado} onClick={() => setAberto(null)} className={`${botaoSecundario} justify-center border-transparent bg-transparent text-muted`}>
              Cancelar
            </button>
          </div>
        </div>
      ) : aberto === "nota" ? (
        <div className="space-y-2">
          <label className="block">
            <span className="text-xs font-semibold text-ink">Anotação do pedido</span>
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              maxLength={500}
              rows={3}
              autoFocus
              placeholder="Ex.: cliente pediu para trocar o aro 02 para 18"
              className="mt-1.5 w-full rounded-[10px] border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-[var(--setor)]"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={ocupado} onClick={() => levar(etapa, { nota: texto })} className="painel-toque painel-aba-ativa inline-flex h-10 items-center justify-center gap-2 rounded-full px-4 text-xs font-semibold disabled:opacity-60">
              {ocupado ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : null} Guardar a anotação
            </button>
            <button type="button" disabled={ocupado} onClick={() => setAberto(null)} className={botaoSecundario}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {proxima ? (
            <button
              type="button"
              disabled={ocupado}
              onClick={() => (proxima === "enviado" ? setAberto("envio") : levar(proxima))}
              // No celular o botão principal ocupa a linha inteira: dividindo com os outros dois, o texto quebrava.
              className="painel-toque painel-aba-ativa inline-flex h-11 min-w-0 basis-full items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold disabled:opacity-60 sm:flex-1 sm:basis-auto"
            >
              {ocupado ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <ArrowRight size={15} aria-hidden="true" />}
              {ACAO_PARA[proxima]}
            </button>
          ) : null}
          <button type="button" disabled={ocupado} onClick={() => setAberto("nota")} className={botaoSecundario}>
            <NotebookPen size={13} aria-hidden="true" /> {nota ? "Editar anotação" : "Anotar"}
          </button>
          <button type="button" disabled={ocupado} onClick={() => setAberto("etapa")} className={botaoSecundario}>
            <ArrowLeftRight size={13} aria-hidden="true" /> Mudar etapa
          </button>
        </div>
      )}
      {erro ? <p className="mt-2 text-xs font-semibold text-[#b01919]">{erro}</p> : null}
    </div>
  );
}
