import "server-only";
import { BASE_PATH } from "@/lib/seo/base-path";

/**
 * Por qual endereço o conector se apresenta.
 *
 * A aplicação não tem como saber o host público pela requisição: atrás do
 * Worker, a Vercel recebe `Host: jk-portal.vercel.app` e sobrescreve o
 * `x-forwarded-host` (ver `next.config.ts`). Só que o login por conector
 * precisa anunciar endereços absolutos (o emissor, o /authorize, o /token) e
 * eles têm que ser os mesmos por onde o app do Claude entrou.
 *
 * Então: em PRODUÇÃO vale `NEXT_PUBLIC_SITE_URL` (a origem pública, sem o
 * /guias). Em prévia de branch e no computador vale o host que chegou, para dar
 * para testar o login inteiro antes de ir ao ar.
 */
export function origemPublica(req: Request): string {
  return origemDosCabecalhos(req.headers, new URL(req.url).host);
}

/** O mesmo, a partir só dos cabeçalhos (em página e em server action, que não têm o Request). */
export function origemDosCabecalhos(h: Headers, hostReserva = "localhost:3000"): string {
  if (process.env.VERCEL_ENV === "production" && process.env.NEXT_PUBLIC_SITE_URL) {
    try {
      return new URL(process.env.NEXT_PUBLIC_SITE_URL).origin;
    } catch {
      /* cai para o host da requisição */
    }
  }
  const host = h.get("x-forwarded-host") || h.get("host") || hostReserva;
  const local = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
  const proto = h.get("x-forwarded-proto") || (local ? "http" : "https");
  return `${proto}://${host}`;
}

export type Enderecos = {
  /** https://www.jkaliancas.com.br/guias, que também é o emissor do OAuth. */
  base: string;
  /** O conector em modo código (três ferramentas). */
  mcp: string;
  /** O mesmo conector com uma ferramenta por operação. */
  ferramentas: string;
  /** Painel, para mandar a pessoa ao lugar certo. */
  painel: string;
};

export function enderecos(req: Request): Enderecos {
  const base = `${origemPublica(req)}${BASE_PATH}`;
  return {
    base,
    mcp: `${base}/api/mcp`,
    ferramentas: `${base}/api/mcp/ferramentas`,
    painel: `${base}/admin`,
  };
}

/** Endereço público do site para uma rota interna (com o prefixo). */
export function enderecoDoSite(base: string, caminho: string): string {
  return `${base}${caminho === "/" ? "" : caminho}`;
}
