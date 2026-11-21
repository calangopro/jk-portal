/**
 * O balcão da loja física (cartão 71): as contas e os textos, sem banco nem
 * React. Teste em `scripts/teste-balcao.mts` (`npm run verificar:balcao`).
 *
 * Quem decide e grava é o banco (0198: `balcao_salvar_pedido`, `balcao_pagar`,
 * `balcao_marcar`...). Aqui mora o que a tela precisa saber para desenhar: em
 * que pé está o pedido, quanto falta receber, o que falta preencher, e a frase
 * pronta para o WhatsApp do cliente.
 *
 * Arquivo puro: só importa TIPO de outro arquivo (o teste roda com `.ts` no
 * caminho e o `tsc` recusa import de função de irmão).
 */

import type { ProducaoDoFormulario } from "@/lib/vendas/producao";

export type FormaDePagamento = "pix" | "credito" | "debito" | "dinheiro" | "link" | "outro";
export type Motivo = "namoro" | "noivado" | "casamento" | "bodas" | "presente" | "outro";
export type TipoDeAnexo = "comprovante" | "documento" | "foto";

export const FORMAS: { chave: FormaDePagamento; nome: string; curto: string }[] = [
  { chave: "pix", nome: "Pix", curto: "Pix" },
  { chave: "credito", nome: "Cartão de crédito", curto: "Crédito" },
  { chave: "debito", nome: "Cartão de débito", curto: "Débito" },
  { chave: "dinheiro", nome: "Dinheiro", curto: "Dinheiro" },
  { chave: "link", nome: "Link de pagamento", curto: "Link" },
  { chave: "outro", nome: "Outro", curto: "Outro" },
];

export const MOTIVOS: { chave: Motivo; nome: string; data: string | null }[] = [
  { chave: "namoro", nome: "Namoro", data: "Dia que começaram a namorar" },
  { chave: "noivado", nome: "Noivado", data: "Dia do pedido de noivado" },
  { chave: "casamento", nome: "Casamento", data: "Dia do casamento" },
  { chave: "bodas", nome: "Bodas", data: "Dia do casamento" },
  { chave: "presente", nome: "Presente", data: null },
  { chave: "outro", nome: "Outro", data: null },
];

export const nomeDaForma = (f: string) => FORMAS.find((x) => x.chave === f)?.nome ?? f;

export type PagamentoDoBalcao = {
  id: string;
  valor: number | string;
  forma: FormaDePagamento;
  parcelas: number;
  pago_em: string;
  comprovante: string | null;
  criado_em: string;
  estornado_em: string | null;
  estornado_motivo: string | null;
};

export type AnexoDoBalcao = { id: string; caminho: string; tipo: TipoDeAnexo; nome: string | null; criado_em: string };

/** O pedido como `balcao_montar` devolve. Valor em dinheiro chega como texto do numeric. */
export type PedidoDoBalcao = {
  id: string;
  numero: number;
  loja: string;
  vendedor: string;
  vendedor_nome: string;
  cliente_nome: string;
  cliente_telefone: string;
  cliente_email: string | null;
  motivo: Motivo | null;
  data_especial: string | null;
  pecas: { nome: string; quantidade: number; info: string | null; produto_tray_id: string | null }[];
  formulario: RascunhoDoBalcao | null;
  entrega: "retirada" | "correios" | "moto" | "a_combinar";
  entrega_texto: string | null;
  endereco: string | null;
  cidade: string | null;
  uf: string | null;
  prazo: string | null;
  total: number | string;
  pago: number | string;
  observacao: string | null;
  numero_papel: string | null;
  fotos: string[];
  transcricao: string | null;
  fabrica_em: string | null;
  recebido_em: string | null;
  entregue_em: string | null;
  cancelado_em: string | null;
  cancelado_motivo: string | null;
  criado_em: string;
  atualizado_em: string;
  criado_por_nome: string | null;
  os: number | null;
  etapa: string | null;
  etapa_nome: string | null;
  etapa_papel: string | null;
  etapa_em: string | null;
  rastreio: string | null;
  ref: string | null;
  pagamentos: PagamentoDoBalcao[];
  anexos: AnexoDoBalcao[];
  /** Pedidos de alteração mandados à fábrica (0199), com o "a fábrica viu". */
  alteracoes?: { id: number; texto: string; pedido_em: string; ciente_em: string | null }[];
};

export type VendedorDaLoja = { id: string; loja: string; nome: string; ativo: boolean };

/** O pagamento que a loja anota junto do pedido (o sinal, quase sempre). */
export type PagamentoDoRascunho = {
  /** uuid do navegador: mandar duas vezes não paga duas vezes. */
  chave: string;
  valor: string;
  forma: FormaDePagamento;
  parcelas: number;
  comprovante: string | null;
};

export type AnexoDoRascunho = { caminho: string; tipo: TipoDeAnexo; nome: string };

/**
 * O pedido enquanto a loja preenche. Fica guardado no aparelho a cada mudança,
 * e é o que vai para o servidor ao salvar (e o que volta para reabrir).
 */
export type RascunhoDoBalcao = {
  id: string;
  loja: string;
  vendedor: string;
  cliente_nome: string;
  cliente_telefone: string;
  cliente_email: string;
  motivo: Motivo | "";
  data_especial: string;
  producao: ProducaoDoFormulario;
  prazo: string;
  total: string;
  observacao: string;
  numero_papel: string;
  fotos: string[];
  transcricao: string;
  pagamento: PagamentoDoRascunho | null;
  anexos: AnexoDoRascunho[];
  /** Quando foi mexido pela última vez (para "continuar o pedido de Ana, há 5 min"). */
  mexido_em: string;
};

export const numeroDoPedido = (n: number | null | undefined) => (n ? `PL-${n}` : "Pedido novo");

/** Lê dinheiro como a pessoa digita: "1.500,00", "1500", "1500,5", "R$ 1.299,90". Nulo quando não é valor. */
export function lerValor(texto: string | number | null | undefined): number | null {
  if (typeof texto === "number") return Number.isFinite(texto) ? Math.round(texto * 100) / 100 : null;
  let s = String(texto ?? "").replace(/[R$\s]/g, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const n = Math.round(Number(s) * 100) / 100;
  return Number.isFinite(n) ? n : null;
}

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
/** "R$ 1.500,00". O espaço do Intl (que não quebra) vira espaço comum, para o texto do WhatsApp sair igual em todo aparelho. */
export const dinheiro = (n: number | string | null | undefined) => BRL.format(Number(n ?? 0)).replace(/\s/g, " ");

const BRL_INTEIRO = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
/** "R$ 3.100", sem centavos: para os números de resumo, que precisam caber num cartão estreito. */
export const dinheiroRedondo = (n: number | string | null | undefined) => BRL_INTEIRO.format(Math.round(Number(n ?? 0))).replace(/\s/g, " ");

/** "30/11" ou "30/11/2027" quando não é deste ano. */
export function dataCurta(iso: string | null | undefined, hoje: string): string {
  if (!iso) return "";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return a === hoje.slice(0, 4) ? `${d}/${m}` : `${d}/${m}/${a}`;
}

/** Dias corridos de `de` até `ate` (AAAA-MM-DD). */
export function diasEntre(de: string, ate: string): number {
  return Math.round((Date.parse(`${ate.slice(0, 10)}T12:00:00Z`) - Date.parse(`${de.slice(0, 10)}T12:00:00Z`)) / 86_400_000);
}

export function somarDias(iso: string, dias: number): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export type Tom = "bom" | "atencao" | "ruim" | "neutro";

export type ChaveDaSituacao = "cancelado" | "entregue" | "na_loja" | "saiu_da_fabrica" | "na_fabrica" | "anotado";

export type Situacao = { chave: ChaveDaSituacao; nome: string; frase: string; tom: Tom };

/** Em que pé está o pedido, do jeito que a loja fala. */
export function situacao(p: Pick<PedidoDoBalcao, "cancelado_em" | "entregue_em" | "recebido_em" | "fabrica_em" | "etapa_nome" | "etapa_papel" | "entrega" | "rastreio">): Situacao {
  if (p.cancelado_em) return { chave: "cancelado", nome: "Cancelado", frase: "O pedido foi cancelado.", tom: "neutro" };
  if (p.entregue_em) return { chave: "entregue", nome: "Entregue", frase: "O cliente já está com a peça.", tom: "bom" };
  if (p.recebido_em) return { chave: "na_loja", nome: "Na loja", frase: "A peça chegou. Falta entregar ao cliente.", tom: "atencao" };
  if (p.fabrica_em) {
    if (p.etapa_papel === "final") {
      return p.entrega === "retirada"
        ? { chave: "saiu_da_fabrica", nome: "A caminho da loja", frase: "Saiu da fábrica. Marque quando chegar na loja.", tom: "atencao" }
        : { chave: "saiu_da_fabrica", nome: "Enviado ao cliente", frase: p.rastreio ? `Saiu da fábrica. Rastreio ${p.rastreio}.` : "Saiu da fábrica direto para o cliente.", tom: "bom" };
    }
    return { chave: "na_fabrica", nome: p.etapa_nome ? `Fábrica: ${p.etapa_nome}` : "Na fábrica", frase: "A fábrica está com o pedido.", tom: "neutro" };
  }
  return { chave: "anotado", nome: "Não foi para a fábrica", frase: "Anotado no balcão. Mande para a fábrica quando estiver tudo certo.", tom: "atencao" };
}

export type Pagamento = { total: number; pago: number; falta: number; chave: "nada" | "sinal" | "pago" | "a_mais"; nome: string; tom: Tom };

/** Quanto entrou e quanto falta. `a_mais`: pagou mais do que o total (erro de digitação ou troco). */
export function pagamento(p: Pick<PedidoDoBalcao, "total" | "pago">): Pagamento {
  const total = Number(p.total ?? 0);
  const pago = Number(p.pago ?? 0);
  const falta = Math.round((total - pago) * 100) / 100;
  if (pago <= 0) return { total, pago, falta, chave: "nada", nome: "Nada pago", tom: "ruim" };
  if (falta > 0) return { total, pago, falta, chave: "sinal", nome: `Sinal de ${dinheiro(pago)}`, tom: "atencao" };
  if (falta < 0) return { total, pago, falta, chave: "a_mais", nome: `Pago ${dinheiro(-falta)} a mais`, tom: "atencao" };
  return { total, pago, falta, chave: "pago", nome: "Pago", tom: "bom" };
}

/** O prazo prometido passou e o cliente ainda não levou. */
export function atrasado(p: Pick<PedidoDoBalcao, "prazo" | "entregue_em" | "cancelado_em">, hoje: string): boolean {
  return Boolean(p.prazo && !p.entregue_em && !p.cancelado_em && p.prazo < hoje);
}

/** Os grupos da lista, na ordem em que a loja precisa agir. */
export const GRUPOS: { chave: ChaveDaSituacao; nome: string }[] = [
  { chave: "na_loja", nome: "Chegou, falta entregar" },
  { chave: "anotado", nome: "Não foi para a fábrica" },
  { chave: "saiu_da_fabrica", nome: "Saiu da fábrica" },
  { chave: "na_fabrica", nome: "Na fábrica" },
  { chave: "entregue", nome: "Entregues" },
  { chave: "cancelado", nome: "Cancelados" },
];

export function agrupar<T extends PedidoDoBalcao>(lista: T[]): { chave: ChaveDaSituacao; nome: string; pedidos: T[] }[] {
  return GRUPOS.map((g) => ({ ...g, pedidos: lista.filter((p) => situacao(p).chave === g.chave) })).filter((g) => g.pedidos.length > 0);
}

/** O WhatsApp do cliente para o link: só números, com o 55. */
export function telefoneParaLink(tel: string): string | null {
  let n = String(tel ?? "").replace(/\D/g, "");
  if (!n.startsWith("55") && (n.length === 10 || n.length === 11)) n = `55${n}`;
  return /^55\d{10,11}$/.test(n) ? n : null;
}

export function linkDoWhatsapp(tel: string, texto: string): string | null {
  const n = telefoneParaLink(tel);
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(texto)}` : null;
}

/** (11) 98888-7777, para ler na tela. */
export function telefoneNaTela(tel: string | null | undefined): string {
  const n = String(tel ?? "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  if (n.length === 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return n;
}

const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0] ?? "";

/** O que a peça pede, em uma linha para o cliente: tira o HTML da fábrica e as linhas de detalhe interno. */
export function pecaEmTexto(p: { nome: string; quantidade: number; info: string | null }): string {
  const info = (p.info ?? "")
    .split(/<br\s*\/?>/i)
    .map((l) => l.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").trim())
    .filter((l) => /^Numeração|^Gravação/.test(l));
  return `${p.quantidade > 1 ? `${p.quantidade}x ` : ""}${p.nome}${info.length ? ` (${info.join("; ")})` : ""}`;
}

/** O resumo do pedido para mandar ao cliente: é o "recibo" que antes era o papel. */
export function resumoParaOCliente(p: PedidoDoBalcao, hoje: string): string {
  const g = pagamento(p);
  const linhas = [
    `Olá, ${primeiroNome(p.cliente_nome)}! Aqui é da JK Alianças, ${p.loja}.`,
    `Seu pedido ${numeroDoPedido(p.numero)}:`,
    ...p.pecas.map((x) => `- ${pecaEmTexto(x)}`),
    `Total: ${dinheiro(g.total)}`,
  ];
  if (g.pago > 0) linhas.push(`Pago: ${dinheiro(g.pago)}`);
  if (g.falta > 0) linhas.push(`Falta: ${dinheiro(g.falta)}`);
  if (p.prazo) linhas.push(p.entrega === "retirada" ? `Previsão para retirar: ${dataCurta(p.prazo, hoje)}` : `Previsão de entrega: ${dataCurta(p.prazo, hoje)}`);
  linhas.push("Qualquer dúvida, é só responder aqui.");
  return linhas.join("\n");
}

/** A peça chegou na loja: o aviso para o cliente vir buscar. */
export function avisoDeChegada(p: PedidoDoBalcao): string {
  const g = pagamento(p);
  const falta = g.falta > 0 ? ` Na retirada, falta pagar ${dinheiro(g.falta)}.` : "";
  return `Olá, ${primeiroNome(p.cliente_nome)}! Sua peça do pedido ${numeroDoPedido(p.numero)} chegou na JK Alianças, ${p.loja}, e já pode ser retirada.${falta} Te esperamos!`;
}

/** O que ainda falta para o rascunho poder ser salvo. Lista vazia: dá para salvar. */
export function faltaNoRascunho(r: RascunhoDoBalcao, precisaLoja: boolean): string[] {
  const falta: string[] = [];
  if (precisaLoja && !r.loja) falta.push("a loja");
  if (!r.vendedor) falta.push("quem atendeu");
  if (!telefoneParaLink(r.cliente_telefone)) falta.push("o WhatsApp do cliente");
  if (r.cliente_nome.trim().length < 2) falta.push("o nome do cliente");
  if (!r.producao.pecas.length || r.producao.pecas.some((p) => p.nome.trim().length < 2)) falta.push("a peça");
  if (r.producao.entrega === "retirada" && !r.producao.loja) falta.push("a loja de retirada");
  if ((r.producao.entrega === "correios" || r.producao.entrega === "moto") && r.producao.endereco.trim().length < 10) falta.push("o endereço de entrega");
  const total = lerValor(r.total);
  if (!total || total <= 0) falta.push("o valor total");
  if (r.pagamento) {
    const v = lerValor(r.pagamento.valor);
    if (!v || v <= 0) falta.push("o valor pago agora");
    else if (total && v > total) falta.push("um pago agora que não passe do total");
  }
  return falta;
}

/** "o nome do cliente e o valor total": a lista do que falta, em português. */
export function emPortugues(itens: string[]): string {
  if (itens.length <= 1) return itens[0] ?? "";
  return `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}

/** Sinal sugerido: metade do total, arredondada para baixo em reais. */
export function sinalSugerido(total: number | null): number | null {
  if (!total || total <= 0) return null;
  return Math.floor(total / 2);
}
