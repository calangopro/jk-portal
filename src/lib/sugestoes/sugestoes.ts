/**
 * Sugestões de melhoria do painel: o roadmap que o próprio time escreve.
 *
 * Em toda tela, o botão "Sugerir melhoria" (na barra de topo da `Moldura`)
 * abre uma janela com o texto e até quatro prints. O servidor converte cada
 * print em webp (`/api/painel/sugestoes`, com o sharp: o navegador do iPhone
 * não gera webp) e grava no balde privado. A tela `/admin/sugestoes` é o
 * roadmap: cada pessoa vê as próprias sugestões e a resposta; a diretoria vê
 * todas e muda o estado. As regras de acesso moram no banco (0140).
 *
 * Arquivo puro, para o teste rodar sem rede nem banco.
 */

export const ENDERECO_DAS_SUGESTOES = "/admin/sugestoes";
export const BALDE_DAS_SUGESTOES = "sugestoes";
/** O endereço do servidor que recebe a sugestão, sem o prefixo do site. */
export const ENDERECO_DO_ENVIO = "/api/painel/sugestoes";

export const MAXIMO_DE_PRINTS = 4;
export const MINIMO_DO_TEXTO = 5;
export const TETO_DO_TEXTO = 4000;
/**
 * O print chega ao servidor já reduzido pelo navegador. A função da Vercel
 * recusa corpo acima de 4,5 MB, então cada um vai com até 1 MB e o envio
 * inteiro com folga para o texto.
 */
export const TETO_DO_PRINT_NO_NAVEGADOR = 1_000_000;
export const TETO_DO_PRINT_RECEBIDO = 1_200_000;
export const TETO_DO_ENVIO = 4_400_000;
/** O lado maior do print guardado, em pixels: dá para ler letra de tela de computador. */
export const LADO_DO_PRINT = 2000;

export const ESTADOS = ["nova", "planejada", "em_andamento", "feita", "recusada"] as const;
export type EstadoDaSugestao = (typeof ESTADOS)[number];

export const NOME_DO_ESTADO: Record<EstadoDaSugestao, string> = {
  nova: "Nova",
  planejada: "Planejada",
  em_andamento: "Em andamento",
  feita: "Feita",
  recusada: "Não vai entrar",
};

/** Abertas é o que ainda vai virar alguma coisa: a visão padrão do roadmap. */
export const ABERTAS: readonly EstadoDaSugestao[] = ["nova", "planejada", "em_andamento"];

export const ehEstado = (v: unknown): v is EstadoDaSugestao => typeof v === "string" && (ESTADOS as readonly string[]).includes(v);

export type Sugestao = {
  id: number;
  criadaEm: string;
  minha: boolean;
  /** Nome de quem sugeriu. Só chega para a diretoria e para a própria pessoa. */
  autor: string | null;
  tela: string;
  telaNome: string | null;
  aparelho: "celular" | "computador" | null;
  janela: string | null;
  texto: string;
  /** Os caminhos no balde privado. Viram link assinado no servidor. */
  imagens: string[];
  estado: EstadoDaSugestao;
  resposta: string | null;
  estadoMudouEm: string | null;
  estadoPor: string | null;
  /** O cartão do Roadmap (0141) em que a sugestão virou trabalho. Com cartão, o estado anda com ele. */
  cartao: { id: number; coluna: string } | null;
};

export type Roadmap = { diretoria: boolean; itens: Sugestao[] };

const texto = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/** A resposta de `sugestoes_lista` (0140). `null` quando não é o formato esperado. */
export function lerRoadmap(v: unknown): Roadmap | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (!Array.isArray(o.itens)) return null;
  const itens: Sugestao[] = [];
  for (const cru of o.itens) {
    if (!cru || typeof cru !== "object") continue;
    const s = cru as Record<string, unknown>;
    const id = Number(s.id);
    const criadaEm = texto(s.criada_em);
    const corpo = texto(s.texto);
    if (!Number.isInteger(id) || id <= 0 || !criadaEm || !corpo) continue;
    itens.push({
      id,
      criadaEm,
      minha: s.minha === true,
      autor: texto(s.autor),
      tela: texto(s.tela) ?? "/admin",
      telaNome: texto(s.tela_nome),
      aparelho: s.aparelho === "celular" || s.aparelho === "computador" ? s.aparelho : null,
      janela: texto(s.janela),
      texto: corpo,
      imagens: Array.isArray(s.imagens) ? s.imagens.filter((c): c is string => typeof c === "string" && /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/i.test(c)) : [],
      estado: ehEstado(s.estado) ? s.estado : "nova",
      resposta: texto(s.resposta),
      estadoMudouEm: texto(s.estado_mudou_em),
      estadoPor: texto(s.estado_por),
      cartao: lerCartaoDaSugestao(s.cartao),
    });
  }
  return { diretoria: o.diretoria === true, itens };
}

function lerCartaoDaSugestao(v: unknown): { id: number; coluna: string } | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const id = Number(o.id);
  return Number.isInteger(id) && id > 0 && typeof o.coluna === "string" ? { id, coluna: o.coluna } : null;
}

/** Quantas em cada estado, para o topo do roadmap. */
export function contarPorEstado(itens: Pick<Sugestao, "estado">[]): Record<EstadoDaSugestao, number> {
  const conta = Object.fromEntries(ESTADOS.map((e) => [e, 0])) as Record<EstadoDaSugestao, number>;
  for (const s of itens) conta[s.estado] += 1;
  return conta;
}

/** O endereço da tela de onde veio a sugestão vira link só quando é uma tela do painel. */
export const telaDoPainel = (tela: string): boolean => /^\/admin(\/[a-z0-9\-/]*)?$/i.test(tela);

/**
 * O pedido veio de uma página nossa? Atrás do proxy da Cloudflare o navegador
 * diz `www.jkaliancas.com.br` e a Vercel recebe o host dela mesma, por isso o
 * domínio da JK vale sempre; na prévia da Vercel, a origem é o próprio host.
 * Fora da produção, o computador de quem desenvolve. Sem cabeçalho `Origin`,
 * recusa: todo navegador manda `Origin` num POST.
 */
export function origemDaCasa(origem: string | null, hostDoPedido: string | null, producao: boolean): boolean {
  if (!origem) return false;
  let host: string;
  try {
    host = new URL(origem).host.toLowerCase();
  } catch {
    return false;
  }
  const semPorta = host.replace(/:\d+$/, "");
  if (semPorta === "jkaliancas.com.br" || semPorta.endsWith(".jkaliancas.com.br")) return true;
  if (hostDoPedido && host === hostDoPedido.toLowerCase()) return true;
  return !producao && (semPorta === "localhost" || semPorta === "127.0.0.1");
}

/** O que dizer para cada recusa do banco ou do servidor. */
export const MENSAGEM_DA_RECUSA: Record<string, string> = {
  sem_acesso: "O seu acesso não permite mandar sugestão. Fale com quem cuida do painel.",
  texto: `Escreva a sugestão com pelo menos ${MINIMO_DO_TEXTO} letras.`,
  imagens: `São até ${MAXIMO_DE_PRINTS} prints por sugestão.`,
  imagem: "Um dos prints não chegou. Tente de novo.",
  teto: "Você já mandou muitas sugestões hoje. Junte as próximas numa só, ou mande amanhã.",
};
