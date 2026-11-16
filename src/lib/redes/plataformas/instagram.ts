import "server-only";
import { validarPeca } from "../regras";
import { ErroDaRede, type Credenciais, type Midia, type ModuloDaRede, type NumerosDoDia, type PassoDaPublicacao, type Peca } from "../tipos";
import { contasDoToken, enviar, esperar, ler, listar, PERMISSOES_DA_META } from "./meta";
import { comentariosDoInstagram, metricasDaMidia, metricasPedidasDaMidia, midiasDoInstagram, valoresDosInsights } from "./meta-forma";

/**
 * Instagram profissional, pela Graph API (graph.facebook.com), com o token da
 * Página a que a conta está ligada. Como liga e por quê: ver `meta.ts`.
 *
 * O que a documentação dizia em 16/11/2026:
 *   - publica imagem (só JPEG), carrossel de até 20, Reels e story; não agenda
 *     (quem agenda é a fila do painel) e não põe figurinha de link em story;
 *   - vídeo é assíncrono: cria-se um contêiner, o Instagram baixa e prepara, e
 *     só então se publica. Por isso `publicar` anda em passos;
 *   - métrica de story some em 24 horas, e abaixo de 5 visualizações a API
 *     responde erro em vez de número;
 *   - comentário vem com o @ de quem escreveu e um id, sem nome completo.
 *
 * Portado de `worker/plataformas/instagram.js` do auto-agenciasetup, trocando
 * graph.instagram.com por graph.facebook.com e a espera de 90 segundos por
 * passos que a fila retoma.
 */

type Cred = { token: string; usuario: string; pagina?: string };
const cred = (c: Credenciais) => c as unknown as Cred;
const ONDE = "O Instagram";

const str = (v: unknown) => (typeof v === "string" ? v : "");

/** O estado de um contêiner: FINISHED, IN_PROGRESS, ERROR, EXPIRED ou PUBLISHED. */
async function estadoDoConteiner(c: Cred, id: string): Promise<{ codigo: string; detalhe: string }> {
  const d = await ler(c.token, id, { fields: "status_code,status" }, ONDE);
  return { codigo: str(d.status_code), detalhe: str(d.status) };
}

/** Espera o contêiner ficar pronto por alguns segundos. Devolve se ficou. Erro de preparo vira erro definitivo. */
async function ficouPronto(c: Cred, id: string, ateMs: number): Promise<"pronto" | "preparando" | "publicado"> {
  const fim = Date.now() + ateMs;
  for (;;) {
    const e = await estadoDoConteiner(c, id);
    if (e.codigo === "FINISHED") return "pronto";
    if (e.codigo === "PUBLISHED") return "publicado";
    if (e.codigo === "ERROR" || e.codigo === "EXPIRED") {
      throw new ErroDaRede(`O Instagram não conseguiu preparar a mídia${e.detalhe ? ` (${e.detalhe.slice(0, 140)})` : ""}. Confira o formato do arquivo.`, { definitivo: true });
    }
    if (Date.now() + 4000 > fim) return "preparando";
    await esperar(4000);
  }
}

/** O que o Instagram aceita além da legenda. Colaboradores: até 3. */
function extras(op: Record<string, unknown>): Record<string, string> {
  const e: Record<string, string> = {};
  const colaboradores = (Array.isArray(op.colaboradores) ? op.colaboradores : [])
    .map((u) => String(u).trim().replace(/^@/, ""))
    .filter((u) => /^[\w.]{1,30}$/.test(u))
    .slice(0, 3);
  if (colaboradores.length) e.collaborators = JSON.stringify(colaboradores);
  if (op.feito_com_ia === true) e.is_ai_generated = "true";
  return e;
}

const dadosDoItem = (m: Midia): Record<string, string> =>
  m.tipo === "video"
    ? { media_type: "VIDEO", video_url: m.url, is_carousel_item: "true" }
    : { image_url: m.url, is_carousel_item: "true", ...(m.alt ? { alt_text: m.alt.slice(0, 1000) } : {}) };

export const instagram: ModuloDaRede = {
  id: "instagram",
  provedorDoAplicativo: null,
  // Uma chamada por dia, em lotes de quatro: 60 dias bastam para comparar 28 e ainda cabem na rodada.
  historico: 60,
  recursos: {
    metricas: ["instagram_manage_insights"],
    publicar: ["instagram_content_publish"],
    comentarios: ["instagram_manage_comments"],
    mensagens: ["instagram_manage_messages"],
  },

  validar: (peca) => validarPeca("instagram", peca),

  /** O token colado em Integrações devolve a Página e o Instagram de uma vez (ver `meta.ts`). */
  conectarComToken: ({ token }) => contasDoToken(token),

  // ---------------------------------------------------------------- ler

  async lerConta({ credenciais }) {
    const c = cred(credenciais);
    const d = await ler(c.token, c.usuario, { fields: "username,name,followers_count,media_count,profile_picture_url" }, ONDE);
    return {
      seguidores: typeof d.followers_count === "number" ? d.followers_count : null,
      publicacoes: typeof d.media_count === "number" ? d.media_count : null,
      nome: str(d.name) || null,
      usuario: str(d.username) ? `@${str(d.username)}` : null,
      fotoUrl: str(d.profile_picture_url) || null,
    };
  },

  /**
   * Os números por dia. No nível de conta o Instagram só devolve TOTAL do
   * intervalo pedido (fora o alcance), então cada dia é uma chamada, com o dia
   * de São Paulo como intervalo. Na rotina são 7 chamadas por rodada.
   */
  async lerDias({ credenciais, conta, de, ate }) {
    if (!conta.escopos.includes("instagram_manage_insights") && conta.escopos.length > 0) return [];
    const c = cred(credenciais);
    const dias: string[] = [];
    for (let d = new Date(`${de}T12:00:00Z`); d.toISOString().slice(0, 10) <= ate; d.setUTCDate(d.getUTCDate() + 1)) dias.push(d.toISOString().slice(0, 10));

    const umDia = async (dia: string): Promise<NumerosDoDia | null> => {
      // Meia-noite de São Paulo (UTC-3, sem horário de verão desde 2019) até a meia-noite seguinte.
      const inicio = Math.floor(Date.parse(`${dia}T03:00:00Z`) / 1000);
      const r = await ler(
        c.token,
        `${c.usuario}/insights`,
        {
          // `follows_and_unfollows` fica de fora: pede quebra própria e 100 seguidores, e um erro nela derrubaria as outras.
          // O ganho de seguidores sai da diferença entre as fotos diárias do total.
          metric: "reach,views,total_interactions,accounts_engaged,profile_links_taps",
          period: "day",
          metric_type: "total_value",
          since: String(inicio),
          until: String(inicio + 86_400),
        },
        ONDE,
      );
      const v = valoresDosInsights(r);
      return {
        dia,
        alcance: v.reach ?? null,
        visualizacoes: v.views ?? null,
        interacoes: v.total_interactions ?? null,
        cliquesNoLink: v.profile_links_taps ?? null,
        extra: { contas_engajadas: v.accounts_engaged ?? null },
      };
    };

    // Em lotes de quatro: rápido o bastante para 30 dias caberem numa rodada, sem estourar o limite por segundo.
    const saida: NumerosDoDia[] = [];
    for (let i = 0; i < dias.length; i += 4) {
      const lote = await Promise.all(dias.slice(i, i + 4).map((d) => umDia(d)));
      for (const d of lote) if (d) saida.push(d);
    }
    return saida;
  },

  /**
   * Uma página de mídias, da mais nova para a mais antiga. Na primeira página
   * entram também os stories que estão no ar: eles não aparecem na lista de
   * mídias e somem em 24 horas, com as métricas junto.
   */
  async lerPublicacoes({ credenciais, limite, depois }) {
    const c = cred(credenciais);
    const d = await ler(
      c.token,
      `${c.usuario}/media`,
      {
        fields: "id,caption,media_type,media_product_type,timestamp,like_count,comments_count,permalink,thumbnail_url,media_url",
        limit: String(Math.min(100, limite)),
        ...(depois ? { after: depois } : {}),
      },
      ONDE,
    );
    const itens = midiasDoInstagram(d);
    if (!depois) {
      try {
        const s = await ler(c.token, `${c.usuario}/stories`, { fields: "id,caption,media_type,media_product_type,timestamp,permalink,thumbnail_url,media_url", limit: "50" }, ONDE);
        itens.push(...midiasDoInstagram(s).map((x) => ({ ...x, formato: "story" as const })));
      } catch (e) {
        if (e instanceof ErroDaRede && (e.tokenMorto || e.parar)) throw e;
      }
    }
    const paginacao = (d.paging ?? {}) as { next?: string; cursors?: { after?: string } };
    return { itens, depois: paginacao.next ? paginacao.cursors?.after ?? null : null };
  },

  async lerMetricas({ credenciais, publicacao }) {
    const c = cred(credenciais);
    const pedir = (metricas: string[]) => ler(c.token, `${publicacao.idNaRede}/insights`, { metric: metricas.join(",") }, ONDE);
    const todas = metricasPedidasDaMidia(publicacao.formato);
    try {
      return metricasDaMidia(await pedir(todas));
    } catch (e) {
      // Token e limite valem para a conta inteira. O resto costuma ser métrica que aquele tipo de mídia
      // não tem (filho de carrossel, foto antiga sem `views`): tenta só com o que toda mídia tem.
      if (e instanceof ErroDaRede && (e.tokenMorto || e.parar)) throw e;
      return metricasDaMidia(await pedir(publicacao.formato === "story" ? ["reach", "replies"] : ["reach", "saved"]));
    }
  },

  async lerComentarios({ credenciais, conta, publicacaoIdNaRede, desde }) {
    const c = cred(credenciais);
    const itens = await listar(
      c.token,
      `${publicacaoIdNaRede}/comments`,
      { fields: "id,text,username,timestamp,like_count,from,replies.limit(20){id,text,username,timestamp,like_count,from}", limit: "50" },
      ONDE,
      2,
    );
    return comentariosDoInstagram({ data: itens }, conta.contaId).filter((x) => !x.quando || Date.parse(x.quando) > desde);
  },

  // ---------------------------------------------------------------- escrever

  /** Resposta pública embaixo do comentário, em nome do perfil. */
  async responderComentario({ credenciais, comentarioIdNaRede, texto }) {
    const d = await enviar(cred(credenciais).token, `${comentarioIdNaRede}/replies`, { message: texto }, ONDE);
    return { idNaRede: str(d.id) || null };
  },

  async ocultarComentario({ credenciais, comentarioIdNaRede, ocultar }) {
    await enviar(cred(credenciais).token, comentarioIdNaRede, { hide: ocultar ? "true" : "false" }, ONDE);
  },

  /**
   * A publicação, em passos que a fila retoma:
   *   1. cria o contêiner (e, no carrossel, um por item);
   *   2. espera o Instagram preparar (vídeo leva de segundos a minutos);
   *   3. publica.
   * O `andamento` guarda os ids criados, para a rodada seguinte não criar de
   * novo. Contêiner vale 24 horas.
   */
  async publicar({ credenciais, peca, andamento }): Promise<PassoDaPublicacao> {
    const c = cred(credenciais);
    const op = peca.opcoes ?? {};
    const criar = (dados: Record<string, string>) => enviar(c.token, `${c.usuario}/media`, dados, ONDE).then((d) => str(d.id));
    let conteiner = typeof andamento?.conteiner === "string" ? andamento.conteiner : null;
    let filhos = Array.isArray(andamento?.filhos) ? (andamento.filhos as unknown[]).map(String) : [];

    if (!conteiner) {
      if (peca.formato === "carrossel") {
        // Cria só os itens que faltam: se a rodada anterior parou no meio, os já criados valem.
        for (const m of peca.midias.slice(filhos.length)) filhos.push(await criar(dadosDoItem(m)));
        // Item de vídeo precisa estar pronto antes de o carrossel ser montado.
        for (let i = 0; i < peca.midias.length; i++) {
          if (peca.midias[i].tipo !== "video") continue;
          if ((await ficouPronto(c, filhos[i], 12_000)) === "preparando") return { estado: "processando", andamento: { filhos }, emSegundos: 30 };
        }
        conteiner = await criar({ media_type: "CAROUSEL", children: filhos.join(","), caption: peca.legenda ?? "", ...extras(op) });
      } else if (peca.formato === "post") {
        const m = peca.midias.find((x) => x.tipo === "imagem");
        if (!m) throw new ErroDaRede("Post precisa de uma imagem.", { definitivo: true });
        conteiner = await criar({ image_url: m.url, caption: peca.legenda ?? "", ...(m.alt ? { alt_text: m.alt.slice(0, 1000) } : {}), ...extras(op) });
      } else if (peca.formato === "video_curto") {
        const m = peca.midias.find((x) => x.tipo === "video");
        if (!m) throw new ErroDaRede("Reels precisa de um vídeo.", { definitivo: true });
        const capa = peca.midias.find((x) => x.tipo === "imagem");
        conteiner = await criar({
          media_type: "REELS",
          video_url: m.url,
          caption: peca.legenda ?? "",
          share_to_feed: op.fora_do_feed === true ? "false" : "true",
          ...(capa ? { cover_url: capa.url } : typeof op.capa_ms === "number" ? { thumb_offset: String(Math.max(0, Math.round(op.capa_ms))) } : {}),
          ...extras(op),
        });
      } else if (peca.formato === "story") {
        const m = peca.midias[0];
        if (!m) throw new ErroDaRede("Story precisa de uma imagem ou de um vídeo.", { definitivo: true });
        conteiner = await criar(m.tipo === "video" ? { media_type: "STORIES", video_url: m.url } : { media_type: "STORIES", image_url: m.url });
      } else {
        throw new ErroDaRede(`O Instagram não publica o formato ${peca.formato}.`, { definitivo: true });
      }
      if (!conteiner) throw new ErroDaRede("O Instagram não devolveu o contêiner da publicação. A fila tenta de novo.");
    }

    const estado = await ficouPronto(c, conteiner, 14_000);
    if (estado === "preparando") return { estado: "processando", andamento: { conteiner, filhos }, emSegundos: 30 };
    if (estado === "publicado") {
      // Uma rodada anterior publicou e caiu antes de anotar. Não publica de novo.
      return { estado: "publicado", idNaRede: null, url: null, avisos: ["A publicação já tinha saído numa tentativa anterior. O endereço aparece na próxima leitura da conta."] };
    }

    const pub = await enviar(c.token, `${c.usuario}/media_publish`, { creation_id: conteiner }, ONDE, 45_000);
    const id = str(pub.id) || null;
    const avisos: string[] = [];
    let url: string | null = null;
    if (id) {
      try {
        url = str((await ler(c.token, id, { fields: "permalink" }, ONDE)).permalink) || null;
      } catch {
        /* o post já está no ar; o endereço vem na próxima leitura */
      }
      // O primeiro comentário sai do próprio perfil, logo depois de publicar. Se falhar, o post já está no ar.
      const primeiro = typeof op.primeiro_comentario === "string" ? op.primeiro_comentario.trim() : "";
      if (primeiro && peca.formato !== "story") {
        try {
          await enviar(c.token, `${id}/comments`, { message: primeiro.slice(0, 2200) }, ONDE);
        } catch (e) {
          avisos.push(`O primeiro comentário não saiu: ${e instanceof Error ? e.message : "erro"}`);
        }
      }
    }
    return { estado: "publicado", idNaRede: id, url, avisos };
  },
};

/** As permissões que o token precisa para o Instagram fazer tudo o que o painel sabe. */
export const PERMISSOES_DO_INSTAGRAM = [...PERMISSOES_DA_META.base, "instagram_basic", "instagram_manage_insights", "instagram_content_publish", "instagram_manage_comments"];
