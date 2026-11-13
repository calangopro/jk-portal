import { randomBytes, timingSafeEqual } from "node:crypto";
import { ehAdmin as papelDeAdmin } from "@/lib/auth/acessos";
import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { getSessionProfile } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { comBasePath } from "@/lib/seo/base-path";
import { absoluteUrl } from "@/lib/seo/site";
import { concluirConexao, enderecoDeRetorno, lerCliente, urlDeAutorizacao } from "@/lib/google-perfil/oauth";
import { sincronizarAvaliacoes } from "@/lib/google-perfil/sincronizar";
import { TAG_AVALIACOES } from "@/lib/google-perfil/publico";

/**
 * Conexão do portal com o Google (Perfil da Empresa), em duas pontas:
 *   - `/api/google/conectar`: só administrador; manda para a tela de
 *     permissão do Google com um `state` aleatório guardado em cookie;
 *   - `/api/google/retorno`: o Google volta com o código; o `state` precisa
 *     bater com o cookie (é o que impede alguém de colar a conta dele no
 *     portal por um link), troca o código pelo refresh token e já roda a
 *     primeira sincronização.
 *
 * Explicado em `lib/google-perfil/oauth.ts`.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// O retorno já sincroniza as oito lojas antes de voltar para a tela.
export const maxDuration = 60;

const COOKIE = "jk_google_estado";

type Rota = { params: Promise<{ acao: string }> };

/** Volta para Integrações com o aviso na URL, sempre no domínio certo. */
function voltar(request: Request, aviso: string): NextResponse {
  const caminho = `/admin/integracoes?google=${encodeURIComponent(aviso)}`;
  const destino =
    process.env.VERCEL_ENV === "production"
      ? absoluteUrl(caminho)
      : new URL(comBasePath(caminho), new URL(request.url).origin).toString();
  const r = NextResponse.redirect(destino, 303);
  r.cookies.delete({ name: COOKIE, path: comBasePath("/api/google") });
  return r;
}

async function ehAdmin(): Promise<boolean> {
  const perfil = await getSessionProfile();
  return Boolean(perfil?.isActive && papelDeAdmin(perfil.role));
}

function mesmoValor(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function GET(request: Request, { params }: Rota) {
  const { acao } = await params;

  if (acao === "conectar") {
    if (!(await ehAdmin())) return voltar(request, "Só administrador conecta o Google.");
    const cliente = await lerCliente(createAdminClient());
    if (!cliente) return voltar(request, "Salve o cliente OAuth do Google antes de conectar.");

    const estado = randomBytes(24).toString("base64url");
    const r = NextResponse.redirect(urlDeAutorizacao(cliente, enderecoDeRetorno(request), estado), 303);
    r.cookies.set({
      name: COOKIE,
      value: estado,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: comBasePath("/api/google"),
      maxAge: 600,
    });
    return r;
  }

  if (acao === "retorno") {
    const url = new URL(request.url);
    const erroDoGoogle = url.searchParams.get("error");
    if (erroDoGoogle) {
      return voltar(request, erroDoGoogle === "access_denied" ? "A permissão foi negada no Google." : `O Google recusou: ${erroDoGoogle}.`);
    }

    const estado = url.searchParams.get("state") ?? "";
    const guardado = request.headers.get("cookie")?.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`))?.[1] ?? "";
    if (!estado || !guardado || !mesmoValor(estado, decodeURIComponent(guardado))) {
      return voltar(request, "A conexão expirou ou não começou por aqui. Clique em Conectar com o Google de novo.");
    }
    if (!(await ehAdmin())) return voltar(request, "Só administrador conecta o Google.");

    const codigo = url.searchParams.get("code") ?? "";
    if (!codigo) return voltar(request, "O Google não mandou o código de autorização.");

    const problema = await concluirConexao(createAdminClient(), codigo, enderecoDeRetorno(request));
    if (problema) return voltar(request, problema);

    const resultado = await sincronizarAvaliacoes();
    if (resultado.ok) revalidateTag(TAG_AVALIACOES);
    revalidatePath("/admin/integracoes");
    return voltar(
      request,
      resultado.ok
        ? `Conectado. ${resultado.lojas} lojas e ${resultado.avaliacoes} avaliações lidas.`
        : `Conectado, mas a primeira leitura falhou: ${resultado.erro}`,
    );
  }

  return NextResponse.json({ erro: "não existe" }, { status: 404 });
}
