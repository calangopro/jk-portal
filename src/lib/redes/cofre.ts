import "server-only";
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

/**
 * O cofre das credenciais das redes sociais: AES-256-GCM, do `node:crypto`.
 *
 * No banco fica só `v1.<iv>.<cifrado+selo>`. Quem lê a tabela (um backup, um
 * `select` por engano, alguém com a chave de leitura) não vê token nenhum:
 * para abrir é preciso a chave, que só existe no servidor.
 *
 * A chave sai de `REDES_SEGREDO`, se existir na Vercel; senão, é derivada da
 * service_role por HKDF com um rótulo próprio. É o mesmo desenho do conector
 * (`lib/conector/cripto.ts`): funciona sem mais uma variável para cadastrar, e
 * o rótulo garante que esta chave não serve para mais nada. Trocar a
 * service_role invalida as credenciais guardadas, e as contas pedem para ser
 * ligadas de novo, que é o comportamento certo.
 *
 * O formato tem versão para a chave poder mudar um dia sem adivinhação.
 */

let chaveEmCache: { de: string; chave: Buffer } | null = null;

function chave(): Buffer {
  const base = process.env.REDES_SEGREDO || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (base.length < 32) throw new Error("Sem segredo para o cofre das redes (REDES_SEGREDO ou SUPABASE_SERVICE_ROLE_KEY).");
  if (chaveEmCache?.de === base) return chaveEmCache.chave;
  const derivada = Buffer.from(hkdfSync("sha256", base, "jk-portal", "redes-credenciais-v1", 32));
  chaveEmCache = { de: base, chave: derivada };
  return derivada;
}

const b64 = (b: Buffer) => b.toString("base64url");

/** Cifra um objeto (as credenciais de uma conta, o segredo de um aplicativo). */
export function cifrar(dados: unknown): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", chave(), iv);
  const corpo = Buffer.concat([c.update(JSON.stringify(dados), "utf8"), c.final(), c.getAuthTag()]);
  return `v1.${b64(iv)}.${b64(corpo)}`;
}

/** Abre o que `cifrar` fez. Texto adulterado, chave trocada ou formato desconhecido: erro. */
export function decifrar<T = Record<string, unknown>>(texto: string | null | undefined): T {
  const [versao, iv, corpo] = String(texto ?? "").split(".");
  if (versao !== "v1" || !iv || !corpo) throw new Error("Credencial guardada num formato desconhecido.");
  const bruto = Buffer.from(corpo, "base64url");
  if (bruto.length < 17) throw new Error("Credencial guardada incompleta.");
  const d = createDecipheriv("aes-256-gcm", chave(), Buffer.from(iv, "base64url"));
  d.setAuthTag(bruto.subarray(bruto.length - 16));
  const claro = Buffer.concat([d.update(bruto.subarray(0, bruto.length - 16)), d.final()]);
  return JSON.parse(claro.toString("utf8")) as T;
}

/** Está cifrado por este cofre? Serve para não cifrar duas vezes nem abrir texto puro. */
export const estaCifrado = (texto: string | null | undefined): boolean => /^v1\.[\w-]+\.[\w-]+$/.test(String(texto ?? ""));
