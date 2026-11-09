/**
 * A planilha que leva as fotos aprovadas para a Tray.
 *
 * ## Por que a planilha parte da exportação da própria Tray
 *
 * O portal não tem credencial da API da Tray (lê a loja pela busca pública), e
 * ninguém documenta o que a importação da Tray faz com coluna em branco. Em
 * outras plataformas, coluna vazia apaga o campo. Mandar uma planilha só com
 * código e imagens arriscaria zerar descrição, SEO, peso e estoque de cada
 * produto que recebesse foto nova.
 *
 * Por isso a pessoa exporta da Tray na hora, escolhe o arquivo no painel, e a
 * planilha que volta é a MESMA exportação, linha por linha, com só as colunas
 * de imagem trocadas e só as linhas dos produtos com foto aprovada. Tudo que a
 * importação regravar é o que a loja já tinha.
 *
 * O risco que sobra é a exportação velha: importar um arquivo de ontem
 * devolveria o preço de ontem. A trava é comparar o preço de cada linha com o
 * espelho do portal (que a sincronização refaz de 15 em 15 minutos) e deixar
 * de fora toda linha que discorda.
 *
 * Formato da exportação, conferido em 09/11/2026 no arquivo real: ISO-8859-1,
 * `;` entre campos, TODO campo entre aspas (inclusive os vazios), fim de linha
 * CRLF, e as imagens em "Imagem principal", "Imagem 2" a "Imagem 4" e
 * "Imagens adicionais" (separadas por vírgula e espaço).
 *
 * Função pura, sem `server-only` e sem atalho `@/`: roda no navegador (o
 * arquivo tem 8 MB, e uma Server Action aceita 1 MB) e no teste
 * `npm run verificar:planilha`.
 */

export type PedidoDeFoto = {
  /** "Código produto" da Tray, que é o `tray_id` do portal. */
  codigo: string;
  nome: string;
  /** Preço de tabela e promocional como o espelho do portal tem agora. */
  preco: number | null;
  precoPromocional: number | null;
  /** As três posições da loja: 1 produto, 2 face, 3 uso. */
  produto?: string | null;
  face?: string | null;
  uso?: string | null;
  /** As fotos novas que a loja já mostra, por posição (para trocar só uma). */
  naLoja?: { produto?: string; face?: string; uso?: string };
};

export type PrecoQueDiscorda = {
  codigo: string;
  nome: string;
  naPlanilha: string;
  noPortal: string;
};

export type ResultadoDaPlanilha = {
  arquivo: Uint8Array;
  /** Códigos que entraram no arquivo. */
  incluidos: string[];
  /** Pedidos cujo código não está na exportação (produto apagado ou de outra loja). */
  naoAchados: string[];
  /** Linhas deixadas de fora porque o preço da exportação não bate com o da loja agora. */
  precoDiferente: PrecoQueDiscorda[];
};

export const COLUNAS_DE_IMAGEM = ["Imagem principal", "Imagem 2", "Imagem 3", "Imagem 4"] as const;
export const COLUNA_ADICIONAIS = "Imagens adicionais";
const COLUNA_CODIGO = "Código produto";
const COLUNA_PRECO = "Preço venda";
const COLUNA_PROMO = "Preço promoção";

// ------------------------------------------------------------------ ler

/** ISO-8859-1 é um byte por caractere, igual ao código do caractere. */
function decodificar(bytes: Uint8Array): string {
  return new TextDecoder("iso-8859-1").decode(bytes);
}

/** CSV com `;`, aspas dobradas como escape e quebra de linha dentro de aspas. */
export function lerCsv(texto: string): { linhas: string[][]; fimDeLinha: string } {
  const fimDeLinha = texto.includes("\r\n") ? "\r\n" : "\n";
  const linhas: string[][] = [];
  let linha: string[] = [];
  let campo = "";
  let dentro = false;
  let i = 0;

  while (i < texto.length) {
    const c = texto[i];
    if (dentro) {
      if (c === '"') {
        if (texto[i + 1] === '"') {
          campo += '"';
          i += 2;
          continue;
        }
        dentro = false;
        i++;
        continue;
      }
      campo += c;
      i++;
      continue;
    }
    if (c === '"') {
      dentro = true;
      i++;
      continue;
    }
    if (c === ";") {
      linha.push(campo);
      campo = "";
      i++;
      continue;
    }
    if (c === "\r" && texto[i + 1] === "\n") {
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = "";
      i += 2;
      continue;
    }
    if (c === "\n") {
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = "";
      i++;
      continue;
    }
    campo += c;
    i++;
  }
  if (campo !== "" || linha.length > 0) {
    linha.push(campo);
    linhas.push(linha);
  }
  return { linhas, fimDeLinha };
}

// ------------------------------------------------------------------ escrever

export function escreverCsv(linhas: string[][], fimDeLinha = "\r\n"): Uint8Array {
  const texto =
    linhas.map((l) => l.map((c) => `"${c.replace(/"/g, '""')}"`).join(";")).join(fimDeLinha) + fimDeLinha;
  const bytes = new Uint8Array(texto.length);
  for (let i = 0; i < texto.length; i++) {
    const codigo = texto.charCodeAt(i);
    // Fora do ISO-8859-1 não existe na exportação; se aparecer, vira "?".
    bytes[i] = codigo <= 0xff ? codigo : 0x3f;
  }
  return bytes;
}

// ------------------------------------------------------------------ imagens

/** As imagens da linha, na ordem em que a loja mostra. */
export function imagensDaLinha(linha: string[], cabecalho: string[]): string[] {
  const fixas = COLUNAS_DE_IMAGEM.map((n) => linha[cabecalho.indexOf(n)] ?? "");
  const extras = (linha[cabecalho.indexOf(COLUNA_ADICIONAIS)] ?? "").split(",");
  return [...fixas, ...extras].map((u) => u.trim()).filter((u) => u.startsWith("http"));
}

/**
 * A nova ordem, como a JK já monta na loja: produto, face e uso nas posições
 * 1, 2 e 3, e depois as outras fotos que a loja já tinha, sem repetir.
 *
 * Cada posição é decidida sozinha: a foto aprovada agora, senão a foto nova
 * que a loja já mostra naquela posição (`naLoja`), senão (só na 1) a foto
 * principal de antes. Trocar só a face de um produto já refeito mantém o
 * produto e o uso onde estão. A principal antiga do fornecedor sai quando
 * chega produto novo, porque a nova é feita a partir dela; as outras fotos do
 * fornecedor ficam atrás, como nos 18 modelos refeitos em 08 e 09/11/2026.
 */
export function novaOrdemDeImagens(
  atuais: string[],
  novas: { produto?: string | null; face?: string | null; uso?: string | null; naLoja?: PedidoDeFoto["naLoja"] },
): string[] {
  const [principalAtual] = atuais;
  const ja = novas.naLoja ?? {};
  const produto = novas.produto || ja.produto || principalAtual;
  const face = novas.face || ja.face;
  const uso = novas.uso || ja.uso;
  const tiradas = new Set([ja.produto, ja.face, ja.uso, novas.produto ? principalAtual : undefined].filter(Boolean));
  const antigas = atuais.filter((u) => !tiradas.has(u));
  const ordem = [produto, face, uso, ...antigas].filter((u): u is string => Boolean(u));
  return Array.from(new Set(ordem));
}

function comImagens(linha: string[], cabecalho: string[], imagens: string[]): string[] {
  const nova = [...linha];
  COLUNAS_DE_IMAGEM.forEach((nome, i) => {
    const k = cabecalho.indexOf(nome);
    if (k >= 0) nova[k] = imagens[i] ?? "";
  });
  const k = cabecalho.indexOf(COLUNA_ADICIONAIS);
  if (k >= 0) nova[k] = imagens.slice(COLUNAS_DE_IMAGEM.length).join(", ");
  return nova;
}

// ------------------------------------------------------------------ preço

/** "1.549,90", "449,90" ou "449.90" em centavos. Vazio e zero viram nulo. */
export function centavosDoTexto(v: string | null | undefined): number | null {
  const s = (v ?? "").trim();
  if (!s) return null;
  const normal = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  const n = Number(normal);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
}

function centavos(n: number | null | undefined): number | null {
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
}

const reais = (c: number | null) =>
  c === null ? "sem" : (c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 });

// ------------------------------------------------------------------ montar

export class PlanilhaInvalida extends Error {}

export function montarPlanilhaDeFotos(
  exportacao: Uint8Array,
  pedidos: PedidoDeFoto[],
): ResultadoDaPlanilha {
  const { linhas, fimDeLinha } = lerCsv(decodificar(exportacao));
  const [cabecalho, ...corpo] = linhas;
  if (!cabecalho) throw new PlanilhaInvalida("O arquivo está vazio.");

  const faltam = [COLUNA_CODIGO, COLUNA_PRECO, COLUNA_PROMO, ...COLUNAS_DE_IMAGEM, COLUNA_ADICIONAIS].filter(
    (c) => !cabecalho.includes(c),
  );
  if (faltam.length) {
    throw new PlanilhaInvalida(
      `Este arquivo não parece a exportação de produtos da Tray. Faltam as colunas: ${faltam.join(", ")}.`,
    );
  }

  const kCodigo = cabecalho.indexOf(COLUNA_CODIGO);
  const kPreco = cabecalho.indexOf(COLUNA_PRECO);
  const kPromo = cabecalho.indexOf(COLUNA_PROMO);
  const porCodigo = new Map(corpo.filter((l) => l.length === cabecalho.length).map((l) => [l[kCodigo], l]));

  const saida: string[][] = [cabecalho];
  const incluidos: string[] = [];
  const naoAchados: string[] = [];
  const precoDiferente: PrecoQueDiscorda[] = [];

  for (const p of pedidos) {
    const linha = porCodigo.get(p.codigo);
    if (!linha) {
      naoAchados.push(p.codigo);
      continue;
    }

    const precoPlanilha = centavosDoTexto(linha[kPreco]);
    const promoPlanilha = centavosDoTexto(linha[kPromo]);
    const precoPortal = centavos(p.preco);
    const promoPortal = centavos(p.precoPromocional);
    if (precoPlanilha !== precoPortal || promoPlanilha !== promoPortal) {
      precoDiferente.push({
        codigo: p.codigo,
        nome: p.nome,
        naPlanilha: `${reais(precoPlanilha)} / promoção ${reais(promoPlanilha)}`,
        noPortal: `${reais(precoPortal)} / promoção ${reais(promoPortal)}`,
      });
      continue;
    }

    const imagens = novaOrdemDeImagens(imagensDaLinha(linha, cabecalho), p);
    saida.push(comImagens(linha, cabecalho, imagens));
    incluidos.push(p.codigo);
  }

  return { arquivo: escreverCsv(saida, fimDeLinha), incluidos, naoAchados, precoDiferente };
}
