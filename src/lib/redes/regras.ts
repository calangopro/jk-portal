/**
 * As regras de cada rede para uma peça: o que cabe e o que a rede recusa.
 *
 * Um arquivo só, puro, lido em três lugares: o compositor (avisa enquanto a
 * pessoa monta), o servidor (confere antes de agendar) e a fila (confere de
 * novo antes de publicar, porque a peça pode ter esperado dias). Com teste em
 * `scripts/teste-redes.mts`.
 *
 * Os limites são os da documentação de cada rede em 16/11/2026. Medida que a
 * peça não informa (duração de um vídeo que o navegador não conseguiu ler) não
 * é conferida aqui: quem confere é a rede, e a recusa dela volta para a fila.
 */
import type { Formato, RedeId } from "./redes.ts";
import type { Midia, Peca } from "./tipos.ts";

const MB = 1024 * 1024;

export type LimitesDaRede = {
  /** Caracteres da legenda (no YouTube, bytes da descrição). */
  legenda: number;
  hashtags?: number;
  /** Itens do carrossel: mínimo e máximo. */
  carrossel?: [number, number];
  /** Duração do vídeo curto, em segundos. */
  videoCurto?: [number, number];
  /** Duração do story em vídeo, em segundos. */
  storyEmVideo?: [number, number];
  imagemMb?: number;
  videoMb?: number;
  /** A rede só aceita imagem JPEG. */
  soJpeg?: boolean;
  /** Carrossel aceita vídeo misturado com foto. */
  videoNoCarrossel?: boolean;
  titulo?: number;
};

export const LIMITES: Partial<Record<RedeId, LimitesDaRede>> = {
  instagram: { legenda: 2200, hashtags: 30, carrossel: [2, 20], videoCurto: [3, 900], storyEmVideo: [3, 60], imagemMb: 8, videoMb: 300, soJpeg: true, videoNoCarrossel: true },
  facebook: { legenda: 63206, carrossel: [2, 20], videoCurto: [3, 90], storyEmVideo: [1, 60], videoNoCarrossel: false },
  youtube: { legenda: 5000, videoCurto: [1, 180], titulo: 100 },
};

/** Formatos que cada rede publica PELO PAINEL hoje. É menor que a lista de `redes.ts` quando o módulo ainda não cobre um formato. */
export const FORMATOS_PUBLICAVEIS: Partial<Record<RedeId, Formato[]>> = {
  instagram: ["post", "carrossel", "video_curto", "story"],
  facebook: ["post", "carrossel", "video_curto", "story", "video", "texto"],
  youtube: ["video_curto", "video"],
};

const NOME: Partial<Record<RedeId, string>> = { instagram: "O Instagram", facebook: "O Facebook", youtube: "O YouTube" };
const DA_REDE: Partial<Record<RedeId, string>> = { instagram: "do Instagram", facebook: "do Facebook", youtube: "do YouTube" };

const ehJpeg = (m: Midia) => (m.mime ? /^image\/jpe?g$/i.test(m.mime) : /\.jpe?g(\?|$)/i.test(m.url));
const hashtags = (t: string) => (t.match(/#[\p{L}\p{N}_]+/gu) ?? []).length;
const bytes = (t: string) => new TextEncoder().encode(t).length;
const proporcao = (m: Midia) => (m.largura && m.altura ? m.largura / m.altura : null);
const segundos = (n: number) => (n >= 120 ? `${Math.round(n / 60)} minutos` : `${n} segundos`);

/**
 * Confere uma peça contra as regras de uma rede. Devolve o problema em uma
 * frase, do jeito que a pessoa precisa ler para consertar, ou null.
 */
export function validarPeca(rede: RedeId, peca: Peca): string | null {
  const lim = LIMITES[rede];
  const nome = NOME[rede] ?? "Esta rede";
  const formatos = FORMATOS_PUBLICAVEIS[rede];
  if (!lim || !formatos) return `${nome} ainda não publica pelo painel.`;
  if (!formatos.includes(peca.formato)) return `${nome} não publica este formato.`;

  const legenda = peca.legenda ?? "";
  const imagens = peca.midias.filter((m) => m.tipo === "imagem");
  const videos = peca.midias.filter((m) => m.tipo === "video");

  if (rede === "youtube") {
    if (bytes(legenda) > lim.legenda) return "A descrição passa de 5.000 bytes, o limite do YouTube (letra com acento conta 2 e emoji conta 4).";
    const titulo = (peca.titulo ?? "").trim() || legenda.split("\n").map((l) => l.replace(/#[\p{L}\p{N}_]+/gu, "").trim()).find(Boolean) || "";
    if (!titulo) return "Vídeo do YouTube precisa de título.";
    if ((peca.titulo ?? "").trim().length > (lim.titulo ?? 100)) return "O título passa de 100 caracteres, o limite do YouTube.";
  } else if (legenda.length > lim.legenda) {
    return `A legenda passa de ${lim.legenda.toLocaleString("pt-BR")} caracteres, o limite ${DA_REDE[rede] ?? "da rede"}.`;
  }
  if (lim.hashtags && hashtags(legenda) > lim.hashtags) return `${nome} aceita no máximo ${lim.hashtags} hashtags.`;

  const conferirImagem = (m: Midia): string | null => {
    if (lim.soJpeg && !ehJpeg(m)) return `${nome} só aceita imagem em JPEG.`;
    if (lim.imagemMb && m.tamanho && m.tamanho > lim.imagemMb * MB) return `${nome} aceita imagem de até ${lim.imagemMb} MB.`;
    return null;
  };
  const conferirVideo = (m: Midia, faixa?: [number, number], oQue = "O vídeo"): string | null => {
    if (m.mime && !/^video\/(mp4|quicktime)$/i.test(m.mime)) return `${oQue} precisa ser MP4 ou MOV.`;
    if (lim.videoMb && m.tamanho && m.tamanho > lim.videoMb * MB) return `${nome} aceita vídeo de até ${lim.videoMb} MB.`;
    if (faixa && m.duracao) {
      if (m.duracao < faixa[0]) return `${oQue} precisa ter pelo menos ${segundos(faixa[0])}.`;
      if (m.duracao > faixa[1] + 0.5) return `${oQue} passa de ${segundos(faixa[1])}, o limite ${rede === "youtube" ? "para virar Short" : DA_REDE[rede] ?? "da rede"}.`;
    }
    return null;
  };

  switch (peca.formato) {
    case "texto":
      if (!legenda.trim()) return "Post de texto precisa de texto.";
      return null;

    case "post": {
      if (imagens.length !== 1 || videos.length) return "Post de foto leva uma imagem só. Com mais de uma, use carrossel.";
      const problema = conferirImagem(imagens[0]);
      if (problema) return problema;
      const p = proporcao(imagens[0]);
      // O Instagram corta fora dessa faixa: de 4:5 (em pé) a 1,91:1 (deitada).
      if (rede === "instagram" && p !== null && (p < 0.79 || p > 1.92)) return "A imagem está fora da proporção que o Instagram aceita no feed: de 4:5 (em pé) a 1,91:1 (deitada).";
      return null;
    }

    case "carrossel": {
      const [min, max] = lim.carrossel ?? [2, 10];
      const total = peca.midias.length;
      if (total < min || total > max) return `Carrossel precisa de ${min} a ${max} itens (tem ${total}).`;
      if (videos.length && !lim.videoNoCarrossel) return `${nome} só aceita foto no álbum.`;
      for (const m of imagens) {
        const problema = conferirImagem(m);
        if (problema) return problema;
      }
      for (const m of videos) {
        const problema = conferirVideo(m, undefined, "O vídeo do carrossel");
        if (problema) return problema;
      }
      return null;
    }

    case "video_curto": {
      if (videos.length !== 1) return "Vídeo curto leva um vídeo só.";
      const problema = conferirVideo(videos[0], lim.videoCurto);
      if (problema) return problema;
      const p = proporcao(videos[0]);
      // Deitado não vira Short no YouTube nem ocupa a tela no Reels.
      if (p !== null && p > 1.05) return rede === "youtube" ? "Para virar Short, o vídeo precisa ser em pé ou quadrado. Deitado, publique como vídeo." : "Vídeo curto precisa ser em pé (9:16) ou quadrado.";
      if (imagens.length > 1) return "Vídeo curto aceita uma imagem de capa só.";
      return null;
    }

    case "story": {
      // Várias mídias num story são uma SEQUÊNCIA: ao liberar, cada uma vira um story, na ordem (`liberarPost`).
      if (peca.midias.length === 0) return "Story precisa de uma imagem ou de um vídeo.";
      if (peca.midias.length > MAX_STORIES_NA_SEQUENCIA) return `Uma sequência leva até ${MAX_STORIES_NA_SEQUENCIA} stories por vez.`;
      for (const [i, m] of peca.midias.entries()) {
        const qual = peca.midias.length > 1 ? `do story ${i + 1}` : "do story";
        const problema = m.tipo === "video" ? conferirVideo(m, lim.storyEmVideo, `O vídeo ${qual}`) : conferirImagem(m);
        if (problema) return peca.midias.length > 1 && m.tipo !== "video" ? `Story ${i + 1}: ${problema}` : problema;
      }
      return null;
    }

    case "video": {
      if (videos.length !== 1) return "Vídeo leva um arquivo de vídeo só.";
      return conferirVideo(videos[0]);
    }
  }
  return null;
}

/** Os problemas de uma peça em CADA rede escolhida. Lista vazia: pode agendar. */
export function problemasDaPeca(redes: RedeId[], pecaPorRede: (rede: RedeId) => Peca): { rede: RedeId; problema: string }[] {
  const saida: { rede: RedeId; problema: string }[] = [];
  for (const r of redes) {
    const problema = validarPeca(r, pecaPorRede(r));
    if (problema) saida.push({ rede: r, problema });
  }
  return saida;
}

/** Quantos stories uma sequência leva de uma vez. */
export const MAX_STORIES_NA_SEQUENCIA = 10;

/** Os intervalos que a tela oferece entre os stories de uma sequência, em minutos. Zero: um logo depois do outro. */
export const INTERVALOS_DA_SEQUENCIA = [0, 15, 30, 60, 120, 180];

/** O texto da casa não leva travessão. Vale para legenda, título e resposta de comentário. */
export const temTravessao = (t: string): boolean => /[—–]/.test(t);
