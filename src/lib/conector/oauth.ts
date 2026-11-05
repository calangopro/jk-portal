import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { abrir, agoraEmSegundos, aleatorio, assinar, desafioPkce, resumo, sha256 } from "./cripto";
import { enderecos } from "./base";
import { novaChave } from "./chaves";
import type { Escopo } from "./tipos";

/**
 * Login por conector (OAuth 2.1): liga o painel da JK no app do Claude (web,
 * computador e celular), cada pessoa com o próprio login do painel. A chave
 * "jk_..." colada à mão (Claude Code) continua valendo.
 *
 * Veio do conector do Olhar de Fé (worker/nucleo/oauth.js do Olhar
 * Rondoniense). Mudou: roda em rota do Next, guarda no Supabase, vive dentro
 * do /guias e tem dois escopos (completo e só leitura) no lugar de cargos.
 *
 * O caminho (cliente público, PKCE S256 obrigatório):
 * 1. O app chama /api/mcp sem chave e recebe 401 com o endereço da ficha do
 *    recurso. Sem esse 401 bem formado, o app do Claude não acha o login.
 * 2. O app acha o servidor de login. Como o emissor tem caminho (/guias), a
 *    ordem da especificação é: /.well-known/oauth-authorization-server/guias e
 *    /.well-known/openid-configuration/guias (os dois na RAIZ do domínio, que é
 *    da Tray e responde 404, então o app segue) e por fim
 *    /guias/.well-known/openid-configuration, que é nosso. Conferido em
 *    05/11/2026 com curl: a Tray responde 404 nos dois primeiros.
 * 3. O app se apresenta pelo endereço da própria ficha (CIMD, que é o que o
 *    claude.ai faz) ou se registra em /api/oauth/register (DCR).
 * 4. /api/oauth/authorize confere o pedido e manda a pessoa para
 *    /admin/conectar, que pede login e mostra quem está pedindo.
 * 5. Com o "Permitir", a pessoa volta ao app com um código de uso único (2 min).
 * 6. O app troca o código em /api/oauth/token por uma chave de 1 hora e uma
 *    renovação de 90 dias, que gira a cada uso.
 *
 * O que não precisa ficar guardado (pedido, código, registro e renovação) vai
 * assinado (`cripto.ts`). No banco fica só a conexão, em `conector_chaves`.
 */

const ESCOPO_OAUTH = "jk-portal";
const VIDA_ACESSO = 3600;
const VIDA_RENOVAR = 90 * 86400;
const VIDA_CODIGO = 120;
const VIDA_PEDIDO = 15 * 60;
const VIDA_MAXIMA = 365 * 86400;
const VIDA_REGISTRO = 365 * 86400;
const FOLGA_GIRO = 60;

const NOMES: Record<string, string> = { "claude.ai": "Claude", "claude.com": "Claude", "chatgpt.com": "ChatGPT" };

/**
 * Fichas publicadas dos apps mais usados, para quando o site do app recusa a
 * leitura automática. Só os endereços de volta importam, e são do próprio app.
 */
const FICHAS_CONHECIDAS: Record<string, string[]> = {
  "https://claude.ai/oauth/mcp-oauth-client-metadata": ["https://claude.ai/api/mcp/auth_callback"],
  "https://claude.ai/oauth/claude-code-client-metadata": ["http://localhost/callback", "http://127.0.0.1/callback"],
  "https://chatgpt.com/oauth/client.json": ["https://chatgpt.com/connector_platform_oauth_redirect"],
};

export const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "authorization, content-type, mcp-protocol-version",
  "access-control-expose-headers": "www-authenticate",
  "access-control-max-age": "86400",
};

const json = (dados: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(dados), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...CORS, ...extra },
  });

const daqui = (s: number) => new Date(Date.now() + s * 1000).toISOString();

// ---------------------------------------------------------------- endereços de volta (redirect_uri)

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);
const ESQUEMAS_DE_APP = new Set(["cursor:", "vscode:", "vscode-insiders:", "windsurf:", "zed:", "claude:", "raycast:"]);

function lerUrl(s: string): URL | null {
  try {
    return new URL(s);
  } catch {
    return null;
  }
}
function ehLoopback(r: string) {
  const u = lerUrl(r);
  return !!u && u.protocol === "http:" && LOOPBACK.has(u.hostname);
}
/** https em qualquer lugar, http só no próprio computador e o endereço de um aplicativo instalado. */
function redirecaoValida(r: unknown): r is string {
  if (typeof r !== "string" || r.length > 500) return false;
  const u = lerUrl(r);
  if (!u || u.hash || u.username || u.password) return false;
  if (u.protocol === "https:") return !!u.hostname;
  if (u.protocol === "http:") return LOOPBACK.has(u.hostname);
  return ESQUEMAS_DE_APP.has(u.protocol) || /^[a-z][a-z0-9+-]*(\.[a-z0-9+-]+)+:$/.test(u.protocol);
}
/** Igual, letra por letra. No próprio computador a porta muda a cada vez (RFC 8252, 7.3). */
function mesmaRedirecao(pedida: string, registrada: string) {
  if (pedida === registrada) return true;
  if (!ehLoopback(pedida) || !ehLoopback(registrada)) return false;
  const a = new URL(pedida);
  const b = new URL(registrada);
  return a.hostname === b.hostname && a.pathname === b.pathname && a.search === b.search;
}
export function ondeVolta(r: string) {
  const u = lerUrl(r);
  if (!u) return "?";
  if (u.protocol === "https:") return u.hostname;
  if (u.protocol === "http:") return "este computador";
  return `${u.protocol}//${u.host}`.slice(0, 80);
}

/** O recurso que o app pede (RFC 8707): só o nosso MCP. */
function recursoAceito(req: Request, r: string) {
  const e = enderecos(req);
  const sem = r.replace(/\/+$/, "");
  return [e.mcp, e.ferramentas, e.base].includes(sem);
}

// ---------------------------------------------------------------- quem é o app (client_id)

type Cliente = { nome: string | null; host: string | null; conferido: boolean; conhecido: boolean; redirecoes: string[] };

async function lerAte(r: Response, limite: number): Promise<string | null> {
  if (Number(r.headers.get("content-length") || 0) > limite) return null;
  const leitor = r.body?.getReader();
  if (!leitor) return null;
  const partes: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    total += value.byteLength;
    if (total > limite) {
      leitor.cancel().catch(() => {});
      return null;
    }
    partes.push(value);
  }
  return Buffer.concat(partes).toString("utf8");
}

/** Lê a ficha no site do app (no máximo 10 KB, 5 s, sem seguir redirecionamento). */
async function lerFicha(clientId: string): Promise<string[] | null> {
  let r: Response;
  try {
    r = await fetch(clientId, {
      headers: { accept: "application/json", "user-agent": "JKAliancas-Conector/1.0 (+https://www.jkaliancas.com.br/guias)" },
      redirect: "manual",
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
  } catch {
    return null;
  }
  if (r.status !== 200) return null;
  const texto = await lerAte(r, 10_000);
  if (!texto) return null;
  try {
    const d = JSON.parse(texto);
    return d && d.client_id === clientId && Array.isArray(d.redirect_uris) ? d.redirect_uris : null;
  } catch {
    return null;
  }
}

/**
 * Ficha publicada (CIMD): o client_id é o endereço da ficha, e o nome que a
 * pessoa vê é o domínio desse endereço (o que a ficha diz de si mesma não é
 * conferido). Volta só para o mesmo domínio ou para o próprio computador.
 */
async function fichaPublicada(req: Request, clientId: string): Promise<Cliente | null> {
  const u = lerUrl(clientId);
  if (!u || u.protocol !== "https:" || u.pathname === "/" || u.username || u.password || u.hash || u.port) return null;
  const h = u.hostname;
  const nosso = new URL(enderecos(req).base).hostname;
  if (!h.includes(".") || /^\[|^[\d.]+$/.test(h) || h === nosso || h.endsWith("jkaliancas.com.br")) return null;
  const lidas = (await lerFicha(clientId)) || FICHAS_CONHECIDAS[clientId];
  if (!lidas) return null;
  const redirecoes = lidas
    .filter((x) => redirecaoValida(x) && (ehLoopback(x) || (lerUrl(x)!.protocol === "https:" && lerUrl(x)!.hostname === h)))
    .slice(0, 10);
  if (!redirecoes.length) return null;
  return { nome: NOMES[h] || h, host: h, conferido: true, conhecido: !!NOMES[h], redirecoes };
}

async function cliente(req: Request, clientId: string | null): Promise<Cliente | null> {
  if (typeof clientId !== "string" || !clientId || clientId.length > 4000) return null;
  if (clientId.startsWith("https://")) return fichaPublicada(req, clientId);
  if (clientId.startsWith("jkc_")) {
    const d = abrir<{ r: string[]; n?: string }>("cliente", clientId.slice(4));
    if (!d || !Array.isArray(d.r)) return null;
    return { nome: d.n || null, host: null, conferido: false, conhecido: false, redirecoes: d.r };
  }
  return null;
}

// ---------------------------------------------------------------- fichas (descoberta)

export function fichaDoRecurso(req: Request) {
  const e = enderecos(req);
  return {
    resource: e.mcp,
    authorization_servers: [e.base],
    scopes_supported: [ESCOPO_OAUTH],
    bearer_methods_supported: ["header"],
    resource_name: "JK Alianças (painel)",
    resource_documentation: `${e.painel}/conector`,
  };
}

/**
 * A ficha do servidor de login. Serve nos dois endereços: no do OAuth e no do
 * OpenID. Pelo do OpenID, o leitor da especificação exige `jwks_uri`,
 * `subject_types_supported` e `id_token_signing_alg_values_supported`. Nunca
 * emitimos id_token (não há escopo `openid`), então o jwks é uma lista vazia e
 * os outros dois campos são o padrão do formato.
 */
export function fichaDoServidor(req: Request) {
  const b = enderecos(req).base;
  return {
    issuer: b,
    authorization_endpoint: `${b}/api/oauth/authorize`,
    token_endpoint: `${b}/api/oauth/token`,
    registration_endpoint: `${b}/api/oauth/register`,
    revocation_endpoint: `${b}/api/oauth/revoke`,
    jwks_uri: `${b}/api/oauth/jwks`,
    response_types_supported: ["code"],
    response_modes_supported: ["query"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["none"],
    revocation_endpoint_auth_methods_supported: ["none"],
    code_challenge_methods_supported: ["S256"],
    scopes_supported: [ESCOPO_OAUTH, "offline_access"],
    subject_types_supported: ["public"],
    id_token_signing_alg_values_supported: ["RS256"],
    client_id_metadata_document_supported: true,
    authorization_response_iss_parameter_supported: true,
  };
}

export const respostaFicha = (dados: unknown) => json(dados, 200, { "cache-control": "public, max-age=300" });

/** O cabeçalho do 401 do /api/mcp: diz ao app onde está a ficha. */
export function desafio(req: Request, invalido: boolean): string {
  const e = enderecos(req);
  return `Bearer ${invalido ? 'error="invalid_token", ' : ""}resource_metadata="${e.base}/.well-known/oauth-protected-resource", scope="${ESCOPO_OAUTH}"`;
}

// ---------------------------------------------------------------- respostas

function voltar(destino: string, params: Record<string, string | undefined | null>) {
  const u = new URL(destino);
  for (const [k, v] of Object.entries(params)) if (v) u.searchParams.set(k, v);
  return u.toString();
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function paginaErro(texto: string, status = 400) {
  return new Response(
    `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Não deu para conectar | JK Alianças</title>` +
      `<body style="font:17px/1.5 -apple-system,system-ui,sans-serif;background:#F7F3EC;color:#1A1815;display:grid;place-items:center;min-height:100vh;margin:0;padding:24px;text-align:center">` +
      `<div style="max-width:420px"><h1 style="font-family:Georgia,serif;font-weight:600">Não deu para conectar</h1><p>${esc(texto)}</p></div>`,
    {
      status,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "x-robots-tag": "noindex",
        "x-frame-options": "DENY",
        "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'",
      },
    },
  );
}

const erroToken = (error: string, descricao: string, status = 400) =>
  json({ error, error_description: descricao }, status, { pragma: "no-cache" });

async function lerCorpo(req: Request): Promise<Record<string, string>> {
  const tipo = req.headers.get("content-type") || "";
  const texto = await req.text();
  if (texto.length > 20_000) return {};
  let d: Record<string, string> = {};
  if (tipo.includes("application/json")) {
    try {
      const j = JSON.parse(texto);
      if (j && typeof j === "object") d = Object.fromEntries(Object.entries(j).map(([k, v]) => [k, String(v)]));
    } catch {
      return {};
    }
  } else {
    d = Object.fromEntries(new URLSearchParams(texto));
  }
  // Quem manda o client_id no cabeçalho (client_secret_basic): aceito só o id.
  const h = req.headers.get("authorization") || "";
  if (!d.client_id && h.startsWith("Basic ")) {
    try {
      d.client_id = decodeURIComponent(Buffer.from(h.slice(6).trim(), "base64").toString("utf8").split(":")[0]);
    } catch {
      /* sem client_id */
    }
  }
  return d;
}

// ---------------------------------------------------------------- registro (DCR), sem guardar nada

export async function registrar(req: Request): Promise<Response> {
  let d: { redirect_uris?: unknown; client_name?: unknown };
  try {
    const texto = await req.text();
    if (texto.length > 10_000) throw new Error();
    d = JSON.parse(texto);
  } catch {
    return erroToken("invalid_client_metadata", "Envie o registro em JSON.");
  }
  const r = Array.isArray(d.redirect_uris) ? d.redirect_uris : [];
  if (!r.length || r.length > 5 || !r.every(redirecaoValida)) {
    return erroToken(
      "invalid_redirect_uri",
      "Endereços de volta aceitos: https, http só em localhost/127.0.0.1, ou o de um aplicativo instalado.",
    );
  }
  // Sem caractere de controle nem invisível: o nome aparece na tela de Permitir.
  const nome =
    typeof d.client_name === "string" ? d.client_name.replace(/[\p{Cc}\p{Cf}]/gu, "").trim().slice(0, 60) : "";
  const emitido = agoraEmSegundos();
  const id = `jkc_${assinar("cliente", { r, n: nome || undefined, i: emitido }, VIDA_REGISTRO)}`;
  return json(
    {
      client_id: id,
      client_id_issued_at: emitido,
      client_id_expires_at: emitido + VIDA_REGISTRO,
      ...(nome ? { client_name: nome } : {}),
      redirect_uris: r,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      scope: ESCOPO_OAUTH,
    },
    201,
  );
}

// ---------------------------------------------------------------- /authorize

export async function autorizar(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const p = url.searchParams;
  const e = enderecos(req);
  const c = await cliente(req, p.get("client_id"));
  if (!c) return paginaErro("Não reconheci o app que pediu a conexão. Volte a ele e tente conectar de novo.");
  let r = p.get("redirect_uri");
  if (!r && c.redirecoes.length === 1 && !ehLoopback(c.redirecoes[0])) r = c.redirecoes[0];
  // Endereço de volta que não confere: o erro fica aqui, nunca mandamos a pessoa para ele.
  if (!r || !redirecaoValida(r) || !c.redirecoes.some((x) => mesmaRedirecao(r!, x))) {
    return paginaErro("O endereço de volta não confere com o que o app registrou. Volte ao app e tente de novo.");
  }
  const estado = p.get("state") || undefined;
  const destino = r;
  // Erro de app que se registrou sozinho fica na nossa tela: senão o painel vira trampolim para qualquer site.
  const erro = (error: string, descricao: string) =>
    !c.conferido
      ? paginaErro(`O app mandou um pedido inválido (${descricao.replace(/\.$/, "")}).`)
      : new Response(null, {
          status: 302,
          headers: {
            location: voltar(destino, { error, error_description: descricao, state: estado, iss: e.base }),
            "cache-control": "no-store",
          },
        });
  if (p.get("response_type") !== "code") return erro("unsupported_response_type", "Só response_type=code.");
  const cc = p.get("code_challenge") || "";
  if (p.get("code_challenge_method") !== "S256" || !/^[A-Za-z0-9_-]{43}$/.test(cc)) {
    return erro("invalid_request", "PKCE com S256 é obrigatório.");
  }
  const recurso = p.get("resource");
  if (recurso && !recursoAceito(req, recurso)) return erro("invalid_target", "Este servidor só dá acesso ao MCP da JK.");
  if (estado && estado.length > 1000) return erro("invalid_request", "state grande demais.");
  const app = c.conferido ? `${c.nome} (${c.host})` : `${c.nome || "App sem nome"} (${ondeVolta(destino)})`;
  const pedido = assinar(
    "pedido",
    {
      ch: resumo(p.get("client_id")!),
      r: destino,
      cc,
      s: estado,
      app,
      nome: c.nome,
      host: c.host,
      cf: c.conferido ? 1 : 0,
      cn: c.conhecido ? 1 : 0,
    },
    VIDA_PEDIDO,
  );
  return new Response(null, {
    status: 302,
    headers: { location: `${e.base}/admin/conectar?pedido=${encodeURIComponent(pedido)}`, "cache-control": "no-store" },
  });
}

// ---------------------------------------------------------------- /token

export async function token(req: Request): Promise<Response> {
  const d = await lerCorpo(req);
  if (d.resource && !recursoAceito(req, d.resource)) return erroToken("invalid_target", "Este servidor só dá acesso ao MCP da JK.");
  if (d.grant_type === "authorization_code") return trocarCodigo(d);
  if (d.grant_type === "refresh_token") return renovar(d);
  return erroToken("unsupported_grant_type", "Use authorization_code ou refresh_token.");
}

type Codigo = { u: string; e: Escopo; ch: string; rh: string; cc: string; app: string; j: string };

async function perfilAtivo(id: string) {
  const db = createAdminClient();
  const { data } = await db.from("profiles").select("id, is_active").eq("id", id).maybeSingle();
  return data?.is_active ? data : null;
}

async function trocarCodigo(d: Record<string, string>): Promise<Response> {
  const c = abrir<Codigo>("codigo", d.code);
  if (!c) return erroToken("invalid_grant", "Código inválido ou vencido. Conecte de novo.");
  if (!d.client_id || resumo(d.client_id) !== c.ch) return erroToken("invalid_grant", "Este código foi emitido para outro app.");
  if (d.redirect_uri && resumo(d.redirect_uri) !== c.rh) return erroToken("invalid_grant", "O endereço de volta não confere.");
  const v = String(d.code_verifier || "");
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(v) || desafioPkce(v) !== c.cc) {
    return erroToken("invalid_grant", "A prova PKCE não confere.");
  }
  if (!(await perfilAtivo(c.u))) return erroToken("invalid_grant", "Esta pessoa não está mais ativa no painel.");

  const db = createAdminClient();
  const acesso = novaChave();
  const { data: linha, error } = await db
    .from("conector_chaves")
    .insert({
      nome: `Conector: ${c.app}`.slice(0, 80),
      prefixo: acesso.slice(0, 9),
      hash: sha256(acesso),
      profile_id: c.u,
      escopo: c.e === "leitura" ? "leitura" : "completo",
      cliente: c.app.slice(0, 80),
      oauth_codigo: c.j,
      expira_em: daqui(VIDA_ACESSO),
    })
    .select("id, hash")
    .single();

  if (error || !linha) {
    // oauth_codigo é único: o mesmo código usado de novo derruba a conexão feita com ele (OAuth 2.1, 4.1.2).
    if (error?.code === "23505") {
      await db
        .from("conector_chaves")
        .update({ revogada_em: new Date().toISOString() })
        .eq("oauth_codigo", c.j)
        .is("revogada_em", null);
      return erroToken("invalid_grant", "Este código já foi usado.");
    }
    return erroToken("server_error", "Não deu para criar a conexão.", 500);
  }
  return respostaToken(linha.id, linha.hash, acesso, c.ch);
}

type Renovacao = { k: string; h: string; ch: string };

/** A renovação aponta para a linha e para o começo do hash da chave atual: girou a chave, a renovação velha não vale. */
async function renovar(d: Record<string, string>): Promise<Response> {
  const r = abrir<Renovacao>("renovar", d.refresh_token);
  if (!r) return erroToken("invalid_grant", "Renovação inválida ou vencida. Conecte de novo.");
  if (!d.client_id || resumo(d.client_id) !== r.ch) return erroToken("invalid_grant", "Esta renovação é de outro app.");
  const db = createAdminClient();
  const { data: linha } = await db
    .from("conector_chaves")
    .select("id, hash, profile_id, revogada_em, criado_em, expira_em")
    .eq("id", r.k)
    .maybeSingle();
  if (!linha || linha.revogada_em) return erroToken("invalid_grant", "Esta conexão foi desligada. Conecte de novo.");
  if (!linha.hash.startsWith(r.h)) {
    // Renovação velha usada de novo: ou o app reenviou agora há pouco, ou alguém copiou. Fora da folga, a conexão cai.
    const giradaHa = agoraEmSegundos() - (new Date(linha.expira_em).getTime() / 1000 - VIDA_ACESSO);
    if (giradaHa > FOLGA_GIRO) {
      await db.from("conector_chaves").update({ revogada_em: new Date().toISOString() }).eq("id", linha.id).is("revogada_em", null);
    }
    return erroToken("invalid_grant", "Esta renovação já foi usada. Conecte de novo.");
  }
  if (Date.now() - new Date(linha.criado_em).getTime() > VIDA_MAXIMA * 1000) {
    return erroToken("invalid_grant", "A conexão fez um ano. Conecte de novo.");
  }
  if (!(await perfilAtivo(linha.profile_id))) return erroToken("invalid_grant", "Esta pessoa não está mais ativa no painel.");
  const acesso = novaChave();
  const { data: nova } = await db
    .from("conector_chaves")
    .update({ hash: sha256(acesso), prefixo: acesso.slice(0, 9), expira_em: daqui(VIDA_ACESSO) })
    .eq("id", linha.id)
    .eq("hash", linha.hash)
    .is("revogada_em", null)
    .select("id, hash")
    .maybeSingle();
  if (!nova) return erroToken("invalid_grant", "A renovação já foi usada. Conecte de novo.");
  return respostaToken(nova.id, nova.hash, acesso, r.ch);
}

function respostaToken(id: string, hash: string, acesso: string, ch: string) {
  const renovacao = assinar("renovar", { k: id, h: hash.slice(0, 24), ch }, VIDA_RENOVAR);
  return json(
    { access_token: acesso, token_type: "Bearer", expires_in: VIDA_ACESSO, refresh_token: renovacao, scope: ESCOPO_OAUTH },
    200,
    { pragma: "no-cache" },
  );
}

// ---------------------------------------------------------------- /revoke (RFC 7009): responde 200 sempre

export async function revogar(req: Request): Promise<Response> {
  const d = await lerCorpo(req);
  const t = String(d.token || "");
  const agora = new Date().toISOString();
  const db = createAdminClient();
  if (t.startsWith("jk_")) {
    await db.from("conector_chaves").update({ revogada_em: agora }).eq("hash", sha256(t)).not("oauth_codigo", "is", null).is("revogada_em", null);
  } else {
    const r = abrir<Renovacao>("renovar", t);
    if (r) {
      await db.from("conector_chaves").update({ revogada_em: agora }).eq("id", r.k).like("hash", `${r.h}%`).is("revogada_em", null);
    }
  }
  return new Response(null, { status: 200, headers: { ...CORS, "cache-control": "no-store" } });
}

// ---------------------------------------------------------------- a tela "Permitir" (/admin/conectar)

export type Pedido = {
  ch: string;
  r: string;
  cc: string;
  s?: string;
  app: string;
  nome: string | null;
  host: string | null;
  cf: 0 | 1;
  cn: 0 | 1;
};

export const lerPedido = (pedido: string) => abrir<Pedido>("pedido", pedido);

/** O título da tela: app que se registrou sozinho pode se dar qualquer nome, então vale o endereço de volta. */
export function quemPede(p: Pedido) {
  const web = lerUrl(p.r)?.protocol === "https:";
  return {
    app: p.cf ? p.nome || p.app : web ? ondeVolta(p.r) : "um app deste computador",
    declarado: p.cf ? null : p.nome || null,
    conferido: !!p.cf,
    conhecido: !!p.cn,
    volta: ondeVolta(p.r),
  };
}

/** Devolve o endereço para onde mandar a pessoa (o app, com o código ou com a recusa). */
export function decidir(p: Pedido, base: string, perfilId: string, decisao: { permitir: boolean; escopo: Escopo }): string {
  if (!decisao.permitir) {
    return voltar(p.r, { error: "access_denied", error_description: "A conexão foi recusada.", state: p.s, iss: base });
  }
  // App que se registrou sozinho (nome não conferido) entra só para ler.
  const escopo: Escopo = p.cf ? decisao.escopo : "leitura";
  const codigo = assinar(
    "codigo",
    { u: perfilId, e: escopo, ch: p.ch, rh: resumo(p.r), cc: p.cc, app: p.app, j: aleatorio(20) },
    VIDA_CODIGO,
  );
  return voltar(p.r, { code: codigo, state: p.s, iss: base });
}
