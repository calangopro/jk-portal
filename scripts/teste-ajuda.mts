/**
 * Confere o registro dos tutoriais do Como usar. Roda sem banco e sem navegador:
 *   node --experimental-strip-types scripts/teste-ajuda.mts
 *
 * Todo href existe em `setores.ts`, todo grupo é válido, todo print existe em
 * `public/ajuda/` com o tamanho certo, nenhum texto tem travessão, nenhum passo
 * passa de 240 caracteres. Tutorial novo entra em `src/lib/ajuda/indice.ts`.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { grupoDoPapel, passosPara } from "../src/lib/ajuda/grupos.ts";
import { TUTORIAIS, tutorialDaTela } from "../src/lib/ajuda/indice.ts";
import { GRUPOS, MAXIMO_DO_TEXTO, TAMANHO_DO_PRINT } from "../src/lib/ajuda/tipos.ts";
import { PAPEIS } from "../src/lib/auth/acessos.ts";
import { SETORES } from "../src/lib/painel/setores.ts";

let falhas = 0;
function confere(nome: string, ok: boolean, detalhe = "") {
  console.log(`${ok ? "ok  " : "ERRO"} ${nome}${!ok && detalhe ? `: ${detalhe}` : ""}`);
  if (!ok) falhas++;
}

const hrefs = new Set(SETORES.flatMap((s) => s.itens.map((i) => i.href)));
const PROIBIDAS = ["—", "–", "vamos mergulhar", "em resumo", "é importante ressaltar", "neste artigo"];
const pastaDosPrints = join(process.cwd(), "public", "ajuda");

console.log("Registro dos tutoriais");
confere("existe pelo menos um tutorial", TUTORIAIS.length > 0);
confere("cada tela tem um tutorial só", new Set(TUTORIAIS.map((t) => t.href)).size === TUTORIAIS.length);

const erros: string[] = [];
const usados = new Set<string>();
for (const t of TUTORIAIS) {
  if (!hrefs.has(t.href)) erros.push(`${t.href}: a tela não existe em setores.ts`);
  if (!t.resumo.trim() || t.resumo.length > MAXIMO_DO_TEXTO) erros.push(`${t.href}: resumo vazio ou comprido`);
  for (const f of PROIBIDAS) if (t.resumo.toLowerCase().includes(f)) erros.push(`${t.href}: resumo com "${f}"`);
  for (const [grupo, passos] of Object.entries(t.versoes)) {
    if (grupo !== "todos" && !(GRUPOS as readonly string[]).includes(grupo)) erros.push(`${t.href}: grupo inválido ${grupo}`);
    if (!passos || passos.length < 3 || passos.length > 6) erros.push(`${t.href} (${grupo}): precisa de 3 a 6 passos, tem ${passos?.length ?? 0}`);
    for (const [n, p] of (passos ?? []).entries()) {
      const onde = `${t.href} (${grupo}) passo ${n + 1}`;
      if (!p.titulo.trim() || p.titulo.length > 60) erros.push(`${onde}: título vazio ou acima de 60 caracteres`);
      if (!p.texto.trim() || p.texto.length > MAXIMO_DO_TEXTO) erros.push(`${onde}: texto vazio ou acima de ${MAXIMO_DO_TEXTO} caracteres`);
      for (const f of PROIBIDAS) for (const campo of [p.titulo, p.texto, p.alt ?? ""]) if (campo.toLowerCase().includes(f)) erros.push(`${onde}: texto com "${f}"`);
      const { x, y, l, a } = p.regiao;
      if (!(x >= 0 && y >= 0 && l > 0 && a > 0 && x + l <= 100.01 && y + a <= 100.01)) erros.push(`${onde}: região fora do print`);
      usados.add(`${p.print}|${p.celular ? "c" : "d"}`);
    }
  }
  if (!t.versoes.todos) erros.push(`${t.href}: falta a versão todos`);
}
if (erros.length) console.log(erros.join("\n"));
confere("todo tutorial é válido (tela, grupos, passos, texto, região)", erros.length === 0);

console.log("\nPrints");
const faltando: string[] = [];
const tamanhos: string[] = [];
for (const chave of usados) {
  const [arquivo, tipo] = chave.split("|");
  const caminho = join(pastaDosPrints, arquivo);
  if (!/^[a-z0-9-]+\.webp$/.test(arquivo)) {
    faltando.push(`${arquivo}: nome fora do padrão <tela>-<n>.webp`);
    continue;
  }
  if (!existsSync(caminho)) {
    faltando.push(`${arquivo}: não existe em public/ajuda`);
    continue;
  }
  const m = await sharp(caminho).metadata();
  const esperado = tipo === "c" ? TAMANHO_DO_PRINT.celular : TAMANHO_DO_PRINT.computador;
  if (m.width !== esperado.l || m.height !== esperado.a) tamanhos.push(`${arquivo}: ${m.width}x${m.height}, esperado ${esperado.l}x${esperado.a}`);
  if (readFileSync(caminho).length > 130 * 1024) tamanhos.push(`${arquivo}: acima de 130 KB`);
}
if (faltando.length || tamanhos.length) console.log([...faltando, ...tamanhos].join("\n"));
confere("todo print usado existe", faltando.length === 0);
confere("todo print tem o tamanho certo e cabe em 130 KB", tamanhos.length === 0);
const sobra = existsSync(pastaDosPrints) ? readdirSync(pastaDosPrints).filter((f) => f.endsWith(".webp") && ![...usados].some((u) => u.startsWith(`${f}|`))) : [];
confere("nenhum print sobrando sem tutorial", sobra.length === 0, sobra.join(", "));

console.log("\nQuem vê qual versão");
confere("todo nível cai num grupo", PAPEIS.every((p) => (GRUPOS as readonly string[]).includes(grupoDoPapel(p))));
confere("administrador, dono e GM são a diretoria", ["admin", "dono", "gm"].every((p) => grupoDoPapel(p) === "diretoria"));
confere("editor, revisor e autor são conteúdo", ["editor", "reviewer", "author"].every((p) => grupoDoPapel(p) === "conteudo"));
confere("nível desconhecido cai em conteúdo", grupoDoPapel("xyz") === "conteudo" && grupoDoPapel(null) === "conteudo");
const t0 = TUTORIAIS[0];
confere("sem versão própria vale a de todos", passosPara(t0, "fabrica") === (t0.versoes.fabrica ?? t0.versoes.todos));
confere("tela sem tutorial devolve nada", tutorialDaTela("/admin/nao-existe") === null);

if (falhas > 0) {
  console.log(`\n${falhas} falha(s)`);
  process.exit(1);
}
console.log("\nTudo certo");
