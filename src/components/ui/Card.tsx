import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import type { Imagem } from "@/lib/content/types";

/**
 * Card de listagem (guia, loja, relacionado).
 *
 * Substitui as três cópias quase idênticas que existiam na home, no índice de
 * guias e no de lojas. `destaque` é a versão grande da capa do portal.
 */
export function Card({
  href,
  titulo,
  resumo,
  imagem,
  etiqueta,
  meta,
  chamada = "Ler guia",
  destaque = false,
  externo = false,
  className = "",
}: {
  href: string;
  titulo: string;
  resumo?: string | null;
  imagem?: Imagem | null;
  /** Rótulo curto acima do título (categoria, cidade). */
  etiqueta?: ReactNode;
  /** Linha fina de metadados no rodapé (data, tempo de leitura). */
  meta?: ReactNode;
  chamada?: string;
  destaque?: boolean;
  externo?: boolean;
  className?: string;
}) {
  const Conteudo = (
    <>
      {imagem ? (
        <div
          className={`relative overflow-hidden rounded-md bg-media ${
            destaque ? "aspect-[16/10]" : "aspect-[3/2]"
          }`}
        >
          <Image
            src={imagem.url}
            // Alt vazio tirava estas fotos do Google Imagens. A imagem não é
            // decorativa: ela representa o conteúdo para onde o card leva.
            alt={imagem.alt || titulo}
            fill
            sizes={destaque ? "(min-width: 1024px) 640px, 100vw" : "(min-width: 640px) 380px, 100vw"}
            className="object-cover transition-transform duration-[600ms] ease-[cubic-bezier(0.2,0.75,0.25,1)] group-hover:scale-[1.035]"
            style={
              imagem.focalX != null || imagem.focalY != null
                ? {
                    objectPosition: `${(imagem.focalX ?? 0.5) * 100}% ${(imagem.focalY ?? 0.5) * 100}%`,
                  }
                : undefined
            }
            placeholder={imagem.placeholder ? "blur" : "empty"}
            blurDataURL={imagem.placeholder ?? undefined}
          />
        </div>
      ) : null}

      <div className={imagem ? "mt-5 flex flex-1 flex-col" : "flex flex-1 flex-col"}>
        {etiqueta ? <div className="mb-3">{etiqueta}</div> : null}

        <h3
          className={`font-display text-ink ${
            destaque ? "text-titulo-secao" : "text-titulo-bloco"
          }`}
        >
          {titulo}
        </h3>

        {resumo ? (
          <p className="mt-3 text-apoio leading-relaxed text-muted">{resumo}</p>
        ) : null}

        <div className="mt-auto pt-6">
          {meta ? (
            <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-nota text-muted">
              {meta}
            </div>
          ) : null}
          <span className="inline-flex items-center gap-1.5 text-apoio font-semibold text-brand-nav">
            {chamada}
            <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">
              &rarr;
            </span>
          </span>
        </div>
      </div>
    </>
  );

  const classes = `glass-card group flex h-full flex-col rounded-lg p-5 sm:p-6 ${className}`;

  if (externo) {
    return (
      <a href={href} target="_blank" rel="noopener" className={classes}>
        {Conteudo}
      </a>
    );
  }

  return (
    <Link href={href} className={classes}>
      {Conteudo}
    </Link>
  );
}
