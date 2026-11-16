/**
 * Confere as contas puras das redes sociais. Roda sem banco, sem navegador e
 * sem falar com rede nenhuma:
 *   node --experimental-strip-types scripts/teste-redes.mts
 *
 * As respostas de API daqui são INVENTADAS, só com a forma que a documentação
 * de cada rede descreve. Nenhum número, legenda ou comentário de conta de
 * verdade mora neste arquivo.
 */
import { readFileSync } from "node:fs";
import { REDES, ehRede, nomeDaRede, nomeDoFormatoNaRede, rede } from "../src/lib/redes/redes.ts";
import { FORMATOS_PUBLICAVEIS, LIMITES, problemasDaPeca, temTravessao, validarPeca } from "../src/lib/redes/regras.ts";
import { compacto, haQuanto, montarResumo, somar, variacao, type ContaCrua, type PublicacaoCrua } from "../src/lib/redes/resumo.ts";
import {
  comentariosDaPagina, comentariosDoInstagram, erroDaMeta, formatoDaMidia, metricasDaMidia, metricasDoPost, metricasPedidasDaMidia, midiasDoInstagram,
  permissoesDoToken, postsDaPagina, seriePorDia, valoresDosInsights,
} from "../src/lib/redes/plataformas/meta-forma.ts";
import { INFO_DA_LIGACAO } from "../src/lib/redes/ligacao.ts";
import { enderecoAssinado } from "../src/lib/redes/s3.ts";
import { conferirRegra, deveResponder, lerPalavras, normalizar, palavraQueCasa } from "../src/lib/redes/automacoes-regra.ts";
import { SETORES } from "../src/lib/painel/setores.ts";
import { analisarConteudos, fatorEmPalavra, grupoDoFormato, mediana, ordenarConteudos, type PublicacaoCrua as PublicacaoDoConteudo } from "../src/lib/redes/conteudos.ts";
import { diaEmSaoPaulo, diasDaGrade, horaCurta, intervaloDaGrade, lerMes, mesVizinho, nomeDoMes, porDia, type ItemDoCalendario } from "../src/lib/redes/calendario.ts";
import { faixaEmPalavra, horaEmSaoPaulo, melhoresHorarios, proximosHorarios } from "../src/lib/redes/horarios.ts";
import type { Peca } from "../src/lib/redes/tipos.ts";

let falhas = 0;
function confere(nome: string, ok: boolean, detalhe = "") {
  if (ok) console.log(`  ok  ${nome}`);
  else {
    falhas++;
    console.error(`  ERRO ${nome}${detalhe ? `\n       ${detalhe}` : ""}`);
  }
}

const MB = 1024 * 1024;
const jpg = (a: Partial<Peca["midias"][number]> = {}): Peca["midias"][number] => ({ tipo: "imagem", url: "https://exemplo.test/a.jpg", mime: "image/jpeg", largura: 1080, altura: 1350, tamanho: 1 * MB, ...a });
const mp4 = (a: Partial<Peca["midias"][number]> = {}): Peca["midias"][number] => ({ tipo: "video", url: "https://exemplo.test/a.mp4", mime: "video/mp4", largura: 1080, altura: 1920, duracao: 30, tamanho: 20 * MB, ...a });
const peca = (a: Partial<Peca>): Peca => ({ formato: "post", legenda: "Legenda de exemplo", midias: [jpg()], opcoes: {}, ...a });

console.log("\nLista de redes");
{
  confere("toda rede tem nome e cor", REDES.every((r) => r.nome && /^#[0-9a-f]{6}$/.test(r.cor)));
  confere("ids não se repetem", new Set(REDES.map((r) => r.id)).size === REDES.length);
  confere("rede fora da lista é recusada", !ehRede("orkut") && ehRede("instagram"));
  confere("nome de rede desconhecida não quebra", nomeDaRede("orkut") === "orkut" && nomeDaRede(null) === "");
  confere("vídeo curto se chama Reels no Instagram e Shorts no YouTube", nomeDoFormatoNaRede("video_curto", "instagram") === "Reels" && nomeDoFormatoNaRede("video_curto", "youtube") === "Shorts");
  confere("rede que não está pronta diz o motivo", REDES.filter((r) => r.situacao !== "pronta").every((r) => (r.motivo ?? "").length > 30));
  confere("rede pronta tem regra de publicação e texto de ligação", REDES.filter((r) => r.situacao === "pronta").every((r) => LIMITES[r.id] && FORMATOS_PUBLICAVEIS[r.id] && INFO_DA_LIGACAO[r.id]));
  confere("o que o painel publica cabe no que a rede publica", REDES.every((r) => (FORMATOS_PUBLICAVEIS[r.id] ?? []).every((f) => r.formatos.includes(f))));
  confere("Kwai aparece como rede sem API", rede("kwai")?.situacao === "sem_api");
  const textos = [...REDES.flatMap((r) => [r.descricao, r.motivo ?? ""]), ...Object.values(INFO_DA_LIGACAO).flatMap((i) => [i!.comQuem, ...i!.passos, ...i!.limites, i!.token?.ondeAchar ?? ""])];
  confere("nenhum texto das redes com travessão", textos.every((t) => !temTravessao(t)));
  const setor = SETORES.find((s) => s.id === "redes");
  confere("o setor Redes existe e toda tela dele pede a área redes", Boolean(setor) && setor!.itens.every((i) => i.area === "redes" && i.href.startsWith("/admin/redes")));
}

console.log("\nRegras de cada rede");
{
  confere("post de foto simples passa no Instagram", validarPeca("instagram", peca({})) === null);
  confere("PNG é recusado no Instagram", /JPEG/.test(validarPeca("instagram", peca({ midias: [jpg({ mime: "image/png" })] })) ?? ""));
  confere("PNG passa no Facebook", validarPeca("facebook", peca({ midias: [jpg({ mime: "image/png" })] })) === null);
  confere("legenda de 2.201 caracteres é recusada no Instagram", /2\.200/.test(validarPeca("instagram", peca({ legenda: "a".repeat(2201) })) ?? ""));
  confere("legenda de 2.201 caracteres passa no Facebook", validarPeca("facebook", peca({ legenda: "a".repeat(2201) })) === null);
  confere("31 hashtags são recusadas no Instagram", /30 hashtags/.test(validarPeca("instagram", peca({ legenda: Array.from({ length: 31 }, (_, i) => `#a${i}`).join(" ") })) ?? ""));
  confere("imagem panorâmica demais é recusada no feed do Instagram", /proporção/.test(validarPeca("instagram", peca({ midias: [jpg({ largura: 3000, altura: 1000 })] })) ?? ""));
  confere("imagem de 9 MB é recusada no Instagram", /8 MB/.test(validarPeca("instagram", peca({ midias: [jpg({ tamanho: 9 * MB })] })) ?? ""));
  confere("post com duas imagens pede carrossel", /carrossel/.test(validarPeca("instagram", peca({ midias: [jpg(), jpg()] })) ?? ""));
  confere("carrossel de uma imagem é recusado", /2 a 20/.test(validarPeca("instagram", peca({ formato: "carrossel", midias: [jpg()] })) ?? ""));
  confere("carrossel de 20 passa e de 21 não", validarPeca("instagram", peca({ formato: "carrossel", midias: Array.from({ length: 20 }, () => jpg()) })) === null && validarPeca("instagram", peca({ formato: "carrossel", midias: Array.from({ length: 21 }, () => jpg()) })) !== null);
  confere("carrossel com vídeo passa no Instagram e não no Facebook", validarPeca("instagram", peca({ formato: "carrossel", midias: [jpg(), mp4()] })) === null && /só aceita foto/.test(validarPeca("facebook", peca({ formato: "carrossel", midias: [jpg(), mp4()] })) ?? ""));
  confere("Reels de 30 segundos em pé passa", validarPeca("instagram", peca({ formato: "video_curto", midias: [mp4()] })) === null);
  confere("Reels de 2 segundos é recusado", /pelo menos 3 segundos/.test(validarPeca("instagram", peca({ formato: "video_curto", midias: [mp4({ duracao: 2 })] })) ?? ""));
  confere("Reels do Facebook de 2 minutos é recusado", /90 segundos/.test(validarPeca("facebook", peca({ formato: "video_curto", midias: [mp4({ duracao: 120 })] })) ?? ""));
  confere("vídeo curto deitado é recusado", /em pé/.test(validarPeca("instagram", peca({ formato: "video_curto", midias: [mp4({ largura: 1920, altura: 1080 })] })) ?? ""));
  confere("vídeo curto aceita uma capa", validarPeca("instagram", peca({ formato: "video_curto", midias: [mp4(), jpg()] })) === null);
  confere("vídeo sem duração conhecida não é barrado aqui", validarPeca("instagram", peca({ formato: "video_curto", midias: [mp4({ duracao: undefined })] })) === null);
  confere("story em vídeo de 70 segundos é recusado", /60 segundos/.test(validarPeca("instagram", peca({ formato: "story", midias: [mp4({ duracao: 70 })] })) ?? ""));
  // Várias mídias num story são uma sequência: cada uma é conferida como um story.
  confere("sequência de stories passa quando cada um passa", validarPeca("instagram", peca({ formato: "story", midias: [jpg(), mp4({ duracao: 20 }), jpg()] })) === null);
  confere("sequência diz qual story não cabe", /story 2/.test(validarPeca("instagram", peca({ formato: "story", midias: [jpg(), mp4({ duracao: 70 })] })) ?? ""));
  confere("sequência tem teto de 10 stories", /até 10/.test(validarPeca("instagram", peca({ formato: "story", midias: Array.from({ length: 11 }, () => jpg()) })) ?? ""));
  confere("story sem mídia é recusado", /imagem ou de um vídeo/.test(validarPeca("instagram", peca({ formato: "story", midias: [] })) ?? ""));
  confere("post de texto só existe no Facebook", validarPeca("facebook", peca({ formato: "texto", midias: [] })) === null && /não publica este formato/.test(validarPeca("instagram", peca({ formato: "texto", midias: [] })) ?? ""));
  confere("post de texto vazio é recusado", /precisa de texto/.test(validarPeca("facebook", peca({ formato: "texto", legenda: "  ", midias: [] })) ?? ""));
  confere("YouTube recusa foto", /não publica este formato/.test(validarPeca("youtube", peca({})) ?? ""));
  confere("YouTube aceita vídeo com título", validarPeca("youtube", peca({ formato: "video", titulo: "Como medir o dedo", midias: [mp4({ largura: 1920, altura: 1080, duracao: 400 })] })) === null);
  confere("YouTube tira o título da legenda quando falta", validarPeca("youtube", peca({ formato: "video", legenda: "Primeira linha\nresto", midias: [mp4()] })) === null);
  confere("YouTube sem título e sem legenda é recusado", /título/.test(validarPeca("youtube", peca({ formato: "video", legenda: "#so #hashtag", midias: [mp4()] })) ?? ""));
  confere("título de 101 caracteres é recusado no YouTube", /100 caracteres/.test(validarPeca("youtube", peca({ formato: "video", titulo: "a".repeat(101), midias: [mp4()] })) ?? ""));
  confere("Short de 4 minutos é recusado", /Short/.test(validarPeca("youtube", peca({ formato: "video_curto", titulo: "t", midias: [mp4({ duracao: 240 })] })) ?? ""));
  confere("Short deitado manda publicar como vídeo", /publique como vídeo/.test(validarPeca("youtube", peca({ formato: "video_curto", titulo: "t", midias: [mp4({ largura: 1920, altura: 1080 })] })) ?? ""));
  confere("descrição do YouTube conta bytes, não letras", /bytes/.test(validarPeca("youtube", peca({ formato: "video", titulo: "t", legenda: "ç".repeat(2501), midias: [mp4()] })) ?? ""));
  confere("rede sem módulo diz que ainda não publica", /ainda não publica/.test(validarPeca("tiktok", peca({ formato: "video_curto", midias: [mp4()] })) ?? ""));
  const varios = problemasDaPeca(["instagram", "facebook", "youtube"], () => peca({}));
  confere("a mesma peça é conferida em cada rede escolhida", varios.length === 1 && varios[0].rede === "youtube");
  const frases = [
    validarPeca("instagram", peca({ legenda: "a".repeat(2201) })), validarPeca("facebook", peca({ formato: "video_curto", midias: [mp4({ duracao: 120 })] })),
    validarPeca("youtube", peca({ formato: "video_curto", titulo: "t", midias: [mp4({ duracao: 240 })] })), validarPeca("instagram", peca({ formato: "story", midias: [mp4({ duracao: 70 })] })),
  ];
  confere("as frases de recusa não saem quebradas nem com travessão", frases.every((f) => f && !temTravessao(f) && !/undefined|\bd \w/.test(f)), frases.join(" | "));
  confere("travessão é reconhecido", temTravessao("aliança — ouro") && temTravessao("2–3 mm") && !temTravessao("meio-dia, 2-3 mm"));
}

console.log("\nForma das respostas da Meta");
{
  confere("permissões de me/permissions", JSON.stringify(permissoesDoToken({ data: [{ permission: "read_insights", status: "granted" }, { permission: "pages_messaging", status: "declined" }] })) === '["read_insights"]');
  confere("permissões de debug_token", JSON.stringify(permissoesDoToken({ data: { scopes: ["instagram_basic", "read_insights"] } })) === '["instagram_basic","read_insights"]');
  confere("resposta sem permissões não quebra", permissoesDoToken(null).length === 0 && permissoesDoToken({ error: {} }).length === 0);

  const totais = valoresDosInsights({ data: [{ name: "views", total_value: { value: 1200 } }, { name: "reach", values: [{ value: 300, end_time: "2026-01-02T08:00:00+0000" }, { value: 420, end_time: "2026-01-03T08:00:00+0000" }] }, { name: "vazia", values: [] }] });
  confere("total do intervalo e último valor da série", totais.views === 1200 && totais.reach === 420 && totais.vazia === null);
  confere("série somada quando pedido", valoresDosInsights({ data: [{ name: "reach", values: [{ value: 300 }, { value: 420 }] }] }, true).reach === 720);
  confere("quebra por tipo vira soma", valoresDosInsights({ data: [{ name: "reacoes", values: [{ value: { like: 3, love: 2 } }] }] }).reacoes === 5);

  const serie = seriePorDia({ data: [{ name: "page_media_view", period: "day", values: [{ value: 10, end_time: "2026-01-02T08:00:00+0000" }, { value: 14, end_time: "2026-01-03T08:00:00+0000" }] }] });
  confere("o valor pertence ao dia ANTERIOR ao fim informado", serie["2026-01-01"]?.page_media_view === 10 && serie["2026-01-02"]?.page_media_view === 14 && Object.keys(serie).length === 2);

  confere("formato de Reels, carrossel, story e foto", formatoDaMidia({ media_type: "VIDEO", media_product_type: "REELS" }) === "video_curto" && formatoDaMidia({ media_type: "CAROUSEL_ALBUM", media_product_type: "FEED" }) === "carrossel" && formatoDaMidia({ media_type: "IMAGE", media_product_type: "STORY" }) === "story" && formatoDaMidia({ media_type: "IMAGE", media_product_type: "FEED" }) === "post");
  const midias = midiasDoInstagram({ data: [
    { id: "111", caption: "Legenda inventada", media_type: "VIDEO", media_product_type: "REELS", timestamp: "2026-01-05T15:00:00+0000", like_count: 40, comments_count: 3, permalink: "https://exemplo.test/reel/1", thumbnail_url: "https://exemplo.test/t.jpg" },
    { id: "112", media_type: "IMAGE", media_product_type: "FEED", timestamp: "2026-01-04T15:00:00+0000", media_url: "https://exemplo.test/f.jpg" },
    { caption: "sem id" },
  ] });
  confere("mídias do Instagram: descarta a sem id e usa a miniatura certa", midias.length === 2 && midias[0].miniaturaUrl === "https://exemplo.test/t.jpg" && midias[1].miniaturaUrl === "https://exemplo.test/f.jpg" && midias[1].legenda === "" && midias[1].curtidas === null);
  confere("vídeo sem miniatura não usa o arquivo do vídeo como imagem", midiasDoInstagram({ data: [{ id: "1", media_type: "VIDEO", media_url: "https://exemplo.test/v.mp4" }] })[0].miniaturaUrl === null);
  confere("story pede métricas próprias, sem salvos", metricasPedidasDaMidia("story").includes("replies") && !metricasPedidasDaMidia("story").includes("saved") && metricasPedidasDaMidia("post").includes("saved"));
  const mm = metricasDaMidia({ data: [{ name: "reach", values: [{ value: 900 }] }, { name: "views", values: [{ value: 1500 }] }, { name: "saved", values: [{ value: 12 }] }] });
  confere("métricas da mídia: o que não veio fica nulo", mm.alcance === 900 && mm.visualizacoes === 1500 && mm.salvos === 12 && mm.compartilhamentos === null);

  const ci = comentariosDoInstagram({ data: [{ id: "c1", text: "Pergunta inventada", username: "pessoa_exemplo", timestamp: "2026-01-05T16:00:00+0000", from: { id: "900", username: "pessoa_exemplo" }, replies: { data: [{ id: "c2", text: "Resposta da casa", username: "conta_exemplo", from: { id: "555" }, timestamp: "2026-01-05T17:00:00+0000" }] } }] }, "555");
  confere("comentários do Instagram: a resposta fica presa ao comentário e a da casa é reconhecida", ci.length === 2 && ci[0].paiIdNaRede === null && !ci[0].nosso && ci[1].paiIdNaRede === "c1" && ci[1].nosso);

  const posts = postsDaPagina({ data: [
    { id: "9_1", message: "Texto inventado", created_time: "2026-01-03T12:00:00+0000", permalink_url: "https://exemplo.test/p/1", full_picture: "https://exemplo.test/p.jpg", attachments: { data: [{ media_type: "album" }] }, shares: { count: 4 }, reactions: { summary: { total_count: 20 } }, comments: { summary: { total_count: 2 } } },
    { id: "9_2", message: "Só texto", created_time: "2026-01-02T12:00:00+0000" },
  ] });
  confere("posts da Página: formato, reações e compartilhamentos", posts[0].formato === "carrossel" && posts[0].curtidas === 20 && posts[0].comentarios === 2 && posts[0].compartilhamentos === 4 && posts[1].formato === "texto" && posts[1].compartilhamentos === 0);
  const mp = metricasDoPost({ data: [{ name: "post_media_view", values: [{ value: 800 }] }, { name: "post_total_media_view_unique", values: [{ value: 500 }] }] });
  confere("métricas do post usam os nomes que valem hoje", mp.visualizacoes === 800 && mp.alcance === 500 && mp.salvos === null);
  const cp = comentariosDaPagina({ data: [{ id: "k1", message: "Comentário", from: { id: "77", name: "Pessoa Exemplo" }, created_time: "2026-01-03T13:00:00+0000" }, { id: "k2", message: "Resposta", from: { id: "9" }, parent: { id: "k1" } }, { id: "k3", message: "Sem autor" }] }, "9");
  confere("comentários da Página: resposta, autoria da casa e comentário sem autor", cp.length === 3 && cp[1].paiIdNaRede === "k1" && cp[1].nosso && cp[2].autor === "" && cp[2].autorId === null);

  const morto = erroDaMeta({ error: { message: "Error validating access token", code: 190 } }, 400, "O Instagram");
  confere("código 190 é token morto", morto.tokenMorto && morto.definitivo && /cole em Integrações/.test(morto.mensagem));
  const limite = erroDaMeta({ error: { message: "rate", code: 80002 } }, 400, "O Instagram");
  confere("limite de uso manda parar e não é definitivo", limite.parar && !limite.definitivo && !limite.tokenMorto);
  const permissao = erroDaMeta({ error: { message: "(#200) Requires pages_manage_posts", code: 200 } }, 403, "O Facebook");
  confere("falta de permissão é definitiva e diz qual", permissao.definitivo && !permissao.tokenMorto && /pages_manage_posts/.test(permissao.mensagem));
  confere("erro 500 pode ser tentado de novo", !erroDaMeta({}, 502, "O Facebook").definitivo);
  confere("nenhuma mensagem de erro com travessão", [morto, limite, permissao].every((e) => !temTravessao(e.mensagem)));
}

console.log("\nResumo das redes");
{
  const dia = (d: string, a: Partial<ContaCrua["serie"][number]> = {}) => ({ dia: d, seguidores: null, alcance: null, visualizacoes: null, interacoes: null, visitas_ao_perfil: null, cliques_no_link: null, novos_seguidores: null, ...a });
  const conta = (id: string, a: Partial<ContaCrua>): ContaCrua => ({
    id, rede: "instagram", nome: "Conta Exemplo", usuario: "@exemplo", foto_url: null, link: null, status: "ativa", ultimo_erro: null, lida_em: "2026-01-10T12:00:00Z", expira_em: null,
    seguidores: null, seguidores_antes: null, serie: [], anterior: null, posts: null, posts_antes: null, ...a,
  });
  const pub = (id: string, a: Partial<PublicacaoCrua>): PublicacaoCrua => ({
    id, conta_id: "a", rede: "instagram", id_na_rede: id, formato: "post", legenda: "Legenda inventada", link: null, miniatura_url: null, publicado_em: "2026-01-09T12:00:00Z",
    curtidas: null, comentarios: null, salvos: null, compartilhamentos: null, alcance: null, visualizacoes: null, ...a,
  });

  confere("somar respeita o nulo", somar([null, undefined]) === null && somar([1, null, 2]) === 3 && somar([]) === null);
  confere("variação sem base é nula", variacao(10, null) === null && variacao(10, 0) === null && variacao(null, 10) === null && Math.abs((variacao(110, 100) ?? 0) - 0.1) < 1e-9);

  const r = montarResumo({
    dias: 7, hoje: "2026-01-10",
    contas: [
      conta("a", {
        seguidores: 1100, seguidores_antes: 1000,
        serie: [dia("2026-01-09", { seguidores: 1090, alcance: 500, visualizacoes: 900, interacoes: 40 }), dia("2026-01-10", { seguidores: 1100, alcance: 700, visualizacoes: 1100, interacoes: 60 })],
        anterior: { alcance: 1000, visualizacoes: 1000, interacoes: 50, visitas_ao_perfil: null, cliques_no_link: null, dias: { alcance: 7, visualizacoes: 7, interacoes: 7, visitas_ao_perfil: 0, cliques_no_link: 0 } },
        posts: { quantos: 3, curtidas: 80, comentarios: 10, salvos: 5, compartilhamentos: 5, alcance: 1100, visualizacoes: 1900 },
        posts_antes: { quantos: 2, curtidas: 30, comentarios: 5, alcance: 900, visualizacoes: 950 },
        primeira_publicacao: "2025-06-01T12:00:00Z",
      }),
      // YouTube: sem alcance nem números por dia. Os totais saem dos vídeos do período.
      conta("b", { rede: "youtube", usuario: "@canal", seguidores: 500, seguidores_antes: null, posts: { quantos: 1, curtidas: 20, comentarios: 2, salvos: null, compartilhamentos: null, alcance: null, visualizacoes: 3000 }, posts_antes: null }),
      conta("c", { rede: "facebook", status: "desligada", seguidores: 9999 }),
    ],
    publicacoes: [
      pub("p1", { curtidas: 50, comentarios: 5, salvos: 5, compartilhamentos: 0, alcance: 600 }),
      pub("p2", { conta_id: "b", rede: "youtube", curtidas: 20, comentarios: 2, visualizacoes: 3000 }),
      pub("p3", { curtidas: 0, comentarios: 0 }),
      pub("p4", { curtidas: 9, comentarios: 1, alcance: 12 }),
    ],
  });
  const a = r.contas.find((c) => c.id === "a")!;
  const b = r.contas.find((c) => c.id === "b")!;
  confere("conta desligada não entra", r.contas.length === 2);
  confere("seguidores com variação e ganho", a.seguidores.valor === 1100 && Math.abs((a.seguidores.variacao ?? 0) - 0.1) < 1e-9 && a.ganho === 100);
  confere("os números por dia da conta valem mais que a soma dos posts", a.alcance.valor === 1200 && a.visualizacoes.valor === 2000 && a.interacoes.valor === 100);
  confere("variação contra o período anterior", Math.abs((a.alcance.variacao ?? 0) - 0.2) < 1e-9 && Math.abs((a.interacoes.variacao ?? 0) - 1) < 1e-9);
  confere("engajamento por 100 pessoas alcançadas", Math.abs((a.engajamento ?? 0) - (100 / 1200) * 100) < 1e-9 && a.baseDoEngajamento === "pessoas");
  confere("sem alcance, o engajamento é sobre visualizações e a tela diz isso", b.baseDoEngajamento === "visualizações" && Math.abs((b.engajamento ?? 0) - (22 / 3000) * 100) < 1e-9);
  confere("as últimas publicações saem da mais nova para a mais antiga", r.recentes.every((p, i, l) => i === 0 || Date.parse(l[i - 1].publicado_em ?? "") >= Date.parse(p.publicado_em ?? "")));
  confere("séries prontas para o minigráfico", a.serieDeSeguidores.join(",") === "1090,1100" && a.serieDeAlcance.join(",") === "900,1100");
  confere("rede que não informa alcance fica com nulo, não zero", b.alcance.valor === null && b.visualizacoes.valor === 3000 && b.interacoes.valor === 22);
  confere("sem foto anterior não há variação nem ganho", b.seguidores.variacao === null && b.ganho === null);
  confere("total soma o que existe", r.total.seguidores.valor === 1600 && r.total.visualizacoes.valor === 5000 && r.total.alcance.valor === 1200 && r.total.publicacoes.valor === 4);
  confere("total sem comparação quando quem compara é só uma parte dele", r.total.seguidores.valor === 1600 && r.total.seguidores.variacao === null);
  const quase = montarResumo({
    dias: 7, hoje: "2026-01-10",
    contas: [conta("g", { seguidores: 9500, seguidores_antes: 9000 }), conta("h", { rede: "youtube", seguidores: 500, seguidores_antes: null })],
    publicacoes: [],
  });
  confere("total com comparação quando quem compara é quase tudo", quase.total.seguidores.valor === 10000 && Math.abs((quase.total.seguidores.variacao ?? 0) - 500 / 9000) < 1e-9);
  confere("o pódio é por interações e deixa de fora quem não teve nenhuma", r.melhores.map((p) => p.id).join(",") === "p1,p2,p4");
  confere("taxa só com base mínima de pessoas", r.melhores.find((p) => p.id === "p1")!.taxa !== null && r.melhores.find((p) => p.id === "p4")!.taxa === null);
  confere("post leva o nome da conta", r.melhores[0].conta === "@exemplo");
  confere("conta ligada sem leitura avisa", montarResumo({ dias: 7, hoje: "2026-01-10", contas: [conta("z", { lida_em: null })], publicacoes: [] }).semLeitura && !r.semLeitura);
  confere("contagem de posts compara quando a lista alcança o período anterior", Math.abs((a.publicacoes.variacao ?? 0) - 0.5) < 1e-9);

  // O caso que a primeira conta de verdade mostrou: 30 dias lidos, visão de 28, período anterior com 2 dias de número.
  const semDia = { alcance: null, visualizacoes: null, interacoes: null, visitas_ao_perfil: null, cliques_no_link: null };
  const serie28 = Array.from({ length: 28 }, (_, i) => dia(`2026-01-${String(i + 1).padStart(2, "0")}`, { visualizacoes: 10, interacoes: 1 }));
  const meio = (lidos: number, a: Partial<ContaCrua> = {}) =>
    montarResumo({
      dias: 28, hoje: "2026-01-28",
      contas: [conta("m", { rede: "youtube", serie: serie28, anterior: { ...semDia, visualizacoes: 13, interacoes: 0, dias: { visualizacoes: lidos, interacoes: lidos } }, posts: { quantos: 1, curtidas: 2, comentarios: 0, alcance: null, visualizacoes: 40 }, posts_antes: { quantos: 31, curtidas: 9, comentarios: 1, alcance: null, visualizacoes: 900 }, ...a })],
      publicacoes: [],
    }).contas[0];
  confere("período anterior lido pela metade não compara", meio(2).visualizacoes.valor === 280 && meio(2).visualizacoes.variacao === null && meio(2).interacoes.variacao === null);
  confere("período anterior quase inteiro compara", meio(24).visualizacoes.variacao !== null && meio(23).visualizacoes.variacao === null);
  confere("resposta antiga do banco, sem a contagem de dias, não compara", montarResumo({ dias: 28, hoje: "2026-01-28", contas: [conta("m", { serie: serie28, anterior: { ...semDia, visualizacoes: 13 } })], publicacoes: [] }).contas[0].visualizacoes.variacao === null);
  confere("sem post mais antigo que o período anterior, a contagem de posts não compara", meio(28).publicacoes.variacao === null && meio(28, { primeira_publicacao: "2025-12-20T12:00:00Z" }).publicacoes.variacao === null);
  confere("com história de posts, a queda na contagem aparece", Math.abs((meio(28, { primeira_publicacao: "2025-03-01T12:00:00Z" }).publicacoes.variacao ?? 0) - (1 - 31) / 31) < 1e-9);
  const soPosts = (primeira: string | null) =>
    montarResumo({
      dias: 28, hoje: "2026-01-28",
      contas: [conta("p", { rede: "youtube", serie: [], anterior: { ...semDia, dias: {} }, posts: { quantos: 2, curtidas: 20, comentarios: 0, alcance: null, visualizacoes: 600 }, posts_antes: { quantos: 2, curtidas: 10, comentarios: 0, alcance: null, visualizacoes: 300 }, primeira_publicacao: primeira })],
      publicacoes: [],
    }).contas[0];
  confere("rede sem número por dia compara pela soma dos posts, se a lista alcança", Math.abs((soPosts("2025-01-01T00:00:00Z").visualizacoes.variacao ?? 0) - 1) < 1e-9 && soPosts(null).visualizacoes.variacao === null);

  const vazio = montarResumo({ dias: 28, hoje: "2026-01-10", contas: [], publicacoes: [] });
  confere("sem conta nenhuma o resumo sai vazio e sem erro", vazio.contas.length === 0 && vazio.total.seguidores.valor === null && !vazio.semLeitura);

  confere("número compacto", compacto(1234) === "1.234" && compacto(12345) === "12,3 mil" && compacto(1234567) === "1,2 mi" && compacto(null) === "sem dado" && compacto(0) === "0");
  const agora = Date.parse("2026-01-10T12:00:00Z");
  confere("há quanto tempo", haQuanto("2026-01-10T11:48:00Z", agora) === "há 12 minutos" && haQuanto("2026-01-10T09:00:00Z", agora) === "há 3 horas" && haQuanto("2026-01-08T12:00:00Z", agora) === "há 2 dias" && haQuanto(null, agora) === null);
}

console.log("\nEm alta: comparado com o normal da própria conta");
{
  const pub = (id: string, a: Partial<PublicacaoDoConteudo>): PublicacaoDoConteudo => ({
    id, conta_id: "ig", rede: "instagram", id_na_rede: id, formato: "video_curto", legenda: "Legenda inventada", link: null, miniatura_url: null, publicado_em: "2026-01-09T12:00:00Z",
    curtidas: null, comentarios: null, salvos: null, compartilhamentos: null, alcance: null, visualizacoes: null, metricas_em: null, ...a,
  });
  confere("mediana de lista par, ímpar e vazia", mediana([3, 1, 2]) === 2 && mediana([4, 1, 3, 2]) === 2.5 && mediana([]) === null);
  confere("o tipo de cada formato", grupoDoFormato("video_curto") === "video" && grupoDoFormato("carrossel") === "foto" && grupoDoFormato("story") === "story" && grupoDoFormato(null) === "texto");

  // Seis Reels de 1.000 e um de 5.000 no Instagram; três vídeos no YouTube, um com 40.
  const reels = [1, 2, 3, 4, 5, 6].map((i) => pub(`r${i}`, { visualizacoes: 1000, curtidas: 50, comentarios: 5 }));
  const lista = [
    ...reels,
    pub("viral", { visualizacoes: 5000, curtidas: 400, comentarios: 30, salvos: 20, compartilhamentos: 50 }),
    pub("y1", { conta_id: "yt", rede: "youtube", visualizacoes: 10 }),
    pub("y2", { conta_id: "yt", rede: "youtube", visualizacoes: 12 }),
    pub("y3", { conta_id: "yt", rede: "youtube", visualizacoes: 40 }),
    pub("foto", { formato: "post", alcance: 300, curtidas: 30 }),
    pub("pouco", { formato: "post", alcance: 20, curtidas: 10 }),
  ];
  const a = analisarConteudos(lista);
  const viral = a.find((c) => c.id === "viral")!;
  confere("o normal é a mediana do mesmo tipo e da mesma conta", Math.abs((viral.fator ?? 0) - 5) < 1e-9 && viral.acima);
  confere("post comum não fica acima do normal", a.filter((c) => c.id.startsWith("r")).every((c) => c.fator === 1 && !c.acima));
  confere("grupo com menos de 5 não tem normal", a.filter((c) => c.conta_id === "yt").every((c) => c.fator === null && !c.acima));
  confere("foto não é comparada com vídeo", a.find((c) => c.id === "foto")!.fator === null);
  confere("interações somam o que a rede informou", viral.interacoes === 500 && a.find((c) => c.id === "y1")!.interacoes === null);
  confere("taxa de engajamento sobre quem viu", Math.abs((viral.taxa ?? 0) - 10) < 1e-9);
  confere("sem visualização, quem viu é o alcance", a.find((c) => c.id === "foto")!.vistos === 300);
  confere("taxa de poucos vistos não aparece", a.find((c) => c.id === "pouco")!.taxa === null);
  confere("ordenar põe o maior primeiro e quem não tem número no fim", ordenarConteudos(a, "visualizacoes")[0].id === "viral" && ordenarConteudos(a, "salvos")[0].id === "viral");
  const soPeriodo = analisarConteudos([lista[6]], lista);
  confere("o normal pode vir de um período maior que o mostrado", soPeriodo.length === 1 && Math.abs((soPeriodo[0].fator ?? 0) - 5) < 1e-9);
  confere("fator em palavra", fatorEmPalavra(2.44) === "2,4×" && fatorEmPalavra(12.3) === "12×");
  // O caso da primeira leitura de verdade: cinco posts só com interações e um com visualizações já lidas.
  const misturado = analisarConteudos([
    ...[1, 2, 3, 4, 5].map((i) => pub(`i${i}`, { conta_id: "fb", rede: "facebook", formato: "post", curtidas: 10 })),
    pub("lido", { conta_id: "fb", rede: "facebook", formato: "post", visualizacoes: 4770, curtidas: 12 }),
  ]);
  confere("régua diferente não se compara (visualização contra curtida)", misturado.find((c) => c.id === "lido")!.fator === null && misturado.find((c) => c.id === "i1")!.fator === 1);
}

console.log("\nCalendário e melhores horários");
{
  confere("mês lido do endereço", lerMes("2026-11") === "2026-11" && lerMes("2026-13") === null && lerMes("x") === null && lerMes(undefined) === null);
  confere("mês vizinho vira o ano", mesVizinho("2026-12", 1) === "2027-01" && mesVizinho("2026-01", -1) === "2025-12");
  confere("nome do mês", nomeDoMes("2026-11") === "novembro de 2026");
  const grade = diasDaGrade("2026-11", "2026-11-16");
  confere("grade começa no domingo e fecha no sábado", grade[0].data === "2026-11-01" && grade[grade.length - 1].data === "2026-12-05" && grade.length % 7 === 0);
  confere("grade marca o dia de hoje e os dias de fora", grade.find((d) => d.hoje)?.data === "2026-11-16" && !grade[grade.length - 1].doMes);
  const fev = diasDaGrade("2026-02", "2026-02-01");
  confere("fevereiro de 2026 começa no domingo e tem quatro semanas", fev[0].data === "2026-02-01" && fev.length === 28);
  const { de, ate } = intervaloDaGrade(grade);
  confere("intervalo da grade em meia-noite de Brasília", de === "2026-11-01T03:00:00.000Z" && ate === "2026-12-06T03:00:00.000Z");
  confere("o dia de um post é o de Brasília, não o do servidor", diaEmSaoPaulo("2026-11-17T01:30:00Z") === "2026-11-16");
  const item = (chave: string, quando: string): ItemDoCalendario => ({ chave, situacao: "publicado", quando, redes: ["instagram"], formato: "post", legenda: "", miniatura: null, href: "/", sequencia: null });
  const mapa = porDia([item("b", "2026-11-16T22:00:00Z"), item("a", "2026-11-16T12:00:00Z"), item("c", "2026-11-17T02:59:00Z")]);
  confere("itens por dia, em ordem de hora", mapa.get("2026-11-16")?.map((i) => i.chave).join(",") === "a,b,c");
  confere("hora curta", horaCurta("2026-11-16T22:00:00Z") === "19h" && horaCurta("2026-11-16T12:30:00Z") === "9h30");

  confere("hora em Brasília", horaEmSaoPaulo("2026-11-16T22:10:00Z") === 19);
  confere("faixa em palavra", faixaEmPalavra(18) === "18h às 21h" && faixaEmPalavra(21) === "21h às 0h");
  const conteudo = (id: string, hora: string, fator: number, grupo: "video" | "story" = "video") => ({ ...analisarConteudos([])[0], id, rede: "instagram" as const, grupo, fator, publicado_em: `2026-11-1${id.length % 7}T${hora}:00-03:00` }) as Parameters<typeof melhoresHorarios>[0][number];
  const noite = [1, 2, 3, 4, 5, 6].map((i) => conteudo(`n${i}`, "19:10", 2));
  const tarde = [1, 2, 3, 4, 5, 6].map((i) => conteudo(`t${i}`, "13:00", 1));
  const poucos = [1, 2].map((i) => conteudo(`m${i}`, "07:00", 9));
  const stories = [1, 2, 3, 4, 5, 6].map((i) => conteudo(`s${i}`, "10:00", 9, "story"));
  const h = melhoresHorarios([...noite, ...tarde, ...poucos, ...stories]);
  confere("a melhor faixa é a de mediana mais alta", h[0]?.melhor?.inicio === 18 && Math.abs((h[0]?.melhor?.mediana ?? 0) - 2) < 1e-9 && h[0]?.melhor?.posts === 6);
  confere("faixa com poucos posts não entra", !h[0].faixas.some((f) => f.inicio === 6));
  confere("story não entra na conta dos horários", !h[0].faixas.some((f) => f.inicio === 9));
  const agora = Date.parse("2026-11-16T20:00:00Z"); // 17h em Brasília
  confere("próximos horários a partir de agora", proximosHorarios([18, 12], agora, 3).join(",") === ["2026-11-16T22:00:00.000Z", "2026-11-17T16:00:00.000Z", "2026-11-17T22:00:00.000Z"].join(","));
  confere("horário com menos de meia hora de folga fica de fora", proximosHorarios([15], Date.parse("2026-11-16T18:45:00Z"), 1)[0] === "2026-11-17T19:00:00.000Z");
}

console.log("\nEndereço assinado (S3 e R2)");
{
  // O exemplo publicado na documentação da AWS ("Authenticating Requests: Using Query Parameters"), com as chaves de exemplo dela.
  const url = enderecoAssinado({
    metodo: "GET", host: "examplebucket.s3.amazonaws.com", caminho: "/test.txt", chaveDeAcesso: "AKIAIOSFODNN7EXAMPLE",
    chaveSecreta: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY", regiao: "us-east-1", validade: 86400, agora: new Date("2013-05-24T00:00:00Z"),
  });
  confere("a assinatura bate com o exemplo da documentação da AWS", url.endsWith("X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404"), url);
  confere("a credencial vai codificada e a data no formato certo", url.includes("X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20130524%2Fus-east-1%2Fs3%2Faws4_request") && url.includes("X-Amz-Date=20130524T000000Z"));
  const comEspaco = enderecoAssinado({ metodo: "PUT", host: "c.r2.cloudflarestorage.com", caminho: "/balde/2026/11/a b.jpg", chaveDeAcesso: "id", chaveSecreta: "segredo", regiao: "auto", validade: 60, agora: new Date("2026-01-01T00:00:00Z") });
  confere("caminho com espaço é codificado e a barra fica", comEspaco.startsWith("https://c.r2.cloudflarestorage.com/balde/2026/11/a%20b.jpg?"));
  confere("a chave secreta não aparece no endereço", !comEspaco.includes("segredo"));
}

console.log("\nRegra de automação");
{
  confere("normaliza acento, maiúscula e espaço", normalizar("  Preço   ÓTIMO ") === "preco otimo");
  confere("lê palavras separadas por vírgula, ponto e vírgula e linha", JSON.stringify(lerPalavras("preço, valor; quanto custa\n#catalogo")) === '["preço","valor","quanto custa","catalogo"]');
  confere("tira repetida (mesmo com acento diferente), curta e vazia", JSON.stringify(lerPalavras("preço, PRECO, a, , valor")) === '["preço","valor"]');
  confere("no máximo 12 palavras", lerPalavras(Array.from({ length: 20 }, (_, i) => `palavra${i}`).join(",")).length === 12);
  confere("casa sem ligar para acento e maiúscula", palavraQueCasa("Qual o PRECO dessa?", ["preço"]) === "preço");
  confere("casa no começo, no fim e com pontuação colada", palavraQueCasa("preço?", ["preço"]) !== null && palavraQueCasa("me passa o preço", ["preço"]) !== null && palavraQueCasa("(preço)", ["preço"]) !== null);
  confere("não casa pedaço de palavra", palavraQueCasa("tenho muito apreço por vocês", ["preço"]) === null && palavraQueCasa("valorizo demais", ["valor"]) === null);
  confere("casa expressão de duas palavras", palavraQueCasa("Quanto   custa a de 4 mm?", ["quanto custa"]) === "quanto custa" && palavraQueCasa("quanto que custa", ["quanto custa"]) === null);
  confere("palavra com sinal de expressão regular não quebra", palavraQueCasa("quero o kit (2)", ["kit (2)"]) === "kit (2)" && palavraQueCasa("qualquer coisa", [".*"]) === null);
  confere("comentário vazio não casa", palavraQueCasa("", ["preço"]) === null && palavraQueCasa("   ", ["preço"]) === null);

  const regra = { nome: "Preço", palavras: ["preço"], resposta: "O preço de cada modelo está no site.", esperaMin: 30, limitePorHora: 20 };
  confere("regra boa passa", conferirRegra(regra) === null);
  confere("regra sem palavra é recusada", /pelo menos uma palavra/.test(conferirRegra({ ...regra, palavras: [] }) ?? ""));
  confere("resposta com travessão é recusada", /travessão/.test(conferirRegra({ ...regra, resposta: "Preço — no site" }) ?? ""));
  confere("resposta de 501 caracteres é recusada", /500/.test(conferirRegra({ ...regra, resposta: "a".repeat(501) }) ?? ""));
  confere("espera abaixo de 10 minutos é recusada", /10 minutos/.test(conferirRegra({ ...regra, esperaMin: 5 }) ?? ""));
  confere("limite acima de 60 por hora é recusado", /1 a 60/.test(conferirRegra({ ...regra, limitePorHora: 61 }) ?? ""));

  const agora = Date.parse("2026-01-10T12:00:00Z");
  const ligada = { palavras: ["preço"], ativadaEm: "2026-01-10T08:00:00Z", esperaMin: 30 };
  const c = (a: Partial<Parameters<typeof deveResponder>[0]>) => ({ texto: "qual o preço?", quando: "2026-01-10T11:00:00Z", nosso: false, ehResposta: false, estado: "novo", ...a });
  confere("comentário novo, de terceiro, com a espera cumprida: responde", deveResponder(c({}), ligada, agora) === "preço");
  confere("comentário de antes de a regra ser ligada não é respondido", deveResponder(c({ quando: "2026-01-10T07:59:00Z" }), ligada, agora) === null);
  confere("comentário mais novo que a espera ainda não é respondido", deveResponder(c({ quando: "2026-01-10T11:45:00Z" }), ligada, agora) === null);
  confere("comentário já respondido, visto ou oculto não é respondido", ["respondido", "visto", "oculto"].every((e) => deveResponder(c({ estado: e }), ligada, agora) === null));
  confere("resposta a outro comentário e comentário da própria conta ficam de fora", deveResponder(c({ ehResposta: true }), ligada, agora) === null && deveResponder(c({ nosso: true }), ligada, agora) === null);
  confere("comentário sem data não é respondido", deveResponder(c({ quando: null }), ligada, agora) === null);
  confere("comentário que não tem a palavra não é respondido", deveResponder(c({ texto: "que linda" }), ligada, agora) === null);
}

console.log("\nSegredo fora da tela");
{
  // A tela de ligações é a mesma em Integrações e em Redes. Ela não pode receber nem imprimir credencial.
  const tela = readFileSync("src/components/redes/Ligacoes.tsx", "utf8");
  const painel = readFileSync("src/lib/redes/painel.ts", "utf8");
  confere("a tela de ligações não conhece credencial", !/credenciais|cifrado|access_token|refresh_token/.test(tela));
  confere("o que vai para a tela não lê o cofre", !/redes_credenciais|decifrar|credenciaisAtivas/.test(painel));
  confere("campo de token e de chave é de senha e nasce vazio", (tela.match(/type="password"/g) ?? []).length === 2 && !/name="valor"[^>]*defaultValue/.test(tela) && !/name="app_segredo"[^>]*defaultValue/.test(tela));
  const rota = readFileSync("src/app/api/cron/redes/route.ts", "utf8");
  confere("a rota da rotina confere o segredo antes de tudo e grava o pulso", rota.indexOf("cronAutorizado") < rota.indexOf("lerRedes(") && /registrarPulso\(supabase, "redes"/.test(rota));
  const cofre = readFileSync("src/lib/redes/cofre.ts", "utf8");
  confere("o cofre não usa variável pública", !/NEXT_PUBLIC_/.test(cofre) && /aes-256-gcm/.test(cofre));
}

if (falhas > 0) {
  console.error(`\n${falhas} ${falhas === 1 ? "conferência falhou" : "conferências falharam"}.`);
  process.exit(1);
}
console.log("\nTudo certo.");
