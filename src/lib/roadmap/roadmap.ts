/**
 * O Roadmap do painel: o quadro de trabalho de quem mexe no código.
 *
 * Nasceu de um pedido do Filipe em 18/11/2026: ele e o Erick mexem no painel,
 * cada um com o próprio Claude, e um atrapalhava o outro. O quadro diz o que
 * está para fazer, o que está sendo feito, por quem, em qual ramo do git e
 * ONDE no código. Quem pega um cartão declara os caminhos que vai mexer, e o
 * quadro avisa quando outro cartão em trabalho já declarou um caminho que se
 * sobrepõe.
 *
 * As regras moram no banco (0141): quem pode, o cruzamento de caminhos
 * (`roadmap_cruzam`) e a sugestão que anda junto com o cartão. Este arquivo lê
 * o que o banco devolve e dá nome às coisas. Arquivo puro, para o teste rodar
 * sem rede nem banco (`npm run verificar:roadmap`).
 */

export const ENDERECO_DO_ROADMAP = "/admin/roadmap";

export const COLUNAS = ["ideias", "a_fazer", "fazendo", "em_revisao", "no_ar", "descartado"] as const;
export type Coluna = (typeof COLUNAS)[number];

/** As cinco colunas do quadro. Descartado fica num canto à parte. */
export const COLUNAS_DO_QUADRO: readonly Coluna[] = ["ideias", "a_fazer", "fazendo", "em_revisao", "no_ar"];
/** Em trabalho: é aqui que o cruzamento de caminhos vale. */
export const EM_TRABALHO: readonly Coluna[] = ["fazendo", "em_revisao"];

export const NOME_DA_COLUNA: Record<Coluna, string> = {
  ideias: "Ideias",
  a_fazer: "A fazer",
  fazendo: "Fazendo",
  em_revisao: "Em revisão",
  no_ar: "No ar",
  descartado: "Descartados",
};

export const FRASE_DA_COLUNA: Record<Coluna, string> = {
  ideias: "O que vale pensar, sem compromisso.",
  a_fazer: "Decidido, esperando alguém pegar.",
  fazendo: "Alguém está mexendo agora.",
  em_revisao: "Pedido de revisão aberto, esperando juntar.",
  no_ar: "Juntado ao principal e publicado, nos últimos 60 dias.",
  descartado: "Não vai entrar, com o motivo.",
};

export const TIPOS = ["correcao", "melhoria", "atualizacao", "seguranca"] as const;
export type Tipo = (typeof TIPOS)[number];
export const NOME_DO_TIPO: Record<Tipo, string> = {
  correcao: "Correção",
  melhoria: "Melhoria",
  atualizacao: "Atualização",
  seguranca: "Segurança",
};

export const PRIORIDADES = ["urgente", "alta", "media", "baixa"] as const;
export type Prioridade = (typeof PRIORIDADES)[number];
export const NOME_DA_PRIORIDADE: Record<Prioridade, string> = {
  urgente: "Urgente",
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

export const ehColuna = (v: unknown): v is Coluna => typeof v === "string" && (COLUNAS as readonly string[]).includes(v);
export const ehTipo = (v: unknown): v is Tipo => typeof v === "string" && (TIPOS as readonly string[]).includes(v);
export const ehPrioridade = (v: unknown): v is Prioridade => typeof v === "string" && (PRIORIDADES as readonly string[]).includes(v);

/** Teto de caminhos por cartão e de cartões por lote: os mesmos números do banco. */
export const MAXIMO_DE_CAMINHOS = 30;
export const MAXIMO_DO_LOTE = 100;
export const TETO_DO_TITULO = 160;
export const TETO_DA_DESCRICAO = 8000;
export const TETO_DA_NOTA = 2000;

/** `comum`: os dois lados são "arquivo de todos" (CLAUDE.md, package.json...), que o git costuma juntar sozinho. */
export type Cruzamento = { meu: string; dele: string; comum: boolean };

export const ESTADOS_DO_PR = ["rascunho", "aberto", "juntado", "fechado"] as const;
export type EstadoDoPr = (typeof ESTADOS_DO_PR)[number];
export const NOME_DO_ESTADO_DO_PR: Record<EstadoDoPr, string> = { rascunho: "Rascunho", aberto: "Aberto", juntado: "Juntado", fechado: "Fechado" };
const ehEstadoDoPr = (v: unknown): v is EstadoDoPr => typeof v === "string" && (ESTADOS_DO_PR as readonly string[]).includes(v);

export type Conflito = {
  id: number;
  titulo: string;
  coluna: Coluna;
  responsavel: string | null;
  responsavelId: string | null;
  viaClaude: boolean;
  sessao: string | null;
  ramo: string | null;
  prUrl: string | null;
  cruzam: Cruzamento[];
  /** Só "arquivo de todos" em comum: aviso leve. */
  soComum: boolean;
};

export type Cartao = {
  id: number;
  titulo: string;
  descricao: string | null;
  tipo: Tipo;
  prioridade: Prioridade;
  coluna: Coluna;
  responsavel: string | null;
  responsavelId: string | null;
  viaClaude: boolean;
  sessao: string | null;
  ramo: string | null;
  prUrl: string | null;
  caminhos: string[];
  /** O que o GitHub viu (0143): pedido de revisão, arquivos de verdade e o atraso contra o main. */
  prNumero: number | null;
  prEstado: EstadoDoPr | null;
  arquivos: string[];
  atrasDoMain: number | null;
  avisoMain: string | null;
  githubLogin: string | null;
  githubEm: string | null;
  sugestaoId: number | null;
  origem: string;
  referencia: string | null;
  ultimaNota: string | null;
  criadoEm: string;
  criadoPor: string | null;
  mudouEm: string;
  mudouPor: string | null;
  pegouEm: string | null;
  concluidoEm: string | null;
  conflitos: Conflito[];
};

export type Pessoa = { id: string; nome: string };

export type SugestaoNova = {
  id: number;
  criadaEm: string;
  autor: string | null;
  tela: string;
  telaNome: string | null;
  texto: string;
  prints: number;
};

/** Ramo que o GitHub viu e nenhum cartão reconheceu: trabalho fora do quadro. */
export type RamoForaDoQuadro = {
  ramo: string;
  githubLogin: string | null;
  pessoa: string | null;
  prNumero: number | null;
  prEstado: EstadoDoPr | null;
  titulo: string | null;
  arquivos: number;
  atrasDoMain: number | null;
  avisoMain: string | null;
  vistoEm: string;
  /** Os cartões em trabalho com que ele cruza (fora os arquivos de todos). */
  cruzaCom: number[];
};

export type Quadro = { eu: string; cartoes: Cartao[]; pessoas: Pessoa[]; sugestoes: SugestaoNova[]; ramos: RamoForaDoQuadro[]; githubEm: string | null };

export type Movimento = {
  em: string;
  por: string | null;
  peloConector: boolean;
  peloGithub: boolean;
  acao: string;
  de: Coluna | null;
  para: Coluna | null;
  nota: string | null;
  detalhe: Record<string, unknown>;
};

export type SugestaoDoCartao = {
  id: number;
  texto: string;
  autor: string | null;
  tela: string;
  telaNome: string | null;
  estado: string;
  resposta: string | null;
};

export type CartaoInteiro = { cartao: Cartao; historico: Movimento[]; sugestao: SugestaoDoCartao | null };

const texto = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const inteiro = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};
const listaDeTexto = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "") : []);

function lerConflito(cru: unknown): Conflito | null {
  if (!cru || typeof cru !== "object") return null;
  const c = cru as Record<string, unknown>;
  const id = inteiro(c.id);
  const titulo = texto(c.titulo);
  if (!id || !titulo || !ehColuna(c.coluna)) return null;
  return {
    id,
    titulo,
    coluna: c.coluna,
    responsavel: texto(c.responsavel),
    responsavelId: texto(c.responsavel_id),
    viaClaude: c.via_claude === true,
    sessao: texto(c.sessao),
    ramo: texto(c.ramo),
    prUrl: texto(c.pr_url),
    cruzam: Array.isArray(c.cruzam)
      ? c.cruzam.flatMap((x) => {
          const o = (x ?? {}) as Record<string, unknown>;
          const meu = texto(o.meu);
          const dele = texto(o.dele);
          return meu && dele ? [{ meu, dele, comum: o.comum === true }] : [];
        })
      : [],
    soComum: c.so_comum === true,
  };
}

/** Um cartão como `roadmap_cartao_json` (0141) devolve. `null` quando não é o formato esperado. */
export function lerCartao(cru: unknown): Cartao | null {
  if (!cru || typeof cru !== "object") return null;
  const c = cru as Record<string, unknown>;
  const id = inteiro(c.id);
  const titulo = texto(c.titulo);
  const criadoEm = texto(c.criado_em);
  if (!id || !titulo || !criadoEm || !ehColuna(c.coluna)) return null;
  return {
    id,
    titulo,
    descricao: texto(c.descricao),
    tipo: ehTipo(c.tipo) ? c.tipo : "melhoria",
    prioridade: ehPrioridade(c.prioridade) ? c.prioridade : "media",
    coluna: c.coluna,
    responsavel: texto(c.responsavel),
    responsavelId: texto(c.responsavel_id),
    viaClaude: c.via_claude === true,
    sessao: texto(c.sessao),
    ramo: texto(c.ramo),
    prUrl: texto(c.pr_url),
    caminhos: listaDeTexto(c.caminhos),
    prNumero: inteiro(c.pr_numero),
    prEstado: ehEstadoDoPr(c.pr_estado) ? c.pr_estado : null,
    arquivos: listaDeTexto(c.arquivos),
    atrasDoMain: Number.isInteger(c.atras_do_main) && (c.atras_do_main as number) >= 0 ? (c.atras_do_main as number) : null,
    avisoMain: texto(c.aviso_main),
    githubLogin: texto(c.github_login),
    githubEm: texto(c.github_em),
    sugestaoId: inteiro(c.sugestao_id),
    origem: texto(c.origem) ?? "manual",
    referencia: texto(c.referencia),
    ultimaNota: texto(c.ultima_nota),
    criadoEm,
    criadoPor: texto(c.criado_por),
    mudouEm: texto(c.mudou_em) ?? criadoEm,
    mudouPor: texto(c.mudou_por),
    pegouEm: texto(c.pegou_em),
    concluidoEm: texto(c.concluido_em),
    conflitos: Array.isArray(c.conflitos) ? c.conflitos.flatMap((x) => lerConflito(x) ?? []) : [],
  };
}

/** A lista de cruzamentos que `roadmap_pegar` e `roadmap_conflitos` devolvem. */
export function lerConflitos(cru: unknown): Conflito[] {
  return Array.isArray(cru) ? cru.flatMap((x) => lerConflito(x) ?? []) : [];
}

/** A resposta de `roadmap_quadro` (0141). `null` quando a leitura falhou ou não é o formato esperado. */
export function lerQuadro(cru: unknown): Quadro | null {
  if (!cru || typeof cru !== "object") return null;
  const o = cru as Record<string, unknown>;
  if (o.ok !== true || !Array.isArray(o.cartoes)) return null;
  return {
    eu: texto(o.eu) ?? "",
    cartoes: o.cartoes.flatMap((x) => lerCartao(x) ?? []),
    pessoas: Array.isArray(o.pessoas)
      ? o.pessoas.flatMap((x) => {
          const p = (x ?? {}) as Record<string, unknown>;
          const id = texto(p.id);
          const nome = texto(p.nome);
          return id && nome ? [{ id, nome }] : [];
        })
      : [],
    sugestoes: Array.isArray(o.sugestoes)
      ? o.sugestoes.flatMap((x) => {
          const s = (x ?? {}) as Record<string, unknown>;
          const id = inteiro(s.id);
          const corpo = texto(s.texto);
          const criadaEm = texto(s.criada_em);
          if (!id || !corpo || !criadaEm) return [];
          return [{ id, criadaEm, autor: texto(s.autor), tela: texto(s.tela) ?? "/admin", telaNome: texto(s.tela_nome), texto: corpo, prints: Number(s.prints) || 0 }];
        })
      : [],
    ramos: Array.isArray(o.ramos)
      ? o.ramos.flatMap((x) => {
          const g = (x ?? {}) as Record<string, unknown>;
          const ramo = texto(g.ramo);
          const vistoEm = texto(g.visto_em);
          if (!ramo || !vistoEm) return [];
          return [{
            ramo,
            githubLogin: texto(g.github_login),
            pessoa: texto(g.pessoa),
            prNumero: inteiro(g.pr_numero),
            prEstado: ehEstadoDoPr(g.pr_estado) ? g.pr_estado : null,
            titulo: texto(g.titulo),
            arquivos: Number(g.arquivos) || 0,
            atrasDoMain: Number.isInteger(g.atras_do_main) ? (g.atras_do_main as number) : null,
            avisoMain: texto(g.aviso_main),
            vistoEm,
            cruzaCom: Array.isArray(g.cruza_com) ? g.cruza_com.flatMap((n) => inteiro(n) ?? []) : [],
          }];
        })
      : [],
    githubEm: texto(o.github_em),
  };
}

/** A resposta de `roadmap_ver` (0141). */
export function lerCartaoInteiro(cru: unknown): CartaoInteiro | null {
  if (!cru || typeof cru !== "object") return null;
  const o = cru as Record<string, unknown>;
  if (o.ok !== true) return null;
  const cartao = lerCartao(o.cartao);
  if (!cartao) return null;
  const s = (o.sugestao ?? null) as Record<string, unknown> | null;
  const sugId = s ? inteiro(s.id) : null;
  return {
    cartao,
    historico: Array.isArray(o.historico)
      ? o.historico.flatMap((x) => {
          const h = (x ?? {}) as Record<string, unknown>;
          const em = texto(h.em);
          const acao = texto(h.acao);
          if (!em || !acao) return [];
          return [{
            em,
            por: texto(h.por),
            peloConector: h.pelo_conector === true,
            peloGithub: h.pelo_github === true,
            acao,
            de: ehColuna(h.de) ? h.de : null,
            para: ehColuna(h.para) ? h.para : null,
            nota: texto(h.nota),
            detalhe: h.detalhe && typeof h.detalhe === "object" ? (h.detalhe as Record<string, unknown>) : {},
          }];
        })
      : [],
    sugestao: s && sugId
      ? { id: sugId, texto: texto(s.texto) ?? "", autor: texto(s.autor), tela: texto(s.tela) ?? "/admin", telaNome: texto(s.tela_nome), estado: texto(s.estado) ?? "nova", resposta: texto(s.resposta) }
      : null,
  };
}

/** Filtro por pessoa: todos, os cartões sem dono, ou os de uma pessoa (pelo id). */
export type FiltroDePessoa = "todos" | "sem_dono" | string;
export type FiltroDeTipo = "todos" | Tipo;

export function filtrarCartoes(cartoes: readonly Cartao[], pessoa: FiltroDePessoa, tipo: FiltroDeTipo): Cartao[] {
  return cartoes.filter((c) => {
    if (tipo !== "todos" && c.tipo !== tipo) return false;
    if (pessoa === "todos") return true;
    if (pessoa === "sem_dono") return c.responsavelId === null;
    return c.responsavelId === pessoa;
  });
}

/** Os cartões separados por coluna, na ordem que o banco mandou (prioridade, depois o mais recente). */
export function porColuna(cartoes: readonly Cartao[]): Record<Coluna, Cartao[]> {
  const r = Object.fromEntries(COLUNAS.map((c) => [c, [] as Cartao[]])) as Record<Coluna, Cartao[]>;
  for (const c of cartoes) r[c.coluna].push(c);
  return r;
}

/**
 * Os pares de cartões em trabalho que mexem no mesmo lugar, um par por linha,
 * para o aviso no topo do quadro. O cruzamento vem pronto do banco: aqui só se
 * junta A com B e B com A numa linha só.
 */
export function paresQueCruzam(cartoes: readonly Cartao[]): { a: Cartao; b: Cartao; cruzam: Cruzamento[]; soComum: boolean }[] {
  const porId = new Map(cartoes.map((c) => [c.id, c]));
  const pares: { a: Cartao; b: Cartao; cruzam: Cruzamento[]; soComum: boolean }[] = [];
  for (const a of cartoes) {
    if (!EM_TRABALHO.includes(a.coluna)) continue;
    for (const conflito of a.conflitos) {
      const b = porId.get(conflito.id);
      if (!b || b.id <= a.id) continue;
      pares.push({ a, b, cruzam: conflito.cruzam, soComum: conflito.soComum });
    }
  }
  return pares;
}

/** Quem está mexendo em quê agora: uma linha por pessoa com cartão em trabalho. */
export function quemEstaFazendo(cartoes: readonly Cartao[]): { id: string; nome: string; fazendo: number; emRevisao: number; peloClaude: number }[] {
  const mapa = new Map<string, { id: string; nome: string; fazendo: number; emRevisao: number; peloClaude: number }>();
  for (const c of cartoes) {
    if (!EM_TRABALHO.includes(c.coluna) || !c.responsavelId) continue;
    const linha = mapa.get(c.responsavelId) ?? { id: c.responsavelId, nome: c.responsavel ?? "Alguém", fazendo: 0, emRevisao: 0, peloClaude: 0 };
    if (c.coluna === "fazendo") linha.fazendo += 1;
    else linha.emRevisao += 1;
    if (c.viaClaude) linha.peloClaude += 1;
    mapa.set(c.responsavelId, linha);
  }
  return [...mapa.values()].sort((x, y) => y.fazendo + y.emRevisao - (x.fazendo + x.emRevisao) || x.nome.localeCompare(y.nome, "pt-BR"));
}

/**
 * Os caminhos que a pessoa escreveu, um por linha (vírgula também separa).
 * O banco limpa de novo e compara normalizado; aqui só se corta e se tira o
 * repetido, para a tela mostrar o que vai ser gravado.
 */
export function lerCaminhos(entrada: string): string[] {
  const vistos = new Set<string>();
  const lista: string[] = [];
  for (const parte of entrada.split(/[\n,]+/)) {
    const c = parte.trim().slice(0, 200);
    if (!c || vistos.has(c)) continue;
    vistos.add(c);
    lista.push(c);
    if (lista.length >= MAXIMO_DE_CAMINHOS) break;
  }
  return lista;
}

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const PALAVRAS_QUE_SOBRAM = new Set(["a", "o", "as", "os", "de", "da", "do", "das", "dos", "e", "em", "no", "na", "nos", "nas", "um", "uma", "para", "pelo", "pela", "com", "por"]);

/**
 * O nome do ramo de um cartão: `<pessoa>/<número>-<título curto>`, por exemplo
 * `erick/12-conversa-privada-no-chat`. É a regra do CLAUDE.md: cada um num
 * ramo próprio, com o nome de quem faz e do cartão, para juntar os dois depois.
 */
export function ramoSugerido(pessoa: string | null, id: number, titulo: string): string {
  const quem = semAcento((pessoa ?? "").trim().split(/\s+/)[0] ?? "").toLowerCase().replace(/[^a-z0-9]/g, "") || "time";
  const palavras = semAcento(titulo)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter((p) => p && !PALAVRAS_QUE_SOBRAM.has(p))
    .slice(0, 5);
  return `${quem}/${id}${palavras.length ? `-${palavras.join("-")}` : ""}`.slice(0, 80);
}

/** O ramo que o banco aceita: o mesmo formato da trava de `roadmap_cartoes.ramo`. */
export const ramoValido = (v: string): boolean => v.length > 0 && v.length <= 200 && /^[A-Za-z0-9._/-]+$/.test(v);

/** O pedido de revisão que o banco aceita: só pedido do GitHub. */
export const prValido = (v: string): boolean => v.length <= 300 && /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/pull\/[0-9]+$/.test(v);

/** Os cruzamentos de verdade de um cartão: sem os que são só de arquivo de todos. */
export const cruzamentosDeVerdade = (c: Pick<Cartao, "conflitos">): Conflito[] => c.conflitos.filter((k) => !k.soComum);

/** Um cruzamento em palavras: o caminho, ou "o meu cruza com o dele". */
export const cruzamentoEmPalavras = (x: Cruzamento): string => (x.meu === x.dele ? x.meu : `${x.meu} cruza com ${x.dele}`);

/** Há quanto tempo, em palavras curtas, para o "último aviso do GitHub". */
export function haQuanto(iso: string | null, agora = Date.now()): string | null {
  if (!iso) return null;
  const min = Math.max(0, Math.round((agora - Date.parse(iso)) / 60_000));
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "há 1 dia" : `há ${d} dias`;
}

/** O número do pedido de revisão, para o rótulo do link. */
export const numeroDoPr = (url: string | null): string | null => (url ? (/\/pull\/(\d+)$/.exec(url)?.[1] ?? null) : null);

/** O que o histórico diz de cada movimento, em palavras. */
export function movimentoEmPalavras(m: Movimento): string {
  const para = m.para ? NOME_DA_COLUNA[m.para] : null;
  switch (m.acao) {
    case "criou":
      return para ? `Criou em ${para}` : "Criou o cartão";
    case "levou_sugestao":
      return para ? `Trouxe da sugestão para ${para}` : "Trouxe da sugestão";
    case "pegou": {
      const dono = typeof m.detalhe.responsavel === "string" ? m.detalhe.responsavel : null;
      const tomou = typeof m.detalhe.tomou_de === "string" ? m.detalhe.tomou_de : null;
      const base = dono && dono !== m.por ? `Passou para ${dono}` : "Pegou o cartão";
      return tomou ? `${base} (estava com ${tomou})` : base;
    }
    case "moveu":
      return para ? `Moveu para ${para}` : "Moveu";
    case "ligou_pr":
      return "Ligou o pedido de revisão";
    case "editou": {
      const campos = Array.isArray(m.detalhe.campos) ? (m.detalhe.campos as unknown[]).filter((c): c is string => typeof c === "string") : [];
      return campos.length ? `Editou ${campos.map((c) => NOME_DO_CAMPO[c] ?? c).join(", ")}` : "Editou";
    }
    default:
      return m.acao;
  }
}

const NOME_DO_CAMPO: Record<string, string> = {
  titulo: "o título",
  descricao: "a descrição",
  tipo: "o tipo",
  prioridade: "a prioridade",
  caminhos: "os caminhos",
  ramo: "o ramo",
  sessao: "a sessão do Claude",
};

/** O que dizer para cada recusa do banco. */
export const MENSAGEM_DO_MOTIVO: Record<string, string> = {
  sem_acesso: "O seu nível não abre o Roadmap. Ele é da diretoria (administrador, dono e GM).",
  nao_achou: "Esse cartão não existe mais.",
  titulo: "Escreva o título com pelo menos 3 letras.",
  tipo: "Escolha o tipo: correção, melhoria, atualização ou segurança.",
  prioridade: "Escolha a prioridade: urgente, alta, média ou baixa.",
  coluna: "Cartão novo entra em Ideias ou A fazer.",
  caminhos: "Os caminhos vão numa lista, um por linha.",
  ramo: "O ramo só aceita letras, números, ponto, hífen, sublinhado e barra.",
  pr: "Cole o endereço do pedido de revisão do GitHub (https://github.com/.../pull/123).",
  motivo: "Para descartar, escreva o motivo: é o que fica no cartão e o que quem sugeriu lê.",
  concluido: "O cartão já está no ar ou descartado. Volte ele para A fazer antes de pegar.",
  responsavel: "Essa pessoa não tem acesso ao Roadmap.",
  com_outra_pessoa: "Esse cartão está com outra pessoa.",
  ja_no_roadmap: "Essa sugestão já está no quadro.",
  formato: "O lote precisa ser uma lista de cartões.",
  lote_grande: `São até ${MAXIMO_DO_LOTE} cartões por vez.`,
  referencia: "A referência precisa ter de 3 a 120 caracteres.",
  gravar: "O banco recusou esse cartão.",
};

export const mensagemDoMotivo = (motivo: unknown): string =>
  (typeof motivo === "string" && MENSAGEM_DO_MOTIVO[motivo]) || "Não deu para salvar agora. Tente de novo.";

/** A regra do trabalho, como o conector devolve para o Claude ler antes de mexer. */
export const REGRA_DO_TRABALHO = [
  "Antes de mexer no painel, ache o cartão do trabalho (roadmap.quadro) ou crie um (roadmap.criar).",
  "Pegue o cartão (roadmap.pegar) dizendo o ramo e os caminhos que vai mexer. Se vier cruzamento, avise a pessoa antes de seguir: outro cartão em trabalho mexe no mesmo lugar.",
  "Trabalhe num ramo próprio, com o nome de quem faz e do cartão (o ramo sugerido vem na resposta). Nunca direto no main.",
  "Ao abrir o pedido de revisão, ligue ao cartão (roadmap.ligar_pr): ele vai para Em revisão.",
  "Depois de juntado ao main e publicado, mova para No ar (roadmap.concluir). Com o workflow do Roadmap no repositório, o GitHub já faz isso sozinho: pedido aberto leva para Em revisão e pedido juntado leva para No ar.",
  "Se o cartão tiver aviso de main (outro pedido juntou mudanças nos mesmos arquivos), traga o main para o seu ramo e rode os testes antes de juntar.",
] as const;
