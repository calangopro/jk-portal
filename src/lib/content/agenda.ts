/**
 * Hora de publicar, sempre no fuso de São Paulo.
 *
 * A decisão editorial é "sexta às 9 da manhã", nunca "12:00 UTC". Se o campo do
 * formulário usasse o fuso do navegador, a mesma escolha daria um horário
 * diferente para quem edita viajando ou com o computador configurado errado, e
 * o erro só apareceria depois, com a página no ar na hora errada.
 *
 * A conversão sai de `Intl`, e não de um "-03:00" fixo no código. O Brasil
 * acabou com o horário de verão em 2019, e se ele voltar um deslocamento
 * cravado passaria a errar uma hora sem ninguém perceber.
 */

export const FUSO = "America/Sao_Paulo";

/** Quantos minutos São Paulo está atrás do UTC naquele instante. */
function deslocamentoEmMinutos(instante: Date): number {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: FUSO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const p: Record<string, string> = {};
  for (const parte of f.formatToParts(instante)) p[parte.type] = parte.value;

  const comoSeFosseUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour),
    Number(p.minute),
    Number(p.second),
  );

  return (comoSeFosseUtc - instante.getTime()) / 60000;
}

/**
 * Converte "2026-08-20T09:00", digitado pensando em São Paulo, no instante real.
 *
 * Devolve null para texto vazio ou inválido, para o formulário poder tratar
 * "sem agendamento" com o mesmo caminho.
 */
export function instanteDeSaoPaulo(textoLocal: string): string | null {
  const t = textoLocal?.trim();
  if (!t) return null;

  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(t);
  if (!m) return null;

  const [, ano, mes, dia, hora, minuto] = m.map(Number) as unknown as number[];
  const palpite = Date.UTC(ano, mes - 1, dia, hora, minuto);

  // Duas passadas: a primeira acha o deslocamento aproximado, a segunda
  // confirma usando o instante já corrigido. Importa só na madrugada em que o
  // fuso muda, e é barato o bastante para rodar sempre.
  const primeiro = deslocamentoEmMinutos(new Date(palpite));
  const corrigido = palpite - primeiro * 60000;
  const segundo = deslocamentoEmMinutos(new Date(corrigido));

  const instante = new Date(palpite - segundo * 60000);
  return Number.isNaN(instante.getTime()) ? null : instante.toISOString();
}

/**
 * O caminho de volta: instante gravado vira "2026-08-20T09:00" para o campo.
 */
export function paraCampoLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";

  const f = new Intl.DateTimeFormat("sv-SE", {
    timeZone: FUSO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  // O locale sueco formata como "2026-08-20 09:00", que é o formato do
  // campo trocando o espaço por T. Usar isso evita montar a data à mão.
  return f.format(d).replace(" ", "T");
}

/** Data e hora por extenso, para a tela. Sempre com o fuso de São Paulo. */
export function quandoLegivel(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", {
    timeZone: FUSO,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Já passou da hora e continua fora do ar. */
export function atrasado(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  return !Number.isNaN(d.getTime()) && d.getTime() < Date.now();
}
