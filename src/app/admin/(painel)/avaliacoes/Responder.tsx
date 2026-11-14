"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Send } from "lucide-react";

/**
 * O formulário de resposta de uma avaliação.
 *
 * PUBLICAR É PARA FORA: a resposta sai no Google, no nome da loja, e qualquer
 * pessoa lê. Por isso são dois toques (escrever, depois confirmar com o texto
 * na frente), e os começos prontos só aparecem em avaliação de 4 ou 5
 * estrelas: nota baixa pede resposta escrita para aquele caso.
 *
 * A ação vem de fora, como propriedade, para a tela poder ser vista sem sessão.
 */
type Responder = (name: string, resposta: string) => Promise<{ ok: true } | { ok: false; erro: string }>;

function comecos(nome: string | null): string[] {
  const n = nome ? `${nome.split(" ")[0]}, ` : "";
  const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  return [
    maiuscula(`${n}muito obrigado pela avaliação! Ficamos felizes em fazer parte desse momento.`),
    maiuscula(`${n}obrigado pelo carinho! Conte com a gente sempre que precisar.`),
  ];
}

export function ResponderAvaliacao({ name, autor, nota, responder }: { name: string; autor: string | null; nota: number; responder: Responder }) {
  const router = useRouter();
  const [ocupado, comecar] = useTransition();
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [conferindo, setConferindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState(false);

  if (feito) {
    return (
      <p role="status" className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[#046c4e]">
        <Check size={13} aria-hidden="true" /> Resposta publicada no Google.
      </p>
    );
  }
  if (!aberto) {
    return (
      <button type="button" onClick={() => setAberto(true)} className="painel-toque mt-2 inline-flex h-9 items-center gap-1.5 rounded-full border border-ink/12 bg-white px-3.5 text-xs font-semibold text-ink">
        Responder
      </button>
    );
  }

  const publicar = () =>
    comecar(async () => {
      setErro(null);
      const r = await responder(name, texto);
      if (r.ok) {
        setFeito(true);
        router.refresh();
      } else {
        setErro(r.erro);
        setConferindo(false);
      }
    });

  return (
    <div className="mt-2 rounded-[12px] bg-ink/[0.03] p-3">
      {conferindo ? (
        <>
          <p className="text-xs font-semibold text-ink">Vai sair assim no Google, no nome da loja:</p>
          <p className="mt-1.5 whitespace-pre-wrap break-words rounded-[10px] border border-ink/10 bg-white p-2.5 text-sm leading-relaxed text-ink">{texto.trim()}</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <button type="button" disabled={ocupado} onClick={publicar} className="painel-toque painel-aba-ativa inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-xs font-semibold disabled:opacity-60">
              {ocupado ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Send size={13} aria-hidden="true" />} Publicar no Google
            </button>
            <button type="button" disabled={ocupado} onClick={() => setConferindo(false)} className="painel-toque inline-flex h-10 items-center rounded-full border border-ink/12 bg-white px-3.5 text-xs font-semibold text-ink disabled:opacity-60">
              Voltar e editar
            </button>
          </div>
        </>
      ) : (
        <>
          <label className="block">
            <span className="text-xs font-semibold text-ink">Resposta da loja</span>
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              maxLength={4000}
              rows={3}
              autoFocus
              className="mt-1.5 w-full rounded-[10px] border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-[var(--setor)]"
            />
          </label>
          {nota >= 4 && !texto.trim() ? (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {comecos(autor).map((c, i) => (
                <button key={i} type="button" onClick={() => setTexto(c)} className="painel-toque rounded-full border border-ink/12 bg-white px-3 py-1.5 text-left text-[0.72rem] leading-snug text-ink">
                  {c}
                </button>
              ))}
            </div>
          ) : null}
          <div className="mt-2.5 flex flex-wrap gap-2">
            <button type="button" disabled={texto.trim().length < 2} onClick={() => setConferindo(true)} className="painel-toque painel-aba-ativa inline-flex h-10 items-center rounded-full px-4 text-xs font-semibold disabled:opacity-50">
              Conferir antes de publicar
            </button>
            <button type="button" onClick={() => setAberto(false)} className="painel-toque inline-flex h-10 items-center rounded-full border border-ink/12 bg-white px-3.5 text-xs font-semibold text-ink">
              Cancelar
            </button>
          </div>
        </>
      )}
      {erro ? <p role="alert" className="mt-2 text-xs font-semibold text-[#b01919]">{erro}</p> : null}
    </div>
  );
}

type UsarHorario = (localName: string) => Promise<{ ok: true } | { ok: false; erro: string }>;

/** O botão que leva o horário do Google para a página pública da loja. */
export function UsarHorarioDoGoogle({ local, usarHorario }: { local: string; usarHorario: UsarHorario }) {
  const router = useRouter();
  const [ocupado, comecar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        disabled={ocupado}
        onClick={() =>
          comecar(async () => {
            setErro(null);
            const r = await usarHorario(local);
            if (r.ok) router.refresh();
            else setErro(r.erro);
          })
        }
        className="painel-toque painel-aba-ativa mt-2 inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold disabled:opacity-60"
      >
        {ocupado ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : null} Usar este horário na página da loja
      </button>
      {erro ? <p role="alert" className="mt-1.5 text-xs font-semibold text-[#b01919]">{erro}</p> : null}
    </>
  );
}
