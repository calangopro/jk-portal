import type { MetadataRoute } from "next";
import { absoluteUrl, isProduction } from "@/lib/seo/site";

/** Caminhos que nenhum rastreador deve percorrer, seja de busca ou de IA. */
// `/busca` entra aqui porque página de resultado de busca interna é conteúdo
// raso e infinito: uma URL por consulta digitada. O Google recomenda bloquear
// no robots. A página também sai com `noindex`, como cinto e suspensório.
const BLOQUEADOS = ["/admin", "/api", "/preview", "/busca"];

/**
 * ATENÇÃO, leia antes de contar com este arquivo em produção.
 *
 * Com o basePath, este robots é servido em /guias/robots.txt. Rastreador só lê
 * robots.txt na RAIZ do host, e a raiz de www.jkaliancas.com.br é da Tray. Ou
 * seja: em produção quem manda no rastreamento é o robots.txt da loja, não este.
 *
 * Este arquivo continua valendo por dois motivos: cobre o endereço .vercel.app,
 * onde ele É a raiz, e documenta a intenção. Mas o bloqueio de verdade de
 * /admin, /api, /preview e /busca vem das metatags `noindex` que essas rotas já
 * emitem, e não daqui. Para o robots valer no domínio público, as linhas
 * precisam entrar no robots.txt da Tray, com o prefixo /guias.
 */
export default function robots(): MetadataRoute.Robots {
  // Preview/desenvolvimento: nada é indexável (evita rascunho no Google).
  if (!isProduction()) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  // Bots de IA liberados explicitamente, porque queremos ser citados (GEO).
  const aiBots = [
    "GPTBot",
    "ClaudeBot",
    "PerplexityBot",
    "Google-Extended",
    "CCBot",
    "Applebot-Extended",
  ];

  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: BLOQUEADOS },
      // Cada grupo repete o `disallow`. No protocolo do robots.txt o grupo de um
      // user-agent específico SUBSTITUI o grupo `*` inteiro, não soma com ele.
      // Sem esta repetição, o admin, a API e os rascunhos em preview ficavam
      // abertos justamente para os seis agentes listados aqui.
      ...aiBots.map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow: BLOQUEADOS,
      })),
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    // Sem `host`: é diretiva do Yandex, o Google ignora, e o valor saía com
    // esquema e barra final, que não é o formato que a diretiva espera.
  };
}
