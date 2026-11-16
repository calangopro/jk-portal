/**
 * O resumo das redes: transforma o que `redes_resumo()` devolve (0083) nos
 * números que a tela "Todas as redes" mostra. Conta pura, com teste em
 * `scripts/teste-redes.mts`.
 *
 * TRÊS REGRAS
 *
 * 1. Número que a rede não informa é NULO, nunca zero. O YouTube não diz
 *    alcance, o Facebook não diz salvos: a tela escreve "a rede não informa".
 *    Somar nulo como zero faria uma rede parecer pior do que é.
 * 2. Seguidores somados entre redes é "audiência somada", e a tela diz isso: a
 *    mesma pessoa que segue no Instagram e no TikTok conta duas vezes.
 * 3. A variação compara o período com o período ANTERIOR de mesmo tamanho. Sem
 *    dado do período anterior (conta ligada ontem), não há variação: vem nulo e
 *    a tela escreve "sem comparação".
 */
import type { RedeId } from "./redes.ts";

export type DiaCru = {
  dia: string;
  seguidores: number | null;
  alcance: number | null;
  visualizacoes: number | null;
  interacoes: number | null;
  visitas_ao_perfil: number | null;
  cliques_no_link: number | null;
  novos_seguidores: number | null;
};

type SomaDePosts = {
  quantos: number | null;
  curtidas: number | null;
  comentarios: number | null;
  salvos?: number | null;
  compartilhamentos?: number | null;
  alcance: number | null;
  visualizacoes: number | null;
};

export type ContaCrua = {
  id: string;
  rede: RedeId;
  nome: string | null;
  usuario: string | null;
  foto_url: string | null;
  link: string | null;
  status: "ativa" | "expirada" | "desligada";
  ultimo_erro: string | null;
  lida_em: string | null;
  expira_em: string | null;
  seguidores: number | null;
  seguidores_antes: number | null;
  serie: DiaCru[];
  anterior: { alcance: number | null; visualizacoes: number | null; interacoes: number | null; visitas_ao_perfil: number | null; cliques_no_link: number | null } | null;
  posts: SomaDePosts | null;
  posts_antes: SomaDePosts | null;
};

export type PublicacaoCrua = {
  id: string;
  conta_id: string;
  rede: RedeId;
  id_na_rede: string;
  formato: string | null;
  legenda: string | null;
  link: string | null;
  miniatura_url: string | null;
  publicado_em: string | null;
  curtidas: number | null;
  comentarios: number | null;
  salvos: number | null;
  compartilhamentos: number | null;
  alcance: number | null;
  visualizacoes: number | null;
};

export type ResumoCru = { dias: number; hoje: string; contas: ContaCrua[]; publicacoes: PublicacaoCrua[] };

/** Um número com a variação contra o período anterior (fração: 0,12 = subiu 12%). */
export type Medida = { valor: number | null; variacao: number | null };

export type ContaNoResumo = {
  id: string;
  rede: RedeId;
  nome: string;
  usuario: string | null;
  fotoUrl: string | null;
  link: string | null;
  status: ContaCrua["status"];
  ultimoErro: string | null;
  lidaEm: string | null;
  seguidores: Medida;
  /** Quantos seguidores a conta ganhou (ou perdeu) no período. */
  ganho: number | null;
  alcance: Medida;
  visualizacoes: Medida;
  interacoes: Medida;
  visitasAoPerfil: Medida;
  cliquesNoLink: Medida;
  publicacoes: Medida;
  /** Interações a cada 100 pessoas alcançadas ou, na rede que não informa alcance, a cada 100 visualizações. Nulo sem nenhuma das duas. */
  engajamento: number | null;
  /** Sobre o que o engajamento foi calculado: muda a frase da tela. */
  baseDoEngajamento: "pessoas" | "visualizações" | null;
  /** Seguidores por dia, para o minigráfico. Só os dias com número. */
  serieDeSeguidores: number[];
  /** Visualizações (ou alcance) por dia. */
  serieDeAlcance: number[];
};

export type PublicacaoNoResumo = PublicacaoCrua & {
  /** Curtidas, comentários, salvos e compartilhamentos somados. */
  interacoes: number;
  /** Interações por 100 pessoas alcançadas (ou por 100 visualizações). Nulo sem a base. */
  taxa: number | null;
  conta: string;
};

export type Resumo = {
  dias: number;
  contas: ContaNoResumo[];
  total: {
    seguidores: Medida;
    ganho: number | null;
    visualizacoes: Medida;
    alcance: Medida;
    interacoes: Medida;
    publicacoes: Medida;
  };
  melhores: PublicacaoNoResumo[];
  recentes: PublicacaoNoResumo[];
  /** Há conta ligada mas nenhuma leitura ainda (acabou de ligar). */
  semLeitura: boolean;
};

const numero = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v !== "" && Number.isFinite(Number(v)) ? Number(v) : null);

/** Soma que respeita o nulo: tudo nulo dá nulo, e não zero. */
export function somar(valores: (number | null | undefined)[]): number | null {
  let total: number | null = null;
  for (const v of valores) {
    const n = numero(v);
    if (n !== null) total = (total ?? 0) + n;
  }
  return total;
}

/** Variação em fração. Sem base (nula ou zero), não há o que comparar. */
export function variacao(agora: number | null, antes: number | null): number | null {
  if (agora === null || antes === null || antes <= 0) return null;
  return (agora - antes) / antes;
}

const medida = (agora: number | null, antes: number | null): Medida => ({ valor: agora, variacao: variacao(agora, antes) });

const interacoesDoPost = (p: PublicacaoCrua) => (numero(p.curtidas) ?? 0) + (numero(p.comentarios) ?? 0) + (numero(p.salvos) ?? 0) + (numero(p.compartilhamentos) ?? 0);

function contaNoResumo(c: ContaCrua): ContaNoResumo {
  const seguidores = numero(c.seguidores);
  const antes = numero(c.seguidores_antes);
  const col = (k: keyof DiaCru) => somar(c.serie.map((d) => d[k] as number | null));
  const posts = c.posts ?? { quantos: 0, curtidas: null, comentarios: null, salvos: null, compartilhamentos: null, alcance: null, visualizacoes: null };
  const postsAntes = c.posts_antes;

  // Os números por dia vêm da conta, quando a rede informa. Sem eles, vale a soma dos posts do período.
  const alcance = col("alcance") ?? numero(posts.alcance);
  const visualizacoes = col("visualizacoes") ?? numero(posts.visualizacoes);
  const interacoesDosPosts = somar([posts.curtidas, posts.comentarios, posts.salvos, posts.compartilhamentos]);
  const interacoes = col("interacoes") ?? interacoesDosPosts;

  const alcanceAntes = numero(c.anterior?.alcance) ?? numero(postsAntes?.alcance);
  const visualizacoesAntes = numero(c.anterior?.visualizacoes) ?? numero(postsAntes?.visualizacoes);
  const interacoesAntes = numero(c.anterior?.interacoes) ?? somar([postsAntes?.curtidas, postsAntes?.comentarios]);

  // O ganho pelos novos seguidores do dia, se a rede informa; senão, a diferença entre as duas fotos.
  const novos = col("novos_seguidores");
  const ganho = novos ?? (seguidores !== null && antes !== null ? seguidores - antes : null);

  const base = alcance ?? visualizacoes;
  return {
    id: c.id,
    rede: c.rede,
    nome: c.usuario || c.nome || c.rede,
    usuario: c.usuario,
    fotoUrl: c.foto_url,
    link: c.link,
    status: c.status,
    ultimoErro: c.ultimo_erro,
    lidaEm: c.lida_em,
    seguidores: medida(seguidores, antes),
    ganho,
    alcance: medida(alcance, alcanceAntes),
    visualizacoes: medida(visualizacoes, visualizacoesAntes),
    interacoes: medida(interacoes, interacoesAntes),
    visitasAoPerfil: medida(col("visitas_ao_perfil"), numero(c.anterior?.visitas_ao_perfil)),
    cliquesNoLink: medida(col("cliques_no_link"), numero(c.anterior?.cliques_no_link)),
    publicacoes: medida(numero(posts.quantos) ?? 0, numero(postsAntes?.quantos)),
    engajamento: interacoes !== null && base !== null && base > 0 ? (interacoes / base) * 100 : null,
    baseDoEngajamento: interacoes !== null && base !== null && base > 0 ? (alcance !== null ? "pessoas" : "visualizações") : null,
    serieDeSeguidores: c.serie.map((d) => numero(d.seguidores)).filter((v): v is number => v !== null),
    serieDeAlcance: c.serie.map((d) => numero(d.visualizacoes) ?? numero(d.alcance)).filter((v): v is number => v !== null),
  };
}

/** Publicação com poucas pessoas alcançadas tem taxa alta por acaso: fica fora do pódio. */
const MINIMO_PARA_RANKING = 50;

export function montarResumo(cru: ResumoCru): Resumo {
  const contas = cru.contas.filter((c) => c.status !== "desligada").map(contaNoResumo);
  const nomeDaConta = new Map(contas.map((c) => [c.id, c.nome]));

  const publicacoes: PublicacaoNoResumo[] = cru.publicacoes.map((p) => {
    const interacoes = interacoesDoPost(p);
    const base = numero(p.alcance) ?? numero(p.visualizacoes);
    return { ...p, interacoes, taxa: base !== null && base >= MINIMO_PARA_RANKING ? (interacoes / base) * 100 : null, conta: nomeDaConta.get(p.conta_id) ?? "" };
  });

  // O pódio é por interações, que toda rede informa: taxa só existe onde há alcance, e ordenar por
  // ela deixaria de fora as redes que não dizem quantas pessoas viram.
  const melhores = [...publicacoes].filter((p) => p.interacoes > 0).sort((a, b) => b.interacoes - a.interacoes).slice(0, 6);

  const soma = (f: (c: ContaNoResumo) => Medida) => {
    const agora = somar(contas.map((c) => f(c).valor));
    // O "antes" de cada conta sai da própria variação: valor / (1 + variação). Só entra quem tem comparação.
    const comBase = contas.filter((c) => f(c).valor !== null && f(c).variacao !== null);
    const antes = comBase.length ? somar(comBase.map((c) => (f(c).valor as number) / (1 + (f(c).variacao as number)))) : null;
    const agoraComparavel = comBase.length ? somar(comBase.map((c) => f(c).valor)) : null;
    return { valor: agora, variacao: variacao(agoraComparavel, antes) };
  };

  return {
    dias: cru.dias,
    contas,
    total: {
      seguidores: soma((c) => c.seguidores),
      ganho: somar(contas.map((c) => c.ganho)),
      visualizacoes: soma((c) => c.visualizacoes),
      alcance: soma((c) => c.alcance),
      interacoes: soma((c) => c.interacoes),
      publicacoes: soma((c) => c.publicacoes),
    },
    melhores,
    recentes: [...publicacoes].sort((x, y) => Date.parse(y.publicado_em ?? "") - Date.parse(x.publicado_em ?? "") || 0).slice(0, 12),
    semLeitura: contas.length > 0 && contas.every((c) => !c.lidaEm),
  };
}

/** 1.234 vira "1.234", 12.345 vira "12,3 mil", 1.234.567 vira "1,2 mi". Nulo vira "sem dado", por extenso. */
export function compacto(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "sem dado";
  const abs = Math.abs(n);
  if (abs < 10_000) return Math.round(n).toLocaleString("pt-BR");
  if (abs < 1_000_000) return `${(n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return `${(n / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
}

/** "há 12 minutos", "há 3 horas", "há 2 dias", a partir de dois instantes. */
export function haQuanto(quando: string | null, agora: number): string | null {
  if (!quando) return null;
  const m = Math.max(0, Math.round((agora - Date.parse(quando)) / 60_000));
  if (m < 2) return "agora há pouco";
  if (m < 90) return `há ${m} minutos`;
  const h = Math.round(m / 60);
  if (h < 36) return `há ${h} horas`;
  return `há ${Math.round(h / 24)} dias`;
}
