import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * A API da Appmax, só para LER o que foi descontado de cada venda.
 *
 * Autenticação do lojista: `POST /oauth2/token` com `client_credentials` devolve
 * um Bearer de uma hora, e é com ele que se lê o líquido do pedido
 * (`GET /v1/orders/total-liquid/{id}`). A especificação diz que essa rota usa o
 * cabeçalho `secret`, mas medido em 23/11/2026 o Bearer responde 200 com os
 * mesmos números da tela "Ver taxas", e o `secret` com o Client Secret responde
 * 401. Vale o que foi medido.
 *
 * Os endereços são fixos e só os da Appmax: nenhum valor de fora vira host.
 * A chave vive em `integration_tokens` (provedor `appmax`: o Client Secret em
 * `access_token`, o Client ID em `meta.client_id`) e nunca volta para a tela.
 */

export const PROVEDOR_APPMAX = "appmax";
const AUTH = "https://auth.appmax.com.br/oauth2/token";
const API = "https://api.appmax.com.br";
const PRAZO_MS = 15_000;

export type CredencialDaAppmax = {
  clientId: string;
  clientSecret: string;
};

export class ErroDaAppmax extends Error {
  constructor(
    mensagem: string,
    readonly status: number | null = null,
  ) {
    super(mensagem);
  }
}

export async function lerCredencial(db: SupabaseClient): Promise<CredencialDaAppmax | null> {
  const { data } = await db.from("integration_tokens").select("access_token, meta").eq("provider", PROVEDOR_APPMAX).maybeSingle();
  const meta = (data?.meta ?? {}) as { client_id?: string };
  if (!data?.access_token || !meta.client_id) return null;
  return { clientId: meta.client_id, clientSecret: data.access_token as string };
}

/** Pede um Bearer. Erro com a frase da Appmax (sem o segredo) quando ela recusa. */
export async function pedirToken(clientId: string, clientSecret: string): Promise<string> {
  let r: Response;
  try {
    r = await fetch(AUTH, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret }),
      signal: AbortSignal.timeout(PRAZO_MS),
    });
  } catch {
    throw new ErroDaAppmax("Não consegui falar com a Appmax agora.");
  }
  const j = (await r.json().catch(() => null)) as { access_token?: string; error_description?: string; error?: string } | null;
  if (!r.ok || !j?.access_token) {
    throw new ErroDaAppmax(
      r.status === 400 || r.status === 401
        ? "A Appmax recusou o Client ID e o Client Secret. Confira se são os de Produção."
        : `A Appmax respondeu ${r.status} ao pedir o acesso.`,
      r.status,
    );
  }
  return j.access_token;
}

async function pegar(caminho: string, cabecalhos: Record<string, string>): Promise<{ status: number; corpo: unknown }> {
  let r: Response;
  try {
    r = await fetch(`${API}${caminho}`, { headers: { Accept: "application/json", ...cabecalhos }, signal: AbortSignal.timeout(PRAZO_MS) });
  } catch {
    throw new ErroDaAppmax("Não consegui falar com a Appmax agora.");
  }
  return { status: r.status, corpo: await r.json().catch(() => null) };
}

export type RespostaDoLiquido = { status: number; corpo: unknown };

/** O detalhamento do líquido de um pedido. 404 quer dizer "o pedido não é desta conta". */
export async function pedirLiquido(token: string, appmaxId: number): Promise<RespostaDoLiquido> {
  return pegar(`/v1/orders/total-liquid/${appmaxId}`, { Authorization: `Bearer ${token}` });
}
