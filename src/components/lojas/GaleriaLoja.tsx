"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { X, ChevronLeft, ChevronRight, Camera } from "lucide-react";
import type { Imagem } from "@/lib/content/types";

/**
 * Galeria de fotos da unidade.
 *
 * Nenhuma loja tem foto cadastrada ainda, e é por isso que o estado vazio veio
 * junto: uma galeria que só existe quando há foto vira um buraco no layout no
 * dia em que a primeira chega. Aqui o bloco já ocupa o lugar certo, explica o
 * que vai aparecer e some sozinho em produção enquanto não houver nada.
 *
 * Com foto, vira mosaico: a primeira grande, as demais ao lado, e o visor em
 * tela cheia com teclado (setas e Esc) para quem quiser olhar de perto.
 */
export function GaleriaLoja({
  fotos,
  nomeDaLoja,
  mostrarVazio = false,
}: {
  fotos: Imagem[];
  nomeDaLoja: string;
  /** Em desenvolvimento, mostra o espaço reservado. Em produção, não. */
  mostrarVazio?: boolean;
}) {
  const [aberta, setAberta] = useState<number | null>(null);
  const painel = useRef<HTMLDivElement>(null);
  const fechar = useRef<HTMLButtonElement>(null);

  const anterior = useCallback(() => {
    setAberta((i) => (i == null ? null : (i - 1 + fotos.length) % fotos.length));
  }, [fotos.length]);

  const proxima = useCallback(() => {
    setAberta((i) => (i == null ? null : (i + 1) % fotos.length));
  }, [fotos.length]);

  useEffect(() => {
    if (aberta == null) return;

    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberta(null);
      if (e.key === "ArrowLeft") anterior();
      if (e.key === "ArrowRight") proxima();
      if (e.key === "Tab") {
        // Visor é modal: o foco não pode escapar para a página atrás.
        e.preventDefault();
        fechar.current?.focus();
      }
    };

    document.addEventListener("keydown", aoTeclar);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    fechar.current?.focus();

    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = overflow;
    };
  }, [aberta, anterior, proxima]);

  if (fotos.length === 0) {
    if (!mostrarVazio) return null;
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-brand/30 bg-brand/5 px-6 py-14 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-full border border-brand/30 bg-white/70 text-brand-nav">
          <Camera size={19} aria-hidden />
        </span>
        <p className="text-apoio font-semibold text-ink">
          Fotos desta loja em breve
        </p>
        <p className="max-w-sm text-nota leading-relaxed text-muted">
          O espaço da galeria já está reservado. Assim que as fotos da unidade
          forem enviadas em Mídia, elas aparecem aqui automaticamente.
        </p>
      </div>
    );
  }

  const [capa, ...resto] = fotos;

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-[1.6fr_1fr]">
        <BotaoFoto
          foto={capa}
          indice={0}
          aoAbrir={setAberta}
          nomeDaLoja={nomeDaLoja}
          className="aspect-[4/3] sm:aspect-auto sm:h-full sm:min-h-72"
          sizes="(min-width: 640px) 520px, 100vw"
          prioridade
        />

        {resto.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-1">
            {resto.slice(0, 2).map((f, i) => (
              <BotaoFoto
                key={f.id}
                foto={f}
                indice={i + 1}
                aoAbrir={setAberta}
                nomeDaLoja={nomeDaLoja}
                className="aspect-[4/3]"
                sizes="(min-width: 640px) 320px, 50vw"
                restantes={i === 1 ? fotos.length - 3 : 0}
              />
            ))}
          </div>
        ) : null}
      </div>

      {aberta != null ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Fotos da loja ${nomeDaLoja}`}
          className="fixed inset-x-0 top-0 z-[100] flex h-dvh flex-col bg-[#14120f]/97 backdrop-blur-sm"
          ref={painel}
        >
          <div className="flex shrink-0 items-center justify-between px-4 py-3">
            <p className="numeros text-nota text-[#f3ece1]/70">
              {aberta + 1} de {fotos.length}
            </p>
            <button
              ref={fechar}
              type="button"
              onClick={() => setAberta(null)}
              aria-label="Fechar as fotos"
              className="flex h-11 w-11 items-center justify-center rounded-full text-[#f3ece1]/70 transition-colors hover:bg-white/10 hover:text-[#f3ece1]"
            >
              <X size={20} />
            </button>
          </div>

          <div className="relative flex flex-1 items-center justify-center overflow-hidden px-4">
            <Image
              key={fotos[aberta].id}
              src={fotos[aberta].url}
              alt={fotos[aberta].alt}
              width={fotos[aberta].width}
              height={fotos[aberta].height}
              sizes="100vw"
              className="etapa max-h-full w-auto rounded-md object-contain"
            />

            {fotos.length > 1 ? (
              <>
                <SetaVisor lado="esquerda" aoClicar={anterior} />
                <SetaVisor lado="direita" aoClicar={proxima} />
              </>
            ) : null}
          </div>

          {fotos[aberta].caption || fotos[aberta].credit ? (
            <p className="shrink-0 px-6 py-4 text-center text-nota leading-relaxed text-[#f3ece1]/60">
              {fotos[aberta].caption}
              {fotos[aberta].credit ? ` Foto: ${fotos[aberta].credit}` : ""}
            </p>
          ) : (
            <div className="h-4 shrink-0" />
          )}
        </div>
      ) : null}
    </>
  );
}

function BotaoFoto({
  foto,
  indice,
  aoAbrir,
  nomeDaLoja,
  className,
  sizes,
  prioridade = false,
  restantes = 0,
}: {
  foto: Imagem;
  indice: number;
  aoAbrir: (i: number) => void;
  nomeDaLoja: string;
  className: string;
  sizes: string;
  prioridade?: boolean;
  restantes?: number;
}) {
  return (
    <button
      type="button"
      onClick={() => aoAbrir(indice)}
      aria-label={`Abrir foto ${indice + 1} da loja ${nomeDaLoja}`}
      className={`group relative block overflow-hidden rounded-lg bg-media ${className}`}
    >
      <Image
        src={foto.url}
        alt={foto.alt}
        fill
        sizes={sizes}
        priority={prioridade}
        placeholder={foto.placeholder ? "blur" : "empty"}
        blurDataURL={foto.placeholder ?? undefined}
        className="object-cover transition-transform duration-[600ms] ease-[cubic-bezier(0.2,0.75,0.25,1)] group-hover:scale-[1.04]"
        style={
          foto.focalX != null || foto.focalY != null
            ? {
                objectPosition: `${(foto.focalX ?? 0.5) * 100}% ${(foto.focalY ?? 0.5) * 100}%`,
              }
            : undefined
        }
      />
      {restantes > 0 ? (
        <span className="absolute inset-0 flex items-center justify-center bg-ink/55 font-display text-titulo-secao text-white">
          +{restantes}
        </span>
      ) : null}
    </button>
  );
}

function SetaVisor({
  lado,
  aoClicar,
}: {
  lado: "esquerda" | "direita";
  aoClicar: () => void;
}) {
  const Icone = lado === "esquerda" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={aoClicar}
      aria-label={lado === "esquerda" ? "Foto anterior" : "Próxima foto"}
      className={`absolute top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-white/10 text-[#f3ece1] backdrop-blur-sm transition-colors hover:border-brand hover:bg-brand hover:text-ink ${
        lado === "esquerda" ? "left-3" : "right-3"
      }`}
    >
      <Icone size={22} />
    </button>
  );
}
