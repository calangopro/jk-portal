import { randomBytes, timingSafeEqual } from "node:crypto";
import { NextResponse, after } from "next/server";
import { revalidatePath } from "next/cache";
import { ehAdmin } from "@/lib/auth/acessos";
import { getSessionProfile } from "@/lib/auth/session";
import { abrir, assinar } from "@/lib/conector/cripto";
import { guardarContas, lerAplicativo } from "@/lib/redes/contas";
import { lerRedes } from "@/lib/redes/leitura";
import { modulo } from "@/lib/redes/plataformas";
import { ehRede, nomeDaRede } from "@/lib/redes/redes";
import { ErroDaRede } from "@/lib/redes/tipos";
import { comBasePath } from "@/lib/seo/base-path";
import { absoluteUrl } from "@/lib/seo/site";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Ligar uma conta de rede social pelo login da própria rede, em duas pontas:
 *
 *   - `/api/redes/conectar/<rede>`: só administrador, dono e GM. Manda para a
 *     tela de permissão da rede com um `state` assinado e um número aleatório
 *     guardado em cookie;
 *   - `/api/redes/retorno/<rede>`: a rede volta com o código. Vale só se o
 *     `state` tiver a nossa assinatura, for desta rede, bater com o cookie e
 *     quem voltou ainda for administrador. São as quatro travas que impedem
 *     alguém de colar a conta dele no painel da JK por um link.
 *
 * Nada é gravado antes de a rede aceitar o código. O token vai direto para o
 * cofre (`lib/redes/cofre.ts`) e nunca passa pela tela.
 *
 * Mesmo desenho do Google do Perfil da Empresa (`api/google/[acao]`), com o
 * `state` assinado de `conexao.js` do auto-agenciasetup.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// O retorno troca o código pelo token e já pede a primeira leitura da conta.
export const maxDuration = 60;

const COOKIE = "jk_redes_estado";
const VIDA_DO_PEDIDO = 15 * 60;

type Rota = { params: Promise<{ acao: string; rede: string }> };

/** O endereço de volta precisa ser IDÊNTICO ao cadastrado no aplicativo da rede. */
function enderecoDeRetorno(request: Request, rede: string): string {
  const caminho = `/api/redes/retorno/${rede}`;
  if (process.env.VERCEL_ENV === "production") return absoluteUrl(caminho);
  return new URL(comBasePath(caminho), new URL(request.url).origin).toString();
}

/** Volta para Integrações, na seção das redes, com o aviso no endereço. */
function voltar(request: Request, aviso: string, ok = false): NextResponse {
  const caminho = `/admin/integracoes?${ok ? "redes_ok" : "redes"}=${encodeURIComponent(aviso.slice(0, 300))}#redes`;
  const destino =
    process.env.VERCEL_ENV === "production" ? absoluteUrl(caminho) : new URL(comBasePath(caminho), new URL(request.url).origin).toString();
  const r = NextResponse.redirect(destino, 303);
  r.cookies.delete({ name: COOKIE, path: comBasePath("/api/redes") });
  return r;
}

function mesmoValor(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function GET(request: Request, { params }: Rota) {
  const { acao, rede } = await params;
  if (!ehRede(rede)) return NextResponse.json({ erro: "não existe" }, { status: 404 });
  const m = modulo(rede);
  const nome = nomeDaRede(rede);

  if (acao === "conectar") {
    const perfil = await getSessionProfile();
    if (!perfil?.isActive || !ehAdmin(perfil.role)) return voltar(request, "Só administrador, dono ou GM liga uma rede.");
    if (!m?.urlConectar || !m.concluirConexao) return voltar(request, `${nome} ainda não liga pelo login no painel.`);
    const aplicativo = m.provedorDoAplicativo ? await lerAplicativo(createAdminClient(), m.provedorDoAplicativo) : null;
    if (!aplicativo) return voltar(request, `Salve o aplicativo de ${nome} antes de ligar a conta.`);

    const numero = randomBytes(18).toString("base64url");
    const estado = assinar("rede", { r: rede, u: perfil.id, n: numero }, VIDA_DO_PEDIDO);
    const r = NextResponse.redirect(m.urlConectar({ aplicativo, estado, retorno: enderecoDeRetorno(request, rede) }), 303);
    r.cookies.set({
      name: COOKIE,
      value: numero,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: comBasePath("/api/redes"),
      maxAge: VIDA_DO_PEDIDO,
    });
    return r;
  }

  if (acao === "retorno") {
    const url = new URL(request.url);
    const recusa = url.searchParams.get("error");
    if (recusa) {
      const motivo = url.searchParams.get("error_description") || recusa;
      return voltar(request, recusa === "access_denied" ? `A permissão foi negada em ${nome}.` : `${nome} recusou: ${motivo}`);
    }

    const pedido = abrir<{ r: string; u: string; n: string }>("rede", url.searchParams.get("state") ?? "");
    const guardado = request.headers.get("cookie")?.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`))?.[1] ?? "";
    if (!pedido || pedido.r !== rede || !guardado || !mesmoValor(pedido.n, decodeURIComponent(guardado))) {
      return voltar(request, "O pedido de ligação venceu ou não começou por aqui. Clique em Ligar de novo.");
    }
    const perfil = await getSessionProfile();
    if (!perfil?.isActive || !ehAdmin(perfil.role) || perfil.id !== pedido.u) {
      return voltar(request, "Só administrador, dono ou GM liga uma rede, e quem volta precisa ser quem começou.");
    }
    if (!m?.concluirConexao) return voltar(request, `${nome} ainda não liga pelo login no painel.`);

    const db = createAdminClient();
    const aplicativo = m.provedorDoAplicativo ? await lerAplicativo(db, m.provedorDoAplicativo) : null;
    if (!aplicativo) return voltar(request, `Salve o aplicativo de ${nome} antes de ligar a conta.`);

    try {
      const contas = await m.concluirConexao({ aplicativo, url, retorno: enderecoDeRetorno(request, rede) });
      if (!contas.length) return voltar(request, `${nome} não devolveu nenhuma conta. Confira se a conta certa foi marcada na tela de permissão.`);
      const gravou = await guardarContas(db, contas, { perfilId: perfil.id, via: "oauth" });
      if (gravou.erro) return voltar(request, `A conta foi autorizada, mas não deu para guardar: ${gravou.erro}`);

      // A primeira leitura roda depois da resposta: a pessoa volta para a tela na hora e os números chegam em seguida.
      after(async () => {
        for (const id of gravou.ids) await lerRedes(db, { contaId: id, dias: 30, paginas: 3, metricas: 30, prazoMs: 40_000 }).catch((e) => console.error("[redes] primeira leitura", e));
      });
      revalidatePath("/admin/integracoes");
      revalidatePath("/admin/redes", "layout");
      const quais = contas.map((c) => c.usuario || c.nome || c.contaId).join(", ");
      return voltar(request, `${nome} ligado: ${quais}. Os números aparecem em um ou dois minutos.`, true);
    } catch (e) {
      if (!(e instanceof ErroDaRede)) console.error("[redes] retorno", rede, e);
      return voltar(request, e instanceof ErroDaRede ? e.message : `Não deu para concluir a ligação com ${nome}. Tente de novo.`);
    }
  }

  return NextResponse.json({ erro: "não existe" }, { status: 404 });
}
