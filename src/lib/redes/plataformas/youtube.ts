import "server-only";
import { validarPeca } from "../regras";
import { ErroDaRede, type Credenciais, type ModuloDaRede, type NumerosDoDia, type PassoDaPublicacao, type Peca, type PublicacaoLida } from "../tipos";

/**
 * YouTube: Data API v3 e Analytics API, com o login do Google (OAuth 2.0).
 *
 * Usa o MESMO cliente OAuth do Perfil da Empresa (`google_cliente`, projeto
 * jk-portal-509621), com outra autorização: quem liga aqui é o dono do canal,
 * que pode não ser a conta das lojas, e os escopos são outros.
 *
 * O que a documentação dizia em 16/11/2026 (conferir de novo antes de mexer):
 *   - `videos.insert` custa 1 unidade num balde próprio de 100 envios por dia;
 *     o resto divide 10.000 unidades por dia, e responder comentário custa 50;
 *   - desde 02/11/2026 vídeo enviado por projeto não auditado NÃO fica mais
 *     travado como privado. Sem `privacyStatus` ele nasce público, então este
 *     módulo manda a visibilidade sempre, por extenso;
 *   - não existe campo para "Short": o YouTube decide sozinho (vertical ou
 *     quadrado, até 3 minutos);
 *   - alcance (pessoas únicas) e impressões não existem nestas APIs. O que há
 *     é visualização, e os números por dia chegam com 2 a 3 dias de atraso;
 *   - não existe mensagem direta no YouTube.
 *
 * O ENVIO é a parte delicada: o YouTube não busca o vídeo por endereço, o
 * arquivo precisa ser empurrado. Aqui ele vai do Storage para o Google em
 * blocos (protocolo retomável), sem passar pela memória inteira e sem depender
 * do teto de tempo da função: o que não coube numa rodada continua na
 * seguinte, do byte em que parou.
 *
 * Portado de `worker/plataformas/youtube.js` do auto-agenciasetup.
 */

const API = "https://www.googleapis.com/youtube/v3";
const ANALYTICS = "https://youtubeanalytics.googleapis.com/v2/reports";
const ENVIO = "https://www.googleapis.com/upload/youtube/v3/videos";
const LOGIN = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN = "https://oauth2.googleapis.com/token";

const escopo = (s: string) => `https://www.googleapis.com/auth/${s}`;
const ESCOPO_DE_ENVIO = escopo("youtube.upload");
const ESCOPO_DE_LEITURA = escopo("youtube.readonly");
const ESCOPO_DE_COMENTARIO = escopo("youtube.force-ssl");
const ESCOPO_DE_ANALYTICS = escopo("yt-analytics.readonly");
export const ESCOPOS_DO_YOUTUBE = [ESCOPO_DE_ENVIO, ESCOPO_DE_LEITURA, ESCOPO_DE_COMENTARIO, ESCOPO_DE_ANALYTICS];

/** O token de acesso vale uma hora: renova quando faltam menos de dez minutos. */
const MARGEM_MS = 10 * 60_000;
/** Bloco do envio: múltiplo de 256 KB, como o protocolo exige. 8 MB cabe com folga na memória da função. */
const BLOCO = 32 * 256 * 1024;
/** Quanto uma rodada pode gastar empurrando blocos antes de devolver "continua na próxima". */
const PRAZO_DO_ENVIO_MS = 35_000;

type Cred = { access_token: string; refresh_token: string; expira_em: string; canal?: string; envios?: string | null };

const cred = (c: Credenciais) => c as unknown as Cred;
const daqui = (segundos: unknown) => new Date(Date.now() + (Number(segundos) || 3600) * 1000).toISOString();
const numero = (v: unknown): number | null => (v === null || v === undefined || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);

async function lerJson(r: Response): Promise<Record<string, unknown>> {
  const t = await r.text();
  try {
    return t ? (JSON.parse(t) as Record<string, unknown>) : {};
  } catch {
    return { erro_bruto: t.slice(0, 300) };
  }
}

/** Erro do Google virado em frase que a pessoa lê, com a marca do que fazer (ligar de novo, parar, tentar depois). */
function erroDoGoogle(status: number, d: Record<string, unknown>, contexto: "login" | "envio" | "leitura" = "leitura"): ErroDaRede {
  if (typeof d.error === "string") {
    if (d.error === "invalid_grant") return new ErroDaRede("O Google recusou o acesso ao YouTube: venceu ou foi retirado. Ligue o canal de novo em Integrações.", { tokenMorto: true });
    if (d.error === "invalid_client" || d.error === "unauthorized_client") return new ErroDaRede("O Google não reconheceu o cliente OAuth. Confira o ID e a chave secreta em Integrações.", { definitivo: true });
    if (d.error === "redirect_uri_mismatch") return new ErroDaRede("O endereço de volta não está cadastrado no cliente OAuth do Google Cloud.", { definitivo: true });
    return new ErroDaRede(`O Google recusou o login: ${String(d.error_description || d.error).slice(0, 200)}`, { definitivo: true });
  }
  const e = (d.error ?? {}) as { message?: string; status?: string; errors?: { reason?: string }[]; details?: { reason?: string }[] };
  const motivos = new Set([...(e.errors ?? []).map((x) => x.reason), ...(e.details ?? []).map((x) => x.reason)].filter(Boolean) as string[]);
  const tem = (...r: string[]) => r.some((x) => motivos.has(x));
  const original = String(e.message || d.erro_bruto || `HTTP ${status}`).replace(/<[^>]+>/g, "").slice(0, 200);

  if (tem("quotaExceeded", "dailyLimitExceeded")) return new ErroDaRede("A cota diária da API do YouTube acabou. Ela volta à meia-noite do horário do Pacífico (4h ou 5h em Brasília).", { parar: true });
  if (tem("rateLimitExceeded", "userRateLimitExceeded", "RATE_LIMIT_EXCEEDED")) return new ErroDaRede("O YouTube pediu para ir mais devagar. A próxima rodada tenta de novo.", { parar: true });
  if (tem("youtubeSignupRequired")) return new ErroDaRede("Essa conta do Google não tem canal no YouTube. Ligue de novo e escolha o canal da JK na tela do Google.", { definitivo: true });
  if (tem("authError") || status === 401 || e.status === "UNAUTHENTICATED") return new ErroDaRede("O acesso ao YouTube venceu ou foi retirado. Ligue o canal de novo em Integrações.", { tokenMorto: true });
  if (tem("insufficientPermissions", "ACCESS_TOKEN_SCOPE_INSUFFICIENT")) return new ErroDaRede("A ligação com o YouTube não liberou esta permissão. Ligue de novo e deixe todas as caixas marcadas na tela do Google.", { definitivo: true });
  if (tem("accessNotConfigured", "SERVICE_DISABLED")) return new ErroDaRede("A API do YouTube não está ativada no projeto do Google Cloud (YouTube Data API v3 e YouTube Analytics API).", { definitivo: true });
  if (tem("uploadLimitExceeded")) return new ErroDaRede("O canal passou do limite de envios do YouTube por hoje. Tente amanhã.", { definitivo: true });
  if (tem("invalidTitle")) return new ErroDaRede("O YouTube recusou o título do vídeo (até 100 caracteres, sem os sinais de menor e maior).", { definitivo: true });
  if (tem("invalidDescription")) return new ErroDaRede("O YouTube recusou a descrição do vídeo (até 5.000 bytes).", { definitivo: true });
  if (tem("commentsDisabled")) return new ErroDaRede("Os comentários deste vídeo estão desligados.", { definitivo: true });
  if (tem("videoNotFound", "commentNotFound")) return new ErroDaRede("O YouTube não achou mais este item.", { definitivo: true });
  const frase = contexto === "envio" ? "O YouTube recusou o envio do vídeo" : contexto === "login" ? "O Google recusou o login" : "O YouTube recusou";
  return new ErroDaRede(`${frase}: ${original}`, { definitivo: status >= 400 && status < 500 && status !== 408 && status !== 429 });
}

async function chamar(url: string, opcoes: RequestInit = {}, contexto: "login" | "envio" | "leitura" = "leitura"): Promise<Record<string, unknown>> {
  const r = await fetch(url, { ...opcoes, cache: "no-store", signal: opcoes.signal ?? AbortSignal.timeout(20_000) });
  const d = await lerJson(r);
  if (!r.ok || d.error) throw erroDoGoogle(r.status, d, contexto);
  return d;
}

/** Chamada à Data API com o token da conta. `fields` corta a resposta ao que se usa. */
const api = (c: Cred, caminho: string, params: Record<string, string>, opcoes: RequestInit = {}) =>
  chamar(`${API}/${caminho}?${new URLSearchParams(params)}`, { ...opcoes, headers: { ...(opcoes.headers ?? {}), authorization: `Bearer ${c.access_token}` } });

const form = (dados: Record<string, string>): RequestInit => ({ method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(dados) });

// ------------------------------------------------------------------ texto do vídeo

/** O YouTube recusa < e > no título e na descrição: troca pelos parecidos. */
const semSinais = (s: string) => s.replace(/</g, "‹").replace(/>/g, "›");
const bytesDe = (s: string) => Buffer.byteLength(s, "utf8");

function cortarEmBytes(s: string, max: number): string {
  if (bytesDe(s) <= max) return s;
  let saida = "";
  for (const letra of s) {
    if (bytesDe(saida + letra) > max) break;
    saida += letra;
  }
  return saida;
}

/** O título da peça; sem ele, a primeira linha da legenda sem as hashtags. Até 100 caracteres. */
export function tituloDoVideo(peca: Pick<Peca, "titulo" | "legenda">): string {
  const linha = (peca.legenda ?? "").split("\n").map((l) => l.replace(/#[\p{L}\p{N}_]+/gu, "").trim()).find(Boolean) ?? "";
  const t = semSinais((peca.titulo ?? "").trim() || linha).replace(/\s+/g, " ").trim();
  return [...t].slice(0, 100).join("");
}

// ------------------------------------------------------------------ formato do que foi lido

function segundos(iso: unknown): number {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(String(iso ?? ""));
  return m ? Number(m[1] || 0) * 86400 + Number(m[2] || 0) * 3600 + Number(m[3] || 0) * 60 + Number(m[4] || 0) : 0;
}

/**
 * A API não diz se o vídeo é Short. Vale o que o YouTube usa para decidir: até
 * 3 minutos. A proporção não vem na listagem, então vídeo curto deitado entra
 * como "vídeo curto" aqui também: é aproximação, e só muda o rótulo na tela.
 */
const formatoDe = (duracao: number): "video_curto" | "video" => (duracao > 0 && duracao <= 180 ? "video_curto" : "video");
const endereco = (id: string, formato: string) => (formato === "video_curto" ? `https://www.youtube.com/shorts/${id}` : `https://www.youtube.com/watch?v=${id}`);

async function listaDeEnvios(c: Cred): Promise<string> {
  if (c.envios) return c.envios;
  const d = await api(c, "channels", { part: "contentDetails", mine: "true", fields: "items/contentDetails/relatedPlaylists/uploads" });
  const itens = (d.items ?? []) as { contentDetails?: { relatedPlaylists?: { uploads?: string } } }[];
  const lista = itens[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!lista) throw new ErroDaRede("Não achei a lista de vídeos do canal no YouTube.", { definitivo: true });
  return lista;
}

// ------------------------------------------------------------------ o módulo

export const youtube: ModuloDaRede = {
  id: "youtube",
  provedorDoAplicativo: "google_cliente",
  recursos: {
    metricas: [ESCOPO_DE_LEITURA],
    publicar: [ESCOPO_DE_ENVIO],
    comentarios: [ESCOPO_DE_COMENTARIO],
  },

  validar: (peca) => validarPeca("youtube", peca),

  urlConectar({ aplicativo, estado, retorno }) {
    const q = new URLSearchParams({
      client_id: aplicativo.id,
      redirect_uri: retorno,
      response_type: "code",
      scope: ESCOPOS_DO_YOUTUBE.join(" "),
      // offline + consent: o Google só manda a chave de renovação assim, mesmo se a conta já tinha autorizado.
      access_type: "offline",
      prompt: "consent",
      state: estado,
    });
    return `${LOGIN}?${q}`;
  },

  async concluirConexao({ aplicativo, url, retorno }) {
    const code = url.searchParams.get("code");
    if (!code) throw new ErroDaRede("O Google não devolveu a autorização.", { definitivo: true });
    const t = await chamar(TOKEN, form({ code, client_id: aplicativo.id, client_secret: aplicativo.segredo, redirect_uri: retorno, grant_type: "authorization_code" }), "login");
    if (!t.refresh_token) {
      throw new ErroDaRede("O Google não devolveu a chave de renovação. Tire o acesso do painel em myaccount.google.com/permissions e ligue de novo.", { definitivo: true });
    }
    const escopos = String(t.scope ?? "").split(/\s+/).filter(Boolean);
    if (!escopos.includes(ESCOPO_DE_LEITURA) && !escopos.includes(ESCOPO_DE_COMENTARIO)) {
      throw new ErroDaRede("Faltou liberar a leitura do canal. Ligue de novo e deixe todas as caixas marcadas na tela do Google.", { definitivo: true });
    }
    const credenciais: Cred = { access_token: String(t.access_token), refresh_token: String(t.refresh_token), expira_em: daqui(t.expires_in) };
    const d = await api(credenciais, "channels", { part: "snippet,contentDetails", mine: "true", fields: "items(id,snippet(title,customUrl,thumbnails/default/url,thumbnails/medium/url),contentDetails/relatedPlaylists/uploads)" });
    const canal = ((d.items ?? []) as {
      id: string;
      snippet?: { title?: string; customUrl?: string; thumbnails?: { default?: { url?: string }; medium?: { url?: string } } };
      contentDetails?: { relatedPlaylists?: { uploads?: string } };
    }[])[0];
    if (!canal) throw new ErroDaRede("Essa conta do Google não tem canal no YouTube. Ligue de novo e escolha o canal da JK na tela do Google.", { definitivo: true });
    const arroba = canal.snippet?.customUrl ? (canal.snippet.customUrl.startsWith("@") ? canal.snippet.customUrl : `@${canal.snippet.customUrl}`) : null;
    const envios = canal.contentDetails?.relatedPlaylists?.uploads ?? null;
    return [
      {
        rede: "youtube",
        contaId: canal.id,
        nome: canal.snippet?.title ?? null,
        usuario: arroba,
        fotoUrl: canal.snippet?.thumbnails?.medium?.url ?? canal.snippet?.thumbnails?.default?.url ?? null,
        link: arroba ? `https://www.youtube.com/${arroba}` : `https://www.youtube.com/channel/${canal.id}`,
        credenciais: { ...credenciais, canal: canal.id, envios },
        escopos,
        expiraEm: credenciais.expira_em,
      },
    ];
  },

  async renovar({ aplicativo, credenciais }) {
    const c = cred(credenciais);
    const vence = Date.parse(c.expira_em || "") || 0;
    if (vence - Date.now() > MARGEM_MS) return null;
    if (!c.refresh_token) throw new ErroDaRede("A ligação do YouTube está sem a chave de renovação. Ligue o canal de novo em Integrações.", { tokenMorto: true });
    if (!aplicativo) throw new ErroDaRede("Falta o cliente OAuth do Google em Integrações.", { definitivo: true });
    const t = await chamar(TOKEN, form({ client_id: aplicativo.id, client_secret: aplicativo.segredo, grant_type: "refresh_token", refresh_token: c.refresh_token }), "login");
    const expiraEm = daqui(t.expires_in);
    // A chave de renovação não volta na renovação: fica a antiga.
    return { credenciais: { ...c, access_token: String(t.access_token), refresh_token: String(t.refresh_token || c.refresh_token), expira_em: expiraEm }, expiraEm };
  },

  // ---------------------------------------------------------------- ler

  /** Inscritos (a API arredonda para três algarismos significativos) e total de vídeos. */
  async lerConta({ credenciais }) {
    const d = await api(cred(credenciais), "channels", {
      part: "snippet,statistics",
      mine: "true",
      fields: "items(snippet(title,customUrl,thumbnails/medium/url),statistics(subscriberCount,hiddenSubscriberCount,videoCount))",
    });
    const c = ((d.items ?? []) as { snippet?: { title?: string; customUrl?: string; thumbnails?: { medium?: { url?: string } } }; statistics?: Record<string, unknown> }[])[0] ?? {};
    const s = c.statistics ?? {};
    return {
      seguidores: s.hiddenSubscriberCount ? null : numero(s.subscriberCount),
      publicacoes: numero(s.videoCount),
      nome: c.snippet?.title ?? null,
      fotoUrl: c.snippet?.thumbnails?.medium?.url ?? null,
    };
  },

  /**
   * Os números por dia, pela Analytics API. Chegam com 2 a 3 dias de atraso:
   * os dias mais novos simplesmente não vêm, e a tela mostra o que há.
   */
  async lerDias({ credenciais, conta, de, ate }) {
    if (!conta.escopos.includes(ESCOPO_DE_ANALYTICS)) return [];
    const q = new URLSearchParams({
      ids: "channel==MINE",
      startDate: de,
      endDate: ate,
      dimensions: "day",
      sort: "day",
      metrics: "views,estimatedMinutesWatched,likes,comments,shares,subscribersGained,subscribersLost",
    });
    const d = await chamar(`${ANALYTICS}?${q}`, { headers: { authorization: `Bearer ${cred(credenciais).access_token}` } });
    const colunas = ((d.columnHeaders ?? []) as { name: string }[]).map((c) => c.name);
    const i = (nome: string) => colunas.indexOf(nome);
    return ((d.rows ?? []) as (string | number)[][]).map((linha): NumerosDoDia => {
      const v = (nome: string) => (i(nome) >= 0 ? Number(linha[i(nome)]) || 0 : 0);
      return {
        dia: String(linha[i("day")]),
        visualizacoes: v("views"),
        interacoes: v("likes") + v("comments") + v("shares"),
        novosSeguidores: v("subscribersGained") - v("subscribersLost"),
        extra: { minutos_assistidos: v("estimatedMinutesWatched"), inscritos_ganhos: v("subscribersGained"), inscritos_perdidos: v("subscribersLost") },
      };
    });
  },

  /** Uma página da lista de envios do canal, com os números de cada vídeo. Duas chamadas de 1 unidade. Vídeo privado fica de fora. */
  async lerPublicacoes({ credenciais, limite, depois }) {
    const c = cred(credenciais);
    const lista = await api(c, "playlistItems", {
      part: "contentDetails",
      playlistId: await listaDeEnvios(c),
      maxResults: String(Math.min(50, limite)),
      fields: "nextPageToken,items/contentDetails/videoId",
      ...(depois ? { pageToken: depois } : {}),
    });
    const ids = ((lista.items ?? []) as { contentDetails?: { videoId?: string } }[]).map((x) => x.contentDetails?.videoId).filter(Boolean) as string[];
    const dados = ids.length
      ? await api(c, "videos", {
          part: "snippet,contentDetails,statistics,status",
          id: ids.join(","),
          maxResults: "50",
          fields: "items(id,snippet(publishedAt,title,thumbnails/medium/url),contentDetails/duration,statistics(viewCount,likeCount,commentCount),status/privacyStatus)",
        })
      : { items: [] };
    type Video = {
      id: string;
      snippet?: { publishedAt?: string; title?: string; thumbnails?: { medium?: { url?: string } } };
      contentDetails?: { duration?: string };
      statistics?: Record<string, unknown>;
      status?: { privacyStatus?: string };
    };
    const porId = new Map(((dados.items ?? []) as Video[]).map((v) => [v.id, v]));
    const itens = ids
      .map((id) => porId.get(id))
      .filter((v): v is Video => Boolean(v) && v?.status?.privacyStatus !== "private")
      .map((v): PublicacaoLida => {
        const formato = formatoDe(segundos(v.contentDetails?.duration));
        return {
          idNaRede: v.id,
          formato,
          // No YouTube quem identifica o vídeo é o título, não a descrição.
          legenda: v.snippet?.title ?? "",
          link: endereco(v.id, formato),
          miniaturaUrl: v.snippet?.thumbnails?.medium?.url ?? null,
          publicadoEm: v.snippet?.publishedAt ?? null,
          curtidas: numero(v.statistics?.likeCount),
          comentarios: numero(v.statistics?.commentCount),
          visualizacoes: numero(v.statistics?.viewCount),
        };
      });
    return { itens, depois: (lista.nextPageToken as string | undefined) ?? null };
  },

  /** Comentários de primeiro nível mais novos que `desde`, com as respostas que vierem junto. 1 unidade por página de 100. */
  async lerComentarios({ credenciais, publicacaoIdNaRede, desde }) {
    const c = cred(credenciais);
    type Comentario = { id: string; snippet?: { textDisplay?: string; authorDisplayName?: string; authorChannelId?: { value?: string }; publishedAt?: string; likeCount?: number; parentId?: string } };
    const d = await api(c, "commentThreads", {
      part: "snippet,replies",
      videoId: publicacaoIdNaRede,
      order: "time",
      maxResults: "100",
      textFormat: "plainText",
      fields:
        "items(snippet/topLevelComment(id,snippet(textDisplay,authorDisplayName,authorChannelId,publishedAt,likeCount)),replies/comments(id,snippet(textDisplay,authorDisplayName,authorChannelId,publishedAt,parentId)))",
    });
    const saida = [];
    for (const fio of (d.items ?? []) as { snippet?: { topLevelComment?: Comentario }; replies?: { comments?: Comentario[] } }[]) {
      const topo = fio.snippet?.topLevelComment;
      const todos: [Comentario, string | null][] = [];
      if (topo) todos.push([topo, null]);
      for (const r of fio.replies?.comments ?? []) todos.push([r, topo?.id ?? r.snippet?.parentId ?? null]);
      for (const [x, pai] of todos) {
        const s = x.snippet ?? {};
        if (s.publishedAt && Date.parse(s.publishedAt) <= desde) continue;
        saida.push({
          idNaRede: x.id,
          paiIdNaRede: pai,
          texto: s.textDisplay ?? "",
          autor: String(s.authorDisplayName ?? "").replace(/^@/, ""),
          autorId: s.authorChannelId?.value ?? null,
          quando: s.publishedAt ?? null,
          nosso: Boolean(c.canal && s.authorChannelId?.value === c.canal),
          curtidas: numero(s.likeCount),
        });
      }
    }
    return saida;
  },

  // ---------------------------------------------------------------- escrever

  /** Resposta pública embaixo do comentário. Custa 50 unidades das 10.000 do dia. */
  async responderComentario({ credenciais, comentarioIdNaRede, texto }) {
    const d = await api(
      cred(credenciais),
      "comments",
      { part: "snippet", fields: "id" },
      { method: "POST", headers: { "content-type": "application/json; charset=UTF-8" }, body: JSON.stringify({ snippet: { parentId: comentarioIdNaRede, textOriginal: texto } }) },
    );
    return { idNaRede: d.id ? String(d.id) : null };
  },

  /**
   * O envio, em passos. Sem `andamento`: abre a sessão. Com ele: empurra blocos
   * do Storage para o Google até acabar o arquivo ou o tempo da rodada. A fila
   * chama de novo enquanto vier "processando".
   */
  async publicar({ credenciais, peca, andamento }): Promise<PassoDaPublicacao> {
    const c = cred(credenciais);
    const video = peca.midias.find((m) => m.tipo === "video");
    if (!video) throw new ErroDaRede("A peça não tem vídeo.", { definitivo: true });
    const auth = { authorization: `Bearer ${c.access_token}` };

    let sessao = typeof andamento?.sessao === "string" ? andamento.sessao : null;
    let enviado = Number(andamento?.enviado) || 0;
    let total = Number(andamento?.total) || Number(video.tamanho) || 0;

    if (!total) {
      // O tamanho precisa ser conhecido antes: o Google confere o Content-Range contra ele.
      const cabeca = await fetch(video.url, { method: "HEAD", cache: "no-store", signal: AbortSignal.timeout(15_000) });
      total = Number(cabeca.headers.get("content-length")) || 0;
      if (!cabeca.ok || !total) throw new ErroDaRede("Não consegui medir o arquivo de vídeo no armazenamento.", { definitivo: !cabeca.ok });
    }

    if (!sessao) {
      const descricao = cortarEmBytes(semSinais(peca.legenda ?? "").trim(), 5000);
      const op = peca.opcoes ?? {};
      const inicio = await fetch(`${ENVIO}?uploadType=resumable&part=snippet,status`, {
        method: "POST",
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
        headers: { ...auth, "content-type": "application/json; charset=UTF-8", "x-upload-content-type": video.mime || "video/*", "x-upload-content-length": String(total) },
        body: JSON.stringify({
          snippet: {
            title: tituloDoVideo(peca) || "JK Alianças",
            description: descricao,
            categoryId: typeof op.categoria === "string" && /^\d{1,2}$/.test(op.categoria) ? op.categoria : "26",
            defaultLanguage: "pt-BR",
            defaultAudioLanguage: "pt-BR",
            ...(Array.isArray(op.tags) ? { tags: (op.tags as unknown[]).map(String).slice(0, 30) } : {}),
          },
          status: {
            // Sempre por extenso: sem este campo o vídeo nasce público.
            privacyStatus: op.visibilidade === "nao_listado" ? "unlisted" : op.visibilidade === "privado" ? "private" : "public",
            selfDeclaredMadeForKids: false,
            ...(op.feito_com_ia === true ? { containsSyntheticMedia: true } : {}),
          },
        }),
      });
      if (!inicio.ok) throw erroDoGoogle(inicio.status, await lerJson(inicio), "envio");
      await inicio.body?.cancel();
      sessao = inicio.headers.get("location");
      if (!sessao) throw new ErroDaRede("O YouTube não abriu a sessão de envio. A fila tenta de novo em alguns minutos.");
      enviado = 0;
    }

    const prazo = Date.now() + PRAZO_DO_ENVIO_MS;
    while (enviado < total && Date.now() < prazo) {
      const fim = Math.min(enviado + BLOCO, total) - 1;
      const pedaco = await fetch(video.url, { headers: { range: `bytes=${enviado}-${fim}`, "accept-encoding": "identity" }, cache: "no-store", signal: AbortSignal.timeout(25_000) });
      if (pedaco.status !== 206 && !(pedaco.status === 200 && enviado === 0 && fim === total - 1)) {
        await pedaco.body?.cancel();
        throw new ErroDaRede(`O armazenamento não entregou o pedaço do vídeo (HTTP ${pedaco.status}).`);
      }
      const bytes = Buffer.from(await pedaco.arrayBuffer());
      if (bytes.length !== fim - enviado + 1) throw new ErroDaRede("O armazenamento entregou um pedaço do vídeo com tamanho errado.");

      const r = await fetch(sessao, {
        method: "PUT",
        cache: "no-store",
        signal: AbortSignal.timeout(30_000),
        headers: { ...auth, "content-length": String(bytes.length), "content-range": `bytes ${enviado}-${fim}/${total}` },
        body: bytes,
      });

      if (r.status === 308) {
        // O Google diz até onde recebeu: é dali que o próximo bloco começa, e não de onde achamos que parou.
        const recebido = /bytes=0-(\d+)/.exec(r.headers.get("range") ?? "");
        await r.body?.cancel();
        enviado = recebido ? Number(recebido[1]) + 1 : fim + 1;
        continue;
      }
      const v = await lerJson(r);
      if (r.status === 404) {
        // Sessão vencida: recomeça do zero na próxima rodada.
        return { estado: "processando", andamento: { total }, emSegundos: 60 };
      }
      if (!r.ok || v.error) throw erroDoGoogle(r.status, v, "envio");
      const id = v.id ? String(v.id) : null;
      // 200 sem id: o vídeo subiu. Devolve publicado sem link, para a fila não mandar de novo e o vídeo sair em dobro.
      if (!id) return { estado: "publicado", idNaRede: null, url: null, avisos: ["O YouTube confirmou o envio sem dizer o endereço do vídeo. Confira no YouTube Studio."] };
      const avisos: string[] = [];
      const visibilidade = (v.status as { privacyStatus?: string } | undefined)?.privacyStatus;
      const pedida = peca.opcoes?.visibilidade === "nao_listado" ? "unlisted" : peca.opcoes?.visibilidade === "privado" ? "private" : "public";
      if (visibilidade && visibilidade !== pedida) avisos.push(`O YouTube deixou o vídeo como ${visibilidade}, e não como foi pedido. Confira no YouTube Studio.`);
      return { estado: "publicado", idNaRede: id, url: endereco(id, peca.formato), avisos };
    }

    if (enviado >= total) {
      // Todos os bytes foram, e a resposta final se perdeu (queda de rede no último bloco). Pergunta à sessão o que ela tem.
      const r = await fetch(sessao, { method: "PUT", cache: "no-store", signal: AbortSignal.timeout(20_000), headers: { ...auth, "content-length": "0", "content-range": `bytes */${total}` } });
      if (r.status === 200 || r.status === 201) {
        const v = await lerJson(r);
        const id = v.id ? String(v.id) : null;
        return { estado: "publicado", idNaRede: id, url: id ? endereco(id, peca.formato) : null, avisos: id ? [] : ["O YouTube confirmou o envio sem dizer o endereço do vídeo. Confira no YouTube Studio."] };
      }
      await r.body?.cancel();
      if (r.status === 404) return { estado: "processando", andamento: { total }, emSegundos: 60 };
    }

    return { estado: "processando", andamento: { sessao, enviado, total }, emSegundos: 30 };
  },
};
