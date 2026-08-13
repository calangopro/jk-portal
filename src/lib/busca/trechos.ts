import { createHash } from "node:crypto";
import { secoesDoHtml } from "@/lib/content/indice";
import type { Content, Location } from "@/lib/content/types";

/**
 * Transforma conteúdo em trechos indexáveis.
 *
 * A unidade é a SEÇÃO, não a página. Quem busca "em qual dedo se usa" merece
 * cair no parágrafo que responde, e não no topo de um guia de dez seções. Por
 * isso cada trecho carrega a âncora do H2 e o resultado vira `/guia/slug#ancora`.
 */

export type Trecho = {
  ordem: number;
  origem: "corpo" | "resposta" | "resumo" | "faq" | "loja";
  secao: string | null;
  ancora: string | null;
  texto: string;
  hash: string;
};

/** Teto por trecho. Acima disso o embedding vira uma média de assuntos. */
const TETO = 1200;
/** Sobreposição entre pedaços, para a frase cortada não sumir dos dois lados. */
const SOBRA = 150;

export function hashDoTexto(texto: string): string {
  return createHash("sha256").update(texto).digest("hex").slice(0, 32);
}

/**
 * HTML para texto puro, preservando o que carrega significado.
 *
 * A ordem das operações importa: primeiro sai o que é ruído comercial, depois a
 * tabela vira linhas legíveis, e só então as tags caem. Fazer o strip antes
 * transformaria a tabela numa fila de palavras sem relação entre si.
 */
export function htmlParaTexto(html: string): string {
  let t = html;

  // Vídeo e cartão de produto são widget, não texto. Indexar o nome do produto
  // repetido em todo guia empurra a busca para o catálogo, que é justamente o
  // que este portal não quer ser.
  t = t.replace(/<div[^>]*data-youtube-video[^>]*>[\s\S]*?<\/div>/gi, " ");
  // Vitrine de produtos, e o card solto que existia antes dela. Nome e preço
  // de aliança não são conteúdo do guia: entrariam no índice de busca como se
  // fossem texto do autor e sujariam o resultado.
  t = t.replace(/<div[^>]*data-vitrine[^>]*>[\s\S]*?<\/div>/gi, " ");
  t = t.replace(/<div[^>]*data-produto[^>]*>[\s\S]*?<\/div>/gi, " ");

  // Tabela comparativa é conteúdo de alto valor, e é o formato que IA cita bem.
  // Vira uma linha por `<tr>`, com as células separadas, e a legenda na frente.
  t = t.replace(/<caption[^>]*>([\s\S]*?)<\/caption>/gi, " $1. ");
  t = t.replace(/<\/t[dh]>\s*<t[dh][^>]*>/gi, " | ");
  t = t.replace(/<\/tr>/gi, ". ");

  // Imagem contribui pelo alt, que é texto escrito para quem não vê a foto.
  t = t.replace(/<img\b[^>]*\balt\s*=\s*"([^"]*)"[^>]*>/gi, " $1. ");

  // Bloco vira separação de frase, para palavras de parágrafos diferentes não
  // colarem uma na outra e formarem termo que não existe.
  t = t.replace(/<\/(p|li|h[1-6]|div|figcaption|blockquote)>/gi, ". ");

  t = t.replace(/<[^>]*>/g, " ");
  t = t
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  return t.replace(/\s+/g, " ").replace(/\s+([.,;:])/g, "$1").replace(/(\.\s*)+/g, ". ").trim();
}

/** Quebra texto longo em pedaços, cortando em fim de frase quando dá. */
function partir(texto: string): string[] {
  if (texto.length <= TETO) return [texto];

  const pedacos: string[] = [];
  let inicio = 0;

  while (inicio < texto.length) {
    let fim = Math.min(inicio + TETO, texto.length);

    if (fim < texto.length) {
      // Recua até o último ponto final, para não cortar no meio da frase.
      const ponto = texto.lastIndexOf(". ", fim);
      if (ponto > inicio + TETO * 0.5) fim = ponto + 1;
    }

    pedacos.push(texto.slice(inicio, fim).trim());
    if (fim >= texto.length) break;

    // A sobreposição recomeça na palavra inteira mais próxima. Cortar no meio
    // ("...ciadas ao noivado") suja o trecho que aparece no resultado da busca
    // e ainda entrega ao embedding um pedaço de palavra que não existe.
    const alvo = Math.max(fim - SOBRA, inicio + 1);
    const espaco = texto.indexOf(" ", alvo);
    inicio = espaco > alvo && espaco < fim ? espaco + 1 : alvo;
  }

  return pedacos.filter((p) => p.length > 0);
}

/** Trecho curto demais não ajuda ninguém e só suja o ranking. */
const MINIMO = 40;

export function trechosDoGuia(guia: Content): Trecho[] {
  const trechos: Trecho[] = [];
  let ordem = 0;

  const juntar = (
    origem: Trecho["origem"],
    texto: string,
    secao: string | null,
    ancora: string | null,
  ) => {
    const limpo = texto.trim();
    if (limpo.length < MINIMO) return;
    for (const pedaco of partir(limpo)) {
      trechos.push({ ordem: ordem++, origem, secao, ancora, texto: pedaco, hash: hashDoTexto(pedaco) });
    }
  };

  // A resposta rápida vem primeiro de propósito: é o trecho mais citável do
  // guia, o que responde a dúvida sozinho e fora de contexto.
  if (guia.answer) juntar("resposta", guia.answer, null, null);
  if (guia.excerpt) juntar("resumo", guia.excerpt, null, null);

  const corpo = guia.bodyHtml ?? guia.bodyMd ?? "";
  for (const secao of secoesDoHtml(corpo)) {
    const texto = htmlParaTexto(secao.html);
    if (!texto) continue;
    // O título da seção entra no texto porque muitas vezes ele É a pergunta
    // ("Em qual dedo se usa a aliança de namoro"), e a resposta abaixo não a
    // repete.
    const comTitulo = secao.titulo ? `${secao.titulo}. ${texto}` : texto;
    juntar("corpo", comTitulo, secao.titulo, secao.ancora);
  }

  for (const faq of guia.faqs ?? []) {
    if (!faq.question || !faq.answer) continue;
    juntar("faq", `${faq.question} ${faq.answer}`, faq.question, "perguntas");
  }

  return trechos;
}

/**
 * Trecho de loja.
 *
 * A palavra "loja" entra no texto de propósito, e isso foi medido: a busca usa
 * `websearch_to_tsquery`, que faz E implícito, então "loja em osasco" vira
 * `'loj' & 'osasc'`. Com o texto trazendo só "Shopping União de Osasco", o
 * termo `loj` não casava e a consulta mais natural do mundo devolvia vazio.
 */
export function trechosDaLoja(loja: Location): Trecho[] {
  const partes = [
    `Loja JK Alianças ${loja.name}`,
    loja.address,
    loja.addressLocality,
    loja.addressRegion,
    loja.mallName,
    (loja.services ?? []).join(", "),
    loja.about,
    "Aliança e joia com atendimento presencial, aro de prova e ajuste no dedo.",
  ].filter(Boolean);

  const texto = htmlParaTexto(partes.join(". "));
  if (texto.length < MINIMO) return [];

  return [{ ordem: 0, origem: "loja", secao: null, ancora: null, texto, hash: hashDoTexto(texto) }];
}
