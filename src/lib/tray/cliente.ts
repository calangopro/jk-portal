import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Cliente da API da Tray. Somente leitura.
 *
 * A Tray é a fonte de verdade de preço, estoque, disponibilidade e checkout.
 * O portal apenas espelha o catálogo para poder ligar conteúdo a produto e
 * emitir schema com dado real. Nada aqui escreve de volta na loja.
 *
 * Credenciais ficam só no servidor, sem prefixo NEXT_PUBLIC_:
 *   TRAY_API_URL, TRAY_CONSUMER_KEY, TRAY_CONSUMER_SECRET, TRAY_CODE
 */

export type TrayProduto = {
  id: string;
  name: string;
  slug: string | null;
  url: string | null;
  category_id: string | null;
  available: boolean;
  active: boolean;
  image: string | null;
  description: string | null;
  price: number | null;
  stock: number | null;
  bruto: Record<string, unknown>;
};

export type TrayCategoria = {
  id: string;
  name: string;
  slug: string | null;
  parent_id: string | null;
  url: string | null;
  position: number | null;
  active: boolean;
};

export type TrayVariacao = {
  id: string;
  product_id: string;
  sku: string | null;
  price: number | null;
  stock: number | null;
  atributos: Record<string, string>;
  bruto: Record<string, unknown>;
};

export class TraySemCredenciais extends Error {
  constructor() {
    super(
      "Faltam as credenciais da Tray no servidor. Configure TRAY_API_URL, TRAY_CONSUMER_KEY, TRAY_CONSUMER_SECRET e TRAY_CODE.",
    );
    this.name = "TraySemCredenciais";
  }
}

function numeroOuNulo(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function texto(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

export class TrayCliente {
  private baseUrl: string;
  private consumerKey: string;
  private consumerSecret: string;
  private code: string;
  private accessToken: string | null = null;

  constructor() {
    const url = process.env.TRAY_API_URL;
    const key = process.env.TRAY_CONSUMER_KEY;
    const secret = process.env.TRAY_CONSUMER_SECRET;
    const code = process.env.TRAY_CODE;
    if (!url || !key || !secret || !code) throw new TraySemCredenciais();

    this.baseUrl = url.replace(/\/+$/, "");
    this.consumerKey = key;
    this.consumerSecret = secret;
    this.code = code;
  }

  /**
   * Devolve um access_token válido.
   *
   * A Tray entrega um token com prazo de validade e um refresh_token. Guardamos
   * os dois em integration_tokens (tabela sem policy, só a service_role lê) e
   * só pedimos token novo quando o atual está perto de vencer. Trocar o `code`
   * por token a cada chamada não funciona, porque o code é de uso único por
   * instalação.
   */
  private async autenticar(): Promise<string> {
    if (this.accessToken) return this.accessToken;

    const supabase = createAdminClient();
    const { data: guardado } = await supabase
      .from("integration_tokens")
      .select("access_token, refresh_token, expires_at")
      .eq("provider", "tray")
      .maybeSingle();

    const margemMs = 5 * 60_000; // renova 5 minutos antes de vencer
    const aindaVale =
      guardado?.access_token &&
      guardado.expires_at &&
      new Date(guardado.expires_at).getTime() - margemMs > Date.now();

    if (aindaVale) {
      this.accessToken = guardado.access_token as string;
      return this.accessToken;
    }

    // Com refresh_token na mão, renova. Sem ele, faz a troca inicial pelo code.
    const refresh = guardado?.refresh_token as string | undefined;
    const dados = refresh
      ? await this.renovar(refresh)
      : await this.trocarCodePorToken();

    await supabase.from("integration_tokens").upsert(
      {
        provider: "tray",
        access_token: dados.access_token,
        refresh_token: dados.refresh_token ?? refresh ?? null,
        expires_at: dados.expira_em,
      },
      { onConflict: "provider" },
    );

    this.accessToken = dados.access_token;
    return this.accessToken;
  }

  private interpretar(bruto: Record<string, unknown>): {
    access_token: string;
    refresh_token?: string;
    expira_em: string;
  } {
    const token = bruto.access_token as string | undefined;
    if (!token) throw new Error("A Tray não devolveu access_token.");

    // A Tray informa a expiração como data. Se vier ausente, assume 1 hora.
    const dataBruta =
      (bruto.date_expiration_access_token as string | undefined) ??
      (bruto.expires_at as string | undefined);
    const expira = dataBruta ? new Date(dataBruta.replace(" ", "T")) : null;
    const valida = expira && !Number.isNaN(expira.getTime()) ? expira : new Date(Date.now() + 3600_000);

    return {
      access_token: token,
      refresh_token: bruto.refresh_token as string | undefined,
      expira_em: valida.toISOString(),
    };
  }

  private async trocarCodePorToken() {
    const resp = await fetch(`${this.baseUrl}/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        consumer_key: this.consumerKey,
        consumer_secret: this.consumerSecret,
        code: this.code,
      }),
      cache: "no-store",
    });

    if (!resp.ok) {
      throw new Error(
        `A Tray recusou a autenticação (status ${resp.status}). Confira consumer_key, consumer_secret e code, e se o aplicativo continua instalado na loja.`,
      );
    }
    return this.interpretar((await resp.json()) as Record<string, unknown>);
  }

  private async renovar(refreshToken: string) {
    const url = new URL(`${this.baseUrl}/auth`);
    url.searchParams.set("refresh_token", refreshToken);

    const resp = await fetch(url.toString(), { method: "GET", cache: "no-store" });

    // Refresh vencido ou revogado: volta para a troca pelo code.
    if (!resp.ok) return this.trocarCodePorToken();

    return this.interpretar((await resp.json()) as Record<string, unknown>);
  }

  private async buscar<T>(caminho: string, params: Record<string, string | number> = {}): Promise<T> {
    const token = await this.autenticar();
    const url = new URL(`${this.baseUrl}${caminho}`);
    url.searchParams.set("access_token", token);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));

    const resp = await fetch(url.toString(), { cache: "no-store" });
    if (!resp.ok) throw new Error(`Tray respondeu ${resp.status} em ${caminho}.`);
    return (await resp.json()) as T;
  }

  /** Percorre todas as páginas de um recurso. */
  private async todasAsPaginas<TBruto>(
    caminho: string,
    chave: string,
    porPagina = 50,
    limitePaginas = 60,
  ): Promise<TBruto[]> {
    const itens: TBruto[] = [];
    for (let pagina = 1; pagina <= limitePaginas; pagina++) {
      const dados = await this.buscar<Record<string, unknown>>(caminho, {
        limit: porPagina,
        page: pagina,
      });
      const lista = (dados[chave] ?? []) as Record<string, unknown>[];
      if (!Array.isArray(lista) || lista.length === 0) break;

      // A Tray embrulha cada item numa chave singular, ex.: { Product: {...} }.
      const singular = chave.replace(/s$/, "");
      for (const linha of lista) {
        const item = (linha[singular] ?? linha[chave] ?? linha) as TBruto;
        itens.push(item);
      }
      if (lista.length < porPagina) break;
    }
    return itens;
  }

  async listarCategorias(): Promise<TrayCategoria[]> {
    const brutas = await this.todasAsPaginas<Record<string, unknown>>("/categories", "Categories");
    return brutas.map((c) => ({
      id: String(c.id ?? ""),
      name: texto(c.name) ?? "Sem nome",
      slug: texto(c.slug ?? c.name_url),
      parent_id: texto(c.parent_id) === "0" ? null : texto(c.parent_id),
      url: texto((c.url as Record<string, unknown>)?.https ?? c.url),
      position: numeroOuNulo(c.order ?? c.position),
      active: String(c.active ?? "1") === "1",
    })).filter((c) => c.id);
  }

  async listarProdutos(): Promise<TrayProduto[]> {
    const brutos = await this.todasAsPaginas<Record<string, unknown>>("/products", "Products");
    return brutos.map((p) => ({
      id: String(p.id ?? ""),
      name: texto(p.name) ?? "Sem nome",
      slug: texto(p.slug ?? p.name_url),
      url: texto((p.url as Record<string, unknown>)?.https ?? p.url),
      category_id: texto(p.category_id),
      available: String(p.available ?? "1") === "1",
      active: String(p.active ?? "1") === "1",
      image: texto((p.ProductImage as Record<string, unknown>[] | undefined)?.[0]?.https as string ?? p.picture_source ?? p.image),
      description: texto(p.description ?? p.small_description),
      price: numeroOuNulo(p.price),
      stock: numeroOuNulo(p.stock),
      bruto: p,
    })).filter((p) => p.id);
  }

  async listarVariacoes(produtoId: string): Promise<TrayVariacao[]> {
    const dados = await this.buscar<Record<string, unknown>>("/products/variants", {
      product_id: produtoId,
      limit: 100,
    });
    const lista = (dados.Variants ?? []) as Record<string, unknown>[];
    return (Array.isArray(lista) ? lista : []).map((linha) => {
      const v = (linha.Variant ?? linha) as Record<string, unknown>;
      const atributos: Record<string, string> = {};
      const vt = (v.Sku ?? v.variant_type ?? []) as Record<string, unknown>[];
      if (Array.isArray(vt)) {
        for (const at of vt) {
          const nome = texto(at.type ?? at.name);
          const valor = texto(at.value ?? at.description);
          if (nome && valor) atributos[nome.toLowerCase()] = valor;
        }
      }
      return {
        id: String(v.id ?? ""),
        product_id: produtoId,
        sku: texto(v.reference ?? v.sku),
        price: numeroOuNulo(v.price),
        stock: numeroOuNulo(v.stock),
        atributos,
        bruto: v,
      };
    }).filter((v) => v.id);
  }
}

/** true quando as quatro variáveis estão presentes no servidor. */
export function trayConfigurada(): boolean {
  return Boolean(
    process.env.TRAY_API_URL &&
      process.env.TRAY_CONSUMER_KEY &&
      process.env.TRAY_CONSUMER_SECRET &&
      process.env.TRAY_CODE,
  );
}
