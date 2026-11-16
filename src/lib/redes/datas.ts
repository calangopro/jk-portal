/**
 * As datas que vêm aí, para o banco de ideias do Social Media. Conta pura, com
 * teste em `scripts/teste-redes.mts`.
 *
 * Duas fontes. As datas do comércio, que são de calendário e não dependem da
 * JK (Dia dos Namorados, Black Friday, Natal...), e as CAMPANHAS DA CASA, que
 * são as da bio (`site_settings`, `pagina:bio`): Esquenta, Black, Aniversário
 * JK, Natal. A lista do comércio é curta de propósito: só o que vende
 * aliança, joia ou presente.
 */

export type DataQueVem = {
  /** Primeiro dia (AAAA-MM-DD). */
  data: string;
  /** Último dia, quando é período (campanha). */
  fim: string | null;
  nome: string;
  tipo: "comercio" | "campanha";
  /** Quantos dias faltam para começar. Zero: começa hoje, ou já está no ar. */
  faltam: number;
};

type Campanha = { nome: string; inicio: string; fim: string; ativa?: boolean };

const doisDigitos = (n: number) => String(n).padStart(2, "0");
const iso = (a: number, m: number, d: number) => `${a}-${doisDigitos(m)}-${doisDigitos(d)}`;

/** O n-ésimo dia da semana (0 = domingo) de um mês. */
function enesimo(ano: number, mes: number, diaDaSemana: number, n: number): string {
  const primeiro = new Date(Date.UTC(ano, mes - 1, 1)).getUTCDay();
  const dia = 1 + ((diaDaSemana - primeiro + 7) % 7) + (n - 1) * 7;
  return iso(ano, mes, dia);
}

/** As datas do comércio de um ano. */
export function datasDoComercio(ano: number): { data: string; nome: string }[] {
  const quartaQuinta = Number(enesimo(ano, 11, 4, 4).slice(8));
  return [
    { data: iso(ano, 3, 8), nome: "Dia Internacional da Mulher" },
    { data: iso(ano, 4, 13), nome: "Dia do Beijo" },
    { data: enesimo(ano, 5, 0, 2), nome: "Dia das Mães" },
    { data: iso(ano, 6, 12), nome: "Dia dos Namorados" },
    { data: enesimo(ano, 8, 0, 2), nome: "Dia dos Pais" },
    { data: iso(ano, 9, 15), nome: "Dia do Cliente" },
    // A sexta-feira depois da quarta quinta-feira de novembro.
    { data: iso(ano, 11, quartaQuinta + 1), nome: "Black Friday" },
    { data: iso(ano, 12, 25), nome: "Natal" },
    { data: iso(ano, 12, 31), nome: "Véspera de Ano-Novo" },
  ];
}

const diasEntre = (de: string, ate: string) => Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86_400_000);

/**
 * As datas dos próximos `janela` dias, a partir de `hoje` (AAAA-MM-DD, dia de
 * Brasília), da mais perto para a mais longe. Campanha que já começou e não
 * acabou entra com `faltam` zero: ela está no ar.
 */
export function proximasDatas(hoje: string, janela: number, campanhas: Campanha[] = []): DataQueVem[] {
  const ano = Number(hoje.slice(0, 4));
  const comercio = [...datasDoComercio(ano), ...datasDoComercio(ano + 1)]
    .map((d) => ({ data: d.data, fim: null, nome: d.nome, tipo: "comercio" as const, faltam: diasEntre(hoje, d.data) }))
    .filter((d) => d.faltam >= 0 && d.faltam <= janela);
  const daCasa = campanhas
    .filter((c) => c.ativa !== false && /^\d{4}-\d{2}-\d{2}$/.test(c.inicio) && /^\d{4}-\d{2}-\d{2}$/.test(c.fim) && c.fim >= hoje)
    .map((c) => ({ data: c.inicio, fim: c.fim, nome: c.nome, tipo: "campanha" as const, faltam: Math.max(0, diasEntre(hoje, c.inicio)) }))
    .filter((c) => c.faltam <= janela);
  return [...daCasa, ...comercio].sort((a, b) => a.faltam - b.faltam || (a.tipo === "campanha" ? -1 : 1));
}

/** "hoje", "amanhã", "em 12 dias", "no ar até 30/11". */
export function quandoEmPalavra(d: DataQueVem): string {
  if (d.tipo === "campanha" && d.faltam === 0 && d.fim) return `no ar até ${d.fim.slice(8)}/${d.fim.slice(5, 7)}`;
  if (d.faltam === 0) return "hoje";
  if (d.faltam === 1) return "amanhã";
  return `em ${d.faltam} dias`;
}
