import { createHash } from "node:crypto";

/**
 * A compra da loja como o Meta recebe pela API de Conversões. Conta pura: não
 * toca no banco nem na rede, para o teste rodar sem nada (`verificar:meta`).
 *
 * Dois eventos por pedido:
 *   - `Purchase`, no pedido CRIADO, com `event_id` = `pedido-<número>`. É o
 *     MESMO número que a etiqueta do GTM manda pelo navegador, e é isso que faz
 *     o Meta contar uma compra só (docs/medicao-pelo-painel.md).
 *   - `CompraPaga`, quando o pedido vira pago, com `pago-<número>`. A conversão
 *     personalizada "Compra Paga" do Gerenciador de Eventos já usa esse nome.
 *
 * O Meta só aceita evento de até sete dias, e evento de site (`website`) só com
 * o navegador de quem comprou. Sem navegador, a `CompraPaga` vai como
 * `system_generated` (o pagamento acontece no sistema, não na página) e a
 * `Purchase` não vai: o pixel do navegador cobre.
 */

export const PRAZO_DO_META_MS = 7 * 24 * 60 * 60 * 1000;
/** Folga para o recado da página de confirmação chegar antes de decidir a `Purchase`. */
export const ESPERA_DA_COMPRA_MS = 30 * 60 * 1000;
/** Depois de tantas falhas o envio vira erro e para de ser tentado. */
export const MAXIMO_DE_TENTATIVAS = 5;
export const ENDERECO_DA_LOJA = "https://www.jkaliancas.com.br";

export type Evento = "Purchase" | "CompraPaga";

export type ItemDoPedido = { produto_tray_id?: string | number | null; quantidade?: number | null; preco?: number | string | null };

export type PedidoParaMeta = {
  pedido: number;
  feito_em: string;
  situacao: string | null;
  status_mudou_em?: string | null;
  pagamento_em?: string | null;
  total: number | string | null;
  valor_pago?: number | string | null;
  cliente_codigo?: string | null;
  cliente_nome?: string | null;
  cliente_email?: string | null;
  cliente_telefone?: string | null;
  cidade?: string | null;
  uf?: string | null;
  itens?: ItemDoPedido[] | null;
};

export type SinaisDoNavegador = { fbp?: string | null; fbc?: string | null; navegador?: string | null; ip?: string | null };

/** O último clique em anúncio do Meta do visitante (`fbclid`), para montar o `fbc` quando o cookie não veio. */
export type CliqueDoMeta = { fbclid: string; em: string };

export type EnvioJaFeito = { pedido: number; evento: Evento; estado: "enviado" | "teste" | "erro" | "ignorado"; tentativas: number };

export type EventoDoMeta = {
  event_name: Evento;
  event_time: number;
  event_id: string;
  action_source: "website" | "system_generated";
  event_source_url?: string;
  user_data: Record<string, unknown>;
  custom_data: Record<string, unknown>;
};

export type Decisao =
  | { pedido: number; evento: Evento; mandar: true; corpo: EventoDoMeta }
  | { pedido: number; evento: Evento; mandar: false; motivo: string; definitivo: boolean };

// ---------------------------------------------------------------------------
// Normalização, como o Meta pede antes do SHA-256
// ---------------------------------------------------------------------------

export const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

const semAcento = (v: string) => v.normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Só dígitos, com o 55 do Brasil na frente. Telefone curto ou comprido demais não serve. */
export function normalizarTelefone(v: string | null | undefined): string | null {
  const d = (v ?? "").replace(/\D/g, "").replace(/^0+/, "");
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) return d;
  if (d.length === 10 || d.length === 11) return `55${d}`;
  return null;
}

export function normalizarEmail(v: string | null | undefined): string | null {
  const e = (v ?? "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}

/** Nome: minúsculas, sem acento e sem o que não for letra. */
export function normalizarNome(v: string | null | undefined): string | null {
  const n = semAcento((v ?? "").trim().toLowerCase()).replace(/[^a-z]/g, "");
  return n || null;
}

/** Cidade: minúsculas, sem acento, sem espaço nem pontuação ("São Paulo" vira "saopaulo"). */
export function normalizarCidade(v: string | null | undefined): string | null {
  const c = semAcento((v ?? "").trim().toLowerCase()).replace(/[^a-z]/g, "");
  return c || null;
}

/** Estado: a sigla de duas letras, em minúsculas. */
export function normalizarUf(v: string | null | undefined): string | null {
  const u = (v ?? "").trim().toLowerCase();
  return /^[a-z]{2}$/.test(u) ? u : null;
}

/** O `fbc` montado a partir do clique, no formato do cookie que o pixel grava. */
export function fbcDoClique(clique: CliqueDoMeta | null | undefined): string | null {
  if (!clique?.fbclid) return null;
  const quando = Date.parse(clique.em);
  if (!Number.isFinite(quando)) return null;
  return `fb.1.${quando}.${clique.fbclid}`;
}

export function idDoEvento(evento: Evento, pedido: number): string {
  return evento === "Purchase" ? `pedido-${pedido}` : `pago-${pedido}`;
}

const numero = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const centavos = (v: number) => Math.round(v * 100) / 100;

// ---------------------------------------------------------------------------
// Os dados de quem comprou e o que comprou
// ---------------------------------------------------------------------------

export function dadosDoCliente(p: PedidoParaMeta, sinais: SinaisDoNavegador | null, clique: CliqueDoMeta | null): Record<string, unknown> {
  const u: Record<string, unknown> = { country: [sha256("br")] };
  const email = normalizarEmail(p.cliente_email);
  const telefone = normalizarTelefone(p.cliente_telefone);
  if (email) u.em = [sha256(email)];
  if (telefone) u.ph = [sha256(telefone)];

  const nomes = (p.cliente_nome ?? "").trim().split(/\s+/).filter(Boolean);
  const primeiro = normalizarNome(nomes[0]);
  const ultimo = nomes.length > 1 ? normalizarNome(nomes[nomes.length - 1]) : null;
  if (primeiro) u.fn = [sha256(primeiro)];
  if (ultimo) u.ln = [sha256(ultimo)];

  const cidade = normalizarCidade(p.cidade);
  const uf = normalizarUf(p.uf);
  if (cidade) u.ct = [sha256(cidade)];
  if (uf) u.st = [sha256(uf)];

  // O código do cliente na Tray é estável entre pedidos; sem ele, o telefone.
  const externo = p.cliente_codigo ? `tray:${p.cliente_codigo}` : telefone;
  if (externo) u.external_id = [sha256(externo)];

  const fbc = sinais?.fbc || fbcDoClique(clique);
  if (fbc) u.fbc = fbc;
  if (sinais?.fbp) u.fbp = sinais.fbp;
  if (sinais?.navegador) u.client_user_agent = sinais.navegador;
  if (sinais?.ip) u.client_ip_address = sinais.ip;
  return u;
}

/** Valor, moeda, número do pedido e os produtos. O custo do item nunca sai daqui. */
export function dadosDaCompra(p: PedidoParaMeta, evento: Evento): Record<string, unknown> {
  const valor = evento === "CompraPaga" && numero(p.valor_pago) > 0 ? numero(p.valor_pago) : numero(p.total);
  const porProduto = new Map<string, { quantidade: number; preco: number }>();
  for (const item of p.itens ?? []) {
    const id = item.produto_tray_id == null ? "" : String(item.produto_tray_id).trim();
    if (!id) continue;
    const atual = porProduto.get(id) ?? { quantidade: 0, preco: numero(item.preco) };
    atual.quantidade += Math.max(1, Math.round(numero(item.quantidade) || 1));
    porProduto.set(id, atual);
  }
  const contents = [...porProduto].map(([id, v]) => ({ id, quantity: v.quantidade, item_price: centavos(v.preco) }));
  return {
    currency: "BRL",
    value: centavos(valor),
    order_id: String(p.pedido),
    content_type: "product",
    content_ids: contents.map((c) => c.id),
    contents,
    num_items: contents.reduce((s, c) => s + c.quantity, 0),
  };
}

/** Quando o pedido virou pago: a última troca de status, o dia do pagamento, ou o próprio pedido. */
export function quandoFoiPago(p: PedidoParaMeta): number {
  for (const v of [p.status_mudou_em, p.pagamento_em, p.feito_em]) {
    const t = v ? Date.parse(v.length === 10 ? `${v}T12:00:00-03:00` : v) : NaN;
    if (Number.isFinite(t)) return t;
  }
  return NaN;
}

// ---------------------------------------------------------------------------
// A decisão: manda, espera ou deixa de lado
// ---------------------------------------------------------------------------

/**
 * Decide os dois eventos de um pedido. `desde` é o corte do modo: pedido feito
 * antes não entra. `jaFeitos` traz o que já foi mandado; em teste, o que foi
 * mandado em teste não repete, e ao ligar de verdade ele vai de novo.
 */
export function decidir(
  p: PedidoParaMeta,
  opcoes: { agora: number; desde: number | null; modo: "teste" | "ligado"; sinais: SinaisDoNavegador | null; clique: CliqueDoMeta | null; jaFeitos: EnvioJaFeito[] },
): Decisao[] {
  const decisoes: Decisao[] = [];
  const feito = Date.parse(p.feito_em);
  const ja = (evento: Evento) => opcoes.jaFeitos.find((j) => j.pedido === p.pedido && j.evento === evento);
  const resolvido = (evento: Evento) => {
    const j = ja(evento);
    if (!j) return false;
    if (j.estado === "enviado" || j.estado === "ignorado") return true;
    if (j.estado === "teste") return opcoes.modo === "teste";
    return j.tentativas >= MAXIMO_DE_TENTATIVAS;
  };

  if (!Number.isFinite(feito)) return decisoes;
  if (opcoes.desde != null && feito < opcoes.desde) return decisoes;

  // Purchase: o pedido criado.
  if (!resolvido("Purchase")) {
    if (opcoes.agora - feito > PRAZO_DO_META_MS) {
      decisoes.push({ pedido: p.pedido, evento: "Purchase", mandar: false, motivo: "passou dos 7 dias que o Meta aceita", definitivo: true });
    } else if (!opcoes.sinais?.navegador) {
      // Sem o navegador o evento de site não vale. Espera o recado da confirmação um pouco antes de desistir.
      if (opcoes.agora - feito >= ESPERA_DA_COMPRA_MS) {
        decisoes.push({ pedido: p.pedido, evento: "Purchase", mandar: false, motivo: "sem o navegador da compra; o pixel cobre", definitivo: true });
      }
    } else {
      decisoes.push({
        pedido: p.pedido,
        evento: "Purchase",
        mandar: true,
        corpo: {
          event_name: "Purchase",
          event_time: Math.floor(feito / 1000),
          event_id: idDoEvento("Purchase", p.pedido),
          action_source: "website",
          event_source_url: `${ENDERECO_DA_LOJA}/checkout`,
          user_data: dadosDoCliente(p, opcoes.sinais, opcoes.clique),
          custom_data: dadosDaCompra(p, "Purchase"),
        },
      });
    }
  }

  // CompraPaga: só pedido pago.
  if ((p.situacao ?? "").toLowerCase() === "pago" && !resolvido("CompraPaga")) {
    const pago = quandoFoiPago(p);
    // Pago "no futuro" é relógio torto: manda com a hora de agora.
    const quando = Number.isFinite(pago) ? Math.min(pago, opcoes.agora) : NaN;
    if (!Number.isFinite(quando) || opcoes.agora - quando > PRAZO_DO_META_MS) {
      decisoes.push({ pedido: p.pedido, evento: "CompraPaga", mandar: false, motivo: "pago há mais de 7 dias", definitivo: true });
    } else {
      const comNavegador = Boolean(opcoes.sinais?.navegador);
      decisoes.push({
        pedido: p.pedido,
        evento: "CompraPaga",
        mandar: true,
        corpo: {
          event_name: "CompraPaga",
          event_time: Math.floor(quando / 1000),
          event_id: idDoEvento("CompraPaga", p.pedido),
          action_source: comNavegador ? "website" : "system_generated",
          ...(comNavegador ? { event_source_url: `${ENDERECO_DA_LOJA}/checkout` } : {}),
          user_data: dadosDoCliente(p, opcoes.sinais, opcoes.clique),
          custom_data: dadosDaCompra(p, "CompraPaga"),
        },
      });
    }
  }
  return decisoes;
}

/** A Tray manda ao Meta de novo? É o que impede contar a compra duas vezes se ela voltar com o pixel dela. */
export function trayMandandoAoMeta(resposta: unknown): boolean {
  if (!resposta || typeof resposta !== "object") return false;
  const r = resposta as { pixel?: unknown; authentication_error?: unknown };
  return Boolean(r.pixel) && !r.authentication_error;
}
