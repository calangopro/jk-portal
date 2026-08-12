"use client";

import { useEffect, useState } from "react";
import { List } from "lucide-react";
import type { ItemIndice } from "@/lib/content/indice";

/**
 * Índice do artigo com a seção atual em destaque.
 *
 * As âncoras já vêm no HTML servido (ver lib/content/indice.ts), então o índice
 * funciona sem JavaScript; o que o JavaScript acrescenta é só saber onde a
 * pessoa está. No celular ele vira um bloco recolhível logo abaixo do
 * cabeçalho: antes caía depois de todo o texto, onde não serve para navegar.
 */
export function IndiceAtivo({
  itens,
  className = "",
}: {
  itens: ItemIndice[];
  className?: string;
}) {
  const [ativo, setAtivo] = useState<string | null>(null);

  useEffect(() => {
    if (itens.length < 2) return;

    const alvos = itens
      .map((i) => document.getElementById(i.id))
      .filter((el): el is HTMLElement => Boolean(el));

    if (alvos.length === 0) return;

    // A faixa de observação fica no terço superior da tela: é onde o olho está
    // lendo, não no topo absoluto da janela.
    const observador = new IntersectionObserver(
      (entradas) => {
        const visiveis = entradas
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        if (visiveis.length > 0) {
          setAtivo(visiveis[0].target.id);
          return;
        }

        // Nenhum título na faixa: mantém o último que já passou pelo topo.
        const acima = alvos.filter((el) => el.getBoundingClientRect().top < 120);
        if (acima.length > 0) setAtivo(acima[acima.length - 1].id);
      },
      { rootMargin: "-88px 0px -68% 0px", threshold: 0 },
    );

    alvos.forEach((el) => observador.observe(el));
    return () => observador.disconnect();
  }, [itens]);

  if (itens.length < 2) return null;

  return (
    <nav aria-label="Índice do guia" className={className}>
      <p className="eyebrow flex items-center gap-1.5">
        <List size={12} aria-hidden /> Neste guia
      </p>
      <ol className="mt-4 space-y-1">
        {itens.map((i) => {
          const atual = ativo === i.id;
          return (
            <li key={i.id}>
              <a
                href={`#${i.id}`}
                aria-current={atual ? "location" : undefined}
                className={`block border-l-2 py-1.5 pl-3 text-apoio leading-snug transition-colors ${
                  atual
                    ? "border-brand font-semibold text-brand-strong"
                    : "border-border text-muted hover:border-brand/50 hover:text-brand-nav"
                }`}
              >
                {i.titulo}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
