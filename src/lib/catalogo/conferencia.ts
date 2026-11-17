/**
 * Conferência entre dois arquivos de catálogo: o que a Tray publica e o que o
 * painel monta (`arquivo.ts`). É o que diz, antes de 01/12/2026, se trocar o
 * endereço no Commerce Manager muda alguma coisa no catálogo do Meta.
 *
 * Puro: recebe o texto já decodificado (o da Tray vem em ISO-8859-1, quem lê
 * decide a codificação) e devolve as diferenças. Quem baixa, explica e imprime
 * é `scripts/teste-catalogo.mts`.
 */

import type { Campo, ItemDoArquivo } from "./arquivo.ts";

const ENTIDADES_DO_XML: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

/**
 * Uma passada só de decodificação, como um leitor de XML faz. É por isso que o
 * `&#38;gt;` da Tray chega ao Meta como o texto "&gt;" (ver `SEPARADOR_DO_TIPO`).
 */
function decodificarXml(texto: string): string {
  return texto.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (inteira, corpo: string) => {
    if (corpo[0] === "#") {
      const n = corpo[1] === "x" || corpo[1] === "X" ? parseInt(corpo.slice(2), 16) : parseInt(corpo.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : inteira;
    }
    return ENTIDADES_DO_XML[corpo] ?? inteira;
  });
}

function valorDoCampo(cru: string): string {
  const cdata = /^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/.exec(cru);
  return cdata ? cdata[1] : decodificarXml(cru);
}

/** A codificação que a declaração do XML anuncia, para quem vai decodificar os bytes. */
export function codificacaoDoXml(inicio: string): "utf-8" | "iso-8859-1" {
  const m = /<\?xml[^>]*encoding=["']([^"']+)["']/i.exec(inicio);
  return m && /8859-1|latin-?1/i.test(m[1]) ? "iso-8859-1" : "utf-8";
}

/**
 * Os itens de um arquivo RSS com o namespace `g:`. Aceita o campo com ou sem o
 * prefixo, e CDATA. Não é um leitor de XML completo: é o bastante para os dois
 * arquivos que a conferência compara.
 */
export function lerArquivo(xml: string): ItemDoArquivo[] {
  const itens: ItemDoArquivo[] = [];
  for (const m of xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/g)) {
    const campos: Campo[] = [];
    for (const c of m[1].matchAll(/<(?:g:)?([a-zA-Z_]+)\b[^>]*?(?:\/>|>([\s\S]*?)<\/(?:g:)?\1>)/g)) {
      campos.push([c[1], valorDoCampo(c[2] ?? "")]);
    }
    const id = campos.find(([n]) => n === "id")?.[1].trim();
    if (id) itens.push({ id, campos });
  }
  return itens;
}

/** Os campos que a conferência olha, na ordem do relatório. */
export const CAMPOS_CONFERIDOS = [
  "title", "link", "price", "sale_price", "sale_price_effective_date", "availability", "image_link",
  "additional_image_link", "description", "brand", "product_type", "mpn", "gtin", "condition",
  "shipping_weight", "shipping_size",
] as const;

/** Diferença nestes campos muda o que o anúncio mostra ou para onde ele leva. */
export const CAMPOS_CRITICOS = new Set<string>(["price", "sale_price", "sale_price_effective_date", "availability", "link", "image_link"]);

export type DiferencaDeCampo = { id: string; tray: string[]; painel: string[] };

export type Conferencia = {
  naTray: number;
  noPainel: number;
  /** Códigos que a Tray tem e o painel não. */
  soNaTray: string[];
  /** Códigos que o painel tem e a Tray não. */
  soNoPainel: string[];
  /** Códigos repetidos dentro do mesmo arquivo. */
  repetidos: { tray: string[]; painel: string[] };
  /** Itens presentes nos dois, idênticos em todos os campos conferidos. */
  iguais: number;
  porCampo: Record<string, DiferencaDeCampo[]>;
  /** Quantas diferenças pedem atenção antes de trocar o endereço. */
  criticas: number;
};

const valores = (item: ItemDoArquivo, campo: string) => item.campos.filter(([n]) => n === campo).map(([, v]) => v);

function repetidos(itens: ItemDoArquivo[]): string[] {
  const vistos = new Set<string>();
  const dobrados = new Set<string>();
  for (const i of itens) (vistos.has(i.id) ? dobrados : vistos).add(i.id);
  return [...dobrados];
}

const porNumero = (a: string, b: string) => Number(a) - Number(b) || a.localeCompare(b);

export function compararArquivos(tray: ItemDoArquivo[], painel: ItemDoArquivo[]): Conferencia {
  const doPainel = new Map(painel.map((i) => [i.id, i]));
  const daTray = new Map(tray.map((i) => [i.id, i]));
  const porCampo: Record<string, DiferencaDeCampo[]> = {};
  let iguais = 0;

  for (const t of daTray.values()) {
    const p = doPainel.get(t.id);
    if (!p) continue;
    let igual = true;
    for (const campo of CAMPOS_CONFERIDOS) {
      const a = valores(t, campo);
      const b = valores(p, campo);
      if (a.length === b.length && a.every((v, i) => v === b[i])) continue;
      igual = false;
      (porCampo[campo] ??= []).push({ id: t.id, tray: a, painel: b });
    }
    if (igual) iguais++;
  }

  const soNaTray = [...daTray.keys()].filter((id) => !doPainel.has(id)).sort(porNumero);
  const soNoPainel = [...doPainel.keys()].filter((id) => !daTray.has(id)).sort(porNumero);
  const criticas =
    soNaTray.length + soNoPainel.length +
    Object.entries(porCampo).filter(([c]) => CAMPOS_CRITICOS.has(c)).reduce((s, [, l]) => s + l.length, 0);

  return {
    naTray: tray.length,
    noPainel: painel.length,
    soNaTray,
    soNoPainel,
    repetidos: { tray: repetidos(tray), painel: repetidos(painel) },
    iguais,
    porCampo,
    criticas,
  };
}

/**
 * Onde dois textos começam a diferir, com um pedaço de cada lado. Serve para o
 * relatório mostrar a diferença de uma descrição de 5.000 caracteres sem
 * imprimir as duas inteiras.
 */
export function ondeDifere(a: string, b: string, contexto = 30): { posicao: number; tray: string; painel: string } | null {
  if (a === b) return null;
  const x = Array.from(a);
  const y = Array.from(b);
  let i = 0;
  while (i < x.length && i < y.length && x[i] === y[i]) i++;
  const de = Math.max(0, i - 10);
  return { posicao: i, tray: x.slice(de, i + contexto).join(""), painel: y.slice(de, i + contexto).join("") };
}
