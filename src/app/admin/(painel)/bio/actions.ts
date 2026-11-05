"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/session";
import { TAG_BIO } from "@/lib/bio/ler";
import { produtosDaVitrine } from "@/lib/bio/produtos";
import { bioDeFabrica, esquemaDaBio, esquemaDaFonte, type ProdutoDaBio } from "@/lib/bio/tipos";
import { conferirBio } from "@/lib/bio/conferir";

export type ResultadoDaBio = { ok: true } | { ok: false; erro: string };

export async function salvarBio(bruto: unknown): Promise<ResultadoDaBio> {
  const perfil = await requireStaff();

  const lido = esquemaDaBio.safeParse(bruto);
  if (!lido.success) {
    const campo = lido.error.issues[0]?.path.join(".") ?? "";
    return { ok: false, erro: `Tem um campo obrigatório vazio ou inválido${campo ? ` (${campo})` : ""}.` };
  }
  const bio = lido.data;

  // Regras da casa conferidas no servidor. Deixar só na tela seria conselho, e
  // conselho se contorna.
  const problema = conferirBio(bio);
  if (problema) return { ok: false, erro: problema };

  const supabase = await createClient();
  const { error } = await supabase.from("site_settings").upsert(
    { key: "pagina:bio", value: bio as unknown as Record<string, unknown>, updated_by: perfil.id },
    { onConflict: "key" },
  );
  if (error) return { ok: false, erro: error.message };

  // A tag derruba o JSON cacheado; o caminho derruba o HTML já pronto. Só a
  // tag deixaria a bio velha no ar até o ISR de cinco minutos vencer.
  revalidateTag(TAG_BIO);
  revalidatePath("/bio");
  return { ok: true };
}

/** Volta a bio à de fábrica. */
export async function restaurarBio(): Promise<ResultadoDaBio> {
  await requireStaff();
  return salvarBio(bioDeFabrica());
}

/** Produtos de uma vitrine para a prévia, com o mesmo preço ao vivo da página. */
export async function produtosParaPrevia(fonte: unknown, limite: number): Promise<ProdutoDaBio[]> {
  await requireStaff();
  const lida = esquemaDaFonte.safeParse(fonte);
  if (!lida.success) return [];
  return produtosDaVitrine(lida.data, Math.min(16, Math.max(2, Math.round(limite) || 8)));
}

export type ProdutoParaEscolher = {
  trayId: string;
  nome: string;
  imagem: string | null;
};

/**
 * Busca no espelho do catálogo para escolher produto à mão.
 *
 * Aqui pode ser o espelho (`products`), e não a loja ao vivo: o que se procura
 * é o NOME e o id. O preço que vai para a vitrine continua vindo da loja na hora
 * de servir a página.
 */
export async function procurarProdutos(termo: string): Promise<ProdutoParaEscolher[]> {
  await requireStaff();
  const busca = termo.trim().slice(0, 80);
  if (busca.length < 2) return [];

  const supabase = await createClient();
  let consulta = supabase
    .from("products")
    .select("tray_id, name, main_image_url")
    .eq("is_active", true)
    .limit(12);
  // Número puro é id da Tray, que é o que aparece no painel da loja.
  consulta = /^\d+$/.test(busca) ? consulta.eq("tray_id", busca) : consulta.ilike("name", `%${busca}%`);

  const { data } = await consulta;
  return ((data ?? []) as { tray_id: string; name: string; main_image_url: string | null }[]).map((p) => ({
    trayId: p.tray_id,
    nome: p.name,
    imagem: p.main_image_url,
  }));
}

/** Nome e foto dos produtos já escolhidos, na ordem da lista. */
export async function produtosEscolhidos(ids: string[]): Promise<ProdutoParaEscolher[]> {
  await requireStaff();
  const limpos = ids.filter((id) => /^\d+$/.test(id)).slice(0, 32);
  if (limpos.length === 0) return [];

  const supabase = await createClient();
  const { data } = await supabase.from("products").select("tray_id, name, main_image_url").in("tray_id", limpos);
  const porId = new Map(
    ((data ?? []) as { tray_id: string; name: string; main_image_url: string | null }[]).map((p) => [p.tray_id, p]),
  );
  return limpos.map((id) => {
    const p = porId.get(id);
    return { trayId: id, nome: p?.name ?? `Produto ${id}`, imagem: p?.main_image_url ?? null };
  });
}
