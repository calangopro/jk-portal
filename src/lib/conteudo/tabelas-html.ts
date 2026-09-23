/**
 * Põe cada `<table>` do corpo dentro de uma caixa que rola de lado.
 *
 * A rolagem não pode morar na própria tabela: `display: block` numa `<table>`
 * desmonta a grade (cabeçalho e corpo viram tabelas separadas, com colunas
 * desalinhadas, e a legenda fica espremida numa coluna). Na caixa em volta,
 * a tabela continua sendo tabela e só a caixa rola.
 *
 * A caixa é uma região com nome e foco, porque conteúdo que rola precisa ser
 * alcançável pelo teclado. O nome sai da legenda, quando existe.
 *
 * O editor não passa por aqui: lá o TipTap já envolve a tabela num
 * `.tableWrapper`, e o CSS trata as duas caixas igual.
 *
 * Expressão regular, e não parser, pela mesma razão de `comBasePathNosLinks`:
 * o HTML é o do nosso editor, e o editor não aninha tabela dentro de tabela.
 */
const TABELA = /<table\b[^>]*>[\s\S]*?<\/table>/gi;
const LEGENDA = /<caption\b[^>]*>([\s\S]*?)<\/caption>/i;

export function comTabelasRolaveis(html: string): string {
  if (!html || !html.includes("<table")) return html;
  return html.replace(TABELA, (tabela) => {
    const legenda = LEGENDA.exec(tabela)?.[1]
      ?.replace(/<[^>]+>/g, "")
      .replace(/"/g, "&quot;")
      .trim();
    const nome = legenda ? ` aria-label="${legenda}"` : "";
    return `<div class="tabela-rolavel" role="region" tabindex="0"${nome}>${tabela}</div>`;
  });
}
