import "server-only";
import { randomBytes, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { lerChaves } from "@/lib/leads/chaves";
import { absoluteUrl } from "@/lib/seo/site";
import { clienteDaKommo } from "./cliente";
import { EVENTOS_DO_WEBHOOK } from "./conta";

/**
 * O webhook da Kommo: o segredo, o endereço e o cadastro na Kommo.
 *
 * A Kommo não assina o aviso. A proteção é um segredo no endereço
 * (`?segredo=`), guardado em `integration_tokens` (provider `kommo_webhook`),
 * tabela que só a chave de serviço lê. E o aviso não carrega dado que vá para
 * o banco: ele só diz QUAIS negócios e contatos mudaram, e o estado é relido
 * pela API com a chave. Um aviso forjado, no pior caso, faz o painel reler.
 *
 * Cadastrar o webhook é a ÚNICA escrita do painel na Kommo nesta fase, e só por
 * ação de administrador (`ligarWebhookDaKommo` em Integrações).
 */

export const PROVEDOR_DO_WEBHOOK = "kommo_webhook";

export async function segredoDoWebhook(db: SupabaseClient): Promise<string | null> {
  const { data } = await db.from("integration_tokens").select("access_token").eq("provider", PROVEDOR_DO_WEBHOOK).maybeSingle();
  return (data?.access_token as string | undefined) ?? null;
}

export function segredoConfere(recebido: string, esperado: string | null): boolean {
  if (!recebido || !esperado) return false;
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

const enderecoDoWebhook = (segredo: string) => `${absoluteUrl("/api/kommo/webhook")}?segredo=${segredo}`;
const SEM_SEGREDO = (destino: string) => destino.split("?")[0];

type WebhookDaKommo = { id: number; destination: string; disabled?: boolean; settings?: string[] };

/** O webhook do painel como a Kommo o tem agora, ou null se não estiver cadastrado. */
export async function conferirWebhook(db: SupabaseClient): Promise<{ estado: "sem_chave" | "ausente" | "ligado" | "desligado"; id?: number; erro?: string }> {
  const chave = (await lerChaves(db)).kommo;
  if (!chave) return { estado: "sem_chave" };
  const pedir = clienteDaKommo(chave);
  const nosso = SEM_SEGREDO(absoluteUrl("/api/kommo/webhook"));
  try {
    const r = await pedir<{ _embedded?: { webhooks?: WebhookDaKommo[] } }>("/api/v4/webhooks");
    const w = (r?._embedded?.webhooks ?? []).find((x) => SEM_SEGREDO(x.destination) === nosso);
    const estado = !w ? "ausente" : w.disabled ? "desligado" : "ligado";
    await db.from("kommo_estado").update({
      webhook_id: w?.id ?? null,
      webhook_desligado: w ? Boolean(w.disabled) : null,
      webhook_conferido_em: new Date().toISOString(),
      webhook_erro: null,
    }).eq("id", 1);
    return { estado, id: w?.id };
  } catch (e) {
    const erro = e instanceof Error ? e.message : String(e);
    await db.from("kommo_estado").update({ webhook_erro: erro.slice(0, 300), webhook_conferido_em: new Date().toISOString() }).eq("id", 1);
    return { estado: "ausente", erro };
  }
}

/**
 * Cadastra (ou religa) o webhook do painel na Kommo. O mesmo endereço mandado
 * de novo atualiza o que já existe, e é assim que se religa um webhook que a
 * Kommo desligou depois de falhas. O segredo nasce na primeira vez e não muda.
 */
export async function ligarWebhook(db: SupabaseClient): Promise<{ ok: boolean; erro?: string }> {
  const chave = (await lerChaves(db)).kommo;
  if (!chave) return { ok: false, erro: "Cole a chave da Kommo antes de ligar o webhook." };

  let segredo = await segredoDoWebhook(db);
  if (!segredo) {
    segredo = randomBytes(24).toString("hex");
    const { error } = await db.from("integration_tokens").upsert({ provider: PROVEDOR_DO_WEBHOOK, access_token: segredo, meta: {} }, { onConflict: "provider" });
    if (error) return { ok: false, erro: error.message };
  }

  try {
    await clienteDaKommo(chave)("/api/v4/webhooks", {
      metodo: "POST",
      corpo: { destination: enderecoDoWebhook(segredo), settings: [...EVENTOS_DO_WEBHOOK], sort: 10 },
    });
  } catch (e) {
    const erro = e instanceof Error ? e.message : String(e);
    await db.from("kommo_estado").update({ webhook_erro: erro.slice(0, 300) }).eq("id", 1);
    return { ok: false, erro: "A Kommo recusou o cadastro do webhook. Confira se a chave é da conta administradora." };
  }
  const c = await conferirWebhook(db);
  return c.estado === "ligado" ? { ok: true } : { ok: false, erro: "A Kommo aceitou o cadastro, mas o webhook não aparece ligado. Confira de novo em alguns minutos." };
}
