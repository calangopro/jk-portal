/**
 * Modelos de conteúdo.
 *
 * Cada tipo de página tem uma estrutura que funciona, e reconstruir essa
 * estrutura de cabeça toda vez é onde se perde tempo e onde se esquece o que
 * importa. O modelo já entrega o esqueleto na ordem certa: resposta primeiro,
 * subtítulos que respondem perguntas de verdade, e o fecho com a ação.
 *
 * O texto de instrução começa com "Escreva aqui" de propósito: o analisador
 * marca essa marca como erro, então nenhum esqueleto vai ao ar por descuido.
 */

export const MARCA_PENDENTE = "Escreva aqui";

export type Modelo = {
  id: string;
  nome: string;
  descricao: string;
  /** Quando usar, em uma linha, para a pessoa não escolher errado. */
  quando: string;
  titulo: string;
  intencao: string;
  resposta: string;
  bodyHtml: string;
  faqs: { question: string; answer: string }[];
};

const CTA_MEDIDOR =
  '<p>Se a dúvida é o tamanho, o <a href="/medidor-de-aliancas">medidor de aliança</a> resolve pela tela em dois minutos.</p>';
const CTA_LOJAS =
  '<p>Para experimentar antes de decidir, veja <a href="/lojas">as lojas da JK</a>.</p>';

export const MODELOS: Modelo[] = [
  {
    id: "pilar",
    nome: "Guia pilar",
    descricao: "A página central de um assunto, que responde tudo e distribui para os artigos do cluster.",
    quando: "Quando o assunto é grande e vai render vários artigos.",
    titulo: "Novo guia pilar",
    intencao: "informacional",
    resposta: `${MARCA_PENDENTE} a resposta completa da dúvida principal, em 3 ou 4 frases. Quem ler só este bloco já tem que sair sabendo o essencial.`,
    bodyHtml: [
      "<h2>O que decide na prática</h2>",
      `<p>${MARCA_PENDENTE} os dois ou três fatores que realmente mudam a escolha. Um por parágrafo.</p>`,
      "<h2>As opções, lado a lado</h2>",
      `<p>${MARCA_PENDENTE} a comparação. Se couber tabela, use tabela: é o formato que a IA cita melhor.</p>`,
      "<h2>Como escolher no seu caso</h2>",
      `<p>${MARCA_PENDENTE} os cenários. Fale de situação concreta, não de perfil genérico.</p>`,
      "<h2>Erros que aparecem sempre</h2>",
      `<p>${MARCA_PENDENTE} o que dá errado com frequência e como evitar.</p>`,
      "<h2>Continue por aqui</h2>",
      `<p>${MARCA_PENDENTE} os links para os artigos deste mesmo assunto. É esta seção que transforma páginas soltas em cluster.</p>`,
      CTA_MEDIDOR,
      CTA_LOJAS,
    ].join(""),
    faqs: [
      { question: `${MARCA_PENDENTE} a pergunta exata que as pessoas digitam.`, answer: `${MARCA_PENDENTE} a resposta em 2 ou 3 frases, completa sem depender do resto da página.` },
      { question: `${MARCA_PENDENTE} a segunda dúvida mais comum sobre o assunto.`, answer: `${MARCA_PENDENTE} a resposta objetiva, com dado concreto quando houver.` },
    ],
  },
  {
    id: "artigo",
    nome: "Artigo de dúvida",
    descricao: "Responde uma pergunta específica com profundidade.",
    quando: "Quando existe uma busca clara, do tipo pergunta.",
    titulo: "Novo artigo",
    intencao: "informacional",
    resposta: `${MARCA_PENDENTE} a resposta direta da pergunta do título, em 2 ou 3 frases. Sem rodeio e sem introdução.`,
    bodyHtml: [
      "<h2>Por que é assim</h2>",
      `<p>${MARCA_PENDENTE} a explicação do motivo. Aqui entra a fonte.</p>`,
      "<h2>O que fazer</h2>",
      `<p>${MARCA_PENDENTE} o passo a passo ou a recomendação prática.</p>`,
      "<h2>Quando a resposta muda</h2>",
      `<p>${MARCA_PENDENTE} as exceções. É o que separa conteúdo útil de conteúdo raso.</p>`,
      CTA_LOJAS,
    ].join(""),
    faqs: [
      { question: `${MARCA_PENDENTE} a pergunta exata que as pessoas digitam.`, answer: `${MARCA_PENDENTE} a resposta em 2 ou 3 frases, completa sem depender do resto da página.` },
      { question: `${MARCA_PENDENTE} a segunda dúvida mais comum sobre o assunto.`, answer: `${MARCA_PENDENTE} a resposta objetiva, com dado concreto quando houver.` },
    ],
  },
  {
    id: "comparativo",
    nome: "Comparativo",
    descricao: "Duas opções lado a lado e uma recomendação por cenário.",
    quando: "Para buscas do tipo A ou B, e A x B.",
    titulo: "Novo comparativo",
    intencao: "comercial",
    resposta: `${MARCA_PENDENTE} qual das duas opções ganha na maioria dos casos, e a condição em que a outra ganha. Diga isso já na primeira frase.`,
    bodyHtml: [
      "<h2>A diferença em uma frase</h2>",
      `<p>${MARCA_PENDENTE} o que de fato separa as duas.</p>`,
      "<h2>Comparação</h2>",
      // <caption> e <th scope> não são detalhe de acessibilidade só: a tabela é
      // o formato que a IA extrai melhor, e sem cabeçalho identificado ela
      // extrai números sem saber o que cada coluna significa.
      "<table>",
      `<caption>${MARCA_PENDENTE} o que esta tabela compara.</caption>`,
      "<tbody>",
      '<tr><th scope="col">Critério</th><th scope="col">Opção A</th><th scope="col">Opção B</th></tr>',
      `<tr><td>Preço</td><td>${MARCA_PENDENTE}</td><td>${MARCA_PENDENTE}</td></tr>`,
      `<tr><td>Durabilidade</td><td>${MARCA_PENDENTE}</td><td>${MARCA_PENDENTE}</td></tr>`,
      `<tr><td>Manutenção</td><td>${MARCA_PENDENTE}</td><td>${MARCA_PENDENTE}</td></tr>`,
      "</tbody></table>",
      "<h2>Escolha A se</h2>",
      `<p>${MARCA_PENDENTE} os casos concretos.</p>`,
      "<h2>Escolha B se</h2>",
      `<p>${MARCA_PENDENTE} os casos concretos.</p>`,
      CTA_LOJAS,
    ].join(""),
    faqs: [
      { question: `${MARCA_PENDENTE} a pergunta exata que as pessoas digitam.`, answer: `${MARCA_PENDENTE} a resposta em 2 ou 3 frases, completa sem depender do resto da página.` },
      { question: `${MARCA_PENDENTE} a segunda dúvida mais comum sobre o assunto.`, answer: `${MARCA_PENDENTE} a resposta objetiva, com dado concreto quando houver.` },
    ],
  },
  {
    id: "local",
    nome: "Página de cidade",
    descricao: "Conteúdo local, ligado a uma loja física.",
    quando: "Para busca com cidade ou bairro no meio.",
    titulo: "Novo conteúdo local",
    intencao: "local",
    resposta: `${MARCA_PENDENTE} onde fica a loja, o que dá para resolver indo até lá e como agendar. Cidade e bairro na primeira frase.`,
    bodyHtml: [
      "<h2>Onde fica e como chegar</h2>",
      `<p>${MARCA_PENDENTE} endereço, referência de quem vai de carro e de quem vai de transporte público.</p>`,
      "<h2>O que você resolve na loja</h2>",
      `<p>${MARCA_PENDENTE} prova de aro, gravação, ajuste, orçamento. Só o que essa unidade faz mesmo.</p>`,
      "<h2>Horário de atendimento</h2>",
      `<p>${MARCA_PENDENTE} os horários reais. Horário errado gera reclamação e derruba a nota no Google.</p>`,
      CTA_MEDIDOR,
    ].join(""),
    faqs: [
      { question: `${MARCA_PENDENTE} a pergunta exata que as pessoas digitam.`, answer: `${MARCA_PENDENTE} a resposta em 2 ou 3 frases, completa sem depender do resto da página.` },
      { question: `${MARCA_PENDENTE} a segunda dúvida mais comum sobre o assunto.`, answer: `${MARCA_PENDENTE} a resposta objetiva, com dado concreto quando houver.` },
    ],
  },
];

export function acharModelo(id: string): Modelo | undefined {
  return MODELOS.find((m) => m.id === id);
}
