import { ehFerramenta, type SlugDeFerramenta } from "@/lib/ferramentas/registro";

/**
 * Corta o corpo do artigo nos marcadores de ferramenta.
 *
 * O corpo vai para a página como HTML servido de uma vez, o que é o certo para
 * busca e para velocidade, e o que impede uma ferramenta interativa de morar lá
 * dentro. A saída é cortar: o HTML vira uma lista de pedaços, e a página
 * intercala os componentes entre eles.
 *
 * É a mesma ideia de `comIndice`: varredura por expressão regular sobre um HTML
 * que o editor gerou, e não sobre HTML arbitrário da internet.
 */

export type Pedaco =
  | { tipo: "html"; valor: string }
  | { tipo: "ferramenta"; slug: SlugDeFerramenta };

export function separarFerramentas(html: string | null | undefined): Pedaco[] {
  if (!html) return [];

  const marcador = /<div[^>]*\sdata-ferramenta="([^"]*)"[^>]*>\s*<\/div>/gi;
  const pedacos: Pedaco[] = [];
  let ultimo = 0;
  let m: RegExpExecArray | null;

  while ((m = marcador.exec(html)) !== null) {
    const slug = m[1];
    // Marcador de ferramenta que não existe mais fica no HTML e some da tela:
    // melhor um buraco silencioso que um erro na cara de quem lê.
    if (!ehFerramenta(slug)) continue;

    const antes = html.slice(ultimo, m.index);
    if (antes.trim()) pedacos.push({ tipo: "html", valor: antes });
    pedacos.push({ tipo: "ferramenta", slug });
    ultimo = m.index + m[0].length;
  }

  const resto = html.slice(ultimo);
  if (resto.trim()) pedacos.push({ tipo: "html", valor: resto });

  return pedacos;
}

/** Só há o que intercalar quando existe pelo menos um marcador válido. */
export function temFerramenta(pedacos: Pedaco[]): boolean {
  return pedacos.some((p) => p.tipo === "ferramenta");
}
