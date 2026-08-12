"use client";

import { useState, useTransition } from "react";
import { ShieldCheck, Trash2, Plus, ExternalLink } from "lucide-react";
import { adicionarFonte, removerFonte, type Fonte } from "./actions";

/**
 * Fontes do conteúdo.
 *
 * A regra do projeto diz que toda afirmação factual precisa de fonte
 * registrada, e a publicação agora trava sem pelo menos uma. Aqui a pessoa
 * registra a evidência enquanto escreve, que é o único momento em que ela ainda
 * lembra de onde tirou o dado.
 */
export function Fontes({
  contentId,
  iniciais,
  aoMudar,
}: {
  contentId: string;
  iniciais: Fonte[];
  aoMudar?: (quantidade: number) => void;
}) {
  const [fontes, setFontes] = useState<Fonte[]>(iniciais);
  const [url, setUrl] = useState("");
  const [evidencia, setEvidencia] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();

  const atualizar = (lista: Fonte[]) => {
    setFontes(lista);
    aoMudar?.(lista.length);
  };

  const adicionar = () => {
    setErro(null);
    iniciar(async () => {
      const r = await adicionarFonte(contentId, { url, evidencia });
      if (r.ok && r.fonte) {
        atualizar([...fontes, r.fonte]);
        setUrl("");
        setEvidencia("");
      } else setErro(r.erro ?? "Não foi possível registrar a fonte.");
    });
  };

  const remover = (id: string) => {
    iniciar(async () => {
      await removerFonte(id);
      atualizar(fontes.filter((f) => f.id !== id));
    });
  };

  const campo =
    "w-full rounded-[10px] border border-border bg-white/80 px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-muted/50 hover:border-brand/40 focus:border-brand";

  return (
    <div>
      {fontes.length > 0 ? (
        <ul className="mb-4 space-y-2">
          {fontes.map((f) => (
            <li key={f.id} className="flex items-start gap-3 rounded-[10px] border border-border bg-white/60 px-3 py-2.5">
              <ShieldCheck size={14} className="mt-0.5 shrink-0 text-brand-strong" />
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug text-ink">{f.evidence}</p>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.7rem] text-muted">
                  {f.source_url ? (
                    <a href={f.source_url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-brand-strong hover:underline">
                      <ExternalLink size={10} /> {new URL(f.source_url).hostname}
                    </a>
                  ) : (
                    <span>Sem link, registro interno</span>
                  )}
                  {f.captured_at ? <span>conferida em {f.captured_at.split("-").reverse().join("/")}</span> : null}
                  {f.responsible ? <span>por {f.responsible}</span> : null}
                </p>
              </div>
              <button
                type="button"
                onClick={() => remover(f.id)}
                disabled={ocupado}
                aria-label={`Remover fonte: ${f.evidence ?? ""}`}
                className="shrink-0 rounded-[8px] p-1.5 text-muted transition-colors hover:bg-wine/10 hover:text-wine"
              >
                <Trash2 size={13} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-4 rounded-[10px] border border-dashed border-border px-3 py-3 text-xs leading-relaxed text-muted">
          Nenhuma fonte ainda. A publicação fica travada até registrar pelo menos uma.
          Se o texto não afirma nada que precise de prova, registre uma anotação dizendo isso.
        </p>
      )}

      <div className="space-y-2 rounded-[12px] bg-white/50 p-3">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://endereco-da-fonte (opcional)"
          className={campo}
        />
        <textarea
          value={evidencia}
          onChange={(e) => setEvidencia(e.target.value)}
          rows={2}
          placeholder="O que esta fonte comprova. Ex.: tabela de aro brasileiro, aro 18 = 58 mm"
          className={`${campo} resize-y`}
        />
        {erro ? <p role="alert" className="text-xs text-wine">{erro}</p> : null}
        <button
          type="button"
          onClick={adicionar}
          disabled={ocupado || !evidencia.trim()}
          className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white transition-opacity disabled:opacity-40"
        >
          <Plus size={13} /> Registrar fonte
        </button>
      </div>
    </div>
  );
}
