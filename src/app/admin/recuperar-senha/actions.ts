"use server";

import { createClient } from "@supabase/supabase-js";
import { absoluteUrl } from "@/lib/seo/site";

export type RecuperarState = { erro?: string; enviado?: boolean };

/**
 * Manda o link de senha nova para quem esqueceu a dela.
 *
 * Cliente avulso, sem cookie e em fluxo implícito, de propósito. O cliente do
 * servidor (`@/lib/supabase/server`) trabalha em PKCE, e em PKCE o link só
 * funciona no MESMO navegador que pediu, porque a outra metade da chave fica
 * num cookie dele. Quem pede no computador e abre o e-mail no celular cairia em
 * erro. Assim o link vale em qualquer aparelho, e é a tela `/admin/senha` que
 * resolve os dois formatos que ele pode ter.
 */
export async function pedirLinkDeSenha(
  _prev: RecuperarState,
  formData: FormData,
): Promise<RecuperarState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!email) return { erro: "Informe o e-mail que você usa para entrar." };

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        flowType: "implicit",
      },
    },
  );

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: absoluteUrl("/admin/senha"),
  });

  // O erro vai para o log da Vercel e não para a tela. A resposta é a mesma
  // com e sem conta, para esta página não virar consulta de quem tem acesso.
  // O caso que mais aparece aqui é limite de envio do SMTP padrão do Supabase.
  if (error) console.error("[recuperar-senha]", error.code ?? "", error.message);

  return { enviado: true };
}
