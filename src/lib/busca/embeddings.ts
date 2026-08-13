import "server-only";
import { cliente } from "@/lib/analyzer/openai";

/**
 * Embeddings da busca.
 *
 * `text-embedding-3-small` com 1536 dimensões: cabe no limite do índice HNSW
 * (2000) e custa quase nada. Indexar o portal inteiro sai por fração de centavo,
 * e a consulta gera um vetor de poucas dezenas de tokens.
 *
 * Toda função aqui devolve `null` em vez de lançar. A busca precisa continuar
 * respondendo por full-text quando a OpenAI falha ou a chave não está no
 * servidor. Integração indisponível não pode virar tela em branco.
 */

export const MODELO_EMBEDDING = "text-embedding-3-small";
export const DIMENSOES = 1536;

export function temChaveDaOpenAI(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

/** Formato que o Postgres aceita como `vector`: "[0.1,0.2,...]". */
export function paraVetorSql(v: number[]): string {
  return `[${v.join(",")}]`;
}

export async function gerarEmbedding(texto: string): Promise<number[] | null> {
  const lista = await gerarEmbeddings([texto]);
  return lista?.[0] ?? null;
}

/**
 * Em lote, porque a API cobra por token e não por chamada: mandar 50 trechos
 * juntos custa o mesmo e evita 50 idas e voltas de rede.
 */
export async function gerarEmbeddings(textos: string[]): Promise<number[][] | null> {
  const limpos = textos.map((t) => t.replace(/\s+/g, " ").trim()).filter(Boolean);
  if (limpos.length === 0) return [];
  if (!temChaveDaOpenAI()) return null;

  try {
    const resposta = await cliente().embeddings.create({
      model: MODELO_EMBEDDING,
      input: limpos,
      dimensions: DIMENSOES,
    });
    // A API garante a ordem, mas o índice vem explícito: confiar na ordem sem
    // conferir é como um embedding vai parar no trecho errado.
    return resposta.data
      .slice()
      .sort((a, b) => a.index - b.index)
      .map((d) => d.embedding as number[]);
  } catch {
    return null;
  }
}

/**
 * Cabeçalho de contexto antes de embeddar.
 *
 * Um trecho do meio do texto costuma não repetir de que assunto ele trata. Com
 * "Título › Seção" na frente, o vetor sabe onde aquele parágrafo mora, e o
 * ganho de acerto é grande para um custo de poucos tokens.
 */
export function comContexto(titulo: string, secao: string | null, texto: string): string {
  const cabecalho = secao ? `${titulo} › ${secao}` : titulo;
  return `${cabecalho}\n\n${texto}`;
}
