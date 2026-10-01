import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { lerChaves, type Chave, type Chaves } from "./chaves";
import { enviarParaKommo, enviarParaMeta, enviarParaRd, enviarParaWebhook, Ignorado } from "./destinos";
import { DESTINOS, MAX_TENTATIVAS, type Destino, type Envios, type Lead, type SituacaoDoEnvio } from "./tipos";

/**
 * Leva um contato gravado aos destinos que ainda não o receberam.
 *
 * Roda logo depois do envio do formulário (em `after`, sem atrasar a resposta
 * para quem preencheu), de novo pelo relógio quando algum destino falhou, e
 * pelo painel quando alguém salva uma chave nova e manda enviar os guardados.
 *
 * Destino que já recebeu (`ok`) ou que não se aplica (`ignorado`) não é
 * chamado de novo: o relógio pode passar quantas vezes quiser sem duplicar
 * contato na Kommo.
 */

const ENVIAR: Record<Destino, (lead: Lead, chave: Chave) => Promise<string>> = {
  kommo: enviarParaKommo,
  rd: enviarParaRd,
  webhook: enviarParaWebhook,
  meta: enviarParaMeta,
};

const CHAVE_DO_DESTINO: Record<Destino, keyof Chaves> = {
  kommo: "kommo",
  rd: "rd_station",
  webhook: "grupo_webhook",
  meta: "meta_capi",
};

export type OpcoesDoRepasse = {
  /** Só estes destinos. Sem a lista, todos. */
  destinos?: Destino[];
  /** Tenta mesmo depois do teto de tentativas (botão do painel). */
  forcar?: boolean;
  /** Chaves já lidas, para uma rodada com muitos contatos não ler a tabela a cada um. */
  chaves?: Chaves;
};

async function umDestino(
  destino: Destino,
  lead: Lead,
  chaves: Chaves,
  forcar: boolean,
): Promise<SituacaoDoEnvio | null> {
  const atual = lead.envios[destino];
  if (atual?.status === "ok" || atual?.status === "ignorado") return null;
  const tentativas = atual?.tentativas ?? 0;
  if (atual?.status === "erro" && tentativas >= MAX_TENTATIVAS && !forcar) return null;

  const em = new Date().toISOString();
  const chave = chaves[CHAVE_DO_DESTINO[destino]];
  if (!chave) return { status: "sem_chave", em };

  try {
    const ref = await ENVIAR[destino](lead, chave);
    return { status: "ok", em, ref: ref.slice(0, 120) };
  } catch (e) {
    if (e instanceof Ignorado) return { status: "ignorado", em, erro: e.message };
    const erro = e instanceof Error ? e.message : String(e);
    return { status: "erro", em, erro: erro.slice(0, 300), tentativas: tentativas + 1 };
  }
}

export function aindaPendente(envios: Envios): boolean {
  return DESTINOS.some((d) => envios[d]?.status === "erro" && (envios[d]?.tentativas ?? 0) < MAX_TENTATIVAS);
}

export async function repassarLead(
  supabase: SupabaseClient,
  lead: Lead,
  opcoes: OpcoesDoRepasse = {},
): Promise<Envios> {
  const chaves = opcoes.chaves ?? (await lerChaves(supabase));
  const destinos = opcoes.destinos ?? [...DESTINOS];

  const resultados = await Promise.all(
    destinos.map(async (d) => [d, await umDestino(d, lead, chaves, Boolean(opcoes.forcar))] as const),
  );

  const envios: Envios = { ...lead.envios };
  for (const [d, r] of resultados) if (r) envios[d] = r;

  const tentativas = Math.max(0, ...DESTINOS.map((d) => envios[d]?.tentativas ?? 0));
  await supabase
    .from("leads")
    .update({ envios, envio_pendente: aindaPendente(envios), tentativas })
    .eq("id", lead.id);

  return envios;
}

/**
 * Os contatos que ficaram guardados por falta de chave, para um destino.
 *
 * É o botão "Enviar os guardados" do painel: quem configurou a Kommo hoje
 * manda para lá todo mundo que se cadastrou antes. Teto por rodada, para o
 * clique não estourar o tempo da função; o botão mostra quantos faltam.
 */
export async function repassarGuardados(
  supabase: SupabaseClient,
  destino: Destino,
  limite = 60,
): Promise<{ enviados: number; restantes: number }> {
  const chaves = await lerChaves(supabase);
  if (!chaves[CHAVE_DO_DESTINO[destino]]) return { enviados: 0, restantes: 0 };

  const { data } = await supabase
    .from("leads")
    .select("*")
    .in(`envios->${destino}->>status`, ["sem_chave", "erro"])
    .order("criado_em", { ascending: true })
    .limit(limite);

  const lista = (data ?? []) as Lead[];
  let enviados = 0;
  // Em lotes pequenos: a Kommo limita a sete pedidos por segundo.
  for (let i = 0; i < lista.length; i += 3) {
    const lote = lista.slice(i, i + 3);
    const r = await Promise.all(
      lote.map((lead) => repassarLead(supabase, lead, { destinos: [destino], forcar: true, chaves })),
    );
    enviados += r.filter((e) => e[destino]?.status === "ok").length;
  }

  const { count } = await supabase
    .from("leads")
    .select("id", { count: "exact", head: true })
    .in(`envios->${destino}->>status`, ["sem_chave", "erro"]);

  return { enviados, restantes: count ?? 0 };
}
