/**
 * O horário de funcionamento: do formato do Google para o do portal, e do
 * portal para uma frase.
 *
 * O Google devolve `regularHours.periods`, um período por dia ("MONDAY", das
 * 10 às 22). O portal guarda no formato do schema.org, que é o que a página da
 * loja publica: uma faixa de horas com a lista dos dias em que ela vale.
 *
 * Arquivo puro, para o teste rodar sem banco.
 */

export type Hora = { hours?: number; minutes?: number };
export type PeriodoDoGoogle = { openDay?: string; openTime?: Hora; closeDay?: string; closeTime?: Hora };
export type HorarioDoGoogle = { periods?: PeriodoDoGoogle[] };

/** Uma faixa de horário, como a página da loja guarda. */
export type Faixa = { opens: string; closes: string; dayOfWeek: string[] };

const DIAS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
const DIA_DO_PORTAL: Record<string, string> = { MONDAY: "Monday", TUESDAY: "Tuesday", WEDNESDAY: "Wednesday", THURSDAY: "Thursday", FRIDAY: "Friday", SATURDAY: "Saturday", SUNDAY: "Sunday" };
const CURTO: Record<string, string> = { Monday: "seg", Tuesday: "ter", Wednesday: "qua", Thursday: "qui", Friday: "sex", Saturday: "sáb", Sunday: "dom" };
const ORDEM = Object.values(DIA_DO_PORTAL);

function emTexto(h: Hora | undefined): string | null {
  const horas = h?.hours ?? 0;
  const minutos = h?.minutes ?? 0;
  if (!Number.isInteger(horas) || !Number.isInteger(minutos) || horas < 0 || horas > 24 || minutos < 0 || minutos > 59) return null;
  // O Google escreve meia-noite do fim do dia como 24:00. Na página vale 23:59.
  if (horas === 24) return "23:59";
  return `${String(horas).padStart(2, "0")}:${String(minutos).padStart(2, "0")}`;
}

/**
 * O horário do Google no formato do portal. Dias com a mesma faixa viram uma
 * linha só. Devolve `null` quando não há período nenhum que dê para ler: o
 * portal não publica horário pela metade.
 */
export function faixasDoGoogle(h: HorarioDoGoogle | null | undefined): Faixa[] | null {
  const periodos = Array.isArray(h?.periods) ? h.periods : [];
  const porFaixa = new Map<string, string[]>();
  for (const p of periodos) {
    const dia = p.openDay && DIAS.includes(p.openDay) ? DIA_DO_PORTAL[p.openDay] : null;
    const abre = emTexto(p.openTime);
    const fecha = emTexto(p.closeTime);
    if (!dia || !abre || !fecha || abre === fecha) continue;
    const chave = `${abre}|${fecha}`;
    const dias = porFaixa.get(chave) ?? [];
    if (!dias.includes(dia)) dias.push(dia);
    porFaixa.set(chave, dias);
  }
  if (porFaixa.size === 0) return null;
  return [...porFaixa.entries()]
    .map(([chave, dias]) => {
      const [opens, closes] = chave.split("|");
      return { opens, closes, dayOfWeek: dias.sort((a, b) => ORDEM.indexOf(a) - ORDEM.indexOf(b)) };
    })
    .sort((a, b) => ORDEM.indexOf(a.dayOfWeek[0]) - ORDEM.indexOf(b.dayOfWeek[0]));
}

const hora = (t: string) => (t.endsWith(":00") ? `${Number(t.slice(0, 2))}h` : `${Number(t.slice(0, 2))}h${t.slice(3)}`);

/** Dias seguidos viram "seg a sáb"; soltos, "seg, qua e sex". */
function diasEmTexto(dias: string[]): string {
  const idx = dias.map((d) => ORDEM.indexOf(d)).filter((i) => i >= 0).sort((a, b) => a - b);
  if (idx.length === 0) return "";
  const seguidos = idx.every((v, i) => i === 0 || v === idx[i - 1] + 1);
  const nomes = idx.map((i) => CURTO[ORDEM[i]]);
  if (seguidos && nomes.length >= 3) return `${nomes[0]} a ${nomes[nomes.length - 1]}`;
  if (nomes.length === 1) return nomes[0];
  return `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
}

/** "seg a sáb, das 10h às 22h; dom, das 14h às 20h". */
export function horarioEmTexto(faixas: Faixa[] | null | undefined): string {
  if (!faixas || faixas.length === 0) return "";
  return faixas.map((f) => `${diasEmTexto(f.dayOfWeek)}, das ${hora(f.opens)} às ${hora(f.closes)}`).join("; ");
}

/** A mesma lista de faixas? Serve para dizer se o portal e o Google concordam. */
export function mesmoHorario(a: Faixa[] | null | undefined, b: Faixa[] | null | undefined): boolean {
  return horarioEmTexto(a) === horarioEmTexto(b) && horarioEmTexto(a) !== "";
}
