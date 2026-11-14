import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { miniaturaDaTray } from "@/lib/catalogo/fotos";
import { createAdminClient } from "@/lib/supabase/admin";
import { precoVigente } from "@/lib/tray/preco";
import { diasDeProducao, lerRegras, REGRAS_DE_PARTIDA, type RegrasDeEntrega } from "@/lib/vendas/prazos";

/**
 * Leitura e escrita da consulta do vendedor (0073).
 *
 * O produto e a loja vêm das tabelas públicas do catálogo (`products` e
 * `locations` abrem leitura para qualquer um, porque é o que o site mostra). A
 * pronta entrega vem de uma função do banco, que confere a área `consulta` e
 * traz o nome de quem informou. As regras do malote ficam em `site_settings`,
 * fechadas, e por isso são lidas com o cliente de serviço.
 */

export type ProdutoDaConsulta = {
  id: string;
  /** O código do produto na Tray, que é o que o time conhece. */
  codigo: string;
  nome: string;
  modelo: string | null;
  categoria: string | null;
  url: string | null;
  foto: string | null;
  miniatura: string | null;
  /** O que a loja cobra hoje. */
  preco: number | null;
  /** O preço cheio, só quando há promoção valendo. */
  precoCheio: number | null;
  desconto: number | null;
  /** A loja online está vendendo a peça. */
  disponivel: boolean;
  /** O texto de disponibilidade da loja ("Disponível em 2 dias úteis"). */
  disponibilidade: string | null;
  /** Os dias úteis de produção lidos desse texto. `null` quando a loja não diz. */
  diasUteis: number | null;
  vendidos: number;
};

export type LojaDaConsulta = {
  id: string;
  slug: string;
  nome: string;
  shopping: string | null;
  cidade: string | null;
  endereco: string | null;
  telefone: string | null;
  whatsapp: string | null;
  mapa: string | null;
};

export type Aviso = {
  loja: string;
  produto: string;
  tem: boolean;
  numeracoes: string | null;
  observacao: string | null;
  por: string | null;
  em: string;
};

const texto = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const um = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

const COLUNAS =
  "id, tray_id, name, url, status, price, promotional_price, main_image_url, availability_text, " +
  "modelo:raw->>model, vendidos:raw->>quantity_sold, inicio:raw->>start_promotion, fim:raw->>end_promotion, " +
  "categoria:categories!products_category_id_fkey(name)";

const PAGINA = 1000;

/** Todo produto ativo, do mais vendido para o menos. `null` quando a leitura falhou. */
export async function lerProdutosDaConsulta(db: SupabaseClient, hoje: string): Promise<ProdutoDaConsulta[] | null> {
  // O Supabase entrega no máximo mil linhas por pedido. As duas primeiras páginas saem juntas, que é o tamanho do catálogo hoje.
  const pagina = (n: number) => db.from("products").select(COLUNAS).eq("is_active", true).order("id").range(n * PAGINA, n * PAGINA + PAGINA - 1);
  const linhas: Record<string, unknown>[] = [];
  const primeiras = await Promise.all([pagina(0), pagina(1)]);
  for (const r of primeiras) {
    if (r.error) {
      console.error("[consulta] produtos:", r.error.message);
      return null;
    }
    linhas.push(...((r.data ?? []) as unknown as Record<string, unknown>[]));
  }
  for (let n = 2; linhas.length === n * PAGINA && n < 20; n++) {
    const r = await pagina(n);
    if (r.error) break;
    linhas.push(...((r.data ?? []) as unknown as Record<string, unknown>[]));
  }

  return linhas
    .map((p): ProdutoDaConsulta => {
      const preco = precoVigente(
        { price: p.price as number | null, promotional_price: p.promotional_price as number | null, start_promotion: texto(p.inicio), end_promotion: texto(p.fim) },
        hoje,
      );
      const disponibilidade = texto(p.availability_text);
      return {
        id: String(p.id),
        codigo: String(p.tray_id ?? ""),
        nome: texto(p.name) ?? "Produto sem nome",
        modelo: texto(p.modelo),
        categoria: texto(um(p.categoria as { name?: string } | { name?: string }[] | null)?.name),
        url: texto(p.url),
        foto: texto(p.main_image_url),
        miniatura: miniaturaDaTray(texto(p.main_image_url)),
        preco: preco.atual,
        precoCheio: preco.anterior,
        desconto: preco.desconto,
        disponivel: p.status === "available",
        disponibilidade,
        diasUteis: diasDeProducao(disponibilidade),
        vendidos: Number(p.vendidos) || 0,
      };
    })
    .sort((a, b) => Number(b.disponivel) - Number(a.disponivel) || b.vendidos - a.vendidos || a.nome.localeCompare(b.nome, "pt-BR"));
}

export async function lerLojasDaConsulta(db: SupabaseClient): Promise<LojaDaConsulta[]> {
  const { data, error } = await db
    .from("locations")
    .select("id, slug, name, mall_name, address, address_locality, phone, whatsapp, maps_url")
    .eq("status", "published")
    .order("sort_order");
  if (error) {
    console.error("[consulta] lojas:", error.message);
    return [];
  }
  return (data ?? []).map((l) => ({
    id: String(l.id),
    slug: String(l.slug),
    nome: texto(l.name) ?? "Loja",
    shopping: texto(l.mall_name),
    cidade: texto(l.address_locality),
    endereco: texto(l.address),
    telefone: texto(l.phone),
    whatsapp: texto(l.whatsapp),
    mapa: texto(l.maps_url),
  }));
}

/** O quadro de pronta entrega inteiro. Vazio quando a leitura falha: a consulta de produto continua valendo sem ele. */
export async function lerQuadro(db: SupabaseClient): Promise<Aviso[]> {
  const { data, error } = await db.rpc("quadro_de_pronta_entrega");
  if (error) {
    console.error("[consulta] quadro_de_pronta_entrega:", error.message);
    return [];
  }
  return (Array.isArray(data) ? (data as Record<string, unknown>[]) : []).map((a) => ({
    loja: String(a.loja),
    produto: String(a.produto),
    tem: a.tem === true,
    numeracoes: texto(a.numeracoes),
    observacao: texto(a.observacao),
    por: texto(a.por),
    em: String(a.em ?? ""),
  }));
}

const CHAVE_DAS_REGRAS = "vendas:entrega";

/** As regras do malote. Sem nada gravado, valem as de partida, e a tela avisa que falta confirmar. */
export async function lerRegrasDeEntrega(): Promise<RegrasDeEntrega> {
  try {
    const { data, error } = await createAdminClient().from("site_settings").select("value").eq("key", CHAVE_DAS_REGRAS).maybeSingle();
    if (error || !data) return REGRAS_DE_PARTIDA;
    return lerRegras(data.value);
  } catch {
    return REGRAS_DE_PARTIDA;
  }
}

export async function gravarRegrasDeEntrega(regras: RegrasDeEntrega, quem: string): Promise<string | null> {
  const { error } = await createAdminClient()
    .from("site_settings")
    .upsert({ key: CHAVE_DAS_REGRAS, value: regras, is_public: false, updated_by: quem }, { onConflict: "key" });
  return error ? error.message : null;
}

export async function informarProntaEntrega(
  db: SupabaseClient,
  a: { loja: string; produto: string; tem: boolean; numeracoes?: string; observacao?: string },
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const { error } = await db.rpc("informar_pronta_entrega", {
    p_loja: a.loja,
    p_produto: a.produto,
    p_tem: a.tem,
    p_numeracoes: a.numeracoes ?? null,
    p_observacao: a.observacao ?? null,
  });
  if (!error) return { ok: true };
  console.error("[consulta] informar_pronta_entrega:", error.message);
  // As mensagens da função já estão em português e são para a pessoa ler.
  const conhecida = /consulta|loja|produto|longo|peça/i.test(error.message);
  return { ok: false, erro: conhecida ? error.message : "Não deu para gravar agora. Tente de novo em alguns segundos." };
}
