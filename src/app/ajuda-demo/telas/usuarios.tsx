import { TelaDeUsuarios, type LinhaDeUsuario } from "@/app/admin/(painel)/usuarios/Tela";
import type { Demo } from "../tipos";

/** Usuários com cinco pessoas de exemplo: a própria, uma ativa, uma que ainda não criou a senha e uma inativa. */
const usuarios: LinhaDeUsuario[] = [
  { id: "u1", email: "diretoria@exemplo.com.br", full_name: "Diretoria Exemplo", role: "gm", is_active: true, created_at: "2026-01-10T12:00:00Z" },
  { id: "u2", email: "pessoa@exemplo.com.br", full_name: "Pessoa Exemplo", role: "vendas", is_active: true, created_at: "2026-02-10T12:00:00Z" },
  { id: "u3", email: "gerente@exemplo.com.br", full_name: "Gerente Exemplo", role: "gerente", is_active: true, created_at: "2026-03-10T12:00:00Z" },
  { id: "u4", email: "novo@exemplo.com.br", full_name: "Pessoa Exemplo Nova", role: "vendas", is_active: true, created_at: "2026-11-10T12:00:00Z" },
  { id: "u5", email: "antigo@exemplo.com.br", full_name: "Pessoa Exemplo Antiga", role: "editor", is_active: false, created_at: "2026-04-10T12:00:00Z" },
];

const demo: Demo = {
  caminho: "/admin/usuarios",
  desenho: () => <TelaDeUsuarios users={usuarios} pendentes={new Set(["u4"])} meuId="u1" />,
};
export default demo;
