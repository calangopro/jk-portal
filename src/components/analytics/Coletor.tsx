import Script from "next/script";
import { comBasePath } from "@/lib/seo/base-path";
import { isProduction } from "@/lib/seo/site";

/**
 * Carrega o coletor de origem (`public/o.js`) nas páginas públicas do portal.
 *
 * É o MESMO arquivo que a loja carrega: lá ele chega pelo GTM, aqui pelo
 * código. Ele anota de onde a pessoa chegou e manda para `/api/origem`, que
 * marca o visitante. Quem lê um guia vindo do Google e compra na loja dias
 * depois fica ligado a essa primeira chegada.
 *
 * Só em produção, como a `Medicao`: o acesso de quem está construindo o site
 * não é chegada de cliente. O `src` leva o prefixo na mão porque o
 * `next/script` não soma o `basePath` sozinho.
 */
export function Coletor() {
  if (!isProduction()) return null;
  return <Script src={comBasePath("/o.js")} strategy="afterInteractive" />;
}
