/**
 * Andamento da meta do mês: quanto já foi, em que ritmo e onde o mês fecha.
 *
 * Conta pura, para o teste rodar sem banco. O ritmo conta o dia de hoje como
 * dia corrido, mesmo incompleto, então a projeção de manhã sai conservadora e
 * melhora ao longo do dia. É de propósito: prefiro o painel dizendo "atrás"
 * cedo do que prometendo um mês que não vem.
 */

export type Situacao = "batida" | "no_ritmo" | "atras";

export type Andamento = {
  meta: number;
  feito: number;
  /** De 0 a 1, travado em 1 quando a meta foi batida. */
  fracao: number;
  /** Onde a barra deveria estar hoje, se o mês fosse vendido por igual. */
  esperado: number;
  dia: number;
  diasNoMes: number;
  diasQueFaltam: number;
  falta: number;
  /** Média por dia até agora. */
  ritmo: number;
  /** Quanto precisa entrar por dia, nos dias que faltam, para bater. */
  precisaPorDia: number;
  /** Onde o mês fecha se o ritmo continuar. */
  projecao: number;
  situacao: Situacao;
};

const centavos = (n: number) => Math.round(n * 100) / 100;

export function diasDoMes(dia: string): number {
  return new Date(Date.UTC(Number(dia.slice(0, 4)), Number(dia.slice(5, 7)), 0)).getUTCDate();
}

export function andamentoDaMeta(meta: number, feito: number, hoje: string): Andamento {
  const diasNoMes = diasDoMes(hoje);
  const dia = Number(hoje.slice(8, 10));
  const diasQueFaltam = diasNoMes - dia;
  const falta = Math.max(meta - feito, 0);
  const ritmo = feito / dia;
  const projecao = ritmo * diasNoMes;
  return {
    meta,
    feito,
    fracao: meta > 0 ? Math.min(feito / meta, 1) : 0,
    esperado: dia / diasNoMes,
    dia,
    diasNoMes,
    diasQueFaltam,
    falta: centavos(falta),
    ritmo: centavos(ritmo),
    // No último dia não há "dias que faltam": o que falta é para hoje.
    precisaPorDia: centavos(diasQueFaltam > 0 ? falta / diasQueFaltam : falta),
    projecao: centavos(projecao),
    situacao: feito >= meta ? "batida" : projecao >= meta ? "no_ritmo" : "atras",
  };
}
