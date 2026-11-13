"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Paperclip } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { registrarAnexo } from "./actions";

const BUCKET = "comprovantes";
const LIMITE = 10 * 1024 * 1024;
const TIPOS = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

/** Nome de arquivo sem acento nem espaço, que é o que o armazenamento aceita em caminho. */
function nomeSeguro(nome: string): string {
  const limpo = nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(-80);
  return limpo || "comprovante";
}

/**
 * Sobe o comprovante direto do navegador para o bucket privado e só então
 * registra no banco. O arquivo não passa pela ação de servidor porque PDF de
 * orçamento passa fácil do limite de corpo de uma Server Action.
 */
export function AnexarComprovante({ despesaId }: { despesaId: string }) {
  const entrada = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [, iniciar] = useTransition();

  async function enviar(arquivo: File) {
    setErro(null);
    if (!TIPOS.includes(arquivo.type)) return setErro("Só PDF, JPG, PNG ou WebP.");
    if (arquivo.size > LIMITE) return setErro("O arquivo passa de 10 MB.");

    setEnviando(true);
    const caminho = `${despesaId}/${crypto.randomUUID().slice(0, 8)}-${nomeSeguro(arquivo.name)}`;
    const { error } = await createClient().storage.from(BUCKET).upload(caminho, arquivo, { upsert: false, contentType: arquivo.type });
    if (error) {
      setEnviando(false);
      return setErro("Não deu para enviar o arquivo. Confira a conexão e tente de novo.");
    }
    const r = await registrarAnexo({ despesaId, caminho, nome: arquivo.name, tipo: arquivo.type, tamanho: arquivo.size });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro ?? "Não deu para registrar o arquivo.");
    iniciar(() => router.refresh());
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <input
        ref={entrada}
        type="file"
        accept={TIPOS.join(",")}
        className="sr-only"
        aria-label="Escolher comprovante"
        onChange={(e) => {
          const arquivo = e.target.files?.[0];
          e.target.value = "";
          if (arquivo) void enviar(arquivo);
        }}
      />
      <button
        type="button"
        disabled={enviando}
        onClick={() => entrada.current?.click()}
        className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-white/60 px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-brand/60 hover:text-brand-nav disabled:opacity-60"
      >
        {enviando ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : <Paperclip size={12} aria-hidden="true" />}
        {enviando ? "Enviando" : "Anexar comprovante"}
      </button>
      {erro ? <span role="alert" className="text-xs text-wine">{erro}</span> : null}
    </span>
  );
}
