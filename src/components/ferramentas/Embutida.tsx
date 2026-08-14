import { Conversor } from "./Conversor";
import { SimuladorDeLargura } from "./SimuladorDeLargura";
import { Comparador } from "./Comparador";
import { acharFerramenta, type SlugDeFerramenta } from "@/lib/ferramentas/registro";

/**
 * A ferramenta desenhada dentro de um artigo.
 *
 * Vem com título e uma linha de contexto porque, no meio de um texto, um
 * bloco interativo sem nome parece defeito. Na página própria da ferramenta o
 * cabeçalho já existe, então lá o componente entra pelado.
 *
 * Um lugar só decide qual componente cada slug vira, aqui e na página, para
 * ferramenta nova precisar de uma linha em cada, e não de uma caçada.
 */
export function FerramentaEmbutida({ slug }: { slug: SlugDeFerramenta }) {
  const f = acharFerramenta(slug);
  if (!f) return null;

  return (
    <section className="mt-10 max-w-leitura-larga" data-ferramenta-viva={slug}>
      <p className="eyebrow">Ferramenta</p>
      <h2 className="font-display mt-1.5 text-titulo-secao text-ink">{f.nome}</h2>
      <p className="mt-2 text-apoio text-muted">{f.chamada}</p>
      <div className="mt-5">
        {slug === "conversor-de-aros" ? <Conversor /> : null}
        {slug === "largura-da-alianca" ? <SimuladorDeLargura /> : null}
        {slug === "materiais-de-alianca" ? <Comparador /> : null}
      </div>
    </section>
  );
}
