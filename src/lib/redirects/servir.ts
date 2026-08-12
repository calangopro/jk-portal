/**
 * Serve a tabela `redirects`.
 *
 * A tabela existe desde a primeira migration e nunca era lida, ou seja,
 * cadastrar um redirect não fazia efeito nenhum. Isso importa em dois momentos:
 * quando alguém muda o slug de um conteúdo já publicado, e numa eventual
 * mudança de endereço do portal.
 *
 * Roda no middleware, então precisa ser barato. A lista inteira é carregada de
 * uma vez e guardada em memória por um tempo curto, o que dá no máximo uma
 * consulta por minuto em cada instância, e não uma por visita.
 */

export type Redirect = {
  source_path: string;
  destination_url: string;
  status: "301" | "302" | "410";
};

const VALIDADE_MS = 60_000;

let cache: Map<string, Redirect> | null = null;
let carregadoEm = 0;
let carregando: Promise<Map<string, Redirect>> | null = null;

/** Normaliza para comparar sem depender de barra no fim. */
export function normalizar(caminho: string): string {
  const limpo = caminho.split("?")[0].split("#")[0];
  if (limpo.length > 1 && limpo.endsWith("/")) return limpo.slice(0, -1);
  return limpo;
}

async function buscar(): Promise<Map<string, Redirect>> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !chave) return new Map();

  const endereco = `${url}/rest/v1/redirects?select=source_path,destination_url,status`;

  const resp = await fetch(endereco, {
    headers: { apikey: chave, Authorization: `Bearer ${chave}` },
    cache: "no-store",
  });

  if (!resp.ok) return new Map();

  const linhas = (await resp.json()) as Redirect[];
  const mapa = new Map<string, Redirect>();
  for (const l of linhas) {
    if (l.source_path) mapa.set(normalizar(l.source_path), l);
  }
  return mapa;
}

/** Procura um redirect para o caminho, usando o cache curto. */
export async function acharRedirect(caminho: string): Promise<Redirect | null> {
  const agora = Date.now();

  if (!cache || agora - carregadoEm > VALIDADE_MS) {
    // Uma carga por vez, mesmo com várias requisições simultâneas.
    carregando =
      carregando ??
      buscar()
        .then((m) => {
          cache = m;
          carregadoEm = Date.now();
          return m;
        })
        .catch(() => cache ?? new Map<string, Redirect>())
        .finally(() => {
          carregando = null;
        });
    await carregando;
  }

  return cache?.get(normalizar(caminho)) ?? null;
}
