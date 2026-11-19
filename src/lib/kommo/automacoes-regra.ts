/**
 * A conta pura das automações que escrevem na Kommo (cartão 49, 0173): o que
 * cada evento do painel vira na Kommo, e o corpo de cada pedido. Sem rede, sem
 * banco, com teste em `scripts/teste-kommo-automacoes.mts`.
 *
 * Quem executa é `escrever.ts` (o único caminho de escrita) e quem junta os
 * eventos é `automacoes.ts` (a rodada). Aqui só se decide.
 */

// Módulo puro não importa função de irmão (o teste roda com `.ts` no caminho e o
// `tsc` recusa): as duas constantes e o telefone são cópias de `conta.ts`, e o
// teste confere que as cópias dizem o mesmo que o original.
export const ETAPA_GANHO = 142;
export const ETAPA_PERDIDO = 143;

/** Cópia de `telefoneDoPainel` (`conta.ts`): `55` + DDD + número, ou null. */
export function telefoneDoPainel(bruto: string | null | undefined): string | null {
  if (!bruto) return null;
  let d = String(bruto).replace(/\D/g, "");
  if (!d) return null;
  d = d.replace(/^0+/, "");
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) d = d.slice(2);
  if (d.length !== 10 && d.length !== 11) return null;
  const ddd = Number(d.slice(0, 2));
  if (ddd < 11 || ddd > 99) return null;
  if (d.length === 11 && d.charAt(2) !== "9") return null;
  return `55${d}`;
}

export type IdDaAutomacao = "recuperacao" | "pos_venda" | "sac" | "tarefas";
export type Marco = "pago" | "enviado" | "entregue";
export const MARCOS: Marco[] = ["pago", "enviado", "entregue"];
export const NOME_DO_MARCO: Record<Marco, string> = { pago: "Pedido pago", enviado: "Pedido enviado", entregue: "Pedido entregue" };

/** As quatro automações, com o efeito por extenso que a tela mostra antes de ligar. */
export const AUTOMACOES: { id: IdDaAutomacao; nome: string; quando: string; efeito: string; mandaMensagem: boolean }[] = [
  {
    id: "recuperacao",
    nome: "Recuperação de pedido",
    quando: "Um cliente cria pedido na loja e não paga (cancelado ou esperando pagamento), pela mesma regra da fila de recuperação, e passa o tempo de espera sem pagar.",
    efeito: "Cria um negócio novo na etapa escolhida, com o contato do cliente (o que já existe na Kommo, ou um novo com nome, telefone e e-mail do pedido) e o maior valor tentado. Um por cliente a cada 30 dias. Não cria se o cliente já tem negócio aberto naquele funil.",
    mandaMensagem: true,
  },
  {
    id: "pos_venda",
    nome: "Pós-venda do pedido",
    quando: "Um pedido da loja fica pago, enviado ou entregue (FINALIZADO na Tray).",
    efeito: "Move o negócio aberto do cliente, naquele funil, para a etapa escolhida de cada marco. Só para a frente, nunca para trás. Sem negócio do cliente, não cria nada.",
    mandaMensagem: true,
  },
  {
    id: "sac",
    nome: "Caso do suporte",
    quando: "Um vendedor passa um caso para o suporte no painel (Suporte pós-venda).",
    efeito: "Cria um negócio na etapa escolhida do funil do SAC, com o contato do cliente. Não mexe em negócio de outro funil nem troca o responsável dele. Não cria se o cliente já tem negócio aberto no funil do SAC.",
    mandaMensagem: true,
  },
  {
    id: "tarefas",
    nome: "Oportunidade vira tarefa",
    quando: "Chega a semana de uma oportunidade da ficha do cliente (aniversário, um ano da compra, casamento chegando...).",
    efeito: "Cria uma tarefa no negócio aberto mais recente do cliente, para o responsável desse negócio, com o motivo e o que oferecer. Sem negócio aberto, não cria. A tarefa é interna: não vai mensagem ao cliente.",
    mandaMensagem: false,
  },
];

export const NOME_DA_AUTOMACAO = Object.fromEntries(AUTOMACOES.map((a) => [a.id, a.nome])) as Record<IdDaAutomacao, string>;

export function ehAutomacao(v: unknown): v is IdDaAutomacao {
  return typeof v === "string" && AUTOMACOES.some((a) => a.id === v);
}

/** Quantas escritas uma automação faz numa rodada de dez minutos, além do teto por hora. */
export const POR_RODADA = 5;

/** A janela das tarefas: oportunidade que vence nos próximos 7 dias ou venceu há até 1. */
export const TAREFA_ATE_DIAS = 7;
export const TAREFA_DESDE_DIAS = -1;

// ------------------------------------------------------------------ configuração

export type Configuracao = {
  id: IdDaAutomacao;
  funilId: number | null;
  etapaId: number | null;
  etapas: Partial<Record<Marco, number | null>>;
  responsavelId: number | null;
  esperaMin: number;
  limitePorHora: number;
};

export type FunilParaConferir = { id: number; etapas: { id: number; ordem: number; tipo: string }[] };

const aberta = (tipo: string) => tipo === "entrada" || tipo === "aberta";

/**
 * O mesmo que `kommo_automacao_problema` faz no banco (que é a trava), para a
 * tela dizer o problema em palavras antes de mandar. Devolve a frase, ou null.
 */
export function conferirConfig(c: Configuracao, funis: FunilParaConferir[]): string | null {
  if (!Number.isFinite(c.esperaMin) || c.esperaMin < 0 || c.esperaMin > 1440) return "A espera vai de 0 a 1.440 minutos (24 horas).";
  if (!Number.isFinite(c.limitePorHora) || c.limitePorHora < 1 || c.limitePorHora > 60) return "O teto vai de 1 a 60 escritas por hora.";
  const funil = c.funilId === null ? null : funis.find((f) => f.id === c.funilId) ?? null;
  if (c.id === "tarefas") return c.funilId !== null && !funil ? "Esse funil não está mais na Kommo." : null;
  if (!funil) return "Escolha o funil.";
  if (c.id === "recuperacao" || c.id === "sac") {
    const etapa = funil.etapas.find((e) => e.id === c.etapaId);
    if (!etapa) return "Escolha a etapa onde o negócio nasce.";
    if (!aberta(etapa.tipo)) return "O negócio não pode nascer numa etapa de ganho ou de perda.";
    return null;
  }
  let ultima = -1;
  let algum = false;
  for (const m of MARCOS) {
    const id = c.etapas[m];
    if (id === null || id === undefined) continue;
    const etapa = funil.etapas.find((e) => e.id === id);
    if (!etapa || !aberta(etapa.tipo)) return `Escolha uma etapa aberta do funil para "${NOME_DO_MARCO[m]}".`;
    if (etapa.ordem <= ultima) return "As etapas precisam seguir a ordem do funil: pago, depois enviado, depois entregue.";
    ultima = etapa.ordem;
    algum = true;
  }
  return algum ? null : "Escolha a etapa de pelo menos um marco.";
}

// ------------------------------------------------------------------ eventos

/** O marco do pedido pela situação e pelo status da Tray. Pedido não pago: null. */
export function marcoDoPedido(situacao: string | null, status: string | null): Marco | null {
  if (situacao !== "pago") return null;
  const s = (status ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();
  if (s === "FINALIZADO" || s === "ENTREGUE") return "entregue";
  if (s === "ENVIADO" || s.startsWith("PROBLEMAS NA ENTREGA")) return "enviado";
  return "pago";
}

export type ContatoNovo = { nome: string; telefone: string | null; email: string | null };

export type Acao =
  | {
      tipo: "criar_negocio";
      automacao: "recuperacao" | "sac";
      chave: string;
      cliente: string | null;
      referencia: string;
      rotulo: string;
      negocio: { nome: string; preco: number | null; funilId: number; etapaId: number; responsavelId: number | null };
      contato: ContatoNovo;
    }
  | {
      tipo: "mover_negocio";
      automacao: "pos_venda";
      chave: string;
      cliente: string | null;
      referencia: string;
      rotulo: string;
      negocioId: number;
      funilId: number;
      /** A etapa em que o espelho viu o negócio, e a ordem dela. */
      deEtapaId: number;
      paraEtapaId: number;
      /** A ordem de cada etapa do funil, para quem escreve conferir na Kommo que ainda é para a frente. */
      ordem: Record<number, number>;
    }
  | {
      tipo: "criar_tarefa";
      automacao: "tarefas";
      chave: string;
      cliente: string | null;
      referencia: string;
      rotulo: string;
      negocioId: number;
      texto: string;
      /** Prazo da tarefa, em segundos desde 1970. */
      prazo: number;
      responsavelId: number | null;
    };

const limpo = (t: string | null | undefined, max: number) =>
  String(t ?? "").replace(/[—–]/g, ",").replace(/\s+/g, " ").trim().slice(0, max);

const primeiroNome = (t: string | null | undefined) => limpo(t, 80).split(" ")[0] || "";

// ---- recuperação

export type CandidatoDeRecuperacao = {
  cliente: string;
  pedido: number;
  tentativas: number;
  valor: number | null;
  nome: string | null;
  telefone: string | null;
  email: string | null;
  aguardando: boolean;
  itens: string | null;
};

export function decidirRecuperacao(c: CandidatoDeRecuperacao, cfg: Configuracao): Acao | null {
  if (cfg.id !== "recuperacao" || cfg.funilId === null || cfg.etapaId === null) return null;
  const telefone = telefoneDoPainel(c.telefone);
  const email = c.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email) ? c.email.trim().toLowerCase() : null;
  // Sem telefone nem e-mail não há como achar nem criar o contato: o negócio ficaria sem cliente.
  if (!telefone && !email) return null;
  const nome = limpo(c.nome, 120) || "Cliente da loja";
  return {
    tipo: "criar_negocio",
    automacao: "recuperacao",
    chave: `recuperacao:pedido:${c.pedido}`,
    cliente: c.cliente,
    referencia: `pedido ${c.pedido}`,
    rotulo: `${nome}, pedido ${c.pedido}${c.tentativas > 1 ? ` (${c.tentativas} tentativas)` : ""}`,
    negocio: {
      nome: limpo(`Recuperação: pedido ${c.pedido}${c.itens ? `, ${c.itens}` : ""}`, 250),
      preco: c.valor !== null && Number.isFinite(Number(c.valor)) && Number(c.valor) > 0 ? Math.round(Number(c.valor)) : null,
      funilId: cfg.funilId,
      etapaId: cfg.etapaId,
      responsavelId: cfg.responsavelId,
    },
    contato: { nome, telefone, email },
  };
}

// ---- pós-venda

export type NegocioDoEspelho = { id: number; funil_id: number; etapa_id: number; responsavel_id: number | null; ordem: number | null };

export type CandidatoDePosVenda = {
  pedido: number;
  cliente: string | null;
  nome: string | null;
  situacao: string | null;
  status: string | null;
  negocio: NegocioDoEspelho | null;
};

/** A etapa do marco mais adiantado que o pedido já alcançou e que tem etapa escolhida. */
export function etapaDoMarco(marco: Marco, etapas: Configuracao["etapas"]): { marco: Marco; etapaId: number } | null {
  for (let i = MARCOS.indexOf(marco); i >= 0; i--) {
    const id = etapas[MARCOS[i]];
    if (id !== null && id !== undefined) return { marco: MARCOS[i], etapaId: id };
  }
  return null;
}

export function decidirPosVenda(p: CandidatoDePosVenda, cfg: Configuracao, ordem: Record<number, number>): Acao | null {
  if (cfg.id !== "pos_venda" || cfg.funilId === null) return null;
  const marco = marcoDoPedido(p.situacao, p.status);
  if (!marco) return null;
  const alvo = etapaDoMarco(marco, cfg.etapas);
  if (!alvo) return null;
  const n = p.negocio;
  // Sem negócio do cliente no funil, não cria. Negócio fechado ou de outro funil, não mexe.
  if (!n || n.funil_id !== cfg.funilId || n.etapa_id === ETAPA_GANHO || n.etapa_id === ETAPA_PERDIDO) return null;
  const atual = ordem[n.etapa_id] ?? n.ordem;
  const destino = ordem[alvo.etapaId];
  if (atual === null || atual === undefined || destino === undefined) return null;
  // Só para a frente: negócio que já está na etapa, ou adiante dela, fica.
  if (destino <= atual) return null;
  return {
    tipo: "mover_negocio",
    automacao: "pos_venda",
    chave: `pos_venda:${p.pedido}:${alvo.marco}`,
    cliente: p.cliente,
    referencia: `pedido ${p.pedido}`,
    rotulo: `${limpo(p.nome, 120) || "Cliente da loja"}, pedido ${p.pedido}: ${NOME_DO_MARCO[alvo.marco].toLowerCase()}`,
    negocioId: n.id,
    funilId: cfg.funilId,
    deEtapaId: n.etapa_id,
    paraEtapaId: alvo.etapaId,
    ordem,
  };
}

// ---- SAC

export const ASSUNTO_DO_CASO: Record<string, string> = {
  pedra: "Pedra",
  ajuste: "Ajuste",
  troca: "Troca",
  defeito: "Defeito ou garantia",
  atraso: "Atraso ou rastreio",
  gravacao: "Gravação",
  cancelamento: "Cancelamento",
  outro: "Outro assunto",
};

export type CandidatoDeSac = {
  caso: number;
  assunto: string | null;
  urgente: boolean;
  pedido: number | null;
  nome: string | null;
  telefone: string | null;
  email: string | null;
  no_sac: NegocioDoEspelho | null;
};

export function decidirSac(c: CandidatoDeSac, cfg: Configuracao): Acao | null {
  if (cfg.id !== "sac" || cfg.funilId === null || cfg.etapaId === null) return null;
  // O cliente já tem negócio aberto no SAC: o caso novo não abre outro.
  if (c.no_sac) return null;
  const telefone = telefoneDoPainel(c.telefone);
  const email = c.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email) ? c.email.trim().toLowerCase() : null;
  if (!telefone && !email) return null;
  const nome = limpo(c.nome, 120) || "Cliente";
  const assunto = ASSUNTO_DO_CASO[c.assunto ?? ""] ?? "Suporte";
  return {
    tipo: "criar_negocio",
    automacao: "sac",
    chave: `sac:caso:${c.caso}`,
    cliente: telefone ?? email,
    referencia: `caso ${c.caso}`,
    rotulo: `${nome}, caso ${c.caso}: ${assunto.toLowerCase()}`,
    negocio: {
      nome: limpo(`SAC: ${assunto}${c.pedido ? `, pedido ${c.pedido}` : ""}${c.urgente ? " (cliente esperando)" : ""}`, 250),
      preco: null,
      funilId: cfg.funilId,
      etapaId: cfg.etapaId,
      responsavelId: cfg.responsavelId,
    },
    contato: { nome, telefone, email },
  };
}

// ---- tarefas

export type OportunidadeParaTarefa = {
  ref: string;
  tipo: string;
  ocorrencia: string;
  emDias: number;
  motivo: string;
  oferecer: string;
  cliente: string | null;
  telefone: string | null;
};

/** Meio-dia de São Paulo (15h UTC) do dia, em segundos. */
export function meioDiaEmSaoPaulo(dia: string): number {
  return Math.floor(Date.parse(`${dia}T15:00:00Z`) / 1000);
}

export function decidirTarefa(o: OportunidadeParaTarefa, negocio: NegocioDoEspelho | null, cfg: Configuracao, hoje: string): Acao | null {
  if (cfg.id !== "tarefas") return null;
  if (o.emDias < TAREFA_DESDE_DIAS || o.emDias > TAREFA_ATE_DIAS) return null;
  if (!negocio || negocio.etapa_id === ETAPA_GANHO || negocio.etapa_id === ETAPA_PERDIDO) return null;
  if (cfg.funilId !== null && negocio.funil_id !== cfg.funilId) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(o.ocorrencia) || !/^\d{4}-\d{2}-\d{2}$/.test(hoje)) return null;
  // Prazo: o dia da oportunidade; se já passou, amanhã.
  const dia = o.ocorrencia > hoje ? o.ocorrencia : new Date(Date.parse(`${hoje}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  const nome = primeiroNome(o.cliente);
  return {
    tipo: "criar_tarefa",
    automacao: "tarefas",
    chave: `tarefa:${o.ref}:${o.tipo}:${o.ocorrencia}`,
    cliente: telefoneDoPainel(o.telefone),
    referencia: `cliente ${o.ref}`,
    rotulo: `${nome || "Cliente"}: ${limpo(o.motivo, 160)}`,
    negocioId: negocio.id,
    texto: limpo(`Oportunidade do painel${nome ? ` com ${nome}` : ""}: ${o.motivo}. ${o.oferecer}`, 900),
    prazo: meioDiaEmSaoPaulo(dia),
    responsavelId: negocio.responsavel_id,
  };
}

// ------------------------------------------------------------------ corpos dos pedidos

/** O telefone como a Kommo guarda: +55 com DDD. */
export function telefoneParaKommo(t: string): string {
  return `+${t}`;
}

/** `POST /api/v4/leads/complex`: o negócio, com o contato que já existe (id) ou um novo. */
export function corpoDoNegocio(a: Extract<Acao, { tipo: "criar_negocio" }>, contatoId: number | null): unknown[] {
  const contato = contatoId
    ? { id: contatoId }
    : {
        first_name: a.contato.nome,
        custom_fields_values: [
          ...(a.contato.telefone ? [{ field_code: "PHONE", values: [{ value: telefoneParaKommo(a.contato.telefone), enum_code: "MOB" }] }] : []),
          ...(a.contato.email ? [{ field_code: "EMAIL", values: [{ value: a.contato.email, enum_code: "WORK" }] }] : []),
        ],
      };
  return [
    {
      name: a.negocio.nome,
      ...(a.negocio.preco !== null ? { price: a.negocio.preco } : {}),
      pipeline_id: a.negocio.funilId,
      status_id: a.negocio.etapaId,
      ...(a.negocio.responsavelId !== null ? { responsible_user_id: a.negocio.responsavelId } : {}),
      _embedded: { contacts: [contato], tags: [{ name: "Painel JK" }] },
    },
  ];
}

/** `PATCH /api/v4/leads/{id}`: só funil e etapa. */
export function corpoDoMovimento(a: Extract<Acao, { tipo: "mover_negocio" }>): unknown {
  return { pipeline_id: a.funilId, status_id: a.paraEtapaId };
}

/** `POST /api/v4/tasks`: tarefa de contato (tipo 1) no negócio. */
export function corpoDaTarefa(a: Extract<Acao, { tipo: "criar_tarefa" }>): unknown[] {
  return [
    {
      task_type_id: 1,
      text: a.texto,
      complete_till: a.prazo,
      entity_id: a.negocioId,
      entity_type: "leads",
      ...(a.responsavelId !== null ? { responsible_user_id: a.responsavelId } : {}),
    },
  ];
}

// ------------------------------------------------------------------ leitura da Kommo

export type NegocioLido = { id: number; funilId: number; etapaId: number; responsavelId: number | null; fechado: boolean; apagado: boolean };

/** Um negócio como a API v4 devolve (`GET /leads/{id}`), no que importa para conferir. */
export function lerNegocio(cru: unknown): NegocioLido | null {
  const n = cru as { id?: unknown; pipeline_id?: unknown; status_id?: unknown; responsible_user_id?: unknown; closed_at?: unknown; is_deleted?: unknown } | null;
  if (!n || !Number.isSafeInteger(Number(n.id)) || !Number.isSafeInteger(Number(n.pipeline_id)) || !Number.isSafeInteger(Number(n.status_id))) return null;
  const etapa = Number(n.status_id);
  return {
    id: Number(n.id),
    funilId: Number(n.pipeline_id),
    etapaId: etapa,
    responsavelId: Number.isSafeInteger(Number(n.responsible_user_id)) && Number(n.responsible_user_id) > 0 ? Number(n.responsible_user_id) : null,
    fechado: etapa === ETAPA_GANHO || etapa === ETAPA_PERDIDO,
    apagado: n.is_deleted === true,
  };
}

/**
 * O movimento ainda vale com o negócio lido AGORA na Kommo? Devolve o motivo
 * para desistir, ou null. A Kommo é a verdade: o espelho pode ter dez minutos
 * de atraso, e uma pessoa pode ter mexido no negócio nesse meio tempo.
 */
export function motivoParaNaoMover(a: Extract<Acao, { tipo: "mover_negocio" }>, lido: NegocioLido | null): string | null {
  if (!lido || lido.apagado) return "O negócio não existe mais na Kommo.";
  if (lido.fechado) return "O negócio já foi fechado na Kommo.";
  if (lido.funilId !== a.funilId) return "O negócio mudou de funil na Kommo.";
  const atual = a.ordem[lido.etapaId];
  const destino = a.ordem[a.paraEtapaId];
  if (atual === undefined || destino === undefined) return "A etapa do negócio não está no funil que o painel conhece.";
  if (destino <= atual) return "O negócio já está nessa etapa, ou adiante dela.";
  return null;
}

/** Os contatos da busca (`GET /contacts?query=`) que são mesmo deste cliente, pelo telefone ou pelo e-mail. */
export function contatosDoCliente(cru: unknown, contato: ContatoNovo): { id: number; negocios: number[] }[] {
  const lista = ((cru as { _embedded?: { contacts?: unknown[] } } | null)?._embedded?.contacts ?? []) as {
    id?: unknown;
    custom_fields_values?: { field_code?: string; values?: { value?: unknown }[] }[] | null;
    _embedded?: { leads?: { id?: unknown }[] };
  }[];
  const achados: { id: number; negocios: number[] }[] = [];
  for (const c of lista) {
    if (!Number.isSafeInteger(Number(c.id))) continue;
    const campos = c.custom_fields_values ?? [];
    const valores = (codigo: string) => campos.filter((f) => f.field_code === codigo).flatMap((f) => (f.values ?? []).map((v) => String(v.value ?? "")));
    const casaTelefone = Boolean(contato.telefone) && valores("PHONE").some((v) => telefoneDoPainel(v) === contato.telefone);
    const casaEmail = Boolean(contato.email) && valores("EMAIL").some((v) => v.trim().toLowerCase() === contato.email);
    if (!casaTelefone && !casaEmail) continue;
    achados.push({ id: Number(c.id), negocios: (c._embedded?.leads ?? []).map((l) => Number(l.id)).filter((n) => Number.isSafeInteger(n)) });
  }
  return achados;
}

/** O que a busca de contato usa: o número sem o 55, ou o e-mail. */
export function buscaDoContato(contato: ContatoNovo): string | null {
  if (contato.telefone) return contato.telefone.slice(2);
  return contato.email;
}

/** O id do negócio criado, da resposta do `POST /leads/complex` (`[{ id, contact_id }]`). */
export function idDoNegocioCriado(cru: unknown): number | null {
  const primeiro = Array.isArray(cru) ? (cru[0] as { id?: unknown } | undefined) : null;
  const id = Number(primeiro?.id);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/** O id da tarefa criada (`{ _embedded: { tasks: [{ id }] } }`). */
export function idDaTarefaCriada(cru: unknown): number | null {
  const id = Number((cru as { _embedded?: { tasks?: { id?: unknown }[] } } | null)?._embedded?.tasks?.[0]?.id);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/** Texto curto do erro da Kommo para o registro (sem o corpo inteiro). */
export function erroCurto(e: unknown): { http: number | null; texto: string } {
  const status = typeof (e as { status?: unknown })?.status === "number" ? ((e as { status: number }).status as number) : null;
  const texto = e instanceof Error ? e.message : String(e);
  return { http: status, texto: texto.slice(0, 600) };
}

/** Recusa (a Kommo disse não, 4xx) ou erro (rede, 5xx, sem resposta). */
export function estadoDoErro(http: number | null): "recusada" | "erro" {
  return http !== null && http >= 400 && http < 500 && http !== 429 ? "recusada" : "erro";
}
