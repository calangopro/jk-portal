"use server";

import { revalidatePath } from "next/cache";
import { requireArea } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { CANAIS, FORMAS } from "@/lib/vendas/por-fora";
import { lerProducao, type ProducaoParaOBanco } from "@/lib/vendas/producao";

export type EstadoDaVenda = {
  ok?: boolean;
  /** Mensagem pronta para a tela. */
  mensagem?: string;
  /** A venda parece repetida: a tela oferece lançar mesmo assim. */
  podeInsistir?: boolean;
};

function dinheiro(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").replace(/[R$\s]/g, "");
  if (!s) return null;
  const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

/** Aceita "(11) 98888-7777", "11988887777" e "5511988887777". Devolve com o 55, ou null. */
function telefone(v: FormDataEntryValue | null): string | null {
  let d = String(v ?? "").replace(/\D/g, "");
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  return d.length === 10 || d.length === 11 ? `55${d}` : null;
}

const texto = (v: FormDataEntryValue | null, max: number) => String(v ?? "").trim().slice(0, max) || null;

/**
 * Registra uma venda fechada fora da loja.
 *
 * Quem grava é a função do banco `registrar_venda_avulsa`, que confere o acesso
 * e a duplicidade: venda igual já lançada, ou valor que já está num pedido pago
 * da Tray. Nesses casos a venda NÃO entra e a tela pergunta se é para lançar
 * mesmo assim (o segundo envio vem com `insistir`), e aí ela fica marcada para
 * conferência.
 */
export async function registrarVenda(_: EstadoDaVenda, formData: FormData): Promise<EstadoDaVenda> {
  await requireArea("lancar_venda");

  const valor = dinheiro(formData.get("valor"));
  if (valor === null) return { mensagem: "Escreva o valor da venda, por exemplo 349,90." };
  const forma = String(formData.get("forma") ?? "");
  const canal = String(formData.get("canal") ?? "");
  if (!FORMAS.some((f) => f.chave === forma) || !CANAIS.some((c) => c.chave === canal)) {
    return { mensagem: "Escolha a forma de pagamento e por onde a venda veio." };
  }
  const bruto = String(formData.get("telefone") ?? "").trim();
  const fone = telefone(bruto);
  if (bruto && !fone) return { mensagem: "O telefone precisa do DDD e do número, por exemplo (11) 98888-7777." };

  // A parte da fábrica é conferida ANTES de gravar a venda: com peça faltando, nada entra, e a pessoa conserta e envia de novo.
  let producao: ProducaoParaOBanco | null = null;
  const cru = String(formData.get("producao") ?? "");
  if (cru) {
    let lido: unknown = null;
    try {
      lido = JSON.parse(cru);
    } catch {
      return { mensagem: "Não deu para ler as peças da venda. Recarregue a página e tente de novo." };
    }
    const r = lerProducao(lido);
    if (!r.ok) return { mensagem: r.erro };
    producao = r.producao;
  }

  const dia = /^\d{4}-\d{2}-\d{2}$/.test(String(formData.get("dia") ?? "")) ? String(formData.get("dia")) : null;
  const vendedor = String(formData.get("vendedor") ?? "") || null;
  const pedido = Number(formData.get("pedido_recuperado"));

  const db = await createClient();
  const { data, error } = await db.rpc("registrar_venda_avulsa", {
    p_valor: valor,
    p_forma: forma,
    p_canal: canal,
    p_cliente_nome: texto(formData.get("cliente"), 160),
    p_telefone: fone,
    // Sem descrição escrita, vale a lista das peças que vão para a fábrica.
    p_produto: texto(formData.get("produto"), 300) ?? producao?.resumo ?? null,
    p_observacao: texto(formData.get("observacao"), 500),
    p_dia: dia,
    p_vendedor: vendedor,
    p_pedido_recuperado: Number.isInteger(pedido) && pedido > 0 ? pedido : null,
    p_forcar: formData.get("insistir") === "sim",
  });
  if (error) {
    console.error("[vendas] registrarVenda:", error.message);
    return { mensagem: "Não deu para gravar agora. Tente de novo em alguns segundos." };
  }

  const r = (data ?? {}) as { ok?: boolean; id?: string; motivo?: string; parecida_com?: string; conferir?: string | null };
  if (!r.ok) {
    if (r.motivo === "repetida") {
      return { podeInsistir: true, mensagem: `Parece repetida: já existe ${r.parecida_com} com o mesmo telefone e o mesmo valor.` };
    }
    if (r.motivo === "ja_na_loja") {
      return { podeInsistir: true, mensagem: `Esse valor já está no ${r.parecida_com}, do mesmo telefone. Se foi pago pelo site, não precisa lançar.` };
    }
    return { mensagem: "O seu acesso não permite registrar venda." };
  }

  // A venda já está gravada. Se a ida para a fábrica falhar, a mensagem diz as duas coisas: a venda entrou e a fábrica não recebeu.
  let naFabrica: "nao_pedida" | "foi" | "falhou" = "nao_pedida";
  if (producao && r.id) {
    const envio = await db.rpc("enviar_venda_para_a_fabrica", {
      p_venda: r.id,
      p_pecas: producao.pecas,
      p_entrega: producao.entrega,
      p_endereco: producao.endereco,
      p_cidade: producao.cidade,
      p_uf: producao.uf,
    });
    const ok = !envio.error && (envio.data as { ok?: boolean } | null)?.ok === true;
    if (!ok) console.error("[vendas] enviar_venda_para_a_fabrica:", envio.error?.message ?? JSON.stringify(envio.data));
    naFabrica = ok ? "foi" : "falhou";
  }

  revalidatePath("/admin/registrar-venda");
  revalidatePath("/admin/vendedores");
  revalidatePath("/admin/vendas");
  revalidatePath("/admin/fabrica");
  revalidatePath("/admin");
  if (naFabrica === "falhou") {
    // Não é `ok`: os campos ficam preenchidos, para a pessoa copiar o que escreveu e avisar a fábrica.
    return { mensagem: "A venda foi registrada, mas não chegou à fábrica. Não envie de novo, para não registrar em dobro: avise a fábrica com os dados das peças." };
  }
  const base = r.conferir ? "Venda registrada e marcada para conferência." : "Venda registrada.";
  return { ok: true, mensagem: naFabrica === "foi" ? `${base} As peças já estão na fila da fábrica.` : base };
}

/** Estorna uma venda. O banco só deixa a própria, de hoje ou de ontem; quem vê todas estorna qualquer uma. */
export async function estornarVenda(formData: FormData): Promise<void> {
  await requireArea("lancar_venda");
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const db = await createClient();
  const { error } = await db.rpc("estornar_venda_avulsa", { p_id: id });
  if (error) console.error("[vendas] estornarVenda:", error.message);
  revalidatePath("/admin/registrar-venda");
  revalidatePath("/admin/vendedores");
  revalidatePath("/admin/vendas");
}
