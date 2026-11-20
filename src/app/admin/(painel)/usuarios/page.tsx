import { requireAdmin, type AppRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { TelaDeUsuarios } from "./Tela";

export const metadata = { title: "Usuários" };

type Row = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: AppRole;
  is_active: boolean;
  created_at: string;
};

/**
 * Quem foi convidado e ainda não criou a senha.
 *
 * A confirmação do e-mail mora em `auth.users`, que só a service_role lê. Sem
 * a chave, a tela continua funcionando, só sem o aviso de convite pendente.
 */
async function contasSemSenha(): Promise<Set<string>> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return new Set();
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const { data } = await createAdminClient().auth.admin.listUsers({ perPage: 1000 });
    return new Set(
      (data?.users ?? []).filter((u) => !u.email_confirmed_at).map((u) => u.id),
    );
  } catch {
    return new Set();
  }
}

export default async function UsuariosPage() {
  const me = await requireAdmin();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, is_active, created_at, loja")
    .order("created_at", { ascending: true });

  const users = (data ?? []) as Row[];
  const pendentes = await contasSemSenha();

  return <TelaDeUsuarios users={users} pendentes={pendentes} meuId={me.id} erro={error?.message ?? null} />;
}
