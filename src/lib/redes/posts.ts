import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { apagarMidias, ehEnderecoNosso } from "./armazenamento";
import { listarContas } from "./contas";
import { modulo } from "./plataformas";
import { nomeDaRede, type Formato, type RedeId } from "./redes";
import { temTravessao } from "./regras";
import type { Conta, Midia, Peca } from "./tipos";

/**
 * O núcleo dos posts das redes: criar, salvar, liberar (publicar agora ou
 * agendar), cancelar e tentar de novo.
 *
 * São TRÊS portas para o mesmo ato: a tela do compositor, o conector do Claude
 * e o relógio. Como na publicação dos posts do site (`lib/publicacao`), as
 * travas moram aqui e as portas só chamam: se cada porta conferisse do seu
 * jeito, bastaria entrar pela mais frouxa.
 *
 * Tudo recebe o cliente com a chave de serviço (a escrita nessas tabelas é só
 * dela) e QUEM está fazendo. Não existe post sem autor: pelo conector, o autor
 * é quem está logado nele. Quem chama já conferiu a área `redes`.
 *
 * Nada aqui fala com rede social. Liberar um post só o põe na fila; quem
 * publica é `fila.ts`.
 */

export const FORMATOS: Formato[] = ["post", "carrossel", "video_curto", "story", "video", "texto"];

/** Até quando dá para agendar. Longe demais, o token pode ter vencido e a peça envelhecido. */
const DIAS_PARA_FRENTE = 180;

export type DadosDoPost = {
  titulo?: string | null;
  legenda: string;
  formato: Formato;
  midias: Midia[];
  opcoes?: Record<string, unknown>;
  /** Os ids de `redes_contas` para onde o post vai. */
  contas: string[];
  /** Legenda ou título só de uma conta, quando diferente do post. Chave: id da conta. */
  porConta?: Record<string, { legenda?: string | null; titulo?: string | null }>;
};

export type Quem = { id: string; origem: "painel" | "conector" };

export type Resultado<T = object> = ({ ok: true } & T) | { ok: false; erro: string };

const falha = (erro: string): { ok: false; erro: string } => ({ ok: false, erro });

// ------------------------------------------------------------------ conferência

const limparTexto = (v: unknown, max: number): string => String(v ?? "").replace(/\r\n/g, "\n").slice(0, max);

/** Normaliza as mídias que vieram da tela ou do conector: só os campos conhecidos, com os tipos certos. */
function lerMidias(bruto: unknown): Midia[] {
  if (!Array.isArray(bruto)) return [];
  const saida: Midia[] = [];
  for (const x of bruto.slice(0, 20)) {
    if (!x || typeof x !== "object") continue;
    const m = x as Record<string, unknown>;
    const url = String(m.url ?? "");
    if (!/^https:\/\//.test(url)) continue;
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : undefined);
    saida.push({
      tipo: m.tipo === "video" ? "video" : "imagem",
      url,
      caminho: typeof m.caminho === "string" ? m.caminho.slice(0, 200) : undefined,
      alt: typeof m.alt === "string" && m.alt.trim() ? m.alt.trim().slice(0, 1000) : undefined,
      mime: typeof m.mime === "string" ? m.mime.slice(0, 60) : undefined,
      largura: num(m.largura),
      altura: num(m.altura),
      duracao: num(m.duracao),
      tamanho: num(m.tamanho),
    });
  }
  return saida;
}

const OPCOES_CONHECIDAS = ["primeiro_comentario", "colaboradores", "fora_do_feed", "capa_ms", "visibilidade", "categoria", "tags", "feito_com_ia", "link"] as const;

function lerOpcoes(bruto: unknown): Record<string, unknown> {
  const o = bruto && typeof bruto === "object" && !Array.isArray(bruto) ? (bruto as Record<string, unknown>) : {};
  const saida: Record<string, unknown> = {};
  for (const k of OPCOES_CONHECIDAS) {
    const v = o[k];
    if (v === undefined || v === null || v === "") continue;
    if (typeof v === "string") saida[k] = v.slice(0, 2200);
    else if (typeof v === "boolean" || typeof v === "number") saida[k] = v;
    else if (Array.isArray(v)) saida[k] = v.slice(0, 30).map((x) => String(x).slice(0, 60));
  }
  return saida;
}

/** A peça como vai para UMA rede: a legenda e o título daquela conta, se houver, ou os do post. */
export function pecaPara(post: { formato: Formato; legenda: string; titulo: string | null; midias: Midia[]; opcoes: Record<string, unknown> }, envio?: { legenda?: string | null; titulo?: string | null }): Peca {
  return {
    formato: post.formato,
    legenda: envio?.legenda ?? post.legenda,
    titulo: envio?.titulo ?? post.titulo,
    midias: post.midias,
    opcoes: post.opcoes,
  };
}

export type ProblemaDoPost = { conta: string | null; rede: RedeId | null; problema: string };

/**
 * Confere um post inteiro, do jeito que a rede vai receber. Devolve os
 * problemas (lista vazia: pode liberar). É a mesma conferência para rascunho
 * que vai ser agendado e para a fila na hora de publicar.
 */
export async function conferirPost(db: SupabaseClient, dados: DadosDoPost, contas: Conta[]): Promise<ProblemaDoPost[]> {
  const problemas: ProblemaDoPost[] = [];
  const geral = (problema: string) => problemas.push({ conta: null, rede: null, problema });

  if (!FORMATOS.includes(dados.formato)) geral("Formato desconhecido.");
  if (temTravessao(dados.legenda) || temTravessao(dados.titulo ?? "")) geral("Troque o travessão por vírgula ou ponto: a casa não usa travessão.");
  for (const m of dados.midias) {
    if (!(await ehEnderecoNosso(db, m.url))) {
      geral("Uma das mídias não está no armazenamento do painel. Envie o arquivo de novo.");
      break;
    }
  }
  if (dados.contas.length === 0) geral("Escolha pelo menos uma rede.");

  for (const id of dados.contas) {
    const conta = contas.find((c) => c.id === id);
    if (!conta) {
      problemas.push({ conta: id, rede: null, problema: "Conta que não está mais ligada." });
      continue;
    }
    const nome = `${nomeDaRede(conta.rede)}${conta.usuario ? ` ${conta.usuario}` : ""}`;
    const m = modulo(conta.rede);
    if (conta.status !== "ativa") {
      problemas.push({ conta: id, rede: conta.rede, problema: `${nome} precisa ser ligado de novo antes de publicar.` });
      continue;
    }
    if (!m?.publicar) {
      problemas.push({ conta: id, rede: conta.rede, problema: `${nome} ainda não publica pelo painel.` });
      continue;
    }
    const pede = m.recursos.publicar ?? [];
    if (pede.length && conta.escopos.length && !pede.some((e) => conta.escopos.includes(e))) {
      problemas.push({ conta: id, rede: conta.rede, problema: `${nome} foi ligado sem a permissão de publicar. Ligue de novo em Integrações com essa permissão marcada.` });
      continue;
    }
    const desta = dados.porConta?.[id];
    if (temTravessao(desta?.legenda ?? "") || temTravessao(desta?.titulo ?? "")) {
      problemas.push({ conta: id, rede: conta.rede, problema: "Troque o travessão por vírgula ou ponto: a casa não usa travessão." });
      continue;
    }
    const problema = m.validar(pecaPara({ formato: dados.formato, legenda: dados.legenda, titulo: dados.titulo ?? null, midias: dados.midias, opcoes: dados.opcoes ?? {} }, desta));
    if (problema) problemas.push({ conta: id, rede: conta.rede, problema });
  }
  return problemas;
}

/** Os problemas numa frase só, para devolver a quem pediu. */
export const emFrase = (problemas: ProblemaDoPost[]): string => [...new Set(problemas.map((p) => p.problema))].join(" ");

function normalizar(bruto: DadosDoPost): DadosDoPost {
  const porConta: DadosDoPost["porConta"] = {};
  for (const [id, v] of Object.entries(bruto.porConta ?? {})) {
    if (!/^[0-9a-f-]{36}$/.test(id) || !v) continue;
    const legenda = v.legenda === null || v.legenda === undefined || v.legenda === "" ? null : limparTexto(v.legenda, 12000);
    const titulo = v.titulo === null || v.titulo === undefined || v.titulo === "" ? null : limparTexto(v.titulo, 200);
    if (legenda !== null || titulo !== null) porConta[id] = { legenda, titulo };
  }
  return {
    titulo: limparTexto(bruto.titulo, 200).trim() || null,
    legenda: limparTexto(bruto.legenda, 12000),
    formato: bruto.formato,
    midias: lerMidias(bruto.midias),
    opcoes: lerOpcoes(bruto.opcoes),
    contas: [...new Set((bruto.contas ?? []).filter((id) => /^[0-9a-f-]{36}$/.test(String(id))))].slice(0, 12),
    porConta,
  };
}

// ------------------------------------------------------------------ escrever

/** Grava os envios de um post em rascunho: um por conta escolhida. O que saiu da escolha é apagado. */
async function gravarEnvios(db: SupabaseClient, postId: string, dados: DadosDoPost, contas: Conta[]): Promise<string | null> {
  const linhas = dados.contas
    .map((id) => contas.find((c) => c.id === id))
    .filter((c): c is Conta => Boolean(c))
    .map((c) => ({
      post_id: postId,
      conta_id: c.id,
      rede: c.rede,
      legenda: dados.porConta?.[c.id]?.legenda ?? null,
      titulo: dados.porConta?.[c.id]?.titulo ?? null,
      status: "rascunho",
      agendado_para: null,
      proxima_tentativa: null,
      tentativas: 0,
      erro: null,
      atualizado_em: new Date().toISOString(),
    }));
  const { data: atuais } = await db.from("redes_envios").select("id, conta_id, status").eq("post_id", postId);
  const fora = ((atuais ?? []) as { id: string; conta_id: string; status: string }[]).filter((e) => !dados.contas.includes(e.conta_id) && e.status !== "publicado");
  if (fora.length) {
    const { error } = await db.from("redes_envios").delete().in("id", fora.map((e) => e.id));
    if (error) return error.message;
  }
  // O que já foi publicado fica como está: editar o post não reescreve a história de um envio que saiu.
  const publicados = new Set(((atuais ?? []) as { conta_id: string; status: string }[]).filter((e) => e.status === "publicado").map((e) => e.conta_id));
  const novas = linhas.filter((l) => !publicados.has(l.conta_id));
  if (novas.length) {
    const { error } = await db.from("redes_envios").upsert(novas, { onConflict: "post_id,conta_id" });
    if (error) return error.message;
  }
  return null;
}

/** Cria um rascunho. Não confere as regras das redes: rascunho pode estar pela metade. */
export async function criarPost(db: SupabaseClient, quem: Quem, bruto: DadosDoPost): Promise<Resultado<{ id: string }>> {
  const dados = normalizar(bruto);
  if (!FORMATOS.includes(dados.formato)) return falha("Formato desconhecido.");
  const { data, error } = await db
    .from("redes_posts")
    .insert({ titulo: dados.titulo, legenda: dados.legenda, formato: dados.formato, midias: dados.midias, opcoes: dados.opcoes ?? {}, origem: quem.origem, criado_por: quem.id })
    .select("id")
    .single();
  if (error || !data) return falha(error?.message ?? "O post não foi gravado.");
  const contas = await listarContas(db);
  const erro = await gravarEnvios(db, data.id as string, dados, contas);
  if (erro) return falha(erro);
  return { ok: true, id: data.id as string };
}

const EDITAVEL = ["rascunho", "agendado", "erro", "cancelado", "parcial"];

/**
 * Salva as mudanças de um post que ainda não saiu inteiro. Editar um post
 * AGENDADO tira ele da fila: volta a rascunho e precisa ser liberado de novo,
 * porque o que foi aprovado para sair era a versão anterior.
 */
export async function salvarPost(db: SupabaseClient, id: string, bruto: DadosDoPost): Promise<Resultado> {
  const dados = normalizar(bruto);
  const { data: atual } = await db.from("redes_posts").select("status").eq("id", id).maybeSingle();
  if (!atual) return falha("Post não encontrado.");
  if (!EDITAVEL.includes(atual.status as string)) return falha(atual.status === "publicando" ? "Este post está saindo agora. Espere terminar." : "Post publicado não se edita por aqui: a mudança é feita na própria rede.");
  if (!FORMATOS.includes(dados.formato)) return falha("Formato desconhecido.");
  const { error } = await db
    .from("redes_posts")
    .update({ titulo: dados.titulo, legenda: dados.legenda, formato: dados.formato, midias: dados.midias, opcoes: dados.opcoes ?? {}, agendado_para: null, liberado_por: null, liberado_em: null, atualizado_em: new Date().toISOString() })
    .eq("id", id);
  if (error) return falha(error.message);
  const erro = await gravarEnvios(db, id, dados, await listarContas(db));
  return erro ? falha(erro) : { ok: true };
}

type LinhaDoPost = { id: string; titulo: string | null; legenda: string; formato: Formato; midias: Midia[]; opcoes: Record<string, unknown>; status: string };
type LinhaDoEnvio = { id: string; conta_id: string; rede: string; legenda: string | null; titulo: string | null; status: string };

async function lerParaLiberar(db: SupabaseClient, id: string): Promise<{ post: LinhaDoPost; envios: LinhaDoEnvio[] } | null> {
  const [{ data: post }, { data: envios }] = await Promise.all([
    db.from("redes_posts").select("id, titulo, legenda, formato, midias, opcoes, status").eq("id", id).maybeSingle(),
    db.from("redes_envios").select("id, conta_id, rede, legenda, titulo, status").eq("post_id", id),
  ]);
  if (!post) return null;
  return { post: post as LinhaDoPost, envios: (envios ?? []) as LinhaDoEnvio[] };
}

/**
 * LIBERA um post: põe na fila para sair agora ou na hora marcada. É aqui que
 * todas as regras são conferidas, e é este o ato que precisa de uma pessoa:
 * `quem` fica gravado como quem mandou publicar.
 *
 * `quando` nulo: sai agora (a fila pega em seguida). Com data: sai naquela hora.
 */
export async function liberarPost(db: SupabaseClient, quem: Quem, id: string, quando: Date | null): Promise<Resultado<{ quando: string; contas: string[] }>> {
  const lido = await lerParaLiberar(db, id);
  if (!lido) return falha("Post não encontrado.");
  const { post, envios } = lido;
  if (!EDITAVEL.includes(post.status)) return falha(post.status === "publicando" ? "Este post já está saindo." : "Este post já foi publicado.");

  const pendentes = envios.filter((e) => e.status !== "publicado");
  if (pendentes.length === 0) return falha("Escolha pelo menos uma rede.");

  const agora = Date.now();
  if (quando) {
    if (!Number.isFinite(quando.getTime())) return falha("Data inválida.");
    if (quando.getTime() < agora - 60_000) return falha("A hora marcada já passou.");
    if (quando.getTime() > agora + DIAS_PARA_FRENTE * 86_400_000) return falha(`Dá para agendar até ${DIAS_PARA_FRENTE} dias para frente.`);
  }

  const contas = await listarContas(db);
  const dados: DadosDoPost = {
    titulo: post.titulo,
    legenda: post.legenda,
    formato: post.formato,
    midias: lerMidias(post.midias),
    opcoes: post.opcoes ?? {},
    contas: pendentes.map((e) => e.conta_id),
    porConta: Object.fromEntries(pendentes.map((e) => [e.conta_id, { legenda: e.legenda, titulo: e.titulo }])),
  };
  const problemas = await conferirPost(db, dados, contas);
  if (problemas.length) return falha(emFrase(problemas));

  const hora = (quando ?? new Date(agora)).toISOString();
  const { error } = await db
    .from("redes_envios")
    .update({ status: "agendado", agendado_para: hora, proxima_tentativa: null, tentativas: 0, erro: null, avisos: [], pego_em: null, processando_desde: null, atualizado_em: new Date().toISOString() })
    .in("id", pendentes.map((e) => e.id));
  if (error) return falha(error.message);
  await db.from("redes_envios_andamento").delete().in("envio_id", pendentes.map((e) => e.id));
  await db.from("redes_posts").update({ agendado_para: hora, liberado_por: quem.id, liberado_em: new Date().toISOString(), atualizado_em: new Date().toISOString() }).eq("id", id);

  const nomes = pendentes.map((e) => {
    const c = contas.find((x) => x.id === e.conta_id);
    return `${nomeDaRede(e.rede)}${c?.usuario ? ` ${c.usuario}` : ""}`;
  });
  return { ok: true, quando: hora, contas: nomes };
}

/** Tira o post da fila. O que já saiu fica; o que estava marcado para sair é cancelado. */
export async function cancelarPost(db: SupabaseClient, id: string): Promise<Resultado<{ cancelados: number }>> {
  const { data, error } = await db
    .from("redes_envios")
    .update({ status: "cancelado", proxima_tentativa: null, pego_em: null, atualizado_em: new Date().toISOString() })
    .eq("post_id", id)
    .in("status", ["agendado", "processando", "erro"])
    .select("id");
  if (error) return falha(error.message);
  if (!data?.length) return falha("Não havia nada marcado para sair neste post.");
  await db.from("redes_envios_andamento").delete().in("envio_id", data.map((e) => e.id as string));
  await db.from("redes_posts").update({ agendado_para: null, atualizado_em: new Date().toISOString() }).eq("id", id);
  return { ok: true, cancelados: data.length };
}

/**
 * Apaga um post que NUNCA saiu (rascunho, cancelado ou com erro em tudo), com
 * as mídias dele. Post que tem algum envio publicado não se apaga: é registro
 * do que foi para a rua.
 */
export async function apagarPost(db: SupabaseClient, id: string): Promise<Resultado> {
  const lido = await lerParaLiberar(db, id);
  if (!lido) return falha("Post não encontrado.");
  if (lido.envios.some((e) => e.status === "publicado" || e.status === "publicando" || e.status === "processando")) {
    return falha("Este post já saiu (ou está saindo) em alguma rede. Ele fica como registro.");
  }
  const { error } = await db.from("redes_posts").delete().eq("id", id);
  if (error) return falha(error.message);
  await apagarMidias(db, lerMidias(lido.post.midias));
  return { ok: true };
}

// ------------------------------------------------------------------ ler

export type EnvioNaTela = {
  id: string;
  contaId: string;
  rede: RedeId;
  conta: string;
  status: string;
  agendadoPara: string | null;
  proximaTentativa: string | null;
  url: string | null;
  erro: string | null;
  avisos: string[];
  publicadoEm: string | null;
  legenda: string | null;
  titulo: string | null;
};

export type PostNaTela = {
  id: string;
  titulo: string | null;
  legenda: string;
  formato: Formato;
  midias: Midia[];
  opcoes: Record<string, unknown>;
  status: string;
  agendadoPara: string | null;
  publicadoEm: string | null;
  origem: "painel" | "conector";
  criadoPor: string | null;
  liberadoPor: string | null;
  criadoEm: string;
  envios: EnvioNaTela[];
};

type PostCru = {
  id: string; titulo: string | null; legenda: string; formato: string; midias: unknown; opcoes: Record<string, unknown> | null; status: string;
  agendado_para: string | null; publicado_em: string | null; origem: string; criado_por: string | null; liberado_por: string | null; criado_em: string;
  redes_envios: { id: string; conta_id: string; rede: string; status: string; agendado_para: string | null; proxima_tentativa: string | null; url_publicada: string | null; erro: string | null; avisos: string[] | null; publicado_em: string | null; legenda: string | null; titulo: string | null; redes_contas: { nome: string | null; usuario: string | null } | null }[];
};

const SELECAO =
  "id, titulo, legenda, formato, midias, opcoes, status, agendado_para, publicado_em, origem, criado_por, liberado_por, criado_em, redes_envios(id, conta_id, rede, status, agendado_para, proxima_tentativa, url_publicada, erro, avisos, publicado_em, legenda, titulo, redes_contas(nome, usuario))";

function postNaTela(p: PostCru, nomes: Map<string, string>): PostNaTela {
  return {
    id: p.id,
    titulo: p.titulo,
    legenda: p.legenda,
    formato: p.formato as Formato,
    midias: lerMidias(p.midias),
    opcoes: p.opcoes ?? {},
    status: p.status,
    agendadoPara: p.agendado_para,
    publicadoEm: p.publicado_em,
    origem: p.origem === "conector" ? "conector" : "painel",
    criadoPor: p.criado_por ? nomes.get(p.criado_por) ?? null : null,
    liberadoPor: p.liberado_por ? nomes.get(p.liberado_por) ?? null : null,
    criadoEm: p.criado_em,
    envios: (p.redes_envios ?? []).map((e) => ({
      id: e.id,
      contaId: e.conta_id,
      rede: e.rede as RedeId,
      conta: e.redes_contas?.usuario || e.redes_contas?.nome || nomeDaRede(e.rede),
      status: e.status,
      agendadoPara: e.agendado_para,
      proximaTentativa: e.proxima_tentativa,
      url: e.url_publicada,
      erro: e.erro,
      avisos: e.avisos ?? [],
      publicadoEm: e.publicado_em,
      legenda: e.legenda,
      titulo: e.titulo,
    })),
  };
}

/** O nome de quem criou e de quem liberou. `profiles` não é de leitura de todo nível: por isso a chave de serviço. */
async function nomesDe(admin: SupabaseClient, ids: (string | null)[]): Promise<Map<string, string>> {
  const unicos = [...new Set(ids.filter((x): x is string => Boolean(x)))];
  if (!unicos.length) return new Map();
  const { data } = await admin.from("profiles").select("id, full_name, email").in("id", unicos);
  return new Map(((data ?? []) as { id: string; full_name: string | null; email: string | null }[]).map((p) => [p.id, p.full_name || (p.email ?? "").split("@")[0] || "alguém"]));
}

export type FiltroDePosts = "fila" | "rascunhos" | "publicados" | "erros";

const ESTADOS: Record<FiltroDePosts, string[]> = {
  fila: ["agendado", "publicando"],
  rascunhos: ["rascunho", "cancelado"],
  publicados: ["publicado", "parcial"],
  erros: ["erro", "parcial"],
};

/** A lista de posts de uma aba. Quem chama já conferiu a área; a leitura usa a chave de serviço para trazer o nome de quem fez. */
export async function listarPosts(admin: SupabaseClient, filtro: FiltroDePosts, limite = 60): Promise<PostNaTela[]> {
  let q = admin.from("redes_posts").select(SELECAO).in("status", ESTADOS[filtro]).limit(limite);
  q = filtro === "fila" ? q.order("agendado_para", { ascending: true, nullsFirst: false }) : filtro === "publicados" ? q.order("publicado_em", { ascending: false, nullsFirst: false }) : q.order("atualizado_em", { ascending: false });
  const { data, error } = await q;
  if (error) {
    console.error("[redes] listarPosts:", error.message);
    return [];
  }
  const posts = (data ?? []) as unknown as PostCru[];
  const nomes = await nomesDe(admin, posts.flatMap((p) => [p.criado_por, p.liberado_por]));
  return posts.map((p) => postNaTela(p, nomes));
}

export async function lerPost(admin: SupabaseClient, id: string): Promise<PostNaTela | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const { data } = await admin.from("redes_posts").select(SELECAO).eq("id", id).maybeSingle();
  if (!data) return null;
  const p = data as unknown as PostCru;
  return postNaTela(p, await nomesDe(admin, [p.criado_por, p.liberado_por]));
}

/**
 * Quantos posts há em cada aba. Os publicados não são contados: a lista só
 * cresce, e o número não ajuda ninguém a decidir nada.
 */
export async function contarPosts(admin: SupabaseClient): Promise<Record<Exclude<FiltroDePosts, "publicados">, number>> {
  const contar = async (estados: string[]) => {
    const { count } = await admin.from("redes_posts").select("id", { count: "exact", head: true }).in("status", estados);
    return count ?? 0;
  };
  const [fila, rascunhos, erros] = await Promise.all([contar(ESTADOS.fila), contar(ESTADOS.rascunhos), contar(ESTADOS.erros)]);
  return { fila, rascunhos, erros };
}
