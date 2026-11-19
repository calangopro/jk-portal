/**
 * Tira os prints dos tutoriais: abre cada tela da página de demonstração
 * (`/ajuda-demo/<tela>`, dados inventados) num Chromium sem janela e salva em
 * `public/ajuda/<arquivo>.webp`, 1280 x 800 (ou 390 x 844 no celular), até uns 120 KB.
 *
 * Uso, com o servidor de desenvolvimento ligado (`nvm use && npm run dev`):
 *   npm run ajuda:prints                 refaz todos
 *   npm run ajuda:prints -- hoje         refaz só os de um manifesto (ou um arquivo: hoje-2)
 *
 * Cada manifesto é um arquivo em `scripts/ajuda/prints/<tela>.mts` (leia `docs/como-usar.md`).
 * Variáveis: AJUDA_URL (padrão http://localhost:3000/guias) e CHROME_PATH (um Chromium já baixado).
 */
import { readdirSync, mkdirSync, existsSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");
const sharp = require("sharp");

export type Print = {
  /** Nome do arquivo sem extensão, por exemplo `hoje-1`. */
  arquivo: string;
  /** A chave da tela em `src/app/ajuda-demo/telas.tsx`. */
  demo: string;
  /** Quem está olhando: `vendas` (padrão), `gerente` ou `diretoria`. */
  nivel?: string;
  /** Print de celular (390 x 844). */
  celular?: boolean;
  /** Parâmetros extras do endereço. */
  consulta?: string;
  /** Preparar a tela antes do print: clicar, digitar, abrir uma gaveta. */
  antes?: (page: any) => Promise<void>;
  /**
   * Partes da tela a destacar, por seletor do Playwright (`text=Nova venda`, `#id`, `button:has-text("X")`).
   * O script escreve a região de cada uma em porcentagem, pronta para colar em `regiao` no tutorial.
   */
  alvos?: Record<string, string>;
};

const BASE = process.env.AJUDA_URL ?? "http://localhost:3000/guias";
const SAIDA = join(process.cwd(), "public", "ajuda");
const TETO = 120 * 1024;

function acharChromium(): string {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const cache = join(homedir(), "Library", "Caches", "ms-playwright");
  const pastas = existsSync(cache) ? readdirSync(cache).filter((p) => p.startsWith("chromium_headless_shell-")).sort().reverse() : [];
  for (const p of pastas) {
    for (const sub of readdirSync(join(cache, p))) {
      const exe = join(cache, p, sub, "chrome-headless-shell");
      if (existsSync(exe)) return exe;
    }
  }
  throw new Error("Não achei um Chromium. Defina CHROME_PATH com o caminho de um chrome-headless-shell.");
}

const pasta = join(process.cwd(), "scripts", "ajuda", "prints");
const filtro = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const todos: Print[] = [];
for (const f of readdirSync(pasta).filter((n) => n.endsWith(".mts")).sort()) {
  const mod = await import(pathToFileURL(join(pasta, f)).href);
  todos.push(...(mod.default as Print[]));
}
const escolhidos = todos.filter((p) => filtro.length === 0 || filtro.some((f) => p.arquivo === f || p.arquivo.startsWith(`${f}-`) || p.demo === f));
if (escolhidos.length === 0) throw new Error(`Nenhum print casa com: ${filtro.join(", ")}`);

mkdirSync(SAIDA, { recursive: true });
const navegador = await chromium.launch({ executablePath: acharChromium() });
let total = 0;
for (const p of escolhidos) {
  const tam = p.celular ? { width: 390, height: 844 } : { width: 1280, height: 800 };
  const ctx = await navegador.newContext({ viewport: tam, deviceScaleFactor: 1, locale: "pt-BR", timezoneId: "America/Sao_Paulo", reducedMotion: "reduce", hasTouch: Boolean(p.celular) });
  const page = await ctx.newPage();
  const url = `${BASE}/ajuda-demo/${p.demo}?nivel=${p.nivel ?? "vendas"}${p.consulta ? `&${p.consulta}` : ""}`;
  const r = await page.goto(url, { waitUntil: "networkidle" });
  if (!r || !r.ok()) throw new Error(`${url} respondeu ${r?.status()}. O servidor está ligado e é de desenvolvimento?`);
  // Sem o indicador do Next, que não faz parte da tela.
  await page.addStyleTag({ content: "nextjs-portal, [data-nextjs-toast] { display: none !important }" });
  await page.waitForTimeout(500);
  if (p.antes) await p.antes(page);
  await page.waitForTimeout(300);
  const png = await page.screenshot({ type: "png" });
  for (const [nome, seletor] of Object.entries(p.alvos ?? {})) {
    const caixa = await page.locator(seletor).first().boundingBox().catch(() => null);
    const pct = (v: number, de: number) => Math.round((v / de) * 1000) / 10;
    console.log(caixa
      ? `    ${nome}: { x: ${pct(caixa.x, tam.width)}, y: ${pct(caixa.y, tam.height)}, l: ${pct(caixa.width, tam.width)}, a: ${pct(caixa.height, tam.height)} }`
      : `    ${nome}: NÃO ACHEI (${seletor})`);
  }
  let q = 80;
  let buf: Buffer = await sharp(png).webp({ quality: q }).toBuffer();
  while (buf.length > TETO && q > 40) {
    q -= 8;
    buf = await sharp(png).webp({ quality: q }).toBuffer();
  }
  writeFileSync(join(SAIDA, `${p.arquivo}.webp`), buf);
  total += buf.length;
  console.log(`${p.arquivo}.webp  ${tam.width}x${tam.height}  ${(buf.length / 1024).toFixed(0)} KB${buf.length > TETO ? "  (acima de 120 KB)" : ""}`);
  await ctx.close();
}
await navegador.close();
console.log(`${escolhidos.length} prints, ${(total / 1024).toFixed(0)} KB no total`);
