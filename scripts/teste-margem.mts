/**
 * Confere a conta de margem e a leitura da planilha de custos do dono. Roda
 * sem banco e sem navegador:
 *   node --experimental-strip-types scripts/teste-margem.mts [planilha-do-dono.xlsx]
 *
 * Os números esperados são os MESMOS da planilha que foi para o dono em
 * 09/11/2026, conferidos lá com um avaliador de fórmulas: o painel e a
 * planilha não podem dar margens diferentes para a mesma peça.
 *
 * A fixture `custos-preenchida.xlsx` tem a estrutura da planilha do dono com
 * os casos chatos: porcentagem digitada sem o sinal, número como texto com
 * vírgula, código que virou número no Excel, "R$" na célula e texto rico.
 */
import { readFileSync } from "node:fs";
import {
  calcularMargem,
  chaveDaFamilia,
  custoDoProduto,
  descontoMaximo,
  margemNoPreco,
  terminadoEm90,
  terminadoEm90ParaCima,
  type Familia,
  type Parametros,
} from "../src/lib/margem/calculo.ts";
import { lerXlsx } from "../src/lib/margem/ler-xlsx.ts";
import { lerPlanilhaDoDono } from "../src/lib/margem/planilha-do-dono.ts";

let falhas = 0;
function confere(nome: string, ok: boolean, detalhe = "") {
  if (ok) console.log(`  ok  ${nome}`);
  else {
    falhas++;
    console.error(`  ERRO ${nome}${detalhe ? `\n       ${detalhe}` : ""}`);
  }
}
const perto = (a: number, b: number, tol = 0.0001) => Math.abs(a - b) <= tol;

const P: Parametros = {
  cotacao18k: 600,
  cotacao10k: 350,
  taxa: 0.05,
  imposto: 0.06,
  frete: 25,
  embalagem: 10,
  margemMinima: 0.3,
};

console.log("Margem");

// 1. Os mesmos números da planilha do dono.
{
  const familias = new Map<string, Familia>([
    ["F01", { codigo: "F01", material: "ouro_18k", tipo: "Par", largura: "1 mm", perfil: "Reta", gramas: 5, arosReferencia: null, resto: 200 }],
  ]);
  const c = custoDoProduto({ material: "ouro_18k", familia: "F01", gramas: null, resto: null, custoFixo: null }, familias, P);
  confere("família: 5 g x 600 + 200 = 3.200", c.valor === 3200, String(c.valor));
  const m = margemNoPreco(2100, 3200, P);
  confere("margem a R$ 2.100 com custo 3.200 = -1.366", perto(m.reais, -1366, 0.01), String(m.reais));
  confere("margem % = -65,05%", perto(m.fracao, -0.6504762), String(m.fracao));
  confere("desconto máximo com prejuízo é zero", descontoMaximo(2100, 3200, P) === 0);

  const prata = calcularMargem(449.9, 399.9, 100, P);
  confere("prata 449,90 com custo 100: margem 58,99%", perto(prata.fracao, 0.5899333), String(prata.fracao));
  confere("prata: desconto máximo 49,14%", perto(prata.descontoMaximo, 0.4914124), String(prata.descontoMaximo));
  confere("prata: desconto de hoje 11,11%", perto(prata.descontoHoje!, 0.1111358), String(prata.descontoHoje));
  confere("prata: a promoção de hoje não passa do limite", prata.hojePassa === false);

  const apertada = calcularMargem(449.9, 199.9, 150, P);
  confere("promoção de 199,90 com custo 150 passa do limite", apertada.hojePassa === true);
}

// 2. Exceção do produto vence a família; custo fixo vence tudo.
{
  const familias = new Map<string, Familia>([
    ["F01", { codigo: "F01", material: "ouro_18k", tipo: "Par", largura: "1 mm", perfil: "Reta", gramas: 5, arosReferencia: null, resto: 200 }],
  ]);
  const c = custoDoProduto({ material: "ouro_18k", familia: "F01", gramas: 4, resto: null, custoFixo: null }, familias, P);
  confere("gramas do produto (4 g) vencem as da família", c.valor === 4 * 600 + 200, String(c.valor));
  const f = custoDoProduto({ material: "ouro_18k", familia: "F01", gramas: 4, resto: null, custoFixo: 999 }, familias, P);
  confere("custo fixo vence tudo", f.valor === 999);
  const sem = custoDoProduto({ material: "ouro_10k", familia: null, gramas: 3, resto: null, custoFixo: null }, familias, { ...P, cotacao10k: null });
  confere("sem preço do grama do 10k, diz o que falta", sem.valor === null && sem.falta.includes("10k"), sem.falta ?? "");
  confere("sem linha nenhuma: 'Sem custo'", custoDoProduto(null, familias, P).falta === "Sem custo");
}

// 3. Preço de vitrine em ,90, sem erro de ponto flutuante.
confere("359,92 vira 359,90", terminadoEm90(359.92) === 359.9);
confere("359,90 continua 359,90", terminadoEm90(359.9) === 359.9);
confere("360,40 vira 359,90 (nunca sobe)", terminadoEm90(360.4) === 359.9);
confere("1.549,90 x 0,8 = 1.239,92 vira 1.239,90", terminadoEm90(1549.9 * 0.8) === 1239.9);
confere("para cima: 359,92 vira 360,90", terminadoEm90ParaCima(359.92) === 360.9);
confere("para cima: 359,90 continua 359,90", terminadoEm90ParaCima(359.9) === 359.9);

// 4. Família de produto novo pelo nome, como na planilha.
{
  const k = chaveDaFamilia("Par de Alianças de Casamento em Ouro 18k 1mm Reta");
  confere("nome vira família (ouro 18k, par, 1 mm, reta)", JSON.stringify(k) === JSON.stringify({ material: "ouro_18k", tipo: "Par", largura: "1 mm", perfil: "Reta" }), JSON.stringify(k));
  confere("semijoia banhada não é ouro", chaveDaFamilia("Brinco Banhado a Ouro 18k 3mm") === null);
}

// 5. A planilha preenchida.
{
  const pasta = await lerXlsx(new Uint8Array(readFileSync(new URL("./fixtures/custos-preenchida.xlsx", import.meta.url))));
  const r = lerPlanilhaDoDono(pasta);
  confere("preço do grama 18k = 600", r.parametros.cotacao18k === 600);
  confere("'350,50' em texto vira 350,5", r.parametros.cotacao10k === 350.5, String(r.parametros.cotacao10k));
  confere("taxa digitada '5' vira 5%", r.parametros.taxa === 0.05, String(r.parametros.taxa));
  confere("imposto 0,06 fica 6%", r.parametros.imposto === 0.06);
  confere("embalagem vazia não entra", !("embalagem" in r.parametros));
  confere("só as famílias preenchidas entram (F01, F03)", r.familias.map((f) => f.codigo).join() === "F01,F03", r.familias.map((f) => f.codigo).join());
  confere("F01: 2,5 g, aros '16 e 22', resto 150", JSON.stringify(r.familias[0]) === JSON.stringify({ codigo: "F01", gramas: 2.5, arosReferencia: "16 e 22", resto: 150 }), JSON.stringify(r.familias[0]));
  confere("F03: '3,2' vira 3,2 g e aro 18 vira texto", r.familias[1].gramas === 3.2 && r.familias[1].arosReferencia === "18");
  confere("ouro: só o produto com exceção (77, que virou número no Excel)", JSON.stringify(r.ouro) === JSON.stringify([{ trayId: "77", gramas: 4.1, resto: null }]), JSON.stringify(r.ouro));
  confere("prata: 217 = 98,50 e 1333 = 'R$ 80,00'", JSON.stringify(r.fixos) === JSON.stringify([{ trayId: "217", custo: 98.5 }, { trayId: "1333", custo: 80 }]), JSON.stringify(r.fixos));
}

// 6. A planilha de verdade (vazia ou preenchida), quando vier por argumento.
const real = process.argv[2];
if (real) {
  const r = lerPlanilhaDoDono(await lerXlsx(new Uint8Array(readFileSync(real))));
  console.log(`  ..  ${real.split("/").pop()}: ${Object.keys(r.parametros).length} parâmetros, ${r.familias.length} famílias, ${r.ouro.length} exceções de ouro, ${r.fixos.length} custos fixos, ${r.avisos.length} avisos`);
  confere("a planilha real abre sem erro", true);
}

if (falhas) {
  console.error(`\n${falhas} falha(s).`);
  process.exit(1);
}
console.log("\nTudo certo.");
