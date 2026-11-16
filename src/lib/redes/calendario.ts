/**
 * O calendário do Social Media: o que sai e o que saiu, dia a dia. Conta pura,
 * com teste em `scripts/teste-redes.mts`.
 *
 * Tudo no horário de Brasília: o dia de um post é o dia em São Paulo, não o do
 * servidor (às 22h a Vercel já está no dia seguinte). A semana começa no
 * domingo, como no calendário de parede.
 */
import type { RedeId } from "./redes.ts";

export type SituacaoNoCalendario = "agendado" | "publicando" | "publicado" | "erro" | "ideia";

export type ItemDoCalendario = {
  chave: string;
  situacao: SituacaoNoCalendario;
  /** Quando sai ou quando saiu, em ISO. */
  quando: string;
  redes: RedeId[];
  formato: string | null;
  legenda: string;
  miniatura: string | null;
  /** Para onde o clique leva: a página do post publicado, ou o post no compositor. */
  href: string;
  /** Story de sequência: "<id da sequência>:<posição>". Nulo: post solto. */
  sequencia: string | null;
};

export type DiaDoCalendario = { data: string; doMes: boolean; hoje: boolean };

/** "2026-11" ou nulo. */
export function lerMes(texto: string | null | undefined): string | null {
  return texto && /^\d{4}-(0[1-9]|1[0-2])$/.test(texto) ? texto : null;
}

/** O dia (AAAA-MM-DD) de um instante, em São Paulo. */
export function diaEmSaoPaulo(iso: string | number): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

/** O mês (AAAA-MM) de um instante, em São Paulo. */
export function mesEmSaoPaulo(iso: string | number): string {
  return diaEmSaoPaulo(iso).slice(0, 7);
}

/** O mês anterior ou o seguinte. */
export function mesVizinho(mes: string, passo: -1 | 1): string {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + passo, 1));
  return d.toISOString().slice(0, 7);
}

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "novembro de 2026". */
export function nomeDoMes(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  return `${MESES[m - 1]} de ${a}`;
}

/**
 * Os dias da grade: do domingo antes do dia 1 ao sábado depois do último dia,
 * em semanas inteiras (quatro a seis).
 */
export function diasDaGrade(mes: string, hoje: string): DiaDoCalendario[] {
  const [a, m] = mes.split("-").map(Number);
  const primeiro = new Date(Date.UTC(a, m - 1, 1));
  const ultimo = new Date(Date.UTC(a, m, 0));
  const inicio = new Date(primeiro);
  inicio.setUTCDate(1 - primeiro.getUTCDay());
  const fim = new Date(ultimo);
  fim.setUTCDate(ultimo.getUTCDate() + (6 - ultimo.getUTCDay()));
  const dias: DiaDoCalendario[] = [];
  for (const d = new Date(inicio); d <= fim; d.setUTCDate(d.getUTCDate() + 1)) {
    const data = d.toISOString().slice(0, 10);
    dias.push({ data, doMes: data.slice(0, 7) === mes, hoje: data === hoje });
  }
  return dias;
}

/** O intervalo da grade em instantes, para a leitura do banco (meia-noite de São Paulo, UTC-3). */
export function intervaloDaGrade(dias: DiaDoCalendario[]): { de: string; ate: string } {
  const de = new Date(`${dias[0].data}T00:00:00-03:00`).toISOString();
  const fim = new Date(`${dias[dias.length - 1].data}T00:00:00-03:00`);
  fim.setUTCDate(fim.getUTCDate() + 1);
  return { de, ate: fim.toISOString() };
}

/** Os itens de cada dia, do mais cedo para o mais tarde. */
export function porDia(itens: ItemDoCalendario[]): Map<string, ItemDoCalendario[]> {
  const mapa = new Map<string, ItemDoCalendario[]>();
  for (const i of [...itens].sort((a, b) => Date.parse(a.quando) - Date.parse(b.quando))) {
    const d = diaEmSaoPaulo(i.quando);
    mapa.set(d, [...(mapa.get(d) ?? []), i]);
  }
  return mapa;
}

/** "19h", "9h30". */
export function horaCurta(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).replace(/^0/, "").replace(":00", "h").replace(":", "h");
}
