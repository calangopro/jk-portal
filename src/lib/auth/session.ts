import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ehAdmin, ehEquipeDeConteudo, type AppRole, type Area } from "./acessos";

export type { AppRole, Area } from "./acessos";
export { ROLE_LABEL } from "./acessos";

export type Profile = {
  id: string;
  email: string | null;
  fullName: string | null;
  role: AppRole;
  isActive: boolean;
  /** Áreas que o nível da pessoa abre, lidas de `acessos_por_papel` (0056). */
  areas: Area[];
};

/**
 * Perfil do usuário logado (ou null se não houver sessão válida).
 *
 * Com `cache`, vale UMA leitura por página. O layout do painel pede a sessão,
 * e a página pede de novo logo em seguida (`requireArea`, `requireAdmin`): sem
 * isto eram duas idas ao serviço de login e quatro consultas para descobrir a
 * mesma coisa, em toda tela. Fora de uma renderização (ação de servidor, rota)
 * o `cache` não guarda nada entre pedidos, então ninguém herda a sessão de
 * outra pessoa.
 */
export const getSessionProfile = cache(async function getSessionProfile(): Promise<Profile | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data }, { data: areas }] = await Promise.all([
    supabase.from("profiles").select("id, email, full_name, role, is_active").eq("id", user.id).maybeSingle(),
    // A função roda no banco com a regra de verdade. Se falhar, a pessoa fica
    // sem área nenhuma, que é o lado seguro do erro.
    supabase.rpc("meus_acessos"),
  ]);

  if (!data) return null;

  return {
    id: data.id,
    email: data.email ?? user.email ?? null,
    fullName: data.full_name,
    role: data.role as AppRole,
    isActive: data.is_active,
    areas: (Array.isArray(areas) ? areas : []) as Area[],
  };
});

/** Exige sessão de qualquer pessoa ATIVA, de qualquer nível; caso contrário, manda ao login. */
export async function requireSessao(): Promise<Profile> {
  const profile = await getSessionProfile();
  if (!profile || !profile.isActive) redirect("/admin/login");
  return profile;
}

/**
 * Exige alguém da equipe que mexe em conteúdo. Vendas e fábrica ficam de fora,
 * como em `is_staff()` no banco: todas as telas e ações que já chamavam esta
 * função continuam fechadas para eles sem precisar mexer em cada uma.
 */
export async function requireStaff(): Promise<Profile> {
  const profile = await requireSessao();
  if (!ehEquipeDeConteudo(profile.role)) redirect("/admin");
  return profile;
}

/** Exige uma área liberada para o nível da pessoa (vendas, recuperação, fábrica). */
export async function requireArea(area: Area): Promise<Profile> {
  const profile = await requireSessao();
  if (!profile.areas.includes(area)) redirect("/admin");
  return profile;
}

/** Exige administrador, dono ou GM: os três têm o mesmo acesso. */
export async function requireAdmin(): Promise<Profile> {
  const profile = await requireSessao();
  if (!ehAdmin(profile.role)) redirect("/admin");
  return profile;
}
