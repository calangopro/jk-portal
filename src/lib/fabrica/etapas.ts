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

/**
 * A chave de uma etapa. Desde a 0191 as etapas moram na tabela
 * `fabrica_etapas` e a diretoria cria etapa nova pelo painel, então a chave é
 * texto. Quatro chaves são fixas e outras funções do banco olham para elas:
 * `a_produzir` (a entrada, "Chegou pedido"), `em_producao`, `pronto` ("Enviar",
 * esperando sair) e `enviado` (final).
 */
export type Etapa = string;

export type PapelDaEtapa = "entrada" | "meio" | "final";

export type EtapaDaFabrica = {
  chave: Etapa;
  nome: string;
  frase: string | null;
  /** `#rrggbb`, a cor do selo da etapa. */
  cor: string;
  ativa: boolean;
  papel: PapelDaEtapa;
};

export const ENTRADA = "a_produzir";
export const ENVIADO = "enviado";
/** As finais fixas. Etapa criada no painel é sempre do meio. */
const FINAIS = new Set(["enviado", "entregue"]);

/**
 * As etapas de fábrica da 0191. Só servem quando a leitura do banco não trouxe
 * a lista (e para dar nome à etapa em tela que não lê a tabela): quem manda é
 * `fabrica_etapas`.
 */
export const ETAPAS_DE_FABRICA: EtapaDaFabrica[] = [
  { chave: "a_produzir", nome: "Chegou pedido", frase: "Pago, esperando a fábrica começar", cor: "#5b6472", ativa: true, papel: "entrada" },
  { chave: "separacao", nome: "Separação", frase: "Separando metal, pedras e caixinha", cor: "#1d5fa8", ativa: true, papel: "meio" },
  { chave: "em_producao", nome: "Produção", frase: "Na bancada", cor: "#6a3fb5", ativa: true, papel: "meio" },
  { chave: "gravacao", nome: "Gravação", frase: "Gravando o texto do cliente", cor: "#a3540f", ativa: true, papel: "meio" },
  { chave: "embalar", nome: "Embalar", frase: "Embalando com o cartão", cor: "#0e6e69", ativa: true, papel: "meio" },
  { chave: "verificar", nome: "Verificar", frase: "Conferência final antes de sair", cor: "#a3195b", ativa: true, papel: "meio" },
  { chave: "pronto", nome: "Enviar", frase: "Conferido, esperando sair", cor: "#1d6b3a", ativa: true, papel: "meio" },
  { chave: "enviado", nome: "Enviado", frase: "Saiu da fábrica", cor: "#2f3a48", ativa: true, papel: "final" },
  { chave: "entregue", nome: "Entregue", frase: "Na mão do cliente", cor: "#2f3a48", ativa: false, papel: "final" },
];

const CHAVE = /^[a-z][a-z0-9_]{1,39}$/;
const COR = /^#[0-9a-f]{6}$/;

export function lerEtapa(v: unknown): Etapa | null {
  return typeof v === "string" && CHAVE.test(v) ? v : null;
}

/** A lista que veio do banco, conferida. Vazia ou quebrada: a de fábrica. */
export function lerEtapas(cru: unknown): EtapaDaFabrica[] {
  if (!Array.isArray(cru)) return ETAPAS_DE_FABRICA;
  const lista: EtapaDaFabrica[] = [];
  for (const e of cru as Record<string, unknown>[]) {
    const chave = lerEtapa(e?.chave);
    const nome = typeof e?.nome === "string" ? e.nome.trim() : "";
    if (!chave || !nome) continue;
    const papel: PapelDaEtapa = e.papel === "entrada" || e.papel === "final" ? e.papel : "meio";
    lista.push({
      chave,
      nome,
      frase: typeof e.frase === "string" && e.frase.trim() ? e.frase.trim() : null,
      cor: typeof e.cor === "string" && COR.test(e.cor) ? e.cor : "#5b6472",
      ativa: e.ativa !== false,
      papel,
    });
  }
  return lista.some((e) => e.chave === ENTRADA) ? lista : ETAPAS_DE_FABRICA;
}

export const etapasAtivas = (etapas: EtapaDaFabrica[]) => etapas.filter((e) => e.ativa);

/** "polimento_extra" vira "Polimento extra": para etapa que a tela não conhece. */
const humanizar = (chave: string) => {
  const t = chave.replace(/_/g, " ").trim();
  return t ? t[0].toUpperCase() + t.slice(1) : chave;
};

export function nomeDaEtapa(chave: Etapa | null | undefined, etapas: EtapaDaFabrica[] = ETAPAS_DE_FABRICA): string {
  if (!chave) return ETAPAS_DE_FABRICA[0].nome;
  return etapas.find((e) => e.chave === chave)?.nome ?? ETAPAS_DE_FABRICA.find((e) => e.chave === chave)?.nome ?? humanizar(chave);
}

/** O trabalho saiu da fábrica: não espera mais nada. */
export const ehFinal = (chave: Etapa) => FINAIS.has(chave);

/** A próxima etapa LIGADA depois desta. Nada depois da primeira final. */
export function proximaEtapa(etapas: EtapaDaFabrica[], e: Etapa): Etapa | null {
  if (ehFinal(e)) return null;
  const ativas = etapasAtivas(etapas);
  const i = ativas.findIndex((x) => x.chave === e);
  return i >= 0 ? (ativas[i + 1]?.chave ?? null) : null;
}

export function etapaAnterior(etapas: EtapaDaFabrica[], e: Etapa): Etapa | null {
  const ativas = etapasAtivas(etapas);
  const i = ativas.findIndex((x) => x.chave === e);
  return i > 0 ? ativas[i - 1].chave : null;
}

/** O texto do botão que LEVA o trabalho para a etapa. */
export function acaoPara(e: EtapaDaFabrica): string {
  if (e.chave === ENTRADA) return "Voltar para o começo";
  if (e.chave === ENVIADO) return "Marcar como enviado";
  if (e.chave === "entregue") return "Marcar como entregue";
  return `Levar para ${e.nome}`;
}

// ------------------------------------------------- tipo, prioridade e prazo

export type TipoDeTrabalho = "venda_nova" | "troca" | "refazer" | "ajuste" | "upgrade" | "polimento" | "servico";

export const TIPOS: { chave: TipoDeTrabalho; nome: string }[] = [
  { chave: "venda_nova", nome: "Venda nova" },
  { chave: "troca", nome: "Troca" },
  { chave: "refazer", nome: "Refazer" },
  { chave: "ajuste", nome: "Ajuste" },
  { chave: "upgrade", nome: "Upgrade" },
  { chave: "polimento", nome: "Polimento" },
  { chave: "servico", nome: "Serviço" },
];

export const NOME_DO_TIPO = Object.fromEntries(TIPOS.map((t) => [t.chave, t.nome])) as Record<TipoDeTrabalho, string>;

export function lerTipo(v: unknown): TipoDeTrabalho {
  return TIPOS.some((t) => t.chave === v) ? (v as TipoDeTrabalho) : "venda_nova";
}

export type Prioridade = "normal" | "urgente" | "motoboy";

export const PRIORIDADES: { chave: Prioridade; nome: string; curta: string }[] = [
  { chave: "normal", nome: "Pedido normal", curta: "Normal" },
  { chave: "urgente", nome: "Urgente ou refazer", curta: "Urgente" },
  { chave: "motoboy", nome: "Motoboy, cliente precisa no dia", curta: "Motoboy" },
];

export const NOME_DA_PRIORIDADE = Object.fromEntries(PRIORIDADES.map((p) => [p.chave, p.curta])) as Record<Prioridade, string>;

export function lerPrioridade(v: unknown): Prioridade {
  return v === "urgente" || v === "motoboy" ? v : "normal";
}

/**
 * A fábrica termina antes do prazo da loja para sobrar tempo de levar a peça.
 * É a regra que o sistema do Daniel aplica (`calcularDataInternaFabrica`):
 * prazo menos 3 dias corridos, e o próprio prazo quando é urgente ou motoboy.
 * O comentário de lá fala em ciclos de malote; o código não faz isso, e a
 * regra de verdade está para ser confirmada com ele.
 */
export const DIAS_ANTES_DO_PRAZO = 3;

const somarDias = (dia: string, n: number) => new Date(Date.parse(`${dia}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const diaEMes = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;

/** A data em que a fábrica precisa terminar, `AAAA-MM-DD`. Sem prazo, nenhuma. */
export function dataInterna(prazo: string | null | undefined, prioridade: Prioridade): string | null {
  if (!prazo || !/^\d{4}-\d{2}-\d{2}$/.test(prazo)) return null;
  return prioridade === "normal" ? somarDias(prazo, -DIAS_ANTES_DO_PRAZO) : prazo;
}

/**
 * Como está o prazo de um trabalho, para o selo do cartão. Sem prazo, `null`:
 * quem dá a cor é a espera desde o pagamento (`tomDaEspera`).
 */
export function situacaoDoPrazo(p: { prazo: string | null; prioridade: Prioridade; etapa: Etapa }, hoje: string): { tom: Tom; palavra: string } | null {
  const interna = dataInterna(p.prazo, p.prioridade);
  if (!interna || !p.prazo || ehFinal(p.etapa)) return null;
  if (hoje > p.prazo) return { tom: "ruim", palavra: `Passou do prazo, ${diaEMes(p.prazo)}` };
  if (hoje >= interna) return { tom: "atencao", palavra: hoje === p.prazo ? "Prazo é hoje" : `Fábrica até ${diaEMes(interna)}, prazo ${diaEMes(p.prazo)}` };
  return { tom: "neutro", palavra: `Fábrica até ${diaEMes(interna)}` };
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

/** A cor da espera. Trabalho que saiu da fábrica não espera mais nada. */
export function tomDaEspera(dias: number, etapa: Etapa): Tom {
  if (ehFinal(etapa)) return "neutro";
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
  /** Número do pedido da loja. `null` em venda por fora. */
  pedido: number | null;
  /** Primeiro nome de quem vendeu, em venda por fora. */
  vendedor?: string | null;
  dia: string;
  etapa: Etapa;
  cliente: string | null;
  cidade: string | null;
  entrega: string | null;
  rastreio: string | null;
  nota: string | null;
  pecas: { nome: string; referencia: string | null; info: string | null }[];
  /** Código da ordem de serviço (0191). `null` em pedido antigo que ninguém tocou. */
  os?: number | null;
  tipo?: TipoDeTrabalho;
  prioridade?: Prioridade;
  prazo?: string | null;
};

/**
 * Atrasado é o que passou do prazo da loja ou, sem prazo, o que espera desde o
 * pagamento há mais que `DIAS_DE_ATRASO`. É a régua do filtro e da contagem.
 */
export function atrasado(p: PedidoParaFiltro, hoje: string): boolean {
  const prazo = situacaoDoPrazo({ prazo: p.prazo ?? null, prioridade: p.prioridade ?? "normal", etapa: p.etapa }, hoje);
  if (prazo) return prazo.tom === "ruim";
  return tomDaEspera(diasEntreDatas(p.dia, hoje), p.etapa) === "ruim";
}

const PESO_DA_PRIORIDADE: Record<Prioridade, number> = { motoboy: 0, urgente: 1, normal: 2 };

/**
 * A ordem da bancada: motoboy e urgente em cima, depois quem tem a data
 * interna mais perto, e por último a ordem de chegada. Trabalho sem prazo usa
 * o dia do pedido no lugar da data interna, para não ir para o fim só por não
 * ter prazo anotado.
 */
export function ordenarFila<T extends PedidoParaFiltro>(pedidos: T[]): T[] {
  const chave = (p: T) => dataInterna(p.prazo ?? null, p.prioridade ?? "normal") ?? p.dia;
  return pedidos
    .map((p, i) => ({ p, i }))
    .sort((a, b) =>
      PESO_DA_PRIORIDADE[a.p.prioridade ?? "normal"] - PESO_DA_PRIORIDADE[b.p.prioridade ?? "normal"]
      || chave(a.p).localeCompare(chave(b.p))
      || a.i - b.i)
    .map((x) => x.p);
}

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
 * código da OS ("1135" ou "os 1135"), tipo do trabalho, cliente, cidade, loja de retirada, peça, referência, numeração, texto da
 * gravação, rastreio e anotação. Sem acento e sem maiúscula, e com mais de uma
 * palavra todas precisam aparecer ("osasco eternal" acha a Eternal Love que
 * retira em Osasco).
 */
export function filtrarFila<T extends PedidoParaFiltro>(pedidos: T[], f: FiltroDaFila, hoje: string): T[] {
  const palavras = semAcento(f.busca).split(/\s+/).filter(Boolean);
  return pedidos.filter((p) => {
    if (f.entrega !== "todas" && grupoDaEntrega(p.entrega) !== f.entrega) return false;
    if (f.soAtrasados && !atrasado(p, hoje)) return false;
    if (f.soComNota && !p.nota) return false;
    if (palavras.length === 0) return true;
    const texto = semAcento(
      [
        // Venda por fora não tem número: é achada por "por fora" e pelo nome de quem vendeu.
        p.pedido ?? "venda por fora", p.os ? `os ${p.os} os${p.os}` : null, p.tipo ? NOME_DO_TIPO[p.tipo] : null, p.vendedor, p.cliente, p.cidade, p.entrega, p.rastreio, p.nota,
        ...p.pecas.flatMap((x) => [x.nome, x.referencia, (x.info ?? "").replace(/<[^>]+>/g, " ")]),
      ].filter(Boolean).join(" "),
    );
    return palavras.every((w) => texto.includes(w));
  });
}
