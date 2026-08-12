import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { lerCatalogoPublico, categoriasDoCatalogo, type ProdutoPublico } from "./publico";

/**
 * Sincronização do catálogo da Tray para o Supabase. Somente leitura na loja.
 *
 * Usa a API pública de busca (/web_api/search), que não exige credencial,
 * aplicativo aprovado nem instalação. Isso permite ter o catálogo no portal
 * hoje. Quando as credenciais da API autenticada existirem, dá para
 * complementar com variações por SKU (ver src/lib/tray/cliente.ts).
 *
 * Regras que valem sempre:
 * - Gravação por upsert em `tray_id`, então reimportar nunca duplica.
 * - Payload bruto preservado em `raw`, separado dos campos normalizados.
 * - Produto que sumiu da loja é DESATIVADO, nunca apagado, para não perder
 *   histórico nem quebrar link em conteúdo publicado.
 * - Preço e disponibilidade são espelho. Quem manda é a Tray.
 */

export type ResultadoSync = {
  ok: boolean;
  categorias: number;
  produtos: number;
  atributos: number;
  desativados: number;
  /** Quantos produtos a loja devolveu mas não conseguimos gravar. */
  falhas: number;
  /** Primeiro erro de gravação, para dar pista do que investigar. */
  primeiroErro?: string | null;
  erro?: string;
  duracaoMs: number;
};

function slugificar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

/** Propriedades da Tray (Largura, Acabamento, Conforto) viram variação única. */
function resumoDasPropriedades(p: ProdutoPublico) {
  const pegar = (...nomes: string[]) => {
    for (const n of nomes) {
      const chave = Object.keys(p.propriedades).find(
        (k) => k.toLowerCase() === n.toLowerCase(),
      );
      if (chave) return p.propriedades[chave][0] ?? null;
    }
    return null;
  };

  const largura = pegar("Largura");
  const larguraMm = largura ? Number(largura.replace(/[^\d.,]/g, "").replace(",", ".")) : null;

  return {
    largura_mm: Number.isFinite(larguraMm as number) ? larguraMm : null,
    material: pegar("Material", "Metal"),
    acabamento: pegar("Acabamento"),
  };
}

export async function sincronizarCatalogo(): Promise<ResultadoSync> {
  const inicio = Date.now();
  const vazio: ResultadoSync = {
    ok: false, categorias: 0, produtos: 0, atributos: 0, desativados: 0, falhas: 0, duracaoMs: 0,
  };

  const supabase = createAdminClient();

  const registrar = async (r: Partial<ResultadoSync> & { status: string; erro?: string }) => {
    await supabase.from("sync_logs").insert({
      source: "tray",
      operation: "catalogo_publico",
      status: r.status,
      attempted: (r.produtos ?? 0) + (r.categorias ?? 0),
      succeeded: (r.produtos ?? 0) + (r.categorias ?? 0),
      failed: r.falhas ?? (r.status === "error" ? 1 : 0),
      error: r.erro ?? r.primeiroErro ?? null,
      started_at: new Date(inicio).toISOString(),
      finished_at: new Date().toISOString(),
      payload: {
        categorias: r.categorias ?? 0,
        produtos: r.produtos ?? 0,
        desativados: r.desativados ?? 0,
        falhas: r.falhas ?? 0,
      },
    });
  };

  try {
    const { produtos } = await lerCatalogoPublico();
    if (produtos.length === 0) {
      const erro = "A loja não devolveu nenhum produto.";
      await registrar({ status: "error", erro });
      return { ...vazio, erro, duracaoMs: Date.now() - inicio };
    }

    const agora = new Date().toISOString();

    /* ------------------------------------------------------- categorias */
    const categorias = categoriasDoCatalogo(produtos);
    const mapaCategoria = new Map<string, string>();

    for (const c of categorias) {
      const { data } = await supabase
        .from("categories")
        .upsert(
          {
            tray_id: c.id,
            name: c.nome,
            canonical_name: c.nome,
            slug: slugificar(c.nome),
            is_active: true,
            last_synced_at: agora,
          },
          { onConflict: "tray_id" },
        )
        .select("id")
        .single();
      if (data?.id) mapaCategoria.set(c.id, data.id as string);
    }

    /* ---------------------------------------------------------- produtos */
    const vistos = new Set<string>();
    let atributos = 0;
    let falhas = 0;
    let primeiroErro: string | null = null;

    for (const p of produtos) {
      vistos.add(p.id);

      const { data, error: erroProduto } = await supabase
        .from("products")
        .upsert(
          {
            tray_id: p.id,
            name: p.nome,
            slug: p.slug ? slugificar(p.slug) : slugificar(p.nome),
            url: p.url,
            category_id: p.categoriaId ? (mapaCategoria.get(p.categoriaId) ?? null) : null,
            status: p.disponivel ? "available" : "unavailable",
            main_image_url: p.imagem,
            description: p.descricao,
            brand: p.marca ?? "JK Alianças",
            price: p.preco,
            promotional_price: p.precoPromocional,
            availability_text: p.prazo,
            is_active: true,
            raw: p.bruto,
            last_synced_at: agora,
          },
          { onConflict: "tray_id" },
        )
        .select("id")
        .single();

      if (erroProduto || !data?.id) {
        // Nunca engolir a falha: sem isso, produto some da sincronização e
        // ninguém fica sabendo (foi o que aconteceu com 467 produtos).
        falhas++;
        if (!primeiroErro && erroProduto) {
          primeiroErro = `${p.nome}: ${erroProduto.message}`;
        }
        continue;
      }
      const produtoUuid = data.id as string;

      // O preço vem do produto, e o promocional vence quando existe.
      const preco = p.precoPromocional ?? p.preco;
      const resumo = resumoDasPropriedades(p);

      const { error: erroVariacao } = await supabase.from("product_variants").upsert(
        {
          product_id: produtoUuid,
          tray_variant_id: `pub-${p.id}`,
          sku: p.referencia,
          material: resumo.material,
          width_mm: resumo.largura_mm,
          price: preco,
          is_active: p.disponivel,
          raw: { propriedades: p.propriedades, prazo: p.prazo, acabamento: resumo.acabamento },
          last_synced_at: agora,
        },
        { onConflict: "tray_variant_id" },
      );
      if (!erroVariacao) atributos++;
    }

    /* ------------------------------------------- desativar o que sumiu */
    let desativados = 0;
    const { data: existentes } = await supabase
      .from("products")
      .select("id, tray_id")
      .eq("is_active", true);

    for (const e of (existentes ?? []) as { id: string; tray_id: string }[]) {
      if (vistos.has(e.tray_id)) continue;
      await supabase
        .from("products")
        .update({ is_active: false, last_synced_at: agora })
        .eq("id", e.id);
      desativados++;
    }

    const resultado: ResultadoSync = {
      ok: true,
      categorias: categorias.length,
      produtos: produtos.length - falhas,
      falhas,
      primeiroErro,
      atributos,
      desativados,
      duracaoMs: Date.now() - inicio,
    };
    await registrar({ ...resultado, status: "success" });
    return resultado;
  } catch (e) {
    const erro = e instanceof Error ? e.message : "Falha desconhecida na sincronização.";
    await registrar({ status: "error", erro });
    return { ...vazio, erro, duracaoMs: Date.now() - inicio };
  }
}
