import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { ehAdmin } from "@/lib/auth/acessos";
import { getSessionProfile } from "@/lib/auth/session";
import { comBasePath } from "@/lib/seo/base-path";
import { createAdminClient } from "@/lib/supabase/admin";
import { COOKIE_DA_TRAY, LOJAS, chavesDoAplicativo, enderecoDoRetorno } from "@/lib/tray/lojas";

/**
 * Começo da autorização do aplicativo na Tray: `/api/tray/conectar?loja=jk`.
 *
 * Manda o navegador para a tela "autorizar aplicativo" da loja, com o endereço
 * de retorno do portal. Deixa um cookie de dez minutos dizendo QUAL loja este
 * navegador começou a autorizar, e o retorno só aceita quem traz esse cookie:
 * sem ele, qualquer pessoa poderia chamar o retorno com um código forjado.
 *
 * Em produção, só administrador. Fora dela, a loja de testes abre sem sessão
 * (o banco local não tem o login de ninguém, e ela não chega a dado real).
 */

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const emProducao = process.env.NODE_ENV === "production";
  const loja = LOJAS.find((l) => l.chave === request.nextUrl.searchParams.get("loja"));
  if (!loja || (loja.chave === "teste" && emProducao)) return NextResponse.json({ erro: "loja desconhecida" }, { status: 404 });

  if (emProducao || loja.chave !== "teste") {
    const perfil = await getSessionProfile();
    if (!perfil?.isActive || !ehAdmin(perfil.role)) return NextResponse.json({ erro: "só administrador conecta a Tray" }, { status: 403 });
  }

  const chaves = await chavesDoAplicativo(createAdminClient());
  if (!chaves) return NextResponse.json({ erro: "faltam as chaves do aplicativo da Tray no servidor" }, { status: 503 });

  const destino = new URL(`https://${loja.host}/auth.php`);
  destino.searchParams.set("response_type", "code");
  destino.searchParams.set("consumer_key", chaves.key);
  destino.searchParams.set("callback", enderecoDoRetorno(request.nextUrl.origin));

  const r = NextResponse.redirect(destino, 303);
  r.cookies.set({
    name: COOKIE_DA_TRAY,
    value: `${loja.chave}.${randomBytes(12).toString("base64url")}`,
    httpOnly: true,
    secure: emProducao,
    sameSite: "lax",
    path: comBasePath("/api/tray"),
    maxAge: 600,
  });
  return r;
}
