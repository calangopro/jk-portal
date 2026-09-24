"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdmin, type AppRole } from "@/lib/auth/session";
import { absoluteUrl } from "@/lib/seo/site";

export type UsersState = { error?: string; success?: string };

const ROLES: AppRole[] = ["admin", "editor", "reviewer", "author"];

/**
 * Envia o convite pelo Supabase e devolve o motivo em português quando falha.
 *
 * O link do e-mail leva para `/admin/senha`, que é onde a pessoa cria a senha.
 * Antes ele levava para `/admin`, que exige sessão, e quem chegava sem senha
 * era devolvido para o login sem nunca ter tido chance de criar uma.
 *
 * O `redirectTo` precisa estar na lista de "Redirect URLs" do Supabase
 * (Authentication, URL Configuration). Fora da lista, o Supabase ignora o
 * pedido EM SILÊNCIO e manda a pessoa para o "Site URL" do painel dele, que
 * era um endereço da Vercel. Era esse o "convite que cai na Vercel".
 */
async function mandarConvite(
  admin: SupabaseClient,
  email: string,
  fullName: string,
): Promise<{ userId: string } | { error: string }> {
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName || email },
    redirectTo: absoluteUrl("/admin/senha"),
  });

  if (!error && data?.user) return { userId: data.user.id };

  switch (error?.code) {
    case "email_exists":
      return {
        error:
          "Este e-mail já tem acesso ao painel. Se a pessoa esqueceu a senha, ela mesma pede um link novo em “Esqueci minha senha”, na tela de entrada.",
      };
    case "over_email_send_rate_limit":
      return {
        error:
          "O Supabase travou o envio por excesso de e-mails na última hora. Com o SMTP próprio configurado isso deixa de acontecer. Tente de novo mais tarde.",
      };
    case "email_address_not_authorized":
      return {
        error:
          "O Supabase recusou o envio para este endereço. Sem SMTP próprio ele só manda e-mail para quem faz parte do time do projeto dele.",
      };
    default:
      return { error: `Não foi possível convidar: ${error?.message ?? "erro desconhecido"}` };
  }
}

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
        "Falta a variável SUPABASE_SERVICE_ROLE_KEY no servidor para enviar convites. " +
        "Na Vercel ela fica em Settings, Environment Variables. Localmente, no .env.local.",
    };
  }

  // Import dinâmico: mantém a service_role fora do bundle das páginas.
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();

  const convite = await mandarConvite(admin, email, fullName);
  if ("error" in convite) return { error: convite.error };

  // O trigger criou o profile; aplica o papel escolhido e ATIVA.
  //
  // O `is_active: true` é o que faz o convite funcionar. O trigger
  // `handle_new_user` (migration 0020) ativa quem tem `invited_at`, mas o
  // Supabase grava o usuário primeiro e só preenche `invited_at` num UPDATE
  // seguinte, depois do trigger de INSERT já ter rodado. Resultado: todo
  // convidado nascia inativo e, com senha criada, levava "Seu acesso está
  // inativo" no login. Quem ativa agora é quem convidou, que é um admin.
  const { error: roleError } = await admin
    .from("profiles")
    .update({ role, full_name: fullName || email, email, is_active: true })
    .eq("id", convite.userId);

  if (roleError) {
    return { error: `Convite enviado, mas o papel falhou: ${roleError.message}` };
  }

  revalidatePath("/admin/usuarios");
  return { success: `Convite enviado para ${email}. O link vale uma vez só.` };
}

/**
 * Reenvia o convite para quem ainda não criou a senha. O link do e-mail vence,
 * e sem este botão a única saída era convidar de novo digitando tudo.
 *
 * Só vale para conta que nunca confirmou o e-mail. Para quem já entrou uma
 * vez, o Supabase recusaria o convite, e o caminho certo é "Esqueci minha
 * senha", pedido pela própria pessoa.
 */
export async function reenviarConvite(
  _prev: UsersState,
  formData: FormData,
): Promise<UsersState> {
  await requireAdmin();

  const userId = String(formData.get("user_id") ?? "");
  if (!userId || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: "Não deu para reenviar." };
  }

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.getUserById(userId);
  const user = data?.user;
  if (error || !user?.email) return { error: "Conta não encontrada." };
  if (user.email_confirmed_at) {
    return { error: "Esta pessoa já criou a senha." };
  }

  const convite = await mandarConvite(
    admin,
    user.email,
    String(user.user_metadata?.full_name ?? ""),
  );
  if ("error" in convite) return { error: convite.error };

  await admin.from("profiles").update({ is_active: true }).eq("id", userId);

  revalidatePath("/admin/usuarios");
  return { success: "Reenviado." };
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
