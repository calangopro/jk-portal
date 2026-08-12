import Image from "next/image";
import type { Imagem } from "@/lib/content/types";

/**
 * Imagem com legenda e crédito.
 *
 * Legenda e crédito são exigência do REGRAS.md e também o que separa um artigo
 * de fonte confiável de um post qualquer. Dimensões vêm da tabela `media`, então
 * o navegador reserva o espaço e a página não pula.
 */
export function Figura({
  imagem,
  prioridade = false,
  sizes = "(min-width: 1024px) 720px, 100vw",
  proporcao,
  className = "",
  arredondamento = "rounded-lg",
}: {
  imagem: Imagem;
  /** Ligar só na capa, que é o elemento LCP da página. */
  prioridade?: boolean;
  sizes?: string;
  /** Força um recorte (ex.: "16 / 9"). Sem isto, respeita a proporção original. */
  proporcao?: string;
  className?: string;
  arredondamento?: string;
}) {
  const temTexto = Boolean(imagem.caption || imagem.credit);

  // Ponto focal: sem ele, um recorte 16/9 corta a foto pelo meio e às vezes
  // decapita o assunto.
  const posicao =
    imagem.focalX != null || imagem.focalY != null
      ? `${(imagem.focalX ?? 0.5) * 100}% ${(imagem.focalY ?? 0.5) * 100}%`
      : undefined;

  return (
    <figure className={className}>
      <div
        className={`relative overflow-hidden bg-media ${arredondamento}`}
        style={proporcao ? { aspectRatio: proporcao } : undefined}
      >
        <Image
          src={imagem.url}
          alt={imagem.alt}
          width={imagem.width}
          height={imagem.height}
          sizes={sizes}
          priority={prioridade}
          loading={prioridade ? undefined : "lazy"}
          placeholder={imagem.placeholder ? "blur" : "empty"}
          blurDataURL={imagem.placeholder ?? undefined}
          className={proporcao ? "h-full w-full object-cover" : "h-auto w-full"}
          style={proporcao && posicao ? { objectPosition: posicao } : undefined}
        />
      </div>

      {temTexto ? (
        <figcaption className="mt-3 flex flex-wrap items-baseline gap-x-2 text-nota text-muted">
          {imagem.caption ? <span>{imagem.caption}</span> : null}
          {imagem.credit ? (
            <span className="text-muted">Foto: {imagem.credit}</span>
          ) : null}
        </figcaption>
      ) : null}
    </figure>
  );
}
