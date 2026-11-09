/**
 * Confere a planilha que leva as fotos aprovadas para a Tray. Roda sem banco
 * e sem navegador:
 *   node --experimental-strip-types scripts/teste-planilha-tray.mts [exportacao.csv]
 *
 * A fixture são três linhas REAIS da exportação da Tray de 09/11/2026, com a
 * descrição trocada por um trecho curto que tem aspas e ponto e vírgula (os
 * dois caracteres que quebram CSV) e o custo apagado. Com um arquivo de
 * exportação inteiro como argumento, confere também que ler e escrever devolve
 * o arquivo byte a byte.
 *
 * O que este teste protege: a importação da Tray regrava a linha inteira, então
 * qualquer campo que a planilha mudar sem querer (acento, aspas, preço) muda na
 * loja.
 */
import { readFileSync } from "node:fs";
import {
  COLUNA_ADICIONAIS,
  centavosDoTexto,
  escreverCsv,
  lerCsv,
  montarPlanilhaDeFotos,
} from "../src/lib/catalogo/planilha-tray.ts";

let falhas = 0;
function confere(nome: string, ok: boolean, detalhe = "") {
  if (ok) console.log(`  ok  ${nome}`);
  else {
    falhas++;
    console.error(`  ERRO ${nome}${detalhe ? `\n       ${detalhe}` : ""}`);
  }
}

const iguais = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((v, i) => v === b[i]);
const latin1 = (b: Uint8Array) => new TextDecoder("iso-8859-1").decode(b);

const fixture = new Uint8Array(readFileSync(new URL("./fixtures/exportacao-tray.csv", import.meta.url)));

console.log("Planilha de fotos para a Tray");

// 1. Ida e volta sem mudar um byte.
{
  const { linhas, fimDeLinha } = lerCsv(latin1(fixture));
  confere("ler e escrever devolve o mesmo arquivo", iguais(escreverCsv(linhas, fimDeLinha), fixture));
  confere("a descrição com aspas e ; volta inteira", linhas[1].some((c) => c.includes('"aspas" e ponto; e')));
}

// 2. Preço com milhar.
confere("1.549,90 vira 154990 centavos", centavosDoTexto("1.549,90") === 154990);
confere("449,90 vira 44990", centavosDoTexto("449,90") === 44990);
confere("vazio e zero viram nulo", centavosDoTexto("") === null && centavosDoTexto("0,00") === null);

// 3. Troca de imagens só na linha pedida, e só nas colunas de imagem.
{
  const { linhas } = lerCsv(latin1(fixture));
  const [cab, l217] = [linhas[0], linhas.find((l) => l[0] === "217")!];
  const img = (n: string) => l217[cab.indexOf(n)];
  const antigas = [img("Imagem principal"), img("Imagem 2"), img("Imagem 3"), img("Imagem 4")];

  const r = montarPlanilhaDeFotos(fixture, [
    {
      codigo: "217",
      nome: "Eternal Love",
      preco: 449.9,
      precoPromocional: 399.9,
      principal: "https://exemplo.supabase.co/produtos/217/principal.jpg",
      ambientada: "https://exemplo.supabase.co/produtos/217/ambientada.jpg",
    },
  ]);
  const saida = lerCsv(latin1(r.arquivo)).linhas;
  confere("só o cabeçalho e a linha pedida", saida.length === 2 && r.incluidos.join() === "217");
  const nova = saida[1];
  const ni = (n: string) => nova[cab.indexOf(n)];
  confere("principal nova na posição 1", ni("Imagem principal").endsWith("/principal.jpg"));
  confere("ambientada na posição 2", ni("Imagem 2").endsWith("/ambientada.jpg"));
  confere(
    "as antigas seguem depois, sem a principal velha",
    ni("Imagem 3") === antigas[1] && ni("Imagem 4") === antigas[2] && ni(COLUNA_ADICIONAIS) === antigas[3],
    `veio ${[ni("Imagem 3"), ni("Imagem 4"), ni(COLUNA_ADICIONAIS)].join(" | ")}`,
  );
  const fora = new Set(["Imagem principal", "Imagem 2", "Imagem 3", "Imagem 4", COLUNA_ADICIONAIS]);
  const mudouOutra = cab.filter((c, i) => !fora.has(c) && nova[i] !== l217[i]);
  confere("nenhuma outra coluna mudou", mudouOutra.length === 0, mudouOutra.join(", "));
}

// 4. Exportação velha: preço diferente fica de fora.
{
  const r = montarPlanilhaDeFotos(fixture, [
    { codigo: "217", nome: "Eternal Love", preco: 449.9, precoPromocional: 349.9, principal: "https://x.co/a.jpg" },
    { codigo: "77", nome: "Ouro", preco: 2772, precoPromocional: 2633.4, principal: "https://x.co/b.jpg" },
    { codigo: "999999", nome: "Sumiu", preco: 10, precoPromocional: null, principal: "https://x.co/c.jpg" },
  ]);
  confere("linha com promoção diferente fica de fora", r.precoDiferente.map((p) => p.codigo).join() === "217");
  confere("preço com milhar que bate entra", r.incluidos.join() === "77");
  confere("código que não está na exportação é avisado", r.naoAchados.join() === "999999");
}

// 5. Arquivo que não é a exportação de produtos.
{
  let erro = "";
  try {
    montarPlanilhaDeFotos(new TextEncoder().encode('"Nome";"Preço"\r\n"a";"1"\r\n'), []);
  } catch (e) {
    erro = (e as Error).message;
  }
  confere("recusa planilha que não é a exportação", erro.includes("não parece a exportação"));
}

// 6. Exportação inteira, quando vier por argumento.
const inteira = process.argv[2];
if (inteira) {
  const bytes = new Uint8Array(readFileSync(inteira));
  const { linhas, fimDeLinha } = lerCsv(latin1(bytes));
  confere(`exportação inteira (${linhas.length - 1} produtos) volta byte a byte`, iguais(escreverCsv(linhas, fimDeLinha), bytes));
  confere("toda linha tem o número de colunas do cabeçalho", linhas.every((l) => l.length === linhas[0].length));
}

if (falhas) {
  console.error(`\n${falhas} falha(s).`);
  process.exit(1);
}
console.log("\nTudo certo.");
