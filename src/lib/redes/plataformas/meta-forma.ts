/**
 * A forma das respostas da Graph API da Meta, virada no que o painel guarda.
 *
 * Só leitura de JSON: nada aqui chama a rede. Fica separado de `meta.ts` para
 * o teste rodar sem servidor (`scripts/teste-redes.mts`), com respostas no
 * formato que a documentação descreve.
 *
 * O que a documentação dizia em 16/11/2026, Graph API v27.0:
 *   - Instagram: `impressions` e `plays` acabaram em 2025; o que existe é
 *     `views`. No nível de conta só `reach` vem em série; o resto vem como
 *     total (`total_value`) do intervalo pedido.
 *   - Página: `page_impressions*`, `post_impressions*` e `page_fans*` caíram em
 *     15/11/2025, e os `*_unique` em 2026. Valem `page_media_view`,
 *     `page_total_media_view_unique`, `page_follows` e os equivalentes de post.
 */
import type { Formato } from "../redes.ts";
import type { ComentarioLido, MetricasDaPublicacao, PublicacaoLida } from "../tipos.ts";

type Json = Record<string, unknown>;

const numero = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v !== "" && Number.isFinite(Number(v)) ? Number(v) : null);
const texto = (v: unknown): string => (typeof v === "string" ? v : "");
const lista = (v: unknown): Json[] => (Array.isArray(v) ? (v as Json[]) : []);
const objeto = (v: unknown): Json => (v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : {});

// ------------------------------------------------------------------ permissões

/**
 * As permissões que um token tem, de `GET /me/permissions` (lista com
 * `status: granted`) ou de `GET /debug_token` (lista simples em `scopes`).
 */
export function permissoesDoToken(resposta: unknown): string[] {
  const r = objeto(resposta);
  const dados = r.data;
  if (Array.isArray(dados)) {
    return (dados as Json[]).filter((p) => p.status === "granted").map((p) => texto(p.permission)).filter(Boolean);
  }
  const escopos = objeto(dados).scopes;
  return Array.isArray(escopos) ? (escopos as unknown[]).map((e) => texto(e)).filter(Boolean) : [];
}

// ------------------------------------------------------------------ insights

/**
 * Lê uma resposta de `/insights` e devolve o valor de cada métrica.
 *
 * A Meta devolve de três jeitos, conforme a métrica e o `metric_type`:
 *   - `total_value: { value }` (total do intervalo);
 *   - `values: [{ value, end_time }]` (série; aqui vale o ÚLTIMO, ou a soma, conforme `somar`);
 *   - `values: [{ value: { chave: n } }]` (quebra por tipo; some os números).
 */
export function valoresDosInsights(resposta: unknown, somar = false): Record<string, number | null> {
  const saida: Record<string, number | null> = {};
  for (const m of lista(objeto(resposta).data)) {
    const nome = texto(m.name);
    if (!nome) continue;
    const total = objeto(m.total_value).value;
    if (total !== undefined) {
      saida[nome] = numeroOuSoma(total);
      continue;
    }
    const valores = lista(m.values).map((v) => numeroOuSoma(v.value));
    if (!valores.length) {
      saida[nome] = null;
      continue;
    }
    saida[nome] = somar ? valores.reduce<number | null>((t, v) => (v === null ? t : (t ?? 0) + v), null) : valores[valores.length - 1];
  }
  return saida;
}

function numeroOuSoma(v: unknown): number | null {
  const n = numero(v);
  if (n !== null) return n;
  if (v && typeof v === "object") {
    let total: number | null = null;
    for (const x of Object.values(v as Json)) {
      const k = numero(x);
      if (k !== null) total = (total ?? 0) + k;
    }
    return total;
  }
  return null;
}

/**
 * Uma série por dia de `/insights` com `period=day` (Página, e `reach` do
 * Instagram). `end_time` é o FIM do dia medido, à meia-noite do Pacífico: o
 * dia a que o valor pertence é o anterior a `end_time` naquele fuso. Devolve
 * `{ "AAAA-MM-DD": { metrica: valor } }`.
 */
export function seriePorDia(resposta: unknown): Record<string, Record<string, number | null>> {
  const saida: Record<string, Record<string, number | null>> = {};
  for (const m of lista(objeto(resposta).data)) {
    const nome = texto(m.name);
    for (const v of lista(m.values)) {
      const fim = Date.parse(texto(v.end_time));
      if (!nome || !Number.isFinite(fim)) continue;
      // Um segundo antes do fim cai dentro do dia medido, em qualquer fuso de até 23 horas de diferença.
      const dia = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(fim - 1000));
      (saida[dia] ??= {})[nome] = numeroOuSoma(v.value);
    }
  }
  return saida;
}

// ------------------------------------------------------------------ Instagram

/** O formato de uma mídia do Instagram, na língua do painel. */
export function formatoDaMidia(m: Json): Formato | "outro" {
  const produto = texto(m.media_product_type);
  const tipo = texto(m.media_type);
  if (produto === "STORY") return "story";
  if (produto === "REELS") return "video_curto";
  if (tipo === "CAROUSEL_ALBUM") return "carrossel";
  if (tipo === "VIDEO") return "video";
  if (tipo === "IMAGE") return "post";
  return "outro";
}

/** Uma página de `/{ig-user}/media` (ou de `/stories`). Desde julho de 2026 `media_url` pode faltar em vídeo: a miniatura cobre. */
export function midiasDoInstagram(resposta: unknown): PublicacaoLida[] {
  return lista(objeto(resposta).data)
    .filter((m) => texto(m.id))
    .map((m) => ({
      idNaRede: texto(m.id),
      formato: formatoDaMidia(m),
      legenda: texto(m.caption),
      link: texto(m.permalink) || null,
      miniaturaUrl: texto(m.thumbnail_url) || (texto(m.media_type) !== "VIDEO" ? texto(m.media_url) : "") || null,
      publicadoEm: texto(m.timestamp) ? new Date(texto(m.timestamp)).toISOString() : null,
      curtidas: numero(m.like_count),
      comentarios: numero(m.comments_count),
    }));
}

/** As métricas que o painel pede de uma mídia, conforme o formato. Story tem lista própria e some em 24 horas. */
export function metricasPedidasDaMidia(formato: string | null): string[] {
  if (formato === "story") return ["views", "reach", "replies", "shares", "total_interactions"];
  return ["views", "reach", "saved", "shares", "total_interactions"];
}

export function metricasDaMidia(resposta: unknown): MetricasDaPublicacao {
  const v = valoresDosInsights(resposta);
  const extra: Record<string, unknown> = {};
  if (v.total_interactions !== undefined && v.total_interactions !== null) extra.interacoes = v.total_interactions;
  if (v.replies !== undefined && v.replies !== null) extra.respostas = v.replies;
  return { alcance: v.reach ?? null, visualizacoes: v.views ?? null, salvos: v.saved ?? null, compartilhamentos: v.shares ?? null, extra };
}

/**
 * Comentários de uma mídia do Instagram, com as respostas que vierem junto.
 * `from` traz só o id com escopo e o @: o Instagram não entrega nome completo.
 */
export function comentariosDoInstagram(resposta: unknown, contaId: string): ComentarioLido[] {
  const saida: ComentarioLido[] = [];
  const um = (c: Json, pai: string | null) => {
    const de = objeto(c.from);
    const id = texto(c.id);
    if (!id) return;
    saida.push({
      idNaRede: id,
      paiIdNaRede: pai,
      texto: texto(c.text),
      autor: texto(c.username) || texto(de.username),
      autorId: texto(de.id) || null,
      quando: texto(c.timestamp) ? new Date(texto(c.timestamp)).toISOString() : null,
      nosso: Boolean(contaId) && texto(de.id) === contaId,
      curtidas: numero(c.like_count),
    });
  };
  for (const c of lista(objeto(resposta).data)) {
    um(c, null);
    for (const r of lista(objeto(c.replies).data)) um(r, texto(c.id));
  }
  return saida;
}

// ------------------------------------------------------------------ Página do Facebook

function formatoDoPost(p: Json): Formato | "outro" {
  const anexo = lista(objeto(p.attachments).data)[0] ?? {};
  const tipo = texto(anexo.media_type) || texto(anexo.type);
  if (tipo === "album") return "carrossel";
  if (/video/.test(tipo)) return "video";
  if (tipo === "photo") return "post";
  return texto(p.message) ? "texto" : "outro";
}

/** Uma página de `/{page}/published_posts`. */
export function postsDaPagina(resposta: unknown): PublicacaoLida[] {
  return lista(objeto(resposta).data)
    .filter((p) => texto(p.id))
    .map((p) => ({
      idNaRede: texto(p.id),
      formato: formatoDoPost(p),
      legenda: texto(p.message),
      link: texto(p.permalink_url) || null,
      miniaturaUrl: texto(p.full_picture) || null,
      publicadoEm: texto(p.created_time) ? new Date(texto(p.created_time)).toISOString() : null,
      curtidas: numero(objeto(objeto(p.reactions).summary).total_count),
      comentarios: numero(objeto(objeto(p.comments).summary).total_count),
      compartilhamentos: numero(objeto(p.shares).count) ?? 0,
    }));
}

export function metricasDoPost(resposta: unknown): MetricasDaPublicacao {
  const v = valoresDosInsights(resposta);
  return { alcance: v.post_total_media_view_unique ?? null, visualizacoes: v.post_media_view ?? null, salvos: null, compartilhamentos: null };
}

/** Comentários de um post da Página (`filter=stream` traz as respostas na mesma lista, com `parent`). */
export function comentariosDaPagina(resposta: unknown, paginaId: string): ComentarioLido[] {
  return lista(objeto(resposta).data)
    .filter((c) => texto(c.id))
    .map((c) => {
      const de = objeto(c.from);
      return {
        idNaRede: texto(c.id),
        paiIdNaRede: texto(objeto(c.parent).id) || null,
        texto: texto(c.message),
        // Comentário de quem não liberou o nome para a Página vem sem `from`.
        autor: texto(de.name),
        autorId: texto(de.id) || null,
        quando: texto(c.created_time) ? new Date(texto(c.created_time)).toISOString() : null,
        nosso: Boolean(paginaId) && texto(de.id) === paginaId,
        curtidas: numero(c.like_count),
      };
    });
}

// ------------------------------------------------------------------ erro

export type ErroLido = { mensagem: string; codigo: number | null; subcodigo: number | null; tokenMorto: boolean; parar: boolean; definitivo: boolean };

/**
 * O erro da Graph API, classificado. Os códigos são os da documentação:
 * 190 e 102 (token vencido ou retirado), 4, 17, 32, 613 e a família 8000x
 * (limite de uso), 10 e 200 a 299 (permissão), 100 (parâmetro), 368 (bloqueio
 * temporário por comportamento).
 */
export function erroDaMeta(corpo: unknown, status: number, onde: string): ErroLido {
  const e = objeto(objeto(corpo).error);
  const codigo = numero(e.code);
  const subcodigo = numero(e.error_subcode);
  const original = texto(e.error_user_msg) || texto(e.message) || `HTTP ${status}`;
  const tokenMorto = codigo === 190 || codigo === 102;
  const limite = codigo === 4 || codigo === 17 || codigo === 32 || codigo === 613 || codigo === 368 || (codigo !== null && codigo >= 80000 && codigo <= 80014);
  const permissao = codigo === 10 || codigo === 3 || (codigo !== null && codigo >= 200 && codigo <= 299);
  let mensagem: string;
  if (tokenMorto) mensagem = `${onde} recusou o token: ele venceu ou foi retirado. Gere outro no usuário do sistema e cole em Integrações.`;
  else if (limite) mensagem = `${onde} limitou as chamadas agora. A próxima rodada tenta de novo.`;
  else if (permissao) mensagem = `${onde} diz que falta permissão para isto: ${original.slice(0, 160)}`;
  else mensagem = `${onde} recusou: ${original.slice(0, 200)}`;
  return {
    mensagem,
    codigo,
    subcodigo,
    tokenMorto,
    parar: limite,
    // Erro 5xx e limite de uso passam sozinhos. Parâmetro errado e permissão que falta, não.
    definitivo: tokenMorto || permissao || (status >= 400 && status < 500 && !limite && status !== 408 && status !== 429),
  };
}
