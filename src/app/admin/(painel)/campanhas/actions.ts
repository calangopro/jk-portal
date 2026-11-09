"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ErroDeCampanha,
  adicionarProdutos,
  aplicarDesconto,
  avaliarItens,
  criarCampanha,
  definirPreco,
  definirPrecos,
  editarCampanha,
  lerCampanha,
  marcarExportada,
  mudarStatus,
  removerProdutos,
  type StatusDaCampanha,
} from "@/lib/campanhas/dados";
import type { PedidoDePromocao } from "@/lib/catalogo/planilha-tray";

type Resposta<T = object> = ({ ok: true } & T) | { ok: false; erro: string };

async function tentar<T extends object>(id: string | null, fn: () => Promise<T>): Promise<Resposta<T>> {
  try {
    const r = await fn();
    revalidatePath("/admin/campanhas");
    if (id) revalidatePath(`/admin/campanhas/${id}`);
    return { ok: true, ...r };
  } catch (e) {
    return { ok: false, erro: e instanceof ErroDeCampanha || e instanceof Error ? e.message : "Algo deu errado." };
  }
}

const fracao = (pct: number) => {
  if (!Number.isFinite(pct) || pct < 0 || pct >= 95) throw new ErroDeCampanha("Desconto entre 0% e 95%.");
  return pct / 100;
};

export type NovaCampanhaState = { erro?: string };

export async function novaCampanha(_prev: NovaCampanhaState, form: FormData): Promise<NovaCampanhaState> {
  const perfil = await requireStaff();
  let id: string;
  try {
    id = await criarCampanha(
      await createClient(),
      { nome: String(form.get("nome") ?? ""), inicio: String(form.get("inicio") ?? ""), fim: String(form.get("fim") ?? "") },
      perfil.id,
    );
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Não deu para criar." };
  }
  revalidatePath("/admin/campanhas");
  redirect(`/admin/campanhas/${id}`);
}

export async function salvarDados(id: string, a: { nome: string; inicio: string; fim: string }): Promise<Resposta> {
  await requireStaff();
  return tentar(id, async () => {
    await editarCampanha(await createClient(), id, a);
    return {};
  });
}

export async function adicionar(id: string, productIds: string[], descontoPct: number): Promise<Resposta<{ quantos: number }>> {
  const perfil = await requireStaff();
  return tentar(id, async () => ({
    quantos: await adicionarProdutos(await createClient(), id, productIds.slice(0, 2000), fracao(descontoPct), perfil.id),
  }));
}

export async function mudarPreco(id: string, productId: string, preco: number): Promise<Resposta> {
  await requireStaff();
  return tentar(id, async () => {
    await definirPreco(await createClient(), id, productId, preco);
    return {};
  });
}

export async function descontoParaTodos(id: string, descontoPct: number): Promise<Resposta> {
  await requireStaff();
  return tentar(id, async () => {
    await aplicarDesconto(await createClient(), id, fracao(descontoPct));
    return {};
  });
}

export async function remover(id: string, productIds: string[]): Promise<Resposta> {
  await requireStaff();
  return tentar(id, async () => {
    await removerProdutos(await createClient(), id, productIds);
    return {};
  });
}

/** Só administrador: sobe ao preço mínimo (em ,90) os itens que passam do limite. */
export async function ajustarAoMaximo(id: string): Promise<Resposta<{ ajustados: number }>> {
  const perfil = await requireStaff();
  return tentar(id, async () => {
    if (perfil.role !== "admin") throw new ErroDeCampanha("Só administrador vê o desconto máximo.");
    const db = await createClient();
    const lida = await lerCampanha(db, id);
    if (!lida) throw new ErroDeCampanha("Campanha não encontrada.");
    const { porProduto } = await avaliarItens(createAdminClient(), lida.itens, true);
    const ajustes = lida.itens
      .filter((i) => porProduto[i.productId]?.situacao === "passa" && porProduto[i.productId].precoMinimo)
      .map((i) => ({ productId: i.productId, preco: porProduto[i.productId].precoMinimo! }));
    await definirPrecos(db, id, ajustes);
    return { ajustados: ajustes.length };
  });
}

/**
 * Muda o estado. Aprovar com item abaixo da margem mínima pede o porquê por
 * escrito: fica na campanha, e é a resposta de "quem deixou passar isso".
 */
export async function mudarEstado(id: string, para: StatusDaCampanha, nota?: string): Promise<Resposta> {
  const perfil = await requireStaff();
  return tentar(id, async () => {
    const db = await createClient();
    const lida = await lerCampanha(db, id);
    if (!lida) throw new ErroDeCampanha("Campanha não encontrada.");
    const de = lida.campanha.status;
    const admin = perfil.role === "admin";

    if ((para === "aprovada" || de === "aprovada") && !admin) {
      throw new ErroDeCampanha("Só administrador aprova ou reabre campanha.");
    }
    if (para === "em_aprovacao" && !lida.itens.length) throw new ErroDeCampanha("A campanha está sem produtos.");
    if (para === "aprovada") {
      if (de !== "em_aprovacao") throw new ErroDeCampanha("Mande para aprovação primeiro.");
      const { porProduto } = await avaliarItens(createAdminClient(), lida.itens, false);
      const passam = Object.values(porProduto).filter((a) => a.situacao !== "ok").length;
      if (passam && (nota ?? "").trim().length < 5) {
        throw new ErroDeCampanha(
          `${passam} ${passam === 1 ? "produto fica" : "produtos ficam"} abaixo da margem mínima ou sem custo. Para aprovar mesmo assim, escreva o porquê.`,
        );
      }
    }
    if (para === "rascunho" && de === "em_aprovacao" && admin && (nota ?? "").trim().length < 3) {
      throw new ErroDeCampanha("Diga o que mudar ao devolver.");
    }
    await mudarStatus(db, id, para, perfil.id, nota);
    return {};
  });
}

/** Os itens da campanha aprovada, no formato da planilha de promoção. */
export async function pedidosDePromocao(id: string): Promise<Resposta<{ pedidos: PedidoDePromocao[] }>> {
  await requireStaff();
  return tentar(null, async () => {
    const lida = await lerCampanha(await createClient(), id);
    if (!lida) throw new ErroDeCampanha("Campanha não encontrada.");
    if (lida.campanha.status !== "aprovada") throw new ErroDeCampanha("Só campanha aprovada vai para a loja.");
    return {
      pedidos: lida.itens.map((i) => ({
        codigo: i.trayId,
        nome: i.nome,
        preco: i.precoCheio,
        precoPromocional: i.precoCampanha,
        inicio: lida.campanha.inicio,
        fim: lida.campanha.fim,
      })),
    };
  });
}

export async function marcarNaPlanilhaDaTray(id: string): Promise<Resposta> {
  await requireStaff();
  return tentar(id, async () => {
    await marcarExportada(await createClient(), id);
    return {};
  });
}
