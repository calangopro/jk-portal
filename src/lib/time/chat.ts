import type { Tom } from "@/lib/painel/tons";

/**
 * Chat do time: a conversa entre setores, ao vivo, com quem está online.
 *
 * Arquivo PURO (sem banco, sem `server-only`, sem navegador): serve à tela, ao
 * servidor e ao teste (`npm run verificar:biblioteca`). O banco é a 0079, a
 * ligação ao vivo mora em `ao-vivo.ts` e as chamadas ao banco, em
 * `app/admin/(painel)/chat/api.ts`.
 *
 * O chat substituiu os chamados da 0072. O que o chamado tinha de bom ficou
 * como PEDIDO: qualquer mensagem pode pedir resposta, e aí ela tem relógio e
 * fica à vista até alguém responder a ela ou marcar como resolvida. Mensagem
 * comum não tem estado nenhum.
 */

// ------------------------------------------------------------------ as salas

export type Sala = "geral" | "vendas" | "fabrica" | "loja" | "trafego" | "diretoria";

/**
 * As salas são fixas: a geral e uma por setor. Todo o time lê e escreve em
 * todas. A linha de apoio diz o que cada setor costuma resolver, para quem
 * chega saber onde perguntar.
 */
export const SALAS: { chave: Sala; nome: string; resolve: string }[] = [
  { chave: "geral", nome: "Geral", resolve: "Avisos e o que serve para todo mundo" },
  { chave: "vendas", nome: "Vendas", resolve: "Atendimento e clientes" },
  { chave: "fabrica", nome: "Fábrica", resolve: "Produção, prazo e malote" },
  { chave: "loja", nome: "Loja", resolve: "Lojas físicas e loja online" },
  { chave: "trafego", nome: "Tráfego", resolve: "Anúncios e campanhas" },
  { chave: "diretoria", nome: "Diretoria", resolve: "Regra da casa, preço e exceção" },
];

export const NOME_DA_SALA = Object.fromEntries(SALAS.map((s) => [s.chave, s.nome])) as Record<Sala, string>;

export function lerSala(v: unknown): Sala | null {
  return SALAS.some((s) => s.chave === v) ? (v as Sala) : null;
}

/** As salas de que a pessoa cuida: a geral e as do setor a que ela responde. É onde mensagem nova vira número no menu. */
export function minhasSalas(setores: readonly string[]): Sala[] {
  return SALAS.map((s) => s.chave).filter((s) => s === "geral" || setores.includes(s));
}

// --------------------------------------------------------------- as mensagens

/** A mensagem a que outra responde, em resumo: o que aparece citado em cima da resposta. */
export type Citacao = { id: number; autor: string | null; autorNome: string | null; trecho: string; apagada: boolean; imagens: number };

export type Mensagem = {
  id: number;
  sala: Sala;
  autor: string | null;
  autorNome: string | null;
  autorPapel: string | null;
  /** Vazio quando a mensagem é só imagem, e quando foi apagada. */
  texto: string;
  apagada: boolean;
  respondeA: Citacao | null;
  /** A mensagem pede resposta: é o pedido, com relógio. */
  pede: boolean;
  esperandoDesde: string | null;
  atendidaEm: string | null;
  atendidaPorNome: string | null;
  /** Quantas respostas de OUTRAS pessoas ela tem. É o que libera "guardar na biblioteca". */
  respostas: number;
  /** O id da resposta da biblioteca que nasceu desta mensagem. */
  naBiblioteca: string | null;
  em: string;
  /** Quando mudou pela última vez: é por aqui que a tela sabe o que buscar de novo. */
  mudou: string;
  /** Os ids das imagens. O link de cada uma é pedido à parte, assinado. */
  anexos: string[];
};

export type Pessoa = { id: string; nome: string; papel: string };

/** Até que mensagem a pessoa leu, em cada sala. */
export type Lidas = Partial<Record<Sala, number>>;

/** O que a tela recebe para abrir. `janelas` diz, na sala que tem mais mensagem do que veio, a partir de qual a lista está completa. */
export type Abertura = {
  agora: string;
  setores: Sala[];
  lidas: Lidas;
  pessoas: Pessoa[];
  janelas: Lidas;
  mensagens: Mensagem[];
};

const texto = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);
const inteiro = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
};
const objeto = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);

/** Lê uma mensagem do jeito que a função do banco devolve. `null` quando a forma não bate: mensagem estranha não entra na tela. */
export function lerMensagem(v: unknown): Mensagem | null {
  const l = objeto(v);
  if (!l) return null;
  const sala = lerSala(l.sala);
  const id = inteiro(l.id);
  if (!sala || id <= 0 || typeof l.em !== "string") return null;
  const c = objeto(l.responde_a);
  return {
    id,
    sala,
    autor: texto(l.autor),
    autorNome: texto(l.autor_nome),
    autorPapel: texto(l.autor_papel),
    texto: typeof l.texto === "string" ? l.texto : "",
    apagada: l.apagada === true,
    respondeA: c && inteiro(c.id) > 0
      ? { id: inteiro(c.id), autor: texto(c.autor), autorNome: texto(c.autor_nome), trecho: typeof c.trecho === "string" ? c.trecho : "", apagada: c.apagada === true, imagens: inteiro(c.imagens) }
      : null,
    pede: l.pede === true,
    esperandoDesde: texto(l.esperando_desde),
    atendidaEm: texto(l.atendida_em),
    atendidaPorNome: texto(l.atendida_por_nome),
    respostas: inteiro(l.respostas),
    naBiblioteca: texto(l.na_biblioteca),
    em: l.em,
    mudou: typeof l.mudou === "string" ? l.mudou : l.em,
    anexos: (Array.isArray(l.anexos) ? l.anexos : []).filter((a): a is string => typeof a === "string"),
  };
}

export function lerMensagens(v: unknown): Mensagem[] {
  return (Array.isArray(v) ? v : []).map(lerMensagem).filter((m): m is Mensagem => m !== null);
}

export function lerLidas(v: unknown): Lidas {
  const l = objeto(v);
  const saida: Lidas = {};
  if (!l) return saida;
  for (const s of SALAS) {
    const n = inteiro(l[s.chave]);
    if (n > 0) saida[s.chave] = n;
  }
  return saida;
}

export function lerPessoas(v: unknown): Pessoa[] {
  return (Array.isArray(v) ? v : [])
    .map(objeto)
    .filter((p): p is Record<string, unknown> => p !== null && typeof p.id === "string")
    .map((p) => ({ id: String(p.id), nome: texto(p.nome) ?? "Sem nome", papel: typeof p.papel === "string" ? p.papel : "" }));
}

/** Lê a resposta de `chat_abrir`. `null` quando a função devolveu nada (sem acesso) ou a leitura falhou. */
export function lerAbertura(v: unknown): Abertura | null {
  const l = objeto(v);
  if (!l || typeof l.agora !== "string") return null;
  return {
    agora: l.agora,
    setores: (Array.isArray(l.setores) ? l.setores : []).map(lerSala).filter((s): s is Sala => s !== null),
    lidas: lerLidas(l.lidas),
    pessoas: lerPessoas(l.pessoas),
    janelas: lerLidas(l.janelas),
    mensagens: lerMensagens(l.mensagens),
  };
}

/**
 * Junta o que chegou ao que a tela já tem. A mesma mensagem pode chegar duas
 * vezes (a sincronia pede um pouco para trás, de propósito): fica a versão que
 * mudou por último. A lista sai em ordem de número, que é a ordem de envio.
 */
export function juntarMensagens(atuais: readonly Mensagem[], novas: readonly Mensagem[]): Mensagem[] {
  if (novas.length === 0) return atuais as Mensagem[];
  const porId = new Map(atuais.map((m) => [m.id, m]));
  let mudou = false;
  for (const n of novas) {
    const antes = porId.get(n.id);
    if (!antes || Date.parse(n.mudou) >= Date.parse(antes.mudou)) {
      porId.set(n.id, n);
      mudou = true;
    }
  }
  return mudou ? [...porId.values()].sort((a, b) => a.id - b.id) : (atuais as Mensagem[]);
}

/** Quanto a sincronia volta no tempo a cada pedido, em milissegundos. */
export const FOLGA_DA_SINCRONIA_MS = 5_000;

/**
 * De que instante pedir as mudanças. É a mudança mais recente que a tela já
 * viu, menos uma folga: duas gravações quase juntas podem terminar fora de
 * ordem, e pedir "depois da última" perderia a que terminou atrasada.
 */
export function desdeQuandoSincronizar(mensagens: readonly Mensagem[], abertaEm: string): string {
  let ultima = Date.parse(abertaEm);
  for (const m of mensagens) {
    const t = Date.parse(m.mudou);
    if (Number.isFinite(t) && t > ultima) ultima = t;
  }
  return new Date((Number.isFinite(ultima) ? ultima : Date.now()) - FOLGA_DA_SINCRONIA_MS).toISOString();
}

/** As mensagens de uma sala que entram na conversa: a partir da janela, quando a sala tem mais do que veio. */
export function daSala(mensagens: readonly Mensagem[], sala: Sala, janela?: number): Mensagem[] {
  return mensagens.filter((m) => m.sala === sala && (janela === undefined || m.id >= janela));
}

// ------------------------------------------------------------- o que não li

/** Mensagem mais velha do que isto não conta como "não lida": quem volta de férias não precisa de 300 no menu. É a mesma conta do banco. */
export const DIAS_DE_NAO_LIDA = 7;

const ehNova = (m: Mensagem, lida: number, meuId: string, agora: number): boolean =>
  m.id > lida && !m.apagada && m.autor !== meuId && agora - Date.parse(m.em) < DIAS_DE_NAO_LIDA * 86_400_000;

/** Quantas mensagens a pessoa ainda não leu em cada sala. As dela mesma não contam. */
export function naoLidasPorSala(mensagens: readonly Mensagem[], lidas: Lidas, meuId: string, agora: number): Record<Sala, number> {
  const saida = Object.fromEntries(SALAS.map((s) => [s.chave, 0])) as Record<Sala, number>;
  for (const m of mensagens) if (ehNova(m, lidas[m.sala] ?? 0, meuId, agora)) saida[m.sala] += 1;
  return saida;
}

/** A primeira mensagem não lida de uma sala: é onde entra a linha "Novas mensagens". `null` quando está tudo lido. */
export function primeiraNaoLida(daSalaAberta: readonly Mensagem[], lida: number, meuId: string, agora: number): number | null {
  return daSalaAberta.find((m) => ehNova(m, lida, meuId, agora))?.id ?? null;
}

// ----------------------------------------------------------------- o pedido

/**
 * Quanto um pedido pode esperar antes de mudar de cor, em minutos.
 *
 * SÃO PREMISSAS DE PARTIDA, e a tela diz isso por extenso. De onde saíram: no
 * grupo do time a dúvida comum era respondida em 2 minutos (mediana) e a pior
 * esperou 51; meia hora parada já é fora do costume, e duas horas é venda
 * esfriando. O relógio é corrido: conta a noite e o fim de semana. Trocar
 * quando a JK disser o prazo de resposta que quer.
 */
export const LIMITES_DO_PEDIDO = { atencao: 30, atraso: 120 };

/** "agora", "12 min", "3 h", "2 dias": curto, para caber no selo. */
export function duracaoEmPalavra(minutos: number): string {
  const m = Math.max(0, Math.floor(minutos));
  if (m < 1) return "agora";
  if (m < 60) return `${m} min`;
  if (m < 48 * 60) return `${Math.floor(m / 60)} h`;
  return `${Math.floor(m / 1440)} dias`;
}

/** O pedido ainda espera: pede resposta, ninguém atendeu e não foi apagado. */
export function estaEsperando(m: Pick<Mensagem, "pede" | "atendidaEm" | "apagada">): boolean {
  return m.pede && !m.atendidaEm && !m.apagada;
}

export type Espera = { tom: Tom; palavra: string; minutos: number };

/**
 * A cor e a palavra do pedido. `null` para mensagem que não pede resposta.
 * Atendido é verde; esperando fica sem cor, depois âmbar, depois vermelho.
 *
 * O pedido é atendido de dois jeitos, e a palavra diz qual: alguém respondeu
 * a ele ("Respondido por"), ou alguém marcou como resolvido sem responder
 * ("Resolvido por"), que é o caso da resposta que veio numa mensagem solta.
 */
export function esperaDoPedido(
  m: Pick<Mensagem, "pede" | "atendidaEm" | "atendidaPorNome" | "esperandoDesde" | "apagada" | "em"> & { respostas?: number },
  agora: number,
): Espera | null {
  if (!m.pede || m.apagada) return null;
  if (m.atendidaEm) {
    const verbo = (m.respostas ?? 0) > 0 ? "Respondido" : "Resolvido";
    return { tom: "bom", palavra: m.atendidaPorNome ? `${verbo} por ${m.atendidaPorNome}` : verbo, minutos: 0 };
  }
  const desde = Date.parse(m.esperandoDesde ?? m.em);
  const minutos = Number.isFinite(desde) ? Math.max(0, Math.floor((agora - desde) / 60_000)) : 0;
  const ha = duracaoEmPalavra(minutos);
  if (minutos >= LIMITES_DO_PEDIDO.atraso) return { tom: "ruim", palavra: `${ha} sem resposta`, minutos };
  if (minutos >= LIMITES_DO_PEDIDO.atencao) return { tom: "atencao", palavra: `Parado há ${ha}`, minutos };
  return { tom: "neutro", palavra: minutos < 1 ? "Esperando resposta" : `Esperando há ${ha}`, minutos };
}

/** Os pedidos que ainda esperam, do que espera há mais tempo para o mais novo. Com `sala`, só os dela. */
export function pedidosEsperando(mensagens: readonly Mensagem[], sala?: Sala): Mensagem[] {
  return mensagens
    .filter((m) => estaEsperando(m) && (sala === undefined || m.sala === sala))
    .sort((a, b) => Date.parse(a.esperandoDesde ?? a.em) - Date.parse(b.esperandoDesde ?? b.em));
}

/** A frase que explica as cores na tela, montada dos próprios limites para nunca discordar deles. */
export function limitesPorExtenso(): string {
  return `Pedido parado fica âmbar depois de ${duracaoEmPalavra(LIMITES_DO_PEDIDO.atencao)} e vermelho depois de ${duracaoEmPalavra(LIMITES_DO_PEDIDO.atraso)}, no relógio corrido. É uma premissa de partida: a JK ainda não disse o prazo de resposta que quer.`;
}

// ------------------------------------------------------------ o menu e o início

export type ResumoDoChat = {
  /** Mensagens que a pessoa não leu nas salas dela e em resposta a ela. */
  novas: number;
  /** Pedidos que esperam o setor dela e que ela já leu. Os não lidos estão em `novas`. */
  pedidos: number;
  /** Todos os pedidos que esperam o setor dela. */
  pedidosDoSetor: number;
  /** Desde quando espera o mais antigo deles. */
  desde: string | null;
};

export const SEM_RESUMO: ResumoDoChat = { novas: 0, pedidos: 0, pedidosDoSetor: 0, desde: null };

export function lerResumo(v: unknown): ResumoDoChat {
  const l = objeto(v);
  if (!l) return SEM_RESUMO;
  return { novas: Math.max(0, inteiro(l.novas)), pedidos: Math.max(0, inteiro(l.pedidos)), pedidosDoSetor: Math.max(0, inteiro(l.pedidos_do_setor)), desde: texto(l.desde) };
}

/** O que espera a pessoa no chat: o que ela não leu mais o pedido que ela leu e o setor dela ainda não respondeu. */
export function esperandoPorMim(r: Pick<ResumoDoChat, "novas" | "pedidos">): number {
  return Math.max(0, r.novas) + Math.max(0, r.pedidos);
}

/** O endereço da tela do chat: é a chave do número no menu. */
export const ENDERECO_DO_CHAT = "/admin/chat";

/** O número que vai no menu, pelo endereço da tela. */
export function avisosDoMenu(r: Pick<ResumoDoChat, "novas" | "pedidos">): Record<string, number> {
  return { [ENDERECO_DO_CHAT]: esperandoPorMim(r) };
}

/** O título da aba com o número na frente, para a pessoa ver de outra aba que chegou mensagem. Tira o número antigo antes de pôr o novo. */
export function tituloComAviso(titulo: string, n: number): string {
  const limpo = titulo.replace(/^\(\d+\+?\)\s+/, "");
  if (n <= 0) return limpo;
  return `(${n > 99 ? "99+" : n}) ${limpo}`;
}

// --------------------------------------------------------- quem está online

/**
 * `online`: a pessoa está com o painel aberto e à vista. `ausente`: o painel
 * está aberto, em outra aba ou atrás de outra janela. Quem não aparece no canal
 * está fora.
 */
export type Presenca = "online" | "ausente";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Lê o estado do canal de presença: uma lista de registros por chave, um por
 * aba ou aparelho aberto. Cada registro traz só o id da pessoa e se a aba está
 * à vista. O NOME não vem do canal: vem da lista de pessoas que o banco
 * entrega, para ninguém aparecer com o nome que quiser.
 */
export function lerPresenca(bruto: unknown): Map<string, Presenca> {
  const saida = new Map<string, Presenca>();
  const estado = objeto(bruto);
  if (!estado) return saida;
  for (const lista of Object.values(estado)) {
    if (!Array.isArray(lista)) continue;
    for (const registro of lista) {
      const r = objeto(registro);
      if (!r || typeof r.id !== "string" || !UUID.test(r.id)) continue;
      const id = r.id.toLowerCase();
      // Basta uma aba à vista para a pessoa estar online.
      if (r.v === true) saida.set(id, "online");
      else if (!saida.has(id)) saida.set(id, "ausente");
    }
  }
  return saida;
}

const ORDEM_DA_PRESENCA = { online: 0, ausente: 1, fora: 2 } as const;

/** As pessoas do time com a presença de cada uma: online primeiro, depois ausente, depois quem está fora, em ordem de nome. */
export function pessoasComPresenca(pessoas: readonly Pessoa[], presenca: ReadonlyMap<string, Presenca>): (Pessoa & { presenca: Presenca | "fora" })[] {
  return pessoas
    .map((p) => ({ ...p, presenca: presenca.get(p.id.toLowerCase()) ?? ("fora" as const) }))
    .sort((a, b) => ORDEM_DA_PRESENCA[a.presenca] - ORDEM_DA_PRESENCA[b.presenca] || a.nome.localeCompare(b.nome, "pt-BR"));
}

/** As duas primeiras letras do nome, para a bolinha de quem fala. */
export function iniciais(nome: string | null): string {
  const partes = (nome ?? "").split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  return (partes.length === 1 ? partes[0].slice(0, 2) : partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

// ---------------------------------------------------------- a conversa na tela

const FUSO = "America/Sao_Paulo";

/** O dia de São Paulo de um instante, como "2026-11-14". O fuso fixo faz servidor e navegador escreverem a mesma coisa. */
export function diaDe(iso: string | number): string {
  const t = typeof iso === "number" ? iso : Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(t));
}

/** "14:05", no relógio de São Paulo. */
export function horaCurta(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" }).format(new Date(t));
}

/** "Hoje", "Ontem" ou "qui., 12/11": o nome do dia na linha que separa a conversa. */
export function rotuloDoDia(dia: string, agora: number): string {
  if (dia === diaDe(agora)) return "Hoje";
  if (dia === diaDe(agora - 86_400_000)) return "Ontem";
  const t = Date.parse(`${dia}T12:00:00Z`);
  if (!Number.isFinite(t)) return dia;
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "short", day: "2-digit", month: "2-digit" }).format(new Date(t));
}

export type Linha =
  | { tipo: "dia"; chave: string; dia: string }
  | { tipo: "novas"; chave: string }
  | { tipo: "fala"; chave: string; m: Mensagem; /** Mostra o nome e a hora: é a primeira de uma sequência da mesma pessoa. */ cabeca: boolean };

/** Mensagens seguidas da mesma pessoa se juntam enquanto o intervalo entre elas for menor do que isto. */
const JUNTAR_ATE_MS = 5 * 60_000;

/**
 * A conversa em linhas: o separador de cada dia, a linha "Novas mensagens" e
 * as falas. Mensagens seguidas da mesma pessoa, em poucos minutos, formam um
 * bloco só (o nome aparece uma vez), como em qualquer conversa.
 */
export function montarLinhas(daSalaAberta: readonly Mensagem[], primeiraNova: number | null): Linha[] {
  const linhas: Linha[] = [];
  let antes: Mensagem | null = null;
  let diaAntes = "";
  for (const m of daSalaAberta) {
    const dia = diaDe(m.em);
    let quebra = false;
    if (dia !== diaAntes) {
      linhas.push({ tipo: "dia", chave: `dia-${dia}`, dia });
      diaAntes = dia;
      quebra = true;
    }
    if (primeiraNova !== null && m.id === primeiraNova) {
      linhas.push({ tipo: "novas", chave: "novas" });
      quebra = true;
    }
    const cabeca = quebra || !antes || antes.autor !== m.autor || Date.parse(m.em) - Date.parse(antes.em) > JUNTAR_ATE_MS;
    linhas.push({ tipo: "fala", chave: `m-${m.id}`, m, cabeca });
    antes = m;
  }
  return linhas;
}

export type Parte = { tipo: "texto" | "link"; valor: string };

/**
 * Separa os endereços do resto do texto, para o link da peça sair clicável. Só
 * `http` e `https`. A pontuação grudada no fim ("veja em https://x.com/y.")
 * fica fora do link.
 */
export function partesDoTexto(escrito: string): Parte[] {
  const partes: Parte[] = [];
  const padrao = /https?:\/\/[^\s<>"']+/g;
  let ultimo = 0;
  for (const achado of escrito.matchAll(padrao)) {
    const inicio = achado.index ?? 0;
    const link = achado[0].replace(/[.,;:!?)\]]+$/, "");
    if (inicio > ultimo) partes.push({ tipo: "texto", valor: escrito.slice(ultimo, inicio) });
    partes.push({ tipo: "link", valor: link });
    ultimo = inicio + link.length;
  }
  if (ultimo < escrito.length) partes.push({ tipo: "texto", valor: escrito.slice(ultimo) });
  return partes;
}

/** O que aparece de uma mensagem numa linha só: o começo do texto, ou "Imagem" quando ela é só imagem. */
export function trechoDe(m: { texto?: string; trecho?: string; apagada: boolean; imagens?: number; anexos?: readonly string[] }, teto = 90): string {
  if (m.apagada) return "Mensagem apagada";
  const escrito = (m.texto ?? m.trecho ?? "").replace(/\s+/g, " ").trim();
  if (escrito) return escrito.length > teto ? `${escrito.slice(0, teto - 1).trimEnd()}…` : escrito;
  const imagens = m.imagens ?? m.anexos?.length ?? 0;
  return imagens > 1 ? `${imagens} imagens` : imagens === 1 ? "Imagem" : "";
}

// ------------------------------------------------------------ os textos

/** O começo da pergunta que nasce na consulta, com a peça já citada. A pessoa completa. */
export function textoSobreProduto(p: { nome: string; codigo?: string | null; url?: string | null }): string {
  const linhas = [`Sobre a peça: ${p.nome}${p.codigo ? ` (cód. ${p.codigo})` : ""}`];
  if (p.url) linhas.push(p.url);
  linhas.push("", "Loja, numeração e para quando: ");
  return linhas.join("\n");
}

/**
 * O rascunho da resposta da biblioteca que nasce de uma conversa: a pergunta é
 * a mensagem, e a explicação junta o que OUTRAS pessoas responderam a ela, em
 * ordem. É rascunho: a pessoa enxuga o texto e tira dado de cliente antes de
 * salvar.
 */
export function rascunhoDaResposta(pergunta: Pick<Mensagem, "id" | "texto" | "autor">, mensagens: readonly Mensagem[]): { pergunta: string; explicacao: string } {
  const explicacao = mensagens
    .filter((m) => m.respondeA?.id === pergunta.id && !m.apagada && m.autor !== pergunta.autor && m.texto.trim() !== "")
    .map((m) => m.texto.trim())
    .join("\n")
    .slice(0, 4000);
  return { pergunta: pergunta.texto.replace(/\s+/g, " ").trim().slice(0, 300), explicacao };
}

/** Onde o rascunho que vem de outra tela (o tutor) fica guardado até o chat abrir. Não vai no endereço: endereço fica em histórico. */
export const CHAVE_DO_RASCUNHO = "jk:chat:rascunho";

// ----------------------------------------------------------------- a imagem

/** Só imagem, até 5 MB, no máximo 6 por vez. É o mesmo limite do bucket e da função do banco (0079). */
export const TIPOS_DE_IMAGEM = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const LIMITE_DA_IMAGEM = 5 * 1024 * 1024;
export const MAXIMO_DE_IMAGENS = 6;

/** A mensagem para a pessoa quando a imagem não serve, ou null quando serve. */
export function conferirImagem(a: { tipo: string; tamanho: number }): string | null {
  if (!TIPOS_DE_IMAGEM.includes(a.tipo)) return "Só imagem: JPG, PNG, WebP ou GIF.";
  if (a.tamanho > LIMITE_DA_IMAGEM) return "A imagem passa de 5 MB.";
  if (a.tamanho <= 0) return "A imagem veio vazia.";
  return null;
}

const EXTENSAO: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };

/**
 * O caminho da imagem no armazenamento: a pasta é o id de quem envia (é o que
 * a policy do bucket confere) e o nome é sorteado. O nome que a pessoa deu ao
 * arquivo não entra no caminho: print costuma se chamar pelo nome do cliente.
 */
export function caminhoDaImagem(quem: string, sorteio: string, tipo: string): string {
  return `${quem}/${sorteio.replace(/[^a-zA-Z0-9-]/g, "")}.${EXTENSAO[tipo] ?? "img"}`;
}
