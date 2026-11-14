"use server";

import { revalidatePath } from "next/cache";
import { ehAdmin } from "@/lib/auth/acessos";
import { requireArea } from "@/lib/auth/session";
import { gravarRegrasDeEntrega, informarProntaEntrega } from "@/lib/consulta/dados";
import { createClient } from "@/lib/supabase/server";
import { lerRegras } from "@/lib/vendas/prazos";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Informa o que uma loja tem (ou deixou de ter) de um produto.
 *
 * A área é conferida aqui e de novo dentro da função do banco, que é quem
 * grava e quem guarda o nome de quem informou.
 */
export async function informar(
  loja: string,
  produto: string,
  tem: boolean,
  extras: { numeracoes?: string; observacao?: string } = {},
): Promise<{ ok: true } | { ok: false; erro: string }> {
  await requireArea("consulta");
  if (!UUID.test(loja) || !UUID.test(produto) || typeof tem !== "boolean") return { ok: false, erro: "Loja ou produto inválidos." };
  const r = await informarProntaEntrega(await createClient(), {
    loja,
    produto,
    tem,
    numeracoes: extras.numeracoes?.slice(0, 120),
    observacao: extras.observacao?.slice(0, 200),
  });
  if (r.ok) revalidatePath("/admin/consulta");
  return r;
}

/**
 * Troca os dias e a hora do malote, e marca as regras como confirmadas pela JK.
 * Só administrador, dono e GM: é a regra que o vendedor repete para o cliente.
 */
export async function salvarRegras(a: { diasDoMalote: number[]; horaDoMalote: number }): Promise<{ ok: true } | { ok: false; erro: string }> {
  const perfil = await requireArea("consulta");
  if (!ehAdmin(perfil.role)) return { ok: false, erro: "Só administrador, dono ou GM muda as regras de entrega." };
  const lidas = lerRegras({ diasDoMalote: a.diasDoMalote, horaDoMalote: a.horaDoMalote, confirmadas: true });
  // `lerRegras` devolve a regra de partida quando a entrada não vale: aí não há o que gravar.
  if (!lidas.confirmadas) return { ok: false, erro: "Escolha pelo menos um dia de malote e uma hora entre 0 e 23." };
  const erro = await gravarRegrasDeEntrega(lidas, perfil.id);
  if (erro) return { ok: false, erro: "Não deu para gravar as regras agora." };
  revalidatePath("/admin/consulta");
  return { ok: true };
}
