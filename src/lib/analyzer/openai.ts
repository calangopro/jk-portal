import "server-only";
import OpenAI from "openai";

/**
 * Configuração central da OpenAI, com foco em custo.
 *
 * O que pesa na conta não é a entrada, é a SAÍDA: o gpt-5 cobra por token
 * gerado e ainda cobra o raciocínio interno. Por isso:
 *
 * - Tarefa frequente e bem definida (ajudar num item, escrever um trecho) usa
 *   gpt-5-mini, que custa cerca de 5x menos por token de saída.
 * - A revisão completa, que é ocasional e vale mais, continua no gpt-5.
 * - Todo pedido tem teto de tokens de saída, para nunca escapar do controle.
 * - O conteúdo enviado é aparado, porque texto longo não melhora o resultado
 *   e encarece cada chamada.
 */

export const MODELO_RAPIDO = "gpt-5-mini";
export const MODELO_PROFUNDO = "gpt-5";

/** Teto de caracteres do conteúdo enviado no prompt. */
const LIMITE_TEXTO = 7000;

export function apararTexto(texto: string, limite = LIMITE_TEXTO): string {
  if (!texto) return "(vazio)";
  if (texto.length <= limite) return texto;
  return `${texto.slice(0, limite)}\n\n[texto cortado aqui para economizar. O conteúdo continua além deste ponto.]`;
}

export function cliente(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Falta OPENAI_API_KEY no servidor.");
  return new OpenAI({ apiKey });
}

export type OpcoesPedido = {
  modelo: string;
  /** Teto de tokens de saída, incluindo o raciocínio. */
  tetoSaida: number;
  esforco?: "minimal" | "low" | "medium" | "high";
};

/** Faz o pedido com saída estruturada e devolve o JSON já convertido. */
export async function pedirJson<T>(
  system: string,
  user: string,
  schema: Record<string, unknown>,
  nomeSchema: string,
  opcoes: OpcoesPedido,
): Promise<T> {
  const resp = await cliente().chat.completions.create({
    model: opcoes.modelo,
    reasoning_effort: opcoes.esforco ?? "low",
    max_completion_tokens: opcoes.tetoSaida,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: nomeSchema, strict: true, schema },
    },
  });

  const bruto = resp.choices[0]?.message?.content;
  if (!bruto) {
    // Sem conteúdo em geral significa que o teto foi atingido no raciocínio.
    const motivo = resp.choices[0]?.finish_reason ?? "desconhecido";
    throw new Error(
      motivo === "length"
        ? "A resposta ficou longa demais. Tente com um pedido mais específico."
        : "A IA não devolveu conteúdo.",
    );
  }

  return JSON.parse(bruto) as T;
}

/**
 * Pedido com imagem (multimodal).
 *
 * A `pedirJson` só manda texto. Descrever uma foto exige que o modelo VEJA a
 * foto, então aqui a URL da imagem vai junto na mensagem do usuário. Continua
 * com saída estruturada e teto de tokens, pelas mesmas razões de custo.
 */
export async function pedirJsonComImagem<T>(
  system: string,
  texto: string,
  imagemUrl: string,
  schema: Record<string, unknown>,
  nomeSchema: string,
  opcoes: OpcoesPedido,
): Promise<T> {
  const resp = await cliente().chat.completions.create({
    model: opcoes.modelo,
    reasoning_effort: opcoes.esforco ?? "low",
    max_completion_tokens: opcoes.tetoSaida,
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content: [
          { type: "text", text: texto },
          // "low" basta: o alt descreve o que a imagem mostra, não detalhe fino,
          // e o modo de alta resolução multiplica o custo por imagem.
          { type: "image_url", image_url: { url: imagemUrl, detail: "low" } },
        ],
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: nomeSchema, strict: true, schema },
    },
  });

  const bruto = resp.choices[0]?.message?.content;
  if (!bruto) {
    const motivo = resp.choices[0]?.finish_reason ?? "desconhecido";
    throw new Error(
      motivo === "length"
        ? "A resposta da IA estourou o teto de tokens. Tente de novo."
        : `A IA não devolveu conteúdo (motivo: ${motivo}).`,
    );
  }
  return JSON.parse(bruto) as T;
}
