import { requireArea } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { lerAlteracoes } from "./ler";
import { TelaDeAlteracoes } from "./Tela";

export const metadata = { title: "Alterações na loja" };

/**
 * O histórico do que o painel mandou para a loja na Tray: quem, quando, o que
 * era e o que ficou. Inclui o que a Tray recusou e o que ela disse que gravou e
 * não gravou, porque é justamente aí que alguém precisa olhar.
 *
 * Lê `loja_alteracoes` (0065) com os direitos de quem está logado: a policy só
 * abre para quem tem a área `loja`. Só leitura: nada se desfaz por aqui. Para
 * voltar atrás, a pessoa edita o produto de novo, e isso vira outra linha.
 */
export default async function AlteracoesNaLojaPage() {
  await requireArea("loja");
  return <TelaDeAlteracoes {...(await lerAlteracoes(await createClient()))} />;
}
