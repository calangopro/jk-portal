/**
 * Conversões do Google Ads pelo painel: a conta (quais pedidos entram, o que
 * vai no corpo, como ler a resposta). Arquivo puro, sem banco e sem rede, para
 * o teste rodar sozinho (`npm run verificar:google`). Quem fala com o Google e
 * com o banco é `envio.ts`.
 *
 * AS DUAS PEÇAS (migration 0135, docs/google-compra-paga.md):
 *
 * 1. RETIRADA. A etiqueta do GTM conta o pedido CRIADO como compra, na ação
 *    7575406236. O pedido que a Tray cancelou recebe um ajuste do tipo
 *    retirada (`RETRACTION`), pelo número do pedido, pela API do Google Ads
 *    (`customers/<conta>:uploadConversionAdjustments`). Prazos do Google: a
 *    conversão precisa ter pelo menos 24 horas (`TOO_RECENT_CONVERSION`) e no
 *    máximo 54 dias (`CONVERSION_EXPIRED`).
 * 2. COMPRA PAGA. O pedido pago de quem chegou por clique do Google vira
 *    conversão numa ação nova, pela Data Manager API (`events:ingest`), com o
 *    valor pago, BRL e o número do pedido. Não vai pela API do Google Ads:
 *    desde 15/06/2026 ela só aceita conversão de clique de projeto do Google
 *    Cloud que já mandava antes (`CUSTOMER_NOT_ALLOWLISTED_FOR_THIS_FEATURE`),
 *    e o projeto do painel é de setembro. A Data Manager não faz retirada, e
 *    por isso as duas peças vão por portas diferentes.
 *
 * PEDIDO PAGO NUNCA É RETIRADO. Nem o que foi pago e depois cancelado (estorno):
 * aquilo foi venda, e retirar ensinaria o anúncio a fugir de quem compra.
 */
import { createHash } from "node:crypto";

/**
 * A situação de um status da Tray. É a MESMA regra de `situacaoDoStatus`, em
 * `vendas/tray-csv.ts`, copiada porque módulo puro não importa função de outro
 * arquivo (o teste roda com `.ts` no caminho e o `tsc` recusa). O teste confere
 * que as duas dizem o mesmo.
 */
export function situacaoDoStatusDaTray(status: string): "pago" | "cancelado" | "aguardando" {
  const s = status.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  if (s.startsWith("cancelado")) return "cancelado";
  if (s.includes("aguardando pagamento")) return "aguardando";
  return "pago";
}

/** A conta "JK ALIANÇA" (135-588-7754). É o mesmo número de `trafego/plataformas.ts`. */
export const CONTA_DO_GOOGLE_ADS = "1355887754";
/** A API do Google Ads aposenta versão em cerca de um ano (a mesma de `trafego/plataformas.ts`). */
export const VERSAO_GOOGLE_ADS = "v26";

/** Prazos do Google, com folga. Cada um diz de onde veio. */
export const PRAZOS = {
  /** Ajuste em conversão com menos de 24 horas é recusado (`TOO_RECENT_CONVERSION`). Uma hora de folga. */
  retiradaMinimaHoras: 25,
  /** Ajuste em conversão com mais de 54 dias é recusado (`CONVERSION_EXPIRED`). Um dia de folga. */
  retiradaMaximaDias: 53,
  /** Espera depois do cancelamento, para o caso de a loja voltar atrás. Escolha nossa, não do Google. */
  esperaDoCancelamentoHoras: 6,
  /** Clique com menos de 6 horas é recusado (`TOO_RECENT_CLICK`). Uma hora de folga. */
  cliqueMinimoHoras: 7,
  /** O clique vale até 90 dias (`EXPIRED_CLICK`), e também até a janela da ação. */
  cliqueMaximoDias: 90,
  /** Pedidos por chamada: o Google aceita até 2.000. */
  lote: 500,
  /** Depois de tantas falhas passageiras, a linha desiste. */
  tentativasMaximas: 8,
  /** A Data Manager pede 30 minutos antes de perguntar como ficou, e processa em até 24 horas. */
  conferirDepoisMinutos: 30,
  desistirDeConferirHoras: 26,
} as const;

const HORA = 3_600_000;
const DIA = 24 * HORA;

// ---------------------------------------------------------------------------
// O interruptor

export type Config = {
  /** Liga a rotina. Desligada, ela não enfileira nem manda nada. */
  ligado: boolean;
  /** Modo de validação (`validate_only`): o Google lê e não grava. */
  validar: boolean;
  retirada: boolean;
  compraPaga: boolean;
  /** A ação da etiqueta do GTM, que conta o pedido criado. */
  acaoDaEtiqueta: string;
  /** A ação "Compra paga". Não existe ainda: o Filipe cria e cola o número. */
  acaoCompraPaga: string | null;
  /** Dia em que a etiqueta passou a usar o rótulo certo: antes disso ela não contava. */
  retirarDesde: string;
  /** Dia em que o coletor começou a anotar o clique: antes disso não há gclid. */
  compraPagaDesde: string;
  /** Manda e-mail e telefone em SHA-256 junto do clique. Pede os termos de dados do cliente aceitos. */
  dadosDoCliente: boolean;
  /** Manda também o pedido pago SEM clique, só com e-mail e telefone. Só vale com `dadosDoCliente`. */
  pedidosSemClique: boolean;
};

export const CONFIG_PADRAO: Config = {
  ligado: false,
  validar: true,
  retirada: true,
  compraPaga: true,
  acaoDaEtiqueta: "7575406236",
  acaoCompraPaga: null,
  retirarDesde: "2026-09-26",
  compraPagaDesde: "2026-11-13",
  dadosDoCliente: false,
  pedidosSemClique: false,
};

export const CHAVE_DA_CONFIG = "google:conversoes";

const ehDia = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const ehAcao = (v: unknown): v is string => typeof v === "string" && /^\d{4,20}$/.test(v);
const numeroDaAcao = (v: unknown): string | null => {
  const texto = typeof v === "number" ? String(v) : typeof v === "string" ? v.trim() : "";
  return ehAcao(texto) ? texto : null;
};

/**
 * O valor gravado em `site_settings`, conferido. Na dúvida, o lado seguro:
 * desligado, em validação e sem dado de cliente. Só `true` por extenso liga, e
 * só `false` por extenso tira da validação.
 */
export function lerConfig(valor: unknown): Config {
  const v = (valor && typeof valor === "object" ? valor : {}) as Record<string, unknown>;
  const dados = v.dados_do_cliente === true;
  return {
    ligado: v.ligado === true,
    validar: v.validar !== false,
    retirada: v.retirada !== false,
    compraPaga: v.compra_paga !== false,
    acaoDaEtiqueta: numeroDaAcao(v.acao_da_etiqueta) ?? CONFIG_PADRAO.acaoDaEtiqueta,
    acaoCompraPaga: numeroDaAcao(v.acao_compra_paga),
    retirarDesde: ehDia(v.retirar_desde) ? v.retirar_desde : CONFIG_PADRAO.retirarDesde,
    compraPagaDesde: ehDia(v.compra_paga_desde) ? v.compra_paga_desde : CONFIG_PADRAO.compraPagaDesde,
    dadosDoCliente: dados,
    pedidosSemClique: dados && v.pedidos_sem_clique === true,
  };
}

// ---------------------------------------------------------------------------
// Os pedidos

export type Clique = "gclid" | "gbraid" | "wbraid";

export type Candidato = {
  pedido: number;
  feitoEm: string;
  dia: string;
  situacao: string;
  status: string | null;
  statusAnterior: string | null;
  statusMudouEm: string | null;
  total: number;
  valorPago: number | null;
  pagamentoEm: string | null;
  email: string | null;
  telefone: string | null;
  clique: Clique | null;
  cliqueId: string | null;
  cliqueEm: string | null;
};

const texto = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const numero = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};
const instante = (v: unknown): string | null => {
  const t = texto(v);
  return t && Number.isFinite(Date.parse(t)) ? t : null;
};

/** Uma linha de `google_conversoes_candidatos`, conferida. */
export function lerCandidato(cru: Record<string, unknown>): Candidato | null {
  const pedido = numero(cru.pedido);
  const feitoEm = instante(cru.feito_em);
  const situacao = texto(cru.situacao);
  if (!pedido || pedido <= 0 || !Number.isInteger(pedido) || !feitoEm || !situacao) return null;
  const clique = texto(cru.clique);
  return {
    pedido,
    feitoEm,
    dia: texto(cru.dia) ?? feitoEm.slice(0, 10),
    situacao,
    status: texto(cru.status),
    statusAnterior: texto(cru.status_anterior),
    statusMudouEm: instante(cru.status_mudou_em),
    total: numero(cru.total) ?? 0,
    valorPago: numero(cru.valor_pago),
    pagamentoEm: ehDia(cru.pagamento_em) ? cru.pagamento_em : null,
    email: texto(cru.email),
    telefone: texto(cru.telefone),
    clique: clique === "gclid" || clique === "gbraid" || clique === "wbraid" ? clique : null,
    cliqueId: texto(cru.clique_id),
    cliqueEm: instante(cru.clique_em),
  };
}

export type Tipo = "retirada" | "compra_paga";

/** O que entra na fila: uma linha de `google_conversoes`. */
export type NovaLinha = {
  pedido: number;
  tipo: Tipo;
  pedido_em: string;
  momento: string;
  valor: number | null;
  moeda: string | null;
  clique: Clique | null;
  clique_id: string | null;
  clique_em: string | null;
  com_cliente: boolean;
  proxima_em: string;
};

export type MotivoDeFora =
  | "nao_cancelado"
  | "teve_pagamento"
  | "antes_do_corte"
  | "fora_do_prazo"
  | "nao_pago"
  | "sem_clique_do_google"
  | "clique_invalido"
  | "clique_velho"
  | "sem_valor"
  | "desligado";

export type Decisao = { entra: true; linha: NovaLinha } | { entra: false; motivo: MotivoDeFora };

export const MOTIVOS: Record<MotivoDeFora, string> = {
  nao_cancelado: "o pedido não está cancelado",
  teve_pagamento: "foi pago e depois cancelado (estorno): foi venda, não se retira",
  antes_do_corte: "é de antes do dia de corte",
  fora_do_prazo: "passou do prazo do Google",
  nao_pago: "o pedido não está pago",
  sem_clique_do_google: "a chegada que vale para o pedido não é clique do Google",
  clique_invalido: "o código do clique não tem a forma que o Google aceita",
  clique_velho: "o clique tem mais de 90 dias",
  sem_valor: "o pedido está sem valor",
  desligado: "esta peça está desligada",
};

const ms = (iso: string) => Date.parse(iso);
const iso = (t: number) => new Date(t).toISOString();
const maior = (...t: number[]) => Math.max(...t);

/** Dia (AAAA-MM-DD) de São Paulo de um instante. O Brasil não tem horário de verão desde 2019. */
export function diaEmSaoPaulo(instanteIso: string): string {
  return new Date(ms(instanteIso) - 3 * HORA).toISOString().slice(0, 10);
}

/** Qualquer sinal de que o pedido foi pago um dia. */
export function tevePagamento(c: Candidato): boolean {
  return c.situacao === "pago" || c.pagamentoEm !== null || (c.valorPago ?? 0) > 0;
}

/** O instante do cancelamento, quando a loja contou (a importação viu a troca). */
function momentoDoCancelamento(c: Candidato): number | null {
  if (!c.statusMudouEm || c.situacao !== "cancelado") return null;
  if (c.statusAnterior && situacaoDoStatusDaTray(c.statusAnterior) === "cancelado") return null;
  return ms(c.statusMudouEm);
}

export function decidirRetirada(c: Candidato, cfg: Config, agora: Date): Decisao {
  if (!cfg.retirada) return { entra: false, motivo: "desligado" };
  if (c.situacao !== "cancelado") return { entra: false, motivo: "nao_cancelado" };
  if (tevePagamento(c)) return { entra: false, motivo: "teve_pagamento" };
  if (diaEmSaoPaulo(c.feitoEm) < cfg.retirarDesde) return { entra: false, motivo: "antes_do_corte" };
  const feito = ms(c.feitoEm);
  const t = agora.getTime();
  if (t - feito > PRAZOS.retiradaMaximaDias * DIA) return { entra: false, motivo: "fora_do_prazo" };

  const cancelado = momentoDoCancelamento(c);
  // O ajuste precisa ser depois da conversão e não pode ser no futuro.
  const momento = Math.min(t, maior(cancelado ?? t, feito + 60_000));
  const proxima = maior(t, feito + PRAZOS.retiradaMinimaHoras * HORA, (cancelado ?? 0) + PRAZOS.esperaDoCancelamentoHoras * HORA);
  return {
    entra: true,
    linha: {
      pedido: c.pedido,
      tipo: "retirada",
      pedido_em: c.feitoEm,
      momento: iso(momento),
      valor: null,
      moeda: null,
      clique: null,
      clique_id: null,
      clique_em: null,
      com_cliente: false,
      proxima_em: iso(proxima),
    },
  };
}

/** O valor que entrou: o pago, ou o total quando a loja não informou o pago. */
export function valorDoPedido(c: Candidato): number {
  const v = (c.valorPago ?? 0) > 0 ? (c.valorPago as number) : c.total;
  return Math.round(v * 100) / 100;
}

/**
 * Quando o pedido virou pago. A loja não guarda a hora do pagamento: guarda o
 * dia (`pagamento_em`) e, quando a importação viu a troca de "aguardando" para
 * pago, o instante da troca. Sem nenhum dos dois, o pagamento foi na hora do
 * pedido (cartão aprovado na mesma tela), e vale a hora do pedido.
 */
export function momentoDoPagamento(c: Candidato): number {
  const feito = ms(c.feitoEm);
  if (c.statusMudouEm && c.statusAnterior && situacaoDoStatusDaTray(c.statusAnterior) === "aguardando") {
    return maior(feito, ms(c.statusMudouEm));
  }
  if (c.pagamentoEm && c.pagamentoEm > diaEmSaoPaulo(c.feitoEm)) {
    return maior(feito, ms(`${c.pagamentoEm}T12:00:00-03:00`));
  }
  return feito;
}

/** gclid, gbraid e wbraid são base64 de URL: letras, números, `-` e `_`. */
export function cliqueValido(id: string | null): boolean {
  return Boolean(id && /^[A-Za-z0-9_-]{10,300}$/.test(id));
}

export function decidirCompraPaga(c: Candidato, cfg: Config, agora: Date): Decisao {
  if (!cfg.compraPaga) return { entra: false, motivo: "desligado" };
  if (c.situacao !== "pago") return { entra: false, motivo: "nao_pago" };
  const pago = momentoDoPagamento(c);
  if (diaEmSaoPaulo(iso(pago)) < cfg.compraPagaDesde) return { entra: false, motivo: "antes_do_corte" };
  const valor = valorDoPedido(c);
  if (!(valor > 0)) return { entra: false, motivo: "sem_valor" };
  const t = agora.getTime();
  const temCliente = cfg.dadosDoCliente && Boolean(emailNormalizado(c.email) || telefoneE164(c.telefone));

  const base = {
    pedido: c.pedido,
    tipo: "compra_paga" as const,
    pedido_em: c.feitoEm,
    valor,
    moeda: "BRL",
    com_cliente: temCliente,
  };

  if (!c.clique) {
    if (cfg.pedidosSemClique && temCliente) {
      return {
        entra: true,
        linha: { ...base, momento: iso(Math.min(t, pago)), clique: null, clique_id: null, clique_em: null, proxima_em: iso(t) },
      };
    }
    return { entra: false, motivo: "sem_clique_do_google" };
  }
  if (!cliqueValido(c.cliqueId) || !c.cliqueEm) return { entra: false, motivo: "clique_invalido" };
  const clicou = ms(c.cliqueEm);
  if (t - clicou > PRAZOS.cliqueMaximoDias * DIA) return { entra: false, motivo: "clique_velho" };

  // A conversão precisa ser depois do clique (`CONVERSION_PRECEDES_CLICK`) e não pode ser no futuro.
  const momento = Math.min(t, maior(pago, clicou + 60_000));
  return {
    entra: true,
    linha: {
      ...base,
      momento: iso(momento),
      clique: c.clique,
      clique_id: c.cliqueId,
      clique_em: c.cliqueEm,
      proxima_em: iso(maior(t, clicou + PRAZOS.cliqueMinimoHoras * HORA)),
    },
  };
}

// ---------------------------------------------------------------------------
// A prévia: o que seria mandado, sem mandar nada

export type ItemDaPrevia = { pedido: number; dia: string; valor: number; quando?: string; clique?: Clique | null };

export type PreviaDeUmTipo = {
  /** Sairiam na próxima rodada. */
  agora: ItemDaPrevia[];
  /** Entram na fila e saem depois (prazo mínimo do Google). */
  depois: ItemDaPrevia[];
  /** Não entram, com o motivo. */
  fora: Partial<Record<MotivoDeFora, ItemDaPrevia[]>>;
};

export type Previa = { em: string; retirada: PreviaDeUmTipo; compraPaga: PreviaDeUmTipo };

/** Motivos que não valem listar: são quase todos os pedidos e não dizem nada. */
const SILENCIOSOS: MotivoDeFora[] = ["nao_cancelado", "nao_pago"];

export function montarPrevia(candidatos: Candidato[], cfg: Config, agora: Date): Previa {
  const ligada = { ...cfg, retirada: true, compraPaga: true };
  const umTipo = (decidir: (c: Candidato) => Decisao, valor: (c: Candidato) => number): PreviaDeUmTipo => {
    const p: PreviaDeUmTipo = { agora: [], depois: [], fora: {} };
    for (const c of [...candidatos].sort((a, b) => a.pedido - b.pedido)) {
      const d = decidir(c);
      const item: ItemDaPrevia = { pedido: c.pedido, dia: diaEmSaoPaulo(c.feitoEm), valor: valor(c) };
      if (d.entra) {
        const sai = ms(d.linha.proxima_em) <= agora.getTime();
        (sai ? p.agora : p.depois).push({ ...item, quando: d.linha.proxima_em, ...(d.linha.tipo === "compra_paga" ? { clique: d.linha.clique } : {}) });
      } else if (!SILENCIOSOS.includes(d.motivo)) {
        (p.fora[d.motivo] ??= []).push(item);
      }
    }
    return p;
  };
  return {
    em: agora.toISOString(),
    retirada: umTipo((c) => decidirRetirada(c, ligada, agora), (c) => Math.round(c.total * 100) / 100),
    compraPaga: umTipo((c) => decidirCompraPaga(c, ligada, agora), valorDoPedido),
  };
}

// ---------------------------------------------------------------------------
// Datas no formato de cada API

/** "2026-11-16 14:03:00-03:00": o formato da API do Google Ads, no relógio de São Paulo. */
export function dataHoraDoGoogleAds(instanteIso: string): string {
  return `${new Date(ms(instanteIso) - 3 * HORA).toISOString().slice(0, 19).replace("T", " ")}-03:00`;
}

/** "2026-11-16T14:03:00-03:00": RFC 3339, o formato da Data Manager. */
export function dataHoraRfc3339(instanteIso: string): string {
  return `${new Date(ms(instanteIso) - 3 * HORA).toISOString().slice(0, 19)}-03:00`;
}

// ---------------------------------------------------------------------------
// Dados do cliente, como o Google pede (guia de formatação da Data Manager)

/**
 * Sem espaço, em minúsculas. No gmail.com e no googlemail.com, sem os pontos
 * antes do `@` e sem o `+` e o que vem depois. Os outros domínios ficam como estão.
 */
export function emailNormalizado(email: string | null): string | null {
  const e = (email ?? "").replace(/\s+/g, "").toLowerCase();
  const m = /^([^@]+)@([^@]+\.[^@]+)$/.exec(e);
  if (!m) return null;
  let usuario = m[1];
  const dominio = m[2];
  if (dominio === "gmail.com" || dominio === "googlemail.com") usuario = usuario.split("+")[0].replace(/\./g, "");
  return usuario ? `${usuario}@${dominio}` : null;
}

/** E.164: `+55` e o número. Os pedidos guardam `55` mais DDD e número. */
export function telefoneE164(telefone: string | null): string | null {
  let d = (telefone ?? "").replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  return /^55\d{10,11}$/.test(d) ? `+${d}` : null;
}

export function sha256(valor: string): string {
  return createHash("sha256").update(valor, "utf8").digest("hex");
}

export type Identificador = { emailAddress: string } | { phoneNumber: string };

export function identificadoresDoCliente(email: string | null, telefone: string | null): Identificador[] {
  const lista: Identificador[] = [];
  const e = emailNormalizado(email);
  const t = telefoneE164(telefone);
  if (e) lista.push({ emailAddress: sha256(e) });
  if (t) lista.push({ phoneNumber: sha256(t) });
  return lista;
}

// ---------------------------------------------------------------------------
// Os corpos

export type LinhaDaFila = {
  id: number;
  pedido: number;
  tipo: Tipo;
  estado: string;
  pedido_em: string;
  momento: string;
  valor: number | null;
  moeda: string | null;
  clique: Clique | null;
  clique_id: string | null;
  clique_em: string | null;
  com_cliente: boolean;
  tentativas: number;
  requisicao: string | null;
  indice: number | null;
  enviado_em: string | null;
};

export function lerLinhaDaFila(cru: Record<string, unknown>): LinhaDaFila | null {
  const id = numero(cru.id);
  const pedido = numero(cru.pedido);
  const tipo = cru.tipo === "retirada" || cru.tipo === "compra_paga" ? cru.tipo : null;
  const pedidoEm = instante(cru.pedido_em);
  const momento = instante(cru.momento);
  if (!id || !pedido || !tipo || !pedidoEm || !momento) return null;
  const clique = texto(cru.clique);
  return {
    id,
    pedido,
    tipo,
    estado: texto(cru.estado) ?? "pendente",
    pedido_em: pedidoEm,
    momento,
    valor: numero(cru.valor),
    moeda: texto(cru.moeda),
    clique: clique === "gclid" || clique === "gbraid" || clique === "wbraid" ? clique : null,
    clique_id: texto(cru.clique_id),
    clique_em: instante(cru.clique_em),
    com_cliente: cru.com_cliente === true,
    tentativas: numero(cru.tentativas) ?? 0,
    requisicao: texto(cru.requisicao),
    indice: numero(cru.indice),
    enviado_em: instante(cru.enviado_em),
  };
}

/** Uma retirada: só o número do pedido, a ação e o instante do cancelamento. */
export function ajusteDeRetirada(linha: Pick<LinhaDaFila, "pedido" | "momento">, acao: string) {
  return {
    conversionAction: `customers/${CONTA_DO_GOOGLE_ADS}/conversionActions/${acao}`,
    adjustmentType: "RETRACTION",
    adjustmentDateTime: dataHoraDoGoogleAds(linha.momento),
    orderId: String(linha.pedido),
  };
}

/** O corpo de `uploadConversionAdjustments`. `partialFailure` é obrigatório. */
export function corpoDaRetirada(linhas: Pick<LinhaDaFila, "pedido" | "momento">[], acao: string, validar: boolean) {
  return {
    conversionAdjustments: linhas.map((l) => ajusteDeRetirada(l, acao)),
    partialFailure: true,
    validateOnly: validar,
  };
}

/**
 * Um evento de compra paga. O número do pedido vai em `transactionId`, que é
 * por onde o Google desfaz a repetição dentro da mesma ação. O clique vai como
 * veio: gclid, gbraid ou wbraid, nunca dois.
 */
export function eventoDaCompraPaga(
  linha: Pick<LinhaDaFila, "pedido" | "momento" | "valor" | "moeda" | "clique" | "clique_id">,
  cliente?: { email: string | null; telefone: string | null } | null,
) {
  const evento: Record<string, unknown> = {
    transactionId: String(linha.pedido),
    eventTimestamp: dataHoraRfc3339(linha.momento),
    eventSource: "WEB",
    conversionValue: linha.valor ?? 0,
    currency: linha.moeda ?? "BRL",
  };
  if (linha.clique && linha.clique_id) evento.adIdentifiers = { [linha.clique]: linha.clique_id };
  if (cliente) {
    const ids = identificadoresDoCliente(cliente.email, cliente.telefone);
    if (ids.length) evento.userData = { userIdentifiers: ids };
  }
  return evento;
}

/** O corpo de `events:ingest`. A conta que opera é a dona da ação; a ação vai em `productDestinationId`. */
export function corpoDaCompraPaga(eventos: Record<string, unknown>[], acao: string, validar: boolean) {
  const corpo: Record<string, unknown> = {
    destinations: [{ operatingAccount: { accountType: "GOOGLE_ADS", accountId: CONTA_DO_GOOGLE_ADS }, productDestinationId: acao }],
    events: eventos,
    validateOnly: validar,
  };
  if (eventos.some((e) => e.userData)) corpo.encoding = "HEX";
  return corpo;
}

/** O evento como fica guardado na fila: sem os resumos de e-mail e telefone. */
export function semDadosDoCliente(evento: Record<string, unknown>): Record<string, unknown> {
  const { userData, ...resto } = evento;
  return userData ? { ...resto, userData: "e-mail e telefone em SHA-256" } : resto;
}

// ---------------------------------------------------------------------------
// As respostas

export type Falha = { codigo: string; mensagem: string };

type ErroDoGoogleAds = {
  errorCode?: Record<string, string>;
  message?: string;
  location?: { fieldPathElements?: { fieldName?: string; index?: number }[] };
};

function errosDoDetalhe(detalhes: unknown): ErroDoGoogleAds[] {
  if (!Array.isArray(detalhes)) return [];
  return detalhes.flatMap((d) => (d && typeof d === "object" && Array.isArray((d as { errors?: unknown }).errors) ? ((d as { errors: ErroDoGoogleAds[] }).errors) : []));
}

const codigoDe = (e: ErroDoGoogleAds): string => Object.values(e.errorCode ?? {})[0] ?? "DESCONHECIDO";

/**
 * As falhas de cada ajuste, pela posição no pedido. Com `partialFailure`, a
 * API do Google Ads responde 200 e põe as falhas em `partialFailureError`; o
 * ajuste que não aparece ali deu certo.
 */
export function falhasDaRetirada(corpo: unknown): Map<number, Falha> {
  const falhas = new Map<number, Falha>();
  const erro = (corpo as { partialFailureError?: { details?: unknown; message?: string } } | null)?.partialFailureError;
  if (!erro) return falhas;
  for (const e of errosDoDetalhe(erro.details)) {
    const posicao = (e.location?.fieldPathElements ?? []).find((p) => /conversion_?adjustments/i.test(p.fieldName ?? "") && Number.isInteger(p.index));
    if (posicao?.index === undefined) continue;
    if (!falhas.has(posicao.index)) falhas.set(posicao.index, { codigo: codigoDe(e), mensagem: e.message ?? "" });
  }
  return falhas;
}

/** O erro de uma chamada inteira recusada (Google Ads ou Data Manager), com o código mais útil. */
export function erroGeral(corpo: unknown, status: number): Falha {
  const e = (Array.isArray(corpo) ? corpo[0] : corpo) as { error?: { message?: string; status?: string; details?: unknown } } | null;
  const detalhe = errosDoDetalhe(e?.error?.details)[0];
  const motivo = Array.isArray(e?.error?.details)
    ? (e.error.details as { reason?: string }[]).map((d) => d?.reason).find((r) => typeof r === "string")
    : undefined;
  const codigo = detalhe ? codigoDe(detalhe) : (motivo ?? e?.error?.status ?? `HTTP_${status}`);
  return { codigo, mensagem: (detalhe?.message ?? e?.error?.message ?? `O Google respondeu ${status}.`).slice(0, 300) };
}

/** As violações de campo da Data Manager (`BadRequest.fieldViolations`), pela posição do evento. */
export function violacoesDoDataManager(corpo: unknown): Map<number, Falha> {
  const mapa = new Map<number, Falha>();
  const detalhes = (corpo as { error?: { details?: unknown } } | null)?.error?.details;
  if (!Array.isArray(detalhes)) return mapa;
  for (const d of detalhes) {
    const violacoes = (d as { fieldViolations?: { field?: string; description?: string; reason?: string }[] })?.fieldViolations;
    if (!Array.isArray(violacoes)) continue;
    for (const v of violacoes) {
      const m = /^events\[(\d+)\]/.exec(v.field ?? "");
      if (!m) continue;
      const i = Number(m[1]);
      if (!mapa.has(i)) mapa.set(i, { codigo: v.reason ?? "INVALID_ARGUMENT", mensagem: `${v.field}: ${v.description ?? ""}`.slice(0, 300) });
    }
  }
  return mapa;
}

export type SituacaoDoEvento = { estado: "processando" } | { estado: "ok" } | { estado: "falhou"; falha: Falha };

/**
 * Como ficou cada evento de um pedido à Data Manager (`requestStatus:retrieve`).
 * A resposta conta as falhas por motivo, com a posição de cada evento
 * (`recordIndices`). Quando o Google não diz a posição, todos levam o motivo
 * se o pedido inteiro falhou; num pedido que deu certo em parte, sem posição
 * não há como dizer quem falhou, e todos ficam como aceitos.
 */
export function situacaoDoDataManager(corpo: unknown, quantos: number): SituacaoDoEvento[] {
  const destino = ((corpo as { requestStatusPerDestination?: unknown[] } | null)?.requestStatusPerDestination ?? [])[0] as
    | { requestStatus?: string; errorInfo?: { errorCounts?: { reason?: string; recordCount?: number | string; recordIndices?: (number | string)[] }[] } }
    | undefined;
  const status = destino?.requestStatus ?? "PROCESSING";
  const lista: SituacaoDoEvento[] = Array.from({ length: quantos }, () => ({ estado: status === "PROCESSING" || status === "REQUEST_STATUS_UNKNOWN" ? "processando" : "ok" }) as SituacaoDoEvento);
  if (status === "PROCESSING" || status === "REQUEST_STATUS_UNKNOWN") return lista;
  const contagens = destino?.errorInfo?.errorCounts ?? [];
  for (const c of contagens) {
    const falha: Falha = { codigo: c.reason ?? "DESCONHECIDO", mensagem: "" };
    const indices = (c.recordIndices ?? []).map(Number).filter((i) => Number.isInteger(i) && i >= 0 && i < quantos);
    if (indices.length) for (const i of indices) lista[i] = { estado: "falhou", falha };
    else if (status === "FAILED") for (let i = 0; i < quantos; i++) if (lista[i].estado === "ok") lista[i] = { estado: "falhou", falha };
  }
  return lista;
}

// ---------------------------------------------------------------------------
// O que fazer com cada resposta

export type Destino =
  | { tipo: "feito"; nota?: string }
  | { tipo: "nao_contado" }
  | { tipo: "fora_do_prazo" }
  | { tipo: "esperar"; horas: number }
  | { tipo: "passageiro" }
  | { tipo: "configuracao" }
  | { tipo: "recusado" };

/** A resposta de UM ajuste de retirada. `null` é sucesso. */
export function classificarRetirada(codigo: string | null): Destino {
  if (!codigo) return { tipo: "feito" };
  switch (codigo) {
    case "CONVERSION_ALREADY_RETRACTED":
      return { tipo: "feito", nota: "já estava retirada" };
    case "CONVERSION_NOT_FOUND":
      return { tipo: "nao_contado" };
    case "CONVERSION_EXPIRED":
      return { tipo: "fora_do_prazo" };
    case "TOO_RECENT_CONVERSION":
    case "TOO_RECENT_CONVERSION_ACTION":
      return { tipo: "esperar", horas: 6 };
    case "NO_CONVERSION_ACTION_FOUND":
    case "INVALID_CONVERSION_ACTION_TYPE":
    case "CUSTOMER_NOT_ACCEPTED_CUSTOMER_DATA_TERMS":
      return { tipo: "configuracao" };
    default:
      return { tipo: "recusado" };
  }
}

/** A resposta de UM evento de compra paga (motivo da Data Manager). `null` é sucesso. */
export function classificarCompraPaga(codigo: string | null): Destino {
  if (!codigo) return { tipo: "feito" };
  const c = codigo.replace(/^PROCESSING_ERROR_(REASON_)?/, "");
  switch (c) {
    case "DUPLICATE_TRANSACTION_ID":
    case "DUPLICATE_GCLID":
      return { tipo: "feito", nota: "o Google já tinha esta compra" };
    case "TOO_RECENT_CLICK":
    case "DESTINATION_TOO_RECENTLY_CREATED":
      return { tipo: "esperar", horas: 6 };
    case "EXPIRED_CLICK":
    case "EVENT_TOO_OLD":
      return { tipo: "fora_do_prazo" };
    case "DESTINATION_ACCOUNT_ENHANCED_CONVERSIONS_TERMS_NOT_SIGNED":
    case "NO_CONSENT":
    case "DENIED_CONSENT":
    case "UNKNOWN_CONSENT":
      return { tipo: "configuracao" };
    default:
      return { tipo: "recusado" };
  }
}

/** O erro de uma chamada inteira: falta de acesso, falta de configuração ou soluço. */
export function classificarErroGeral(status: number, codigo: string): Destino {
  if (status === 0 || status === 429 || status >= 500 || /QUOTA|RESOURCE_EXHAUSTED|INTERNAL|UNAVAILABLE|DEADLINE|TRANSIENT/i.test(codigo)) {
    return { tipo: "passageiro" };
  }
  return { tipo: "configuracao" };
}

/** Quando tentar de novo depois de uma falha passageira: 15 minutos, 1 hora, 3, 6, 12 e 24. */
export function proximaTentativa(tentativas: number, agora: Date): Date | null {
  if (tentativas >= PRAZOS.tentativasMaximas) return null;
  const minutos = [15, 60, 180, 360, 720, 1440, 1440, 1440][Math.max(0, tentativas - 1)] ?? 1440;
  return new Date(agora.getTime() + minutos * 60_000);
}

/** O estado que a linha grava depois de uma resposta. */
export type Gravacao = {
  id: number;
  estado: string;
  tentativas: number;
  proxima_em?: string;
  enviado_em?: string;
  validado_em?: string;
  confirmado_em?: string;
  requisicao?: string;
  indice?: number;
  corpo?: unknown;
  resposta?: unknown;
  codigo: string | null;
  erro: string | null;
};

/**
 * Aplica a resposta à linha. Em VALIDAÇÃO nada é final: o que o Google
 * aceitaria vira `validado`, e o que ele recusaria também, com o código e a
 * frase, para quem olha a fila saber antes de ligar; quando a validação
 * desliga, a linha validada sai de novo, agora para valer. Fora da validação:
 * retirada aceita é final (o Google responde na hora); compra paga aceita fica
 * `enviado` até a Data Manager confirmar.
 */
export function gravacaoDaResposta(
  linha: Pick<LinhaDaFila, "id" | "tipo" | "tentativas">,
  destino: Destino,
  falha: Falha | null,
  validar: boolean,
  agora: Date,
): Gravacao {
  const quando = agora.toISOString();
  const base = { id: linha.id, tentativas: linha.tentativas, codigo: falha?.codigo ?? null, erro: falha ? frase(falha) : null };

  if (destino.tipo === "configuracao") return { ...base, estado: "pendente", proxima_em: quando };
  if (destino.tipo === "esperar") {
    return { ...base, estado: "pendente", tentativas: linha.tentativas + 1, proxima_em: new Date(agora.getTime() + destino.horas * HORA).toISOString() };
  }
  if (destino.tipo === "passageiro") {
    const tentativas = linha.tentativas + 1;
    const proxima = proximaTentativa(tentativas, agora);
    if (!proxima) return { ...base, tentativas, estado: "recusado", erro: `Desistiu depois de ${tentativas} tentativas. ${base.erro ?? ""}`.trim() };
    return { ...base, tentativas, estado: "pendente", proxima_em: proxima.toISOString() };
  }
  if (validar) return { ...base, estado: "validado", validado_em: quando, erro: destino.tipo === "feito" ? null : base.erro };

  switch (destino.tipo) {
    case "feito":
      return linha.tipo === "retirada"
        ? { ...base, estado: "confirmado", enviado_em: quando, confirmado_em: quando, codigo: null, erro: destino.nota ?? null }
        : { ...base, estado: "enviado", enviado_em: quando, codigo: null, erro: null };
    case "nao_contado":
      return { ...base, estado: "nao_contado", enviado_em: quando };
    case "fora_do_prazo":
      return { ...base, estado: "fora_do_prazo", enviado_em: quando };
    case "recusado":
      return { ...base, estado: "recusado", enviado_em: quando };
  }
}

/** O que a fila mostra para cada código conhecido, em português. O código vai junto. */
const FRASES: Record<string, string> = {
  CONVERSION_NOT_FOUND: "O Google não tinha este pedido contado: a etiqueta não disparou, ou a compra não foi atribuída a anúncio do Google.",
  CONVERSION_EXPIRED: "A compra tem mais de 54 dias, e o Google não aceita mais ajuste nela.",
  CONVERSION_ALREADY_RETRACTED: "Já estava retirada.",
  TOO_RECENT_CONVERSION: "A compra tem menos de 24 horas. Sai de novo daqui a 6 horas.",
  TOO_RECENT_CONVERSION_ACTION: "A ação de conversão acabou de ser criada. O Google pede 6 horas.",
  NO_CONVERSION_ACTION_FOUND: "O Google não achou a ação de conversão nesta conta, ou ela está desativada. Confira o número colado.",
  INVALID_CONVERSION_ACTION_TYPE: "A ação de conversão não é do tipo que aceita este envio.",
  CUSTOMER_NOT_ACCEPTED_CUSTOMER_DATA_TERMS: "Os termos de dados do cliente não foram aceitos no Google Ads (Metas, Configurações).",
  USER_PERMISSION_DENIED: "A conta de serviço não tem acesso de edição à conta do Google Ads (hoje ela é Somente leitura).",
  ACTION_NOT_PERMITTED: "A conta de serviço não tem acesso de edição à conta do Google Ads (hoje ela é Somente leitura).",
  CUSTOMER_NOT_ALLOWLISTED_FOR_THIS_FEATURE: "O Google não aceita este envio por este caminho para o projeto do painel.",
  SERVICE_DISABLED: "A API não está ativada no projeto jk-portal-509621 do Google Cloud.",
  ACCESS_TOKEN_SCOPE_INSUFFICIENT: "A conta de serviço não pediu o escopo certo.",
  PERMISSION_DENIED: "A conta de serviço não tem acesso de edição à conta do Google Ads, ou a API não está ativada no projeto.",
  DUPLICATE_TRANSACTION_ID: "O Google já tinha esta compra.",
  TOO_RECENT_CLICK: "O clique tem menos de 6 horas. Sai de novo depois.",
  EXPIRED_CLICK: "O clique passou da janela da ação ou dos 90 dias.",
  CLICK_NOT_FOUND: "O Google não achou o clique.",
  CONVERSION_PRECEDES_CLICK: "A compra ficou antes do clique.",
  DESTINATION_ACCOUNT_ENHANCED_CONVERSIONS_TERMS_NOT_SIGNED: "Os termos de dados do cliente não foram aceitos no Google Ads.",
};

export function frase(falha: Falha): string {
  const curto = falha.codigo.replace(/^PROCESSING_ERROR_(REASON_)?/, "");
  const texto = FRASES[curto] ?? FRASES[falha.codigo] ?? (falha.mensagem || "O Google recusou.");
  return `${texto} (${falha.codigo})`.slice(0, 600);
}
