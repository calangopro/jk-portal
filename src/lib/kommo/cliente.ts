import "server-only";
import { SUBDOMINIO_KOMMO, type Chave } from "@/lib/leads/chaves";

/**
 * Cliente da API v4 da Kommo. O espelho só LÊ, com uma exceção: cadastrar o
 * webhook (`webhook.ts`), por ação de administrador. Criar ou mover negócio,
 * contato ou tarefa dispara Salesbot para cliente de verdade, e por isso só
 * acontece por `escrever.ts` (cartão 49), o único arquivo que usa PATCH e o
 * único POST fora do webhook; o teste `verificar:kommo` confere.
 *
 * A Kommo aceita até 7 pedidos por segundo por conta, e passar disso por muito
 * tempo bloqueia a integração. O espaço mínimo entre dois pedidos é 160 ms
 * (pouco mais de 6 por segundo), contado neste processo; a resposta 429 espera e
 * tenta de novo, até três vezes.
 */

const ESPACO_MS = 160;
let proximoLivre = 0;

async function vez(): Promise<void> {
  const agora = Date.now();
  const espera = Math.max(0, proximoLivre - agora);
  proximoLivre = Math.max(agora, proximoLivre) + ESPACO_MS;
  if (espera > 0) await new Promise((r) => setTimeout(r, espera));
}

export class ErroDaKommo extends Error {
  constructor(
    public status: number,
    mensagem: string,
  ) {
    super(mensagem);
  }
}

export type MetodoKommo = "GET" | "POST" | "PATCH";

export type PedirKommo = <T>(caminho: string, opcoes?: { metodo?: MetodoKommo; corpo?: unknown; busca?: URLSearchParams }) => Promise<T | null>;

/** Uma função que pede à Kommo com a chave. Resposta 204 (lista vazia) volta como null. */
export function clienteDaKommo(chave: Chave): PedirKommo {
  const base = `https://${chave.meta.subdominio || SUBDOMINIO_KOMMO}.kommo.com`;
  return async function pedir<T>(caminho: string, opcoes: { metodo?: MetodoKommo; corpo?: unknown; busca?: URLSearchParams } = {}) {
    const url = `${base}${caminho}${opcoes.busca && [...opcoes.busca.keys()].length ? `?${opcoes.busca}` : ""}`;
    for (let tentativa = 0; ; tentativa++) {
      await vez();
      const r = await fetch(url, {
        method: opcoes.metodo ?? "GET",
        headers: {
          Authorization: `Bearer ${chave.valor}`,
          ...(opcoes.corpo !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        body: opcoes.corpo !== undefined ? JSON.stringify(opcoes.corpo) : undefined,
        signal: AbortSignal.timeout(15_000),
        cache: "no-store",
      });
      if (r.status === 429 && tentativa < 3) {
        await new Promise((ok) => setTimeout(ok, 1500 * (tentativa + 1)));
        continue;
      }
      if (r.status === 204) return null;
      if (!r.ok) {
        const texto = (await r.text().catch(() => "")).slice(0, 200);
        throw new ErroDaKommo(r.status, `Kommo respondeu ${r.status} em ${caminho}${texto ? `: ${texto}` : ""}`);
      }
      return (await r.json()) as T;
    }
  };
}
