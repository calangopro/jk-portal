import Image from "next/image";
import Link from "next/link";
import { Clock, RefreshCw } from "lucide-react";
import { Trilha, type Passo } from "@/components/ui/Trilha";
import { Pill } from "@/components/ui/Pill";
import { Figura } from "@/components/ui/Figura";
import {
  dataLonga,
  dataCurta,
  mostrarAtualizacao,
} from "@/lib/content/leitura";
import type { Content } from "@/lib/content/types";

/** O cluster vem em minúscula do banco ("aliança de namoro"). */
function comMaiuscula(texto: string) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/**
 * Recorte da capa.
 *
 * Forçar 16/9 em toda imagem decapita foto quadrada ou em pé, que é o formato
 * mais comum em foto de joia. Imagem larga vira faixa; o resto fica em 4/3,
 * que corta pouco e ainda mantém as capas com altura parecida entre si.
 */
function proporcaoDaCapa(largura: number, altura: number): string {
  return largura / altura >= 1.5 ? "16 / 9" : "4 / 3";
}

function iniciais(nome: string) {
  return nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Cabeçalho editorial do artigo.
 *
 * A ordem é a de uma publicação séria: trilha, categoria, título, linha de
 * apoio, assinatura e capa. A `answer` do conteúdo vira a LINHA DE APOIO
 * (standfirst), em vez da caixa de vidro que ficava plantada entre o título e
 * o texto. Ela continua sendo o primeiro texto do artigo, então a extração por
 * IA e a regra de resposta primeiro do REGRAS.md seguem cumpridas; o que muda
 * é só o peso visual.
 */
export function CabecalhoGuia({
  guia,
  minutos,
  passos,
  etiqueta,
}: {
  guia: Content;
  minutos: number;
  passos: Passo[];
  etiqueta?: string;
}) {
  // Pessoa cadastrada tem prioridade sobre o texto livre.
  const nomeDoAutor = guia.autor?.name ?? guia.authorName ?? null;
  const nomeDoRevisor = guia.revisor?.name ?? guia.reviewerName ?? null;

  const publicado = dataLonga(guia.publishedAt);
  const atualizado = mostrarAtualizacao(guia.publishedAt, guia.updatedAt)
    ? dataCurta(guia.updatedAt)
    : null;

  return (
    <header>
      <Trilha passos={passos} className="mb-7" />

      {etiqueta ? (
        <div className="mb-5">
          <Pill>{comMaiuscula(etiqueta)}</Pill>
        </div>
      ) : null}

      <h1 className="font-display max-w-[19ch] text-titulo-artigo text-ink">
        {guia.title}
      </h1>

      {guia.answer ? (
        <p className="linha-apoio mt-6 max-w-[46ch] text-lede">{guia.answer}</p>
      ) : null}

      <div aria-hidden className="filete-dourado mt-7" />

      {/* Assinatura. Autor e revisor são sinal de E-E-A-T e estavam escondidos
          lá embaixo, depois dos comentários.

          Quando existe autor CADASTRADO, o nome vira link para /autor/[slug] e
          ganha retrato e cargo. É o que a documentação do Google descreve como
          assinatura útil: leva a informação sobre a pessoa e sua área. Nome em
          texto livre continua funcionando, sem link, para conteúdo antigo. */}
      <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3 text-nota text-muted">
        {nomeDoAutor ? (
          <span className="flex items-center gap-2.5">
            {guia.autor?.foto ? (
              <Image
                src={guia.autor.foto.url}
                alt={guia.autor.foto.alt}
                width={guia.autor.foto.width}
                height={guia.autor.foto.height}
                sizes="36px"
                className="h-9 w-9 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span
                aria-hidden
                className="flex h-9 w-9 items-center justify-center rounded-full bg-brand/15 text-nota font-semibold text-brand-strong"
              >
                {iniciais(nomeDoAutor)}
              </span>
            )}
            <span className="text-apoio">
              {guia.autor ? (
                <Link
                  href={`/autor/${guia.autor.slug}`}
                  className="font-semibold text-ink underline decoration-brand/40 underline-offset-4 hover:decoration-brand"
                  rel="author"
                >
                  {guia.autor.name}
                </Link>
              ) : (
                <span className="font-semibold text-ink">{nomeDoAutor}</span>
              )}
              {guia.autor?.jobTitle ? (
                <span className="block text-nota text-muted">
                  {guia.autor.jobTitle}
                </span>
              ) : null}
              {nomeDoRevisor ? (
                <span className="block text-nota text-muted">
                  Revisão de{" "}
                  {guia.revisor ? (
                    <Link
                      href={`/autor/${guia.revisor.slug}`}
                      className="underline decoration-brand/40 underline-offset-4 hover:decoration-brand"
                    >
                      {guia.revisor.name}
                    </Link>
                  ) : (
                    nomeDoRevisor
                  )}
                </span>
              ) : null}
            </span>
          </span>
        ) : null}

        {publicado ? (
          <time dateTime={guia.publishedAt ?? undefined}>{publicado}</time>
        ) : null}

        {atualizado ? (
          <span className="flex items-center gap-1.5">
            <RefreshCw size={12} aria-hidden />
            Atualizado em {atualizado}
          </span>
        ) : null}

        <span className="flex items-center gap-1.5">
          <Clock size={12} aria-hidden />
          {minutos} min de leitura
        </span>
      </div>

      {guia.capa ? (
        <Figura
          imagem={guia.capa}
          prioridade
          proporcao={proporcaoDaCapa(guia.capa.width, guia.capa.height)}
          sizes="(min-width: 1024px) 760px, 100vw"
          className="mt-10"
        />
      ) : null}
    </header>
  );
}
