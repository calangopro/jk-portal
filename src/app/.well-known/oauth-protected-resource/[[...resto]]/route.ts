import { CORS, fichaDoRecurso, respostaFicha } from "@/lib/conector/oauth";

/**
 * A ficha do recurso (RFC 9728): diz ao app do Claude qual servidor faz o
 * login do conector. Responde em /guias/.well-known/oauth-protected-resource e
 * em qualquer caminho abaixo dele (/api/mcp, /api/mcp/ferramentas).
 */
export const dynamic = "force-dynamic";

export const GET = (req: Request) => respostaFicha(fichaDoRecurso(req));
export const OPTIONS = () => new Response(null, { status: 204, headers: CORS });
