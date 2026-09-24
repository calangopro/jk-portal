"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { precoLegivel } from "@/lib/data/vitrine";
import { medirItemEscolhido, medirListaVista, type ItemDaLista } from "@/lib/bio/medicao";

export type ProdutoDoCarrossel = ItemDaLista & {
  imagem: string;
  href: string;
  desconto: number | null;
};

type Props = {
  lista: { id: string; nome: string };
  produtos: ProdutoDoCarrossel[];
  rotuloComprar: string;
  /** Primeira vitrine da página: as duas fotos de cima são o maior elemento da tela. */
  prioridade?: boolean;
};

/**
 * Uma linha, dois produtos por vez, e a seta para o lado.
 *
 * Rola de verdade (scroll-snap nativo), então funciona por gesto no celular,
 * por roda e por teclado mesmo antes do JavaScript chegar. As setas aparecem
 * também no celular, de propósito: numa bio a pessoa não sabe que a fileira
 * continua se nada disser, e a seta é o aviso. Por isso elas são botões de
 * verdade, com rótulo, e não enfeite escondido do leitor de tela como na home.
 *
 * O cartão inteiro é o link, direto para a página do produto na loja, na mesma
 * aba. No navegador do Instagram, aba nova vira uma janela solta e o "voltar"
 * deixa de trazer a pessoa para a bio.
 */
export function Carrossel({ lista, produtos, rotuloComprar, prioridade = false }: Props) {
  const idDaLista = useId();
  const raiz = useRef<HTMLDivElement>(null);
  const trilho = useRef<HTMLUListElement>(null);
  const [temAntes, setTemAntes] = useState(false);
  const [temDepois, setTemDepois] = useState(produtos.length > 2);
  const [progresso, setProgresso] = useState(0);

  const conferir = useCallback(() => {
    const el = trilho.current;
    if (!el) return;
    const sobra = el.scrollWidth - el.clientWidth;
    setTemAntes(el.scrollLeft > 4);
    setTemDepois(el.scrollLeft < sobra - 4);
    setProgresso(sobra > 0 ? el.scrollLeft / sobra : 0);
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

  // `view_item_list` uma vez, quando a vitrine aparece de fato na tela. Contar
  // na carga da página diria que a pessoa viu a vitrine do rodapé sem rolar.
  useEffect(() => {
    const el = raiz.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) {
          medirListaVista(lista, produtos);
          observador.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    observador.observe(el);
    return () => observador.disconnect();
  }, [lista, produtos]);

  function andar(direcao: 1 | -1) {
    const el = trilho.current;
    if (!el) return;
    // Anda dois cartões, que é exatamente a tela: a pessoa vê o par seguinte
    // inteiro, sem meio cartão cortado na borda.
    el.scrollBy({ left: el.clientWidth * direcao, behavior: "smooth" });
  }

  const paginas = Math.ceil(produtos.length / 2);

  return (
    <div ref={raiz} className="relative">
      <ul
        ref={trilho}
        id={idDaLista}
        aria-label={lista.nome}
        className="rolagem-discreta flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain"
      >
        {produtos.map((p, i) => {
          const atual = precoLegivel(p.atual);
          const anterior = precoLegivel(p.anterior);
          return (
            <li key={p.id} className="w-[calc((100%-0.75rem)/2)] shrink-0 snap-start">
              <a
                href={p.href}
                data-evento="clique_produto"
                data-produto-nome={p.nome}
                onClick={() => medirItemEscolhido(lista, p, i)}
                className="group flex h-full flex-col overflow-hidden rounded-[18px] border border-[var(--bio-linha)] bg-[var(--bio-superficie)] transition-colors hover:border-[var(--bio-linha-forte)]"
              >
                <span className="relative block aspect-square bg-[var(--bio-foto)]">
                  <Image
                    src={p.imagem}
                    alt={p.nome}
                    fill
                    sizes="(min-width: 480px) 220px, 46vw"
                    priority={prioridade && i < 2}
                    className="object-contain p-1.5 transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                  {p.desconto ? (
                    <span className="numeros absolute left-2 top-2 rounded-full bg-[var(--bio-selo)] px-2 py-0.5 text-[0.7rem] font-semibold tracking-wide text-[var(--bio-selo-texto)]">
                      {p.desconto}% OFF
                    </span>
                  ) : null}
                </span>

                <span className="flex flex-1 flex-col px-3 pb-3 pt-2.5">
                  <span className="line-clamp-2 text-[0.8rem] font-medium leading-snug text-[var(--bio-texto)]">
                    {p.nome}
                  </span>

                  <span className="numeros mt-auto pt-2">
                    {anterior ? (
                      <span className="block text-[0.72rem] text-[var(--bio-apoio)] line-through">
                        <span className="sr-only">De </span>
                        {anterior}
                      </span>
                    ) : null}
                    <span className="block text-[0.95rem] font-semibold text-[var(--bio-texto)]">
                      {anterior ? <span className="sr-only">Por </span> : null}
                      {atual}
                    </span>
                  </span>

                  <span className="mt-2.5 flex min-h-9 items-center justify-center rounded-full bg-[var(--bio-acao)] text-[0.78rem] font-semibold tracking-wide text-[var(--bio-acao-texto)] transition-colors group-hover:bg-[var(--bio-acao-realce)]">
                    {rotuloComprar}
                  </span>
                </span>
              </a>
            </li>
          );
        })}
      </ul>

      {produtos.length > 2 ? (
        <>
          {/* A faixa das setas tem a altura da linha de FOTOS (dois quadrados
              lado a lado dão 2:1), então as setas ficam no meio da foto e não
              em cima do preço. */}
          <div className="pointer-events-none absolute inset-x-0 top-0 flex aspect-[2/1] items-center justify-between">
            <BotaoDeSeta
              lado="antes"
              visivel={temAntes}
              controla={idDaLista}
              aoClicar={() => andar(-1)}
            />
            <BotaoDeSeta
              lado="depois"
              visivel={temDepois}
              controla={idDaLista}
              aoClicar={() => andar(1)}
            />
          </div>

          {/* Onde a pessoa está na fileira. Decorativo: o leitor de tela já
              anuncia a lista com a quantidade de itens. */}
          <div aria-hidden className="mx-auto mt-3 h-[3px] w-16 overflow-hidden rounded-full bg-[var(--bio-linha)]">
            <div
              className="h-full rounded-full bg-[var(--bio-acento)] transition-[margin] duration-200"
              style={{
                width: `${100 / paginas}%`,
                marginLeft: `${progresso * (100 - 100 / paginas)}%`,
              }}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}

function BotaoDeSeta({
  lado,
  visivel,
  controla,
  aoClicar,
}: {
  lado: "antes" | "depois";
  visivel: boolean;
  controla: string;
  aoClicar: () => void;
}) {
  const Icone = lado === "antes" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={aoClicar}
      aria-controls={controla}
      aria-label={lado === "antes" ? "Produtos anteriores" : "Mais produtos"}
      // Some sem sair do lugar: `hidden` mudaria a vez do Tab no meio da
      // navegação por teclado.
      tabIndex={visivel ? 0 : -1}
      aria-hidden={!visivel}
      className={`pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border border-[var(--bio-linha-forte)] bg-[var(--bio-superficie)] text-[var(--bio-texto)] shadow-[0_8px_20px_-8px_rgb(0_0_0/0.45)] transition-opacity duration-200 ${
        lado === "antes" ? "-ml-2" : "-mr-2"
      } ${visivel ? "opacity-100" : "pointer-events-none opacity-0"}`}
    >
      <Icone size={20} aria-hidden />
    </button>
  );
}
