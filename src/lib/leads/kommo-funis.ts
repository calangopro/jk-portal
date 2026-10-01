import "server-only";
import { SUBDOMINIO_KOMMO, type Chave } from "./chaves";

export type FunilDaKommo = { id: number; nome: string; etapas: { id: number; nome: string }[] };

/**
 * Funis e etapas da Kommo, para o painel escolher onde o negócio nasce.
 *
 * Fica de fora o que não serve de entrada: funil arquivado e as etapas de
 * fechamento (142, ganho; 143, perdido), que existem em todo funil.
 */
export async function funisDaKommo(chave: Chave): Promise<FunilDaKommo[] | null> {
  try {
    const r = await fetch(`https://${chave.meta.subdominio || SUBDOMINIO_KOMMO}.kommo.com/api/v4/leads/pipelines`, {
      headers: { Authorization: `Bearer ${chave.valor}` },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!r.ok) return null;
    const corpo = (await r.json()) as {
      _embedded?: {
        pipelines?: {
          id: number;
          name: string;
          is_archive?: boolean;
          _embedded?: { statuses?: { id: number; name: string; sort?: number }[] };
        }[];
      };
    };
    return (corpo._embedded?.pipelines ?? [])
      .filter((p) => !p.is_archive)
      .map((p) => ({
        id: p.id,
        nome: p.name,
        etapas: (p._embedded?.statuses ?? [])
          .filter((s) => s.id !== 142 && s.id !== 143)
          .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
          .map((s) => ({ id: s.id, nome: s.name })),
      }));
  } catch {
    return null;
  }
}
