"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { MapPin, Navigation, MessageCircle, Clock } from "lucide-react";
import { linkDoMaps, linkDoWaze, linkDoWhatsapp } from "@/lib/data/rotas";
import { grade } from "@/components/ui/grade";
import type { Location } from "@/lib/content/types";

/**
 * Índice de lojas em grade contínua, com filtro por cidade.
 *
 * Antes a página abria uma seção por cidade, com um H2 cada. Quatro cidades têm
 * uma loja só, e cada uma dessas gerava uma fileira inteira de três colunas com
 * um cartão e dois terços de vazio; São Paulo tem quatro lojas numa grade de
 * três, o que deixava a quarta órfã. A página inteira virou buraco.
 *
 * Numa grade contínua nenhuma fileira sobra, e a cidade continua legível: ela
 * está escrita no próprio cartão e os cartões saem agrupados por cidade, com a
 * capital abrindo a lista. Quem procura uma cidade específica usa o filtro.
 *
 * É componente de cliente por causa do filtro, mas o HTML dos cartões continua
 * saindo pronto do servidor na primeira resposta, então todo link de loja segue
 * visível para o rastreador. Sem JavaScript a página mostra as dez lojas, que é
 * o estado certo para quem chega sem filtrar.
 */

const TODAS = "todas";

function resumoDoHorario(l: Location): string | null {
  if (!l.openingHours?.length) return null;
  const semana = l.openingHours[0];
  return `${semana.opens} às ${semana.closes}`;
}

function cidadeDe(l: Location): string {
  return l.addressLocality ?? "Outras unidades";
}

/**
 * Ordena para a grade sair agrupada por cidade sem precisar de cabeçalho.
 *
 * São Paulo abre porque concentra a maioria das unidades e é o que a maioria
 * procura; o resto vem por quantidade, que é a mesma regra do agrupamento
 * antigo, só que agora dentro de uma fileira contínua.
 */
function porCidade(lojas: Location[]): { cidades: { nome: string; total: number }[]; ordenadas: Location[] } {
  const grupos = new Map<string, Location[]>();
  for (const l of lojas) {
    const c = cidadeDe(l);
    grupos.set(c, [...(grupos.get(c) ?? []), l]);
  }
  const ordem = [...grupos.entries()].sort((a, b) => {
    if (a[0] === "São Paulo") return -1;
    if (b[0] === "São Paulo") return 1;
    return b[1].length - a[1].length;
  });
  return {
    cidades: ordem.map(([nome, lista]) => ({ nome, total: lista.length })),
    ordenadas: ordem.flatMap(([, lista]) => lista),
  };
}

export function ListaDeLojas({ lojas }: { lojas: Location[] }) {
  const [filtro, setFiltro] = useState<string>(TODAS);
  const { cidades, ordenadas } = useMemo(() => porCidade(lojas), [lojas]);
  const visiveis = filtro === TODAS ? ordenadas : ordenadas.filter((l) => cidadeDe(l) === filtro);

  const chip =
    "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-apoio font-semibold transition-colors";

  return (
    <div className="mt-12">
      <div className="flex flex-wrap gap-2.5" role="group" aria-label="Filtrar lojas por cidade">
        <button
          type="button"
          onClick={() => setFiltro(TODAS)}
          aria-pressed={filtro === TODAS}
          className={`${chip} ${
            filtro === TODAS
              ? "border-brand bg-brand/15 text-brand-strong"
              : "border-ink/15 text-ink hover:border-brand hover:text-brand-nav"
          }`}
        >
          Todas
          <span className="numeros text-nota font-normal text-muted">{ordenadas.length}</span>
        </button>
        {cidades.map((c) => (
          <button
            key={c.nome}
            type="button"
            onClick={() => setFiltro(c.nome)}
            aria-pressed={filtro === c.nome}
            className={`${chip} ${
              filtro === c.nome
                ? "border-brand bg-brand/15 text-brand-strong"
                : "border-ink/15 text-ink hover:border-brand hover:text-brand-nav"
            }`}
          >
            <MapPin size={13} aria-hidden />
            {c.nome}
            <span className="numeros text-nota font-normal text-muted">{c.total}</span>
          </button>
        ))}
      </div>

      {/* A contagem é anunciada porque o filtro troca a lista sem mover o foco:
          quem usa leitor de tela não teria como saber que algo mudou. */}
      <p aria-live="polite" className="mt-5 text-nota text-muted">
        {visiveis.length} {visiveis.length === 1 ? "loja" : "lojas"}
        {filtro === TODAS ? "" : ` em ${filtro}`}
      </p>

      {/* A grade acompanha o que sobrou do filtro. Cidade com uma loja só
          desenharia duas colunas vazias ao lado, que é exatamente o buraco que
          esta página tinha antes, de volta pela porta do filtro. */}
      <ul className={`mt-5 grid gap-6 ${grade(visiveis.length, 3)}`}>
        {visiveis.map((l, i) => {
          const capa = l.fotos?.[0];
          const horario = resumoDoHorario(l);
          const whats = linkDoWhatsapp(l);
          const acao =
            "inline-flex min-h-9 items-center gap-1.5 rounded-full border border-ink/15 px-3 text-nota font-semibold text-ink transition-colors hover:border-brand hover:text-brand-nav";
          return (
            <li key={l.id} className="rise" style={{ animationDelay: `${i * 70}ms` }}>
              <article className="glass-card flex h-full flex-col overflow-hidden rounded-lg">
                <Link href={`/lojas/${l.slug}`} className="group block">
                  <div className="relative aspect-[3/2] overflow-hidden bg-media">
                    {capa ? (
                      <Image
                        src={capa.url}
                        alt={capa.alt || `Loja JK Alianças ${l.name}`}
                        fill
                        sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw"
                        className="object-cover transition-transform duration-[600ms] ease-[cubic-bezier(0.2,0.75,0.25,1)] group-hover:scale-[1.04]"
                      />
                    ) : (
                      // Sem foto ainda: em vez de um retângulo cinza, um cartão
                      // com o nome do shopping, que é a informação que a pessoa
                      // está procurando.
                      <div className="flex h-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-sand to-media px-5 text-center">
                        <MapPin size={18} aria-hidden className="text-brand-nav" />
                        <span className="font-display text-titulo-bloco text-brand-strong">
                          {l.mallName ?? l.name}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="p-5">
                    <p className="eyebrow text-[0.66rem]">
                      {l.addressLocality}
                      {l.addressRegion ? `, ${l.addressRegion}` : ""}
                    </p>
                    <h3 className="font-display mt-2 text-titulo-bloco text-ink transition-colors group-hover:text-brand-strong">
                      {l.name}
                    </h3>
                    <p className="mt-2 text-apoio leading-relaxed text-muted">{l.address}</p>
                    {horario ? (
                      <p className="mt-3 flex items-center gap-1.5 text-nota text-muted">
                        <Clock size={12} aria-hidden className="text-brand-nav" />
                        Seg a sáb, {horario}
                      </p>
                    ) : null}
                  </div>
                </Link>

                {/* Rota e contato direto no card: quem chega no índice muitas
                    vezes quer só o caminho, não a página. */}
                <div className="mt-auto flex flex-wrap gap-2 border-t border-border/70 px-5 py-4">
                  <a
                    href={linkDoMaps(l)}
                    target="_blank"
                    rel="noopener"
                    data-evento="clique_rota"
                    data-destino={l.slug}
                    className={acao}
                  >
                    <MapPin size={12} aria-hidden /> Maps
                  </a>
                  <a
                    href={linkDoWaze(l)}
                    target="_blank"
                    rel="noopener"
                    data-evento="clique_waze"
                    data-destino={l.slug}
                    className={acao}
                  >
                    <Navigation size={12} aria-hidden /> Waze
                  </a>
                  {whats ? (
                    <a
                      href={whats}
                      target="_blank"
                      rel="noopener"
                      data-evento="clique_whatsapp"
                      data-destino={l.slug}
                      className={acao}
                    >
                      <MessageCircle size={12} aria-hidden /> WhatsApp
                    </a>
                  ) : null}
                </div>
              </article>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
