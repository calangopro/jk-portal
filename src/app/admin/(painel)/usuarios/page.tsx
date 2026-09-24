import { requireAdmin, ROLE_LABEL, type AppRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { InviteForm } from "./InviteForm";
import { BotaoReenviar } from "./BotaoReenviar";
import { updateRole, toggleActive } from "./actions";

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
    .select("id, email, full_name, role, is_active, created_at")
    .order("created_at", { ascending: true });

  const users = (data ?? []) as Row[];
  const pendentes = await contasSemSenha();

  return (
    <>
      <header>
        <p className="eyebrow">Equipe</p>
        <h1 className="font-display mt-2 text-4xl text-ink">Usuários</h1>
        <p className="mt-3 max-w-2xl text-muted">
          O acesso é somente por convite, sem cadastro público. Defina o
          papel de cada pessoa e desative quem não deve mais entrar (o histórico
          é preservado).
        </p>
      </header>

      {/* Convite */}
      <section className="glass mt-8 rounded-[20px] p-7">
        <h2 className="font-display text-2xl text-ink">Convidar pessoa</h2>
        <p className="mt-2 text-sm text-muted">
          A pessoa recebe um e-mail, clica no link e cria a própria senha no
          site. O link funciona uma vez só: se vencer, use “Reenviar convite”
          na lista abaixo.
        </p>
        <div className="mt-6">
          <InviteForm />
        </div>
      </section>

      {/* Lista */}
      <section className="glass mt-6 overflow-hidden rounded-[20px]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] text-left text-sm">
            <thead>
              <tr className="border-b border-border/70 text-xs uppercase tracking-wider text-muted">
                <th className="px-6 py-4 font-semibold">Pessoa</th>
                <th className="px-6 py-4 font-semibold">Papel</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {error ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-wine">
                    Não foi possível carregar os usuários: {error.message}
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-muted">
                    Nenhum usuário ainda.
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const isMe = u.id === me.id;
                  return (
                    <tr
                      key={u.id}
                      className="border-b border-border/50 last:border-0"
                    >
                      <td className="px-6 py-4">
                        <p className="font-medium text-ink">
                          {u.full_name ?? "sem nome"}
                          {isMe ? (
                            <span className="ml-2 rounded-full bg-brand/15 px-2 py-0.5 text-[0.7rem] font-semibold text-brand-strong">
                              você
                            </span>
                          ) : null}
                        </p>
                        <p className="text-xs text-muted">{u.email}</p>
                      </td>

                      <td className="px-6 py-4">
                        {isMe ? (
                          <span className="text-ink">{ROLE_LABEL[u.role]}</span>
                        ) : (
                          <form action={updateRole} className="flex gap-2">
                            <input
                              type="hidden"
                              name="user_id"
                              value={u.id}
                            />
                            <select
                              name="role"
                              defaultValue={u.role}
                              className="rounded-full border border-border bg-white/70 px-3 py-1.5 text-sm text-ink outline-none focus:border-brand"
                            >
                              <option value="admin">Administrador</option>
                              <option value="editor">Editor</option>
                              <option value="reviewer">Revisor</option>
                              <option value="author">Autor</option>
                            </select>
                            <button
                              type="submit"
                              className="rounded-full border border-ink/15 px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-brand/50 hover:text-brand-nav"
                            >
                              Salvar
                            </button>
                          </form>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={
                            u.is_active
                              ? "inline-flex items-center gap-1.5 text-ink"
                              : "inline-flex items-center gap-1.5 text-muted"
                          }
                        >
                          <span
                            aria-hidden
                            className={`h-1.5 w-1.5 rounded-full ${
                              u.is_active ? "bg-brand" : "bg-muted/50"
                            }`}
                          />
                          {u.is_active ? "Ativo" : "Inativo"}
                        </span>
                        {pendentes.has(u.id) ? (
                          <p className="mt-1 text-xs text-muted">
                            Ainda não criou a senha
                          </p>
                        ) : null}
                      </td>

                      <td className="px-6 py-4">
                        {isMe ? (
                          <span className="text-xs text-muted">não se aplica</span>
                        ) : (
                          <div className="flex flex-wrap items-center gap-2">
                            {pendentes.has(u.id) ? <BotaoReenviar userId={u.id} /> : null}
                            <form action={toggleActive}>
                              <input type="hidden" name="user_id" value={u.id} />
                              <input
                                type="hidden"
                                name="is_active"
                                value={String(u.is_active)}
                              />
                              <button
                                type="submit"
                                className="rounded-full border border-ink/15 px-4 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-wine/50 hover:text-wine"
                              >
                                {u.is_active ? "Desativar" : "Reativar"}
                              </button>
                            </form>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
