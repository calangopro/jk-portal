"use client";

import { useState, useTransition } from "react";
import { Camera, Loader2, Store } from "lucide-react";
import type { PedidoDaFabrica } from "@/lib/fabrica/dados";

/**
 * O que veio na OS aberta à mão (0192 e 0195), no cartão da fila, do quadro e
 * de Na fábrica: o que fazer, a loja física, o número da OS de papel, a foto
 * do pedido escrito (link de uma hora) e a transcrição da IA, recolhida. Se
 * alguém esqueceu um campo, a foto está aqui.
 */
type VerFoto = (caminho: string) => Promise<string | null>;

export function DaOs({ p, verFoto, escuro = false }: { p: PedidoDaFabrica; verFoto: VerFoto; escuro?: boolean }) {
  const [ocupado, comecar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  if (p.origem !== "avulso") return null;
  const apagado = escuro ? "#a9adb5" : "#5d5850";

  const abrir = (caminho: string) => {
    const aba = window.open("", "_blank");
    comecar(async () => {
      setErro(null);
      const url = await verFoto(caminho);
      if (url && aba) aba.location.href = url;
      else {
        aba?.close();
        setErro("Não deu para abrir a foto agora.");
      }
    });
  };

  return (
    <div className="mt-2 space-y-1.5 text-xs">
      {p.relato ? (
        <p className="rounded-[8px] px-2 py-1.5 font-semibold [overflow-wrap:anywhere]" style={{ background: escuro ? "#353a43" : "#f1ede6" }}>
          <span className="mr-1 font-bold uppercase" style={{ color: apagado }}>Fazer</span>
          {p.relato}
        </p>
      ) : null}
      {p.loja || p.numeroPapel ? (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-semibold" style={{ color: apagado }}>
          {p.loja ? (
            <span className="inline-flex items-center gap-1">
              <Store size={12} aria-hidden="true" /> {p.loja}
            </span>
          ) : null}
          {p.numeroPapel ? <span className="numeros">OS de papel {p.numeroPapel}</span> : null}
        </p>
      ) : null}
      {p.fotos.length ? (
        <div className="relative z-20 flex flex-wrap gap-1.5">
          {p.fotos.map((f, i) => (
            <button
              key={f}
              type="button"
              disabled={ocupado}
              onClick={() => abrir(f)}
              className="painel-toque inline-flex h-9 items-center gap-1.5 rounded-full px-3 font-semibold disabled:opacity-60"
              style={{ border: `1px solid ${escuro ? "#353a43" : "rgba(26,24,21,0.12)"}` }}
            >
              {ocupado ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : <Camera size={12} aria-hidden="true" />}
              {p.fotos.length > 1 ? `Foto ${i + 1} do pedido escrito` : "Foto do pedido escrito"}
            </button>
          ))}
        </div>
      ) : null}
      {p.transcricao ? (
        <details className="relative z-20">
          <summary className="cursor-pointer font-semibold" style={{ color: apagado }}>Transcrição da foto</summary>
          <p className="mt-1 whitespace-pre-line [overflow-wrap:anywhere]">{p.transcricao}</p>
        </details>
      ) : null}
      {erro ? <p className="font-semibold text-[#b01919]">{erro}</p> : null}
    </div>
  );
}
