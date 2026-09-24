import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { FormSenha } from "./FormSenha";
import { tipoDeLink } from "./regras";

export const metadata: Metadata = {
  title: { absolute: "Criar senha | Painel JK" },
  robots: { index: false, follow: false },
};

/**
 * Porta de chegada do convite e da recuperação de senha.
 *
 * O e-mail traz `?token_hash=...&type=invite` (ou `recovery`), pelo modelo de
 * mensagem guardado em `supabase/templates/`. A página NÃO verifica o link ao
 * abrir: quem verifica é a ação, no envio do formulário (ver `definirSenha`).
 *
 * Sem `token_hash`, a página ainda serve a dois casos, e quem decide é o
 * `FormSenha` no navegador, porque o servidor não enxerga o `#` da URL:
 *   1. link no formato antigo do Supabase, com a sessão depois do `#`, que é o
 *      que chega enquanto o modelo de e-mail do painel não for trocado;
 *   2. quem já tem sessão e quer trocar a senha.
 */
export default async function SenhaPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string }>;
}) {
  const { token_hash, type } = await searchParams;
  const tipo = tipoDeLink(type);
  const tokenHash = token_hash?.trim() || null;

  let temSessao = false;
  if (!tokenHash) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    temSessao = Boolean(user);
  }

  return (
    <FormSenha
      tokenHash={tokenHash && tipo ? tokenHash : null}
      tipo={tipo}
      temSessao={temSessao}
      linkInvalido={Boolean(tokenHash) && !tipo}
    />
  );
}
