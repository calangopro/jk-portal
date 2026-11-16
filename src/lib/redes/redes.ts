/**
 * As redes sociais que o painel conhece, com o nome, a cor e o que cada uma
 * publica. É a lista única: dela saem os cartões de ligação, o seletor do
 * compositor, os filtros das telas e a documentação do conector.
 *
 * Arquivo puro, sem `server-only`: tela de navegador também lê os nomes daqui.
 * O que fala com a API de cada rede mora em `plataformas/`, só no servidor.
 *
 * A cor é a da marca da rede, escurecida o quanto foi preciso para a sigla em
 * branco passar de 4,5:1 sobre ela (medido: Instagram 5,4, Facebook 5,3,
 * YouTube 5,3, Pinterest 5,8, LinkedIn 5,7). Só aparece no selo da rede: o
 * texto das telas usa a tinta do painel, e o gráfico usa a cor do setor.
 */

export type RedeId = "instagram" | "facebook" | "threads" | "youtube" | "tiktok" | "pinterest" | "linkedin" | "x" | "kwai";

/**
 * O formato da peça, na língua de quem publica. Cada rede traduz para o que a
 * API dela chama (o `reels` do Instagram é o `short` do YouTube: no compositor
 * os dois são "vídeo curto").
 */
export type Formato = "post" | "carrossel" | "video_curto" | "story" | "video" | "texto";

export const NOME_DO_FORMATO: Record<Formato, string> = {
  post: "Post de foto",
  carrossel: "Carrossel",
  video_curto: "Vídeo curto",
  story: "Story",
  video: "Vídeo",
  texto: "Só texto",
};

/** O que a rede faz pelo painel, cada um com a permissão que precisa (ver o módulo dela). */
export type Recurso = "metricas" | "publicar" | "comentarios" | "mensagens";

export type Rede = {
  id: RedeId;
  nome: string;
  cor: string;
  /** Como a rede chama o vídeo curto: aparece ao lado do formato no compositor. */
  nomeDoVideoCurto?: string;
  formatos: Formato[];
  /** Uma linha sobre o que o painel faz nela. */
  descricao: string;
  /**
   * `pronta`: o módulo liga, lê e publica. `em_breve`: o módulo ainda não
   * existe, e o cartão diz o que a rede exige antes. `sem_api`: a rede não
   * tem API para conta própria, e não há o que ligar.
   */
  situacao: "pronta" | "em_breve" | "sem_api";
  /** Quando não está pronta: por quê, em uma ou duas frases. Conferido na documentação de cada rede em 16/11/2026. */
  motivo?: string;
  /** O endereço público do perfil da JK, para o cartão levar até ele. */
  perfil?: string;
};

export const REDES: Rede[] = [
  {
    id: "instagram",
    nome: "Instagram",
    cor: "#c81e6a",
    nomeDoVideoCurto: "Reels",
    formatos: ["post", "carrossel", "video_curto", "story"],
    descricao: "Posts, carrosséis, Reels e stories do perfil profissional, com métricas, comentários e directs.",
    situacao: "pronta",
    perfil: "https://www.instagram.com/jkaliancas",
  },
  {
    id: "facebook",
    nome: "Facebook",
    cor: "#1668d6",
    nomeDoVideoCurto: "Reels",
    formatos: ["post", "carrossel", "video_curto", "story", "video", "texto"],
    descricao: "Posts, álbuns, vídeos e stories da Página, com métricas, comentários e Messenger.",
    situacao: "pronta",
    perfil: "https://www.facebook.com/jkaliancasoficial",
  },
  {
    id: "youtube",
    nome: "YouTube",
    cor: "#d9002b",
    nomeDoVideoCurto: "Shorts",
    formatos: ["video_curto", "video"],
    descricao: "Vídeos e Shorts do canal, com métricas e comentários.",
    situacao: "pronta",
    perfil: "https://www.youtube.com/@jk.aliancas",
  },
  {
    id: "threads",
    nome: "Threads",
    cor: "#111111",
    formatos: ["texto", "post", "carrossel", "video"],
    descricao: "Posts de texto, foto e vídeo, com métricas e respostas.",
    situacao: "em_breve",
    motivo: "O perfil existe e está ativo. A API é da Meta, com login próprio do Threads, e entra depois do Instagram e do Facebook.",
    perfil: "https://www.threads.com/@jkaliancas",
  },
  {
    id: "tiktok",
    nome: "TikTok",
    cor: "#111111",
    formatos: ["video_curto", "carrossel"],
    descricao: "Vídeos e carrosséis de foto, com os números de cada vídeo e os comentários.",
    situacao: "em_breve",
    motivo:
      "O TikTok só abre a API de conta própria para empresa cadastrada no TikTok API for Business, com e-mail do domínio da JK e um formulário de acesso. A outra porta (TikTok for Developers) recusa por escrito ferramenta de uso interno.",
    perfil: "https://www.tiktok.com/@jkaliancas",
  },
  {
    id: "pinterest",
    nome: "Pinterest",
    cor: "#cc001f",
    formatos: ["post", "carrossel", "video"],
    descricao: "Pins de imagem e de vídeo levando para o site, com impressões, salvos e cliques.",
    situacao: "em_breve",
    motivo:
      "Precisa de um aplicativo no Pinterest Developers. No acesso de teste o pin criado fica visível só para a própria conta; para publicar de verdade o Pinterest pede um vídeo do login e de uma publicação.",
    perfil: "https://br.pinterest.com/jkaliancas/",
  },
  {
    id: "linkedin",
    nome: "LinkedIn",
    cor: "#0a66c2",
    formatos: ["texto", "post", "video"],
    descricao: "Posts da página da empresa, com comentários e estatísticas.",
    situacao: "em_breve",
    motivo:
      "A página existe, com 91 seguidores. O LinkedIn só libera a API de páginas depois de analisar o aplicativo, que precisa ser verificado por um superadministrador da página. Antes é preciso saber quem administra a página da JK.",
    perfil: "https://www.linkedin.com/company/jk-aliancas",
  },
  {
    id: "x",
    nome: "X",
    cor: "#111111",
    formatos: ["texto", "post"],
    descricao: "Posts de texto e foto.",
    situacao: "em_breve",
    motivo: "O perfil está parado desde 2023, sem seguidores. A API do X é paga por uso (publicar um post com link custa 0,20 dólar). Só vale ligar se a JK voltar a usar a rede.",
    perfil: "https://x.com/JkAliancas",
  },
  {
    id: "kwai",
    nome: "Kwai",
    cor: "#b84a00",
    formatos: [],
    descricao: "Vídeos curtos.",
    situacao: "sem_api",
    motivo: "O Kwai só tem API de anúncios. Não existe API para publicar nem para ler os números de uma conta, então aqui não há o que ligar.",
    perfil: "https://www.kwai.com/@jkaliancas",
  },
];

const POR_ID = new Map(REDES.map((r) => [r.id, r]));

export const rede = (id: string | null | undefined): Rede | null => POR_ID.get(id as RedeId) ?? null;

export const nomeDaRede = (id: string | null | undefined): string => rede(id)?.nome ?? String(id ?? "");

export const ehRede = (id: unknown): id is RedeId => typeof id === "string" && POR_ID.has(id as RedeId);

/** Como o formato se chama naquela rede: "Reels" no Instagram, "Shorts" no YouTube. */
export function nomeDoFormatoNaRede(formato: Formato, redeId: RedeId): string {
  if (formato === "video_curto") return rede(redeId)?.nomeDoVideoCurto ?? NOME_DO_FORMATO.video_curto;
  if (formato === "post" && redeId === "pinterest") return "Pin";
  if (formato === "carrossel" && redeId === "facebook") return "Álbum";
  return NOME_DO_FORMATO[formato];
}
