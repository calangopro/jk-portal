import { createPublicKey, verify, type JsonWebKey } from "node:crypto";

/**
 * Quem está falando é o GitHub, deste repositório, por este workflow?
 *
 * O workflow do Roadmap (`.github/workflows/roadmap.yml`) pede ao próprio
 * GitHub um token OIDC a cada execução e manda junto. O token é assinado pela
 * chave do GitHub (publicada em JWKS) e diz o repositório, o ramo, quem
 * enviou, o evento e o arquivo do workflow. O painel confere a assinatura e
 * essas informações: não existe segredo guardado em lugar nenhum, então não há
 * segredo para vazar nem para trocar. Pedido de fora (um fork de estranho) não
 * recebe token do repositório e é recusado.
 *
 * Sem `server-only`, para o teste rodar a verificação com uma chave gerada na
 * hora (`scripts/teste-roadmap.mts`).
 */

export const EMISSOR_DO_GITHUB = "https://token.actions.githubusercontent.com";
export const CHAVES_DO_GITHUB = `${EMISSOR_DO_GITHUB}/.well-known/jwks`;
/** O público que o workflow pede no token: um token pedido para outra coisa não serve aqui. */
export const PUBLICO_DO_ROADMAP = "jk-roadmap";
export const REPOSITORIO = "calangopro/jk-portal";
export const WORKFLOW_DO_ROADMAP = `${REPOSITORIO}/.github/workflows/roadmap.yml@`;

export type ClaimsDoGitHub = {
  iss?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  iat?: number;
  repository?: string;
  repository_owner?: string;
  event_name?: string;
  ref?: string;
  head_ref?: string;
  actor?: string;
  sha?: string;
  workflow_ref?: string;
};

const deBase64Url = (s: string) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");

/**
 * Confere a assinatura (RS256, pela chave de mesmo `kid`) e devolve as
 * informações do token. `null` quando o token não é do GitHub ou foi mexido.
 */
export function verificarToken(token: string, chaves: readonly (JsonWebKey & { kid?: string })[]): ClaimsDoGitHub | null {
  const partes = token.split(".");
  if (partes.length !== 3 || partes.some((p) => !/^[A-Za-z0-9_-]+$/.test(p))) return null;
  let cabecalho: { alg?: string; kid?: string };
  let claims: ClaimsDoGitHub;
  try {
    cabecalho = JSON.parse(deBase64Url(partes[0]).toString("utf8"));
    claims = JSON.parse(deBase64Url(partes[1]).toString("utf8"));
  } catch {
    return null;
  }
  if (cabecalho.alg !== "RS256" || !cabecalho.kid) return null;
  const jwk = chaves.find((k) => k.kid === cabecalho.kid && (k.kty === "RSA" || k.kty === undefined));
  if (!jwk) return null;
  try {
    const chave = createPublicKey({ key: jwk, format: "jwk" });
    const ok = verify("RSA-SHA256", Buffer.from(`${partes[0]}.${partes[1]}`), chave, deBase64Url(partes[2]));
    return ok && claims && typeof claims === "object" ? claims : null;
  } catch {
    return null;
  }
}

/** O token é do GitHub, deste repositório, deste workflow, válido agora e pedido para o Roadmap? */
export function conferirClaims(c: ClaimsDoGitHub, agoraEmSegundos: number): { ok: true } | { ok: false; motivo: string } {
  const publico = Array.isArray(c.aud) ? c.aud : [c.aud];
  if (c.iss !== EMISSOR_DO_GITHUB) return { ok: false, motivo: "emissor" };
  if (!publico.includes(PUBLICO_DO_ROADMAP)) return { ok: false, motivo: "publico" };
  if (typeof c.exp !== "number" || c.exp < agoraEmSegundos - 30) return { ok: false, motivo: "vencido" };
  if (typeof c.nbf === "number" && c.nbf > agoraEmSegundos + 60) return { ok: false, motivo: "cedo" };
  if (c.repository !== REPOSITORIO || c.repository_owner !== REPOSITORIO.split("/")[0]) return { ok: false, motivo: "repositorio" };
  if (c.event_name !== "pull_request" && c.event_name !== "push") return { ok: false, motivo: "evento" };
  if (typeof c.workflow_ref !== "string" || !c.workflow_ref.startsWith(WORKFLOW_DO_ROADMAP)) return { ok: false, motivo: "workflow" };
  return { ok: true };
}
