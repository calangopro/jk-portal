import "server-only";
import { validarPeca } from "../regras";
import { ErroDaRede, type Credenciais, type ModuloDaRede, type NumerosDoDia, type PassoDaPublicacao } from "../tipos";
import { contasDoToken, enviar, esperar, GRAPH, ler, listar } from "./meta";
import { comentariosDaPagina, metricasDoPost, postsDaPagina, seriePorDia } from "./meta-forma";

/**
 * Página do Facebook, pela Graph API, com o token da Página. Como liga e por
 * quê: ver `meta.ts`.
 *
 * O que a documentação dizia em 16/11/2026:
 *   - as métricas antigas (`page_impressions*`, `post_impressions*`,
 *     `page_fans*` e os `*_unique`) acabaram; valem `page_media_view`,
 *     `page_total_media_view_unique`, `page_follows` e os equivalentes de post.
 *     A Página precisa de 100 curtidas para ter métricas;
 *   - Reels da Página é um envio em três passos (`video_reels`), de 3 a 90
 *     segundos; story é `photo_stories` ou `video_stories`;
 *   - a Página até agenda sozinha (`scheduled_publish_time`), mas aqui quem
 *     agenda é a fila do painel, como em todas as redes: um lugar só para ver,
 *     mudar e cancelar o que está marcado.
 *
 * Portado de `worker/plataformas/facebook.js` do auto-agenciasetup.
 */

type Cred = { token: string; pagina: string };
const cred = (c: Credenciais) => c as unknown as Cred;
const ONDE = "O Facebook";
const str = (v: unknown) => (typeof v === "string" ? v : "");

/** Vídeo hospedado: o Facebook busca o arquivo no endereço que vai no cabeçalho `file_url`. */
async function mandarBuscar(token: string, enderecoDeEnvio: string, arquivo: string): Promise<void> {
  const r = await fetch(enderecoDeEnvio, { method: "POST", headers: { authorization: `OAuth ${token}`, file_url: arquivo }, cache: "no-store", signal: AbortSignal.timeout(45_000) });
  const t = await r.text();
  let d: { success?: boolean; error?: { message?: string } } = {};
  try {
    d = JSON.parse(t);
  } catch {
    /* corpo que não é JSON conta como falha abaixo */
  }
  if (!r.ok || d.error || d.success === false) {
    throw new ErroDaRede(`O Facebook não recebeu o vídeo: ${String(d.error?.message || `HTTP ${r.status}`).slice(0, 180)}`, { definitivo: r.status >= 400 && r.status < 500 });
  }
}

export const facebook: ModuloDaRede = {
  id: "facebook",
  provedorDoAplicativo: null,
  // A Página aceita até 90 dias por consulta. Ficam 60, com folga, que já comparam 28.
  historico: 60,
  recursos: {
    metricas: ["read_insights"],
    publicar: ["pages_manage_posts"],
    comentarios: ["pages_read_user_content", "pages_manage_engagement"],
    mensagens: ["pages_messaging"],
  },

  validar: (peca) => validarPeca("facebook", peca),

  conectarComToken: ({ token }) => contasDoToken(token),

  // ---------------------------------------------------------------- ler

  async lerConta({ credenciais }) {
    const c = cred(credenciais);
    const d = await ler(c.token, c.pagina, { fields: "name,username,followers_count,fan_count,picture{url}" }, ONDE);
    const foto = str(((d.picture as { data?: { url?: string } } | undefined)?.data?.url));
    return {
      seguidores: typeof d.followers_count === "number" ? d.followers_count : typeof d.fan_count === "number" ? d.fan_count : null,
      publicacoes: null,
      nome: str(d.name) || null,
      usuario: str(d.username) ? `@${str(d.username)}` : null,
      fotoUrl: foto || null,
    };
  },

  /** Os números por dia da Página. Cada métrica é pedida sozinha: uma que a Página não tem não derruba as outras. */
  async lerDias({ credenciais, conta, de, ate }) {
    if (!conta.escopos.includes("read_insights") && conta.escopos.length > 0) return [];
    const c = cred(credenciais);
    // `until` é exclusivo, e a API pede no máximo 90 dias por consulta.
    const fim = new Date(`${ate}T12:00:00Z`);
    fim.setUTCDate(fim.getUTCDate() + 1);
    const pedir = async (metrica: string) => {
      try {
        return seriePorDia(await ler(c.token, `${c.pagina}/insights`, { metric: metrica, period: "day", since: de, until: fim.toISOString().slice(0, 10) }, ONDE));
      } catch (e) {
        if (e instanceof ErroDaRede && (e.tokenMorto || e.parar)) throw e;
        return {};
      }
    };
    const [vistas, pessoas, engajamento, novos, visitas] = await Promise.all([
      pedir("page_media_view"),
      pedir("page_total_media_view_unique"),
      pedir("page_post_engagements"),
      pedir("page_daily_follows"),
      pedir("page_views_total"),
    ]);
    const dias = new Set([...Object.keys(vistas), ...Object.keys(pessoas), ...Object.keys(engajamento), ...Object.keys(novos), ...Object.keys(visitas)]);
    return [...dias].sort().map((dia): NumerosDoDia => {
      const linha: NumerosDoDia = { dia };
      // Só entra o que a Página informou: métrica ausente não vira zero.
      if (vistas[dia]) linha.visualizacoes = vistas[dia].page_media_view ?? null;
      if (pessoas[dia]) linha.alcance = pessoas[dia].page_total_media_view_unique ?? null;
      if (engajamento[dia]) linha.interacoes = engajamento[dia].page_post_engagements ?? null;
      if (novos[dia]) linha.novosSeguidores = novos[dia].page_daily_follows ?? null;
      if (visitas[dia]) linha.visitasAoPerfil = visitas[dia].page_views_total ?? null;
      return linha;
    });
  },

  async lerPublicacoes({ credenciais, limite, depois }) {
    const c = cred(credenciais);
    const d = await ler(
      c.token,
      `${c.pagina}/published_posts`,
      {
        fields: "id,message,created_time,permalink_url,full_picture,attachments{media_type,type},shares,reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0)",
        limit: String(Math.min(100, limite)),
        ...(depois ? { after: depois } : {}),
      },
      ONDE,
    );
    const paginacao = (d.paging ?? {}) as { next?: string; cursors?: { after?: string } };
    return { itens: postsDaPagina(d), depois: paginacao.next ? paginacao.cursors?.after ?? null : null };
  },

  async lerMetricas({ credenciais, publicacao }) {
    const c = cred(credenciais);
    const r = await ler(c.token, `${publicacao.idNaRede}/insights`, { metric: "post_media_view,post_total_media_view_unique" }, ONDE);
    return metricasDoPost(r);
  },

  async lerComentarios({ credenciais, conta, publicacaoIdNaRede, desde }) {
    const c = cred(credenciais);
    const itens = await listar(
      c.token,
      `${publicacaoIdNaRede}/comments`,
      { fields: "id,message,from{id,name},created_time,like_count,parent{id}", filter: "stream", order: "reverse_chronological", limit: "50" },
      ONDE,
      2,
    );
    return comentariosDaPagina({ data: itens }, conta.contaId).filter((x) => !x.quando || Date.parse(x.quando) > desde);
  },

  // ---------------------------------------------------------------- escrever

  async responderComentario({ credenciais, comentarioIdNaRede, texto }) {
    const d = await enviar(cred(credenciais).token, `${comentarioIdNaRede}/comments`, { message: texto }, ONDE);
    return { idNaRede: str(d.id) || null };
  },

  async ocultarComentario({ credenciais, comentarioIdNaRede, ocultar }) {
    await enviar(cred(credenciais).token, comentarioIdNaRede, { is_hidden: ocultar ? "true" : "false" }, ONDE);
  },

  async publicar({ credenciais, peca, andamento }): Promise<PassoDaPublicacao> {
    const c = cred(credenciais);
    const legenda = peca.legenda ?? "";
    const imagens = peca.midias.filter((m) => m.tipo === "imagem");
    const video = peca.midias.find((m) => m.tipo === "video");
    const op = peca.opcoes ?? {};
    const endereco = async (id: string): Promise<string | null> => {
      try {
        return str((await ler(c.token, id, { fields: "permalink_url" }, ONDE)).permalink_url) || null;
      } catch {
        return null;
      }
    };
    const pronto = async (id: string | null, avisos: string[] = []): Promise<PassoDaPublicacao> => ({ estado: "publicado", idNaRede: id, url: id ? await endereco(id) : null, avisos });

    // Vídeo já enviado numa rodada anterior: só confere se o Facebook terminou de preparar.
    if (typeof andamento?.video === "string") {
      const d = await ler(c.token, andamento.video, { fields: "status,permalink_url" }, ONDE);
      const estado = str(((d.status as { video_status?: string } | undefined)?.video_status));
      if (estado === "error") throw new ErroDaRede("O Facebook não conseguiu preparar o vídeo. Confira o formato do arquivo.", { definitivo: true });
      if (estado && estado !== "ready") return { estado: "processando", andamento: { video: andamento.video }, emSegundos: 45 };
      const link = str(d.permalink_url);
      return { estado: "publicado", idNaRede: andamento.video, url: link ? (link.startsWith("http") ? link : `https://www.facebook.com${link}`) : null };
    }

    if (peca.formato === "texto") {
      const link = typeof op.link === "string" && /^https:\/\//.test(op.link) ? op.link : null;
      const d = await enviar(c.token, `${c.pagina}/feed`, link ? { message: legenda, link } : { message: legenda }, ONDE);
      return pronto(str(d.id) || null);
    }

    if (peca.formato === "post") {
      if (!imagens[0]) throw new ErroDaRede("Post precisa de uma imagem.", { definitivo: true });
      const d = await enviar(c.token, `${c.pagina}/photos`, { url: imagens[0].url, caption: legenda, published: "true", ...(imagens[0].alt ? { alt_text_custom: imagens[0].alt.slice(0, 1000) } : {}) }, ONDE);
      return pronto(str(d.post_id) || str(d.id) || null);
    }

    if (peca.formato === "carrossel") {
      // Álbum: as fotos sobem sem publicar e entram juntas num post só. O que já subiu numa rodada anterior vale.
      const fotos = Array.isArray(andamento?.fotos) ? (andamento.fotos as unknown[]).map(String) : [];
      for (const m of imagens.slice(fotos.length)) {
        const d = await enviar(c.token, `${c.pagina}/photos`, { url: m.url, published: "false", ...(m.alt ? { alt_text_custom: m.alt.slice(0, 1000) } : {}) }, ONDE);
        fotos.push(str(d.id));
      }
      const dados: Record<string, string> = { message: legenda };
      fotos.forEach((f, i) => (dados[`attached_media[${i}]`] = JSON.stringify({ media_fbid: f })));
      const d = await enviar(c.token, `${c.pagina}/feed`, dados, ONDE);
      return pronto(str(d.id) || null);
    }

    if (peca.formato === "story") {
      const m = peca.midias[0];
      if (!m) throw new ErroDaRede("Story precisa de uma imagem ou de um vídeo.", { definitivo: true });
      if (m.tipo === "imagem") {
        const foto = await enviar(c.token, `${c.pagina}/photos`, { url: m.url, published: "false" }, ONDE);
        const d = await enviar(c.token, `${c.pagina}/photo_stories`, { photo_id: str(foto.id) }, ONDE);
        return pronto(str(d.post_id) || null);
      }
      const inicio = await enviar(c.token, `${c.pagina}/video_stories`, { upload_phase: "start" }, ONDE);
      await mandarBuscar(c.token, str(inicio.upload_url), m.url);
      const fim = await enviar(c.token, `${c.pagina}/video_stories`, { upload_phase: "finish", video_id: str(inicio.video_id) }, ONDE, 45_000);
      return pronto(str(fim.post_id) || null);
    }

    if (!video) throw new ErroDaRede("Vídeo precisa de um arquivo de vídeo.", { definitivo: true });

    if (peca.formato === "video_curto") {
      const inicio = await enviar(c.token, `${c.pagina}/video_reels`, { upload_phase: "start" }, ONDE);
      const videoId = str(inicio.video_id);
      await mandarBuscar(c.token, str(inicio.upload_url) || `https://rupload.facebook.com/video-upload/${GRAPH.split("/").pop()}/${videoId}`, video.url);
      await enviar(c.token, `${c.pagina}/video_reels`, { upload_phase: "finish", video_id: videoId, video_state: "PUBLISHED", description: legenda }, ONDE, 45_000);
      // O Reels sai quando o Facebook termina de preparar: a rodada seguinte confere e pega o endereço.
      await esperar(3000);
      return { estado: "processando", andamento: { video: videoId }, emSegundos: 45 };
    }

    if (peca.formato === "video") {
      const d = await enviar(c.token, `${c.pagina}/videos`, { file_url: video.url, description: legenda, ...(peca.titulo ? { title: peca.titulo.slice(0, 250) } : {}) }, ONDE, 50_000);
      const id = str(d.id);
      return id ? { estado: "processando", andamento: { video: id }, emSegundos: 45 } : pronto(null);
    }

    throw new ErroDaRede(`O Facebook não publica o formato ${peca.formato}.`, { definitivo: true });
  },
};
