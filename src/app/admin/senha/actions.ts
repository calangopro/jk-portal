"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { problemaNaSenha, tipoDeLink } from "./regras";

export type SenhaState = {
  erro?: string;
  /** Tela sem saída pelo formulário: link gasto ou acesso inativo. */
  fim?: "vencido" | "inativo";
  /**
   * O link JÁ foi verificado e a sessão existe, mas a senha foi recusada.
   * A tela para de mandar o `token_hash`, que não vale mais, e a próxima
   * tentativa segue só com a sessão.
   */
  comSessao?: boolean;
};

function mensagemDoErro(codigo: string | undefined): string {
  switch (codigo) {
    case "weak_password":
      return "Essa senha é fácil de adivinhar ou já apareceu em vazamentos de outros sites. Escolha outra, mais longa.";
    case "same_password":
      return "A senha nova precisa ser diferente da atual.";
    case "reauthentication_needed":
      return "Por segurança, peça um link novo em “Esqueci minha senha” e troque por lá.";
    default:
      return "Não foi possível salvar a senha. Tente de novo em instantes.";
  }
}

/**
 * Cria a senha de quem chegou pelo convite, ou troca a de quem pediu
 * recuperação. É uma ação só para os dois casos porque o gesto é o mesmo.
 *
 * O link é verificado AQUI, no envio do formulário, e não ao abrir a página.
 * Leitor de e-mail corporativo (e o próprio Gmail, às vezes) abre os links da
 * mensagem para checar se são seguros. Se abrir a página bastasse para gastar
 * o link, o robô gastaria antes da pessoa, e ela cairia em "link vencido" sem
 * nunca ter clicado. Robô abre página, mas não envia formulário.
 */
export async function definirSenha(
  _prev: SenhaState,
  formData: FormData,
): Promise<SenhaState> {
  const senha = String(formData.get("senha") ?? "");
  const repetida = String(formData.get("repetida") ?? "");
  const tokenHash = String(formData.get("token_hash") ?? "").trim();
  const tipo = tipoDeLink(formData.get("tipo"));

  const problema = problemaNaSenha(senha, repetida);
  if (problema) return { erro: problema };

  const supabase = await createClient();

  if (tokenHash) {
    if (!tipo) return { fim: "vencido" };
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: tipo,
    });
    if (error) return { fim: "vencido" };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { fim: "vencido" };

  const { error } = await supabase.auth.updateUser({ password: senha });
  if (error) return { erro: mensagemDoErro(error.code), comSessao: true };

  const { data: perfil } = await supabase
    .from("profiles")
    .select("is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (!perfil?.is_active) {
    await supabase.auth.signOut();
    return { fim: "inativo" };
  }

  revalidatePath("/admin", "layout");
  redirect("/admin");
}
