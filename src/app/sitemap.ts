import type { MetadataRoute } from "next";
import { FERRAMENTAS } from "@/lib/ferramentas/registro";
import { absoluteUrl } from "@/lib/seo/site";
import { getPublishedGuias, comCapas } from "@/lib/data/contents";
import { getPublishedLocations, comFotos } from "@/lib/data/locations";
import { autoresAtivos } from "@/lib/data/autores";

export const revalidate = 3600;

/**
 * Sitemap só com URLs canônicas, 200 e úteis. Páginas `noindex` (ex.: o
 * placeholder do pilar) e rascunhos ficam de fora. Quando o volume crescer,
 * dá para segmentar via generateSitemaps.
 *
 * Sem `priority` e sem `changeFrequency`: a documentação do Google diz, com
 * essas palavras, que ignora o valor dos dois. Ficavam no arquivo dando a
 * impressão de que orientavam o rastreamento, e não orientam nada.
 *
 * Com `images`: a extensão de imagem do sitemap é o caminho documentado para
 * o Google descobrir foto que ele não acharia sozinho, e é o que coloca as
 * capas dos guias e as fotos das lojas no Google Imagens.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [guiasBrutos, lojasBrutas, autores] = await Promise.all([
    getPublishedGuias(),
    getPublishedLocations(),
    autoresAtivos(),
  ]);

  const [guias, lojas] = await Promise.all([
    comCapas(guiasBrutos),
    comFotos(lojasBrutas),
  ]);

  // `lastModified` das rotas fixas: a mais recente do que elas listam. Sem isso
  // as quatro páginas mais importantes do site iam ao sitemap sem data nenhuma,
  // e o Google só usa lastmod quando ele é consistente e verificável.
  const maisRecente = (datas: (string | null | undefined)[]): Date | undefined => {
    const validas = datas
      .filter((d): d is string => Boolean(d))
      .map((d) => new Date(d))
      .filter((d) => !Number.isNaN(d.getTime()));
    if (!validas.length) return undefined;
    return new Date(Math.max(...validas.map((d) => d.getTime())));
  };

  const ultimoGuia = maisRecente(guias.map((g) => g.updatedAt));
  const ultimaLoja = maisRecente(lojas.map((l) => l.updatedAt));
  const ultimoDeTudo = maisRecente([
    ultimoGuia?.toISOString(),
    ultimaLoja?.toISOString(),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), lastModified: ultimoDeTudo },
    { url: absoluteUrl("/guia"), lastModified: ultimoGuia },
    { url: absoluteUrl("/lojas"), lastModified: ultimaLoja },
    // Ferramenta com busca própria forte ("medidor de aliança", "tamanho do aro").
    // Página estática: a data de modificação é a do próprio código, então fica
    // sem lastmod, que é melhor do que uma data inventada.
    { url: absoluteUrl("/medidor-de-aliancas") },
    { url: absoluteUrl("/ferramentas") },
    // Uma linha por ferramenta do registro, para a próxima entrar no sitemap
    // sozinha em vez de depender de alguém lembrar de voltar aqui.
    ...FERRAMENTAS.map((f) => ({ url: absoluteUrl(`/ferramentas/${f.slug}`) })),
  ];

  const guiaRoutes: MetadataRoute.Sitemap = guias.map((g) => ({
    url: absoluteUrl(`/guia/${g.slug}`),
    lastModified: g.updatedAt ?? undefined,
    ...(g.capa?.url ? { images: [g.capa.url] } : {}),
  }));

  const lojaRoutes: MetadataRoute.Sitemap = lojas.map((l) => {
    const imagens = (l.fotos ?? []).map((f) => f.url).filter(Boolean);
    return {
      url: absoluteUrl(`/lojas/${l.slug}`),
      lastModified: l.updatedAt ?? undefined,
      ...(imagens.length ? { images: imagens } : {}),
    };
  });

  // Páginas de autor: são o destino do `author.url` do JSON-LD, então precisam
  // ser rastreáveis e indexáveis como qualquer outra página do site.
  const autorRoutes: MetadataRoute.Sitemap = autores.map((a) => ({
    url: absoluteUrl(`/autor/${a.slug}`),
    ...(a.foto?.url ? { images: [a.foto.url] } : {}),
  }));

  return [...staticRoutes, ...guiaRoutes, ...lojaRoutes, ...autorRoutes];
}
