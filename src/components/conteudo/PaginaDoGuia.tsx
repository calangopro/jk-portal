import { Container } from "@/components/layout/Container";
import { ShareButtons } from "@/components/ui/ShareButtons";
import { Pill } from "@/components/ui/Pill";
import { FaqLista } from "@/components/ui/FaqLista";
import { Comentarios } from "@/components/comentarios/Comentarios";
import { SidebarConteudo } from "@/components/layout/SidebarConteudo";
import { CabecalhoGuia } from "./CabecalhoGuia";
import { CapaDeFundo } from "./CapaDeFundo";
import { IndiceMobile } from "./IndiceMobile";
import { ApoioMobile } from "./ApoioMobile";
import { comIndice } from "@/lib/content/indice";
import { comPrecosAtuais } from "@/lib/conteudo/precos";
import { tempoDeLeitura } from "@/lib/content/leitura";
import { comentariosAprovados, contarComentarios } from "@/lib/data/comentarios";
import { JsonLd } from "@/components/schema/JsonLd";
import { faqsDoHtml, faqsUnidas } from "@/lib/content/faq-html";
import { separarFerramentas } from "@/lib/content/ferramentas-html";
import { FerramentaEmbutida } from "@/components/ferramentas/Embutida";
import {
  articleSchema,
  breadcrumbSchema,
  faqPageSchema,
  productSchema,
  webPageSchema,
} from "@/lib/schema/builders";
import { canonicalDoGuia } from "@/lib/seo/metadata";
import { absoluteUrl } from "@/lib/seo/site";
import {
  getPublishedGuias,
  comAutores,
  relacionadosPorGrafo,
  produtosDoConteudo,
  mapaDeDimensoes,
  comCapas,
  capaDoConteudo,
} from "@/lib/data/contents";
import type { Content } from "@/lib/content/types";

/**
 * A página de um guia.
 *
 * Vive fora da rota porque o preview de rascunho renderiza exatamente isto.
 * Duplicar o layout faria as duas versões divergirem com o tempo, e aí o
 * preview passaria a mentir sobre o que vai ao ar.
 */
export async function PaginaDoGuia({ guia: recebido }: { guia: Content }) {
  // A capa e a autoria são carregadas aqui, e não em getGuiaBySlug, para o
  // generateMetadata não pagar por consultas que só a renderização usa.
  const comCapa: Content = recebido.capa
    ? recebido
    : { ...recebido, capa: await capaDoConteudo(recebido.id) };
  const [guia] = await comAutores([comCapa]);

  const comentarios = await comentariosAprovados(guia.id);
  const produtos = await produtosDoConteudo(guia.id);

  // Índice a partir dos H2, e outros guias para a coluna lateral.
  const dimensoes = await mapaDeDimensoes(guia.bodyHtml ?? "");
  // Preço dos cards de produto vem da tabela `products`, não do que ficou
  // gravado no texto no dia em que o guia foi escrito. Ver src/lib/conteudo/precos.ts.
  const corpo = await comPrecosAtuais(guia.bodyHtml ?? "");
  const { html: corpoComIndice, indice } = comIndice(corpo, dimensoes);

  // A primeira imagem do corpo vira a imagem do Article, com dimensão real.
  // Se o guia tem capa, ela tem prioridade: é a imagem que representa a página.
  const primeiraImagem = (() => {
    if (guia.capa) {
      return {
        url: guia.capa.url,
        width: guia.capa.width,
        height: guia.capa.height,
        alt: guia.capa.alt,
        caption: guia.capa.caption,
        credit: guia.capa.credit,
      };
    }
    const src = /<img\b[^>]*src\s*=\s*"([^"]+)"/i.exec(corpoComIndice)?.[1];
    const d = src ? dimensoes.get(src) : undefined;
    return src && d ? { url: src, width: d.width, height: d.height } : undefined;
  })();

  // Relacionados vêm do grafo de links (o que este guia cita e o que cita ele),
  // completando pelo cluster quando o grafo ainda não basta. A lista dos quatro
  // guias mais recentes ficava sem relação nenhuma com o que a pessoa está
  // lendo, e link interno sem pertinência não ajuda leitor nem buscador.
  const doGrafo = await relacionadosPorGrafo(guia.id, guia.cluster, 4);
  const relacionados = doGrafo.length
    ? doGrafo
    : // Sobra final: conteúdo recém-criado, sem link e sem cluster, e também o
      // ambiente de desenvolvimento com dados de exemplo (que não têm grafo).
      (await getPublishedGuias()).filter((g) => g.id !== guia.id).slice(0, 4);
  const outros = await comCapas(relacionados);
  const isSample = guia.id.startsWith("sample-");
  const minutos = tempoDeLeitura(guia.bodyHtml ?? guia.bodyMd);

  // FAQ do corpo e FAQ do formulário viram uma lista só para o schema.
  // O bloco de FAQ do editor põe a pergunta onde ela nasce, no meio do assunto,
  // e sem juntar aqui essas perguntas ficariam de fora do FAQPage, que é
  // justamente o que os sistemas de IA leem.
  const faqsParaSchema = faqsUnidas(faqsDoHtml(corpo), guia.faqs);

  // O corpo em pedaços, com os marcadores de ferramenta separados do HTML.
  // Sem marcador nenhum, isto devolve um único pedaço e nada muda.
  const pedacos = separarFerramentas(corpoComIndice);

  return (
    <main>
      <JsonLd
        data={webPageSchema({
          url: canonicalDoGuia(guia),
          name: guia.metaTitle ?? guia.title,
          description: guia.metaDescription ?? guia.excerpt,
          imagemPrincipal: primeiraImagem,
        })}
      />
      <JsonLd data={articleSchema(guia, primeiraImagem, contarComentarios(comentarios))} />
      <JsonLd
        data={breadcrumbSchema([
          { name: "Início", url: absoluteUrl("/") },
          { name: "Dicas", url: absoluteUrl("/guia") },
          { name: guia.title, url: absoluteUrl(`/guia/${guia.slug}`) },
        ])}
      />
      {faqsParaSchema.length ? <JsonLd data={faqPageSchema(faqsParaSchema)} /> : null}
      {/* Product só com produto real sincronizado da Tray. */}
      {produtos.map((p, i) => {
        const schema = productSchema(p);
        return schema ? <JsonLd key={i} data={schema} /> : null;
      })}

      <article>
        {/*
          Faixa de abertura, acima da grade.

          Antes o título e a resposta rápida moravam DENTRO da coluna de texto,
          espremidos ao lado da barra lateral: um H1 de display sobrava linha
          atrás de linha em metade da largura disponível. Aqui eles ocupam a
          página inteira, que é o peso que a abertura de um guia pede, e a
          resposta rápida (o trecho que a IA cita e que ganha destaque na busca)
          fica no primeiro lugar que o olho encontra.
        */}
        <div className="relative overflow-hidden border-b border-border/70 bg-gradient-to-b from-sand/60 to-transparent">
          {guia.capa ? <CapaDeFundo imagem={guia.capa} /> : null}

          {/* `relative` para o texto ficar por cima da capa, e a coluna trava
              em 60% no desktop para nunca invadir a área onde a foto ainda
              está nítida. */}
          <Container size="wide" className="relative py-12 sm:py-16 lg:max-w-[min(72rem,100%)]">
            <div className="lg:w-[60%]">
            {isSample ? (
              <div className="mb-6">
                <Pill tom="vinho">Conteúdo de exemplo (placeholder)</Pill>
              </div>
            ) : null}

            <CabecalhoGuia
              guia={guia}
              minutos={minutos}
              etiqueta={guia.cluster ?? "Guia"}
              passos={[
                { nome: "Início", href: "/" },
                { nome: "Dicas", href: "/guia" },
                { nome: guia.title },
              ]}
            />
            </div>
          </Container>
        </div>

        <Container size="wide" className="py-10 sm:py-14">
          {/* No celular a ordem é: índice recolhível, texto, apoio (medidor,
              relacionados, lojas) e só então os comentários. Antes a coluna de
              apoio caía depois dos comentários e todo o aparato de conversão
              ficava invisível justamente onde está o tráfego. */}
          <div className="grid gap-x-14 gap-y-10 lg:grid-cols-[minmax(0,1fr)_var(--container-lateral)]">
            <div className="min-w-0 lg:col-start-1 lg:row-start-1">
              <IndiceMobile itens={indice} />

              {/* Corpo. O HTML vem do editor em blocos do admin e usa a MESMA
                  classe `conteudo-rico` do editor, então o que a pessoa vê ao
                  escrever é o que vai ao ar. Fallback para o texto simples. */}
              {guia.bodyHtml ? (
                // O corpo é cortado nos marcadores de ferramenta, e o
                // componente interativo entra entre os pedaços. Sem isso, uma
                // ferramenta no meio do texto seria só um div vazio: HTML
                // servido de uma vez não carrega React dentro.
                pedacos.map((p, i) =>
                  p.tipo === "ferramenta" ? (
                    <FerramentaEmbutida key={`ferramenta-${i}`} slug={p.slug} />
                  ) : (
                    <div
                      key={`html-${i}`}
                      className="conteudo-rico mt-8 max-w-leitura-larga"
                      dangerouslySetInnerHTML={{ __html: p.valor }}
                    />
                  ),
                )
              ) : guia.bodyMd ? (
                <div className="conteudo-rico mt-8 max-w-leitura-larga">
                  {guia.bodyMd.split("\n\n").map((block, i) => {
                    const heading = block.match(/^##\s+(.*)$/);
                    return heading ? <h2 key={i}>{heading[1]}</h2> : <p key={i}>{block}</p>;
                  })}
                </div>
              ) : null}

              {guia.faqs?.length ? (
                <FaqLista faqs={guia.faqs} className="mt-16 max-w-leitura-larga" />
              ) : null}

              {/* Fecho do artigo: compartilhar depois da leitura, não antes.
                  Antes os botões ficavam no topo, pedindo que a pessoa
                  compartilhasse algo que ainda não tinha lido. */}
              <div className="mt-14 max-w-leitura-larga border-t border-border pt-7">
                <div className="flex flex-wrap items-center justify-between gap-5">
                  <div>
                    <p className="eyebrow">Achou útil?</p>
                    <p className="mt-1.5 text-apoio text-muted">
                      Mande para quem está escolhendo aliança junto com você.
                    </p>
                  </div>
                  <ShareButtons title={guia.title} />
                </div>

                {guia.authorName ? (
                  <p className="mt-8 text-nota leading-relaxed text-muted">
                    Escrito por{" "}
                    <span className="font-semibold text-ink">{guia.authorName}</span>
                    {guia.reviewerName ? (
                      <>
                        {" "}e revisado por{" "}
                        <span className="font-semibold text-ink">{guia.reviewerName}</span>
                      </>
                    ) : null}
                    . Conteúdo informativo da JK Alianças. Preço, estoque e compra
                    ficam na loja oficial.
                  </p>
                ) : null}
              </div>

              <ApoioMobile outros={outros} />
            </div>

            <SidebarConteudo indice={indice} outros={outros} />

            {/* Comentários: no desktop voltam para a coluna do texto, logo
                abaixo dele. No celular ficam por último, como deve ser. */}
            <div className="min-w-0 max-w-leitura-larga lg:col-start-1 lg:row-start-2">
              {!isSample ? (
                <Comentarios contentId={guia.id} slug={guia.slug} iniciais={comentarios} />
              ) : null}
            </div>
          </div>
        </Container>
      </article>
    </main>
  );
}
