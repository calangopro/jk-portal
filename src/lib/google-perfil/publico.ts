import "server-only";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * O que a loja (tema da Tray) mostra das avaliações do Google.
 *
 * Só sai avaliação de 4 e 5 estrelas com texto, que é o pedido da JK, mas a
 * nota e o total de cada loja são os do Google, de TODAS as avaliações. A
 * vitrine escolhe o que mostrar; o número não pode fingir que só existem as
 * boas. Cada loja leva o link do Maps, onde a pessoa vê todas.
 *
 * Conteúdo do Google entregue como veio (sem editar texto nem nome), com
 * crédito, e só o que foi confirmado nos últimos 25 dias (política da API,
 * ver a migration 0048).
 */

export type LojaPublica = {
  id: string;
  nome: string;
  slug: string | null;
  nota: number | null;
  total: number | null;
  link: string | null;
};

export type AvaliacaoPublica = {
  loja: string;
  nota: number;
  autor: string;
  /** Foto do perfil no Google (endereço do próprio Google), ou null. */
  foto: string | null;
  texto: string;
  data: string | null;
};

export type AvaliacoesPublicas = {
  fonte: "Avaliações do Google";
  atualizadoEm: string | null;
  lojas: LojaPublica[];
  avaliacoes: AvaliacaoPublica[];
};

export const TAG_AVALIACOES = "avaliacoes-google";

const VALIDADE_MS = 25 * 24 * 60 * 60 * 1000;

type LinhaDeLocal = {
  name: string;
  titulo: string;
  maps_uri: string | null;
  nota_media: number | string | null;
  total_avaliacoes: number | null;
  sincronizado_em: string;
  locations: { name: string; slug: string } | { name: string; slug: string }[] | null;
};

type LinhaDeAvaliacao = {
  local: string;
  nota: number;
  autor: string | null;
  autor_anonimo: boolean;
  autor_foto: string | null;
  comentario: string | null;
  criada_em: string | null;
};

async function ler(loja: string, limite: number): Promise<AvaliacoesPublicas> {
  const supabase = createAdminClient();
  const desde = new Date(Date.now() - VALIDADE_MS).toISOString();

  const { data: locais, error: erroLocais } = await supabase
    .from("google_locais")
    .select("name, titulo, maps_uri, nota_media, total_avaliacoes, sincronizado_em, locations:location_id(name, slug)")
    .gte("sincronizado_em", desde);
  // Erro lança: dentro do unstable_cache, erro não fica guardado.
  if (erroLocais) throw new Error(erroLocais.message);

  const lojas: LojaPublica[] = ((locais ?? []) as LinhaDeLocal[]).map((l) => {
    const portal = Array.isArray(l.locations) ? l.locations[0] : l.locations;
    return {
      id: l.name,
      nome: portal?.name ?? l.titulo,
      slug: portal?.slug ?? null,
      nota: l.nota_media == null ? null : Number(l.nota_media),
      total: l.total_avaliacoes,
      link: l.maps_uri,
    };
  });

  const daLoja = loja ? lojas.filter((l) => l.slug === loja).map((l) => l.id) : null;
  if (daLoja && daLoja.length === 0) {
    return { fonte: "Avaliações do Google", atualizadoEm: null, lojas: [], avaliacoes: [] };
  }

  const consultar = (colunas: string) => {
    let consulta = supabase
      .from("google_avaliacoes")
      .select(colunas)
      .gte("nota", 4)
      .not("comentario", "is", null)
      .gte("sincronizado_em", desde)
      .order("criada_em", { ascending: false })
      // Folga para alternar as lojas abaixo: sem isso, a loja com mais
      // avaliações recentes ocupava a vitrine inteira.
      .limit(Math.min(limite * 6, 300));
    if (daLoja) consulta = consulta.in("local", daLoja);
    return consulta;
  };

  let { data: linhas, error } = await consultar("local, nota, autor, autor_anonimo, autor_foto, comentario, criada_em");
  // Banco sem a 0051 ainda: a vitrine sai sem foto, com a inicial.
  if (error && /autor_foto/.test(error.message)) {
    ({ data: linhas, error } = await consultar("local, nota, autor, autor_anonimo, comentario, criada_em"));
  }
  if (error) throw new Error(error.message);

  // Uma de cada loja por vez, mantendo a mais recente de cada uma primeiro.
  const porLoja = new Map<string, LinhaDeAvaliacao[]>();
  // O select com colunas em variável perde o tipo no supabase-js; a forma é a de LinhaDeAvaliacao.
  for (const a of (linhas ?? []) as unknown as LinhaDeAvaliacao[]) {
    if (!(a.comentario ?? "").trim()) continue;
    const fila = porLoja.get(a.local) ?? [];
    fila.push(a);
    porLoja.set(a.local, fila);
  }
  const alternadas: LinhaDeAvaliacao[] = [];
  while (alternadas.length < limite && [...porLoja.values()].some((f) => f.length)) {
    for (const fila of porLoja.values()) {
      const a = fila.shift();
      if (a) alternadas.push(a);
      if (alternadas.length >= limite) break;
    }
  }

  const avaliacoes: AvaliacaoPublica[] = alternadas
    .map((a) => ({
      loja: a.local,
      nota: a.nota,
      autor: a.autor_anonimo || !a.autor ? "Cliente no Google" : a.autor,
      foto: !a.autor_anonimo && a.autor_foto && /^https:\/\/[a-z0-9.-]+\.(googleusercontent|ggpht)\.com\//.test(a.autor_foto) ? a.autor_foto : null,
      texto: a.comentario as string,
      data: a.criada_em,
    }));

  const usadas = new Set(avaliacoes.map((a) => a.loja));
  const atualizadoEm = ((locais ?? []) as LinhaDeLocal[])
    .map((l) => l.sincronizado_em)
    .sort()
    .at(-1) ?? null;

  return {
    fonte: "Avaliações do Google",
    atualizadoEm,
    // Toda loja com nota fica na lista (a vitrine mostra a de cada avaliação),
    // e a filtrada por slug só leva a dela.
    lojas: daLoja ? lojas.filter((l) => daLoja.includes(l.id)) : lojas.filter((l) => l.nota != null || usadas.has(l.id)),
    avaliacoes,
  };
}

const lerGuardado = unstable_cache(ler, ["avaliacoes-google-v3"], {
  revalidate: 3600,
  tags: [TAG_AVALIACOES],
});

/** Lido por `/api/avaliacoes`. Sem banco ou sem tabela, devolve vazio (a loja esconde o bloco). */
export async function lerAvaliacoesPublicas(loja = "", limite = 24): Promise<AvaliacoesPublicas> {
  try {
    return await lerGuardado(loja, Math.min(Math.max(limite, 1), 60));
  } catch (e) {
    console.error("[avaliacoes]", e);
    return { fonte: "Avaliações do Google", atualizadoEm: null, lojas: [], avaliacoes: [] };
  }
}
