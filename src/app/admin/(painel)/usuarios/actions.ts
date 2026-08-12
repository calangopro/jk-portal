"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, type AppRole } from "@/lib/auth/session";

export type UsersState = { error?: string; success?: string };

const ROLES: AppRole[] = ["admin", "editor", "reviewer", "author"];

/**
 * Convida um novo membro por e-mail. Não existe cadastro público: o usuário
 * nasce a partir deste convite e define a senha pelo link enviado.
 *
 * Requer SUPABASE_SERVICE_ROLE_KEY (chave secreta, só no servidor).
 */
export async function inviteUser(
  _prev: UsersState,
  formData: FormData,
): Promise<UsersState> {
  await requireAdmin();

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const role = String(formData.get("role") ?? "author") as AppRole;

  if (!email) return { error: "Informe o e-mail do convidado." };
  if (!ROLES.includes(role)) return { error: "Papel inválido." };

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      error:
        "Falta a chave SUPABASE_SERVICE_ROLE_KEY no .env.local para enviar convites. " +
        "Pegue em Supabase → Project Settings → API → service_role e reinicie o servidor.",
    };
  }

  // Import dinâmico: mantém a service_role fora do bundle das páginas.
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName || email },
    redirectTo: `${site}/admin`,
  });

  if (error || !data?.user) {
    return { error: `Não foi possível convidar: ${error?.message ?? "erro"}` };
  }

  // O trigger criou o profile; aplica o papel escolhido.
  const { error: roleError } = await admin
    .from("profiles")
    .update({ role, full_name: fullName || email, email })
    .eq("id", data.user.id);

  if (roleError) {
    return { error: `Convite enviado, mas o papel falhou: ${roleError.message}` };
  }

  revalidatePath("/admin/usuarios");
  return { success: `Convite enviado para ${email}.` };
}

/** Altera o papel de um membro. */
export async function updateRole(formData: FormData) {
  const me = await requireAdmin();

  const userId = String(formData.get("user_id") ?? "");
  const role = String(formData.get("role") ?? "") as AppRole;
  if (!userId || !ROLES.includes(role)) return;

  // Trava de segurança: um admin não pode rebaixar a si mesmo (evita ficar
  // sem nenhum administrador no sistema).
  if (userId === me.id && role !== "admin") return;

  const supabase = await createClient();
  await supabase.from("profiles").update({ role }).eq("id", userId);
  revalidatePath("/admin/usuarios");
}

/** Ativa/desativa o acesso (soft-delete: nunca apagamos o histórico). */
export async function toggleActive(formData: FormData) {
  const me = await requireAdmin();

  const userId = String(formData.get("user_id") ?? "");
  const isActive = String(formData.get("is_active") ?? "") === "true";
  if (!userId) return;

  // Não permite desativar a si mesmo.
  if (userId === me.id) return;

  const supabase = await createClient();
  await supabase
    .from("profiles")
    .update({ is_active: !isActive })
    .eq("id", userId);
  revalidatePath("/admin/usuarios");
}
