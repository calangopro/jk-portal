"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { PIXEL_DA_JK, SUBDOMINIO_KOMMO, type ProvedorDeChave } from "@/lib/leads/chaves";
import { repassarGuardados } from "@/lib/leads/repassar";
import { DESTINOS, type Destino } from "@/lib/leads/tipos";
import { PROVEDOR_CLIENTE, PROVEDOR_CONTA } from "@/lib/google-perfil/oauth";
import { sincronizarAvaliacoes } from "@/lib/google-perfil/sincronizar";
import { TAG_AVALIACOES } from "@/lib/google-perfil/publico";

export type IntegracaoState = { erro?: string; ok?: string };

// ---------------------------------------------------------------------------
// Google, Perfil da Empresa (avaliações das lojas). Ver lib/google-perfil.
// ---------------------------------------------------------------------------

/**
 * Salva o cliente OAuth do projeto jk-portal-509621. O segredo vai para
 * `integration_tokens` e nunca volta para a tela; em branco, mantém o que já
 * está (dá para corrigir o id sem colar o segredo de novo).
 */
export async function salvarClienteGoogle(_prev: IntegracaoState, formData: FormData): Promise<IntegracaoState> {
  await requireAdmin();

  const id = String(formData.get("client_id") ?? "").trim();
  if (!/^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(id)) {
    return { erro: "O ID do cliente termina em .apps.googleusercontent.com. Copie do Google Cloud, em Clientes." };
  }

  const supabase = createAdminClient();
  const { data: atual } = await supabase
    .from("integration_tokens")
    .select("access_token")
    .eq("provider", PROVEDOR_CLIENTE)
    .maybeSingle();

  const digitado = String(formData.get("client_secret") ?? "").trim();
  const segredo = digitado || (atual?.access_token as string | undefined) || "";
  if (!segredo) return { erro: "Cole a chave secreta do cliente." };
  if (digitado && digitado.length < 20) return { erro: "Essa chave secreta parece curta demais. Ela começa com GOCSPX-." };

  const { error } = await supabase
    .from("integration_tokens")
    .upsert({ provider: PROVEDOR_CLIENTE, access_token: segredo, meta: { client_id: id } }, { onConflict: "provider" });
  if (error) return { erro: error.message };

  revalidatePath("/admin/integracoes");
  return { ok: "Cliente salvo. Agora é só Conectar com o Google." };
}

/** Lê o Google agora, sem esperar a rodada da manhã. */
export async function sincronizarGoogleAgora(_prev: IntegracaoState, _formData: FormData): Promise<IntegracaoState> {
  await requireAdmin();
  const r = await sincronizarAvaliacoes();
  revalidatePath("/admin/integracoes");
  if (!r.ok) return { erro: r.erro ?? "A leitura falhou." };
  revalidateTag(TAG_AVALIACOES);
  return { ok: `${r.lojas} lojas e ${r.avaliacoes} avaliações lidas.` };
}

/**
 * Desliga o portal da conta do Google: retira a autorização no próprio Google
 * e apaga o token daqui. O cache das avaliações sai também, porque sem
 * conexão ele não seria mais renovado.
 */
export async function desconectarGoogle(_prev: IntegracaoState, _formData: FormData): Promise<IntegracaoState> {
  await requireAdmin();
  const supabase = createAdminClient();

  const { data: conta } = await supabase
    .from("integration_tokens")
    .select("refresh_token")
    .eq("provider", PROVEDOR_CONTA)
    .maybeSingle();
  if (conta?.refresh_token) {
    await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: conta.refresh_token as string }).toString(),
      signal: AbortSignal.timeout(8000),
    }).catch(() => null);
  }

  await supabase.from("integration_tokens").delete().eq("provider", PROVEDOR_CONTA);
  await supabase.from("google_locais").delete().neq("name", "");

  revalidatePath("/admin/integracoes");
  revalidateTag(TAG_AVALIACOES);
  return { ok: "Desconectado. As avaliações saíram da loja." };
}

/** Salva a configuração pública e liga ou desliga a integração. */
export async function salvarIntegracao(
  _prev: IntegracaoState,
  formData: FormData,
): Promise<IntegracaoState> {
  await requireAdmin();

  const provider = String(formData.get("provider") ?? "");
  const conectar = String(formData.get("conectar") ?? "") === "1";
  if (!provider) return { erro: "Integração não identificada." };

  // Cada provedor guarda campos próprios, todos NÃO sensíveis.
  const config: Record<string, string> = {};
  if (provider === "gtm") {
    const id = String(formData.get("container_id") ?? "").trim();
    if (conectar && !/^GTM-[A-Z0-9]+$/i.test(id)) {
      return { erro: "O ID do GTM tem o formato GTM-XXXXXXX." };
    }
    config.container_id = id;
  }
  if (provider === "ga4") {
    const id = String(formData.get("measurement_id") ?? "").trim();
    if (conectar && !/^G-[A-Z0-9]+$/i.test(id)) {
      return { erro: "O ID do GA4 tem o formato G-XXXXXXXXXX." };
    }
    config.measurement_id = id;
  }
  if (provider === "gsc") {
    config.site_url = String(formData.get("site_url") ?? "").trim();
  }
  if (provider === "gmb") {
    config.account = String(formData.get("account") ?? "").trim();
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("integrations")
    .upsert(
      {
        provider,
        display_name: String(formData.get("display_name") ?? provider),
        config,
        status: conectar ? "connected" : "disconnected",
        connected_at: conectar ? new Date().toISOString() : null,
      },
      { onConflict: "provider" },
    );

  if (error) return { erro: error.message };

  revalidatePath("/admin/integracoes");
  revalidatePath("/", "layout");
  return { ok: conectar ? "Conectado." : "Desconectado." };
}

// ---------------------------------------------------------------------------
// Chaves dos destinos do contato (grupo de ofertas)
// ---------------------------------------------------------------------------

const PROVEDOR_DO_DESTINO: Record<Destino, ProvedorDeChave> = {
  kommo: "kommo",
  rd: "rd_station",
  webhook: "grupo_webhook",
  meta: "meta_capi",
};

const PROVEDORES_EDITAVEIS = Object.values(PROVEDOR_DO_DESTINO);

/** Confere a chave no próprio destino antes de gravar, quando dá para conferir sem mandar contato falso. */
async function conferirChave(provider: ProvedorDeChave, valor: string, meta: Record<string, string>): Promise<string | null> {
  try {
    if (provider === "kommo") {
      const r = await fetch(`https://${meta.subdominio || SUBDOMINIO_KOMMO}.kommo.com/api/v4/account`, {
        headers: { Authorization: `Bearer ${valor}` },
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      });
      return r.ok ? null : "A Kommo recusou essa chave. Confira se copiou a chave de longa duração inteira.";
    }
    if (provider === "meta_capi") {
      const r = await fetch(
        `https://graph.facebook.com/v24.0/${meta.pixel_id || PIXEL_DA_JK}?fields=id&access_token=${encodeURIComponent(valor)}`,
        { signal: AbortSignal.timeout(8000), cache: "no-store" },
      );
      return r.ok ? null : "O Meta recusou essa chave para o pixel da JK. Gere o token no Gerenciador de Eventos, em Configurações do pixel.";
    }
    if (provider === "grupo_webhook") {
      const u = new URL(valor);
      return u.protocol === "https:" ? null : "O webhook precisa começar com https://.";
    }
    return valor.length >= 16 ? null : "Essa chave parece curta demais.";
  } catch {
    return provider === "grupo_webhook" ? "Esse endereço não é um link válido." : "Não deu para conferir a chave agora. Tente de novo.";
  }
}

/**
 * Salva a chave de um destino em `integration_tokens`.
 *
 * Campo de chave em branco mantém a chave que já existe: é como se troca só o
 * funil da Kommo sem colar o token de novo. A chave nunca volta para a tela.
 */
export async function salvarChave(_prev: IntegracaoState, formData: FormData): Promise<IntegracaoState> {
  await requireAdmin();

  const provider = String(formData.get("provider") ?? "") as ProvedorDeChave;
  if (!PROVEDORES_EDITAVEIS.includes(provider)) return { erro: "Integração não identificada." };

  const supabase = createAdminClient();

  if (String(formData.get("remover") ?? "") === "1") {
    await supabase.from("integration_tokens").delete().eq("provider", provider);
    revalidatePath("/admin/integracoes");
    revalidatePath("/admin/grupo");
    return { ok: "Chave removida. Os contatos novos ficam guardados até uma chave nova entrar." };
  }

  const { data: atual } = await supabase
    .from("integration_tokens")
    .select("access_token, meta")
    .eq("provider", provider)
    .maybeSingle();

  const meta: Record<string, string> = { ...((atual?.meta ?? {}) as Record<string, string>) };

  if (provider === "kommo") {
    // "funil:etapa", ou vazio para só contato.
    const [funil = "", etapa = ""] = String(formData.get("funil") ?? "").split(":");
    meta.funil_id = /^\d+$/.test(funil) ? funil : "";
    meta.etapa_id = /^\d+$/.test(etapa) ? etapa : "";
    meta.subdominio = meta.subdominio || SUBDOMINIO_KOMMO;
  }
  if (provider === "meta_capi") {
    const pixel = String(formData.get("pixel_id") ?? "").trim();
    meta.pixel_id = /^\d{6,20}$/.test(pixel) ? pixel : PIXEL_DA_JK;
    const teste = String(formData.get("codigo_de_teste") ?? "").trim();
    meta.codigo_de_teste = /^TEST\w{1,20}$/.test(teste) ? teste : "";
  }

  const digitado = String(formData.get("valor") ?? "").trim();
  const valor = digitado || (atual?.access_token as string | undefined) || "";
  if (!valor) return { erro: provider === "grupo_webhook" ? "Cole o endereço do webhook." : "Cole a chave." };

  if (digitado || provider === "meta_capi") {
    const problema = await conferirChave(provider, valor, meta);
    if (problema) return { erro: problema };
  }

  const { error } = await supabase
    .from("integration_tokens")
    .upsert({ provider, access_token: valor, meta }, { onConflict: "provider" });
  if (error) return { erro: error.message };

  revalidatePath("/admin/integracoes");
  revalidatePath("/admin/grupo");
  return { ok: digitado ? "Chave conferida e salva." : "Salvo." };
}

/** Manda para um destino os contatos que ficaram guardados (sem chave ou com erro). */
export async function enviarGuardados(_prev: IntegracaoState, formData: FormData): Promise<IntegracaoState> {
  await requireAdmin();
  const destino = String(formData.get("destino") ?? "") as Destino;
  if (!DESTINOS.includes(destino)) return { erro: "Destino não identificado." };

  const { enviados, restantes } = await repassarGuardados(createAdminClient(), destino);
  revalidatePath("/admin/integracoes");
  revalidatePath("/admin/grupo");

  if (enviados === 0 && restantes > 0) {
    return { erro: `Nenhum contato foi aceito. Faltam ${restantes}. Veja o motivo na tela do Grupo de ofertas.` };
  }
  return {
    ok:
      restantes > 0
        ? `${enviados} enviados. Faltam ${restantes}: clique de novo para continuar.`
        : `${enviados} ${enviados === 1 ? "contato enviado" : "contatos enviados"}. Não sobrou nenhum guardado.`,
  };
}
