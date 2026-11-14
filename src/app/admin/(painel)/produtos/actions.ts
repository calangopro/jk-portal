"use server";

import { revalidatePath } from "next/cache";
import { ehAdmin } from "@/lib/auth/acessos";
import { requireArea, requireStaff } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { alterarProdutoNaLoja, lerProdutoNaLoja, preverEdicaoDoProduto, type Previa, type Resultado } from "@/lib/loja/alterar";
import type { Edicao } from "@/lib/loja/produto";
import { createClient } from "@/lib/supabase/server";
import {
  ErroDeFoto,
  decidirFoto,
  devolverParaFila,
  dispensarProduto,
  fotosDoProduto,
  lerPadroes,
  marcarExportadas,
  pedidosDaPlanilha,
  registrarFotoEnviada,
  salvarPadrao,
  type FotoDoProduto,
  type PedidoComFotos,
} from "@/lib/catalogo/fotos";
import { TIPOS_DE_FOTO, type TipoDeFoto } from "@/lib/catalogo/estados";

export type SyncState = { erro?: string; ok?: string };

/** Dispara a sincronização manual do catálogo. */
export async function sincronizarAgora(
  _prev: SyncState,
  formData: FormData,
): Promise<SyncState> {
  await requireStaff();

  const { sincronizarCatalogo } = await import("@/lib/tray/sincronizar");
  const { revalidarPrecos } = await import("@/lib/tray/revalidar");
  const r = await sincronizarCatalogo();

  if (r.revalidar) revalidarPrecos();
  revalidatePath("/admin/produtos");

  if (!r.ok) return { erro: r.erro ?? "A sincronização falhou." };

  const partes = [
    `${r.produtos} produtos conferidos`,
    r.alterados > 0 ? `${r.alterados} atualizados` : "nenhum mudou na loja",
    r.desativados > 0 ? `${r.desativados} desativados` : null,
    r.fotosNaLoja ? `${r.fotosNaLoja} fotos novas já na loja` : null,
  ].filter(Boolean);

  const falhas = r.falhas > 0
    ? ` ${r.falhas} não gravaram. Primeiro erro: ${r.primeiroErro ?? "sem detalhe"}.`
    : "";
  const aviso = r.aviso ? ` ${r.aviso}` : "";

  return { ok: `Pronto em ${(r.duracaoMs / 1000).toFixed(1)}s: ${partes.join(", ")}.${falhas}${aviso}` };
}

// ------------------------------------------------------------------ fotos

type Resposta<T = object> = ({ ok: true } & T) | { ok: false; erro: string };

/** Erro de regra vira mensagem; erro inesperado também, sem pilha. */
async function tentar<T extends object>(fn: () => Promise<T>): Promise<Resposta<T>> {
  try {
    return { ok: true, ...(await fn()) };
  } catch (e) {
    const msg = e instanceof ErroDeFoto || e instanceof Error ? e.message : "Algo deu errado.";
    return { ok: false, erro: msg };
  }
}

export async function lerProduto(
  productId: string,
  categoryId: string | null,
): Promise<Resposta<{ fotos: FotoDoProduto[]; padrao: string; padraoDaCategoria: boolean }>> {
  await requireStaff();
  return tentar(async () => {
    const db = await createClient();
    const [fotos, padroes] = await Promise.all([fotosDoProduto(db, productId), lerPadroes(db)]);
    const daCategoria = categoryId ? padroes.porCategoria[categoryId] : undefined;
    return { fotos, padrao: daCategoria?.instrucoes ?? padroes.geral, padraoDaCategoria: Boolean(daCategoria) };
  });
}

export async function registrarFoto(a: {
  productId: string;
  caminho: string;
  largura: number;
  altura: number;
  bytes: number;
  tipo: TipoDeFoto;
}): Promise<Resposta<{ id: string }>> {
  const perfil = await requireStaff();
  return tentar(async () => {
    if (!TIPOS_DE_FOTO.includes(a.tipo)) throw new ErroDeFoto("Tipo de foto desconhecido.");
    const db = await createClient();
    const r = await registrarFotoEnviada(db, { ...a, quem: perfil.id });
    revalidatePath("/admin/produtos");
    return r;
  });
}

export async function decidir(a: { fotoId: string; aprovar: boolean; nota?: string }): Promise<Resposta> {
  const perfil = await requireStaff();
  return tentar(async () => {
    const db = await createClient();
    await decidirFoto(db, { ...a, quem: perfil.id });
    revalidatePath("/admin/produtos");
    return {};
  });
}

export async function dispensar(a: { productId: string; motivo: string }): Promise<Resposta> {
  const perfil = await requireStaff();
  return tentar(async () => {
    const db = await createClient();
    await dispensarProduto(db, a.productId, a.motivo, perfil.id);
    revalidatePath("/admin/produtos");
    return {};
  });
}

export async function devolver(productId: string): Promise<Resposta> {
  const perfil = await requireStaff();
  return tentar(async () => {
    const db = await createClient();
    await devolverParaFila(db, productId, perfil.id);
    revalidatePath("/admin/produtos");
    return {};
  });
}

export async function salvarPadraoDeFoto(a: { categoryId: string | null; instrucoes: string }): Promise<Resposta> {
  const perfil = await requireStaff();
  return tentar(async () => {
    const db = await createClient();
    await salvarPadrao(db, { ...a, quem: perfil.id });
    revalidatePath("/admin/produtos");
    return {};
  });
}

// ------------------------------------------------------------------ planilha

export async function fotosParaPlanilha(): Promise<Resposta<{ pedidos: PedidoComFotos[] }>> {
  await requireStaff();
  return tentar(async () => pedidosDaPlanilha(await createClient()));
}

export async function marcarNaPlanilha(fotoIds: string[]): Promise<Resposta<{ marcadas: number }>> {
  await requireStaff();
  return tentar(async () => {
    const marcadas = await marcarExportadas(await createClient(), fotoIds.slice(0, 5000));
    revalidatePath("/admin/produtos");
    return { marcadas };
  });
}

// ---------------------------------------------------------------------------
// Editar o produto na loja (0065)
// ---------------------------------------------------------------------------
//
// As três ações pedem a área `loja` e sempre falam com a loja da JK. Usam o
// cliente de serviço porque o token da Tray e o registro das alterações não
// abrem para o navegador; quem chega aqui já passou pela conferência da área.

export async function lerNaLoja(trayId: string) {
  await requireArea("loja");
  return lerProdutoNaLoja(createAdminClient(), "jk", String(trayId));
}

export async function preverNaLoja(trayId: string, edicao: Edicao): Promise<Previa> {
  const perfil = await requireArea("loja");
  return preverEdicaoDoProduto(createAdminClient(), { loja: "jk", trayId: String(trayId), edicao, podePreco: ehAdmin(perfil.role) });
}

export async function gravarNaLoja(trayId: string, edicao: Edicao): Promise<Resultado> {
  const perfil = await requireArea("loja");
  const r = await alterarProdutoNaLoja(createAdminClient(), { loja: "jk", trayId: String(trayId), edicao, podePreco: ehAdmin(perfil.role), quem: perfil.id });
  if (r.estado === "ok") revalidatePath("/admin/produtos");
  return r;
}
