import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ItemDoCatalogo } from "@/lib/catalogo/fotos";
import {
  calcularMargem,
  chaveDaFamilia,
  custoDoProduto,
  materialPeloNome,
  type CustoGravado,
  type Familia,
  type Margem,
  type Material,
  type Parametros,
} from "./calculo";
import type { ImportacaoDeCustos } from "./planilha-do-dono";

/**
 * Custo e margem no banco. Tudo aqui é custo da empresa: as tabelas só abrem
 * para administrador (0049), então quem chama com o cliente da sessão de um
 * editor recebe vazio. A tela de campanhas, que o editor também usa, calcula
 * com o cliente de serviço e devolve SÓ se o item passa do limite, nunca o
 * custo nem a margem.
 */

export class ErroDeMargem extends Error {}

const PAGINA = 1000;
const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));

// ------------------------------------------------------------------ parâmetros

export async function lerParametros(db: SupabaseClient): Promise<Parametros> {
  const { data } = await db
    .from("custo_parametros")
    .select("cotacao_18k, cotacao_10k, taxa, imposto, frete, embalagem, margem_minima")
    .maybeSingle();
  return {
    cotacao18k: num(data?.cotacao_18k),
    cotacao10k: num(data?.cotacao_10k),
    taxa: num(data?.taxa),
    imposto: num(data?.imposto),
    frete: num(data?.frete),
    embalagem: num(data?.embalagem),
    margemMinima: num(data?.margem_minima),
  };
}

const COLUNA: Record<keyof Parametros, string> = {
  cotacao18k: "cotacao_18k",
  cotacao10k: "cotacao_10k",
  taxa: "taxa",
  imposto: "imposto",
  frete: "frete",
  embalagem: "embalagem",
  margemMinima: "margem_minima",
};

export async function salvarParametros(db: SupabaseClient, p: Partial<Parametros>, quem: string) {
  const linha: Record<string, unknown> = { atualizado_por: quem, atualizado_em: new Date().toISOString() };
  for (const [k, v] of Object.entries(p) as [keyof Parametros, number | null][]) {
    if (v !== undefined) linha[COLUNA[k]] = v;
  }
  const { error } = await db.from("custo_parametros").update(linha).eq("id", true);
  if (error) throw new ErroDeMargem(`Não deu para salvar os parâmetros: ${error.message}`);
}

// ------------------------------------------------------------------ famílias

export type FamiliaComProdutos = Familia & { produtos: number };

export async function lerFamilias(db: SupabaseClient): Promise<FamiliaComProdutos[]> {
  const [{ data: familias }, { data: ligados }] = await Promise.all([
    db.from("custo_familias").select("codigo, material, tipo, largura, perfil, gramas, aros_referencia, resto").order("codigo"),
    db.from("produto_custos").select("familia").not("familia", "is", null),
  ]);
  const conta = new Map<string, number>();
  for (const l of ligados ?? []) conta.set(l.familia, (conta.get(l.familia) ?? 0) + 1);
  return (familias ?? []).map((f) => ({
    codigo: f.codigo,
    material: f.material as Material,
    tipo: f.tipo,
    largura: f.largura,
    perfil: f.perfil,
    gramas: num(f.gramas),
    arosReferencia: f.aros_referencia,
    resto: num(f.resto),
    produtos: conta.get(f.codigo) ?? 0,
  }));
}

export async function salvarFamilia(
  db: SupabaseClient,
  codigo: string,
  v: { gramas: number | null; arosReferencia: string | null; resto: number | null },
  quem: string,
) {
  if (v.gramas !== null && !(v.gramas > 0)) throw new ErroDeMargem("Gramas precisa ser maior que zero.");
  if (v.resto !== null && v.resto < 0) throw new ErroDeMargem("O resto da peça não pode ser negativo.");
  const { error } = await db
    .from("custo_familias")
    .update({
      gramas: v.gramas,
      aros_referencia: v.arosReferencia?.trim().slice(0, 60) || null,
      resto: v.resto,
      atualizado_por: quem,
      atualizado_em: new Date().toISOString(),
    })
    .eq("codigo", codigo);
  if (error) throw new ErroDeMargem(error.message);
}

// ------------------------------------------------------------------ custo por produto

type LinhaDeCusto = {
  product_id: string;
  material: Material | null;
  familia: string | null;
  gramas: number | null;
  resto: number | null;
  custo_fixo: number | null;
};

async function linhasDeCusto(db: SupabaseClient): Promise<LinhaDeCusto[]> {
  const todas: LinhaDeCusto[] = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await db
      .from("produto_custos")
      .select("product_id, material, familia, gramas, resto, custo_fixo")
      .order("product_id")
      .range(de, de + PAGINA - 1);
    if (error) throw new ErroDeMargem(`Não deu para ler os custos: ${error.message}`);
    todas.push(...((data ?? []) as LinhaDeCusto[]));
    if ((data ?? []).length < PAGINA) break;
  }
  return todas;
}

const gravado = (l: LinhaDeCusto): CustoGravado => ({
  material: l.material,
  familia: l.familia,
  gramas: num(l.gramas),
  resto: num(l.resto),
  custoFixo: num(l.custo_fixo),
});

export type CustoDoItem = {
  gravado: CustoGravado | null;
  custo: number | null;
  detalhe: string | null;
  falta: string | null;
  margem: Margem | null;
};

/**
 * A margem de cada produto da lista, na base do preço cheio, com a promoção
 * de hoje ao lado. É o que a lista de Produtos mostra para o administrador.
 */
export async function margensDoCatalogo(
  db: SupabaseClient,
  // Aceita a lista ainda a caminho: quem chama pode pedir o catálogo e os
  // custos ao mesmo tempo, em vez de esperar um para começar o outro.
  itensOuPromessa: Pick<ItemDoCatalogo, "id" | "preco" | "precoAntes">[] | Promise<Pick<ItemDoCatalogo, "id" | "preco" | "precoAntes">[]>,
): Promise<{ parametros: Parametros; porProduto: Record<string, CustoDoItem> }> {
  const [parametros, familias, linhas, itens] = await Promise.all([
    lerParametros(db),
    lerFamilias(db),
    linhasDeCusto(db),
    itensOuPromessa,
  ]);
  const mapaFamilias = new Map(familias.map((f) => [f.codigo, f]));
  const porId = new Map(linhas.map((l) => [l.product_id, gravado(l)]));
  const porProduto: Record<string, CustoDoItem> = {};
  for (const p of itens) {
    const g = porId.get(p.id) ?? null;
    const c = custoDoProduto(g, mapaFamilias, parametros);
    const cheio = p.precoAntes ?? p.preco;
    const hoje = p.precoAntes ? p.preco : null;
    porProduto[p.id] = {
      gravado: g,
      custo: c.valor,
      detalhe: c.detalhe,
      falta: c.falta,
      margem: c.valor !== null && cheio ? calcularMargem(cheio, hoje, c.valor, parametros) : null,
    };
  }
  return { parametros, porProduto };
}

/** Grava o custo de um produto pelo painel. Campo ausente não muda; nulo apaga. */
export async function salvarCustoDoProduto(
  db: SupabaseClient,
  productId: string,
  patch: { gramas?: number | null; resto?: number | null; custoFixo?: number | null },
  quem: string,
) {
  for (const [k, v] of Object.entries(patch)) {
    if (v !== null && v !== undefined && (!Number.isFinite(v) || v < 0 || (k === "gramas" && v === 0))) {
      throw new ErroDeMargem("Valor inválido.");
    }
  }
  const { data: atual } = await db.from("produto_custos").select("product_id").eq("product_id", productId).maybeSingle();
  const agora = new Date().toISOString();
  const linha: Record<string, unknown> = { atualizado_por: quem, atualizado_em: agora };
  if (patch.gramas !== undefined) linha.gramas = patch.gramas;
  if (patch.resto !== undefined) linha.resto = patch.resto;
  if (patch.custoFixo !== undefined) linha.custo_fixo = patch.custoFixo;

  if (atual) {
    const { error } = await db.from("produto_custos").update(linha).eq("product_id", productId);
    if (error) throw new ErroDeMargem(error.message);
    return;
  }
  // Linha nova: material e família saem do nome, como na planilha.
  const { data: produto } = await db.from("products").select("name").eq("id", productId).maybeSingle();
  if (!produto) throw new ErroDeMargem("Produto não encontrado.");
  const chave = patch.custoFixo === undefined ? chaveDaFamilia(produto.name) : null;
  let familia: string | null = null;
  if (chave) {
    const { data: f } = await db
      .from("custo_familias")
      .select("codigo")
      .match(chave)
      .maybeSingle();
    familia = f?.codigo ?? null;
  }
  const { error } = await db.from("produto_custos").insert({
    product_id: productId,
    material: patch.custoFixo === undefined ? materialPeloNome(produto.name) : null,
    familia,
    ...linha,
  });
  if (error) throw new ErroDeMargem(error.message);
}

// ------------------------------------------------------------------ importação

export type ResultadoDaImportacao = {
  parametros: number;
  familias: number;
  ouro: number;
  fixos: number;
  naoAchados: string[];
};

/**
 * Leva para o banco o que o dono digitou na planilha. Só o que veio
 * preenchido muda: célula vazia nunca apaga custo que já estava no painel.
 */
export async function importarCustos(db: SupabaseClient, d: ImportacaoDeCustos, quem: string): Promise<ResultadoDaImportacao> {
  const agora = new Date().toISOString();

  if (Object.keys(d.parametros).length) await salvarParametros(db, d.parametros, quem);

  // Famílias: só atualiza as que existem (os códigos vêm da planilha gerada).
  let familias = 0;
  for (const f of d.familias) {
    const linha: Record<string, unknown> = { atualizado_por: quem, atualizado_em: agora };
    if (f.gramas !== null) linha.gramas = f.gramas;
    if (f.resto !== null) linha.resto = f.resto;
    if (f.arosReferencia !== null) linha.aros_referencia = f.arosReferencia;
    const { data, error } = await db.from("custo_familias").update(linha).eq("codigo", f.codigo).select("codigo");
    if (error) throw new ErroDeMargem(`Família ${f.codigo}: ${error.message}`);
    familias += data?.length ?? 0;
  }

  // Produtos: código da Tray para id do portal.
  const codigos = Array.from(new Set([...d.ouro.map((o) => o.trayId), ...d.fixos.map((x) => x.trayId)]));
  const idPorCodigo = new Map<string, { id: string; name: string }>();
  for (let i = 0; i < codigos.length; i += 300) {
    const { data } = await db.from("products").select("id, tray_id, name").in("tray_id", codigos.slice(i, i + 300));
    for (const p of data ?? []) idPorCodigo.set(p.tray_id, { id: p.id, name: p.name });
  }
  const naoAchados = codigos.filter((c) => !idPorCodigo.has(c));

  const existentes = new Map((await linhasDeCusto(db)).map((l) => [l.product_id, l]));
  const linhas = new Map<string, LinhaDeCusto & { atualizado_por: string; atualizado_em: string }>();
  const base = (id: string, nome: string) =>
    linhas.get(id) ??
    ({
      ...(existentes.get(id) ?? { product_id: id, material: null, familia: null, gramas: null, resto: null, custo_fixo: null }),
      atualizado_por: quem,
      atualizado_em: agora,
      ...(existentes.has(id) ? {} : { material: materialPeloNome(nome) }),
    } as LinhaDeCusto & { atualizado_por: string; atualizado_em: string });

  let ouro = 0;
  for (const o of d.ouro) {
    const p = idPorCodigo.get(o.trayId);
    if (!p) continue;
    const l = base(p.id, p.name);
    if (o.gramas !== null) l.gramas = o.gramas;
    if (o.resto !== null) l.resto = o.resto;
    linhas.set(p.id, l);
    ouro++;
  }
  let fixos = 0;
  for (const x of d.fixos) {
    const p = idPorCodigo.get(x.trayId);
    if (!p) continue;
    const l = base(p.id, p.name);
    l.custo_fixo = x.custo;
    linhas.set(p.id, l);
    fixos++;
  }

  const lote = Array.from(linhas.values());
  for (let i = 0; i < lote.length; i += 300) {
    const { error } = await db.from("produto_custos").upsert(lote.slice(i, i + 300), { onConflict: "product_id" });
    if (error) throw new ErroDeMargem(`Não deu para gravar os custos: ${error.message}`);
  }

  return { parametros: Object.keys(d.parametros).length, familias, ouro, fixos, naoAchados };
}
