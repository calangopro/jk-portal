import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Custos da empresa (0055): o que a loja gasta para funcionar, fora o custo
 * das peças, que mora em Margem.
 *
 * Tudo aqui é lido com o cliente da SESSÃO: a RLS das tabelas e a policy do
 * bucket `comprovantes` só abrem para administrador. Os valores entram pelo
 * painel e nunca pelo repositório.
 */

export const BUCKET_DE_COMPROVANTES = "comprovantes";

export const CATEGORIAS = [
  { chave: "pessoal", nome: "Pessoas" },
  { chave: "anuncios", nome: "Anúncios" },
  { chave: "servicos", nome: "Serviços e agências" },
  { chave: "plataformas", nome: "Plataformas" },
  { chave: "embalagem", nome: "Embalagem" },
  { chave: "frete", nome: "Frete" },
  { chave: "impostos_e_taxas", nome: "Impostos e taxas" },
  { chave: "estrutura", nome: "Estrutura" },
  { chave: "outros", nome: "Outros" },
] as const;

export type Categoria = (typeof CATEGORIAS)[number]["chave"];
export type Tipo = "mensal" | "por_pedido";

export const NOME_DA_CATEGORIA = Object.fromEntries(CATEGORIAS.map((c) => [c.chave, c.nome])) as Record<Categoria, string>;

export type Anexo = { id: string; nome: string; tipo: string | null; tamanho: number | null; link: string | null };

export type Despesa = {
  id: string;
  nome: string;
  categoria: Categoria;
  tipo: Tipo;
  valor: number;
  confirmado: boolean;
  fonte: string | null;
  observacao: string | null;
  ativo: boolean;
  atualizado_em: string;
  anexos: Anexo[];
};

/** Link assinado vale uma hora: dá para abrir o comprovante, não para guardar o endereço. */
const VALIDADE_DO_LINK_S = 3600;

/** Todas as despesas, ativas primeiro, com os comprovantes e o link de cada um. `null` se o banco falhar. */
export async function lerDespesas(db: SupabaseClient): Promise<Despesa[] | null> {
  const { data, error } = await db
    .from("despesas")
    .select("id, nome, categoria, tipo, valor, confirmado, fonte, observacao, ativo, atualizado_em, despesa_anexos(id, nome, tipo, tamanho, caminho, criado_em)")
    .order("ativo", { ascending: false })
    .order("valor", { ascending: false });
  if (error) {
    console.error("[custos] despesas:", error.message);
    return null;
  }

  type Linha = Omit<Despesa, "anexos" | "valor"> & {
    valor: number | string;
    despesa_anexos: { id: string; nome: string; tipo: string | null; tamanho: number | null; caminho: string; criado_em: string }[] | null;
  };
  const linhas = (data ?? []) as unknown as Linha[];

  const caminhos = linhas.flatMap((l) => (l.despesa_anexos ?? []).map((a) => a.caminho));
  const links = new Map<string, string>();
  if (caminhos.length > 0) {
    const { data: assinados } = await db.storage.from(BUCKET_DE_COMPROVANTES).createSignedUrls(caminhos, VALIDADE_DO_LINK_S);
    for (const a of assinados ?? []) if (a.path && a.signedUrl) links.set(a.path, a.signedUrl);
  }

  return linhas.map(({ despesa_anexos, ...l }) => ({
    ...l,
    valor: Number(l.valor),
    anexos: (despesa_anexos ?? [])
      .sort((a, b) => (a.criado_em < b.criado_em ? -1 : 1))
      .map((a) => ({ id: a.id, nome: a.nome, tipo: a.tipo, tamanho: a.tamanho, link: links.get(a.caminho) ?? null })),
  }));
}

export type TotaisDeCustos = { mensal: number; porPedido: number; itens: number; confirmados: number };

export function somarDespesas(despesas: Despesa[]): TotaisDeCustos {
  const ativas = despesas.filter((d) => d.ativo);
  const soma = (tipo: Tipo) => Math.round(ativas.filter((d) => d.tipo === tipo).reduce((s, d) => s + d.valor, 0) * 100) / 100;
  return {
    mensal: soma("mensal"),
    porPedido: soma("por_pedido"),
    itens: ativas.length,
    confirmados: ativas.filter((d) => d.confirmado).length,
  };
}
