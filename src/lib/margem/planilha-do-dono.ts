/**
 * Lê a planilha de custos que o dono preencheu (a que foi gerada em
 * 09/11/2026, "custos-jk-para-o-dono.xlsx") e devolve só o que ele digitou.
 *
 * As colunas são achadas pelo TÍTULO na primeira linha, e não pela letra: se
 * alguém inserir uma coluna no meio, a leitura continua certa. Célula vazia
 * não entra, para a importação nunca apagar custo que já estava no painel.
 *
 * Sem `@/`, para rodar no teste `npm run verificar:margem`.
 */
import type { Parametros } from "./calculo.ts";
import type { Aba, Celula, Pasta } from "./ler-xlsx.ts";

export type ImportacaoDeCustos = {
  parametros: Partial<Parametros>;
  familias: { codigo: string; gramas: number | null; arosReferencia: string | null; resto: number | null }[];
  ouro: { trayId: string; gramas: number | null; resto: number | null }[];
  fixos: { trayId: string; custo: number }[];
  avisos: string[];
};

export class PlanilhaDoDonoInvalida extends Error {}

/** "4,5", "R$ 1.234,50", 4.5 viram número. Vazio e texto viram nulo. */
export function numeroDaCelula(v: Celula): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const s = v.replace(/R\$|\s|%/g, "");
  if (!s) return null;
  const normal = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  const n = Number(normal);
  return Number.isFinite(n) ? n : null;
}

/** Porcentagem digitada sem o sinal (5 em vez de 5%) vira fração. */
const fracao = (v: Celula) => {
  const n = numeroDaCelula(v);
  if (n === null) return null;
  return n > 1 ? n / 100 : n;
};

/** O código da Tray pode ter virado número no Excel (217 ou 217.0). */
const codigo = (v: Celula) => {
  if (typeof v === "number") return String(Math.round(v));
  return typeof v === "string" && v.trim() ? v.trim() : null;
};

const semAcento = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function colunas(aba: Aba, titulos: Record<string, string>, nomeDaAba: string): Record<string, string> {
  const cabecalho = aba[1] ?? {};
  const achadas: Record<string, string> = {};
  for (const [chave, titulo] of Object.entries(titulos)) {
    const letra = Object.keys(cabecalho).find(
      (l) => typeof cabecalho[l] === "string" && semAcento(String(cabecalho[l])).startsWith(semAcento(titulo)),
    );
    if (!letra) throw new PlanilhaDoDonoInvalida(`Na aba "${nomeDaAba}", não achei a coluna "${titulo}".`);
    achadas[chave] = letra;
  }
  return achadas;
}

function linhas(aba: Aba): Record<string, Celula>[] {
  return Object.keys(aba)
    .map(Number)
    .filter((n) => n > 1)
    .sort((a, b) => a - b)
    .map((n) => aba[n]);
}

const PARAMETROS: { chave: keyof Parametros; comeco: string; pct: boolean }[] = [
  { chave: "cotacao18k", comeco: "preco do grama do ouro 18k", pct: false },
  { chave: "cotacao10k", comeco: "preco do grama do ouro 10k", pct: false },
  { chave: "taxa", comeco: "taxa media", pct: true },
  { chave: "imposto", comeco: "imposto", pct: true },
  { chave: "frete", comeco: "frete", pct: false },
  { chave: "embalagem", comeco: "embalagem", pct: false },
  { chave: "margemMinima", comeco: "margem minima", pct: true },
];

export function lerPlanilhaDoDono(pasta: Pasta): ImportacaoDeCustos {
  const faltam = ["Parâmetros", "Ouro por família", "Ouro produto a produto", "Prata e semijoia"].filter((n) => !pasta[n]);
  if (faltam.length) {
    throw new PlanilhaDoDonoInvalida(
      `Esta não parece a planilha de custos da JK. Faltam as abas: ${faltam.join(", ")}.`,
    );
  }
  const avisos: string[] = [];

  // Parâmetros: pelo rótulo da coluna A, não pela linha.
  const parametros: Partial<Parametros> = {};
  for (const l of linhas(pasta["Parâmetros"])) {
    const rotulo = typeof l.A === "string" ? semAcento(l.A) : "";
    const p = PARAMETROS.find((x) => rotulo.startsWith(x.comeco));
    if (!p) continue;
    const valor = p.pct ? fracao(l.B ?? null) : numeroDaCelula(l.B ?? null);
    if (valor === null) continue;
    if (valor < 0 || (p.pct && valor >= 1)) {
      avisos.push(`Parâmetro "${l.A}" com valor fora do esperado (${l.B}), ignorado.`);
      continue;
    }
    parametros[p.chave] = valor;
  }

  const fam = pasta["Ouro por família"];
  const cf = colunas(fam, { codigo: "Família", gramas: "Gramas de ouro", aros: "Aros de referência", resto: "Resto da peça" }, "Ouro por família");
  const familias: ImportacaoDeCustos["familias"] = [];
  for (const l of linhas(fam)) {
    const c = codigo(l[cf.codigo] ?? null);
    if (!c || !/^F\d{2,3}$/.test(c)) continue;
    const gramas = numeroDaCelula(l[cf.gramas] ?? null);
    const resto = numeroDaCelula(l[cf.resto] ?? null);
    const aros = l[cf.aros];
    const arosReferencia = aros === null || aros === undefined || aros === "" ? null : String(aros).slice(0, 60);
    if (gramas !== null && gramas <= 0) avisos.push(`Família ${c}: gramas ${gramas} ignorado.`);
    if (gramas === null && resto === null && arosReferencia === null) continue;
    familias.push({ codigo: c, gramas: gramas && gramas > 0 ? gramas : null, arosReferencia, resto: resto !== null && resto >= 0 ? resto : null });
  }

  const ouroAba = pasta["Ouro produto a produto"];
  const co = colunas(ouroAba, { codigo: "Código", gramas: "Gramas (se diferente)", resto: "Resto da peça (se diferente)" }, "Ouro produto a produto");
  const ouro: ImportacaoDeCustos["ouro"] = [];
  for (const l of linhas(ouroAba)) {
    const c = codigo(l[co.codigo] ?? null);
    if (!c) continue;
    const gramas = numeroDaCelula(l[co.gramas] ?? null);
    const resto = numeroDaCelula(l[co.resto] ?? null);
    if (gramas === null && resto === null) continue;
    ouro.push({ trayId: c, gramas: gramas && gramas > 0 ? gramas : null, resto: resto !== null && resto >= 0 ? resto : null });
  }

  const prata = pasta["Prata e semijoia"];
  const cp = colunas(prata, { codigo: "Código", custo: "Custo da peça" }, "Prata e semijoia");
  const fixos: ImportacaoDeCustos["fixos"] = [];
  for (const l of linhas(prata)) {
    const c = codigo(l[cp.codigo] ?? null);
    const custo = numeroDaCelula(l[cp.custo] ?? null);
    if (!c || custo === null) continue;
    if (custo < 0) {
      avisos.push(`Produto ${c}: custo negativo ignorado.`);
      continue;
    }
    fixos.push({ trayId: c, custo });
  }

  return { parametros, familias, ouro, fixos, avisos };
}
