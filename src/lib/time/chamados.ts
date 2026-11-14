import type { Tom } from "@/lib/painel/tons";

/**
 * Chamados entre setores: pedir uma coisa a outro setor, com dono e relógio.
 *
 * Arquivo PURO (sem banco, sem `server-only`): serve à tela, ao servidor e ao
 * teste (`npm run verificar:biblioteca`). A leitura e a escrita ficam em
 * `dados.ts`.
 *
 * OS TRÊS ESTADOS, do ponto de vista de quem espera:
 *   aberto      o destino ainda não respondeu. É o único estado com relógio.
 *   respondido  alguém respondeu, e quem abriu diz se resolveu.
 *   resolvido   acabou.
 */

export type TipoDeChamado = "duvida" | "orcamento" | "estoque_prazo" | "outro";

export const TIPOS: { chave: TipoDeChamado; nome: string; curto: string }[] = [
  { chave: "duvida", nome: "Dúvida", curto: "Dúvida" },
  { chave: "orcamento", nome: "Orçamento de peça personalizada", curto: "Orçamento" },
  { chave: "estoque_prazo", nome: "Estoque ou prazo", curto: "Estoque ou prazo" },
  { chave: "outro", nome: "Outro", curto: "Outro" },
];

export const NOME_DO_TIPO = Object.fromEntries(TIPOS.map((t) => [t.chave, t.curto])) as Record<TipoDeChamado, string>;

export function lerTipo(v: unknown): TipoDeChamado | null {
  return TIPOS.some((t) => t.chave === v) ? (v as TipoDeChamado) : null;
}

export type SetorDoChamado = "vendas" | "fabrica" | "loja" | "trafego" | "diretoria";

/** Os setores que recebem chamado. A linha de apoio diz o que cada um costuma resolver. */
export const SETORES_DO_CHAMADO: { chave: SetorDoChamado; nome: string; resolve: string }[] = [
  { chave: "vendas", nome: "Vendas", resolve: "Atendimento e clientes" },
  { chave: "fabrica", nome: "Fábrica", resolve: "Produção, prazo e malote" },
  { chave: "loja", nome: "Loja", resolve: "Lojas físicas e loja online" },
  { chave: "trafego", nome: "Tráfego", resolve: "Anúncios e campanhas" },
  { chave: "diretoria", nome: "Diretoria", resolve: "Regra da casa, preço e exceção" },
];

export const NOME_DO_SETOR = Object.fromEntries(SETORES_DO_CHAMADO.map((s) => [s.chave, s.nome])) as Record<SetorDoChamado, string>;

export function lerSetor(v: unknown): SetorDoChamado | null {
  return SETORES_DO_CHAMADO.some((s) => s.chave === v) ? (v as SetorDoChamado) : null;
}

export type EstadoDoChamado = "aberto" | "respondido" | "resolvido";

export function lerEstadoDoChamado(v: unknown): EstadoDoChamado | null {
  return v === "aberto" || v === "respondido" || v === "resolvido" ? v : null;
}

export type Chamado = {
  id: string;
  /** O número que as pessoas falam: "o chamado 12". */
  numero: number;
  tipo: TipoDeChamado;
  texto: string;
  paraSetor: SetorDoChamado | null;
  paraPessoa: string | null;
  paraPessoaNome: string | null;
  abertoPor: string | null;
  abertoPorNome: string | null;
  estado: EstadoDoChamado;
  precisoAte: string | null;
  /** O nome da peça de que o chamado fala, quando nasceu na consulta. */
  produto: string | null;
  /** Desde quando espera resposta. Recomeça quando quem abriu pergunta de novo. */
  aguardandoDesde: string;
  criadoEm: string;
  atualizadoEm: string;
  mensagens: number;
  anexos: number;
  ultima: { autor: string | null; texto: string; em: string } | null;
  naBiblioteca: boolean;
};

export type Imagem = { id: string; nome: string | null; link: string | null };

export type Mensagem = {
  id: number;
  autor: string | null;
  autorNome: string | null;
  autorPapel: string | null;
  texto: string;
  em: string;
  imagens: Imagem[];
};

/** O chamado aberto na tela: o pedido, a conversa em ordem e as imagens com link assinado. */
export type ChamadoInteiro = Omit<Chamado, "mensagens" | "anexos" | "ultima" | "naBiblioteca" | "produto" | "atualizadoEm"> & {
  abertoPorPapel: string | null;
  produto: { id: string; nome: string; url: string | null; codigo: string | null } | null;
  resolvidoEm: string | null;
  resolvidoPorNome: string | null;
  podeResolver: boolean;
  respostaDaBiblioteca: string | null;
  imagens: Imagem[];
  mensagens: Mensagem[];
};

// ------------------------------------------------------------------ a espera

/**
 * Quanto um chamado ABERTO pode esperar antes de mudar de cor, em minutos.
 *
 * SÃO PREMISSAS DE PARTIDA. A JK ainda não disse o prazo de resposta que quer,
 * e a tela avisa isso por extenso. De onde saíram: no grupo do time, a dúvida
 * comum era respondida em 2 minutos (mediana) e a pior esperou 51; meia hora
 * parada já é fora do costume, e duas horas é venda esfriando. Orçamento
 * depende de conta e de outra pessoa, então ganha uma tarde antes do âmbar; o
 * caso que originou a tela ficou 26 horas sem valor, e com um dia já é vermelho.
 * O relógio é corrido: conta a noite e o fim de semana.
 */
export const LIMITES_DA_ESPERA: Record<TipoDeChamado, { atencao: number; atraso: number }> = {
  duvida: { atencao: 30, atraso: 120 },
  estoque_prazo: { atencao: 30, atraso: 120 },
  orcamento: { atencao: 240, atraso: 1440 },
  outro: { atencao: 240, atraso: 1440 },
};

/** Com "preciso até", o chamado fica âmbar quando falta este tanto para o prazo pedido. Também é premissa. */
export const AVISO_ANTES_DO_PRAZO = 60;

/** "agora", "12 min", "3 h", "2 dias": curto, para caber no selo. */
export function duracaoEmPalavra(minutos: number): string {
  const m = Math.max(0, Math.floor(minutos));
  if (m < 1) return "agora";
  if (m < 60) return `${m} min`;
  if (m < 48 * 60) return `${Math.floor(m / 60)} h`;
  return `${Math.floor(m / 1440)} dias`;
}

const minutosEntre = (de: string, ate: number): number => {
  const t = Date.parse(de);
  return Number.isFinite(t) ? Math.max(0, Math.floor((ate - t) / 60_000)) : 0;
};

const PIOR: Record<Tom, number> = { neutro: 0, bom: 0, atencao: 1, ruim: 2 };

/**
 * A cor e a palavra da espera. Só chamado ABERTO tem relógio: respondido é
 * verde (alguém atendeu) e resolvido não tem cor.
 *
 * Vale o pior entre o tempo parado e o prazo pedido: chamado aberto há cinco
 * minutos com "preciso até" vencido já está vermelho.
 */
export function esperaDoChamado(
  c: Pick<Chamado, "estado" | "tipo" | "aguardandoDesde" | "precisoAte">,
  agora: number,
): { tom: Tom; palavra: string; minutos: number } {
  if (c.estado === "resolvido") return { tom: "neutro", palavra: "Resolvido", minutos: 0 };
  if (c.estado === "respondido") return { tom: "bom", palavra: "Respondido", minutos: 0 };

  const minutos = minutosEntre(c.aguardandoDesde, agora);
  const limite = LIMITES_DA_ESPERA[c.tipo];
  const ha = duracaoEmPalavra(minutos);
  let tom: Tom = "neutro";
  let palavra = minutos < 1 ? "Aberto agora" : `Aberto há ${ha}`;
  if (minutos >= limite.atraso) {
    tom = "ruim";
    palavra = `Atrasado, ${ha} sem resposta`;
  } else if (minutos >= limite.atencao) {
    tom = "atencao";
    palavra = `Parado há ${ha}`;
  }

  const prazo = c.precisoAte ? Date.parse(c.precisoAte) : NaN;
  if (Number.isFinite(prazo)) {
    const falta = Math.floor((prazo - agora) / 60_000);
    if (falta < 0 && PIOR[tom] < PIOR.ruim) {
      tom = "ruim";
      palavra = `Passou do prazo há ${duracaoEmPalavra(-falta)}`;
    } else if (falta >= 0 && falta <= AVISO_ANTES_DO_PRAZO && PIOR[tom] < PIOR.atencao) {
      tom = "atencao";
      palavra = falta < 1 ? "O prazo vence agora" : `Faltam ${duracaoEmPalavra(falta)} para o prazo`;
    }
  }
  return { tom, palavra, minutos };
}

/**
 * A pior espera de uma lista de chamados: a cor mais grave e, no empate, a mais
 * longa. É o que pinta o aviso "3 chamados esperam a sua resposta". `null`
 * quando a lista não tem nenhum chamado aberto.
 */
export function piorEspera(
  lista: readonly Pick<Chamado, "estado" | "tipo" | "aguardandoDesde" | "precisoAte">[],
  agora: number,
): { tom: Tom; palavra: string; minutos: number } | null {
  const esperas = lista.filter((c) => c.estado === "aberto").map((c) => esperaDoChamado(c, agora));
  return esperas.sort((a, b) => PIOR[b.tom] - PIOR[a.tom] || b.minutos - a.minutos)[0] ?? null;
}

/** A frase que explica as cores na tela, montada dos próprios limites para nunca discordar deles. */
export function limitesPorExtenso(): string {
  const de = (t: TipoDeChamado) => `âmbar depois de ${duracaoEmPalavra(LIMITES_DA_ESPERA[t].atencao)} e vermelho depois de ${duracaoEmPalavra(LIMITES_DA_ESPERA[t].atraso)}`;
  return `Dúvida e estoque ou prazo: ${de("duvida")}. Orçamento e outros: ${de("orcamento")}. Com "preciso até", fica âmbar quando falta ${duracaoEmPalavra(AVISO_ANTES_DO_PRAZO)} e vermelho quando o prazo passa.`;
}

// ------------------------------------------------------------- quem e para quem

export type Eu = { id: string; setores: readonly string[] };

/** Para quem o chamado vai, em palavra: o setor ou o nome da pessoa. */
export function paraQuem(c: Pick<Chamado, "paraSetor" | "paraPessoaNome" | "paraPessoa">): string {
  if (c.paraSetor) return NOME_DO_SETOR[c.paraSetor];
  return c.paraPessoaNome ?? (c.paraPessoa ? "Uma pessoa" : "Sem destino");
}

/** O chamado é para mim: veio no meu nome ou para um setor a que eu respondo. */
export function ehParaMim(c: Pick<Chamado, "paraSetor" | "paraPessoa">, eu: Eu): boolean {
  return c.paraPessoa === eu.id || (c.paraSetor !== null && eu.setores.includes(c.paraSetor));
}

/** Quem marca como resolvido: quem abriu, quem recebeu e a diretoria. É a regra do banco (0072). */
export function podeResolver(c: Pick<Chamado, "paraSetor" | "paraPessoa" | "abertoPor">, eu: Eu, admin: boolean): boolean {
  return admin || c.abertoPor === eu.id || ehParaMim(c, eu);
}

/**
 * O que espera por mim, para o aviso do menu e da Visão geral: os abertos que
 * vieram para mim (fora os que eu mesmo abri) e os meus que já têm resposta.
 */
export function oQueEsperaPorMim(lista: readonly Chamado[], eu: Eu): { paraResponder: Chamado[]; respondidos: Chamado[] } {
  return {
    paraResponder: lista.filter((c) => c.estado === "aberto" && c.abertoPor !== eu.id && ehParaMim(c, eu)),
    respondidos: lista.filter((c) => c.estado === "respondido" && c.abertoPor === eu.id),
  };
}

/**
 * O número que vai no menu, pelo endereço da tela. É o que espera a PESSOA: os
 * chamados abertos para ela (no nome ou no setor) e as respostas que chegaram
 * para os chamados que ela abriu. Resposta que chega sem aviso obrigaria quem
 * perguntou a ficar olhando a lista, que é o que o grupo de conversa já fazia.
 */
export function avisosDoMenu(a: { paraResponder: number; respondidos: number }): Record<string, number> {
  return { "/admin/chamados": Math.max(0, a.paraResponder) + Math.max(0, a.respondidos) };
}

// ---------------------------------------------------------------- a lista

export type FiltroDeChamados = {
  quem: "todos" | "para_mim" | "meus";
  tipo: TipoDeChamado | "todos";
  /** Falso: só o que está em andamento. Verdadeiro: só os resolvidos. */
  resolvidos: boolean;
};

export const SEM_FILTRO: FiltroDeChamados = { quem: "todos", tipo: "todos", resolvidos: false };

export function filtrarChamados(lista: readonly Chamado[], filtro: FiltroDeChamados, eu: Eu): Chamado[] {
  return lista.filter((c) => {
    if ((c.estado === "resolvido") !== filtro.resolvidos) return false;
    if (filtro.tipo !== "todos" && c.tipo !== filtro.tipo) return false;
    if (filtro.quem === "para_mim" && !ehParaMim(c, eu)) return false;
    if (filtro.quem === "meus" && c.abertoPor !== eu.id) return false;
    return true;
  });
}

const ORDEM_DO_ESTADO: Record<EstadoDoChamado, number> = { aberto: 0, respondido: 1, resolvido: 2 };

/**
 * A ordem da lista: primeiro o que está aberto, do mais grave para o menos e,
 * dentro da mesma cor, o que espera há mais tempo. Depois os respondidos e os
 * resolvidos, do mais recente para o mais antigo.
 */
export function ordenarChamados(lista: readonly Chamado[], agora: number): Chamado[] {
  const peso = new Map(lista.map((c) => [c.id, esperaDoChamado(c, agora)]));
  return [...lista].sort((a, b) => {
    const estado = ORDEM_DO_ESTADO[a.estado] - ORDEM_DO_ESTADO[b.estado];
    if (estado !== 0) return estado;
    if (a.estado === "aberto") {
      const ea = peso.get(a.id)!;
      const eb = peso.get(b.id)!;
      return PIOR[eb.tom] - PIOR[ea.tom] || eb.minutos - ea.minutos;
    }
    return Date.parse(b.atualizadoEm) - Date.parse(a.atualizadoEm);
  });
}

// ------------------------------------------------------------ os textos

/** O começo do chamado que nasce na consulta, com a peça já citada. A pessoa completa a pergunta. */
export function textoSobreProduto(p: { nome: string; codigo?: string | null; url?: string | null }): string {
  const linhas = [`Sobre a peça: ${p.nome}${p.codigo ? ` (cód. ${p.codigo})` : ""}`];
  if (p.url) linhas.push(p.url);
  linhas.push("", "Loja, numeração e para quando: ");
  return linhas.join("\n");
}

/**
 * O rascunho da resposta da biblioteca que nasce de um chamado: a pergunta é o
 * pedido, e a explicação junta o que foi respondido por OUTRAS pessoas, em
 * ordem. É rascunho: a pessoa enxuga o texto e tira dado de cliente antes de
 * salvar.
 */
export function rascunhoDaResposta(c: Pick<ChamadoInteiro, "texto" | "abertoPor" | "mensagens">): { pergunta: string; explicacao: string } {
  const pergunta = c.texto.replace(/\s+/g, " ").trim().slice(0, 300);
  const explicacao = c.mensagens
    .filter((m) => m.autor !== c.abertoPor && m.texto.trim() !== "")
    .map((m) => m.texto.trim())
    .join("\n")
    .slice(0, 4000);
  return { pergunta, explicacao };
}

/**
 * "Preciso até" chega do campo de data e hora sem fuso ("2026-11-14T18:00").
 * Quem digita está no Brasil, e o servidor roda em UTC: sem fixar o fuso aqui,
 * 18h viraria 15h. O Brasil não tem horário de verão desde 2019.
 */
export function lerPrecisoAte(valor: string | null | undefined): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2})?$/.exec((valor ?? "").trim());
  if (!m) return null;
  const iso = `${m[1]}T${m[2]}:00-03:00`;
  return Number.isFinite(Date.parse(iso)) ? iso : null;
}

// ----------------------------------------------------------------- o print

/** Só imagem, até 5 MB, no máximo 6 por vez. É o mesmo limite do bucket e da função do banco (0072). */
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
 * O caminho do print no armazenamento: a pasta é o id de quem envia (é o que a
 * policy do bucket confere) e o nome é sorteado. O nome que a pessoa deu ao
 * arquivo não entra no caminho: print costuma se chamar pelo nome do cliente.
 */
export function caminhoDaImagem(quem: string, sorteio: string, tipo: string): string {
  return `${quem}/${sorteio.replace(/[^a-zA-Z0-9-]/g, "")}.${EXTENSAO[tipo] ?? "img"}`;
}
