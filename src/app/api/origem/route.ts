import { randomUUID } from "node:crypto";
import { after, NextResponse, type NextRequest } from "next/server";
import { COOKIE_DO_VISITANTE, VIDA_DO_COOKIE, daCasa, dominioDoCookie, registrarRecado, visitanteDoCookie, type Recado } from "@/lib/origem/registrar";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Coletor de origem: recebe o recado do script `o.js`, que roda na loja e no
 * portal, e anota de onde a pessoa chegou.
 *
 * PÚBLICA, e por isso desconfiada:
 *   - só aceita pedido vindo de página nossa (cabeçalho `Origin`, ou `Referer`
 *     quando o navegador não manda o primeiro). É o que impede outro site de
 *     gravar chegada no nosso banco pelo navegador de alguém;
 *   - o corpo tem limite, e cada campo é validado e cortado antes de gravar;
 *   - robô não é anotado.
 * Nada disso impede alguém de forjar o pedido à mão, e não precisa: o estrago
 * possível é uma chegada inventada para um visitante inventado, que não se
 * liga a pedido nenhum.
 *
 * Responde 204 na hora e grava depois (`after`), para o recado nunca segurar a
 * página. A resposta leva o cookie do visitante, e é ela quem o grava: ver
 * `lib/origem/registrar.ts`.
 */

export const dynamic = "force-dynamic";

const LIMITE = 4096;

export async function POST(request: NextRequest) {
  const vazio = () => new NextResponse(null, { status: 204, headers: { "cache-control": "no-store" } });

  const origem = request.headers.get("origin") ?? request.headers.get("referer");
  let hostDeQuemChama = "";
  try {
    hostDeQuemChama = origem ? new URL(origem).host : "";
  } catch {
    // Cabeçalho torto é o mesmo que cabeçalho ausente.
  }
  if (!hostDeQuemChama || !daCasa(hostDeQuemChama)) return vazio();

  const texto = await request.text().catch(() => "");
  if (!texto || texto.length > LIMITE) return vazio();
  let recado: Recado;
  try {
    recado = JSON.parse(texto) as Recado;
  } catch {
    return vazio();
  }
  if (!recado || typeof recado !== "object") return vazio();

  const visitante = visitanteDoCookie(request.cookies.get(COOKIE_DO_VISITANTE)?.value) ?? randomUUID();
  const agente = request.headers.get("user-agent");
  after(() => registrarRecado(createAdminClient(), visitante, recado, agente));

  const resposta = vazio();
  resposta.cookies.set({
    name: COOKIE_DO_VISITANTE,
    value: visitante,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: VIDA_DO_COOKIE,
    domain: dominioDoCookie(),
  });
  return resposta;
}
