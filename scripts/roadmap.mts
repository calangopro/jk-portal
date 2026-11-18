/**
 * O Roadmap no terminal, só para LER: quem está mexendo em quê, os
 * cruzamentos e o que está para fazer. Serve ao Filipe, ao Erick e ao Claude
 * de cada um, antes de começar um trabalho no painel.
 *
 *   npm run roadmap                         o quadro
 *   npm run roadmap -- conferir src/lib/x /admin/vendas
 *                                           quem já mexe nesses caminhos
 *   npm run roadmap -- ver 12               um cartão com o histórico
 *
 * Fala com o conector do Claude do painel (o mesmo das sessões), com a chave
 * manual `jk_...` de quem roda: crie em /guias/admin/conector e ponha numa
 * linha `JK_CONECTOR_CHAVE=jk_...` do `.env.local` (ou na variável de
 * ambiente). Não usa a chave de serviço: funciona igual no computador de
 * qualquer um. Escrever (pegar, mover, ligar o pedido) é pelo conector dentro
 * do Claude, onde a pessoa vê e aprova.
 */
import { existsSync, readFileSync } from "node:fs";

const ENDERECO = process.env.JK_CONECTOR_URL ?? "https://www.jkaliancas.com.br/guias/api/mcp/ferramentas";

function chave(): string | null {
  if (process.env.JK_CONECTOR_CHAVE) return process.env.JK_CONECTOR_CHAVE.trim();
  for (const arquivo of [".env.local", "../../../.env.local"]) {
    if (!existsSync(arquivo)) continue;
    const linha = readFileSync(arquivo, "utf8").split("\n").find((l) => l.startsWith("JK_CONECTOR_CHAVE="));
    if (linha) return linha.slice("JK_CONECTOR_CHAVE=".length).trim().replace(/^["']|["']$/g, "");
  }
  return null;
}

async function chamar(ferramenta: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const k = chave();
  if (!k) {
    console.error(
      "Falta a chave do conector. Crie uma em https://www.jkaliancas.com.br/guias/admin/conector (Nova chave) e ponha no .env.local:\n  JK_CONECTOR_CHAVE=jk_...",
    );
    process.exit(2);
  }
  const r = await fetch(ENDERECO, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json", authorization: `Bearer ${k}` },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: ferramenta, arguments: args } }),
  });
  const corpo = (await r.json().catch(() => null)) as { result?: { content?: { text?: string }[]; isError?: boolean; structuredContent?: unknown }; error?: { message?: string } } | null;
  if (!r.ok || !corpo || corpo.error) {
    console.error(`O conector recusou (${r.status}): ${corpo?.error?.message ?? "sem resposta legível"}`);
    process.exit(1);
  }
  const texto = corpo.result?.content?.[0]?.text ?? "";
  if (corpo.result?.isError) {
    console.error(texto);
    process.exit(1);
  }
  return (corpo.result?.structuredContent as Record<string, unknown>) ?? JSON.parse(texto);
}

type Cruzamento = { meu: string; dele: string };
type Conflito = { cartao: number; titulo: string; coluna: string; com: string | null; ramo: string | null; cruzam: Cruzamento[] };
type Cartao = {
  id: number; titulo: string; tipo: string; prioridade: string; coluna: string; com: string | null; pelo_claude: boolean; ramo: string | null; pr: string | null;
  pr_estado: string | null; caminhos: string[]; atras_do_main: number | null; aviso_main: string | null; cruza_com: Conflito[];
};

const cruzamentoEmTexto = (x: Cruzamento) => (x.meu === x.dele ? x.meu : `${x.meu} cruza com ${x.dele}`);

async function quadro() {
  const q = await chamar("roadmap_quadro", { limite: 200 });
  const cartoes = (q.cartoes ?? []) as Cartao[];
  const emTrabalho = cartoes.filter((c) => c.coluna === "fazendo" || c.coluna === "em_revisao");
  console.log("\nEM TRABALHO");
  if (emTrabalho.length === 0) console.log("  ninguém");
  for (const c of emTrabalho) {
    console.log(`  ${c.id}. ${c.titulo}  [${c.coluna === "fazendo" ? "fazendo" : "em revisão"}, com ${c.com ?? "ninguém"}${c.pelo_claude ? ", pelo Claude" : ""}]`);
    if (c.ramo) console.log(`     ramo: ${c.ramo}`);
    if (c.pr) console.log(`     pedido de revisão: ${c.pr}${c.pr_estado ? ` (${c.pr_estado})` : ""}`);
    if (c.atras_do_main) console.log(`     ${c.atras_do_main} commit(s) atrás do main`);
    if (c.aviso_main) console.log(`     ATENÇÃO: ${c.aviso_main}`);
    if (c.caminhos.length) console.log(`     mexe em: ${c.caminhos.join(", ")}`);
  }
  const cruzamentos = (q.cruzamentos ?? []) as { a: string; b: string; cruzam: Cruzamento[] }[];
  if (cruzamentos.length) {
    console.log("\nCUIDADO: CARTÕES EM TRABALHO NO MESMO LUGAR");
    for (const x of cruzamentos) console.log(`  ${x.a} e ${x.b}: ${x.cruzam.map(cruzamentoEmTexto).join("; ")}`);
  }
  const fora = (q.fora_do_quadro ?? []) as { ramo: string; de: string | null; pr: number | null; arquivos: number; cruza_com: number[] }[];
  if (fora.length) {
    console.log("\nRAMOS NO GITHUB SEM CARTÃO");
    for (const g of fora) console.log(`  ${g.ramo} (${g.de ?? "alguém"}${g.pr ? `, PR ${g.pr}` : ""}, ${g.arquivos} arquivo(s))${g.cruza_com.length ? `  cruza com o cartão ${g.cruza_com.join(", ")}` : ""}`);
  }
  const aFazer = cartoes.filter((c) => c.coluna === "a_fazer");
  console.log(`\nA FAZER (${aFazer.length})`);
  for (const c of aFazer.slice(0, 25)) console.log(`  ${c.id}. ${c.titulo}  [${c.tipo}, ${c.prioridade}]`);
  if (aFazer.length > 25) console.log(`  ... e mais ${aFazer.length - 25}`);
  const sugestoes = (q.sugestoes_novas ?? []) as unknown[];
  if (sugestoes.length) console.log(`\n${sugestoes.length} sugestão(ões) do time esperando ir para o quadro.`);
  console.log(`\nGitHub: ${q.github_avisou ? `último aviso ${q.github_avisou}` : "ainda não avisou nada"}.`);
  console.log(`Quadro inteiro: ${q.painel}`);
  console.log("Antes de mexer: pegue o cartão (roadmap.pegar, pelo conector) com o ramo e os caminhos.\n");
}

async function conferir(caminhos: string[]) {
  if (caminhos.length === 0) {
    console.error("Diga os caminhos: npm run roadmap -- conferir src/lib/redes /admin/vendas");
    process.exit(2);
  }
  const r = await chamar("roadmap_conflitos", { caminhos });
  const conflitos = (r.conflitos ?? []) as Conflito[];
  if (conflitos.length === 0) {
    console.log("\nLivre: nenhum cartão em trabalho mexe nesses caminhos.\n");
    return;
  }
  console.log("\nJÁ TEM GENTE MEXENDO AÍ");
  for (const c of conflitos) {
    console.log(`  ${c.cartao}. ${c.titulo}  [${c.coluna}, com ${c.com ?? "ninguém"}${c.ramo ? `, ramo ${c.ramo}` : ""}]`);
    for (const x of c.cruzam) console.log(`     ${cruzamentoEmTexto(x)}`);
  }
  console.log("\nCombine com a pessoa antes de seguir.\n");
  process.exitCode = 3;
}

async function ver(id: number) {
  const r = await chamar("roadmap_ver", { id });
  const c = r.cartao as Cartao & { descricao: string | null; painel: string };
  console.log(`\n${c.id}. ${c.titulo}  [${c.tipo}, ${c.prioridade}, ${c.coluna}]`);
  console.log(`com ${c.com ?? "ninguém"}${c.pelo_claude ? ", pelo Claude" : ""}${c.ramo ? `, ramo ${c.ramo}` : ""}${c.pr ? `, ${c.pr}` : ""}`);
  if (c.caminhos.length) console.log(`mexe em: ${c.caminhos.join(", ")}`);
  if (c.descricao) console.log(`\n${c.descricao}`);
  for (const k of c.cruza_com) console.log(`\nCRUZA COM ${k.cartao}. ${k.titulo} (com ${k.com ?? "ninguém"}): ${k.cruzam.map(cruzamentoEmTexto).join("; ")}`);
  console.log("\nHISTÓRICO");
  for (const h of (r.historico ?? []) as { em: string; por: string | null; pelo_conector: boolean; o_que: string; nota: string | null }[]) {
    console.log(`  ${h.em}  ${h.por ?? "alguém"}${h.pelo_conector ? " (pelo Claude)" : ""}: ${h.o_que}${h.nota ? `. ${h.nota}` : ""}`);
  }
  console.log(`\n${c.painel}\n`);
}

const [comando, ...resto] = process.argv.slice(2);
if (!comando || comando === "quadro") await quadro();
else if (comando === "conferir") await conferir(resto);
else if (comando === "ver" && Number.isInteger(Number(resto[0]))) await ver(Number(resto[0]));
else {
  console.error("Use: npm run roadmap | npm run roadmap -- conferir <caminhos> | npm run roadmap -- ver <número>");
  process.exit(2);
}
