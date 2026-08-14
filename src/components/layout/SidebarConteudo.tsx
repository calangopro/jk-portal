import Link from "next/link";
import Image from "next/image";
import { Ruler, BookOpen, MapPin, ArrowRight } from "lucide-react";
import { IndiceAtivo } from "@/components/conteudo/IndiceAtivo";
import type { ItemIndice } from "@/lib/content/indice";
import type { Content } from "@/lib/content/types";

/**
 * Coluna lateral do artigo.
 *
 * Serve a três coisas: localizar a pessoa no texto (índice), oferecer a
 * ferramenta que resolve a dúvida mais buscada (medidor) e manter a navegação
 * viva com guias vizinhos, o que também alimenta a linkagem interna exigida.
 *
 * Os blocos NÃO têm o mesmo peso de propósito. Antes eram quatro cards de vidro
 * idênticos, e quando tudo grita ninguém escuta: o índice é discreto, o medidor
 * é o único com fundo cheio e as lojas fecham em tom baixo.
 */
export function SidebarConteudo({
  indice,
  outros,
}: {
  indice: ItemIndice[];
  outros: Content[];
}) {
  return (
    <aside className="hidden lg:col-start-2 lg:row-start-1 lg:block lg:sticky lg:top-24 lg:h-fit lg:space-y-8">
      {/* Índice: sem caixa, para não competir com o texto. */}
      <IndiceAtivo itens={indice} />

      {/* Ferramenta: o único bloco com peso cheio da coluna. */}
      <div className="relative overflow-hidden rounded-lg bg-charcoal p-5 text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-brand/25 blur-2xl"
        />
        <div className="relative">
          <span className="flex h-9 w-9 items-center justify-center rounded-sm border border-brand/40 bg-brand/15 text-brand-light">
            <Ruler size={16} aria-hidden />
          </span>
          <p className="font-display mt-4 text-titulo-bloco">Não sabe seu aro?</p>
          <p className="mt-2 text-apoio leading-relaxed text-white/70">
            Descubra pela tela em menos de dois minutos, usando uma moeda de R$ 1.
          </p>
          <Link
            href="/medidor-de-aliancas"
            className="mt-5 inline-flex min-h-10 items-center gap-1.5 rounded-full bg-brand px-4 text-nota font-semibold text-ink transition-colors hover:bg-brand-light"
          >
            Medir agora <ArrowRight size={13} aria-hidden />
          </Link>
        </div>
      </div>

      {outros.length > 0 ? (
        <div>
          <p className="eyebrow flex items-center gap-1.5">
            <BookOpen size={12} aria-hidden /> Continue lendo
          </p>
          <ul className="mt-4 space-y-4">
            {outros.map((g) => (
              <li key={g.id}>
                <Link href={`/guia/${g.slug}`} className="group flex gap-3">
                  {g.capa ? (
                    <span className="relative block h-14 w-20 shrink-0 overflow-hidden rounded-sm bg-media">
                      <Image
                        src={g.capa.url}
                        alt={g.capa.alt || g.title}
                        fill
                        sizes="80px"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    </span>
                  ) : null}
                  <span className="block text-apoio font-medium leading-snug text-ink transition-colors group-hover:text-brand-nav">
                    {g.title}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href="/guia"
            className="mt-5 inline-block text-nota font-semibold text-brand-nav hover:underline"
          >
            Ver todos os posts
          </Link>
        </div>
      ) : null}

      <div className="border-t border-border pt-6">
        <p className="eyebrow flex items-center gap-1.5">
          <MapPin size={12} aria-hidden /> Experimente na loja
        </p>
        <p className="mt-3 text-apoio leading-relaxed text-muted">
          A JK tem lojas físicas com aro de prova e atendimento presencial.
        </p>
        <Link
          href="/lojas"
          className="mt-3 inline-flex items-center gap-1.5 text-apoio font-semibold text-brand-nav hover:underline"
        >
          Ver as lojas <ArrowRight size={13} aria-hidden />
        </Link>
      </div>
    </aside>
  );
}
