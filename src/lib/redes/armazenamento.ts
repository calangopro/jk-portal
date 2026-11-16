import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cifrar, decifrar } from "./cofre";
import { enderecoAssinado } from "./s3";

/**
 * Onde moram as mídias dos posts das redes, atrás de uma porta só.
 *
 * Dois lugares possíveis, e o resto do código não precisa saber qual:
 *
 *   - **Storage do Supabase**, balde `redes` (0084). Funciona sem configurar
 *     nada, e aceita até 50 MB por arquivo, que é o teto do projeto.
 *   - **R2 da Cloudflare**, quando as chaves dele estão coladas em Integrações
 *     (`integration_tokens`, provedor `redes_r2`). Sem teto prático de tamanho,
 *     sem cobrança de saída, e com endereço público no domínio da JK.
 *
 * Nos dois, o arquivo NUNCA passa pela função da Vercel na subida (ela aceita
 * 4,5 MB de corpo): o servidor só cria um endereço assinado, e o navegador
 * sobe direto. As redes que publicam por endereço (Instagram, Facebook) vêm
 * buscar no endereço público; o YouTube recebe os bytes em blocos, lidos do
 * mesmo endereço.
 *
 * O endereço público não é segredo, mas ninguém adivinha: o caminho leva um
 * identificador aleatório, e nenhum dos dois lugares lista os arquivos.
 */

export const BALDE = "redes";
export const PROVEDOR_R2 = "redes_r2";
const MB = 1024 * 1024;
/** O teto do Storage do Supabase neste projeto (medido em 16/11/2026). */
export const LIMITE_DO_SUPABASE = 50 * MB;
/** No R2 o teto é nosso: acima disso o envio pelo navegador num pedido só deixa de ser confiável. */
export const LIMITE_DO_R2 = 1024 * MB;

export const TIPOS_ACEITOS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
};

type ConfigDoR2 = { conta: string; balde: string; publico: string; chaveDeAcesso: string; chaveSecreta: string };

/** A configuração do R2, se existir e abrir. Erro ao abrir conta como "não configurado", e o Supabase assume. */
async function lerR2(db: SupabaseClient): Promise<ConfigDoR2 | null> {
  const { data } = await db.from("integration_tokens").select("access_token, meta").eq("provider", PROVEDOR_R2).maybeSingle();
  const meta = (data?.meta ?? {}) as Record<string, unknown>;
  const conta = String(meta.conta ?? "");
  const balde = String(meta.balde ?? "");
  const publico = String(meta.publico ?? "").replace(/\/+$/, "");
  if (!data?.access_token || !conta || !balde || !publico) return null;
  try {
    const chaves = decifrar<{ id: string; segredo: string }>(data.access_token as string);
    if (!chaves.id || !chaves.segredo) return null;
    return { conta, balde, publico, chaveDeAcesso: chaves.id, chaveSecreta: chaves.segredo };
  } catch {
    return null;
  }
}

export type EstadoDoArmazenamento = { onde: "supabase" | "r2"; limite: number; r2: { configurado: boolean; conta: string | null; balde: string | null; publico: string | null } };

/** O que a tela pode saber: onde as mídias moram e até que tamanho. Nunca as chaves. */
export async function estadoDoArmazenamento(db: SupabaseClient): Promise<EstadoDoArmazenamento> {
  const { data } = await db.from("integration_tokens").select("meta").eq("provider", PROVEDOR_R2).maybeSingle();
  const meta = (data?.meta ?? {}) as Record<string, unknown>;
  const r2 = await lerR2(db);
  return {
    onde: r2 ? "r2" : "supabase",
    limite: r2 ? LIMITE_DO_R2 : LIMITE_DO_SUPABASE,
    r2: { configurado: Boolean(r2), conta: meta.conta ? String(meta.conta) : null, balde: meta.balde ? String(meta.balde) : null, publico: meta.publico ? String(meta.publico) : null },
  };
}

export type EnvioPreparado = {
  onde: "supabase" | "r2";
  caminho: string;
  /** Para onde o navegador manda o arquivo, com PUT. */
  urlDeEnvio: string;
  cabecalhos: Record<string, string>;
  /** O endereço que as redes vão buscar. */
  urlPublica: string;
};

const urlPublicaDoSupabase = (caminho: string) => `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BALDE}/${caminho}`;

/** Confere tipo e tamanho e devolve o problema em uma frase, ou null. */
export function conferirArquivo(mime: string, tamanho: number, limite: number): string | null {
  if (!TIPOS_ACEITOS[mime]) return "Tipo de arquivo não aceito. Use JPEG ou PNG para imagem e MP4 ou MOV para vídeo.";
  if (!Number.isFinite(tamanho) || tamanho <= 0) return "Arquivo vazio.";
  if (tamanho > limite) return `O arquivo passa de ${Math.round(limite / MB)} MB, o máximo que o armazenamento aceita hoje.`;
  return null;
}

/**
 * Prepara a subida de UM arquivo: escolhe o lugar, cria o caminho e assina o
 * endereço. Quem chama já conferiu a área da pessoa.
 */
export async function prepararEnvio(db: SupabaseClient, arquivo: { mime: string; tamanho: number }): Promise<EnvioPreparado | { erro: string }> {
  const r2 = await lerR2(db);
  const problema = conferirArquivo(arquivo.mime, arquivo.tamanho, r2 ? LIMITE_DO_R2 : LIMITE_DO_SUPABASE);
  if (problema) return { erro: problema };

  const agora = new Date();
  const caminho = `${agora.getUTCFullYear()}/${String(agora.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID()}.${TIPOS_ACEITOS[arquivo.mime]}`;

  if (r2) {
    return {
      onde: "r2",
      caminho,
      urlDeEnvio: enderecoAssinado({ metodo: "PUT", host: `${r2.conta}.r2.cloudflarestorage.com`, caminho: `/${r2.balde}/${caminho}`, chaveDeAcesso: r2.chaveDeAcesso, chaveSecreta: r2.chaveSecreta, regiao: "auto", validade: 3600 }),
      cabecalhos: { "content-type": arquivo.mime },
      urlPublica: `${r2.publico}/${caminho}`,
    };
  }

  const { data, error } = await db.storage.from(BALDE).createSignedUploadUrl(caminho);
  if (error || !data) return { erro: `O armazenamento não aceitou preparar o envio: ${error?.message ?? "sem resposta"}` };
  return {
    onde: "supabase",
    caminho,
    urlDeEnvio: data.signedUrl,
    cabecalhos: { "content-type": arquivo.mime, "cache-control": "max-age=31536000", "x-upsert": "false" },
    urlPublica: urlPublicaDoSupabase(caminho),
  };
}

/**
 * Guarda um arquivo que JÁ ESTÁ no servidor (o conector baixa a mídia de um
 * link e manda para cá). Pela tela o caminho é outro: o navegador sobe direto.
 */
export async function guardarArquivo(db: SupabaseClient, arquivo: { bytes: Buffer; mime: string }): Promise<{ url: string; caminho: string; tamanho: number } | { erro: string }> {
  const preparado = await prepararEnvio(db, { mime: arquivo.mime, tamanho: arquivo.bytes.length });
  if ("erro" in preparado) return preparado;
  try {
    // Uint8Array novo: o Buffer do Node pode ser uma fatia de um bloco maior, e o corpo do pedido precisa ser só o arquivo.
    const r = await fetch(preparado.urlDeEnvio, { method: "PUT", headers: preparado.cabecalhos, body: new Uint8Array(arquivo.bytes), cache: "no-store", signal: AbortSignal.timeout(45_000) });
    if (!r.ok) return { erro: `O armazenamento recusou o arquivo (HTTP ${r.status}).` };
  } catch {
    return { erro: "A ligação com o armazenamento caiu no meio do envio. Tente de novo." };
  }
  return { url: preparado.urlPublica, caminho: preparado.caminho, tamanho: arquivo.bytes.length };
}

/**
 * Confere que um arquivo subiu de verdade e mede o tamanho dele. A tela diz o
 * tamanho que mandou; o que vale para a fila é o que o armazenamento tem.
 */
export async function conferirSubida(urlPublica: string): Promise<{ tamanho: number; mime: string } | null> {
  try {
    const r = await fetch(urlPublica, { method: "HEAD", cache: "no-store", signal: AbortSignal.timeout(15_000) });
    if (!r.ok) return null;
    return { tamanho: Number(r.headers.get("content-length")) || 0, mime: (r.headers.get("content-type") ?? "").split(";")[0] };
  } catch {
    return null;
  }
}

/** O endereço é de um dos nossos armazenamentos? Mídia de post só sai de lá: a fila não manda rede buscar arquivo em endereço de terceiro. */
export async function ehEnderecoNosso(db: SupabaseClient, url: string): Promise<boolean> {
  if (url.startsWith(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BALDE}/`)) return true;
  const r2 = await lerR2(db);
  return Boolean(r2 && url.startsWith(`${r2.publico}/`));
}

/** Apaga mídias que não vão mais ser usadas (rascunho descartado). Falha aqui não derruba nada: é limpeza. */
export async function apagarMidias(db: SupabaseClient, midias: { caminho?: string; url: string }[]): Promise<void> {
  const r2 = await lerR2(db);
  const doSupabase: string[] = [];
  for (const m of midias) {
    if (!m.caminho || !/^\d{4}\/\d{2}\/[0-9a-f-]{36}\.\w{3,4}$/.test(m.caminho)) continue;
    if (r2 && m.url.startsWith(`${r2.publico}/`)) {
      const url = enderecoAssinado({ metodo: "DELETE", host: `${r2.conta}.r2.cloudflarestorage.com`, caminho: `/${r2.balde}/${m.caminho}`, chaveDeAcesso: r2.chaveDeAcesso, chaveSecreta: r2.chaveSecreta, regiao: "auto", validade: 300 });
      await fetch(url, { method: "DELETE", cache: "no-store", signal: AbortSignal.timeout(10_000) }).catch(() => {});
    } else doSupabase.push(m.caminho);
  }
  if (doSupabase.length) await db.storage.from(BALDE).remove(doSupabase).catch(() => {});
}

/**
 * Guarda as chaves do R2, depois de PROVAR que funcionam: sobe um arquivo de
 * teste pelo endereço assinado, lê pelo endereço público e apaga. Só então
 * grava. Chave que não escreve, balde errado ou domínio público que não aponta
 * para o balde: nada é gravado, e a resposta diz qual dos três falhou.
 */
export async function guardarR2(
  db: SupabaseClient,
  dados: { conta: string; balde: string; publico: string; chaveDeAcesso: string; chaveSecreta: string },
): Promise<string | null> {
  const publico = dados.publico.replace(/\/+$/, "");
  const host = `${dados.conta}.r2.cloudflarestorage.com`;
  const caminho = `conferencia/${randomUUID()}.txt`;
  const assinar = (metodo: "PUT" | "DELETE") =>
    enderecoAssinado({ metodo, host, caminho: `/${dados.balde}/${caminho}`, chaveDeAcesso: dados.chaveDeAcesso, chaveSecreta: dados.chaveSecreta, regiao: "auto", validade: 300 });
  const marca = `jk-portal ${Date.now()}`;
  try {
    const subiu = await fetch(assinar("PUT"), { method: "PUT", body: marca, headers: { "content-type": "text/plain" }, cache: "no-store", signal: AbortSignal.timeout(15_000) });
    if (!subiu.ok) return `O R2 recusou a escrita (HTTP ${subiu.status}). Confira o ID da conta, o nome do balde e se o token é de leitura e escrita de objetos.`;
    const lido = await fetch(`${publico}/${caminho}`, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
    const texto = lido.ok ? await lido.text() : "";
    await fetch(assinar("DELETE"), { method: "DELETE", cache: "no-store", signal: AbortSignal.timeout(10_000) }).catch(() => {});
    if (texto !== marca) return `O arquivo subiu, mas o endereço público não devolveu o mesmo arquivo (HTTP ${lido.status}). Confira se o domínio está ligado a este balde.`;
  } catch {
    return "Não deu para falar com o R2 agora. Confira o ID da conta e tente de novo.";
  }
  const { error } = await db
    .from("integration_tokens")
    .upsert({ provider: PROVEDOR_R2, access_token: cifrar({ id: dados.chaveDeAcesso, segredo: dados.chaveSecreta }), meta: { conta: dados.conta, balde: dados.balde, publico } }, { onConflict: "provider" });
  return error?.message ?? null;
}
