"use client";

import Link from "next/link";
import { useState, type ComponentProps } from "react";

/**
 * Link do painel que busca a página INTEIRA no instante em que a pessoa mostra
 * que vai clicar: o mouse encostou, o dedo tocou ou o foco chegou pelo teclado.
 *
 * O `next/link` comum, em rota dinâmica, só adianta o esqueleto (`loading.tsx`)
 * e deixa os dados para depois do clique. Entre encostar e soltar o dedo passam
 * uns 100 ms, e entre o mouse chegar e clicar, uns 300: é tempo que o servidor
 * já pode estar trabalhando. Com a função ao lado do banco, a maior parte das
 * telas chega antes de o clique terminar, e a troca fica instantânea.
 *
 * Não busca tudo de todos os links da tela (`prefetch` ligado direto faria
 * isso, e o menu tem vinte e tantos): só do link em que a pessoa encostou. O
 * que foi buscado vale por `staleTimes.static` do `next.config.ts`.
 */
export function LinkRapido({ onMouseEnter, onTouchStart, onFocus, ...resto }: ComponentProps<typeof Link>) {
  const [vai, setVai] = useState(false);
  return (
    <Link
      {...resto}
      prefetch={vai ? true : null}
      onMouseEnter={(e) => {
        setVai(true);
        onMouseEnter?.(e);
      }}
      onTouchStart={(e) => {
        setVai(true);
        onTouchStart?.(e);
      }}
      onFocus={(e) => {
        setVai(true);
        onFocus?.(e);
      }}
    />
  );
}
