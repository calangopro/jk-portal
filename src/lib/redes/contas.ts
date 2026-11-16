import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cifrar, decifrar, estaCifrado } from "./cofre";
import { ehRede, type RedeId } from "./redes";
import { ErroDaRede, type Aplicativo, type Conta, type ContaLigada, type Credenciais, type ModuloDaRede } from "./tipos";

/**
 * As contas ligadas e as credenciais delas. Tudo aqui recebe o cliente com a
 * chave de serviço: `redes_credenciais` não tem policy, e gravar em
 * `redes_contas` também é só do servidor. Quem chama já conferiu quem é a
 * pessoa (rota de ligação, rotina com o segredo do relógio, conector).
 *
 * Portado de `conexao.js` e `credenciais.js` do auto-agenciasetup.
 */

type LinhaDeConta = {
  id: string;
  rede: string;
  conta_id: string;
  nome: string | null;
  usuario: string | null;
  foto_url: string | null;
  link: string | null;
  escopos: string[] | null;
  via: string;
  status: string;
  expira_em: string | null;
  ultimo_erro: string | null;
  extra: Record<string, unknown> | null;
  conectada_em: string;
  lida_em: string | null;
};

const COLUNAS = "id, rede, conta_id, nome, usuario, foto_url, link, escopos, via, status, expira_em, ultimo_erro, extra, conectada_em, lida_em";

export function contaDaLinha(l: LinhaDeConta): Conta {
  return {
    id: l.id,
    rede: l.rede as RedeId,
    contaId: l.conta_id,
    nome: l.nome,
    usuario: l.usuario,
    fotoUrl: l.foto_url,
    link: l.link,
    escopos: l.escopos ?? [],
    via: l.via === "token" ? "token" : "oauth",
    status: l.status === "expirada" ? "expirada" : l.status === "desligada" ? "desligada" : "ativa",
    expiraEm: l.expira_em,
    ultimoErro: l.ultimo_erro,
    extra: l.extra ?? {},
    conectadaEm: l.conectada_em,
    lidaEm: l.lida_em,
  };
}

/** As contas que não foram desligadas, da mais antiga para a mais nova. Serve com a sessão de quem tem a área ou com a chave de serviço. */
export async function listarContas(db: SupabaseClient, filtro: { rede?: RedeId; soAtivas?: boolean } = {}): Promise<Conta[]> {
  let q = db.from("redes_contas").select(COLUNAS).order("conectada_em", { ascending: true });
  q = filtro.soAtivas ? q.eq("status", "ativa") : q.neq("status", "desligada");
  if (filtro.rede) q = q.eq("rede", filtro.rede);
  const { data, error } = await q;
  if (error) {
    console.error("[redes] listarContas:", error.message);
    return [];
  }
  return ((data ?? []) as LinhaDeConta[]).filter((l) => ehRede(l.rede)).map(contaDaLinha);
}

export async function lerConta(db: SupabaseClient, id: string): Promise<Conta | null> {
  const { data } = await db.from("redes_contas").select(COLUNAS).eq("id", id).maybeSingle();
  return data && ehRede((data as LinhaDeConta).rede) ? contaDaLinha(data as LinhaDeConta) : null;
}

/**
 * Guarda as contas que uma ligação devolveu: a linha pública e a credencial
 * cifrada. Ligar de novo a mesma conta troca a credencial e a devolve a
 * "ativa". Devolve os ids das linhas.
 */
export async function guardarContas(
  db: SupabaseClient,
  contas: ContaLigada[],
  quem: { perfilId: string | null; via: "oauth" | "token" },
): Promise<{ ids: string[]; erro: string | null }> {
  const ids: string[] = [];
  for (const c of contas) {
    const { data, error } = await db
      .from("redes_contas")
      .upsert(
        {
          rede: c.rede,
          conta_id: String(c.contaId),
          nome: c.nome?.slice(0, 160) ?? null,
          usuario: c.usuario?.slice(0, 160) ?? null,
          foto_url: c.fotoUrl?.slice(0, 1200) ?? null,
          link: c.link?.slice(0, 500) ?? null,
          escopos: c.escopos,
          via: quem.via,
          status: "ativa",
          expira_em: c.expiraEm,
          ultimo_erro: null,
          extra: c.extra ?? {},
          conectada_por: quem.perfilId,
          conectada_em: new Date().toISOString(),
          atualizado_em: new Date().toISOString(),
        },
        { onConflict: "rede,conta_id" },
      )
      .select("id")
      .single();
    if (error || !data) return { ids, erro: error?.message ?? "A conta não foi gravada." };

    const guardou = await db
      .from("redes_credenciais")
      .upsert({ conta_id: data.id, cifrado: cifrar(c.credenciais), atualizado_em: new Date().toISOString() }, { onConflict: "conta_id" });
    if (guardou.error) return { ids, erro: guardou.error.message };
    ids.push(data.id as string);
  }
  return { ids, erro: null };
}

/** Desliga a conta: ela some das telas e a credencial é APAGADA. Os números já lidos ficam. */
export async function desligarConta(db: SupabaseClient, id: string): Promise<string | null> {
  const { error } = await db.from("redes_contas").update({ status: "desligada", ultimo_erro: null, atualizado_em: new Date().toISOString() }).eq("id", id);
  if (error) return error.message;
  const apagou = await db.from("redes_credenciais").delete().eq("conta_id", id);
  return apagou.error?.message ?? null;
}

/** Renova quando faltar menos que isto para vencer. O token do Google vale uma hora; o do Instagram, 60 dias. */
const RENOVAR_ANTES_MS = 7 * 86_400_000;

/**
 * As credenciais de uma conta, abertas e válidas: renova pelo módulo quando
 * estão perto de vencer e grava a credencial nova. Renovação que falha com o
 * token ainda valendo não derruba nada: segue com o que tem e tenta de novo na
 * próxima.
 */
export async function credenciaisAtivas(db: SupabaseClient, conta: Conta, modulo: ModuloDaRede): Promise<Credenciais> {
  const { data } = await db.from("redes_credenciais").select("cifrado").eq("conta_id", conta.id).maybeSingle();
  if (!data?.cifrado) throw new ErroDaRede("Esta conta está sem credencial guardada. Ligue de novo em Integrações.", { tokenMorto: true });
  let credenciais = decifrar<Credenciais>(data.cifrado as string);

  const vence = conta.expiraEm ? Date.parse(conta.expiraEm) : NaN;
  const pertoDeVencer = Number.isFinite(vence) && vence - Date.now() < RENOVAR_ANTES_MS;
  if (modulo.renovar && pertoDeVencer) {
    try {
      const aplicativo = modulo.provedorDoAplicativo ? await lerAplicativo(db, modulo.provedorDoAplicativo) : null;
      const novo = await modulo.renovar({ aplicativo, credenciais });
      if (novo) {
        credenciais = novo.credenciais;
        await db.from("redes_credenciais").update({ cifrado: cifrar(credenciais), atualizado_em: new Date().toISOString() }).eq("conta_id", conta.id);
        await db.from("redes_contas").update({ expira_em: novo.expiraEm, status: "ativa", ultimo_erro: null, atualizado_em: new Date().toISOString() }).eq("id", conta.id);
      }
    } catch (e) {
      if (e instanceof ErroDaRede && e.tokenMorto) throw e;
      // Já venceu e não renovou: não adianta seguir com token morto.
      if (Number.isFinite(vence) && vence < Date.now()) {
        throw new ErroDaRede("O acesso venceu e a renovação falhou. Ligue a conta de novo em Integrações.", { tokenMorto: true });
      }
      console.error("[redes] renovar", conta.rede, e instanceof Error ? e.message : e);
    }
  }
  return credenciais;
}

/** A credencial morreu: a conta vira "expirada" e as telas pedem para ligar de novo. */
export async function marcarExpirada(db: SupabaseClient, contaId: string, motivo: string): Promise<void> {
  await db
    .from("redes_contas")
    .update({ status: "expirada", ultimo_erro: motivo.slice(0, 300), atualizado_em: new Date().toISOString() })
    .eq("id", contaId);
}

/** Anota o erro da última leitura sem mudar a situação (limite de uso, permissão que falta). */
export async function anotarErro(db: SupabaseClient, contaId: string, motivo: string | null): Promise<void> {
  await db.from("redes_contas").update({ ultimo_erro: motivo ? motivo.slice(0, 300) : null, atualizado_em: new Date().toISOString() }).eq("id", contaId);
}

// ------------------------------------------------------------------ aplicativos

/**
 * O aplicativo de uma rede (id e segredo do cliente OAuth), guardado em
 * `integration_tokens` como as outras chaves do painel. O segredo fica cifrado
 * pelo cofre na coluna `access_token`; o id, que não é segredo, em `meta`.
 *
 * O cliente do Google é o que já existia (`google_cliente`, do Perfil da
 * Empresa), gravado antes do cofre: por isso a leitura aceita segredo em texto
 * puro também.
 */
export async function lerAplicativo(db: SupabaseClient, provedor: string): Promise<Aplicativo | null> {
  const { data } = await db.from("integration_tokens").select("access_token, meta").eq("provider", provedor).maybeSingle();
  const meta = (data?.meta ?? {}) as Record<string, unknown>;
  const id = String(meta.client_id ?? meta.app_id ?? "");
  const guardado = (data?.access_token ?? "") as string;
  if (!id || !guardado) return null;
  let segredo = guardado;
  if (estaCifrado(guardado)) {
    try {
      segredo = String(decifrar<{ segredo: string }>(guardado).segredo ?? "");
    } catch {
      return null;
    }
  }
  if (!segredo) return null;
  const extra: Record<string, string> = {};
  for (const [k, v] of Object.entries(meta)) if (typeof v === "string" && k !== "client_id" && k !== "app_id") extra[k] = v;
  return { id, segredo, extra };
}

/** Só o que a tela pode ver do aplicativo: se existe e qual o id. Nunca o segredo. */
export async function estadoDoAplicativo(db: SupabaseClient, provedor: string): Promise<{ configurado: boolean; id: string | null; extra: Record<string, string> }> {
  const { data } = await db.from("integration_tokens").select("access_token, meta").eq("provider", provedor).maybeSingle();
  const meta = (data?.meta ?? {}) as Record<string, unknown>;
  const id = String(meta.client_id ?? meta.app_id ?? "") || null;
  const extra: Record<string, string> = {};
  for (const [k, v] of Object.entries(meta)) if (typeof v === "string" && k !== "client_id" && k !== "app_id") extra[k] = v;
  return { configurado: Boolean(id && data?.access_token), id, extra };
}

/** Grava o aplicativo de uma rede. Segredo vazio mantém o que já estava. */
export async function guardarAplicativo(
  db: SupabaseClient,
  provedor: string,
  dados: { id: string; segredo: string; extra?: Record<string, string> },
): Promise<string | null> {
  const atual = await db.from("integration_tokens").select("access_token").eq("provider", provedor).maybeSingle();
  const segredo = dados.segredo ? cifrar({ segredo: dados.segredo }) : ((atual.data?.access_token ?? "") as string);
  if (!segredo) return "Cole a chave secreta do aplicativo.";
  const { error } = await db
    .from("integration_tokens")
    .upsert({ provider: provedor, access_token: segredo, meta: { app_id: dados.id, ...(dados.extra ?? {}) } }, { onConflict: "provider" });
  return error?.message ?? null;
}
