/**
 * Extrai o índice do conteúdo a partir dos H2 e coloca âncoras neles.
 *
 * Roda no servidor, sobre o HTML gerado pelo editor, então a âncora já vai no
 * HTML entregue ao Google, sem depender de JavaScript no navegador.
 */

export type ItemIndice = { id: string; titulo: string };

function paraId(texto: string, usados: Set<string>): string {
  const base =
    texto
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/<[^>]*>/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "secao";

  let id = base;
  let n = 2;
  while (usados.has(id)) id = `${base}-${n++}`;
  usados.add(id);
  return id;
}

/**
 * Prepara as imagens do corpo para carregar bem.
 *
 * A PRIMEIRA imagem costuma estar acima da dobra e muitas vezes é o maior
 * elemento da tela, então adiar o carregamento dela atrasa o LCP de graça.
 * Ela ganha prioridade; as seguintes continuam adiadas.
 *
 * Também garante `decoding="async"`, que evita travar a pintura da página.
 */
function prepararImagens(
  html: string,
  dimensoes?: Map<string, { width: number; height: number }>,
): string {
  let primeira = true;
  return html.replace(/<img\b[^>]*>/gi, (tag) => {
    let nova = tag;

    // Escreve a dimensão real quando ela não está na tag, o que acontece em
    // conteúdo salvo antes de o editor passar a gravar isso.
    if (dimensoes && !/width\s*=/i.test(nova)) {
      const src = /src\s*=\s*"([^"]+)"/i.exec(nova)?.[1];
      const d = src ? dimensoes.get(src) : undefined;
      if (d) {
        nova = nova.replace(/<img/i, `<img width="${d.width}" height="${d.height}"`);
      }
    }

    if (primeira) {
      primeira = false;
      nova = nova.replace(/\s*loading\s*=\s*"[^"]*"/i, "");
      if (!/fetchpriority/i.test(nova)) {
        nova = nova.replace(/<img/i, '<img fetchpriority="high"');
      }
    } else if (!/loading\s*=/i.test(nova)) {
      nova = nova.replace(/<img/i, '<img loading="lazy"');
    }

    if (!/decoding\s*=/i.test(nova)) {
      nova = nova.replace(/<img/i, '<img decoding="async"');
    }
    return nova;
  });
}

/** Devolve o HTML com id nos H2, imagens preparadas, e a lista do índice. */
export function comIndice(
  html: string,
  dimensoes?: Map<string, { width: number; height: number }>,
): { html: string; indice: ItemIndice[] } {
  if (!html) return { html, indice: [] };

  const indice: ItemIndice[] = [];
  const usados = new Set<string>();

  const novo = html.replace(
    /<h2([^>]*)>([\s\S]*?)<\/h2>/gi,
    (inteiro, atributos: string, conteudo: string) => {
      const texto = conteudo.replace(/<[^>]*>/g, "").trim();
      if (!texto) return inteiro;

      // Respeita id já existente, se houver.
      const idExistente = /id\s*=\s*"([^"]+)"/i.exec(atributos)?.[1];
      const id = idExistente ?? paraId(texto, usados);
      indice.push({ id, titulo: texto });

      const attrs = idExistente ? atributos : `${atributos} id="${id}"`;
      return `<h2${attrs}>${conteudo}</h2>`;
    },
  );

  return { html: prepararImagens(novo, dimensoes), indice };
}
