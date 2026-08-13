/**
 * Confere se todo token editável pelo admin realmente existe no CSS gerado.
 *
 * Por que isto existe: o Tailwind v4 só emite no `:root` final o token de
 * `@theme` que alguma utilidade consome. Se nenhum componente usar a classe de
 * fundo de um token, nenhuma regra lê aquela variável, e o controle no
 * painel de aparência vira um botão que não faz nada. Pior: o defeito é
 * silencioso, aparece meses depois e parece bug do tema.
 *
 * Roda depois do `next build`, lendo o CSS de verdade.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const RAIZ = process.cwd();
const PASTA = process.env.BUILD_DIR || ".next";

function arquivosCss(dir) {
  const achados = [];
  const anda = (d) => {
    let itens;
    try {
      itens = readdirSync(d);
    } catch {
      return;
    }
    for (const item of itens) {
      const caminho = join(d, item);
      if (statSync(caminho).isDirectory()) anda(caminho);
      else if (item.endsWith(".css")) achados.push(caminho);
    }
  };
  anda(dir);
  return achados;
}

function tokensDeclarados() {
  const fonte = readFileSync(join(RAIZ, "src/lib/tema/tokens.ts"), "utf8");
  const bloco = (nome) => {
    const i = fonte.indexOf(`export const ${nome}`);
    if (i === -1) return "";
    const fim = fonte.indexOf("\n];", i);
    return fonte.slice(i, fim === -1 ? undefined : fim);
  };
  // Sem âncora de início de linha: em TOKENS_DE_RAIO cada item cabe numa linha só.
  const nomes = (texto) => [...texto.matchAll(/\bnome:\s*"([^"]+)"/g)].map((m) => m[1]);
  return {
    cores: nomes(bloco("TOKENS_DE_COR")),
    raios: nomes(bloco("TOKENS_DE_RAIO")),
  };
}

const { cores, raios } = tokensDeclarados();

if (cores.length === 0 || raios.length === 0) {
  console.error(
    "\n[tokens] Não consegui ler a lista em src/lib/tema/tokens.ts.\n" +
      "Se o formato do arquivo mudou, ajuste scripts/verificar-tokens.mjs.\n",
  );
  process.exit(1);
}

// ATENÇÃO: rode isto contra build de PRODUÇÃO. Em `next dev` o Tailwind declara
// todo token do `@theme`, e a remoção do que ninguém usa só acontece no build.
// Contra o dev, esta verificação aprova qualquer coisa.
const arquivos = arquivosCss(join(RAIZ, PASTA, "static", "css"));
if (arquivos.length === 0) {
  console.error(`\n[tokens] Nenhum CSS encontrado em ${PASTA}/static/css. Rode o build antes.\n`);
  process.exit(1);
}

const css = arquivos.map((f) => readFileSync(f, "utf8")).join("\n");

const faltando = [];
for (const nome of cores) {
  const declarado = css.includes(`--color-${nome}:`);
  const usado = css.includes(`var(--color-${nome})`);
  if (!declarado || !usado) faltando.push({ token: `--color-${nome}`, declarado, usado });
}
for (const nome of raios) {
  const declarado = css.includes(`--radius-${nome}:`);
  const usado = css.includes(`var(--radius-${nome})`);
  if (!declarado || !usado) faltando.push({ token: `--radius-${nome}`, declarado, usado });
}

if (faltando.length > 0) {
  console.error("\n[tokens] O painel de aparência oferece token que não existe no CSS gerado:\n");
  for (const f of faltando) {
    const motivo = !f.declarado
      ? "não foi emitido (nenhuma utilidade do Tailwind usa este token)"
      : "foi emitido mas ninguém o consome com var()";
    console.error(`  ${f.token}: ${motivo}`);
  }
  // Cuidado ao editar o texto abaixo: escrever um nome de classe real aqui faz o
  // Tailwind varrer ESTE arquivo, encontrar o candidato e gerar a utilidade,
  // fazendo o token "existir" e a guarda parar de reprovar. Já aconteceu.
  console.error(
    "\nComo resolver, escolha um:\n" +
      "  a) use o token em algum componente, com a classe correspondente\n" +
      "     (o token --color-x vira as classes bg-x, text-x e border-x), ou\n" +
      "  b) tire o token de TOKENS_DE_COR/TOKENS_DE_RAIO em src/lib/tema/tokens.ts.\n" +
      "Deixar como está entrega ao editor um controle que não muda nada na tela.\n",
  );
  process.exit(1);
}

console.log(
  `[tokens] ok: ${cores.length} cores e ${raios.length} raios presentes no CSS (${arquivos.length} arquivo(s)).`,
);
