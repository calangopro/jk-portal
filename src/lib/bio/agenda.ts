import type { Bio, CampanhaDaBio, VersaoDaBio } from "./tipos";

/**
 * Qual versão da bio vale num dia.
 *
 * Tudo compara DIA com dia, em texto AAAA-MM-DD no fuso de São Paulo (ver
 * `hojeEmSaoPaulo`). Comparar hora cheia de fuso seria convidar erro de
 * madrugada, e a campanha da loja também vira pela data, não pela hora.
 */

function duracao(c: CampanhaDaBio): number {
  return Date.parse(c.fim) - Date.parse(c.inicio);
}

/**
 * A campanha no ar no dia, ou nenhuma.
 *
 * Duas campanhas no mesmo dia: vence a MAIS CURTA. É o caso do dia da Black
 * dentro do mês da Black, em que o dia é a exceção e o mês é a regra. Empate
 * fica com a que vem primeiro nas abas.
 */
export function campanhaDoDia(bio: Bio, hoje: string): CampanhaDaBio | null {
  const vigentes = bio.campanhas.filter((c) => c.ativa && hoje >= c.inicio && hoje <= c.fim);
  if (vigentes.length === 0) return null;
  return vigentes.reduce((melhor, c) => (duracao(c) < duracao(melhor) ? c : melhor));
}

export function versaoNormal(bio: Bio): VersaoDaBio {
  return { tema: "padrao", blocos: bio.normal.blocos.filter((b) => b.visivel), fim: null, codigo: "" };
}

export function versaoDaCampanha(c: CampanhaDaBio): VersaoDaBio {
  return { tema: c.tema, blocos: c.blocos.filter((b) => b.visivel), fim: c.fim, codigo: c.id };
}

export function versaoDoDia(bio: Bio, hoje: string): VersaoDaBio {
  const c = campanhaDoDia(bio, hoje);
  return c ? versaoDaCampanha(c) : versaoNormal(bio);
}

/**
 * Fim do dia em São Paulo, como instante. O Brasil não tem horário de verão
 * desde 2019, então o deslocamento é fixo.
 */
export function fimDoDiaEmSaoPaulo(dia: string): string {
  return `${dia}T23:59:59-03:00`;
}
