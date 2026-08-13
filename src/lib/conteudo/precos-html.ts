/**
 * Preço fresco nos cards de produto, na hora de servir a página.
 *
 * O card guarda o preço no próprio HTML do artigo. Isso é bom (renderiza sem
 * consulta, e nunca fica em branco) e é ruim: o preço congela no dia em que o
 * texto foi escrito, e a Tray muda preço. Um guia de dois meses atrás passaria
 * a anunciar um valor que a loja não pratica mais, o que é problema de confiança
 * e de consumidor, não de estilo.
 *
 * Aqui o valor gravado vira só o plano B. O que aparece sai da tabela
 * `products`, que a sincronização da Tray mantém em dia.
 *
 * ## Por que dá para fazer isso com expressão regular
 *
 * Normalmente mexer em HTML com regex é receita de bug. Aqui vale porque o
 * alvo não é HTML qualquer: é markup gerado por `cartaoEmHtml()`
 * (src/lib/editor/VitrineNode.ts), onde preço, preço antigo, selo e aviso saem
 * como elementos FOLHA, marcados com `data-*-de="<id>"` e sem nenhum filho.
 * Cada troca substitui o elemento inteiro, abertura e fechamento, então
 * aparecer e desaparecer também funciona.
 *
 * O contrato está escrito nos dois arquivos. Quebrou de um lado, quebra do
 * outro, e o preço passa a mentir sem avisar.
 */

export type LinhaDeProduto = {
  id: string;
  price: number | null;
  promotional_price: number | null;
  status: string | null;
  availability_text: string | null;
};

function moeda(valor: number | null): string | null {
  if (valor == null || !Number.isFinite(valor) || valor <= 0) return null;
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function escaparHtml(t: string): string {
  return t
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Reescreve um elemento folha inteiro. Sem texto, ele sai com `hidden`. */
function trocarFolha(
  html: string,
  tag: string,
  classe: string,
  marca: string,
  id: string,
  texto: string | null,
): string {
  // `[^<]*` garante que o casamento pare no primeiro filho, se algum dia
  // aparecer um. Melhor não trocar nada do que trocar o pedaço errado.
  const alvo = new RegExp(
    `<${tag} class="${classe}"([^>]*)${marca}="${id}"([^>]*)>[^<]*</${tag}>`,
    "g",
  );
  const novo = texto
    ? `<${tag} class="${classe}" ${marca}="${id}">${escaparHtml(texto)}</${tag}>`
    : `<${tag} class="${classe}" ${marca}="${id}" hidden=""></${tag}>`;
  return html.replace(alvo, novo);
}

/**
 * Aplica as linhas do catálogo no HTML. Parte pura, sem banco, para dar para
 * testar o contrato do markup sem subir nada.
 */
export function aplicarPrecos(html: string, linhas: LinhaDeProduto[]): string {
  let saida = html;
  for (const linha of linhas) {
    const id = linha.id;
    // Promoção vence quando existe e é menor, a mesma regra da inserção.
    const temPromo =
      linha.promotional_price != null &&
      linha.price != null &&
      linha.promotional_price < linha.price;

    const preco = moeda(temPromo ? linha.promotional_price : linha.price);
    const antigo = temPromo ? moeda(linha.price) : null;

    let desconto: string | null = null;
    if (temPromo && linha.price && linha.promotional_price) {
      desconto = `${Math.round((1 - linha.promotional_price / linha.price) * 100)}% OFF`;
    }

    const disponivel = linha.status === "available";
    const aviso = !disponivel ? "Sem estoque no momento" : linha.availability_text || null;

    saida = trocarFolha(saida, "strong", "produto-card__preco", "data-preco-de", id, preco);
    saida = trocarFolha(saida, "s", "produto-card__antigo", "data-antigo-de", id, antigo);
    saida = trocarFolha(saida, "span", "produto-card__selo", "data-selo-de", id, desconto);
    saida = trocarFolha(saida, "span", "produto-card__aviso", "data-aviso-de", id, aviso);
  }
  return saida;
}

