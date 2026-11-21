/**
 * O balcão da loja física na Kommo (cartão 72, 0201): o que um pedido ou um
 * lead do balcão vira na Kommo. Conta pura, sem rede nem banco, com teste em
 * `scripts/teste-balcao.mts`.
 *
 * Os campos são os que a loja preenchia à mão no funil LOJA | PDV (medido no
 * espelho em 20/11/2026: Método de pagamento, Pagamento, Motivo da Compra,
 * Origem do cliente, Tipo de Produto, Metal, Data da Compra, Quantidade,
 * Produto, Numeração, Gravura), mais o campo Loja. Vão pelo NOME e pelo nome
 * da opção; quem troca por id é a escrita, lendo a Kommo (`camposParaKommo`).
 * O que o painel não sabe com certeza fica vazio, nunca chutado: Metal e Tipo
 * de Produto só saem quando a palavra está no nome da peça.
 *
 * Módulo puro: só importa tipo de outro arquivo.
 */

import type { Acao, ContatoNovo } from "./automacoes-regra";

export type LigacaoDaLoja = {
  loja: string;
  loja_kommo: string | null;
  tag: string | null;
  funil_pedido: number | null;
  etapa_pedido: number | null;
  funil_lead: number | null;
  etapa_lead: number | null;
  responsavel_id: number | null;
};

export type PecaDoPedido = { nome: string; quantidade: number; info: string | null };

export type PedidoParaKommo = {
  id: string;
  numero: number;
  loja: string;
  vendedor: string;
  cliente_nome: string;
  cliente_telefone: string;
  cliente_email: string | null;
  motivo: string | null;
  data_especial: string | null;
  origem_cliente: string | null;
  pecas: PecaDoPedido[];
  total: number | string;
  entrega_texto: string | null;
  prazo: string | null;
  observacao: string | null;
  criado_em: string;
  pagamentos: { valor: number | string; forma: string; parcelas: number }[];
};

export type LeadParaKommo = {
  id: string;
  loja: string;
  vendedor: string;
  cliente_nome: string;
  cliente_telefone: string;
  interesse: string | null;
  tipo_produto: string | null;
  motivo: string | null;
  data_especial: string | null;
  origem_cliente: string | null;
  observacao: string | null;
  criado_em: string;
};

/** "Como conheceu a JK": a chave do painel e a opção do campo Origem do cliente da Kommo. */
export const ORIGENS: { chave: string; nome: string; kommo: string }[] = [
  { chave: "shopping", nome: "Passou na loja", kommo: "Shopping (passante)" },
  { chave: "instagram", nome: "Instagram", kommo: "Instagram" },
  { chave: "google", nome: "Google", kommo: "Google" },
  { chave: "indicacao", nome: "Indicação", kommo: "Indicação" },
  { chave: "recompra", nome: "Já é cliente", kommo: "Já é cliente (recompra)" },
  { chave: "whatsapp", nome: "WhatsApp", kommo: "WhatsApp" },
];

/** O que o cliente procurava (lead): a chave e a opção do campo Tipo de Produto. */
export const TIPOS_DE_PRODUTO: { chave: string; nome: string; kommo: string | null }[] = [
  { chave: "aliancas", nome: "Alianças", kommo: "Alianças" },
  { chave: "aneis", nome: "Anéis", kommo: "Anéis" },
  { chave: "colares", nome: "Colares", kommo: "Colares" },
  { chave: "corrente", nome: "Corrente", kommo: "Corrente" },
  { chave: "brinco", nome: "Brinco", kommo: "Brinco" },
  { chave: "pulseira", nome: "Pulseira", kommo: "Pulseira" },
  { chave: "gargantilha", nome: "Gargantilha", kommo: "Gargantilha" },
  { chave: "outro", nome: "Outro", kommo: null },
];

const MOTIVO_NA_KOMMO: Record<string, string> = { namoro: "Namoro", noivado: "Noivado", casamento: "Casamento", presente: "Presente" };
const FORMA_NA_KOMMO: Record<string, string> = { pix: "Pix", credito: "Pagamento com cartão", debito: "Pagamento com cartão", dinheiro: "Dinheiro" };

const limpo = (t: string | null | undefined, max: number) =>
  String(t ?? "").replace(/[—–]/g, ",").replace(/\s+/g, " ").trim().slice(0, max);

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Meia-noite do dia em São Paulo, em segundos: é como a loja grava a Data da Compra (03:00 UTC). */
export function diaEmSegundos(isoOuDia: string): number {
  const dia = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(isoOuDia.length === 10 ? `${isoOuDia}T12:00:00Z` : isoOuDia));
  return Math.round(Date.parse(`${dia}T03:00:00Z`) / 1000);
}

/** As linhas da peça que a fábrica lê, sem o HTML. */
function linhas(info: string | null): string[] {
  return String(info ?? "")
    .split(/<br\s*\/?>/i)
    .map((l) => l.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").trim())
    .filter(Boolean);
}

/** Numeração das peças, no jeito que a loja escrevia ("18 e 24"). */
export function numeracaoDasPecas(pecas: PecaDoPedido[]): string {
  const nums = pecas.flatMap((p) => linhas(p.info).filter((l) => /^Numera/.test(l)).map((l) => l.split(":").slice(1).join(":").trim())).filter(Boolean);
  return nums.join(" e ").slice(0, 120);
}

/** O texto das gravações ("+ Ana 20.03.27 - Beto 20.03.27" virava à mão; aqui sai separado por " / "). */
export function gravacaoDasPecas(pecas: PecaDoPedido[]): string {
  const txt = pecas.flatMap((p) => linhas(p.info).filter((l) => /^Grava[cç][aã]o( -|,)/i.test(l)).map((l) => l.split(":").slice(1).join(":").trim())).filter(Boolean);
  return txt.join(" / ").slice(0, 250);
}

/** Metal só quando a palavra está no nome da peça (todas as peças com o mesmo metal). */
export function metalDasPecas(pecas: PecaDoPedido[]): string | null {
  const metais = new Set(
    pecas.map((p) => {
      const n = semAcento(p.nome);
      if (/semijoia|folhead|banhad/.test(n)) return "Semijoia";
      const ouro = /\bouro\b|\b18k\b|\b10k\b/.test(n);
      const prata = /\bprata\b|\b925\b/.test(n);
      if (prata && ouro) return "Prata encapada a ouro";
      if (ouro) return "Ouro";
      if (prata) return "Prata";
      return null;
    }),
  );
  return metais.size === 1 ? [...metais][0] : null;
}

/** Tipo de Produto só quando a palavra está no nome (e é o mesmo para todas as peças). */
export function tipoDasPecas(pecas: PecaDoPedido[]): string | null {
  const tipos = new Set(
    pecas.map((p) => {
      const n = semAcento(p.nome);
      if (/alianc/.test(n)) return "Alianças";
      if (/\banel\b|\baneis\b|solitario/.test(n)) return "Anéis";
      if (/brinco/.test(n)) return "Brinco";
      if (/pulseira/.test(n)) return "Pulseira";
      if (/gargantilha/.test(n)) return "Gargantilha";
      if (/corrente/.test(n)) return "Corrente";
      if (/colar/.test(n)) return "Colares";
      return null;
    }),
  );
  return tipos.size === 1 ? [...tipos][0] : null;
}

/** Pagamento (À vista ou Parcelamento): só quando dá para dizer. Sinal com saldo aberto não é nenhum dos dois. */
export function pagamentoNaKommo(p: PedidoParaKommo): string | null {
  if (p.pagamentos.some((g) => g.forma === "credito" && Number(g.parcelas) > 1)) return "Parcelamento";
  const pago = p.pagamentos.reduce((s, g) => s + Number(g.valor), 0);
  if (p.pagamentos.length === 1 && pago >= Number(p.total)) return "À vista";
  return null;
}

/** A forma de pagamento, quando todos os pagamentos foram pela mesma. */
export function formaNaKommo(p: PedidoParaKommo): string | null {
  const formas = new Set(p.pagamentos.map((g) => FORMA_NA_KOMMO[g.forma] ?? null));
  return formas.size === 1 ? [...formas][0] : null;
}

export function tagsDoBalcao(lig: LigacaoDaLoja, vendedor: string, extra: string[] = []): string[] {
  const tags = ["loja-fisica", "Painel JK", lig.tag ?? `LOJA ${limpo(lig.loja_kommo ?? lig.loja.replace(/^JK\s+/i, ""), 40).toUpperCase()}`, limpo(vendedor, 40).toUpperCase(), ...extra];
  return [...new Set(tags.filter((t) => t.length >= 2))];
}

const dinheiro = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n).replace(/\s/g, " ");
const dataBr = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

export function notaDoPedido(p: PedidoParaKommo): string {
  const pago = p.pagamentos.reduce((s, g) => s + Number(g.valor), 0);
  const total = Number(p.total);
  const pecas = p.pecas.map((x) => {
    const det = linhas(x.info).filter((l) => /^(Numera|Grava|Modelo de Grava)/.test(l));
    return `- ${x.quantidade > 1 ? `${x.quantidade}x ` : ""}${x.nome}${det.length ? ` (${det.join("; ")})` : ""}`;
  });
  return [
    `Pedido PL-${p.numero} do balcão da ${p.loja}, atendido por ${limpo(p.vendedor, 60)}.`,
    ...pecas,
    `Total ${dinheiro(total)}. Pago ${dinheiro(pago)}${total - pago > 0 ? `, falta ${dinheiro(total - pago)}` : ""}.`,
    p.entrega_texto ? `Entrega: ${limpo(p.entrega_texto, 160)}.` : null,
    p.prazo ? `Prazo prometido: ${dataBr(p.prazo)}.` : null,
    p.data_especial ? `Data especial: ${dataBr(p.data_especial)}.` : null,
    p.observacao ? `Observação: ${limpo(p.observacao, 600)}` : null,
    "Lançado pelo painel da JK.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function notaDoLead(l: LeadParaKommo): string {
  const tipo = TIPOS_DE_PRODUTO.find((t) => t.chave === l.tipo_produto)?.nome;
  return [
    `Lead do balcão da ${l.loja}, atendido por ${limpo(l.vendedor, 60)}.`,
    tipo || l.interesse ? `Procurava: ${[tipo, limpo(l.interesse, 300)].filter(Boolean).join(", ")}.` : null,
    l.data_especial ? `Data especial: ${dataBr(l.data_especial)}.` : null,
    l.observacao ? `Observação: ${limpo(l.observacao, 600)}` : null,
    "Lançado pelo painel da JK.",
  ]
    .filter(Boolean)
    .join("\n");
}

function contato(nome: string, telefone: string, email: string | null): ContatoNovo {
  return { nome: limpo(nome, 120), telefone: /^55\d{10,11}$/.test(telefone) ? telefone : null, email: email ? email.trim().toLowerCase() : null };
}

/** O pedido do balcão vira negócio no funil do pedido da loja. Nulo: a ligação da loja não está completa. */
export function decidirPedidoDoBalcao(p: PedidoParaKommo, lig: LigacaoDaLoja | undefined): Extract<Acao, { tipo: "criar_negocio_balcao" }> | null {
  if (!lig || lig.funil_pedido === null || lig.etapa_pedido === null || lig.responsavel_id === null) return null;
  const campos: Record<string, string | number> = {};
  if (lig.loja_kommo) campos["Loja"] = lig.loja_kommo;
  const produto = p.pecas.map((x) => `${x.quantidade > 1 ? `${x.quantidade} ` : ""}${x.nome}`).join(" + ");
  if (produto) campos["Produto"] = limpo(produto, 250);
  const forma = formaNaKommo(p);
  if (forma) campos["Método de pagamento"] = forma;
  const pag = pagamentoNaKommo(p);
  if (pag) campos["Pagamento"] = pag;
  if (p.motivo && MOTIVO_NA_KOMMO[p.motivo]) campos["Motivo da Compra"] = MOTIVO_NA_KOMMO[p.motivo];
  const origem = ORIGENS.find((o) => o.chave === p.origem_cliente)?.kommo;
  if (origem) campos["Origem do cliente"] = origem;
  const tipo = tipoDasPecas(p.pecas);
  if (tipo) campos["Tipo de Produto"] = tipo;
  const metal = metalDasPecas(p.pecas);
  if (metal) campos["Metal"] = metal;
  campos["Data da Compra"] = diaEmSegundos(p.criado_em);
  campos["Quantidade de produtos"] = p.pecas.reduce((s, x) => s + (Number(x.quantidade) || 0), 0);
  const num = numeracaoDasPecas(p.pecas);
  if (num) campos["Numeração"] = num;
  const grav = gravacaoDasPecas(p.pecas);
  if (grav) campos["Gravura"] = grav;
  return {
    tipo: "criar_negocio_balcao",
    automacao: "balcao_pedido",
    chave: `balcao_pedido:${p.id}`,
    cliente: p.cliente_telefone,
    referencia: `PL-${p.numero}`,
    rotulo: limpo(`Pedido PL-${p.numero} de ${p.cliente_nome} (${p.loja})`, 300),
    negocio: {
      nome: limpo(`PL-${p.numero} ${p.cliente_nome}`, 200),
      preco: Number(p.total) || null,
      funilId: lig.funil_pedido,
      etapaId: lig.etapa_pedido,
      responsavelId: lig.responsavel_id,
      tags: tagsDoBalcao(lig, p.vendedor),
      campos,
    },
    contato: contato(p.cliente_nome, p.cliente_telefone, p.cliente_email),
    nota: notaDoPedido(p),
    desistirSeAberto: false,
  };
}

/** O lead do balcão vira negócio no funil de lead da loja. Desiste se o cliente já tem negócio aberto lá. */
export function decidirLeadDoBalcao(l: LeadParaKommo, lig: LigacaoDaLoja | undefined): Extract<Acao, { tipo: "criar_negocio_balcao" }> | null {
  if (!lig || lig.funil_lead === null || lig.etapa_lead === null || lig.responsavel_id === null) return null;
  const campos: Record<string, string | number> = {};
  if (lig.loja_kommo) campos["Loja"] = lig.loja_kommo;
  if (l.motivo && MOTIVO_NA_KOMMO[l.motivo]) campos["Motivo da Compra"] = MOTIVO_NA_KOMMO[l.motivo];
  const origem = ORIGENS.find((o) => o.chave === l.origem_cliente)?.kommo;
  if (origem) campos["Origem do cliente"] = origem;
  const tipo = TIPOS_DE_PRODUTO.find((t) => t.chave === l.tipo_produto)?.kommo;
  if (tipo) campos["Tipo de Produto"] = tipo;
  if (l.interesse) campos["Produto"] = limpo(l.interesse, 250);
  return {
    tipo: "criar_negocio_balcao",
    automacao: "balcao_lead",
    chave: `balcao_lead:${l.id}`,
    cliente: l.cliente_telefone,
    referencia: `lead ${l.id.slice(0, 8)}`,
    rotulo: limpo(`Lead de ${l.cliente_nome} (${l.loja})`, 300),
    negocio: {
      nome: limpo(`Lead balcão ${l.cliente_nome}`, 200),
      preco: null,
      funilId: lig.funil_lead,
      etapaId: lig.etapa_lead,
      responsavelId: lig.responsavel_id,
      tags: tagsDoBalcao(lig, l.vendedor, ["lead-balcao"]),
      campos,
    },
    contato: contato(l.cliente_nome, l.cliente_telefone, null),
    nota: notaDoLead(l),
    desistirSeAberto: true,
  };
}

type FunilParaSugerir = { id: number; nome: string; etapas: { id: number; nome: string; tipo: string }[] };

/**
 * Uma SUGESTÃO de ligação para a tela, pelo nome: "JK Granja" casa com
 * "GRANJA VIANNA | PDV" e com a opção "Granja Vianna". Quem decide e salva é a
 * diretoria; nada aqui é gravado sozinho.
 */
export function sugerirLigacao(loja: string, funis: FunilParaSugerir[], opcoesDeLoja: string[]): Partial<LigacaoDaLoja> {
  const chave = semAcento(loja.replace(/^JK\s+/i, ""));
  const casa = (nome: string) => {
    const n = semAcento(nome);
    return n.startsWith(chave) || n.split(/[\s|]+/).includes(chave);
  };
  // "JK Osasco" e "JK Plaza" são ambíguas com "União Osasco" e "Osasco Plaza": sem sugestão, a diretoria escolhe.
  const ambigua = ["osasco", "plaza"].includes(chave);
  const opcao = ambigua ? null : opcoesDeLoja.find((o) => casa(o)) ?? null;
  const funil = (tipo: "pdv" | "lead") =>
    ambigua ? undefined : funis.find((f) => casa(f.nome.split("|")[0] ?? "") && (tipo === "pdv" ? /\|\s*(pdv|pos vendas|pós vendas)/i.test(f.nome) : /\|\s*whats/i.test(f.nome)));
  const etapa = (f: FunilParaSugerir | undefined, nome: string) => f?.etapas.find((e) => semAcento(e.nome) === semAcento(nome) && (e.tipo === "aberta" || e.tipo === "entrada"));
  const fp = funil("pdv");
  const fl = funil("lead");
  return {
    loja_kommo: opcao,
    funil_pedido: fp?.id ?? null,
    etapa_pedido: etapa(fp, "Lançamento")?.id ?? null,
    funil_lead: fl?.id ?? null,
    etapa_lead: etapa(fl, "Entrada")?.id ?? null,
  };
}
