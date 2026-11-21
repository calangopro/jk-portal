"use server";

import { revalidatePath } from "next/cache";
import { requireArea } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { lerProducao } from "@/lib/vendas/producao";
import { guardarELerFoto, type FotoLida } from "@/lib/fabrica/foto-do-pedido";
import { assinarArquivo, chamar, ehTipoDeArquivo, enderecoParaSubir, erroDoBanco, type Resultado } from "@/lib/balcao/dados";
import { FORMAS, lerValor, type PedidoDoBalcao, type RascunhoDoBalcao, type TipoDeAnexo } from "@/lib/balcao/regras";

/**
 * As ações do balcão da loja (cartão 71). Cada uma confere a área aqui e o
 * banco confere de novo, com a loja, por dentro (0198). As telas chamam como
 * função, não por `<form action>`: com `action` o React apaga o formulário
 * quando a ação volta com erro (ver CLAUDE.md, "o formulário que se apagava").
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PRIORIDADES = ["normal", "urgente", "motoboy"] as const;
type Prioridade = (typeof PRIORIDADES)[number];

const limpar = () => {
  revalidatePath("/admin/balcao", "layout");
  revalidatePath("/admin/fabrica");
  revalidatePath("/admin/na-fabrica");
};

/** O pagamento como o banco espera. `null`: nada a registrar. */
function pagamentoParaOBanco(p: RascunhoDoBalcao["pagamento"] | null | undefined) {
  if (!p) return null;
  const valor = lerValor(p.valor);
  if (!valor) return null;
  return {
    chave: UUID.test(p.chave) ? p.chave : null,
    valor,
    forma: FORMAS.some((f) => f.chave === p.forma) ? p.forma : "outro",
    parcelas: p.forma === "credito" ? Math.min(24, Math.max(1, Math.round(Number(p.parcelas) || 1))) : 1,
    comprovante: typeof p.comprovante === "string" && p.comprovante ? p.comprovante : null,
  };
}

/**
 * Salva o pedido inteiro (cria ou edita) e, se pedido, já manda para a
 * fábrica. Voltar com erro nunca apaga nada: o rascunho continua no aparelho.
 */
export async function salvarPedidoDoBalcao(
  r: RascunhoDoBalcao,
  fabrica: { prioridade: Prioridade } | null,
): Promise<{ ok: true; id: string; numero: number; fabrica: boolean; avisoDaFabrica: string | null } | { ok: false; erro: string }> {
  await requireArea("balcao");
  if (!r || typeof r !== "object" || !UUID.test(String(r.id))) return { ok: false, erro: "Pedido sem identificação. Recarregue a tela." };
  const lida = lerProducao(r.producao);
  if (!lida.ok) return lida;
  const total = lerValor(r.total);
  if (!total) return { ok: false, erro: "Diga o valor total do pedido." };
  const pag = pagamentoParaOBanco(r.pagamento);
  if (r.pagamento && !pag) return { ok: false, erro: "Diga o valor pago agora, ou tire o pagamento." };
  if (pag && pag.valor > total) return { ok: false, erro: "O pago agora passou do total. Confira os dois valores." };
  if (/[—–]/.test(`${r.observacao ?? ""}${r.cliente_nome ?? ""}`)) return { ok: false, erro: "Sem travessão no texto." };

  const tiposDeAnexo: TipoDeAnexo[] = ["comprovante", "documento", "foto"];
  const anexos = (Array.isArray(r.anexos) ? r.anexos : [])
    .filter((a) => a && typeof a.caminho === "string" && a.caminho.startsWith(`${r.id}/`))
    .slice(0, 20)
    .map((a) => ({ caminho: a.caminho, tipo: tiposDeAnexo.includes(a.tipo) ? a.tipo : "documento", nome: String(a.nome ?? "").slice(0, 120) }))
    // O comprovante do pagamento entra pelo próprio pagamento.
    .filter((a) => a.caminho !== pag?.comprovante);

  const p = lida.producao;
  const db = await createClient();
  const { data, error } = await db.rpc("balcao_salvar_pedido", {
    p: {
      id: r.id,
      loja: r.loja || null,
      vendedor: r.vendedor || null,
      cliente_nome: r.cliente_nome,
      cliente_telefone: r.cliente_telefone,
      cliente_email: r.cliente_email || null,
      motivo: r.motivo || null,
      data_especial: /^\d{4}-\d{2}-\d{2}$/.test(r.data_especial ?? "") ? r.data_especial : null,
      pecas: p.pecas,
      // O formulário cru, para reabrir exatamente como ficou (sem o pagamento, que já virou linha própria).
      formulario: { ...r, pagamento: null, anexos: [] },
      entrega: r.producao.entrega,
      entrega_texto: p.entrega,
      endereco: p.endereco,
      cidade: p.cidade,
      uf: p.uf,
      prazo: /^\d{4}-\d{2}-\d{2}$/.test(r.prazo ?? "") ? r.prazo : null,
      total,
      observacao: r.observacao || null,
      numero_papel: r.numero_papel || null,
      fotos: Array.isArray(r.fotos) ? r.fotos.slice(0, 4) : [],
      transcricao: r.transcricao || null,
      anexos,
      pagamentos: pag ? [pag] : [],
    },
  });
  if (error) return { ok: false, erro: erroDoBanco(error) };
  const salvo = data as { id: string; numero: number };

  let foi = false;
  let avisoDaFabrica: string | null = null;
  if (fabrica) {
    const prioridade = PRIORIDADES.includes(fabrica.prioridade) ? fabrica.prioridade : "normal";
    const f = await chamar(db, "balcao_mandar_para_fabrica", { p_pedido: salvo.id, p_prioridade: prioridade });
    if (f.ok) foi = true;
    else avisoDaFabrica = `O pedido foi salvo, mas não foi para a fábrica: ${f.erro}`;
  }
  limpar();
  return { ok: true, id: salvo.id, numero: salvo.numero, fabrica: foi, avisoDaFabrica };
}

export async function mandarParaFabrica(pedido: string, prioridade: Prioridade): Promise<Resultado<PedidoDoBalcao>> {
  await requireArea("balcao");
  if (!UUID.test(pedido)) return { ok: false, erro: "Pedido inválido." };
  const r = await chamar(await createClient(), "balcao_mandar_para_fabrica", { p_pedido: pedido, p_prioridade: PRIORIDADES.includes(prioridade) ? prioridade : "normal" });
  if (r.ok) limpar();
  return r;
}

export async function receberPagamento(pedido: string, p: NonNullable<RascunhoDoBalcao["pagamento"]>): Promise<Resultado<PedidoDoBalcao>> {
  await requireArea("balcao");
  if (!UUID.test(pedido)) return { ok: false, erro: "Pedido inválido." };
  const pag = pagamentoParaOBanco(p);
  if (!pag) return { ok: false, erro: "Diga o valor recebido." };
  const r = await chamar(await createClient(), "balcao_pagar", { p_pedido: pedido, p: pag });
  if (r.ok) limpar();
  return r;
}

export async function estornarPagamento(pagamento: string, motivo: string): Promise<Resultado<PedidoDoBalcao>> {
  await requireArea("balcao");
  if (!UUID.test(pagamento)) return { ok: false, erro: "Pagamento inválido." };
  const r = await chamar(await createClient(), "balcao_estornar", { p_pagamento: pagamento, p_motivo: String(motivo ?? "").slice(0, 300) });
  if (r.ok) limpar();
  return r;
}

export async function marcarPedido(pedido: string, acao: "recebido" | "entregue" | "cancelar" | "desfazer", motivo?: string): Promise<Resultado<PedidoDoBalcao>> {
  await requireArea("balcao");
  if (!UUID.test(pedido) || !["recebido", "entregue", "cancelar", "desfazer"].includes(acao)) return { ok: false, erro: "Ação inválida." };
  const r = await chamar(await createClient(), "balcao_marcar", { p_pedido: pedido, p_acao: acao, p_motivo: motivo ? String(motivo).slice(0, 300) : null });
  if (r.ok) limpar();
  return r;
}

export async function anexarAoPedido(pedido: string, caminho: string, tipo: TipoDeAnexo, nome: string): Promise<Resultado<PedidoDoBalcao>> {
  await requireArea("balcao");
  if (!UUID.test(pedido)) return { ok: false, erro: "Pedido inválido." };
  const r = await chamar(await createClient(), "balcao_anexar", { p_pedido: pedido, p_caminho: caminho, p_tipo: tipo, p_nome: String(nome ?? "").slice(0, 120) });
  if (r.ok) limpar();
  return r;
}

export async function tirarAnexo(anexo: string): Promise<Resultado<PedidoDoBalcao>> {
  await requireArea("balcao");
  if (!UUID.test(anexo)) return { ok: false, erro: "Anexo inválido." };
  const r = await chamar(await createClient(), "balcao_tirar_anexo", { p_anexo: anexo });
  if (r.ok) limpar();
  return r;
}

export async function prepararEnvio(pedido: string, tipo: string): Promise<Resultado<{ caminho: string; token: string }>> {
  await requireArea("balcao");
  if (!ehTipoDeArquivo(tipo)) return { ok: false, erro: "Mande foto (JPG, PNG) ou PDF." };
  return enderecoParaSubir(await createClient(), pedido, tipo);
}

export async function verArquivo(caminho: string): Promise<string | null> {
  await requireArea("balcao");
  return assinarArquivo(await createClient(), caminho);
}

/** A foto do pedido escrito: guarda no balde da fábrica (vai junto para a OS) e, na primeira, a IA lê. */
export async function lerFotoDoPapel(dataUrl: string, ler: boolean): Promise<FotoLida> {
  const quem = await requireArea("balcao");
  return guardarELerFoto(quem.id, dataUrl, ler === true);
}

export type ClienteConhecido = {
  nome: string | null;
  email: string | null;
  pedidos: { id: string | null; numero: number; loja: string; dia: string }[];
  compras_no_site: number;
} | null;

export async function buscarCliente(telefone: string): Promise<ClienteConhecido> {
  await requireArea("balcao");
  const { data, error } = await (await createClient()).rpc("balcao_cliente", { p_telefone: String(telefone ?? "").slice(0, 30) });
  if (error) return null;
  return (data ?? null) as ClienteConhecido;
}

export async function salvarVendedor(id: string | null, loja: string | null, nome: string, ativo: boolean): Promise<{ ok: true; id: string } | { ok: false; erro: string }> {
  await requireArea("balcao");
  if (id && !UUID.test(id)) return { ok: false, erro: "Vendedor inválido." };
  const { data, error } = await (await createClient()).rpc("balcao_vendedor_salvar", { p_id: id, p_loja: loja, p_nome: String(nome ?? "").slice(0, 60), p_ativo: ativo });
  if (error) return { ok: false, erro: erroDoBanco(error) };
  revalidatePath("/admin/balcao", "layout");
  return { ok: true, id: (data as { id: string }).id };
}

/** Pedido já na fábrica: a mudança vira pedido de alteração, que a fábrica confirma que viu (0199). */
export async function pedirAlteracao(pedido: string, texto: string): Promise<Resultado<PedidoDoBalcao>> {
  await requireArea("balcao");
  if (!UUID.test(pedido)) return { ok: false, erro: "Pedido inválido." };
  const t = String(texto ?? "").trim();
  if (t.length < 3 || t.length > 500) return { ok: false, erro: "Escreva a alteração em até 500 letras." };
  const r = await chamar(await createClient(), "balcao_pedir_alteracao", { p_pedido: pedido, p_texto: t });
  if (r.ok) limpar();
  return r;
}
