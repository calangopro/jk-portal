"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/session";
import { origemDosCabecalhos } from "@/lib/conector/base";
import { decidir, lerPedido } from "@/lib/conector/oauth";
import { BASE_PATH } from "@/lib/seo/base-path";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * O "Permitir" e o "Recusar" da tela de conexão. Devolve a pessoa ao app do
 * Claude com o código (ou com a recusa). O código é assinado, vale 2 minutos e
 * só serve para o app que pediu, com a prova PKCE dele (`lib/conector/oauth.ts`).
 */
export async function decidirConexao(form: FormData): Promise<void> {
  const perfil = await requireStaff();
  const pedido = lerPedido(String(form.get("pedido") ?? ""));
  if (!pedido) redirect("/admin/conectar?vencido=1");

  const permitir = form.get("decisao") === "permitir";
  const escopo = form.get("escopo") === "leitura" ? "leitura" : "completo";
  const base = `${origemDosCabecalhos(await headers())}${BASE_PATH}`;

  // Fica no histórico do conector: quem ligou (ou recusou) qual app, e com que escopo.
  await createAdminClient()
    .from("conector_registro")
    .insert({
      profile_id: perfil.id,
      ferramenta: "login",
      operacao: permitir ? "conector.permitir" : "conector.recusar",
      risco: "perigosa",
      ok: true,
      entrada: { app: pedido!.app, escopo: permitir ? (pedido!.cf ? escopo : "leitura") : null },
    })
    .then(() => undefined);

  redirect(decidir(pedido!, base, perfil.id, { permitir, escopo }));
}
