/**
 * O que a fábrica precisa de uma venda por fora: as peças, com numeração e
 * gravação, e a entrega.
 *
 * O formulário do vendedor manda um objeto; este arquivo confere e devolve no
 * formato que o banco guarda (0075). As peças saem no MESMO formato dos itens
 * de um pedido da Tray: o campo `info` é um texto só, com uma informação por
 * linha separada por `<br />` ("Numeração - Aro 01: 17"). É o formato que
 * `lerEspecificacoes` (`lib/fabrica/etapas.ts`) já abre, então o cartão da
 * fábrica é o mesmo para as duas origens.
 *
 * O TEXTO DA GRAVAÇÃO VAI COMO O CLIENTE ESCREVEU. Os sinais `<`, `>` e `&`
 * são trocados pela forma escrita por extenso só para atravessar o campo, e
 * voltam iguais na tela da fábrica: "Te amo <3" chega como "Te amo <3".
 *
 * Arquivo puro, para o teste rodar sem banco.
 */

export type ModoDeEntrega = "retirada" | "correios" | "moto";
export type TipoDeGravacao = "sem" | "laser" | "manual";

export type PecaDoFormulario = {
  nome: string;
  /** Código do produto na Tray, quando a peça foi escolhida do catálogo. */
  codigo: string | null;
  quantidade: number;
  aro1: string;
  aro2: string;
  anel: string;
  gravacao: TipoDeGravacao;
  gravar1: string;
  gravar2: string;
  detalhes: string;
};

export type ProducaoDoFormulario = {
  pecas: PecaDoFormulario[];
  entrega: ModoDeEntrega;
  /** Nome da loja de retirada, como aparece na lista de lojas. */
  loja: string;
  endereco: string;
  cidade: string;
  uf: string;
};

export type ProducaoParaOBanco = {
  pecas: { nome: string; quantidade: number; info: string | null; produto_tray_id: string | null }[];
  entrega: string;
  endereco: string | null;
  cidade: string | null;
  uf: string | null;
  /** As peças em uma linha, para o campo "o que vendeu" quando ele veio vazio. */
  resumo: string;
};

export const PECA_VAZIA: PecaDoFormulario = { nome: "", codigo: null, quantidade: 1, aro1: "", aro2: "", anel: "", gravacao: "sem", gravar1: "", gravar2: "", detalhes: "" };
export const PRODUCAO_VAZIA: ProducaoDoFormulario = { pecas: [PECA_VAZIA], entrega: "retirada", loja: "", endereco: "", cidade: "", uf: "" };

export const TETO_DE_PECAS = 8;

const NOME_DA_GRAVACAO: Record<Exclude<TipoDeGravacao, "sem">, string> = { laser: "Gravação Laser", manual: "Gravação Manual" };

const limpo = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
/** A gravação mantém os espaços do meio como foram digitados: só tira as pontas e as quebras de linha. */
const comoFoiEscrito = (v: unknown, max: number) => String(v ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, max);
const escapar = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** O texto de uma peça no formato da loja. `null` quando a peça não tem nada a dizer além do nome. */
export function montarInfo(p: PecaDoFormulario): string | null {
  const linhas: string[] = [];
  const aro1 = limpo(p.aro1, 10);
  const aro2 = limpo(p.aro2, 10);
  const anel = limpo(p.anel, 10);
  if (aro1) linhas.push(`Numeração - Aro 01: ${escapar(aro1)}`);
  if (aro2) linhas.push(`Numeração - Aro 02: ${escapar(aro2)}`);
  if (anel) linhas.push(`Numeração Anel Solitário: ${escapar(anel)}`);
  if (p.gravacao !== "sem") {
    linhas.push(`Modelo de Gravação: ${NOME_DA_GRAVACAO[p.gravacao]}`);
    const g1 = comoFoiEscrito(p.gravar1, 120);
    const g2 = comoFoiEscrito(p.gravar2, 120);
    if (g1) linhas.push(`Gravação - Aro 01: ${escapar(g1)}`);
    if (g2) linhas.push(`Gravação - Aro 02: ${escapar(g2)}`);
  }
  const detalhes = limpo(p.detalhes, 300);
  if (detalhes) linhas.push(`Detalhes: ${escapar(detalhes)}`);
  return linhas.length ? `${linhas.join("<br />")}<br />` : null;
}

type Lida = { ok: true; producao: ProducaoParaOBanco } | { ok: false; erro: string };

/**
 * Confere o que veio do formulário. Toda recusa volta com a frase que a pessoa
 * precisa ler para consertar, dizendo qual peça.
 */
export function lerProducao(v: unknown): Lida {
  if (!v || typeof v !== "object") return { ok: false, erro: "Não deu para ler as peças da venda." };
  const o = v as Partial<ProducaoDoFormulario>;
  const cruas = Array.isArray(o.pecas) ? o.pecas : [];
  if (cruas.length === 0) return { ok: false, erro: "Diga pelo menos uma peça para a fábrica." };
  if (cruas.length > TETO_DE_PECAS) return { ok: false, erro: `Cabem até ${TETO_DE_PECAS} peças por venda.` };

  const pecas: ProducaoParaOBanco["pecas"] = [];
  for (let i = 0; i < cruas.length; i++) {
    const c = (cruas[i] ?? {}) as Partial<PecaDoFormulario>;
    const n = cruas.length > 1 ? ` da peça ${i + 1}` : "";
    const nome = limpo(c.nome, 200);
    if (!nome) return { ok: false, erro: `Falta dizer qual é o produto${n}.` };
    const quantidade = Math.round(Number(c.quantidade));
    if (!Number.isFinite(quantidade) || quantidade < 1 || quantidade > 20) return { ok: false, erro: `A quantidade${n} precisa ficar entre 1 e 20.` };
    const gravacao: TipoDeGravacao = c.gravacao === "laser" || c.gravacao === "manual" ? c.gravacao : "sem";
    const temTexto = Boolean(comoFoiEscrito(c.gravar1, 120) || comoFoiEscrito(c.gravar2, 120));
    if (gravacao === "sem" && temTexto) return { ok: false, erro: `Há texto para gravar${n}, mas falta escolher se a gravação é a laser ou manual.` };
    if (gravacao !== "sem" && !temTexto) return { ok: false, erro: `Você escolheu gravação${n}, mas não escreveu o que gravar.` };
    const peca: PecaDoFormulario = {
      nome, codigo: /^[0-9A-Za-z-]{1,20}$/.test(String(c.codigo ?? "")) ? String(c.codigo) : null, quantidade,
      aro1: String(c.aro1 ?? ""), aro2: String(c.aro2 ?? ""), anel: String(c.anel ?? ""), gravacao,
      gravar1: String(c.gravar1 ?? ""), gravar2: String(c.gravar2 ?? ""), detalhes: String(c.detalhes ?? ""),
    };
    pecas.push({ nome, quantidade, info: montarInfo(peca), produto_tray_id: peca.codigo });
  }

  const resumo = pecas.map((p) => `${p.quantidade}× ${p.nome}`).join(", ").slice(0, 300);
  const endereco = limpo(o.endereco, 300);
  const cidade = limpo(o.cidade, 80);
  const uf = limpo(o.uf, 2).toUpperCase();

  if (o.entrega === "retirada") {
    const loja = limpo(o.loja, 90);
    if (!loja) return { ok: false, erro: "Escolha em qual loja o cliente vai retirar." };
    return { ok: true, producao: { pecas, entrega: `Retire na loja do ${loja}`, endereco: null, cidade: null, uf: null, resumo } };
  }
  if (o.entrega === "correios" || o.entrega === "moto") {
    if (endereco.length < 10) return { ok: false, erro: "Escreva o endereço de entrega completo, com número e CEP." };
    if (o.entrega === "correios") {
      if (!cidade || !/^[A-Z]{2}$/.test(uf)) return { ok: false, erro: "Para os Correios, diga a cidade e o estado com duas letras, por exemplo SP." };
      return { ok: true, producao: { pecas, entrega: "Correios", endereco, cidade, uf, resumo } };
    }
    return { ok: true, producao: { pecas, entrega: "Entrega por Motoboy", endereco, cidade: cidade || null, uf: /^[A-Z]{2}$/.test(uf) ? uf : null, resumo } };
  }
  return { ok: false, erro: "Escolha como a peça vai chegar ao cliente." };
}
