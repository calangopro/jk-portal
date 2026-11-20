"use client";

import { useState, useTransition } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { comBasePath } from "@/lib/seo/base-path";

/**
 * Emite a garantia digital do trabalho (cartão 65) e abre o cartão para
 * imprimir numa aba nova. A aba abre NO CLIQUE, ainda vazia, e só depois
 * recebe o endereço: aberta depois da espera, o navegador a bloquearia como
 * janela não pedida.
 */
type Emitir = (ref: string) => Promise<{ ok: true; codigo: string } | { ok: false; erro: string }>;

export function BotaoDeGarantia({ referencia, emitir, className }: { referencia: string; emitir: Emitir; className: string }) {
  const [ocupado, comecar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  const clicar = () => {
    const aba = window.open("", "_blank");
    comecar(async () => {
      setErro(null);
      const r = await emitir(referencia);
      if (r.ok && r.codigo) {
        const url = comBasePath(`/admin/fabrica-garantia/${r.codigo}`);
        if (aba) aba.location.href = url;
        else window.location.href = url;
      } else {
        aba?.close();
        setErro(r.ok ? "Não deu para emitir a garantia agora." : r.erro);
      }
    });
  };

  return (
    <>
      <button type="button" disabled={ocupado} onClick={clicar} className={className}>
        {ocupado ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <ShieldCheck size={13} aria-hidden="true" />} Garantia
      </button>
      {erro ? <p className="basis-full text-xs font-semibold text-[#b01919]">{erro}</p> : null}
    </>
  );
}
