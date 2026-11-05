import { CORS, fichaDoServidor, respostaFicha } from "@/lib/conector/oauth";

/**
 * A mesma ficha do servidor de login, pelo endereço do OpenID.
 *
 * É ESTE que o app do Claude acha. O emissor é https://www.jkaliancas.com.br/guias
 * (com caminho), e a especificação do MCP manda procurar nesta ordem:
 * /.well-known/oauth-authorization-server/guias e
 * /.well-known/openid-configuration/guias, os dois na raiz do domínio, que é
 * da Tray e responde 404, e por último /guias/.well-known/openid-configuration.
 */
export const dynamic = "force-dynamic";

export const GET = (req: Request) => respostaFicha(fichaDoServidor(req));
export const OPTIONS = () => new Response(null, { status: 204, headers: CORS });
