import { CORS, fichaDoServidor, respostaFicha } from "@/lib/conector/oauth";

/** A ficha do servidor de login (RFC 8414), para quem procura dentro do /guias. */
export const dynamic = "force-dynamic";

export const GET = (req: Request) => respostaFicha(fichaDoServidor(req));
export const OPTIONS = () => new Response(null, { status: 204, headers: CORS });
