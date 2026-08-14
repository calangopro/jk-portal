/**
 * Lê as perguntas frequentes escritas dentro do corpo do texto.
 *
 * O bloco de FAQ do editor gera `<section data-faq>` com H3 de pergunta e
 * parágrafos de resposta. Aqui esse trecho vira a mesma estrutura que o campo
 * de FAQ do formulário já produz, para o `FAQPage` sair inteiro sem obrigar
 * ninguém a redigitar a pergunta em dois lugares.
 *
 * Roda no servidor, sobre o HTML gravado, sem DOM e sem parser externo. É a
 * mesma escolha de `indice.ts`: o HTML aqui é o que o editor gerou, não HTML
 * arbitrário da internet, então varredura por expressão regular é previsível.
 */

export type PerguntaFrequente = { question: string; answer: string };

/** Tira tags e devolve texto legível, com entidade básica resolvida. */
function texto(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    // Tirar a tag deixa espaço colado na pontuação ("polimento ."). Sobra
    // visível no schema, então some aqui.
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

/**
 * Perguntas escritas no corpo, na ordem em que aparecem.
 *
 * Cada H3 abre uma pergunta, e tudo que vem depois dele até o próximo H3 (ou
 * até o fim da seção) é a resposta. Pergunta sem resposta é descartada: entraria
 * no schema como `Answer` vazia, que é pior que não entrar.
 */
export function faqsDoHtml(html: string | null | undefined): PerguntaFrequente[] {
  if (!html) return [];

  const achadas: PerguntaFrequente[] = [];
  const secoes = /<section[^>]*\bdata-faq\b[^>]*>([\s\S]*?)<\/section>/gi;

  let s: RegExpExecArray | null;
  while ((s = secoes.exec(html)) !== null) {
    const dentro = s[1];
    const partes = /<h3[^>]*>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3[^>]*>|$)/gi;

    let p: RegExpExecArray | null;
    while ((p = partes.exec(dentro)) !== null) {
      const question = texto(p[1]);
      const answer = texto(p[2]);
      if (question && answer) achadas.push({ question, answer });
    }
  }

  return achadas;
}

/**
 * Junta a FAQ do corpo com a do formulário, sem repetir pergunta.
 *
 * As duas convivem de propósito: conteúdo antigo tem tudo no campo, conteúdo
 * novo escreve no corpo, e nada obriga a migrar. A comparação ignora acento,
 * caixa e pontuação final, porque "Prata 950 escurece?" e "prata 950 escurece"
 * são a mesma pergunta e duas entradas iguais no `FAQPage` só poluem.
 */
export function faqsUnidas(
  doCorpo: PerguntaFrequente[],
  doFormulario: PerguntaFrequente[] | null | undefined,
): PerguntaFrequente[] {
  const chave = (q: string) =>
    q
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

  const vistas = new Set<string>();
  const juntas: PerguntaFrequente[] = [];

  for (const f of [...doCorpo, ...(doFormulario ?? [])]) {
    const k = chave(f.question);
    if (!k || vistas.has(k)) continue;
    vistas.add(k);
    juntas.push(f);
  }

  return juntas;
}
