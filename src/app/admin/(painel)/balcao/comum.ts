import "server-only";
import { LOJAS_FISICAS, ehLojaFisica } from "@/lib/fabrica/etapas";
import { lerProdutosDaConsulta } from "@/lib/consulta/dados";
import type { SupabaseClient } from "@supabase/supabase-js";

/** As lojas que têm balcão: as físicas, sem o time da loja online. */
export const LOJAS_DO_BALCAO: string[] = LOJAS_FISICAS.filter((l) => l !== "JK Marketing");

/** A loja da tela: a do perfil manda; sem ela (gerência, diretoria), a escolhida no endereço. */
export function lojaDaTela(minhaLoja: string | null, pedida: string | undefined): string | null {
  if (minhaLoja) return minhaLoja;
  return ehLojaFisica(pedida) && pedida !== "JK Marketing" ? pedida : null;
}

export async function produtosDoFormulario(db: SupabaseClient, hoje: string) {
  const produtos = await lerProdutosDaConsulta(db, hoje);
  return (produtos ?? []).map((x) => ({ codigo: x.codigo, nome: x.nome, miniatura: x.miniatura }));
}
