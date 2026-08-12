"use client";

import { useEffect, useRef, useState } from "react";
import { Monitor, Smartphone, Search, Share2 } from "lucide-react";

/**
 * Como o conteúdo aparece fora do site: no Google e no card de compartilhamento.
 *
 * O preview antigo cortava o título em 70 CARACTERES, e o Google corta por
 * LARGURA em pixel. "Aliança" e "Ilha" ocupam espaços muito diferentes, então o
 * corte por caractere errava para os dois lados: mostrava inteiro um título que
 * o Google trunca, e cortava um que caberia.
 *
 * Aqui a medida é feita com o mesmo tipo de fonte que o Google usa no resultado,
 * num canvas, que é a única forma de saber a largura real de um texto.
 */

/** Larguras úteis do resultado do Google, em pixel. */
const LIMITES = {
  computador: { titulo: 600, descricao: 920, fonteTitulo: "20px Arial", fonteDesc: "14px Arial" },
  celular: { titulo: 330, descricao: 660, fonteTitulo: "18px Arial", fonteDesc: "14px Arial" },
} as const;

type Tela = keyof typeof LIMITES;

function usarMedidor() {
  const ref = useRef<CanvasRenderingContext2D | null>(null);
  useEffect(() => {
    ref.current = document.createElement("canvas").getContext("2d");
  }, []);
  return (texto: string, fonte: string, limite: number) => {
    const ctx = ref.current;
    if (!ctx) return { texto, cortado: false };
    ctx.font = fonte;
    if (ctx.measureText(texto).width <= limite) return { texto, cortado: false };
    // Corta palavra a palavra, porque o Google não corta no meio da palavra.
    const palavras = texto.split(" ");
    let atual = "";
    for (const p of palavras) {
      const tentativa = atual ? `${atual} ${p}` : p;
      if (ctx.measureText(`${tentativa}...`).width > limite) break;
      atual = tentativa;
    }
    return { texto: `${atual || texto.slice(0, 10)}...`, cortado: true };
  };
}

export function PreviewDeResultado({
  titulo,
  descricao,
  slug,
  atualizadoEm,
  capaUrl,
}: {
  titulo: string;
  descricao: string;
  slug: string;
  /** Data que o Google costuma exibir antes da descrição. */
  atualizadoEm?: string | null;
  capaUrl?: string | null;
}) {
  const [tela, setTela] = useState<Tela>("computador");
  const medir = usarMedidor();
  const [, forcar] = useState(0);

  // O medidor só existe depois do primeiro render (canvas é do navegador).
  useEffect(() => {
    forcar((n) => n + 1);
  }, []);

  const limites = LIMITES[tela];
  const t = medir(titulo || "Sem título", limites.fonteTitulo, limites.titulo);
  const d = medir(
    descricao || "Sem meta description o Google monta o trecho com um pedaço qualquer do texto.",
    limites.fonteDesc,
    limites.descricao,
  );

  const data = atualizadoEm
    ? new Date(atualizadoEm).toLocaleDateString("pt-BR", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "America/Sao_Paulo",
      })
    : null;

  const aba = "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors";

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setTela("computador")}
          className={`${aba} ${tela === "computador" ? "bg-ink text-white" : "border border-border text-muted hover:text-ink"}`}
        >
          <Monitor size={12} /> Computador
        </button>
        <button
          type="button"
          onClick={() => setTela("celular")}
          className={`${aba} ${tela === "celular" ? "bg-ink text-white" : "border border-border text-muted hover:text-ink"}`}
        >
          <Smartphone size={12} /> Celular
        </button>
      </div>

      {/* Resultado do Google */}
      <div className="rounded-[14px] border border-border bg-white/80 p-4">
        <p className="mb-2 flex items-center gap-1.5 text-[0.65rem] font-semibold uppercase tracking-wider text-muted">
          <Search size={11} /> Resultado do Google
        </p>

        <div style={{ maxWidth: tela === "celular" ? 360 : 640 }}>
          <div className="flex items-center gap-2">
            {/* Favicon: o mesmo monograma que a rota /icon gera. */}
            <span
              aria-hidden
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#211d18] text-[0.6rem] font-semibold text-[#d8b877]"
            >
              JK
            </span>
            <span className="min-w-0">
              <span className="block text-[0.8rem] leading-tight text-[#202124]">JK Alianças</span>
              <span className="block truncate text-[0.7rem] leading-tight text-[#4d5156]">
                guia.jkaliancas.com.br › guia › {slug || "endereco"}
              </span>
            </span>
          </div>

          <p
            className="mt-1.5 text-[#1a0dab] hover:underline"
            style={{ fontSize: tela === "celular" ? 18 : 20, lineHeight: 1.3 }}
          >
            {t.texto}
          </p>

          <p className="mt-1 text-[0.82rem] leading-snug text-[#4d5156]">
            {/* Ponto médio no lugar do travessão que o Google usa: a regra do
                projeto vale também para texto do admin, e o separador aqui é
                só um sinal visual. */}
            {data ? <span className="text-[#70757a]">{data} · </span> : null}
            {d.texto}
          </p>
        </div>

        {(t.cortado || d.cortado) && (
          <p className="mt-3 border-t border-border pt-3 text-[0.7rem] text-wine">
            {t.cortado && d.cortado
              ? "O título e a descrição são cortados nesta tela."
              : t.cortado
                ? "O título é cortado nesta tela."
                : "A descrição é cortada nesta tela."}{" "}
            O Google corta por largura, não por número de caracteres.
          </p>
        )}
      </div>

      {/* Card de compartilhamento */}
      <div className="mt-4 rounded-[14px] border border-border bg-white/80 p-4">
        <p className="mb-2 flex items-center gap-1.5 text-[0.65rem] font-semibold uppercase tracking-wider text-muted">
          <Share2 size={11} /> Card no WhatsApp e nas redes
        </p>

        <div className="max-w-[22rem] overflow-hidden rounded-[10px] border border-border">
          <div className="relative aspect-[1200/630] bg-[#f0ece4]">
            {capaUrl ? (
              // Imagem crua de propósito: é o arquivo exato que vai no og:image,
              // sem o redimensionamento do next/image.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={capaUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="absolute inset-0 flex items-center justify-center px-4 text-center text-[0.7rem] text-muted">
                Sem capa. O card usa a arte gerada com o título e a resposta rápida.
              </span>
            )}
          </div>
          <div className="bg-[#f7f7f7] px-3 py-2">
            <p className="text-[0.7rem] uppercase tracking-wide text-[#8696a0]">
              guia.jkaliancas.com.br
            </p>
            <p className="mt-0.5 line-clamp-2 text-[0.8rem] font-semibold leading-snug text-[#111b21]">
              {titulo || "Sem título"}
            </p>
            <p className="mt-0.5 line-clamp-2 text-[0.72rem] leading-snug text-[#667781]">
              {descricao || "Sem descrição"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
