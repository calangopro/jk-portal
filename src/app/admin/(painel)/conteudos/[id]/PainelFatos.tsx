"use client";

import { useMemo, useState, useTransition } from "react";
import { BookCheck, Plus, Search } from "lucide-react";
import { citarFato, type Fonte } from "./actions";
import { MODULO_LABEL, type Fato } from "@/lib/content/fatos";

/**
 * Fatos aprovados prontos para citar.
 *
 * A regra do projeto sempre exigiu fonte para toda afirmação, e a publicação já
 * travava sem nenhuma. O problema é que registrar fonte era um formulário à
 * parte, preenchido no fim, quando a pessoa já não lembrava de onde tirou o
 * dado. Resultado: a tabela de fontes ficou zerada com a regra valendo.
 *
 * Aqui o caminho se inverte. A pessoa escolhe o fato enquanto escreve, o texto
 * entra no ponto do cursor e a fonte daquele conteúdo é gravada no mesmo gesto.
 */
export function PainelFatos({
  contentId,
  fatos,
  aoInserirTexto,
  aoRegistrarFonte,
}: {
  contentId: string;
  fatos: Fato[];
  /** Coloca a afirmação no ponto do cursor, no corpo do texto. */
  aoInserirTexto: (texto: string) => void;
  /** Avisa a tela de Fontes que nasceu uma linha nova. */
  aoRegistrarFonte: (fonte: Fonte) => void;
}) {
  const [termo, setTermo] = useState("");
  const [citados, setCitados] = useState<Set<string>>(new Set());
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();

  const filtrados = useMemo(() => {
    const t = termo
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "");
    if (!t) return fatos;
    return fatos.filter((f) =>
      `${f.claim} ${f.detail ?? ""} ${MODULO_LABEL[f.module]}`
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .includes(t),
    );
  }, [fatos, termo]);

  const citar = (f: Fato) => {
    setErro(null);
    aoInserirTexto(f.claim);
    iniciar(async () => {
      const r = await citarFato(contentId, f.id);
      if (!r.ok) {
        setErro(r.erro ?? "Não foi possível registrar a fonte deste fato.");
        return;
      }
      setCitados((antes) => new Set(antes).add(f.id));
      // Fonte repetida não vira linha nova, então não há o que somar na conta.
      if (r.fonte && !r.jaCitado) aoRegistrarFonte(r.fonte);
    });
  };

  if (fatos.length === 0) {
    return (
      <p className="mb-4 rounded-[10px] border border-dashed border-border px-3 py-3 text-xs leading-relaxed text-muted">
        A base de fatos ainda não tem nada aprovado. Registre o que a JK já
        confirmou em Base de fatos e o texto passa a citar de lá, com a fonte
        entrando sozinha.
      </p>
    );
  }

  return (
    <div className="mb-4">
      <label className="relative block">
        <span className="sr-only">Buscar na base de fatos</span>
        <Search
          size={13}
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
        />
        <input
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          placeholder="Buscar fato aprovado"
          className="w-full rounded-[10px] border border-border bg-white/80 py-2 pl-8 pr-3 text-sm text-ink outline-none transition-colors placeholder:text-muted/50 hover:border-brand/40 focus:border-brand"
        />
      </label>

      {erro ? (
        <p role="alert" className="mt-2 text-xs text-wine">
          {erro}
        </p>
      ) : null}

      <ul className="mt-2 max-h-64 space-y-1.5 overflow-y-auto pr-1">
        {filtrados.length === 0 ? (
          <li className="px-1 py-3 text-xs text-muted">
            Nenhum fato aprovado com esse termo.
          </li>
        ) : (
          filtrados.map((f) => {
            const jaCitado = citados.has(f.id);
            return (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => citar(f)}
                  disabled={ocupado}
                  title={f.detail ?? undefined}
                  className="group flex w-full items-start gap-2.5 rounded-[10px] border border-border bg-white/60 px-3 py-2.5 text-left transition-colors hover:border-brand/50 hover:bg-white disabled:opacity-50"
                >
                  {jaCitado ? (
                    <BookCheck size={13} className="mt-0.5 shrink-0 text-brand-strong" />
                  ) : (
                    <Plus size={13} className="mt-0.5 shrink-0 text-muted group-hover:text-brand-strong" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm leading-snug text-ink">{f.claim}</span>
                    <span className="mt-1 block text-[0.68rem] text-muted">
                      {MODULO_LABEL[f.module]}
                      {jaCitado ? ", já citado neste conteúdo" : null}
                    </span>
                  </span>
                </button>
              </li>
            );
          })
        )}
      </ul>

      <p className="mt-3 text-[0.68rem] leading-relaxed text-muted">
        Clicar coloca a frase no ponto do cursor e registra a fonte deste
        conteúdo. Reescreva à vontade depois: a fonte continua ligada ao fato.
      </p>
    </div>
  );
}
