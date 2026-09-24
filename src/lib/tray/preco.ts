/**
 * O preço que a loja está cobrando HOJE, a partir do que a Tray entrega.
 *
 * A Tray não apaga `promotional_price` quando a promoção acaba. O campo fica lá,
 * com a janela (`start_promotion`, `end_promotion`) já vencida, e a loja volta a
 * mostrar o preço cheio. Medido em 24/09/2026: 589 produtos com preço
 * promocional preenchido e só 8 dentro da janela. Ler o campo sem a data é
 * anunciar desconto que não existe, que é exatamente o que o projeto proíbe.
 *
 * As duas pontas da janela valem o dia inteiro. Conferido na loja: o Eternal
 * Love, com janela de 01/09 a 30/09, aparece "de 449,90 por 399,90" no dia 24.
 * Data vazia ou "0000-00-00" é janela aberta daquele lado.
 *
 * Função pura, sem banco e sem `server-only`, para valer no servidor e no
 * navegador com a mesma regra.
 */

export type PrecoDaTray = {
  price: number | string | null | undefined;
  promotional_price?: number | string | null;
  start_promotion?: string | null;
  end_promotion?: string | null;
};

export type PrecoVigente = {
  /** O que a pessoa paga hoje. Nulo quando a Tray não tem preço. */
  atual: number | null;
  /** Preço cheio, só quando existe promoção valendo. */
  anterior: number | null;
  /** Percentual inteiro de desconto, só com promoção valendo. */
  desconto: number | null;
};

function numero(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function dataOuNula(v: string | null | undefined): string | null {
  if (!v) return null;
  const s = v.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || s.startsWith("0000")) return null;
  return s;
}

/** "AAAA-MM-DD" do dia em São Paulo, que é o relógio da loja. */
export function hojeEmSaoPaulo(agora: Date = new Date()): string {
  // `en-CA` formata como AAAA-MM-DD, que compara certo como texto.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
}

export function precoVigente(p: PrecoDaTray, hoje: string = hojeEmSaoPaulo()): PrecoVigente {
  const cheio = numero(p.price);
  const promo = numero(p.promotional_price);
  const inicio = dataOuNula(p.start_promotion);
  const fim = dataOuNula(p.end_promotion);

  const dentroDaJanela = (!inicio || hoje >= inicio) && (!fim || hoje <= fim);
  const valendo = cheio != null && promo != null && promo < cheio && dentroDaJanela;

  if (!valendo) return { atual: cheio, anterior: null, desconto: null };

  return {
    atual: promo,
    anterior: cheio,
    desconto: Math.round((1 - promo / cheio) * 100),
  };
}
