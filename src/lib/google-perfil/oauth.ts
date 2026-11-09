import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { absoluteUrl } from "@/lib/seo/site";
import { comBasePath } from "@/lib/seo/base-path";

/**
 * Login do portal no Google, para ler o Perfil da Empresa da JK.
 *
 * O Search Console usa conta de serviço (`lib/search-console/conta.ts`), mas o
 * Perfil da Empresa não: quem lê as avaliações precisa ser a conta que
 * administra as lojas (jkaliancasmkt). Então é OAuth de verdade, uma vez só:
 * alguém do admin clica em "Conectar com o Google", entra com essa conta e
 * permite; o Google devolve um refresh token, que fica guardado e renova o
 * acesso sozinho, de madrugada, sem ninguém logado.
 *
 * Onde mora cada coisa, em `integration_tokens` (tabela sem policy, só a
 * service_role lê):
 *   - `google_cliente`: o cliente OAuth do projeto jk-portal-509621.
 *     `access_token` = segredo do cliente, `meta.client_id` = id do cliente.
 *     Colado na tela de Integrações; o segredo nunca volta para a tela.
 *   - `google_perfil`: a autorização da conta. `refresh_token`, o
 *     `access_token` da hora com `expires_at`, e em `meta` o e-mail de quem
 *     autorizou e o resultado da última sincronização.
 *
 * Sem biblioteca do Google, como no Search Console: é um POST de formulário
 * para o endpoint de token, e o pacote `googleapis` pesaria dezenas de MB.
 */

export const PROVEDOR_CLIENTE = "google_cliente";
export const PROVEDOR_CONTA = "google_perfil";

/** O que o portal pede: gerenciar o Perfil da Empresa (é o escopo que lê avaliações) e saber quem autorizou. */
export const ESCOPOS = ["https://www.googleapis.com/auth/business.manage", "openid", "email"];

const ENDPOINT_TOKEN = "https://oauth2.googleapis.com/token";
const ENDPOINT_AUTORIZAR = "https://accounts.google.com/o/oauth2/v2/auth";

export type ClienteOAuth = { id: string; segredo: string };

export type UltimaSincronizacao = {
  em: string;
  ok: boolean;
  lojas?: number;
  avaliacoes?: number;
  erro?: string;
};

export type EstadoDoGoogle = {
  cliente: { configurado: boolean; id: string | null };
  conta: { conectada: boolean; email: string | null; conectadaEm: string | null };
  ultima: UltimaSincronizacao | null;
};

type LinhaDeToken = {
  provider: string;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
  meta: Record<string, unknown> | null;
};

async function lerLinha(supabase: SupabaseClient, provider: string): Promise<LinhaDeToken | null> {
  const { data } = await supabase
    .from("integration_tokens")
    .select("provider, access_token, refresh_token, expires_at, meta")
    .eq("provider", provider)
    .maybeSingle();
  return (data as LinhaDeToken | null) ?? null;
}

export async function lerCliente(supabase: SupabaseClient): Promise<ClienteOAuth | null> {
  const linha = await lerLinha(supabase, PROVEDOR_CLIENTE);
  const id = String(linha?.meta?.client_id ?? "");
  const segredo = linha?.access_token ?? "";
  return id && segredo ? { id, segredo } : null;
}

/** O que a tela de Integrações mostra. Nunca devolve segredo nem token. */
export async function lerEstadoDoGoogle(supabase: SupabaseClient): Promise<EstadoDoGoogle> {
  const [cliente, conta] = await Promise.all([
    lerLinha(supabase, PROVEDOR_CLIENTE),
    lerLinha(supabase, PROVEDOR_CONTA),
  ]);
  const meta = conta?.meta ?? {};
  return {
    cliente: {
      configurado: Boolean(cliente?.access_token && cliente?.meta?.client_id),
      id: cliente?.meta?.client_id ? String(cliente.meta.client_id) : null,
    },
    conta: {
      conectada: Boolean(conta?.refresh_token),
      email: meta.email ? String(meta.email) : null,
      conectadaEm: meta.conectada_em ? String(meta.conectada_em) : null,
    },
    ultima: (meta.ultima as UltimaSincronizacao | undefined) ?? null,
  };
}

/**
 * O endereço de volta, que precisa ser IDÊNTICO ao cadastrado no cliente
 * OAuth do Google Cloud. Em produção é sempre o domínio da loja (o pedido
 * chega à Vercel pela Cloudflare, e o host da requisição pode ser o
 * `*.vercel.app`); fora dela, a origem de quem pediu, para o teste local.
 */
export function enderecoDeRetorno(request: Request): string {
  if (process.env.VERCEL_ENV === "production") return absoluteUrl("/api/google/retorno");
  return new URL(comBasePath("/api/google/retorno"), new URL(request.url).origin).toString();
}

export function urlDeAutorizacao(cliente: ClienteOAuth, retorno: string, estado: string): string {
  const u = new URL(ENDPOINT_AUTORIZAR);
  u.searchParams.set("client_id", cliente.id);
  u.searchParams.set("redirect_uri", retorno);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", ESCOPOS.join(" "));
  // offline + consent: o Google só manda o refresh token assim, inclusive
  // quando a conta já tinha autorizado antes.
  u.searchParams.set("access_type", "offline");
  u.searchParams.set("prompt", "consent");
  u.searchParams.set("include_granted_scopes", "true");
  u.searchParams.set("state", estado);
  return u.toString();
}

type RespostaDeToken = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
};

async function pedirToken(campos: Record<string, string>): Promise<RespostaDeToken> {
  const r = await fetch(ENDPOINT_TOKEN, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(campos).toString(),
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  return (await r.json().catch(() => ({ error: `http_${r.status}` }))) as RespostaDeToken;
}

/** E-mail de quem autorizou, lido do id_token (veio do próprio Google, pelo canal do servidor). */
function emailDoIdToken(idToken?: string): string | null {
  if (!idToken) return null;
  try {
    const corpo = JSON.parse(Buffer.from(idToken.split(".")[1] ?? "", "base64url").toString("utf8"));
    return typeof corpo.email === "string" ? corpo.email : null;
  } catch {
    return null;
  }
}

/** Troca o código do retorno pelo refresh token e guarda. Devolve o problema, ou null. */
export async function concluirConexao(
  supabase: SupabaseClient,
  codigo: string,
  retorno: string,
): Promise<string | null> {
  const cliente = await lerCliente(supabase);
  if (!cliente) return "Falta o cliente OAuth do Google na tela de Integrações.";

  const t = await pedirToken({
    code: codigo,
    client_id: cliente.id,
    client_secret: cliente.segredo,
    redirect_uri: retorno,
    grant_type: "authorization_code",
  });
  if (!t.refresh_token || !t.access_token) {
    return `O Google não entregou a autorização (${t.error_description || t.error || "sem refresh token"}).`;
  }

  const atual = await lerLinha(supabase, PROVEDOR_CONTA);
  const { error } = await supabase.from("integration_tokens").upsert(
    {
      provider: PROVEDOR_CONTA,
      access_token: t.access_token,
      refresh_token: t.refresh_token,
      expires_at: new Date(Date.now() + (t.expires_in ?? 3600) * 1000).toISOString(),
      meta: {
        ...(atual?.meta ?? {}),
        email: emailDoIdToken(t.id_token),
        conectada_em: new Date().toISOString(),
      },
    },
    { onConflict: "provider" },
  );
  return error ? error.message : null;
}

export class SemAutorizacao extends Error {}

/**
 * Token de acesso válido para chamar as APIs do Perfil da Empresa. Usa o que
 * está guardado enquanto vale (com um minuto de folga) e renova pelo refresh
 * token quando venceu.
 */
export async function tokenDeAcesso(supabase: SupabaseClient): Promise<string> {
  const conta = await lerLinha(supabase, PROVEDOR_CONTA);
  if (!conta?.refresh_token) {
    throw new SemAutorizacao("O portal ainda não foi conectado ao Google. Use o botão Conectar com o Google em Integrações.");
  }
  if (conta.access_token && conta.expires_at && new Date(conta.expires_at).getTime() > Date.now() + 60_000) {
    return conta.access_token;
  }

  const cliente = await lerCliente(supabase);
  if (!cliente) throw new SemAutorizacao("Falta o cliente OAuth do Google na tela de Integrações.");

  const t = await pedirToken({
    client_id: cliente.id,
    client_secret: cliente.segredo,
    refresh_token: conta.refresh_token,
    grant_type: "refresh_token",
  });
  if (!t.access_token) {
    if (t.error === "invalid_grant") {
      throw new SemAutorizacao(
        "A autorização do Google venceu ou foi retirada. Conecte de novo com a conta jkaliancasmkt em Integrações.",
      );
    }
    throw new Error(`O Google recusou renovar o acesso (${t.error_description || t.error || "sem resposta"}).`);
  }

  await supabase
    .from("integration_tokens")
    .update({
      access_token: t.access_token,
      expires_at: new Date(Date.now() + (t.expires_in ?? 3600) * 1000).toISOString(),
    })
    .eq("provider", PROVEDOR_CONTA);

  return t.access_token;
}
