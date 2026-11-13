/**
 * Converte o pedido da API da Tray (`/orders/:id/complete`) para o MESMO
 * formato que o leitor das exportações em CSV entrega (`PedidoDaTray`).
 *
 * As duas portas gravam pela mesma função do banco, `importar_pedidos_tray`.
 * Se a API devolvesse um formato próprio, o painel passaria a ter dois jeitos
 * de dizer o que é pedido pago, e cada tela escolheria um.
 *
 * O QUE A API NÃO TRAZ. A exportação tem a coluna "UTM Source", que é de onde
 * o painel tira a origem da venda. A API não tem campo de origem: conferido em
 * 13/11/2026 no pedido completo da loja de testes, campo por campo. `origem`
 * ainda procura nos lugares em que ele poderia aparecer um dia e, sem achar,
 * devolve nulo. Por isso quem grava NUNCA troca uma origem já lida por nulo
 * (`importar_pedidos_tray`, migration 0063).
 *
 * Arquivo puro, para o teste rodar sem rede.
 */
import type { ItemDoPedido, PedidoDaTray, Situacao } from "./tray-csv.ts";

type Cru = Record<string, unknown>;

const texto = (v: unknown, max = 300): string | null => {
  const s = v == null ? "" : String(v).trim();
  return s ? s.slice(0, max) : null;
};

const dinheiro = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
};

/** A mesma regra do leitor de CSV: só dígitos, sem o 55 repetido, com o 55 na frente. */
function telefone(...candidatos: unknown[]): string | null {
  for (const c of candidatos) {
    let d = String(c ?? "").replace(/\D/g, "");
    if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
    if (d.length === 10 || d.length === 11) return `55${d}`;
  }
  return null;
}

const diaValido = (v: unknown): string | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v ?? ""));
  return m && m[1] !== "0000" ? `${m[1]}-${m[2]}-${m[3]}` : null;
};

/** A origem, se a Tray mandar em algum dos lugares possíveis. A documentação não promete nenhum. */
function origem(o: Cru): string | null {
  const direto = o.utm_source ?? o.utmSource ?? o.origin ?? o.source;
  if (texto(direto)) return texto(direto);
  for (const chave of ["Utm", "utm", "OrderUtm", "Tracking", "tracking"]) {
    const bloco = o[chave] as Cru | undefined;
    if (bloco && typeof bloco === "object") {
      const v = bloco.utm_source ?? bloco.source ?? bloco.utmSource;
      if (texto(v)) return texto(v);
    }
  }
  return null;
}

export function itensDaApi(o: Cru): ItemDoPedido[] {
  const lista = (o.ProductsSold ?? []) as Cru[];
  if (!Array.isArray(lista)) return [];
  return lista
    .map((linha) => (linha.ProductsSold ?? linha) as Cru)
    .map((p) => {
      const quantidade = Number(String(p.quantity ?? "").replace(",", "."));
      return {
        produto_tray_id: texto(p.product_id, 40),
        nome: texto(p.name ?? p.original_name, 300) ?? "Sem nome",
        referencia: texto(p.reference, 120),
        quantidade: Number.isFinite(quantidade) && quantidade > 0 ? quantidade : 1,
        preco: dinheiro(p.price),
        custo: dinheiro(p.cost_price),
        info: texto(p.additional_information, 300),
      };
    });
}

/**
 * `null` quando o pedido vem sem número ou sem data, que é o mínimo para gravar.
 *
 * `situacaoDoStatus` vem de fora (é a do leitor de CSV) em vez de ser
 * importada: este arquivo é puro e só pode importar TIPO do vizinho, senão o
 * teste sem compilação não roda. Receber a função também garante que as duas
 * portas classificam "pago" pela mesma regra.
 */
export function pedidoDaApi(o: Cru, situacaoDoStatus: (status: string) => Situacao): (PedidoDaTray & { itens: ItemDoPedido[] }) | null {
  const pedido = Number(o.id);
  const dia = diaValido(o.date);
  if (!Number.isInteger(pedido) || pedido <= 0 || !dia) return null;

  const hora = /^\d{2}:\d{2}(:\d{2})?$/.test(String(o.hour ?? "")) ? String(o.hour) : "00:00:00";
  const situacaoCrua = (o.OrderStatus ?? {}) as Cru;
  const status = texto(situacaoCrua.status ?? o.status, 120) ?? "Sem status";
  // A Tray classifica cada status num tipo (`open`, `closed`, `canceled`). O
  // cancelado vale mesmo se a loja der ao status um nome que não comece com
  // "cancelado"; para o resto, a regra é a do nome, igual à do CSV.
  const cancelado = String(situacaoCrua.type ?? "").toLowerCase() === "canceled";
  const parceiro = texto(o.partner_id, 40);
  const cliente = (o.Customer ?? {}) as Cru;
  const total = dinheiro(o.total) ?? 0;
  const pagos = Array.isArray(o.Payment) ? (o.Payment as Cru[]).map((p) => (p.Payment ?? p) as Cru) : [];

  return {
    pedido,
    // O Brasil não tem horário de verão desde 2019: São Paulo é sempre -03:00.
    feito_em: `${dia}T${hora.length === 5 ? `${hora}:00` : hora}-03:00`,
    dia,
    status,
    situacao: cancelado ? "cancelado" : situacaoDoStatus(status),
    cliente_codigo: texto(cliente.id ?? o.customer_id, 40),
    cliente_nome: texto(cliente.name, 160),
    cliente_email: texto(cliente.email, 200)?.toLowerCase() ?? null,
    cliente_telefone: telefone(cliente.cellphone, cliente.phone),
    subtotal: dinheiro(o.partial_total),
    frete_tipo: texto(o.shipment, 120),
    frete_valor: dinheiro(o.shipment_value),
    desconto: dinheiro(o.discount),
    cupom: texto(String(o.discount_coupon ?? "").split("/")[0], 60)?.toUpperCase() ?? null,
    total,
    pagamento_tipo: texto(o.payment_method, 120),
    pagamento_em: diaValido(o.payment_date),
    forma_paga: texto(o.payment_form ?? pagos[0]?.method, 120),
    valor_pago: pagos.length ? dinheiro(pagos.reduce((s, p) => s + (Number(p.value) || 0), 0)) : null,
    canal: texto(o.point_sale, 60),
    parceiro: parceiro === "0" ? null : parceiro,
    utm_source: origem(o),
    cidade: texto(cliente.city, 120),
    uf: texto(cliente.state, 2)?.toUpperCase() ?? null,
    envio_em: diaValido(o.shipment_date),
    envio_codigo: texto(o.sending_code, 80),
    // Pedido criado fora da vitrine (pela API, por marketplace) vem sem sessão.
    sessao: /^[a-z0-9]{20,40}$/i.test(String(o.session_id ?? "")) ? String(o.session_id) : null,
    itens: itensDaApi(o),
  };
}

/** O instante de alteração mais recente de uma lista de pedidos (`AAAA-MM-DD HH:MM:SS`), ou `null`. */
export function ultimaAlteracao(pedidos: Cru[]): string | null {
  let maior: string | null = null;
  for (const p of pedidos) {
    const m = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.exec(String(p.modified ?? ""))?.[0];
    if (m && m.slice(0, 4) !== "0000" && (!maior || m > maior)) maior = m;
  }
  return maior;
}

export type LinhaDoBanco = { pedido: number; status: string; situacao: Situacao; total: number; utm_source: string | null };
export type Diferenca = { pedido: number; campo: "status" | "situacao" | "total"; api: string; banco: string };

/**
 * Compara o que a API devolveu com o que as exportações já gravaram, sem mexer
 * em nada. É a conferência de antes de ligar a gravação pela API: mostra se as
 * duas portas escrevem o status do MESMO jeito. Se uma escrever "A ENVIAR" e a
 * outra "A enviar", cada rodada de uma desfaria a da outra e o histórico de
 * mudança de status encheria de troca que não aconteceu.
 */
export function compararComOBanco(daApi: Pick<PedidoDaTray, "pedido" | "status" | "situacao" | "total">[], doBanco: LinhaDoBanco[]) {
  const banco = new Map(doBanco.map((l) => [Number(l.pedido), l]));
  const diferencas: Diferenca[] = [];
  const soNaApi: number[] = [];
  let iguais = 0;
  let soDiferemNaEscrita = 0;
  for (const p of daApi) {
    const b = banco.get(p.pedido);
    if (!b) {
      soNaApi.push(p.pedido);
      continue;
    }
    const antes = diferencas.length;
    if (p.status !== b.status) {
      diferencas.push({ pedido: p.pedido, campo: "status", api: p.status, banco: b.status });
      if (p.status.trim().toLowerCase() === b.status.trim().toLowerCase()) soDiferemNaEscrita++;
    }
    if (p.situacao !== b.situacao) diferencas.push({ pedido: p.pedido, campo: "situacao", api: p.situacao, banco: b.situacao });
    if (Math.abs(p.total - Number(b.total)) > 0.005) diferencas.push({ pedido: p.pedido, campo: "total", api: p.total.toFixed(2), banco: Number(b.total).toFixed(2) });
    if (diferencas.length === antes) iguais++;
  }
  return { lidos: daApi.length, iguais, soNaApi, soDiferemNaEscrita, comOrigemNoBanco: doBanco.filter((l) => l.utm_source).length, diferencas };
}
