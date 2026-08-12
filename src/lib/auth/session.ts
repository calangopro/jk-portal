import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AppRole = "admin" | "editor" | "reviewer" | "author";

export type Profile = {
  id: string;
  email: string | null;
  fullName: string | null;
  role: AppRole;
  isActive: boolean;
};

/** Perfil do usuário logado (ou null se não houver sessão válida). */
export async function getSessionProfile(): Promise<Profile | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (!data) return null;

  return {
    id: data.id,
    email: data.email ?? user.email ?? null,
    fullName: data.full_name,
    role: data.role as AppRole,
    isActive: data.is_active,
  };
}

/** Exige sessão de um membro ATIVO da equipe; caso contrário, manda ao login. */
export async function requireStaff(): Promise<Profile> {
  const profile = await getSessionProfile();
  if (!profile || !profile.isActive) redirect("/admin/login");
  return profile;
}

/** Exige papel de administrador. */
export async function requireAdmin(): Promise<Profile> {
  const profile = await requireStaff();
  if (profile.role !== "admin") redirect("/admin");
  return profile;
}

export const ROLE_LABEL: Record<AppRole, string> = {
  admin: "Administrador",
  editor: "Editor",
  reviewer: "Revisor",
  author: "Autor",
};
