import "server-only";
import { SITE, absoluteUrl } from "@/lib/seo/site";

/**
 * IndexNow: avisa Bing, Yandex e Seznam que uma página mudou, em vez de
 * esperar o robô passar. O Google não participa, então isto não substitui
 * sitemap nem Search Console, mas é gratuito e leva uma requisição.
 *
 * A chave fica em INDEXNOW_KEY e é servida em /indexnow.txt, que é como o
 * buscador confirma que quem avisou controla mesmo o domínio. Sem chave, ou
 * rodando em localhost, a função não faz nada: avisar buscador sobre um
 * endereço que ele não alcança só gera erro no log.
 */
export async function avisarIndexNow(caminhos: string[]): Promise<boolean> {
  const chave = process.env.INDEXNOW_KEY;
  if (!chave || caminhos.length === 0) return false;

  const host = new URL(SITE.url).host;
  if (host.includes("localhost") || host.startsWith("127.")) return false;

  try {
    const r = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host,
        key: chave,
        keyLocation: absoluteUrl("/indexnow.txt"),
        urlList: caminhos.map((c) => absoluteUrl(c)),
      }),
    });
    return r.ok;
  } catch {
    // Falha aqui não pode derrubar a publicação: o conteúdo já está no ar e o
    // sitemap continua sendo o caminho principal de descoberta.
    return false;
  }
}
