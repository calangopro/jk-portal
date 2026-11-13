/**
 * Leitura das duas exportações do painel da Tray: pedidos e produtos vendidos.
 *
 * É a ponte até a API da Tray ser liberada. O dado é o da própria Tray, com o
 * status de cada pedido, e por isso serve de fonte: pedido criado não é venda
 * (de maio a novembro de 2026, 43% foram cancelados depois de criados).
 *
 * Arquivo puro, sem banco e sem `server-only`, porque o mesmo código roda no
 * comando `npm run vendas:importar` e no teste. O passo a passo da exportação
 * está em `docs/tray-exportar-pedidos.md`.
 *
 * O que NÃO sai daqui, de propósito: CPF, CNPJ e endereço. O portal não
 * precisa deles para nenhuma conta, então não guarda.
 */

export type Situacao = "pago" | "aguardando" | "cancelado";

export type ItemDoPedido = {
  produto_tray_id: string | null;
  nome: string;
  referencia: string | null;
  quantidade: number;
  preco: number | null;
  custo: number | null;
  info: string | null;
};

export type PedidoDaTray = {
  pedido: number;
  /** Instante do pedido, com o fuso de São Paulo. */
  feito_em: string;
  /** Dia de São Paulo (AAAA-MM-DD), que é o dia que os relatórios somam. */
  dia: string;
  status: string;
  situacao: Situacao;
  cliente_codigo: string | null;
  cliente_nome: string | null;
  cliente_email: string | null;
  /** Com país, como o portal grava: 5511999999999. */
  cliente_telefone: string | null;
  subtotal: number | null;
  frete_tipo: string | null;
  frete_valor: number | null;
  desconto: number | null;
  cupom: string | null;
  total: number;
  pagamento_tipo: string | null;
  pagamento_em: string | null;
  forma_paga: string | null;
  valor_pago: number | null;
  canal: string | null;
  parceiro: string | null;
  utm_source: string | null;
  cidade: string | null;
  uf: string | null;
  envio_em: string | null;
  envio_codigo: string | null;
  /**
   * A sessão da Tray em que o pedido foi feito. Só a API traz (a exportação
   * não tem a coluna), e é ela que liga o pedido à origem anotada pelo coletor.
   */
  sessao?: string | null;
};

export class ArquivoDaTrayInvalido extends Error {}

/**
 * Pedido criado não é venda. O que decide é o status que a Tray dá depois:
 * cancelado (pela loja ou sozinho, por falta de pagamento), ainda esperando
 * pagamento, ou seguindo o caminho de quem pagou.
 *
 * Status que a Tray inventar no futuro cai em "pago", porque todos os que
 * existem depois do pagamento (a enviar, enviado, finalizado, a retirar,
 * problemas na entrega) têm nomes sem padrão em comum.
 */
export function situacaoDoStatus(status: string): Situacao {
  const s = semAcento(status);
  if (s.startsWith("cancelado")) return "cancelado";
  if (s.includes("aguardando pagamento")) return "aguardando";
  return "pago";
}

function semAcento(v: string): string {
  return v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

/**
 * A Tray exporta em Windows-1252. Se um dia passar a UTF-8, a primeira
 * tentativa já acerta: bytes de 1252 com acento não formam UTF-8 válido.
 */
export function decodificar(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^﻿/, "");
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

/** CSV com `;`, aspas duplas e quebra de linha dentro de campo (observação do cliente). */
export function lerCsv(texto: string, separador = ";"): string[][] {
  const linhas: string[][] = [];
  let linha: string[] = [];
  let campo = "";
  let entreAspas = false;

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (entreAspas) {
      if (c === '"') {
        if (texto[i + 1] === '"') {
          campo += '"';
          i++;
        } else entreAspas = false;
      } else campo += c;
      continue;
    }
    if (c === '"' && campo === "") entreAspas = true;
    else if (c === separador) {
      linha.push(campo);
      campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      linha.push(campo);
      campo = "";
      if (linha.some((v) => v !== "")) linhas.push(linha);
      linha = [];
    } else campo += c;
  }
  linha.push(campo);
  if (linha.some((v) => v !== "")) linhas.push(linha);
  return linhas;
}

/** "1.000,00" e "459,00" viram número. Vazio vira null. */
function dinheiro(v: string | undefined): number | null {
  const s = (v ?? "").replace(/R\$/g, "").trim();
  if (!s) return null;
  const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

function texto(v: string | undefined, max = 300): string | null {
  const s = (v ?? "").replace(/\s+/g, " ").trim();
  return s ? s.slice(0, max) : null;
}

/** "10/08/2026" vira "2026-08-10". Vazio e "00/00/0000" viram null. */
function dia(v: string | undefined): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec((v ?? "").trim());
  if (!m || m[3] === "0000") return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function telefone(...candidatos: (string | undefined)[]): string | null {
  for (const c of candidatos) {
    let d = (c ?? "").replace(/\D/g, "");
    if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
    if (d.length === 10 || d.length === 11) return `55${d}`;
  }
  return null;
}

/** Devolve um leitor de coluna pelo NOME, para o arquivo sobreviver a troca de ordem. */
function colunas(cabecalho: string[], obrigatorias: string[], arquivo: string) {
  const indice = new Map(cabecalho.map((nome, i) => [semAcento(nome), i]));
  const faltando = obrigatorias.filter((nome) => !indice.has(semAcento(nome)));
  if (faltando.length) {
    throw new ArquivoDaTrayInvalido(
      `O arquivo de ${arquivo} não tem a coluna ${faltando.map((f) => `"${f}"`).join(", ")}. ` +
        "Ou não é a exportação certa, ou a Tray mudou o formato.",
    );
  }
  return (linha: string[], nome: string): string | undefined => {
    const i = indice.get(semAcento(nome));
    return i === undefined ? undefined : linha[i];
  };
}

/** Lê a exportação "Pedidos". Linha sem número de pedido ou sem data é ignorada. */
export function lerPedidos(bytes: Uint8Array): PedidoDaTray[] {
  const linhas = lerCsv(decodificar(bytes));
  if (linhas.length === 0) throw new ArquivoDaTrayInvalido("O arquivo de pedidos está vazio.");
  const col = colunas(linhas[0], ["Pedido", "Data", "Hora", "Status pedido", "Total"], "pedidos");

  const pedidos = new Map<number, PedidoDaTray>();
  for (const l of linhas.slice(1)) {
    const numero = Number((col(l, "Pedido") ?? "").trim());
    const quando = dia(col(l, "Data"));
    const total = dinheiro(col(l, "Total"));
    if (!Number.isInteger(numero) || numero <= 0 || !quando || total === null) continue;

    const hora = /^\d{2}:\d{2}(:\d{2})?$/.test((col(l, "Hora") ?? "").trim())
      ? (col(l, "Hora") as string).trim()
      : "12:00:00";
    const status = texto(col(l, "Status pedido"), 80) ?? "SEM STATUS";
    const parceiro = texto(col(l, "Parceiro"), 40);

    pedidos.set(numero, {
      pedido: numero,
      // O Brasil não tem horário de verão desde 2019: São Paulo é sempre -03:00.
      feito_em: `${quando}T${hora.length === 5 ? `${hora}:00` : hora}-03:00`,
      dia: quando,
      status,
      situacao: situacaoDoStatus(status),
      cliente_codigo: texto(col(l, "Código cliente"), 40),
      cliente_nome: texto(col(l, "Nome do Cliente"), 160),
      cliente_email: texto(col(l, "Email"), 200)?.toLowerCase() ?? null,
      cliente_telefone: telefone(col(l, "Celular"), col(l, "Telefone")),
      subtotal: dinheiro(col(l, "Subtotal produtos")),
      frete_tipo: texto(col(l, "Frete tipo"), 120),
      frete_valor: dinheiro(col(l, "Frete valor")),
      desconto: dinheiro(col(l, "Desconto")),
      // A Tray escreve "BEMVINDO10/38.99": código, barra e o valor do desconto.
      cupom: texto((col(l, "Cupom desconto") ?? "").split("/")[0], 60)?.toUpperCase() ?? null,
      total,
      pagamento_tipo: texto(col(l, "Pagamento tipo"), 120),
      pagamento_em: dia(col(l, "Pagamento data")),
      forma_paga: texto(col(l, "Forma pagamento paga"), 120),
      valor_pago: dinheiro(col(l, "Valor pagamento")),
      canal: texto(col(l, "Canal de venda"), 60),
      parceiro: parceiro === "0" ? null : parceiro,
      utm_source: texto(col(l, "UTM Source"), 120),
      cidade: texto(col(l, "Cidade"), 120),
      uf: texto(col(l, "Estado"), 2)?.toUpperCase() ?? null,
      envio_em: dia(col(l, "Envio data")),
      envio_codigo: texto(col(l, "Envio codigo"), 80),
    });
  }
  return [...pedidos.values()].sort((a, b) => a.pedido - b.pedido);
}

/** Lê a exportação "Produtos vendidos" e devolve os itens agrupados por pedido. */
export function lerProdutosVendidos(bytes: Uint8Array): Map<number, ItemDoPedido[]> {
  const linhas = lerCsv(decodificar(bytes));
  if (linhas.length === 0) throw new ArquivoDaTrayInvalido("O arquivo de produtos vendidos está vazio.");
  const col = colunas(linhas[0], ["Código pedido", "Nome produto", "Quantidade"], "produtos vendidos");

  const porPedido = new Map<number, ItemDoPedido[]>();
  for (const l of linhas.slice(1)) {
    const numero = Number((col(l, "Código pedido") ?? "").trim());
    const nome = texto(col(l, "Nome produto"), 300);
    if (!Number.isInteger(numero) || numero <= 0 || !nome) continue;
    const quantidade = Number((col(l, "Quantidade") ?? "").replace(",", ".").trim());
    const itens = porPedido.get(numero) ?? [];
    itens.push({
      produto_tray_id: texto(col(l, "Código produto"), 40),
      nome,
      referencia: texto(col(l, "Referência"), 120),
      quantidade: Number.isFinite(quantidade) && quantidade > 0 ? quantidade : 1,
      preco: dinheiro(col(l, "Preço venda")),
      custo: dinheiro(col(l, "Preço custo")),
      info: texto(col(l, "Informação adicional"), 300),
    });
    porPedido.set(numero, itens);
  }
  return porPedido;
}

export type ResumoDoDia = {
  dia: string;
  pagos: number;
  valorPago: number;
  aguardando: number;
  valorAguardando: number;
  cancelados: number;
  valorCancelado: number;
};

/** Total de cada dia por situação, do mais recente para o mais antigo. */
export function resumirPorDia(pedidos: PedidoDaTray[]): ResumoDoDia[] {
  const dias = new Map<string, ResumoDoDia>();
  for (const p of pedidos) {
    const d =
      dias.get(p.dia) ??
      { dia: p.dia, pagos: 0, valorPago: 0, aguardando: 0, valorAguardando: 0, cancelados: 0, valorCancelado: 0 };
    if (p.situacao === "pago") {
      d.pagos++;
      d.valorPago += p.total;
    } else if (p.situacao === "aguardando") {
      d.aguardando++;
      d.valorAguardando += p.total;
    } else {
      d.cancelados++;
      d.valorCancelado += p.total;
    }
    dias.set(p.dia, d);
  }
  const arredondar = (n: number) => Math.round(n * 100) / 100;
  return [...dias.values()]
    .map((d) => ({
      ...d,
      valorPago: arredondar(d.valorPago),
      valorAguardando: arredondar(d.valorAguardando),
      valorCancelado: arredondar(d.valorCancelado),
    }))
    .sort((a, b) => (a.dia < b.dia ? 1 : -1));
}
