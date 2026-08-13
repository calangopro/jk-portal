import Image from "next/image";
import type { Imagem } from "@/lib/content/types";

/**
 * Capa do guia como fundo da faixa de abertura, a partir de lg.
 *
 * A imagem ocupa a metade direita e mergulha atrás do texto. Duas camadas de
 * degradê fazem o trabalho:
 *
 * 1. horizontal, do fundo da página até transparente, que apaga a imagem
 *    exatamente onde o texto começa. É o que garante contraste sem escurecer a
 *    foto inteira nem jogar uma caixa opaca por cima;
 * 2. vertical suave, para a imagem não bater seca na borda de baixo da faixa.
 *
 * O degradê sai de `--color-background`, e não de um hex fixo, então continua
 * casando quando a cor do site mudar no painel de aparência.
 *
 * `aria-hidden` porque aqui a foto é ambientação: a versão que carrega o `alt`
 * e a legenda é a do celular, no fluxo do texto.
 */
export function CapaDeFundo({ imagem }: { imagem: Imagem }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 hidden w-[58%] lg:block">
      <Image
        src={imagem.url}
        alt=""
        fill
        priority
        sizes="58vw"
        className="object-cover"
        {...(imagem.placeholder
          ? { placeholder: "blur" as const, blurDataURL: imagem.placeholder }
          : {})}
        style={{
          objectPosition: `${(imagem.focalX ?? 0.5) * 100}% ${(imagem.focalY ?? 0.5) * 100}%`,
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--color-background) 6%, rgb(var(--jk-bg-rgb) / 0.72) 34%, transparent 78%)",
        }}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-24"
        style={{
          backgroundImage: "linear-gradient(to top, var(--color-background), transparent)",
        }}
      />
    </div>
  );
}
