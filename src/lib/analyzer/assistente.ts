import "server-only";
import {
  MODELO_RAPIDO,
  apararTexto,
  pedirJson,
  pedirJsonComImagem,
} from "./openai";

/**
 * Assistente pontual: resolve UM item de cada vez, ou escreve/melhora um
 * trecho. Diferente de ai.ts, que faz o diagnóstico geral.
 *
 * A IA sempre devolve texto pronto para colar, mais a explicação do porquê.
 * Quem decide aplicar é a pessoa.
 */

export type Ajuda = {
  /** Texto pronto para usar. Vazio quando não faz sentido gerar texto. */
  sugestao: string;
  /** Por que essa mudança resolve o problema. */
  explicacao: string;
  /** Passos objetivos quando o item não se resolve só com texto. */
  passos: string[];
};

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["sugestao", "explicacao", "passos"],
  properties: {
    sugestao: { type: "string" },
    explicacao: { type: "string" },
    passos: { type: "array", items: { type: "string" } },
  },
} as const;

const VOZ = `
Você escreve para a JK Alianças, joalheria brasileira com fábrica própria, 10 lojas físicas e mais de 17 mil avaliações. O portal existe para rankear no Google e ser citado por IA.

Regras absolutas de escrita, sem exceção:
- Travessão é proibido. Nunca use travessão longo nem traço médio. Use vírgula, dois pontos, ponto ou parênteses.
- Nada de linguagem de robô nem cara de texto gerado por IA. Proibido: "vamos mergulhar", "neste artigo você vai descobrir", "é importante ressaltar", "em resumo", "no mundo de hoje", "fique por dentro".
- Nada de afirmação genérica que serviria para qualquer joalheria.
- Nada de adjetivo sem prova, e nunca invente preço, avaliação, prazo ou dado institucional que não esteja no texto.
- Frase curta, voz ativa, uma ideia por parágrafo, português do Brasil.
- Prefira dado concreto e verificável (teor do metal, largura em milímetros, medida do aro).
`.trim();

async function pedir(system: string, user: string, tetoSaida: number): Promise<Ajuda> {
  return pedirJson<Ajuda>(
    `${VOZ}\n\n${system}`,
    user,
    SCHEMA as unknown as Record<string, unknown>,
    "ajuda",
    // Modelo rápido: a tarefa é pontual e bem definida, então o modelo maior
    // não melhora o resultado e custa muito mais por token gerado.
    { modelo: MODELO_RAPIDO, tetoSaida, esforco: "low" },
  );
}

export type ContextoConteudo = {
  titulo: string;
  consultaAlvo: string;
  resposta: string;
  texto: string;
  metaDescription: string;
};

/** Resolve um item específico apontado pelo analisador. */
export async function resolverItem(
  item: { id: string; titulo: string; dica?: string },
  ctx: ContextoConteudo,
): Promise<Ajuda> {
  const system = `
Você ajuda a resolver UM problema específico de um conteúdo, apontado por um analisador de SEO e GEO.

Devolva:
- "sugestao": o texto pronto para a pessoa copiar e colar, já resolvendo o problema. Se o item for de título, escreva o título. Se for de meta description, escreva a meta description com 140 a 160 caracteres. Se for de resposta rápida, escreva o bloco em 2 a 4 frases. Se for de texto curto, escreva o parágrafo ou a seção que falta, usando só informação que já existe no conteúdo ou conhecimento técnico seguro sobre joalheria. Se o item não se resolve com texto (imagem faltando, link interno, autoria), deixe "sugestao" vazio.
- "explicacao": uma ou duas frases dizendo por que isso resolve.
- "passos": lista curta e objetiva do que fazer, principalmente quando não há texto a gerar.

Nunca invente dado institucional da JK. Se precisar de informação que não existe, diga isso nos passos.
`.trim();

  const user = [
    `Problema a resolver: ${item.titulo}`,
    item.dica ? `Orientação do analisador: ${item.dica}` : "",
    "",
    `Título atual: ${ctx.titulo || "(vazio)"}`,
    `Consulta principal: ${ctx.consultaAlvo || "(não definida)"}`,
    `Meta description atual: ${ctx.metaDescription || "(vazia)"}`,
    `Resposta rápida atual: ${ctx.resposta || "(vazia)"}`,
    "",
    "Conteúdo atual:",
    apararTexto(ctx.texto),
  ].join("\n");

  // Teto generoso o bastante para uma seção, e curto o bastante para não fugir.
  return pedir(system, user, 3000);
}

/** Escreve ou melhora um trecho, a partir do que a pessoa pedir. */
export async function escreverTrecho(
  pedido: string,
  ctx: ContextoConteudo,
  trechoAtual?: string,
): Promise<Ajuda> {
  const system = `
Você escreve ou melhora um trecho de conteúdo editorial.

Devolva:
- "sugestao": o texto pronto, sem título de seção repetido, sem introdução do tipo "aqui está". Só o conteúdo.
- "explicacao": uma frase sobre a escolha que você fez.
- "passos": vazio, ou no máximo dois avisos do que a pessoa precisa validar com a JK.

Formato da "sugestao": HTML simples, usando apenas estas tags: <p>, <h3>, <ul>, <ol>, <li>, <table>, <caption>, <tr>, <th>, <td>, <strong>.
- Quando o pedido for de comparação, entregue <table> de verdade, nunca uma lista fingindo ser tabela.
- Toda <table> começa com <caption> dizendo o que ela compara, e a primeira linha usa <th> para os cabeçalhos.
- Texto corrido vai em <p>, um parágrafo por ideia.
- Nada de <h1>, <h2>, <img>, <script>, style nem class.

Escreva no tamanho pedido. Se não houver tamanho, escreva de 2 a 4 parágrafos curtos.
`.trim();

  const user = [
    `Pedido: ${pedido}`,
    trechoAtual ? `\nTrecho atual a melhorar:\n${trechoAtual}` : "",
    "",
    `Título do conteúdo: ${ctx.titulo || "(vazio)"}`,
    `Consulta principal: ${ctx.consultaAlvo || "(não definida)"}`,
    `Resposta rápida: ${ctx.resposta || "(vazia)"}`,
    "",
    "Conteúdo já escrito (para manter coerência e não repetir):",
    apararTexto(ctx.texto),
  ].join("\n");

  // Teto generoso o bastante para uma seção, e curto o bastante para não fugir.
  return pedir(system, user, 3000);
}

/* --------------------------------------------------------- alt de imagem */

const SCHEMA_ALT = {
  type: "object",
  additionalProperties: false,
  required: ["alt", "legenda"],
  properties: {
    alt: { type: "string" },
    legenda: { type: "string" },
  },
} as const;

export type SugestaoDeAlt = { alt: string; legenda: string };

/**
 * Escreve o texto alternativo lendo a imagem.
 *
 * É o gargalo real da biblioteca de mídia: o alt é obrigatório, mas escrever um
 * bom alt para dezenas de fotos de aliança é repetitivo, e o resultado costuma
 * ser "aliança" em todas. A documentação de imagens do Google pede texto
 * descritivo e específico, e alerta contra empilhar palavra-chave.
 */
export async function descreverImagem(p: {
  imagemUrl: string;
  contexto?: string;
}): Promise<SugestaoDeAlt> {
  const system = `${VOZ}

Você escreve o texto alternativo de uma imagem de joalheria.

Regras do alt:
- Descreva o que se vê, para quem não enxerga a foto. Material, cor, largura aparente, acabamento, quantidade de peças, fundo.
- Uma frase, entre 60 e 125 caracteres. Sem ponto final.
- Não comece com "imagem de" nem "foto de": o leitor de tela já anuncia que é uma imagem.
- Nunca empilhe palavra-chave. Se a descrição natural não pede a palavra, ela não entra.
- Nunca afirme teor do metal, quilate, medida exata nem preço que você não consegue ver na foto. Na dúvida, descreva pela aparência ("dourada", "prateada"), não pelo material.

Em "legenda", escreva uma legenda curta para aparecer sob a foto, só quando ela acrescentar algo que o alt não diz. Se não houver o que acrescentar, devolva string vazia.`;

  return pedirJsonComImagem<SugestaoDeAlt>(
    system,
    p.contexto?.trim()
      ? `A imagem vai entrar neste contexto: ${apararTexto(p.contexto, 500)}`
      : "Descreva a imagem.",
    p.imagemUrl,
    SCHEMA_ALT,
    "sugestao_de_alt",
    { modelo: MODELO_RAPIDO, tetoSaida: 800, esforco: "low" },
  );
}
