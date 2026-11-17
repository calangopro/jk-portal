"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { lerChaves } from "@/lib/leads/chaves";
import { lerConfigDaLoja, rodarEnvioDaLoja, type ModoDaLoja } from "@/lib/meta/loja";
import type { IntegracaoState } from "./actions";

/**
 * A compra da loja pelo servidor (0120, `lib/meta/loja.ts`): o modo, o corte e
 * o código de teste. Só administrador, dono e GM (`requireAdmin`), e quem
 * mudou fica gravado em `meta_loja_config.alterado_por`.
 *
 * Ligar de verdade pede a confirmação de que o teste foi conferido no
 * Gerenciador de Eventos: é o que separa "mandar compra de mentira" de "mexer
 * no que as campanhas leem".
 */
export async function salvarCompraNoMeta(_prev: IntegracaoState, formData: FormData): Promise<IntegracaoState> {
  const perfil = await requireAdmin();
  const db = createAdminClient();
  const atual = await lerConfigDaLoja(db);

  const modo = String(formData.get("modo") ?? "") as ModoDaLoja;
  if (!["desligado", "teste", "ligado"].includes(modo)) return { erro: "Escolha um modo." };

  const colado = String(formData.get("codigo_de_teste") ?? "").trim();
  if (colado && !/^[A-Za-z0-9]{4,40}$/.test(colado)) return { erro: "O código de teste é o que o Gerenciador mostra em Eventos de teste, só letras e números." };
  // Campo vazio mantém o código guardado: ele nunca volta para a tela.
  const codigo = colado || atual.codigoDeTeste || "";
  if (modo === "teste" && !codigo) return { erro: "Em teste, cole o código de Eventos de teste do Gerenciador." };

  if (modo !== "desligado") {
    const chave = (await lerChaves(db)).meta_capi;
    if (!chave) return { erro: "Falta o token da API de Conversões no cartão do Meta, mais abaixo, em Grupo de ofertas." };
  }
  if (modo === "ligado" && atual.modo !== "ligado" && formData.get("conferido") !== "1") {
    return { erro: "Antes de ligar, confira em Eventos de teste que a compra chega e marque a caixa." };
  }

  // O corte: só pedido de agora em diante, ou também os dos últimos 7 dias, que o Meta ainda aceita.
  const corte = String(formData.get("corte") ?? "manter");
  let desde = atual.desde;
  if (modo !== "desligado" && (corte === "agora" || (corte === "manter" && !desde))) desde = new Date().toISOString();
  if (modo !== "desligado" && corte === "sete") desde = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const { error } = await db
    .from("meta_loja_config")
    .update({ modo, desde, codigo_de_teste: codigo || null, alterado_em: new Date().toISOString(), alterado_por: perfil.id })
    .eq("id", true);
  if (error) return { erro: error.message };

  revalidatePath("/admin/integracoes");
  revalidatePath("/admin/saude");
  if (modo === "desligado") return { ok: "Desligado. Nada mais vai ao Meta pelo servidor, e o coletor para de guardar os sinais do navegador." };
  if (modo === "teste") return { ok: "Em teste. Na próxima rodada (até 10 minutos) as compras aparecem em Eventos de teste, no Gerenciador." };
  return { ok: "Ligado. As compras vão ao Meta de verdade a partir da próxima rodada." };
}

/** Monta o que iria agora, sem mandar e sem gravar: quantos pedidos, quais eventos e quais campos de cliente. */
export async function simularCompraNoMeta(_prev: IntegracaoState, _formData: FormData): Promise<IntegracaoState> {
  await requireAdmin();
  try {
    const r = await rodarEnvioDaLoja(createAdminClient(), { simular: true });
    if (r.estado !== "ok") return { erro: r.estado === "sem_chave" ? r.detalhe : "Desligado." };
    if (!r.mandados) return { ok: `Nada para mandar agora. ${r.pedidos} pedidos olhados, ${r.deixados} deixados de lado.` };
    const porEvento = (e: string) => (r.eventos ?? []).filter((x) => x.evento === e).length;
    const comNavegador = (r.eventos ?? []).filter((x) => x.origem === "website").length;
    const campos = new Set((r.eventos ?? []).flatMap((x) => x.campos));
    return {
      ok:
        `Iriam ${r.mandados} eventos de ${r.pedidos} pedidos: ${porEvento("Purchase")} compras e ${porEvento("CompraPaga")} compras pagas, ` +
        `${comNavegador} com o navegador de quem comprou. Campos de cliente usados: ${[...campos].join(", ")}.` +
        (r.trayVoltou ? " A Tray voltou a mandar ao Meta, então a compra (Purchase) ficaria em pausa." : ""),
    };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Não deu para simular agora." };
  }
}
