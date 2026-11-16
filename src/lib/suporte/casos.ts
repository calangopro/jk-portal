import type { Tom } from "@/lib/painel/tons";
import type { Tema } from "@/lib/time/biblioteca";

/**
 * Suporte pós-venda: o vendedor passa o caso do cliente para o gerente.
 *
 * Arquivo PURO (sem banco, sem navegador): serve à tela, ao servidor e ao
 * teste (`npm run verificar:suporte`). O banco é a 0102.
 *
 * É uma PASSAGEM, não um chamado: o caso troca de dono. O vendedor entrega o
 * cliente (pedido ou telefone, o que ele disse e o print) e volta a vender; o
 * suporte assume, resolve com o cliente por fora do painel (WhatsApp ou
 * Kommo) e fecha com uma nota, que é o que o vendedor lê. Quem precisa
 * perguntar alguma coisa no meio usa o chat do time.
 */

export type Assunto = "pedra" | "ajuste" | "troca" | "defeito" | "atraso" | "gravacao" | "cancelamento" | "outro";

/**
 * A lista curta de assuntos, na ordem da tela. Saiu do grupo do time: pós-venda,
 * troca e acompanhar pedido eram os assuntos que o vendedor levava ao gerente.
 * É a mesma lista da trava do banco (0102). O tema é o da Biblioteca JK, para
 * o caso resolvido virar resposta já no lugar certo.
 */
export const ASSUNTOS: { chave: Assunto; nome: string; tema: Tema }[] = [
  { chave: "pedra", nome: "Caiu a pedra", tema: "pos_venda" },
  { chave: "ajuste", nome: "Ajuste de tamanho", tema: "pos_venda" },
  { chave: "troca", nome: "Troca", tema: "troca" },
  { chave: "defeito", nome: "Defeito ou garantia", tema: "pos_venda" },
  { chave: "atraso", nome: "Atraso ou rastreio", tema: "pagamento_pedido" },
  { chave: "gravacao", nome: "Gravação errada", tema: "gravacao_produto" },
  { chave: "cancelamento", nome: "Cancelamento", tema: "pagamento_pedido" },
  { chave: "outro", nome: "Outro assunto", tema: "pos_venda" },
];

export const NOME_DO_ASSUNTO = Object.fromEntries(ASSUNTOS.map((a) => [a.chave, a.nome])) as Record<Assunto, string>;

export function lerAssunto(v: unknown): Assunto | null {
  return ASSUNTOS.some((a) => a.chave === v) ? (v as Assunto) : null;
}

export type EstadoDoCaso = "na_fila" | "com_suporte" | "resolvido" | "devolvido";

export const ABERTOS: readonly EstadoDoCaso[] = ["na_fila", "com_suporte"];

export type Caso = {
  id: number;
  assunto: Assunto;
  relato: string;
  urgente: boolean;
  estado: EstadoDoCaso;
  abertoEm: string;
  abertoPor: string;
  abertoPorNome: string | null;
  assumidoPor: string | null;
  assumidoPorNome: string | null;
  assumidoEm: string | null;
  fechadoPorNome: string | null;
  fechadoEm: string | null;
  nota: string | null;
  /** Quantos prints vieram. O link de cada um é pedido à parte, assinado. */
  imagens: number;
  naBiblioteca: string | null;
  /** Quem passou o caso já viu como ele fechou. */
  visto: boolean;
  cliente: {
    nome: string | null;
    /** Só dígitos, com o 55 na frente. */
    telefone: string | null;
    pedido: number | null;
    /** A referência da ficha do cliente (`p123`, `v<id>`), nunca o telefone. */
    ref: string | null;
    situacao: string | null;
    etapa: string | null;
  };
};

export type ListaDoSuporte = { agora: string; atende: boolean; abre: boolean; casos: Caso[] };

const objeto = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const texto = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);
const inteiro = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
};
const ESTADOS: readonly EstadoDoCaso[] = ["na_fila", "com_suporte", "resolvido", "devolvido"];

/** Lê um caso como a função do banco devolve. `null` quando a forma não bate: caso estranho não entra na tela. */
export function lerCaso(v: unknown): Caso | null {
  const l = objeto(v);
  if (!l) return null;
  const id = inteiro(l.id);
  const assunto = lerAssunto(l.assunto);
  const estado = ESTADOS.find((e) => e === l.estado);
  if (id <= 0 || !assunto || !estado || typeof l.aberto_em !== "string" || typeof l.aberto_por !== "string") return null;
  const c = objeto(l.cliente) ?? {};
  const pedido = inteiro(c.pedido);
  return {
    id,
    assunto,
    relato: typeof l.relato === "string" ? l.relato : "",
    urgente: l.urgente === true,
    estado,
    abertoEm: l.aberto_em,
    abertoPor: l.aberto_por,
    abertoPorNome: texto(l.aberto_por_nome),
    assumidoPor: texto(l.assumido_por),
    assumidoPorNome: texto(l.assumido_por_nome),
    assumidoEm: texto(l.assumido_em),
    fechadoPorNome: texto(l.fechado_por_nome),
    fechadoEm: texto(l.fechado_em),
    nota: texto(l.nota),
    imagens: Math.max(0, inteiro(l.imagens)),
    naBiblioteca: texto(l.na_biblioteca),
    visto: l.visto === true,
    cliente: {
      nome: texto(c.nome),
      telefone: texto(c.telefone),
      pedido: pedido > 0 ? pedido : null,
      ref: texto(c.ref),
      situacao: texto(c.situacao),
      etapa: texto(c.etapa),
    },
  };
}

export function lerLista(v: unknown): ListaDoSuporte | null {
  const l = objeto(v);
  if (!l || typeof l.agora !== "string") return null;
  return {
    agora: l.agora,
    atende: l.atende === true,
    abre: l.abre === true,
    casos: (Array.isArray(l.casos) ? l.casos : []).map(lerCaso).filter((c): c is Caso => c !== null),
  };
}

// ------------------------------------------------------------------ os números

export type ResumoDoSuporte = {
  /** Casos sem dono. Só conta para quem atende. */
  fila: number;
  filaDesde: string | null;
  /** Casos com a própria pessoa, ainda abertos. */
  comigo: number;
  comigoDesde: string | null;
  /** Casos que a pessoa passou e ainda estão abertos. */
  meusAbertos: number;
  /** Casos que a pessoa passou, que fecharam e ela ainda não viu. */
  novidades: number;
};

export const SEM_RESUMO_DO_SUPORTE: ResumoDoSuporte = { fila: 0, filaDesde: null, comigo: 0, comigoDesde: null, meusAbertos: 0, novidades: 0 };

export function lerResumoDoSuporte(v: unknown): ResumoDoSuporte {
  const l = objeto(v);
  if (!l) return SEM_RESUMO_DO_SUPORTE;
  return {
    fila: Math.max(0, inteiro(l.fila)),
    filaDesde: texto(l.fila_desde),
    comigo: Math.max(0, inteiro(l.comigo)),
    comigoDesde: texto(l.comigo_desde),
    meusAbertos: Math.max(0, inteiro(l.meus_abertos)),
    novidades: Math.max(0, inteiro(l.novidades)),
  };
}

/** O endereço da tela do suporte: é a chave do número no menu. */
export const ENDERECO_DO_SUPORTE = "/admin/suporte";

/**
 * O número do menu: o caso sem dono, para quem atende (é o que não pode ficar
 * esquecido), e o caso que fechou e a pessoa ainda não viu. O caso que já tem
 * dono não conta: ele está com alguém.
 */
export function esperandoNoSuporte(r: Pick<ResumoDoSuporte, "fila" | "novidades">): number {
  return Math.max(0, r.fila) + Math.max(0, r.novidades);
}

export function avisosDoSuporte(r: Pick<ResumoDoSuporte, "fila" | "novidades">): Record<string, number> {
  return { [ENDERECO_DO_SUPORTE]: esperandoNoSuporte(r) };
}

// ------------------------------------------------------------------ o relógio

/**
 * Quanto um caso pode esperar antes de mudar de cor, em minutos.
 *
 * SÃO PREMISSAS DE PARTIDA, e a tela diz isso por extenso. Sem dono é o
 * cliente esperando a primeira resposta: meia hora já é fora do costume do
 * time (no grupo, a dúvida comum era respondida em 2 minutos) e duas horas é
 * cliente irritado. Com dono, o caso costuma depender de loja ou de fábrica:
 * um dia aberto pede olhar, três dias é esquecido. Relógio corrido. Trocar
 * quando a JK disser o prazo do pós-venda.
 */
export const LIMITES_DO_SUPORTE = {
  semDono: { atencao: 30, atraso: 120 },
  comDono: { atencao: 24 * 60, atraso: 72 * 60 },
};

/** "agora", "12 min", "3 h", "2 dias": curto, para caber no selo. */
export function duracao(minutos: number): string {
  const m = Math.max(0, Math.floor(minutos));
  if (m < 1) return "agora";
  if (m < 60) return `${m} min`;
  if (m < 48 * 60) return `${Math.floor(m / 60)} h`;
  return `${Math.floor(m / 1440)} dias`;
}

export type Espera = { tom: Tom; palavra: string; minutos: number };

const primeiro = (nome: string | null) => (nome ?? "").trim().split(/\s+/)[0] || null;

/** A cor e a palavra do caso, pela régua de cima. O fechado não tem relógio. */
export function esperaDoCaso(c: Pick<Caso, "estado" | "abertoEm" | "assumidoEm" | "assumidoPorNome" | "fechadoPorNome">, agora: number): Espera {
  if (c.estado === "resolvido") return { tom: "bom", palavra: c.fechadoPorNome ? `Resolvido por ${primeiro(c.fechadoPorNome)}` : "Resolvido", minutos: 0 };
  if (c.estado === "devolvido") return { tom: "atencao", palavra: "Voltou para o vendedor", minutos: 0 };
  const comDono = c.estado === "com_suporte";
  const desde = Date.parse((comDono ? c.assumidoEm : null) ?? c.abertoEm);
  const minutos = Number.isFinite(desde) ? Math.max(0, Math.floor((agora - desde) / 60_000)) : 0;
  const limite = comDono ? LIMITES_DO_SUPORTE.comDono : LIMITES_DO_SUPORTE.semDono;
  const ha = duracao(minutos);
  const tom: Tom = minutos >= limite.atraso ? "ruim" : minutos >= limite.atencao ? "atencao" : "neutro";
  if (comDono) {
    const quem = primeiro(c.assumidoPorNome);
    return { tom, palavra: minutos < 1 ? `Com ${quem ?? "o suporte"} agora` : `Com ${quem ?? "o suporte"} há ${ha}`, minutos };
  }
  return { tom, palavra: minutos < 1 ? "Na fila agora" : `Sem dono há ${ha}`, minutos };
}

/** "30 minutos", "2 horas", "1 dia": por extenso, para a frase das premissas. */
function porExtenso(minutos: number): string {
  if (minutos < 60) return `${minutos} minutos`;
  if (minutos < 1440) return minutos === 60 ? "1 hora" : `${Math.round(minutos / 60)} horas`;
  const dias = Math.round(minutos / 1440);
  return dias === 1 ? "1 dia" : `${dias} dias`;
}

/** A frase que explica as cores na tela, montada dos próprios limites para nunca discordar deles. */
export function limitesDoSuportePorExtenso(): string {
  const s = LIMITES_DO_SUPORTE.semDono;
  const c = LIMITES_DO_SUPORTE.comDono;
  return `Caso sem dono fica âmbar depois de ${porExtenso(s.atencao)} e vermelho depois de ${porExtenso(s.atraso)}; com dono, âmbar depois de ${porExtenso(c.atencao)} e vermelho depois de ${porExtenso(c.atraso)}, no relógio corrido. É uma premissa de partida: a JK ainda não disse o prazo do pós-venda.`;
}

/**
 * A ordem da fila: o cliente esperando agora na frente, depois o que espera
 * há mais tempo. Fechado vai para o fim, do mais novo para o mais velho.
 */
export function ordenarCasos(casos: readonly Caso[]): Caso[] {
  const aberto = (c: Caso) => ABERTOS.includes(c.estado);
  return [...casos].sort((a, b) => {
    if (aberto(a) !== aberto(b)) return aberto(a) ? -1 : 1;
    if (aberto(a)) {
      if (a.urgente !== b.urgente) return a.urgente ? -1 : 1;
      return Date.parse(a.abertoEm) - Date.parse(b.abertoEm);
    }
    return Date.parse(b.fechadoEm ?? b.abertoEm) - Date.parse(a.fechadoEm ?? a.abertoEm);
  });
}

// ------------------------------------------------------------------ o cliente

/** Só dígitos, com o 55 na frente; `null` quando não dá para ser telefone. A mesma conta de `suporte_telefone` no banco. */
export function telefoneDoCliente(v: string): string | null {
  const d = v.replace(/\D/g, "");
  if (/^[0-9]{10,11}$/.test(d)) return `55${d}`;
  if (/^55[0-9]{10,11}$/.test(d)) return d;
  return null;
}

/** "(11) 98765-4321", para ler na tela. */
export function telefoneLegivel(t: string | null): string {
  if (!t) return "";
  const d = t.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return t;
}

/** O link que abre a conversa com o cliente no WhatsApp de quem clicou. O painel não manda mensagem: só abre a conversa. */
export function linkDoWhatsapp(t: string | null): string | null {
  const d = (t ?? "").replace(/\D/g, "");
  return /^55[0-9]{10,11}$/.test(d) ? `https://wa.me/${d}` : null;
}

/** O que o vendedor preencheu, antes de ir ao banco. */
export type RascunhoDoCaso = {
  assunto: string;
  relato: string;
  /** `p123` quando o cliente veio de um pedido escolhido na busca. */
  ref: string;
  telefone: string;
  nome: string;
  imagens: number;
};

export const MAXIMO_DE_PRINTS = 4;

/** As mesmas conferências do banco, para a pessoa saber o que falta antes de enviar. `null` quando está tudo certo. */
export function conferirCaso(r: RascunhoDoCaso): string | null {
  if (!lerAssunto(r.assunto)) return "Escolha o assunto do caso.";
  const relato = r.relato.trim();
  if (relato.length < 5) return "Conte o que o cliente disse, nem que seja em uma frase.";
  if (relato.length > 2000) return "O relato passou de 2.000 letras.";
  if (r.nome.trim().length > 120) return "O nome do cliente passou de 120 letras.";
  const temTelefone = r.telefone.trim() !== "";
  if (temTelefone && !telefoneDoCliente(r.telefone)) return "O telefone precisa ter DDD e número, como 11 98765 4321.";
  if (!/^p[1-9][0-9]{0,14}$/.test(r.ref) && !temTelefone) return "Diga quem é o cliente: o número do pedido ou o telefone.";
  if (r.imagens > MAXIMO_DE_PRINTS) return `Dá para mandar até ${MAXIMO_DE_PRINTS} prints por caso.`;
  return null;
}

// --------------------------------------------------------------- a biblioteca

/**
 * O começo da resposta da Biblioteca JK que nasce de um caso resolvido. A
 * pergunta parte do assunto (o relato tem palavra do cliente, e às vezes o
 * nome dele); a explicação parte da nota de quem resolveu. A pessoa edita
 * antes de salvar, e a tela pede para tirar dado de cliente.
 */
export function rascunhoDaBiblioteca(c: Pick<Caso, "assunto" | "nota">): { tema: Tema; pergunta: string; explicacao: string } {
  const a = ASSUNTOS.find((x) => x.chave === c.assunto) ?? ASSUNTOS[ASSUNTOS.length - 1];
  const pergunta =
    {
      pedra: "Caiu a pedra da aliança. O que fazer?",
      ajuste: "O cliente quer ajustar o tamanho da aliança. Como funciona?",
      troca: "O cliente quer trocar a peça. Como funciona?",
      defeito: "A peça apresentou defeito. O que a garantia cobre?",
      atraso: "O pedido está atrasado. O que dizer ao cliente?",
      gravacao: "A gravação saiu errada. O que fazer?",
      cancelamento: "O cliente quer cancelar o pedido. Como funciona?",
      outro: "",
    }[a.chave] ?? "";
  return { tema: a.tema, pergunta, explicacao: (c.nota ?? "").slice(0, 4000) };
}

// ----------------------------------------------------------- o aviso do sistema

/** O caso que vira notificação do computador, do jeito que `suporte_para_avisar` (0102) devolve. */
export type SuporteParaAvisar = { id: number; tipo: "novo" | "resolvido" | "devolvido"; assunto: Assunto; urgente: boolean; quem: string | null };

export function lerSuporteParaAvisar(v: unknown): { agora: string | null; casos: SuporteParaAvisar[] } {
  const l = objeto(v);
  if (!l) return { agora: null, casos: [] };
  const casos = (Array.isArray(l.casos) ? l.casos : [])
    .map(objeto)
    .map((c): SuporteParaAvisar | null => {
      if (!c) return null;
      const id = inteiro(c.id);
      const assunto = lerAssunto(c.assunto);
      const tipo = c.tipo === "novo" || c.tipo === "resolvido" || c.tipo === "devolvido" ? c.tipo : null;
      return id > 0 && assunto && tipo ? { id, tipo, assunto, urgente: c.urgente === true, quem: texto(c.quem) } : null;
    })
    .filter((c): c is SuporteParaAvisar => c !== null);
  return { agora: texto(l.agora), casos };
}

/**
 * O texto da notificação. Para quem atende, o caso novo; para quem passou, o
 * caso dele que fechou. Sem dado de cliente: a notificação aparece na tela do
 * computador, à vista de quem passar. A marca é por caso e por estado, para
 * duas abas abertas não avisarem em dobro.
 */
export function avisoDoSuporte(c: SuporteParaAvisar): { titulo: string; corpo: string; marca: string } {
  const assunto = NOME_DO_ASSUNTO[c.assunto];
  const quem = primeiro(c.quem) ?? "alguém do time";
  const marca = `jk-suporte-${c.id}-${c.tipo}`;
  if (c.tipo === "novo") {
    return { titulo: `Caso de suporte: ${assunto}`, corpo: `Passado por ${quem}${c.urgente ? ", com o cliente esperando agora" : ""}. Caso ${c.id}.`, marca };
  }
  if (c.tipo === "resolvido") return { titulo: `Seu caso foi resolvido: ${assunto}`, corpo: `Por ${quem}. A nota está no suporte. Caso ${c.id}.`, marca };
  return { titulo: `Seu caso voltou para você: ${assunto}`, corpo: `${quem} devolveu, com o motivo. Caso ${c.id}.`, marca };
}

