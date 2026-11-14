import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { precoVigente } from "@/lib/tray/preco";
import type { PedidoDeFoto } from "./planilha-tray";
import type { EstadoDaFoto, EstadoDoProduto, TipoDeFoto } from "./estados";

/**
 * O núcleo das fotos novas do catálogo.
 *
 * São três portas para o mesmo trabalho: a gaveta do produto no painel, o
 * conector do Claude (claude.ai com o Magnific) e a sincronização da Tray, que
 * dá baixa no que entrou na loja. Cada regra mora aqui uma vez, e as portas
 * chamam. O estado do PRODUTO não é escrito por ninguém daqui: quem mantém é o
 * gatilho de `produto_fotos` (migration 0047), para sair igual de toda porta.
 *
 * Aprovar é de gente. O conector envia, lista e dispensa, mas não aprova: a
 * aprovação é a conferência de que a IA não mudou a peça (pedra, largura, cor
 * do metal), e foto que mostra outra peça é oferta enganosa.
 */

export class ErroDeFoto extends Error {}

const PAGINA = 1000;

/** Abaixo disso a loja mostra a foto borrada no zoom. */
export const LARGURA_MINIMA = 800;

export type ProdutoBasico = {
  id: string;
  tray_id: string;
  name: string;
  url: string | null;
  main_image_url: string | null;
  category_id: string | null;
};

export type ItemDoCatalogo = {
  id: string;
  trayId: string;
  nome: string;
  url: string | null;
  categoriaId: string | null;
  categoria: string;
  preco: number | null;
  precoAntes: number | null;
  disponivel: boolean;
  vendidos: number;
  miniatura: string | null;
  imagem: string | null;
  estado: EstadoDoProduto;
  nota: string | null;
  reservadoAte: string | null;
};

export type FotoDoProduto = {
  id: string;
  tipo: TipoDeFoto;
  status: EstadoDaFoto;
  url: string;
  largura: number | null;
  altura: number | null;
  nota: string | null;
  comoFoiFeita: string | null;
  origem: "painel" | "conector";
  enviadaPor: string | null;
  revisadaPor: string | null;
  criadaEm: string;
  revisadaEm: string | null;
  exportadaEm: string | null;
  naLojaEm: string | null;
};

/**
 * Miniatura que a própria Tray gera: mesmo caminho, com "90_" na frente do
 * nome do arquivo. Leve o bastante para mil linhas numa tela.
 */
export function miniaturaDaTray(url: string | null): string | null {
  if (!url || !url.includes("images.tcdn.com.br/img/img_prod/")) return url;
  const i = url.lastIndexOf("/");
  return `${url.slice(0, i + 1)}90_${url.slice(i + 1)}`;
}

const um = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "produto";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ------------------------------------------------------------------ produto

/** Aceita o id do portal ou o "Código produto" da Tray (é o que aparece no painel da loja). */
export async function acharProduto(db: SupabaseClient, ref: string): Promise<ProdutoBasico> {
  const chave = ref.trim();
  const { data, error } = await db
    .from("products")
    .select("id, tray_id, name, url, main_image_url, category_id")
    .eq(UUID.test(chave) ? "id" : "tray_id", chave)
    .maybeSingle();
  if (error) throw new ErroDeFoto(`Falhou a busca do produto: ${error.message}`);
  if (!data) throw new ErroDeFoto(`Produto ${chave} não encontrado.`);
  return data as ProdutoBasico;
}

// ------------------------------------------------------------------ lista

type LinhaDaLista = {
  id: string;
  tray_id: string;
  name: string;
  url: string | null;
  status: string | null;
  price: number | null;
  promotional_price: number | null;
  main_image_url: string | null;
  vendidos: string | null;
  inicio: string | null;
  fim: string | null;
  categoria: { id: string; name: string } | { id: string; name: string }[] | null;
  fila:
    | { status: EstadoDoProduto; nota: string | null; reservado_ate: string | null }
    | { status: EstadoDoProduto; nota: string | null; reservado_ate: string | null }[]
    | null;
};

/** O catálogo ativo inteiro, já com preço do dia e estado de foto. */
export async function listarCatalogo(db: SupabaseClient): Promise<ItemDoCatalogo[]> {
  const pagina = (i: number) =>
    db
      .from("products")
      .select(
        "id, tray_id, name, url, status, price, promotional_price, main_image_url, " +
          "vendidos:raw->>quantity_sold, inicio:raw->>start_promotion, fim:raw->>end_promotion, " +
          "categoria:categories!products_category_id_fkey(id, name), " +
          "fila:produto_foto_fila(status, nota, reservado_ate)",
      )
      .eq("is_active", true)
      .order("id")
      .range(i * PAGINA, (i + 1) * PAGINA - 1);

  // As páginas saem de duas em duas, ao mesmo tempo. O catálogo tem pouco mais
  // de mil produtos e o Supabase entrega mil por pedido: em fila, a segunda
  // página só era pedida depois de a primeira chegar inteira.
  const linhas: LinhaDaLista[] = [];
  for (let i = 0; ; i += 2) {
    const par = await Promise.all([pagina(i), pagina(i + 1)]);
    for (const { data, error } of par) {
      if (error) throw new ErroDeFoto(`Não deu para ler o catálogo: ${error.message}`);
      linhas.push(...((data ?? []) as unknown as LinhaDaLista[]));
    }
    if ((par[1].data ?? []).length < PAGINA) break;
  }

  return linhas.map((p) => {
    const v = precoVigente({ price: p.price, promotional_price: p.promotional_price, start_promotion: p.inicio, end_promotion: p.fim });
    const cat = um(p.categoria);
    const fila = um(p.fila);
    return {
      id: p.id,
      trayId: p.tray_id,
      nome: p.name,
      url: p.url,
      categoriaId: cat?.id ?? null,
      categoria: cat?.name ?? "Sem categoria",
      preco: v.atual,
      precoAntes: v.anterior,
      disponivel: p.status === "available",
      vendidos: Number(p.vendidos) || 0,
      miniatura: miniaturaDaTray(p.main_image_url),
      imagem: p.main_image_url,
      estado: fila?.status ?? "falta",
      nota: fila?.nota ?? null,
      reservadoAte: fila?.reservado_ate && new Date(fila.reservado_ate) > new Date() ? fila.reservado_ate : null,
    };
  });
}

/**
 * Os próximos da fila, para quem vai gerar. Refazer vem antes de falta (alguém
 * já começou aquele), e dentro de cada um, o que mais vende primeiro. Produto
 * reservado por outra pessoa fica de fora até a reserva vencer.
 */
export async function proximosDaFila(
  db: SupabaseClient,
  opcoes: { categoriaId?: string | null; limite: number; soDisponiveis: boolean; estados: EstadoDoProduto[] },
): Promise<{ itens: ItemDoCatalogo[]; restantes: number }> {
  const todos = await listarCatalogo(db);
  const peso = (e: EstadoDoProduto) => opcoes.estados.indexOf(e);
  const elegiveis = todos
    .filter((p) => opcoes.estados.includes(p.estado))
    .filter((p) => !p.reservadoAte)
    .filter((p) => !opcoes.soDisponiveis || p.disponivel)
    .filter((p) => !opcoes.categoriaId || p.categoriaId === opcoes.categoriaId)
    .sort((a, b) => peso(a.estado) - peso(b.estado) || b.vendidos - a.vendidos);
  return { itens: elegiveis.slice(0, opcoes.limite), restantes: Math.max(0, elegiveis.length - opcoes.limite) };
}

/** Segura os produtos para quem pegou, para outra pessoa não gerar o mesmo. */
export async function reservar(db: SupabaseClient, ids: string[], quem: string, minutos = 30) {
  if (!ids.length) return;
  const ate = new Date(Date.now() + minutos * 60_000).toISOString();
  // Só as colunas da reserva: em linha que já existe o estado não muda, e linha
  // nova nasce com o padrão "falta".
  const { error } = await db
    .from("produto_foto_fila")
    .upsert(ids.map((product_id) => ({ product_id, reservado_por: quem, reservado_ate: ate })), { onConflict: "product_id" });
  if (error) throw new ErroDeFoto(`Não deu para reservar: ${error.message}`);
}

// ------------------------------------------------------------------ fotos de um produto

export async function fotosDoProduto(db: SupabaseClient, productId: string): Promise<FotoDoProduto[]> {
  const { data, error } = await db
    .from("produto_fotos")
    .select(
      "id, tipo, status, url, largura, altura, nota, como_foi_feita, origem, enviada_por, revisada_por, criada_em, revisada_em, exportada_em, na_loja_em",
    )
    .eq("product_id", productId)
    .order("criada_em", { ascending: false });
  if (error) throw new ErroDeFoto(`Não deu para ler as fotos: ${error.message}`);
  const fotos = data ?? [];

  const pessoas = Array.from(new Set(fotos.flatMap((f) => [f.enviada_por, f.revisada_por]).filter(Boolean))) as string[];
  const nomes = new Map<string, string>();
  if (pessoas.length) {
    const { data: perfis } = await db.from("profiles").select("id, full_name, email").in("id", pessoas);
    for (const p of perfis ?? []) nomes.set(p.id, p.full_name || p.email || "Alguém da equipe");
  }

  return fotos.map((f) => ({
    id: f.id,
    tipo: f.tipo,
    status: f.status,
    url: f.url,
    largura: f.largura,
    altura: f.altura,
    nota: f.nota,
    comoFoiFeita: f.como_foi_feita,
    origem: f.origem,
    enviadaPor: f.enviada_por ? (nomes.get(f.enviada_por) ?? null) : null,
    revisadaPor: f.revisada_por ? (nomes.get(f.revisada_por) ?? null) : null,
    criadaEm: f.criada_em,
    revisadaEm: f.revisada_em,
    exportadaEm: f.exportada_em,
    naLojaEm: f.na_loja_em,
  }));
}

// ------------------------------------------------------------------ guardar

/**
 * Guarda a foto como JPEG, e não WebP como o resto do painel: o destino é a
 * Tray, que baixa a imagem pelo endereço na importação, e JPEG é o formato que
 * qualquer loja aceita. Quadrada ou não, no máximo 2000 px no lado maior, sem
 * transparência (PNG com fundo transparente ganharia fundo preto no JPEG, então
 * o fundo vira branco antes).
 */
export async function guardarFotoDeBytes(
  db: SupabaseClient,
  a: {
    produto: ProdutoBasico;
    bytes: Buffer;
    tipo: TipoDeFoto;
    origem: "painel" | "conector";
    comoFoiFeita?: string | null;
    quem: string | null;
  },
): Promise<{ id: string; url: string; largura: number; altura: number }> {
  const sharp = (await import("sharp")).default;
  const { data, info } = await sharp(a.bytes, { failOn: "none" })
    .rotate()
    .flatten({ background: "#ffffff" })
    .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });

  if (Math.max(info.width, info.height) < LARGURA_MINIMA) {
    throw new ErroDeFoto(
      `A foto tem ${info.width} x ${info.height} px. A loja precisa de pelo menos ${LARGURA_MINIMA} px no lado maior para o zoom não borrar.`,
    );
  }

  const caminho = `produtos/${a.produto.tray_id}/${slug(a.produto.name)}-${a.tipo}-${Date.now()}.jpg`;
  const up = await db.storage.from("media").upload(caminho, data, {
    contentType: "image/jpeg",
    cacheControl: "31536000",
    upsert: false,
  });
  if (up.error) throw new ErroDeFoto(`Não deu para guardar a foto: ${up.error.message}`);
  const url = db.storage.from("media").getPublicUrl(caminho).data.publicUrl;

  const { data: foto, error } = await db
    .from("produto_fotos")
    .insert({
      product_id: a.produto.id,
      tipo: a.tipo,
      url,
      storage_path: caminho,
      largura: info.width,
      altura: info.height,
      bytes: data.length,
      como_foi_feita: a.comoFoiFeita?.trim().slice(0, 2000) || null,
      origem: a.origem,
      enviada_por: a.quem,
    })
    .select("id")
    .single();
  if (error) throw new ErroDeFoto(`A foto subiu, mas não deu para registrar: ${error.message}`);
  return { id: foto.id, url, largura: info.width, altura: info.height };
}

/**
 * Registra a foto que o navegador já converteu e subiu direto para o storage
 * (o arquivo de IA passa fácil de 1 MB, que é o teto de uma Server Action).
 */
export async function registrarFotoEnviada(
  db: SupabaseClient,
  a: {
    productId: string;
    caminho: string;
    largura: number;
    altura: number;
    bytes: number;
    tipo: TipoDeFoto;
    comoFoiFeita?: string | null;
    quem: string | null;
  },
): Promise<{ id: string }> {
  const produto = await acharProduto(db, a.productId);
  const prefixo = `produtos/${produto.tray_id}/`;
  if (!a.caminho.startsWith(prefixo) || !a.caminho.endsWith(".jpg") || a.caminho.includes("..")) {
    throw new ErroDeFoto("Caminho de arquivo inesperado para este produto.");
  }
  if (Math.max(a.largura, a.altura) < LARGURA_MINIMA) {
    throw new ErroDeFoto(`A foto tem ${a.largura} x ${a.altura} px. O mínimo é ${LARGURA_MINIMA} px no lado maior.`);
  }
  const url = db.storage.from("media").getPublicUrl(a.caminho).data.publicUrl;
  const { data, error } = await db
    .from("produto_fotos")
    .insert({
      product_id: produto.id,
      tipo: a.tipo,
      url,
      storage_path: a.caminho,
      largura: a.largura,
      altura: a.altura,
      bytes: a.bytes,
      como_foi_feita: a.comoFoiFeita?.trim().slice(0, 2000) || null,
      origem: "painel",
      enviada_por: a.quem,
    })
    .select("id")
    .single();
  if (error) throw new ErroDeFoto(`Não deu para registrar a foto: ${error.message}`);
  return { id: data.id };
}

// ------------------------------------------------------------------ decidir

export async function decidirFoto(
  db: SupabaseClient,
  a: { fotoId: string; aprovar: boolean; nota?: string | null; quem: string },
): Promise<{ productId: string }> {
  const { data: f, error } = await db
    .from("produto_fotos")
    .select("id, product_id, tipo, status")
    .eq("id", a.fotoId)
    .maybeSingle();
  if (error) throw new ErroDeFoto(error.message);
  if (!f) throw new ErroDeFoto("Foto não encontrada.");
  if (!["aguardando", "aprovada"].includes(f.status)) {
    throw new ErroDeFoto("Essa foto já foi decidida. Para mudar, envie outra.");
  }

  const nota = a.nota?.trim() ?? "";
  if (!a.aprovar && nota.length < 3) {
    throw new ErroDeFoto("Diga o que refazer. A nota é o que orienta a próxima foto.");
  }

  const agora = new Date().toISOString();
  const r = await db
    .from("produto_fotos")
    .update(
      a.aprovar
        ? { status: "aprovada", revisada_por: a.quem, revisada_em: agora, nota: null }
        : { status: "recusada", revisada_por: a.quem, revisada_em: agora, nota: nota.slice(0, 500) },
    )
    .eq("id", f.id);
  if (r.error) throw new ErroDeFoto(r.error.message);

  // Aprovou uma foto: as outras do mesmo tipo que ainda não foram para a loja
  // saem de cena (é comum gerar duas versões e escolher uma). Cada posição da
  // loja (produto, face, uso) tem uma foto só.
  if (a.aprovar) {
    const s = await db
      .from("produto_fotos")
      .update({ status: "substituida" })
      .eq("product_id", f.product_id)
      .eq("tipo", f.tipo)
      .in("status", ["aguardando", "aprovada"])
      .neq("id", f.id);
    if (s.error) throw new ErroDeFoto(s.error.message);
  }

  return { productId: f.product_id };
}

/** Produto que não precisa de foto nova (caixinha, peça que vai sair de linha). */
export async function dispensarProduto(db: SupabaseClient, productId: string, motivo: string, quem: string) {
  const { error } = await db.from("produto_foto_fila").upsert(
    {
      product_id: productId,
      status: "dispensada",
      nota: motivo.trim().slice(0, 500) || null,
      atualizado_por: quem,
      atualizado_em: new Date().toISOString(),
      reservado_por: null,
      reservado_ate: null,
    },
    { onConflict: "product_id" },
  );
  if (error) throw new ErroDeFoto(error.message);
}

/** Desfaz o "dispensar": o estado volta a ser o que as fotos dizem. */
export async function devolverParaFila(db: SupabaseClient, productId: string, quem: string) {
  const { data } = await db
    .from("produto_fotos")
    .select("status, nota, revisada_em, criada_em")
    .eq("product_id", productId)
    .neq("status", "substituida")
    .order("criada_em", { ascending: false });
  const fotos = data ?? [];
  const tem = (s: string) => fotos.some((f) => f.status === s);
  const estado: EstadoDoProduto = tem("aguardando")
    ? "aguardando"
    : tem("aprovada")
      ? "aprovada"
      : tem("na_loja")
        ? "na_loja"
        : tem("recusada")
          ? "refazer"
          : "falta";
  const nota = estado === "refazer" ? (fotos.find((f) => f.status === "recusada")?.nota ?? null) : null;
  const { error } = await db.from("produto_foto_fila").upsert(
    { product_id: productId, status: estado, nota, atualizado_por: quem, atualizado_em: new Date().toISOString() },
    { onConflict: "product_id" },
  );
  if (error) throw new ErroDeFoto(error.message);
}

// ------------------------------------------------------------------ padrão

export type Padroes = {
  geral: string;
  porCategoria: Record<string, { instrucoes: string; referenciaUrl: string | null }>;
};

export async function lerPadroes(db: SupabaseClient): Promise<Padroes> {
  const { data } = await db.from("foto_padroes").select("category_id, instrucoes, referencia_url");
  const p: Padroes = { geral: "", porCategoria: {} };
  for (const l of data ?? []) {
    if (l.category_id) p.porCategoria[l.category_id] = { instrucoes: l.instrucoes, referenciaUrl: l.referencia_url };
    else p.geral = l.instrucoes;
  }
  return p;
}

export async function salvarPadrao(
  db: SupabaseClient,
  a: { categoryId: string | null; instrucoes: string; referenciaUrl?: string | null; quem: string },
) {
  const texto = a.instrucoes.trim();
  if (texto.length < 10) throw new ErroDeFoto("O padrão precisa dizer como a foto deve ficar.");
  if (texto.length > 4000) throw new ErroDeFoto("O padrão passou de 4.000 caracteres.");
  const linha = {
    category_id: a.categoryId,
    instrucoes: texto,
    referencia_url: a.referenciaUrl?.trim() || null,
    atualizado_por: a.quem,
    atualizado_em: new Date().toISOString(),
  };
  let q = db.from("foto_padroes").select("id");
  q = a.categoryId ? q.eq("category_id", a.categoryId) : q.is("category_id", null);
  const { data: existe } = await q.maybeSingle();
  const r = existe
    ? await db.from("foto_padroes").update(linha).eq("id", existe.id)
    : await db.from("foto_padroes").insert(linha);
  if (r.error) throw new ErroDeFoto(r.error.message);
}

// ------------------------------------------------------------------ planilha

/**
 * O que vai para a planilha: toda foto aprovada, inclusive a que já saiu numa
 * planilha anterior e ainda não apareceu na loja (a pessoa pode ter baixado e
 * não importado). Repetir a mesma imagem na importação não estraga nada.
 */
export type PedidoComFotos = PedidoDeFoto & { fotoIds: string[] };

export async function pedidosDaPlanilha(db: SupabaseClient): Promise<{ pedidos: PedidoComFotos[] }> {
  const { data, error } = await db
    .from("produto_fotos")
    .select("id, tipo, url, criada_em, product_id, produto:products!inner(tray_id, name, price, promotional_price, is_active)")
    .eq("status", "aprovada")
    .order("criada_em", { ascending: false });
  if (error) throw new ErroDeFoto(`Não deu para ler as fotos aprovadas: ${error.message}`);

  const porProduto = new Map<string, PedidoComFotos>();
  for (const f of data ?? []) {
    const p = um(f.produto as unknown as { tray_id: string; name: string; price: number | null; promotional_price: number | null; is_active: boolean });
    if (!p) continue;
    let pedido = porProduto.get(f.product_id);
    if (!pedido) {
      pedido = { codigo: p.tray_id, nome: p.name, preco: p.price, precoPromocional: p.promotional_price, naLoja: {}, fotoIds: [] };
      porProduto.set(f.product_id, pedido);
    }
    // A lista vem da mais nova para a mais velha: fica a primeira de cada tipo.
    const tipo = f.tipo as "produto" | "face" | "uso";
    if (pedido[tipo]) continue;
    pedido[tipo] = f.url;
    pedido.fotoIds.push(f.id);
  }

  // As fotos novas que a loja já mostra, por posição: trocar só a face de um
  // produto refeito mantém o produto e o uso onde estão.
  if (porProduto.size) {
    const { data: naLoja } = await db
      .from("produto_fotos")
      .select("product_id, tipo, url")
      .eq("status", "na_loja")
      .in("product_id", Array.from(porProduto.keys()))
      .order("na_loja_em", { ascending: false });
    for (const f of naLoja ?? []) {
      const ja = porProduto.get(f.product_id)?.naLoja;
      const tipo = f.tipo as "produto" | "face" | "uso";
      if (ja && !ja[tipo]) ja[tipo] = f.url;
    }
  }

  return { pedidos: Array.from(porProduto.values()) };
}

/**
 * Marca as fotos que saíram na planilha e guarda a imagem que a loja mostrava
 * NESTE momento. É a comparação com ela que, na sincronização, diz que a foto
 * nova entrou. Só grava a imagem na primeira exportação: numa segunda, depois
 * da importação, ela já seria a foto nova e a baixa nunca aconteceria.
 */
export async function marcarExportadas(db: SupabaseClient, fotoIds: string[]): Promise<number> {
  if (!fotoIds.length) return 0;
  const { data: fotos, error } = await db
    .from("produto_fotos")
    .select("id, product_id, imagem_da_loja_ao_exportar, produto:products!inner(main_image_url)")
    .in("id", fotoIds)
    .eq("status", "aprovada");
  if (error) throw new ErroDeFoto(error.message);

  // A imagem de comparação ANTES da data de exportação: a sincronização só olha
  // foto exportada, e com a data gravada e a imagem ainda nula ela daria baixa
  // em tudo no intervalo. Produto sem imagem na loja fica com nulo, e a baixa
  // acontece quando a primeira imagem aparecer.
  for (const f of fotos ?? []) {
    if (f.imagem_da_loja_ao_exportar) continue;
    const imagem = um(f.produto as unknown as { main_image_url: string | null })?.main_image_url ?? null;
    if (imagem) await db.from("produto_fotos").update({ imagem_da_loja_ao_exportar: imagem }).eq("id", f.id);
  }

  const r = await db
    .from("produto_fotos")
    .update({ exportada_em: new Date().toISOString() })
    .in("id", fotoIds)
    .eq("status", "aprovada");
  if (r.error) throw new ErroDeFoto(r.error.message);
  return (fotos ?? []).length;
}
