import { autorizar, CORS, registrar, revogar, token } from "@/lib/conector/oauth";

/**
 * O servidor de login do conector (OAuth 2.1): /api/oauth/authorize, token,
 * register, revoke e jwks. Explicado em `lib/conector/oauth.ts`.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Rota = { params: Promise<{ acao: string }> };

const naoExiste = () =>
  new Response(JSON.stringify({ error: "not_found" }), {
    status: 404,
    headers: { "content-type": "application/json", ...CORS },
  });

export async function GET(req: Request, { params }: Rota) {
  const { acao } = await params;
  if (acao === "authorize") return autorizar(req);
  if (acao === "jwks") {
    // Nunca emitimos id_token: a lista existe porque a ficha do OpenID exige o campo.
    return new Response(JSON.stringify({ keys: [] }), {
      headers: { "content-type": "application/json", "cache-control": "public, max-age=3600", ...CORS },
    });
  }
  return naoExiste();
}

export async function POST(req: Request, { params }: Rota) {
  const { acao } = await params;
  try {
    if (acao === "token") return await token(req);
    if (acao === "register") return await registrar(req);
    if (acao === "revoke") return await revogar(req);
  } catch (e) {
    console.error("[oauth]", acao, e);
    return new Response(JSON.stringify({ error: "server_error", error_description: "Erro interno." }), {
      status: 500,
      headers: { "content-type": "application/json", ...CORS },
    });
  }
  return naoExiste();
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
