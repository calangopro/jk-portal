/**
 * Períodos da tela de vendas, sempre no dia de São Paulo.
 *
 * O servidor da Vercel roda em UTC: às 22h de São Paulo já é "amanhã" lá, e
 * `new Date().toISOString()` mostraria o dia seguinte zerado. Por isso "hoje"
 * sai do fuso de São Paulo e toda conta de dia é feita em cima do texto
 * AAAA-MM-DD, sem hora. Arquivo puro, para o teste rodar sem banco.
 */

export const PERIODOS = [
  { chave: "mes", rotulo: "Este mês" },
  { chave: "7d", rotulo: "7 dias" },
  { chave: "30d", rotulo: "30 dias" },
  { chave: "mes-passado", rotulo: "Mês passado" },
] as const;

export type ChaveDePeriodo = (typeof PERIODOS)[number]["chave"];

export function lerPeriodo(v: string | undefined): ChaveDePeriodo {
  return PERIODOS.some((p) => p.chave === v) ? (v as ChaveDePeriodo) : "mes";
}

export function hojeEmSaoPaulo(agora: Date = new Date()): string {
  // en-CA escreve AAAA-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(agora);
}

function paraData(dia: string): Date {
  return new Date(`${dia}T00:00:00Z`);
}

function paraDia(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function somarDias(dia: string, n: number): string {
  const d = paraData(dia);
  d.setUTCDate(d.getUTCDate() + n);
  return paraDia(d);
}

export function primeiroDoMes(dia: string): string {
  return `${dia.slice(0, 8)}01`;
}

function ultimoDoMes(dia: string): string {
  const d = paraData(primeiroDoMes(dia));
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  return paraDia(d);
}

/** Todos os dias de `de` a `ate`, as duas pontas inclusive. */
export function diasEntre(de: string, ate: string): string[] {
  const dias: string[] = [];
  for (let d = de; d <= ate; d = somarDias(d, 1)) dias.push(d);
  return dias;
}

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export function nomeDoMes(dia: string): string {
  return MESES[Number(dia.slice(5, 7)) - 1];
}

/** "2026-11-12" vira "12/11". */
export function diaCurto(dia: string): string {
  return `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
}

export type Intervalo = {
  de: string;
  ate: string;
  /** Período de comparação, do mesmo tamanho. */
  anteriorDe: string;
  anteriorAte: string;
  /** Como a tela chama a comparação: "sobre os 7 dias anteriores". */
  comparacao: string;
};

export function intervaloDoPeriodo(chave: ChaveDePeriodo, hoje: string): Intervalo {
  if (chave === "7d" || chave === "30d") {
    const n = chave === "7d" ? 7 : 30;
    const de = somarDias(hoje, -(n - 1));
    return {
      de,
      ate: hoje,
      anteriorDe: somarDias(de, -n),
      anteriorAte: somarDias(de, -1),
      comparacao: `sobre os ${n} dias anteriores`,
    };
  }

  if (chave === "mes-passado") {
    const ate = somarDias(primeiroDoMes(hoje), -1);
    const de = primeiroDoMes(ate);
    const anteriorAte = somarDias(de, -1);
    return {
      de,
      ate,
      anteriorDe: primeiroDoMes(anteriorAte),
      anteriorAte,
      comparacao: `sobre ${nomeDoMes(anteriorAte)}`,
    };
  }

  // Este mês: do dia 1 até hoje, contra os mesmos dias do mês passado. Mês
  // cheio contra mês pela metade daria sempre queda.
  const de = primeiroDoMes(hoje);
  const fimDoAnterior = somarDias(de, -1);
  const anteriorDe = primeiroDoMes(fimDoAnterior);
  const mesmoDia = `${anteriorDe.slice(0, 8)}${hoje.slice(8, 10)}`;
  const anteriorAte = mesmoDia <= ultimoDoMes(anteriorDe) ? mesmoDia : ultimoDoMes(anteriorDe);
  return {
    de,
    ate: hoje,
    anteriorDe,
    anteriorAte,
    comparacao: `sobre os mesmos dias de ${nomeDoMes(anteriorDe)}`,
  };
}
