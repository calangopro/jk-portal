import "server-only";
import { createHash, createHmac, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * As peças de criptografia do conector, todas do `node:crypto`, sem biblioteca.
 *
 * O login por conector (OAuth) não guarda o pedido, o código nem a renovação no
 * banco: eles viajam ASSINADOS (HMAC-SHA256). Quem está de fora não consegue
 * fabricar nem alterar, e o banco só guarda o que precisa sobreviver, que é a
 * chave de acesso (pelo hash). Desenho trazido do conector do Olhar de Fé.
 */

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

/** Texto aleatório sem letra ambígua (0/O, 1/l/I), para chave e identificador. */
export function aleatorio(tamanho: number): string {
  const bytes = randomBytes(tamanho);
  let s = "";
  for (let i = 0; i < tamanho; i++) s += ALFABETO[bytes[i] % ALFABETO.length];
  return s;
}

export const b64url = (b: Buffer | string) =>
  Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const deB64url = (s: string) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");

/**
 * O segredo das assinaturas. `CONECTOR_SEGREDO`, se existir na Vercel; senão,
 * derivado da service_role por HKDF com um rótulo próprio. A derivação existe
 * para o conector funcionar sem mais uma variável para lembrar de cadastrar: a
 * service_role já é segredo de servidor, e o rótulo garante que a assinatura
 * não serve para nada além disto. Trocar a service_role derruba as conexões
 * pelo login (a pessoa conecta de novo), o que é o comportamento certo.
 */
let chaveEmCache: { de: string; chave: Buffer } | null = null;
function segredo(): Buffer {
  const base = process.env.CONECTOR_SEGREDO || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (base.length < 32) throw new Error("Sem segredo para o conector (CONECTOR_SEGREDO ou SUPABASE_SERVICE_ROLE_KEY).");
  if (chaveEmCache?.de === base) return chaveEmCache.chave;
  const chave = Buffer.from(hkdfSync("sha256", base, "jk-portal", "conector-oauth-v1", 32));
  chaveEmCache = { de: base, chave };
  return chave;
}

export const agoraEmSegundos = () => Math.floor(Date.now() / 1000);

/**
 * Assina um objeto. O TIPO entra na assinatura: um código não passa por
 * renovação, nem um pedido por código, mesmo que alguém troque o rótulo.
 */
export function assinar(tipo: string, dados: Record<string, unknown>, vidaEmSegundos?: number): string {
  const corpo = b64url(
    JSON.stringify({ ...dados, t: tipo, ...(vidaEmSegundos ? { exp: agoraEmSegundos() + vidaEmSegundos } : {}) }),
  );
  const sig = createHmac("sha256", segredo()).update(`${tipo}.${corpo}`).digest();
  return `${corpo}.${b64url(sig)}`;
}

/** Abre o que `assinar` fez. Assinatura errada, tipo errado ou vencido: null. */
export function abrir<T = Record<string, unknown>>(tipo: string, s: unknown): (T & { t: string; exp?: number }) | null {
  if (typeof s !== "string" || s.length > 8000) return null;
  const i = s.indexOf(".");
  if (i < 1 || s.indexOf(".", i + 1) !== -1) return null;
  const corpo = s.slice(0, i);
  const esperada = createHmac("sha256", segredo()).update(`${tipo}.${corpo}`).digest();
  const recebida = deB64url(s.slice(i + 1));
  if (recebida.length !== esperada.length || !timingSafeEqual(recebida, esperada)) return null;
  try {
    const d = JSON.parse(deB64url(corpo).toString("utf8"));
    if (!d || d.t !== tipo) return null;
    if (d.exp !== undefined && !(d.exp > agoraEmSegundos())) return null;
    return d;
  } catch {
    return null;
  }
}

/** Resumo curto de um texto longo (client_id, endereço de volta) para caber assinado. */
export const resumo = (s: string) => sha256(String(s)).slice(0, 32);

/** O desafio PKCE S256 de um verificador. */
export const desafioPkce = (verificador: string) => b64url(createHash("sha256").update(verificador).digest());
