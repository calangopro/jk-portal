import { notFound } from "next/navigation";
import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { Trilha } from "@/components/ui/Trilha";
import { FaqLista } from "@/components/ui/FaqLista";
import { ShareButtons } from "@/components/ui/ShareButtons";
import { Button } from "@/components/ui/Button";
import { JsonLd } from "@/components/schema/JsonLd";
import { Conversor } from "@/components/ferramentas/Conversor";
import { SimuladorDeLargura } from "@/components/ferramentas/SimuladorDeLargura";
import { Comparador } from "@/components/ferramentas/Comparador";
import { VitrineDaFerramenta } from "@/components/ferramentas/VitrineDaFerramenta";
import { FERRAMENTAS, acharFerramenta, type Ferramenta } from "@/lib/ferramentas/registro";
import { buildMetadata } from "@/lib/seo/metadata";
import { SITE, absoluteUrl } from "@/lib/seo/site";
import { breadcrumbSchema, faqPageSchema, howToSchema, webPageSchema } from "@/lib/schema/builders";

export const revalidate = 86400;
export const dynamicParams = false;

export function generateStaticParams() {
  return FERRAMENTAS.map((f) => ({ slug: f.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const f = acharFerramenta(slug);
  if (!f) {
    return buildMetadata({
      title: "Ferramenta não encontrada",
      description: "Esta ferramenta não existe ou saiu do ar.",
      path: `/ferramentas/${slug}`,
      noindex: true,
    });
  }

  return buildMetadata({
    // A marca entra aqui, e não em cada `metaTitle` do registro: assim a
    // ferramenta se declara uma vez e o título da aba sai igual ao do resto do
    // site, com a marca depois da barra.
    title: `${f.metaTitle} | ${SITE.name}`,
    description: f.metaDescription,
    path: `/ferramentas/${f.slug}`,
  });
}

/** Desenha a ferramenta certa. Um lugar só decide isso. */
function Widget({ f }: { f: Ferramenta }) {
  switch (f.slug) {
    case "conversor-de-aros":
      return <Conversor />;
    case "largura-da-alianca":
      return <SimuladorDeLargura />;
    case "materiais-de-alianca":
      return <Comparador />;
  }
}

/**
 * Página de ferramenta.
 *
 * Não é widget solto: é conteúdo indexável com resposta primeiro, passo a passo
 * e FAQ, e a ferramenta no meio. O melhor ativo de busca que a JK tem hoje é
 * exatamente isso, a página de medir o aro, com mais cliques que qualquer
 * artigo do site.
 *
 * O texto todo sai do registro em `src/lib/ferramentas/registro.ts`, então a
 * próxima ferramenta não precisa de página nova, só de mais uma entrada lá e do
 * componente dela.
 */
export default async function FerramentaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const f = acharFerramenta(slug);
  if (!f) notFound();

  const url = absoluteUrl(`/ferramentas/${f.slug}`);

  return (
    <main>
      <JsonLd
        data={webPageSchema({ url, name: f.metaTitle, description: f.metaDescription })}
      />
      <JsonLd
        data={breadcrumbSchema([
          { name: "Início", url: absoluteUrl("/") },
          { name: "Ferramentas", url: absoluteUrl("/ferramentas") },
          { name: f.nome, url },
        ])}
      />
      {f.passos?.length ? (
        <JsonLd
          data={howToSchema({
            nome: f.titulo,
            descricao: f.resposta,
            passos: f.passos.map((p) => ({ nome: p.nome, texto: p.texto })),
          })}
        />
      ) : null}
      {f.faqs.length ? <JsonLd data={faqPageSchema(f.faqs)} /> : null}

      <Container size="wide" className="py-12 sm:py-16">
        <Trilha
          passos={[
            { nome: "Início", href: "/" },
            { nome: "Ferramentas", href: "/ferramentas" },
            { nome: f.nome },
          ]}
        />

        <div className="mt-6 max-w-leitura-larga">
          <h1 className="font-display text-titulo-pagina text-ink">{f.titulo}</h1>
          {/* Resposta primeiro. É o primeiro texto da página, e é o trecho que
              a IA cita quando alguém pergunta a ela em vez de buscar.

              No celular ela vem em corpo, não em lede: em serifada grande a
              resposta virava treze linhas e empurrava a ferramenta inteira para
              fora da primeira tela. O texto é o mesmo, o GEO não muda. */}
          <p className="linha-apoio mt-4 text-corpo leading-relaxed sm:mt-5 sm:text-lede">
            {f.resposta}
          </p>
          <div className="filete-dourado mt-7" />
        </div>

        <div className="mt-10">
          <Widget f={f} />
        </div>

        {f.passos?.length ? (
          <section className="mt-14 max-w-leitura-larga">
            <h2 className="font-display text-titulo-secao text-ink">Como usar</h2>
            <ol data-passos className="conteudo-rico mt-6">
              {f.passos.map((p) => (
                <li key={p.nome}>
                  <strong>{p.nome}.</strong> {p.texto}
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {f.slug === "largura-da-alianca" ? (
          /* Saída de verdade: peças que existem naquela largura, com preço
             sincronizado. Ferramenta sem saída entretém e não converte. */
          <VitrineDaFerramenta className="mt-14" />
        ) : null}

        {f.slug === "conversor-de-aros" ? (
        <section className="mt-14 max-w-leitura-larga">
          <h2 className="font-display text-titulo-secao text-ink">Como as contas são feitas</h2>
          <div className="conteudo-rico mt-6">
            <p>
              Todas as escalas descrevem a mesma coisa por caminhos diferentes: a
              circunferência interna do anel, em milímetros. O aro brasileiro é essa
              circunferência menos 40, e o diâmetro é a circunferência dividida por π.
            </p>
            <p>
              O padrão europeu ISO 8653 usa a circunferência como o próprio número, e a escala
              americana tem passo próprio, de 2,5535 mm por número a partir de 36,537 mm. Por isso
              o número americano quase nunca cai redondo em cima do aro brasileiro, e o conversor
              mostra a meia medida mais próxima, que é como os Estados Unidos vendem.
            </p>
            <p>
              Nada disso é medida da JK Alianças: são convenções de numeração, e as fórmulas estão
              acima justamente para quem quiser conferir.
            </p>
          </div>
        </section>
        ) : null}

        <FaqLista faqs={f.faqs} className="mt-14 max-w-leitura-larga" />

        <section className="mt-14 max-w-leitura-larga border-t border-border pt-8">
          <h2 className="font-display text-titulo-secao text-ink">Não sabe o seu tamanho?</h2>
          <p className="mt-3 text-muted">
            O conversor traduz um número que você já tem. Para descobrir o número do zero, meça
            pela tela ou experimente numa loja.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button href="/medidor-de-aliancas">Medir pela tela</Button>
            <Button href="/lojas" variant="outline">
              Experimentar na loja
            </Button>
          </div>
        </section>

        <div className="mt-12 max-w-leitura-larga border-t border-border pt-7">
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div>
              <p className="eyebrow">Achou útil?</p>
              <p className="mt-1.5 text-apoio text-muted">
                Mande para quem está escolhendo aliança junto com você.
              </p>
            </div>
            <ShareButtons title={f.metaTitle} />
          </div>
        </div>

        <p className="mt-10 text-sm text-muted">
          <Link href="/guia" className="underline underline-offset-4 hover:text-ink">
            Ver as dicas sobre alianças
          </Link>
        </p>
      </Container>
    </main>
  );
}
