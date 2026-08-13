"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import { precoLegivel, type ProdutoDaVitrine } from "@/lib/data/produtos";

/**
 * Carrossel de produtos.
 *
 * Rola de verdade (scroll-snap nativo), sem biblioteca e sem JavaScript para
 * funcionar: as setas só ajudam quem usa mouse. Assim a lista continua
 * navegável por teclado, por gesto no celular e por leitor de tela, que é o
 * ponto onde a maioria dos carrosséis quebra.
 */
export function Vitrine({ produtos, rotuloBotao }: { produtos: ProdutoDaVitrine[]; rotuloBotao: string }) {
  const trilho = useRef<HTMLUListElement>(null);
  const [temAntes, setTemAntes] = useState(false);
  const [temDepois, setTemDepois] = useState(false);

  const conferir = useCallback(() => {
    const el = trilho.current;
    if (!el) return;
    setTemAntes(el.scrollLeft > 8);
    setTemDepois(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  }, []);

  useEffect(() => {
    conferir();
    const el = trilho.current;
    if (!el) return;
    el.addEventListener("scroll", conferir, { passive: true });
    window.addEventListener("resize", conferir);
    return () => {
      el.removeEventListener("scroll", conferir);
      window.removeEventListener("resize", conferir);
    };
  }, [conferir]);

  function andar(direcao: 1 | -1) {
    const el = trilho.current;
    if (!el) return;
    // Anda pela largura de um cartão, não pela tela inteira: pular de página
    // faz perder a referência do que já foi visto.
    const cartao = el.querySelector("li");
    const passo = cartao ? cartao.getBoundingClientRect().width + 20 : el.clientWidth * 0.8;
    el.scrollBy({ left: passo * direcao, behavior: "smooth" });
  }

  if (produtos.length === 0) return null;

  return (
    <div className="relative">
      <ul
        ref={trilho}
        className="-mx-5 flex snap-x snap-mandatory gap-5 overflow-x-auto px-5 pb-2 sm:-mx-8 sm:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {produtos.map((p) => {
          const cheio = precoLegivel(p.preco);
          const promo = precoLegivel(p.precoPromocional);
          return (
            <li key={p.id} className="w-[13.5rem] shrink-0 snap-start sm:w-[15rem]">
              <a
                href={p.href}
                target="_blank"
                rel="noopener noreferrer"
                data-evento="clique_produto"
                className="group flex h-full flex-col"
              >
                <span className="relative block aspect-square overflow-hidden rounded-md border border-border bg-media">
                  {p.imagem ? (
                    <Image
                      src={p.imagem}
                      alt={p.nome}
                      fill
                      sizes="(min-width: 640px) 240px, 216px"
                      className="object-contain transition-transform duration-700 ease-[cubic-bezier(.2,.75,.25,1)] group-hover:scale-[1.04]"
                    />
                  ) : null}
                </span>

                <span className="mt-3 line-clamp-2 block text-apoio font-medium leading-snug text-ink transition-colors group-hover:text-brand-strong">
                  {p.nome}
                </span>

                {/* Preço só quando existe de verdade. Nada de "sob consulta"
                    inventado: preço é espelho da Tray (PROJETO §3). */}
                {promo ?? cheio ? (
                  <span className="numeros mt-1.5 flex items-baseline gap-2">
                    <span className="text-apoio font-semibold text-ink">{promo ?? cheio}</span>
                    {promo && cheio && promo !== cheio ? (
                      <span className="text-nota text-muted line-through">{cheio}</span>
                    ) : null}
                  </span>
                ) : null}

                <span className="mt-2.5 inline-flex items-center gap-1 text-nota font-semibold text-brand-nav">
                  {rotuloBotao}
                  <ArrowUpRight
                    size={12}
                    aria-hidden
                    className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                  />
                </span>
              </a>
            </li>
          );
        })}
      </ul>

      {/* Só para o mouse: quem usa teclado já navega com Tab, e quem está no
          celular arrasta. Por isso ficam escondidas do leitor de tela. */}
      <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 right-0 hidden items-center justify-between lg:flex">
        <button
          type="button"
          tabIndex={-1}
          onClick={() => andar(-1)}
          className={`pointer-events-auto -ml-4 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-white/90 text-ink shadow-[var(--jk-sombra-selo)] backdrop-blur transition-opacity hover:border-brand/50 ${
            temAntes ? "opacity-100" : "opacity-0"
          }`}
        >
          <ChevronLeft size={17} />
        </button>
        <button
          type="button"
          tabIndex={-1}
          onClick={() => andar(1)}
          className={`pointer-events-auto -mr-4 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-white/90 text-ink shadow-[var(--jk-sombra-selo)] backdrop-blur transition-opacity hover:border-brand/50 ${
            temDepois ? "opacity-100" : "opacity-0"
          }`}
        >
          <ChevronRight size={17} />
        </button>
      </div>
    </div>
  );
}
