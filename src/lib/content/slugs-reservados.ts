/**
 * Slugs que o conteúdo NÃO pode usar, porque o portal já usa como rota.
 *
 * POR QUE ISTO EXISTE
 *
 * O endereço de um post é `/<slug>`, na raiz do portal (`(site)/[slug]`), e não
 * mais `/guia/<slug>`. Endereço curto é melhor de ler e de compartilhar, mas
 * cobra um preço: o post passa a dividir o mesmo espaço de nomes com as páginas
 * fixas do site. No Next, segmento estático SEMPRE ganha do dinâmico, e ganha em
 * silêncio: um post com slug `lojas` simplesmente nunca abriria, e a tela do
 * admin continuaria mostrando o link como se estivesse tudo certo.
 *
 * Por isso a lista é consultada por `slugDisponivel`, que trata nome reservado
 * como nome já ocupado e devolve `lojas-2`. Sem erro na cara de quem escreve, e
 * sem post invisível.
 *
 * MANUTENÇÃO: ao criar uma pasta nova em `src/app/(site)/`, acrescente o nome
 * aqui. É o único lugar. Ferramenta nova NÃO precisa entrar, porque ela mora
 * sob `/ferramentas/<slug>`, que já é um segmento reservado inteiro.
 */
const RESERVADOS = new Set([
  // Pastas de src/app/(site)/
  "dicas",
  "lojas",
  "ferramentas",
  "medidor-de-aliancas",
  "autor",
  "busca",
  "preview",
  "aliancas-de-namoro",

  // Fora do grupo (site), mas no mesmo nível de endereço.
  "admin",
  "api",

  // Rotas de metadado e arquivos servidos na raiz do portal.
  "sitemap.xml",
  "robots.txt",
  "llms.txt",
  "indexnow.txt",
  "icon",
  "opengraph-image",
  "favicon.ico",
  "_next",
]);

export function slugReservado(slug: string): boolean {
  return RESERVADOS.has(slug.trim().toLowerCase());
}
