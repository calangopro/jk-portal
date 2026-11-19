import type { Conteudo } from "@/lib/redes/conteudos";
import type { RedeId } from "@/lib/redes/redes";
import type { PostNaTela } from "@/lib/redes/posts";

/**
 * Dados inventados das telas do Social Media na demonstração dos tutoriais.
 * Nada daqui é de conta, post ou comentário de verdade: contas "@exemplo",
 * textos de exemplo, números redondos e imagens neutras desenhadas aqui.
 */

export const AGORA = Date.parse("2026-11-19T15:00:00-03:00");

/** Uma imagem neutra (degradê suave com uma forma), no lugar da foto de um post. */
export function foto(i: number): string {
  const cores = [["#f3e9d8", "#d9c3a0"], ["#e4ecf3", "#b7cadb"], ["#efe3e6", "#d6b4bd"], ["#e6efe4", "#b9d1b3"], ["#f1ecdc", "#d8cc9b"], ["#e8e4f1", "#c2b8dc"]];
  const [a, b] = cores[i % cores.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="400" viewBox="0 0 320 400"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="320" height="400" fill="url(#g)"/><circle cx="160" cy="200" r="62" fill="none" stroke="#ffffff" stroke-opacity=".75" stroke-width="14"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const CONTAS: { id: string; rede: RedeId; nome: string; usuario: string }[] = [
  { id: "c-ig", rede: "instagram", nome: "Conta Exemplo", usuario: "@exemplo" },
  { id: "c-fb", rede: "facebook", nome: "Página Exemplo", usuario: "Página Exemplo" },
  { id: "c-yt", rede: "youtube", nome: "Canal Exemplo", usuario: "@canalexemplo" },
];

const dia = (n: number, hora = 18) => new Date(Date.parse(`2026-11-19T${String(hora).padStart(2, "0")}:00:00-03:00`) - n * 86_400_000).toISOString();

type Base = { id: string; rede: RedeId; formato: string; legenda: string; n: number; quando: string; vis: number | null; alc: number | null; cur: number; com: number; sal: number | null; comp: number | null };

function conteudo(b: Base, extra: Partial<Conteudo> = {}): Conteudo {
  const interacoes = b.cur + b.com + (b.sal ?? 0) + (b.comp ?? 0);
  const vistos = b.vis ?? b.alc;
  return {
    id: b.id,
    conta_id: CONTAS.find((c) => c.rede === b.rede)!.id,
    rede: b.rede,
    id_na_rede: b.id,
    formato: b.formato,
    legenda: b.legenda,
    link: null,
    miniatura_url: foto(b.n),
    publicado_em: b.quando,
    curtidas: b.cur,
    comentarios: b.com,
    salvos: b.sal,
    compartilhamentos: b.comp,
    alcance: b.alc,
    metricas_em: null,
    visualizacoes: b.vis,
    grupo: b.formato === "video_curto" || b.formato === "video" ? "video" : b.formato === "story" ? "story" : "foto",
    interacoes,
    vistos,
    taxa: vistos ? Math.round((interacoes / vistos) * 1000) / 10 : null,
    fator: 1,
    regua: b.vis !== null ? "visualizacoes" : "alcance",
    acima: false,
    ...extra,
  };
}

export const CONTEUDOS: Conteudo[] = [
  conteudo({ id: "p1", rede: "instagram", formato: "video_curto", legenda: "Exemplo de vídeo curto mostrando o passo a passo de uma peça", n: 0, quando: dia(2), vis: 24000, alc: 15000, cur: 1800, com: 120, sal: 400, comp: 300 }, { fator: 3.4, acima: true }),
  conteudo({ id: "p2", rede: "youtube", formato: "video_curto", legenda: "Exemplo de Shorts com uma dica rápida", n: 1, quando: dia(4), vis: 12000, alc: null, cur: 900, com: 60, sal: null, comp: null }, { fator: 2.6, acima: true }),
  conteudo({ id: "p3", rede: "instagram", formato: "carrossel", legenda: "Exemplo de carrossel com cinco dicas para escolher", n: 2, quando: dia(5), vis: 8000, alc: 6000, cur: 700, com: 40, sal: 250, comp: 90 }, { fator: 2.1, acima: true }),
  conteudo({ id: "p4", rede: "facebook", formato: "post", legenda: "Exemplo de post com uma pergunta para o público", n: 3, quando: dia(6), vis: 3000, alc: 2200, cur: 150, com: 25, sal: null, comp: 20 }, { fator: 1.1 }),
  conteudo({ id: "p5", rede: "instagram", formato: "post", legenda: "Exemplo de foto com legenda curta", n: 4, quando: dia(8), vis: 4000, alc: 3000, cur: 260, com: 18, sal: 60, comp: 30 }, { fator: 0.9 }),
  conteudo({ id: "p6", rede: "youtube", formato: "video", legenda: "Exemplo de vídeo longo com bastidores", n: 5, quando: dia(10), vis: 2000, alc: null, cur: 110, com: 12, sal: null, comp: null }, { fator: 0.8 }),
  conteudo({ id: "p7", rede: "facebook", formato: "video_curto", legenda: "Exemplo de Reels com uma novidade", n: 1, quando: dia(12), vis: 5200, alc: 3900, cur: 210, com: 31, sal: null, comp: 44 }, { fator: 1.4 }),
  conteudo({ id: "p8", rede: "instagram", formato: "story", legenda: "Exemplo de story", n: 2, quando: dia(1), vis: 1500, alc: 1300, cur: 40, com: 0, sal: null, comp: 10 }, { fator: 1 }),
];

const envio = (id: string, c: (typeof CONTAS)[number], status: string, quando: string | null) => ({
  id, contaId: c.id, rede: c.rede, conta: c.nome, status, agendadoPara: quando, proximaTentativa: null, url: null, erro: null, avisos: [] as string[], publicadoEm: status === "publicado" ? quando : null, legenda: null, titulo: null,
});

function post(id: string, formato: PostNaTela["formato"], legenda: string, status: string, quando: string | null, redes: number[], n: number, extra: Partial<PostNaTela> = {}): PostNaTela {
  return {
    id, titulo: null, legenda, formato,
    midias: [{ tipo: "imagem", url: foto(n), alt: "Imagem de exemplo" }],
    opcoes: {}, status, agendadoPara: quando, publicadoEm: status === "publicado" ? quando : null,
    origem: "painel", criadoPor: "Social Media Exemplo", liberadoPor: status === "rascunho" ? null : "Social Media Exemplo", criadoEm: dia(3),
    envios: redes.map((i, k) => envio(`${id}-e${k}`, CONTAS[i], status === "agendado" ? "agendado" : status, quando)),
    sequencia: null,
    ...extra,
  };
}

export const POSTS_DA_FILA: PostNaTela[] = [
  post("f1", "post", "Exemplo de post agendado para esta noite, com uma frase curta e uma pergunta.", "agendado", "2026-11-19T19:00:00-03:00", [0, 1], 0),
  post("f2", "video_curto", "Exemplo de vídeo curto que sai amanhã cedo.", "agendado", "2026-11-20T09:00:00-03:00", [0, 2], 1),
  post("f3", "carrossel", "Exemplo de carrossel marcado para o fim de semana.", "agendado", "2026-11-21T12:00:00-03:00", [0], 2),
  post("f4", "story", "Exemplo de story agendado.", "agendado", "2026-11-22T10:00:00-03:00", [0], 3),
];
