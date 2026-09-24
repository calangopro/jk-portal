import type { Bio, BlocoDaBio, ItemDeLink, TemaDaBio } from "./tipos";

/**
 * A bio no dia de hoje: qual tema vale e quais blocos aparecem.
 *
 * Tudo compara DIA com dia, em texto AAAA-MM-DD no fuso de São Paulo (ver
 * `hojeEmSaoPaulo`). Comparar hora cheia de fuso seria convidar erro de
 * madrugada, e a campanha da loja também vira pela data, não pela hora.
 */

type ComAgenda = { inicio: string | null; fim: string | null };

export function valeNoDia(item: ComAgenda, hoje: string): boolean {
  return (!item.inicio || hoje >= item.inicio) && (!item.fim || hoje <= item.fim);
}

export function temaDoDia(bio: Bio, hoje: string): TemaDaBio {
  if (bio.tema !== "automatico") return bio.tema;
  return bio.campanhas.find((c) => hoje >= c.inicio && hoje <= c.fim)?.tema ?? "padrao";
}

export function blocosDoDia(bio: Bio, hoje: string): BlocoDaBio[] {
  return bio.blocos
    .filter((b) => b.visivel && valeNoDia(b, hoje))
    .map((b) =>
      b.tipo === "links"
        ? { ...b, itens: b.itens.filter((i: ItemDeLink) => valeNoDia(i, hoje)) }
        : b,
    );
}

/**
 * Fim do dia em São Paulo, como instante. O Brasil não tem horário de verão
 * desde 2019, então o deslocamento é fixo.
 */
export function fimDoDiaEmSaoPaulo(dia: string): string {
  return `${dia}T23:59:59-03:00`;
}
