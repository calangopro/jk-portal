import { NextResponse, type NextRequest } from "next/server";
import { getSessionProfile } from "@/lib/auth/session";
import { origemDaCasa } from "@/lib/sugestoes/sugestoes";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { aparelhoDoNavegador, lerCategorias, lerInscricao } from "@/lib/avisos/push";
import { chavesDoPush, enviarTeste } from "@/lib/avisos/enviar";

/**
 * Ligar e desligar o aviso por push NESTE aparelho (cartão 59).
 *
 *   GET   a chave pública (o navegador precisa dela para se inscrever) e os
 *         aparelhos ligados da pessoa;
 *   POST  `ligar` (com a inscrição que o navegador gerou), `desligar` (este
 *         aparelho ou um da lista), `escolher` (o que avisa aqui) e `teste`.
 *
 * Tudo com a sessão da pessoa: as funções do banco (0190) só mexem nos
 * aparelhos de quem chama. Só o teste usa a chave de serviço, porque assinar o
 * push pede a chave privada, que nunca sai do servidor.
 */

export const dynamic = "force-dynamic";

const responder = (status: number, corpo: Record<string, unknown>) =>
  NextResponse.json(corpo, { status, headers: { "Cache-Control": "no-store" } });

export async function GET() {
  const perfil = await getSessionProfile();
  if (!perfil || !perfil.isActive) return responder(401, { erro: "Sua sessão caiu. Entre de novo no painel." });
  const chaves = await chavesDoPush(createAdminClient());
  const db = await createClient();
  const { data } = await db.rpc("push_meus_aparelhos");
  return responder(200, { chave: chaves?.publica ?? null, aparelhos: Array.isArray(data) ? data : [] });
}

export async function POST(request: NextRequest) {
  if (!origemDaCasa(request.headers.get("origin"), request.headers.get("host"), process.env.NODE_ENV === "production")) {
    return responder(403, { erro: "Pedido de fora do painel." });
  }
  const perfil = await getSessionProfile();
  if (!perfil || !perfil.isActive) return responder(401, { erro: "Sua sessão caiu. Entre de novo no painel e tente outra vez." });
  if (!perfil.areas.includes("time")) return responder(403, { erro: "O seu acesso não permite ligar avisos." });

  let corpo: Record<string, unknown>;
  try {
    corpo = (await request.json()) as Record<string, unknown>;
  } catch {
    return responder(400, { erro: "Não deu para ler o pedido." });
  }
  const db = await createClient();
  const endpoint = typeof corpo.endpoint === "string" ? corpo.endpoint : null;

  switch (corpo.acao) {
    case "ligar": {
      const insc = lerInscricao(corpo.inscricao);
      if (!insc) return responder(400, { erro: "O navegador mandou uma inscrição que não dá para usar. Tente de novo." });
      const ap = aparelhoDoNavegador(request.headers.get("user-agent") ?? "");
      const { error } = await db.rpc("push_inscrever", {
        p_endpoint: insc.endpoint,
        p_p256dh: insc.p256dh,
        p_auth: insc.auth,
        p_tipo: ap.tipo,
        p_navegador: ap.navegador,
        p_avisar: corpo.avisar === undefined ? null : lerCategorias(corpo.avisar),
      });
      if (error) return responder(400, { erro: "O painel não conseguiu guardar este aparelho. Tente de novo." });
      return responder(200, { ok: true });
    }
    case "desligar": {
      const id = Number(corpo.id);
      const { error } = await db.rpc("push_desligar", { p_endpoint: endpoint, p_id: Number.isSafeInteger(id) && id > 0 ? id : null });
      if (error) return responder(400, { erro: "Não deu para desligar agora. Tente de novo." });
      return responder(200, { ok: true });
    }
    case "escolher": {
      if (!endpoint) return responder(400, { erro: "Falta o aparelho." });
      const { error } = await db.rpc("push_preferencias", { p_endpoint: endpoint, p_avisar: lerCategorias(corpo.avisar) });
      if (error) return responder(400, { erro: "Não deu para guardar a escolha. Tente de novo." });
      return responder(200, { ok: true });
    }
    case "teste": {
      const r = await enviarTeste(createAdminClient(), perfil.id, endpoint);
      if (r.aparelhos === 0) return responder(404, { erro: "Este aparelho não está ligado. Ligue o aviso primeiro." });
      if (r.ok === 0) return responder(502, { erro: r.mortos ? "O navegador desfez a inscrição. Ligue o aviso de novo." : "O serviço de aviso do navegador não aceitou agora. Tente de novo em instantes." });
      return responder(200, { ok: true, entregues: r.ok });
    }
    default:
      return responder(400, { erro: "Pedido desconhecido." });
  }
}
