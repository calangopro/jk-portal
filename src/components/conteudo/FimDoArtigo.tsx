import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { grade } from "@/components/ui/grade";
import { precoLegivel, type ProdutoDaVitrine } from "@/lib/data/vitrine";
import { tempoDeLeitura, dataLonga } from "@/lib/content/leitura";
import type { Content } from "@/lib/content/types";

/**
 * O que vem depois do texto.
 *
 * O artigo terminava e morria: depois da assinatura vinha o formulário de
 * comentário e mais nada. Quem leu o guia inteiro sobre como escolher aliança
 * chegava ao ponto de maior intenção da jornada e não recebia nem um produto
 * nem um próximo texto. No desktop a única saída era a coluna lateral de 19 rem,
 * que a essa altura já ficou para trás na rolagem.
 *
 * A ordem é essa por causa da intenção: quem acabou de ler está mais perto de
 * comprar do que de continuar lendo, então o produto vem primeiro. Os produtos
 * são os que o editor amarrou ao guia, não uma amostra do catálogo: o valor
 * está em ser a peça de que o texto fala.
 *
 * Não é a mesma lista que ficava na coluna lateral. Ela saiu de lá e do apoio
 * do celular, porque os mesmos quatro links duas vezes na mesma página não
 * ajudam ninguém a escolher.
 */
export function FimDoArtigo({
  produtos,
  outros,
}: {
  produtos: ProdutoDaVitrine[];
  outros: Content[];
}) {
  if (produtos.length === 0 && outros.length === 0) return null;

  return (
    <div className="mt-16 max-w-leitura-larga space-y-14">
      {produtos.length > 0 ? (
        <section aria-labelledby="produtos-do-guia">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-3">
            <h2
              id="produtos-do-guia"
              className="font-display min-w-0 break-words text-titulo-secao text-ink"
            >
              As peças deste guia
            </h2>
            <span aria-hidden className="hairline min-w-12 flex-1" />
          </div>
          <p className="mt-2 text-apoio leading-relaxed text-muted">
            Preço, estoque e compra ficam na loja oficial da JK.
          </p>

          <ul className={`mt-6 grid gap-5 ${grade(produtos.length, 3)}`}>
            {produtos.map((p) => {
              const promo = precoLegivel(p.precoPromocional);
              const cheio = precoLegivel(p.preco);
              return (
                <li key={p.id}>
                  <a
                    href={p.href}
                    target="_blank"
                    rel="noopener"
                    data-evento="clique_produto"
                    data-destino="fim_do_artigo"
                    className="group block"
                  >
                    <span className="relative block aspect-square overflow-hidden rounded-md border border-border bg-media">
                      {p.imagem ? (
                        <Image
                          src={p.imagem}
                          alt={p.nome}
                          fill
                          sizes="(min-width: 640px) 240px, 100vw"
                          className="object-contain transition-transform duration-500 group-hover:scale-[1.04]"
                        />
                      ) : null}
                    </span>
                    <span className="mt-3 line-clamp-2 block text-apoio font-medium leading-snug text-ink">
                      {p.nome}
                    </span>
                    {/* Sem preço no banco, nada é escrito. Nunca "sob consulta". */}
                    {promo || cheio ? (
                      <span className="numeros mt-1.5 flex items-baseline gap-2">
                        <span className="text-apoio font-semibold text-ink">{promo ?? cheio}</span>
                        {promo && cheio ? (
                          <span className="text-nota text-muted line-through">{cheio}</span>
                        ) : null}
                      </span>
                    ) : null}
                    <span className="mt-2 inline-flex items-center gap-1 text-nota font-semibold text-brand-nav">
                      Ver na loja
                      <ArrowUpRight size={12} aria-hidden />
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {outros.length > 0 ? (
        <section aria-labelledby="leia-tambem">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-3">
            <h2
              id="leia-tambem"
              className="font-display min-w-0 break-words text-titulo-secao text-ink"
            >
              Leia também
            </h2>
            <div className="flex min-w-32 flex-1 items-baseline gap-4">
              <span aria-hidden className="hairline flex-1" />
              <Link
                href="/dicas"
                className="alvo-44 shrink-0 text-apoio font-semibold text-brand-nav hover:underline"
              >
                Ver todos
              </Link>
            </div>
          </div>

          <ul className={`mt-6 grid gap-5 ${grade(outros.length, 3)}`}>
            {outros.map((g) => (
              <li key={g.id}>
                <Card
                  href={`/${g.slug}`}
                  imagem={g.capa}
                  titulo={g.title}
                  resumo={g.excerpt}
                  meta={
                    <>
                      {dataLonga(g.publishedAt) ? (
                        <time dateTime={g.publishedAt ?? undefined}>
                          {dataLonga(g.publishedAt)}
                        </time>
                      ) : null}
                      <span>{tempoDeLeitura(g.bodyHtml ?? g.bodyMd)} min de leitura</span>
                    </>
                  }
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
