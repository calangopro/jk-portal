import { MARCA_PENDENTE } from "./modelos";

/**
 * Prompt pronto para pedir o conteúdo a uma IA de fora (ChatGPT, Gemini, Claude).
 *
 * A pessoa copia, cola no chat, escreve o tema e recebe a resposta já dividida
 * campo a campo, na ordem do editor. Sem isso, o caminho normal é pedir "um
 * texto sobre alianças", receber um bloco corrido e passar meia hora fatiando
 * ele nos campos certos, quase sempre perdendo a resposta rápida e a FAQ.
 *
 * As regras e os limites saem das MESMAS constantes que o analisador usa. Um
 * prompt escrito à mão descolaria das travas de publicação com o primeiro
 * ajuste, e a IA passaria a entregar texto que o próprio sistema recusa.
 */

/** Limites conferidos pelo analisador antes de publicar. */
export const LIMITES = {
  metaTitle: 60,
  metaDescriptionMin: 140,
  metaDescriptionMax: 160,
  respostaMinFrases: 2,
  respostaMaxFrases: 4,
  linksInternosMin: 2,
} as const;

export type ContextoDoPrompt = {
  /** Títulos já publicados, para a IA não propor conteúdo que canibaliza. */
  publicados?: string[];
  /** Consulta alvo, quando já estiver definida no editor. */
  consultaAlvo?: string;
};

export function montarPrompt({ publicados = [], consultaAlvo }: ContextoDoPrompt = {}): string {
  const jaPublicados =
    publicados.length > 0
      ? publicados.slice(0, 40).map((t) => `- ${t}`).join("\n")
      : "- (nenhum conteúdo publicado ainda)";

  return `Você vai escrever um guia para o portal de conteúdo da JK Alianças, uma
joalheria brasileira com fábrica própria e 10 lojas físicas. O portal é
editorial: ele explica e ajuda a decidir. Ele NÃO vende, não fala de preço e não
faz checkout, porque isso acontece na loja oficial.

TEMA: ${consultaAlvo ? `${consultaAlvo}\n(ajuste se eu escrever outro tema abaixo)` : "[ESCREVA O TEMA AQUI]"}

════════════════════════════════════════════════════════════
REGRAS DE ESCRITA, TODAS OBRIGATÓRIAS
════════════════════════════════════════════════════════════

PROIBIDO:
- Travessão (— e –). Nunca, em nenhum campo. Use vírgula, dois pontos, ponto
  final ou parênteses. Isto barra a publicação no sistema.
- Linguagem de robô: "otimize sua experiência", "solução completa",
  "não perca tempo".
- Cara de texto gerado por IA: "vamos mergulhar", "neste artigo você vai
  descobrir", "em resumo", "é importante ressaltar", "no mundo de hoje".
- Frase genérica que serve para qualquer joalheria do Brasil.
- Adjetivo sem prova. Não escreva "a melhor aliança".
- Inventar preço, nota, avaliação, prazo ou estatística. Se não souber o dado,
  escreva a frase sem ele.
- Emoji.
- Repetir a palavra-alvo à exaustão.

OBRIGATÓRIO:
- Português do Brasil, frase curta, uma ideia por parágrafo.
- Voz ativa: "meça o dedo no fim do dia", e não "recomenda-se que a medição
  seja feita".
- Responder a dúvida principal logo no começo, antes de explicar.
- Dado concreto no lugar de promessa vaga: "prata 950 tem 95% de prata pura"
  vale mais que "qualidade superior".
- Escrever trechos que façam sentido sozinhos, fora do contexto do parágrafo.
  É assim que uma IA de busca consegue citar o texto.
- Nomear "JK Alianças" por extenso ao menos uma vez nos primeiros parágrafos.
- Tom de quem entende de joia e explica sem arrogância.

════════════════════════════════════════════════════════════
CONTEÚDO JÁ PUBLICADO, NÃO REPITA O MESMO ASSUNTO
════════════════════════════════════════════════════════════
${jaPublicados}

Se o tema que eu pedi ficar muito perto de um destes, avise antes de escrever e
sugira um recorte diferente.

════════════════════════════════════════════════════════════
FORMATO DA RESPOSTA
════════════════════════════════════════════════════════════
Responda EXATAMENTE nos blocos abaixo, mantendo os divisores ===. Não escreva
nada fora deles, sem introdução e sem comentário final.

=== TITULO ===
O H1 do guia. Até 70 caracteres. Precisa conter a consulta principal e soar
como pergunta ou promessa concreta, não como manchete emocional.

=== SLUG ===
Endereço da página. Só minúsculas, sem acento, palavras separadas por hífen.
Curto, com a palavra-alvo, sem data e sem palavra inútil.

=== META TITLE ===
Até ${LIMITES.metaTitle} caracteres. Pode diferir do título.

=== META DESCRIPTION ===
Entre ${LIMITES.metaDescriptionMin} e ${LIMITES.metaDescriptionMax} caracteres.
Escrita para ganhar o clique. Não repita o título.

=== CONSULTA ALVO ===
A busca exata que esta página quer ganhar no Google. Uma linha.

=== INTENCAO DE BUSCA ===
O que a pessoa quer de fato ao buscar isso. Uma frase.

=== RESPOSTA RAPIDA ===
De ${LIMITES.respostaMinFrases} a ${LIMITES.respostaMaxFrases} frases que
respondem a dúvida principal sozinhas, sem depender do resto do texto. É o
trecho mais importante: é ele que aparece na busca e que a IA cita.

=== CORPO ===
O texto do guia em HTML simples, usando apenas estas tags:
<h2>, <h3>, <p>, <ul>, <li>, <strong>, <em>, <table>, <thead>, <tbody>, <tr>,
<th>, <td>, <blockquote>.
Regras do corpo:
- NÃO use <h1>, ele já existe no título e duplicar barra a publicação.
- Cada <h2> deve ser uma pergunta real que a pessoa faria.
- Use <table> sempre que houver comparação. Tabela é o formato que a IA extrai
  melhor, e toda tabela precisa de <thead> com <th>.
- Não insira imagem nem vídeo, isso eu adiciono depois no editor.
- Nada de "${MARCA_PENDENTE}" nem texto de esqueleto.

=== FAQ ===
De 4 a 6 perguntas, no formato:
P: pergunta
R: resposta objetiva em 2 a 4 frases
As perguntas precisam ser as que sobram depois da leitura, e não repetições do
que o corpo já respondeu.

=== LINKS INTERNOS SUGERIDOS ===
Pelo menos ${LIMITES.linksInternosMin} sugestões de ligação com os conteúdos já
publicados listados acima, no formato:
- âncora descritiva -> título do conteúdo de destino
Nunca use "clique aqui" como âncora.

=== FONTES ===
Para cada afirmação factual do texto, diga de onde ela sai. Se for conhecimento
técnico geral de joalheria, escreva "conhecimento técnico". Se for algo sobre a
JK especificamente (número de lojas, prazo, garantia, avaliação), escreva
"PRECISA CONFIRMAR COM A JK" e não invente o dado no texto.`;
}
