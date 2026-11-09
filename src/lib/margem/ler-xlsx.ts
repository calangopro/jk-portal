/**
 * Leitor mínimo de .xlsx: só VALORES de célula, por aba.
 *
 * Existe para a planilha de custos que o dono devolve. Biblioteca de planilha
 * pesa centenas de kB e só precisamos de número e texto, então o arquivo é
 * aberto na mão: .xlsx é um zip, e o `DecompressionStream("deflate-raw")` do
 * navegador (e do Node 22) descompacta. Fórmula não é avaliada: vale o valor
 * que o Excel, o Google Planilhas ou o Numbers guardaram junto, e as células
 * que importam (gramas, resto, custo) são digitadas, não calculadas.
 *
 * Sem `@/` e sem DOM, para rodar no teste `npm run verificar:margem`.
 */

export type Celula = string | number | boolean | null;
/** Linhas a partir de 1, colunas por letra: abas["Parâmetros"][2]["B"]. */
export type Aba = Record<number, Record<string, Celula>>;
export type Pasta = Record<string, Aba>;

export class ArquivoInvalido extends Error {}

// ------------------------------------------------------------------ zip

type Entrada = { nome: string; metodo: number; tamanho: number; deslocamento: number };

function entradasDoZip(b: Uint8Array): Map<string, Entrada> {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let fim = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65_557); i--) {
    if (v.getUint32(i, true) === 0x06054b50) {
      fim = i;
      break;
    }
  }
  if (fim < 0) throw new ArquivoInvalido("O arquivo não é uma planilha .xlsx.");
  const total = v.getUint16(fim + 10, true);
  let p = v.getUint32(fim + 16, true);
  const decodificar = new TextDecoder();
  const mapa = new Map<string, Entrada>();
  for (let k = 0; k < total; k++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new ArquivoInvalido("O zip da planilha está corrompido.");
    const metodo = v.getUint16(p + 10, true);
    const tamanho = v.getUint32(p + 20, true);
    const nLen = v.getUint16(p + 28, true);
    const xLen = v.getUint16(p + 30, true);
    const cLen = v.getUint16(p + 32, true);
    const deslocamento = v.getUint32(p + 42, true);
    const nome = decodificar.decode(b.subarray(p + 46, p + 46 + nLen));
    mapa.set(nome, { nome, metodo, tamanho, deslocamento });
    p += 46 + nLen + xLen + cLen;
  }
  return mapa;
}

async function lerEntrada(b: Uint8Array, e: Entrada): Promise<string> {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const inicio = e.deslocamento + 30 + v.getUint16(e.deslocamento + 26, true) + v.getUint16(e.deslocamento + 28, true);
  const dados = b.subarray(inicio, inicio + e.tamanho);
  if (e.metodo === 0) return new TextDecoder().decode(dados);
  if (e.metodo !== 8) throw new ArquivoInvalido("A planilha usa uma compactação que não sei abrir.");
  const fluxo = new Blob([dados as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Response(fluxo).text();
}

// ------------------------------------------------------------------ xml

const ENTIDADES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const desescapar = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) =>
    e[0] === "#"
      ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10))
      : (ENTIDADES[e] ?? m),
  );

const atributo = (tag: string, nome: string) => {
  const m = tag.match(new RegExp(`\\s${nome}="([^"]*)"`));
  return m ? desescapar(m[1]) : null;
};

/** Junta todo <t> de um trecho (texto rico vem picado em vários). */
const textos = (xml: string) =>
  Array.from(xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g))
    .map((m) => desescapar(m[1]))
    .join("");

function lerAba(xml: string, compartilhados: string[]): Aba {
  const aba: Aba = {};
  for (const c of xml.matchAll(/<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const tag = ` ${c[1]}`;
    const ref = atributo(tag, "r");
    if (!ref) continue;
    const m = ref.match(/^([A-Z]+)(\d+)$/);
    if (!m) continue;
    const corpo = c[2] ?? "";
    const tipo = atributo(tag, "t");
    const v = corpo.match(/<v>([\s\S]*?)<\/v>/)?.[1];
    let valor: Celula = null;
    if (tipo === "s" && v !== undefined) valor = compartilhados[Number(v)] ?? null;
    else if (tipo === "inlineStr") valor = textos(corpo);
    else if (tipo === "str" && v !== undefined) valor = desescapar(v);
    else if (tipo === "b" && v !== undefined) valor = v === "1";
    else if (v !== undefined && v !== "") valor = Number(v);
    if (valor === "" || (typeof valor === "number" && !Number.isFinite(valor))) valor = null;
    const linha = Number(m[2]);
    (aba[linha] ??= {})[m[1]] = valor;
  }
  return aba;
}

export async function lerXlsx(arquivo: Uint8Array): Promise<Pasta> {
  const zip = entradasDoZip(arquivo);
  const ler = async (nome: string) => {
    const e = zip.get(nome);
    return e ? lerEntrada(arquivo, e) : null;
  };

  const livro = await ler("xl/workbook.xml");
  const relacoes = await ler("xl/_rels/workbook.xml.rels");
  if (!livro || !relacoes) throw new ArquivoInvalido("O arquivo não é uma planilha .xlsx.");

  const compartilhadosXml = await ler("xl/sharedStrings.xml");
  const compartilhados = compartilhadosXml
    ? Array.from(compartilhadosXml.matchAll(/<si>([\s\S]*?)<\/si>/g)).map((m) => textos(m[1]))
    : [];

  const alvo = new Map<string, string>();
  for (const r of relacoes.matchAll(/<Relationship\s[^>]*>/g)) {
    const id = atributo(` ${r[0].slice(13)}`, "Id");
    const caminho = atributo(` ${r[0].slice(13)}`, "Target");
    if (id && caminho) alvo.set(id, caminho.startsWith("/") ? caminho.slice(1) : `xl/${caminho}`);
  }

  const pasta: Pasta = {};
  for (const s of livro.matchAll(/<sheet\s[^>]*>/g)) {
    const nome = atributo(` ${s[0].slice(6)}`, "name");
    const id = atributo(` ${s[0].slice(6)}`, "r:id");
    const caminho = id ? alvo.get(id) : null;
    if (!nome || !caminho) continue;
    const xml = await ler(caminho);
    if (xml) pasta[nome] = lerAba(xml, compartilhados);
  }
  return pasta;
}
