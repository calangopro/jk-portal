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
  limiteDeAnuncio,
  margemNoPreco,
  taxaEfetiva,
  terminadoEm90,
  terminadoEm90ParaCima,
  type Familia,
  type Parametros,
} from "../src/lib/margem/calculo.ts";
import { lerXlsx } from "../src/lib/margem/ler-xlsx.ts";
import { ehPlanilhaDePesos, lerPlanilhaDePesos, lerPlanilhaDoDono } from "../src/lib/margem/planilha-do-dono.ts";
import { larguraDoNome, materialPeloNome, pecasDoNome } from "../src/lib/margem/calculo.ts";

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
  cotacaoPrata: 10,
  prataGramasPorMm: 0.95,
  prataResto: 30,
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

// 1b. Limite de anúncio: a mesma margem, vista por quem compra mídia.
{
  // 449,90 com custo 100: líquido 400,41; empate 400,41 - 100 - 25 - 10 = 265,41; máximo 265,41 - 30% x 449,90 = 130,44.
  const l = limiteDeAnuncio(449.9, 100, P);
  confere("CPA de empate = 265,41", perto(l.cpaEmpate, 265.41, 0.01), String(l.cpaEmpate));
  confere("CPA máximo = 130,44 (mantém 30%)", l.cpaMaximo === 130.44, String(l.cpaMaximo));
  confere("ROAS mínimo = 3,45", perto(l.roasMinimo!, 3.449, 0.001), String(l.roasMinimo));
  confere("ROAS de empate = 1,70", perto(l.roasEmpate!, 1.695, 0.001), String(l.roasEmpate));
  const sem = limiteDeAnuncio(199.9, 150, P);
  confere("produto sem folga: CPA máximo negativo e sem ROAS", sem.cpaMaximo < 0 && sem.roasMinimo === null, String(sem.cpaMaximo));
  const m = calcularMargem(449.9, 399.9, 100, P);
  confere("a margem traz o limite no preço de HOJE (399,90)", m.anuncio.preco === 399.9);
}

// 1c. Taxa do gateway por partes e tarifa fixa por venda (cartão 77).
{
  const g = { cartao: 0.0349, pix: 0.0089, antecipacaoAoMes: 0.0249, fracaoAntecipada: 0.75, prazoMeses: 2, proporcaoCartao: 0.8 };
  // cartão efetivo = 3,49% + 0,75 x 2,49% x 2 = 7,225%; mistura 0,8 x 7,225% + 0,2 x 0,89% = 5,958%
  confere("taxa efetiva: 80% cartão com antecipação e 20% Pix = 5,958%", perto(taxaEfetiva(g)!, 0.05958, 1e-9), String(taxaEfetiva(g)));
  confere("sem nenhuma parte, a taxa efetiva é nula (vale a única)", taxaEfetiva({ ...g, cartao: null, pix: null }) === null && taxaEfetiva(undefined) === null);
  confere("só cartão e proporção vazia: tudo cartão", perto(taxaEfetiva({ cartao: 0.0349, pix: null, antecipacaoAoMes: null, fracaoAntecipada: null, prazoMeses: null, proporcaoCartao: null })!, 0.0349, 1e-9));
  confere("só Pix preenchido: tudo Pix", perto(taxaEfetiva({ cartao: null, pix: 0.0089, antecipacaoAoMes: null, fracaoAntecipada: null, prazoMeses: null, proporcaoCartao: null })!, 0.0089, 1e-9));
  confere("antecipação sem prazo não custa nada", perto(taxaEfetiva({ ...g, prazoMeses: null, proporcaoCartao: 1 })!, 0.0349, 1e-9));

  // 399,90 com custo 98,50, imposto 6%, frete 25, embalagem 10, tarifa 0,99:
  // líquido 399,90 x (1 - 5,958% - 6%) = 352,08; menos 0,99, 98,50, 25 e 10 = 217,59
  const Q: Parametros = { ...P, taxa: taxaEfetiva(g), tarifaFixa: 0.99 };
  const m = margemNoPreco(399.9, 98.5, Q);
  confere("Eternal Love a 399,90: margem R$ 217,59", perto(m.reais, 217.59, 0.01), String(m.reais));
  const sem = margemNoPreco(399.9, 98.5, { ...Q, tarifaFixa: null });
  confere("a tarifa fixa tira reais, não percentual (0,99)", perto(sem.reais - m.reais, 0.99, 0.01), String(sem.reais - m.reais));
  const antes = margemNoPreco(399.9, 98.5, P);
  confere("com taxa e tarifa de verdade a margem cai", m.reais < antes.reais + 1 && perto(antes.reais, 399.9 * (1 - 0.05 - 0.06) - 98.5 - 25 - 10, 0.01));
  // O desconto máximo conta a tarifa fixa junto do custo.
  const dm = descontoMaximo(399.9, 98.5, Q);
  const base = 399.9 * (1 - 0.05958 - 0.06 - 0.3);
  confere("desconto máximo inclui a tarifa fixa", perto(dm, 1 - (98.5 + 25 + 10 + 0.99) / base, 1e-6), String(dm));
  const l = limiteDeAnuncio(399.9, 98.5, Q);
  confere("CPA de empate = margem em reais", perto(l.cpaEmpate, 217.59, 0.01), String(l.cpaEmpate));
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

// 2b. Prata 950: grama x milímetro, sem lista de produtos.
{
  const sem = new Map<string, Familia>();
  const par = "Par de Alianças de Namoro em Prata 950 4mm + Anel Solitário Brinde";
  confere("'Prata 950' é prata_950", materialPeloNome(par) === "prata_950");
  confere("prata com ouro continua prata_com_ouro", materialPeloNome("Aliança de Prata com Fio de Ouro 6mm") === "prata_com_ouro");
  confere("prata banhada continua fora (semijoia)", materialPeloNome("Alianças Prata Banhadas a Ouro 4mm") === null);
  confere("largura '3,5mm' = 3,5", larguraDoNome("Laço Eterno em Prata 950 3,5mm") === 3.5);
  confere("par conta 2 peças, aliança sozinha 1", pecasDoNome(par) === 2 && pecasDoNome("Aliança de Namoro em Prata 950 3mm") === 1);

  // par de 4 mm: 2 x 4 x 0,95 = 7,6 g x R$ 10 + R$ 30 = R$ 106
  const c = custoDoProduto(null, sem, P, par);
  confere("par de 4 mm sem linha: 7,6 g x 10 + 30 = 106", c.valor === 106, String(c.valor) + " " + (c.detalhe ?? c.falta));
  const um = custoDoProduto(null, sem, P, "Aliança de Namoro em Prata 950 3mm + Anel Solitário Brinde");
  confere("aliança de 3 mm: 2,85 g x 10 + 30 = 58,50", um.valor === 58.5, String(um.valor));
  const pesada = custoDoProduto({ material: "prata_950", familia: null, gramas: 12, resto: 50, custoFixo: null }, sem, P, par);
  confere("peso e resto gravados no produto vencem a média", pesada.valor === 12 * 10 + 50, String(pesada.valor));
  const fixo = custoDoProduto({ material: null, familia: null, gramas: null, resto: null, custoFixo: 77 }, sem, P, par);
  confere("custo fixo continua vencendo", fixo.valor === 77);
  const corrente = custoDoProduto(null, sem, P, "Corrente Prata 3x1 2mm - 60cm");
  confere("corrente de prata não é calculada pela largura", corrente.valor === null && corrente.falta.includes("aliança"), corrente.falta ?? "");
  const semMm = custoDoProduto(null, sem, P, "Anel Solitário de Prata - Modelo Roma");
  confere("anel sem mm no nome pede o peso", semMm.valor === null && semMm.falta.includes("largura"), semMm.falta ?? "");
  const semCot = custoDoProduto(null, sem, { ...P, cotacaoPrata: null }, par);
  confere("sem preço do grama da prata, diz o que falta", semCot.falta === "Falta o preço do grama da prata 950", semCot.falta ?? "");
  const semGmm = custoDoProduto(null, sem, { ...P, prataGramasPorMm: null }, par);
  confere("sem gramas por mm, diz o que falta", semGmm.falta === "Falta as gramas por milímetro da prata", semGmm.falta ?? "");
  const semResto = custoDoProduto(null, sem, { ...P, prataResto: null }, par);
  confere("resto vazio conta zero: 76", semResto.valor === 76, String(semResto.valor));
  confere("sem nome, prata sem linha fica 'Sem custo'", custoDoProduto(null, sem, P).falta === "Sem custo");
  confere("prata 950 não vira família de ouro", chaveDaFamilia(par) === null);
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

// 5b. A planilha de pesos por produto (formato do Carlos).
{
  const pasta = {
    Referencias_A: {
      1: { A: "Referência", B: "ID do produto", C: "Peso do ouro (g)", D: "Valor de venda" },
      2: { A: "JK2835A", B: 99, C: 4, D: 7000 },
      3: { A: "JK2847A", B: "115", C: "5,5", D: 8750 },
      4: { A: "JK0000A", B: 120, C: null, D: 0 },
      5: { A: "JK9999A", B: 121, C: -2, D: 0 },
    },
    Referencias_R: {
      1: { A: "Referência", B: "ID do produto", C: "Peso do ouro (g)", D: "Valor de venda" },
      2: { A: "JK2834R", B: 97, C: 1.6, D: 2800 },
    },
    Outra: { 1: { A: "Qualquer coisa" } },
  };
  confere("reconhece a planilha de pesos", ehPlanilhaDePesos(pasta as never));
  const r = lerPlanilhaDePesos(pasta as never);
  confere(
    "lê as duas abas, número e texto, pula vazio",
    JSON.stringify(r.ouro) === JSON.stringify([{ trayId: "99", gramas: 4, resto: null }, { trayId: "115", gramas: 5.5, resto: null }, { trayId: "97", gramas: 1.6, resto: null }]),
    JSON.stringify(r.ouro),
  );
  confere("peso negativo vira aviso", r.avisos.length === 1 && r.avisos[0].includes("121"), r.avisos.join(" | "));
  confere("não mexe em parâmetros nem famílias", Object.keys(r.parametros).length === 0 && r.familias.length === 0);
  const dono = await lerXlsx(new Uint8Array(readFileSync(new URL("./fixtures/custos-preenchida.xlsx", import.meta.url))));
  confere("a planilha do dono não é planilha de pesos", !ehPlanilhaDePesos(dono));
}

// 6. A planilha de verdade (vazia ou preenchida), quando vier por argumento.
const real = process.argv[2];
if (real) {
  const pasta = await lerXlsx(new Uint8Array(readFileSync(real)));
  const r = ehPlanilhaDePesos(pasta) ? lerPlanilhaDePesos(pasta) : lerPlanilhaDoDono(pasta);
  console.log(`  ..  ${real.split("/").pop()}: ${Object.keys(r.parametros).length} parâmetros, ${r.familias.length} famílias, ${r.ouro.length} exceções de ouro, ${r.fixos.length} custos fixos, ${r.avisos.length} avisos`);
  confere("a planilha real abre sem erro", true);
}

if (falhas) {
  console.error(`\n${falhas} falha(s).`);
  process.exit(1);
}
console.log("\nTudo certo.");
