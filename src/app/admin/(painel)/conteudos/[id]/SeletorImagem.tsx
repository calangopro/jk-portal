"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Search, ImageIcon, X, Upload, AlertTriangle } from "lucide-react";
import { buscarImagens, type ImagemDaBiblioteca } from "./actions";

/**
 * Escolhe uma imagem: da biblioteca ou enviando uma nova.
 *
 * Antes só dava para enviar arquivo, então a mesma foto acabava no bucket três
 * vezes, cada cópia com um alt diferente. Reaproveitar mantém o alt consistente
 * e evita pagar armazenamento pela mesma imagem.
 */
export function SeletorImagem({
  aoEscolher,
  aoEnviar,
  aoFechar,
}: {
  aoEscolher: (img: ImagemDaBiblioteca) => void;
  aoEnviar: (arquivo: File) => void;
  aoFechar: () => void;
}) {
  const [termo, setTermo] = useState("");
  const [itens, setItens] = useState<ImagemDaBiblioteca[]>([]);
  const [carregando, iniciar] = useTransition();
  const arquivo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      iniciar(async () => setItens(await buscarImagens(termo)));
    }, 250);
    return () => clearTimeout(t);
  }, [termo]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") aoFechar(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [aoFechar]);

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-ink/30 p-4 pt-20 backdrop-blur-sm">
      <div className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-[18px] border border-border bg-[#fbf8f2] p-5 shadow-[0_40px_80px_-30px_rgb(75_53_23/0.5)]">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <ImageIcon size={15} className="text-brand-nav" /> Escolher imagem
          </p>
          <button type="button" onClick={aoFechar} aria-label="Fechar" className="rounded-[8px] p-1.5 text-muted hover:bg-ink/8 hover:text-ink">
            <X size={15} />
          </button>
        </div>

        <div className="mt-4 flex gap-2">
          <label className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              autoFocus
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              placeholder="Buscar pelo texto alternativo"
              className="w-full rounded-full border border-border bg-white/80 py-2 pl-9 pr-4 text-sm text-ink outline-none focus:border-brand"
            />
          </label>
          <button
            type="button"
            onClick={() => arquivo.current?.click()}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white"
          >
            <Upload size={13} /> Enviar nova
          </button>
          <input
            ref={arquivo}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) { aoFechar(); aoEnviar(f); }
            }}
          />
        </div>

        <div className="mt-4 min-h-40 flex-1 overflow-y-auto">
          {carregando && itens.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">Carregando…</p>
          ) : itens.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">
              {termo ? "Nenhuma imagem com esse texto alternativo." : "A biblioteca ainda está vazia. Envie a primeira."}
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {itens.map((img) => (
                <li key={img.id}>
                  <button
                    type="button"
                    onClick={() => { aoEscolher(img); aoFechar(); }}
                    className="group block w-full overflow-hidden rounded-[12px] border border-border bg-white text-left transition-colors hover:border-brand"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.url}
                      alt=""
                      loading="lazy"
                      className="h-28 w-full bg-ink/5 object-cover"
                    />
                    <span className="block px-2.5 py-2">
                      <span className="line-clamp-2 text-[0.7rem] leading-snug text-ink">
                        {img.alt || (
                          <span className="inline-flex items-center gap-1 text-wine">
                            <AlertTriangle size={10} /> sem texto alternativo
                          </span>
                        )}
                      </span>
                      {img.width && img.height ? (
                        <span className="mt-0.5 block text-[0.62rem] text-muted">{img.width} por {img.height}</span>
                      ) : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
