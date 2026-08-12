import "server-only";
import { MODELO_PROFUNDO, apararTexto, pedirJson } from "./openai";

/**
 * Camada de análise com IA. Complementa as regras determinísticas de rules.ts.
 *
 * A chave fica só no servidor (OPENAI_API_KEY, sem prefixo NEXT_PUBLIC_).
 * A IA sugere, a pessoa decide. Nada é publicado automaticamente e nada aqui
 * inventa dado institucional, preço ou avaliação.
 */

export type SugestaoIA = {
  notaSeo: number;
  notaGeo: number;
  resumo: string;
  respondeIntencao: boolean;
  pontosFortes: string[];
  problemas: { titulo: string; porque: string; comoResolver: string }[];
  trechosCitaveis: string[];
  faqSugeridas: { question: string; answer: string }[];
  titulosAlternativos: string[];
  metaDescriptionSugerida: string;
  problemasDeVoz: { trecho: string; porque: string; sugestao: string }[];
};

export type EntradaIA = {
  titulo: string;
  consultaAlvo: string;
  intencao: string;
  resposta: string;
  texto: string;
  metaDescription: string;
  /** Títulos já publicados, para apontar risco de canibalização. */
  jaPublicados?: string[];
};

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "notaSeo", "notaGeo", "resumo", "respondeIntencao", "pontosFortes",
    "problemas", "trechosCitaveis", "faqSugeridas", "titulosAlternativos",
    "metaDescriptionSugerida", "problemasDeVoz",
  ],
  properties: {
    notaSeo: { type: "integer", minimum: 0, maximum: 100 },
    notaGeo: { type: "integer", minimum: 0, maximum: 100 },
    resumo: { type: "string" },
    respondeIntencao: { type: "boolean" },
    pontosFortes: { type: "array", items: { type: "string" } },
    problemas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["titulo", "porque", "comoResolver"],
        properties: {
          titulo: { type: "string" },
          porque: { type: "string" },
          comoResolver: { type: "string" },
        },
      },
    },
    trechosCitaveis: { type: "array", items: { type: "string" } },
    faqSugeridas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["question", "answer"],
        properties: { question: { type: "string" }, answer: { type: "string" } },
      },
    },
    titulosAlternativos: { type: "array", items: { type: "string" } },
    metaDescriptionSugerida: { type: "string" },
    problemasDeVoz: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["trecho", "porque", "sugestao"],
        properties: {
          trecho: { type: "string" },
          porque: { type: "string" },
          sugestao: { type: "string" },
        },
      },
    },
  },
} as const;

const INSTRUCOES = `
Você revisa conteúdo da JK Alianças, joalheria brasileira com fábrica própria, 10 lojas físicas e mais de 17 mil avaliações. O portal existe para rankear no Google e ser citado por IA.

Avalie o conteúdo em três frentes e responda em português do Brasil.

SEO: o texto responde a consulta principal? O título e a meta description ganham o clique? A estrutura ajuda a leitura? Falta profundidade em algum ponto que o leitor precisaria voltar ao Google para resolver?

QUEM, COMO E POR QUÊ (é assim que o Google avalia conteúdo confiável):
- Dá para saber de onde veio a informação? Quando o texto afirma algo específico (teor, medida, prazo, preço), a origem está clara?
- O texto mostra experiência de quem realmente lida com o produto, ou poderia ter sido escrito por alguém que só leu outros sites?
- O título descreve o conteúdo sem exagero. Título sensacionalista ou que promete mais do que o texto entrega é problema, aponte.
- O leitor termina a página resolvido, ou precisaria abrir outra aba para completar a resposta? Se precisaria, diga exatamente o que falta.
- O texto parece produzido em escala, com estrutura genérica que serviria para qualquer assunto trocando as palavras? Se parecer, aponte como problema.

GEO (ser citado por IA): existe resposta direta e autossuficiente no início? Há trechos que fazem sentido sozinhos, fora do contexto? Há dado concreto e verificável (teor, medida em milímetros, prazo)? A marca aparece nomeada de forma natural?

VOZ DA MARCA, regras absolutas do projeto:
- Travessão é proibido. Se encontrar travessão longo ou traço médio, aponte em problemasDeVoz.
- Nada de linguagem de robô ou cara de texto gerado por IA ("vamos mergulhar", "neste artigo você vai descobrir", "é importante ressaltar", "em resumo", "no mundo de hoje").
- Nada de afirmação genérica que serviria para qualquer joalheria.
- Nada de adjetivo sem prova.
- Frase curta, voz ativa, uma ideia por parágrafo.

Regras da sua resposta:
- notaSeo e notaGeo são números inteiros de 0 a 100, onde 0 é péssimo e 100 é impecável. Use a faixa toda, não a escala de 0 a 10.
- Um texto correto porém raso fica entre 40 e 60. Só passe de 85 quando o conteúdo estiver realmente pronto para publicar.
- Seja específico e cite o trecho exato do texto. Nada de conselho vago.
- Em trechosCitaveis, copie de 2 a 4 frases do texto que uma IA citaria bem. Se não houver nenhuma boa, devolva lista vazia.
- Em faqSugeridas, proponha perguntas que o leitor faria e o texto não responde. Escreva a resposta curta apenas se ela puder ser deduzida do próprio texto. Nunca invente dado institucional, preço, avaliação ou prazo.
- Em titulosAlternativos, dê 3 opções com até 60 caracteres.
- metaDescriptionSugerida deve ter entre 140 e 160 caracteres.
- Suas sugestões também seguem a voz da marca: sem travessão, sem linguagem de robô.
`.trim();

export async function analisarComIA(e: EntradaIA): Promise<SugestaoIA> {
  const conteudo = [
    `Título: ${e.titulo}`,
    `Consulta principal: ${e.consultaAlvo || "(não definida)"}`,
    `Intenção de busca: ${e.intencao || "(não definida)"}`,
    `Meta description atual: ${e.metaDescription || "(vazia)"}`,
    `Bloco de resposta rápida: ${e.resposta || "(vazio)"}`,
    "",
    "Corpo do conteúdo:",
    apararTexto(e.texto),
    e.jaPublicados?.length
      ? `\nConteúdos já publicados no portal (avalie risco de canibalização): ${e.jaPublicados.slice(0, 15).join(" | ")}`
      : "",
  ].join("\n");

  // Revisão completa é ocasional e vale o modelo maior, mas com teto de saída.
  return pedirJson<SugestaoIA>(
    INSTRUCOES,
    conteudo,
    SCHEMA as unknown as Record<string, unknown>,
    "analise",
    { modelo: MODELO_PROFUNDO, tetoSaida: 4000, esforco: "low" },
  );
}
