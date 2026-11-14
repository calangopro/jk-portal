/**
 * Quem é o cliente: a chave, o endereço da ficha e a leitura do que foi
 * digitado na busca.
 *
 * A REGRA DE IDENTIDADE é a mesma da fila de recuperação (0054) e das vendas
 * por fora (0058): cliente é o telefone; sem telefone, o e-mail; sem os dois, o
 * código na Tray. No banco isso é
 * `coalesce(cliente_telefone, cliente_email, cliente_codigo)`, e a ficha usa
 * exatamente a mesma expressão, para a pessoa ser uma só em todas as telas.
 *
 * O ENDEREÇO DA FICHA não leva telefone nem e-mail. Endereço fica em histórico
 * do navegador e em registro de servidor, e dado pessoal não tem que morar lá.
 * Por isso a ficha se abre por uma REFERÊNCIA: `p` mais o número de um pedido
 * do cliente, `v` mais o código de uma venda por fora, ou `l` mais o código de
 * um cadastro no grupo. Quem troca a referência pela chave é o banco
 * (`cliente_da_ref`, 0069).
 *
 * Arquivo puro, para o teste rodar sem banco.
 */

/** Aceita "(11) 98888-7777", "11988887777" e "+55 11 98888-7777". Devolve `5511988887777`, ou null. */
export function normalizarTelefone(v: string | null | undefined): string | null {
  let d = (v ?? "").replace(/\D/g, "");
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  return d.length === 10 || d.length === 11 ? `55${d}` : null;
}

/** Telefone, depois e-mail, depois o código na Tray: a mesma ordem do banco. */
export function chaveDoCliente(c: { telefone?: string | null; email?: string | null; codigo?: string | null }): string | null {
  return c.telefone || c.email || c.codigo || null;
}

// ------------------------------------------------------------- a referência

export type Ref = { tipo: "pedido"; pedido: number } | { tipo: "venda" | "lead"; id: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Lê a referência do endereço. Qualquer coisa fora do formato vira null, e a tela mostra "não encontrado". */
export function lerRef(v: string | null | undefined): Ref | null {
  const s = (v ?? "").trim().toLowerCase();
  if (/^p[1-9][0-9]{0,14}$/.test(s)) return { tipo: "pedido", pedido: Number(s.slice(1)) };
  if ((s[0] === "v" || s[0] === "l") && UUID.test(s.slice(1))) return { tipo: s[0] === "v" ? "venda" : "lead", id: s.slice(1) };
  return null;
}

export const refDoPedido = (pedido: number) => `p${pedido}`;
export const refDaVenda = (id: string) => `v${id}`;

// ------------------------------------------------------------------ a busca

export type Busca = {
  /** Palavras do nome, minúsculas e sem acento. Todas precisam aparecer. */
  nome: string[] | null;
  /** Só dígitos, sem o 55: acha o número com ou sem DDD. */
  telefone: string | null;
  email: string | null;
  pedido: number | null;
};

const semAcento = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/**
 * O que a pessoa quis buscar.
 *
 * Só número é pedido OU telefone: até sete dígitos pode ser o número de um
 * pedido, e de quatro para cima também serve como pedaço de telefone, então a
 * busca tenta os dois. Com arroba é e-mail. O resto é nome, palavra por
 * palavra: "maria silva" acha "Maria Aparecida da Silva".
 *
 * Devolve null quando não há o que buscar (vazio, ou curto demais para não
 * trazer a base inteira).
 */
export function interpretarBusca(q: string | null | undefined): Busca | null {
  const s = (q ?? "").trim().slice(0, 120);
  if (s.length < 2) return null;

  if (s.includes("@")) {
    const email = s.toLowerCase().replace(/[^a-z0-9._%+@-]/g, "");
    return email.length >= 3 ? { nome: null, telefone: null, email, pedido: null } : null;
  }

  if (/^[\d\s()+.#-]+$/.test(s)) {
    let d = s.replace(/\D/g, "");
    if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
    if (d.length < 2) return null;
    const pedido = d.length <= 7 && Number(d) > 0 ? Number(d) : null;
    const telefone = d.length >= 4 && d.length <= 11 ? d : null;
    return pedido === null && telefone === null ? null : { nome: null, telefone, email: null, pedido };
  }

  const palavras = semAcento(s.toLowerCase())
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((p) => p.length >= 2)
    .slice(0, 5);
  return palavras.length ? { nome: palavras, telefone: null, email: null, pedido: null } : null;
}

// ------------------------------------------------------------------- o nome

const MINUSCULAS = new Set(["da", "de", "do", "das", "dos", "e"]);

/**
 * "MARIA APARECIDA DA SILVA" e "maria aparecida da silva" viram "Maria
 * Aparecida da Silva". A loja grava o nome como a pessoa digitou, e um em cada
 * oito chega todo em maiúsculas ou todo em minúsculas. Nome já misto fica como
 * está: quem escreveu "McDonald" sabia o que fazia.
 */
export function nomeArrumado(nome: string | null | undefined): string | null {
  const s = (nome ?? "").replace(/\s+/g, " ").trim();
  if (!s) return null;
  if (s !== s.toUpperCase() && s !== s.toLowerCase()) return s;
  return s
    .toLowerCase()
    .split(" ")
    .map((p, i) => (i > 0 && MINUSCULAS.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(" ");
}

export function primeiroNome(nome: string | null | undefined): string | null {
  return nomeArrumado(nome)?.split(" ")[0] ?? null;
}
