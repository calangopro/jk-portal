import { SITE, absoluteUrl, isProduction } from "@/lib/seo/site";
import { FERRAMENTAS } from "@/lib/ferramentas/registro";
import { getPublishedGuias } from "@/lib/data/contents";
import { getPublishedLocations } from "@/lib/data/locations";

export const revalidate = 3600;

/**
 * llms.txt — aponta as páginas-fonte de autoridade para mecanismos de IA.
 * Em preview/dev, não expõe nada (coerente com o robots).
 */
export async function GET() {
  const headers = { "Content-Type": "text/plain; charset=utf-8" };

  if (!isProduction()) {
    return new Response("# Ambiente não-produtivo, sem conteúdo.\n", {
      headers,
    });
  }

  const [guias, lojas] = await Promise.all([
    getPublishedGuias(),
    getPublishedLocations(),
  ]);

  const lines: string[] = [
    `# ${SITE.name}`,
    `> ${SITE.description}`,
    "",
    "## Ferramentas",
    `- [Medidor de aliança online](${absoluteUrl("/medidor-de-aliancas")}): descubra o tamanho da aliança pela tela, calibrando com uma moeda de R$ 1 (27 mm) ou cartão (85,60 mm). No padrão brasileiro, a circunferência interna em milímetros é o número do aro mais 40.`,
    ...FERRAMENTAS.map(
      (f) => `- [${f.nome}](${absoluteUrl(`/ferramentas/${f.slug}`)}): ${f.resposta}`,
    ),
    "",
    "## Dicas de alianças e joias",
    ...guias.map((g) => `- [${g.title}](${absoluteUrl(`/${g.slug}`)})`),
    "",
    "## Lojas",
    `- [Índice de lojas](${absoluteUrl("/lojas")})`,
    ...lojas.map(
      (l) => `- [JK Alianças ${l.name}](${absoluteUrl(`/lojas/${l.slug}`)})`,
    ),
    "",
  ];

  return new Response(lines.join("\n"), { headers });
}
