import "server-only";
import { createReadClient } from "@/lib/supabase/read";
import { gerarEmbedding, paraVetorSql } from "./embeddings";

/** Um documento encontrado, já com o melhor trecho dele. */
export type Achado = {
  tipo: "guia" | "loja";
  slug: string;
  titulo: string;
  href: string;
  /** Seção que respondeu, quando o acerto veio do meio do texto. */
  secao: string | null;
  trecho: string;
  score: number;
  /** Como este resultado foi encontrado, útil para depurar o ranking. */
  via: "texto" | "significado" | "ambos";
  /** Distância vetorial (0 = idêntico). Nula quando veio só do texto. */
  distancia: number | null;
};

export type ResultadoBusca = {
  consulta: string;
  /** Tudo junto, já ordenado, para quem quiser uma lista só. */
  achados: Achado[];
  /** Separado por tipo, que é como a tela mostra. */
  guias: Achado[];
  lojas: Achado[];
  /** Falso quando a busca rodou só por texto (sem OpenAI). */
  comSignificado: boolean;
};

/**
 * Margem de relevância, relativa ao melhor resultado.
 *
 * Corte fixo não serve, e isso foi medido: 0,695 era um acerto legítimo em
 * "prata escurece com o tempo?" enquanto 0,706 era ruído em "posso gravar o
 * nome dentro?". A distância de cosseno não é comparável entre consultas
 * diferentes, só dentro da mesma. Então o critério é a distância ATÉ o melhor
 * resultado daquela consulta.
 */
const MARGEM = 0.18;

/**
 * Teto de lojas por busca.
 *
 * Com um guia publicado e dez lojas, o ramo vetorial enchia toda consulta de
 * loja. Mais que isso: este portal é de CONTEÚDO, e a loja é o complemento
 * (PROJETO §3). Três lojas bastam para quem procura endereço, e não afogam
 * quem procura resposta.
 */
const TETO_DE_LOJAS = 3;

type Linha = {
  tipo: "guia" | "loja";
  slug: string;
  titulo: string;
  secao: string | null;
  ancora: string | null;
  origem: string;
  trecho: string;
  score: number;
  pos_lexico: number | null;
  pos_vetor: number | null;
  distancia: number | null;
};

export async function buscar(consulta: string, limite = 8): Promise<ResultadoBusca> {
  const termo = consulta.trim().slice(0, 200);
  const vazio: ResultadoBusca = {
    consulta: termo,
    achados: [],
    guias: [],
    lojas: [],
    comSignificado: false,
  };
  if (termo.length < 2) return vazio;

  const supabase = createReadClient();
  if (!supabase) return vazio;

  // Sem embedding a busca não para: ela cai para full-text puro. Integração
  // fora do ar não pode virar tela em branco.
  const vetor = await gerarEmbedding(termo);

  const { data, error } = await supabase.rpc("buscar_no_site", {
    consulta: termo,
    consulta_vec: vetor ? paraVetorSql(vetor) : null,
    limite: limite * 3,
  });

  if (error || !data) return { ...vazio, comSignificado: Boolean(vetor) };

  // A RPC devolve TRECHOS; a tela mostra DOCUMENTOS. Sem agrupar, um guia com
  // três seções boas ocuparia as três primeiras posições e esconderia as lojas.
  const porDocumento = new Map<string, Achado>();

  for (const l of data as Linha[]) {
    const chave = `${l.tipo}:${l.slug}`;
    if (porDocumento.has(chave)) continue;

    const via: Achado["via"] =
      l.pos_lexico != null && l.pos_vetor != null
        ? "ambos"
        : l.pos_vetor != null
          ? "significado"
          : "texto";

    porDocumento.set(chave, {
      tipo: l.tipo,
      slug: l.slug,
      titulo: l.titulo,
      href:
        l.tipo === "guia"
          ? `/guia/${l.slug}${l.ancora ? `#${l.ancora}` : ""}`
          : `/lojas/${l.slug}`,
      secao: l.secao,
      trecho: l.trecho,
      score: l.score,
      via,
      distancia: l.distancia,
    });
  }

  const todos = [...porDocumento.values()];

  // Corta o que ficou longe demais do melhor acerto daquela consulta.
  const melhor = todos.reduce<number | null>(
    (m, a) => (a.distancia == null ? m : m == null ? a.distancia : Math.min(m, a.distancia)),
    null,
  );
  const dentroDaMargem =
    melhor == null
      ? todos
      : todos.filter((a) => a.distancia == null || a.distancia <= melhor + MARGEM);

  const guias = dentroDaMargem.filter((a) => a.tipo === "guia").slice(0, limite);
  const lojas = dentroDaMargem.filter((a) => a.tipo === "loja").slice(0, TETO_DE_LOJAS);

  return {
    consulta: termo,
    achados: [...guias, ...lojas].slice(0, limite),
    guias,
    lojas,
    comSignificado: Boolean(vetor),
  };
}
