/**
 * A fila da fábrica: as etapas, como ler o que cada peça pede e quando um
 * pedido está esperando demais.
 *
 * O pedido chega da loja com tudo o que a produção precisa escrito num campo
 * só, separado por quebra de linha: numeração de cada aro, tipo e texto da
 * gravação, anel escolhido, caixinha. `lerEspecificacoes` abre esse campo em
 * linhas e separa as duas coisas que não podem errar: a numeração e o que vai
 * gravado.
 *
 * Arquivo puro, para o teste rodar sem banco.
 */
import type { Tom } from "../painel/tons.ts";

export type Etapa = "a_produzir" | "em_producao" | "pronto" | "enviado";

export const ETAPAS: { chave: Etapa; nome: string; frase: string }[] = [
  { chave: "a_produzir", nome: "A produzir", frase: "Pago na loja, esperando a fábrica começar" },
  { chave: "em_producao", nome: "Em produção", frase: "Na bancada" },
  { chave: "pronto", nome: "Pronto", frase: "Feito, esperando sair" },
  { chave: "enviado", nome: "Enviado", frase: "Saiu da fábrica" },
];

export const NOME_DA_ETAPA = Object.fromEntries(ETAPAS.map((e) => [e.chave, e.nome])) as Record<Etapa, string>;

/** O texto do botão que LEVA o pedido para a etapa. */
export const ACAO_PARA: Record<Etapa, string> = {
  a_produzir: "Voltar para a fila",
  em_producao: "Começar a produzir",
  pronto: "Marcar como pronto",
  enviado: "Marcar como enviado",
};

export function lerEtapa(v: unknown): Etapa | null {
  return ETAPAS.some((e) => e.chave === v) ? (v as Etapa) : null;
}

export function proximaEtapa(e: Etapa): Etapa | null {
  const i = ETAPAS.findIndex((x) => x.chave === e);
  return ETAPAS[i + 1]?.chave ?? null;
}

export function etapaAnterior(e: Etapa): Etapa | null {
  const i = ETAPAS.findIndex((x) => x.chave === e);
  return i > 0 ? ETAPAS[i - 1].chave : null;
}

// ---------------------------------------------------------------- a espera

/**
 * PREMISSAS, não regra da JK: a partir de quantos dias corridos desde o
 * pagamento um pedido que ainda não saiu ganha âmbar e vermelho. Foram postos
 * para a fila ter uma ordem de urgência desde o primeiro dia; a tela diz os
 * dois números por extenso. Quando a JK disser o prazo de produção de verdade,
 * é trocar aqui.
 */
export const DIAS_DE_ATENCAO = 4;
export const DIAS_DE_ATRASO = 7;

/** Dias corridos entre dois dias `AAAA-MM-DD`. */
export function diasEntreDatas(de: string, ate: string): number {
  return Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86_400_000);
}

/** A cor da espera. Pedido enviado não espera mais nada. */
export function tomDaEspera(dias: number, etapa: Etapa): Tom {
  if (etapa === "enviado") return "neutro";
  if (dias >= DIAS_DE_ATRASO) return "ruim";
  if (dias >= DIAS_DE_ATENCAO) return "atencao";
  return "neutro";
}

export function esperaEmPalavra(dias: number): string {
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  return `há ${dias} dias`;
}

// --------------------------------------------------------- o que a peça pede

export type Especificacao = {
  rotulo: string;
  valor: string;
  /** `aro`: numeração. `gravar`: o texto que vai na peça. `outro`: o resto (modelo de gravação, anel, caixinha). */
  tipo: "aro" | "gravar" | "outro";
};

const ENTIDADES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " " };

/**
 * O campo de informação adicional do item, aberto em linhas.
 *
 * Vem assim da loja: `Numeração - Aro 01: 16<br />Modelo de Gravação: 1.
 * Gravação Laser<br />Gravação - Aro 01: Paulo victor<br />`. As opções de
 * lista chegam com o número da opção na frente ("1. Gravação Laser"): o número
 * sai, porque para quem produz ele não quer dizer nada. O texto a gravar fica
 * EXATAMENTE como o cliente escreveu, com maiúsculas e espaços do meio: é o
 * que vai para a peça.
 */
export function lerEspecificacoes(info: string | null | undefined): Especificacao[] {
  if (!info) return [];
  const linhas = info
    .split(/<br\s*\/?>|\r?\n/i)
    .map((l) => l.replace(/<[^>]+>/g, "").replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, (e) => ENTIDADES[e] ?? e).trim())
    .filter(Boolean);

  const lista: Especificacao[] = [];
  for (const linha of linhas) {
    const corte = linha.indexOf(":");
    if (corte <= 0) {
      lista.push({ rotulo: "Observação", valor: linha, tipo: "outro" });
      continue;
    }
    const rotulo = linha.slice(0, corte).trim();
    const cru = linha.slice(corte + 1).trim();
    if (!cru) continue;
    const semAcento = rotulo.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    const tipo: Especificacao["tipo"] = semAcento.startsWith("numeracao")
      ? "aro"
      : semAcento.startsWith("gravacao") && !semAcento.includes("modelo")
        ? "gravar"
        : "outro";
    // O número da opção só sai do que é escolha de lista, nunca do texto a gravar nem da numeração.
    const valor = tipo === "outro" ? cru.replace(/^\d{1,2}\.\s+/, "") : cru;
    lista.push({ rotulo, valor, tipo });
  }
  return lista;
}

// ------------------------------------------------------------------ entrega

export type Entrega = { tipo: "retirada" | "motoboy" | "correios" | "envio"; nome: string };

/**
 * Como o pedido sai, pelo nome do frete que a loja gravou. Retirada em loja e
 * motoboy mudam para onde a peça vai quando fica pronta, então ganham nome
 * próprio; o resto é envio.
 */
export function lerEntrega(frete: string | null | undefined): Entrega | null {
  const f = (frete ?? "").trim();
  if (!f) return null;
  const retirada = /^retir[ae]\s+na\s+loja\s+(?:d[oae]s?\s+)?(.+)$/i.exec(f);
  if (retirada) return { tipo: "retirada", nome: `Retirada: ${retirada[1].trim()}` };
  if (/motoboy/i.test(f)) return { tipo: "motoboy", nome: "Motoboy" };
  if (/sedex/i.test(f)) return { tipo: "correios", nome: "Correios SEDEX" };
  if (/\bpac\b/i.test(f)) return { tipo: "correios", nome: "Correios PAC" };
  if (/correios/i.test(f)) return { tipo: "correios", nome: "Correios" };
  return { tipo: "envio", nome: f };
}

// ------------------------------------------------------------------- filtro

/** Como o pedido sai, em três grupos: é por onde a bancada separa as peças prontas. */
export type GrupoDeEntrega = "retirada" | "motoboy" | "envio";

export const NOME_DO_GRUPO: Record<GrupoDeEntrega, string> = {
  retirada: "Retirada na loja",
  motoboy: "Motoboy",
  envio: "Correios e envio",
};

export function grupoDaEntrega(frete: string | null | undefined): GrupoDeEntrega | null {
  const e = lerEntrega(frete);
  if (!e) return null;
  return e.tipo === "retirada" ? "retirada" : e.tipo === "motoboy" ? "motoboy" : "envio";
}

/** O que o filtro precisa saber de um pedido. O pedido da fila tem tudo isso e mais. */
export type PedidoParaFiltro = {
  pedido: number;
  dia: string;
  etapa: Etapa;
  cliente: string | null;
  cidade: string | null;
  entrega: string | null;
  rastreio: string | null;
  nota: string | null;
  pecas: { nome: string; referencia: string | null; info: string | null }[];
};

export type FiltroDaFila = {
  busca: string;
  entrega: GrupoDeEntrega | "todas";
  soAtrasados: boolean;
  soComNota: boolean;
};

export const SEM_FILTRO: FiltroDaFila = { busca: "", entrega: "todas", soAtrasados: false, soComNota: false };

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * A busca procura em tudo o que está escrito no cartão: número do pedido,
 * cliente, cidade, loja de retirada, peça, referência, numeração, texto da
 * gravação, rastreio e anotação. Sem acento e sem maiúscula, e com mais de uma
 * palavra todas precisam aparecer ("osasco eternal" acha a Eternal Love que
 * retira em Osasco).
 */
export function filtrarFila<T extends PedidoParaFiltro>(pedidos: T[], f: FiltroDaFila, hoje: string): T[] {
  const palavras = semAcento(f.busca).split(/\s+/).filter(Boolean);
  return pedidos.filter((p) => {
    if (f.entrega !== "todas" && grupoDaEntrega(p.entrega) !== f.entrega) return false;
    if (f.soAtrasados && tomDaEspera(diasEntreDatas(p.dia, hoje), p.etapa) !== "ruim") return false;
    if (f.soComNota && !p.nota) return false;
    if (palavras.length === 0) return true;
    const texto = semAcento(
      [
        p.pedido, p.cliente, p.cidade, p.entrega, p.rastreio, p.nota,
        ...p.pecas.flatMap((x) => [x.nome, x.referencia, (x.info ?? "").replace(/<[^>]+>/g, " ")]),
      ].filter(Boolean).join(" "),
    );
    return palavras.every((w) => texto.includes(w));
  });
}
