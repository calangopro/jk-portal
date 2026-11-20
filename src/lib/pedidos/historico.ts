/**
 * O histórico do pedido: tudo o que aconteceu com ele, num lugar só.
 *
 * Arquivo PURO (sem banco, sem navegador e sem importar função de outro
 * arquivo): serve à tela e ao teste (`npm run verificar:suporte`). O banco é
 * a 0103, e quem monta o histórico é `historico_do_pedido`, juntando o que já
 * está gravado em cada lugar. Ninguém escreve log à mão.
 *
 * O que a pessoa vê depende do acesso dela, e quem decide é o banco: a
 * fábrica não recebe o telefone, e valor em dinheiro só chega a quem tem a
 * área de vendas. Aqui só se lê e se escreve em português.
 */

export type EventoDoPedido =
  | { tipo: "criado"; em: string }
  | { tipo: "chegada"; em: string; canal: string | null; plataforma: string | null; campanha: string | null }
  | { tipo: "pago"; dia: string }
  | { tipo: "status"; em: string; de: string | null; para: string | null }
  | { tipo: "envio"; dia: string; codigo: string | null }
  | { tipo: "fabrica"; em: string; de: string | null; para: string; quem: string | null }
  | { tipo: "recuperacao"; em: string; estado: string; nota: string | null; valor: number | null; quem: string | null }
  | { tipo: "venda_fora"; em: string; quem: string | null; forma: string | null; valor: number | null }
  | { tipo: "suporte"; em: string; caso: number; assunto: string; de: string | null; para: string; nota: string | null; quem: string | null }
  | { tipo: "vendedor"; em: string; quem: string | null; por: string | null; proprio: boolean }
  | { tipo: "chat"; em: string; sala: string; mensagem: number; quem: string | null; texto: string };

export type HistoricoDoPedido = {
  numero: number;
  dia: string | null;
  feitoEm: string | null;
  situacao: string | null;
  status: string | null;
  etapa: string | null;
  entrega: string | null;
  cidade: string | null;
  uf: string | null;
  rastreio: string | null;
  /** Só para quem tem a área de vendas. */
  total: number | null;
  pagamento: string | null;
  cliente: { nome: string | null; telefone: string | null; ref: string };
  pecas: { nome: string; quantidade: string | null; foto: string | null }[];
  origem: { utmSource: string | null; parceiro: string | null; canalAnotado: string | null; chegouEm: string | null; plataforma: string | null; campanha: string | null };
  /** Quem vendeu, marcado no painel (vale a marcação mais recente). */
  vendedor: { id: string; nome: string | null; porNome: string | null; em: string; proprio: boolean } | null;
  /** Quem registrou venda por fora ligada a este pedido. */
  vendasPorFora: { nome: string | null; em: string }[];
  pode: { marcar: boolean; atribuir: boolean; fabrica: boolean; ficha: boolean; suporte: boolean };
  /** Quem pode receber a venda (só para quem pode atribuir). */
  vendedores: { id: string; nome: string }[];
  eu: string | null;
  /** Do mais novo para o mais velho. */
  eventos: EventoDoPedido[];
};

export type LeituraDoHistorico = { tipo: "ok"; h: HistoricoDoPedido } | { tipo: "nao_achado"; numero: number } | { tipo: "sem_acesso" };

const objeto = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const texto = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);
const numero = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Um acontecimento do histórico, como `historico_do_pedido` devolve. Também lê os da linha do tempo do cliente. */
export function lerEvento(v: unknown): EventoDoPedido | null {
  const e = objeto(v);
  if (!e) return null;
  const em = texto(e.em);
  switch (e.tipo) {
    case "criado":
      return em ? { tipo: "criado", em } : null;
    case "chegada":
      return em ? { tipo: "chegada", em, canal: texto(e.canal), plataforma: texto(e.plataforma), campanha: texto(e.campanha) } : null;
    case "pago":
      return texto(e.dia) ? { tipo: "pago", dia: String(e.dia) } : null;
    case "status":
      return em ? { tipo: "status", em, de: texto(e.de), para: texto(e.para) } : null;
    case "envio":
      return texto(e.dia) ? { tipo: "envio", dia: String(e.dia), codigo: texto(e.codigo) } : null;
    case "fabrica":
      return em && texto(e.para) ? { tipo: "fabrica", em, de: texto(e.de), para: String(e.para), quem: texto(e.quem) } : null;
    case "recuperacao":
      return em && texto(e.estado) ? { tipo: "recuperacao", em, estado: String(e.estado), nota: texto(e.nota), valor: numero(e.valor), quem: texto(e.quem) } : null;
    case "venda_fora":
      return em ? { tipo: "venda_fora", em, quem: texto(e.quem), forma: texto(e.forma), valor: numero(e.valor) } : null;
    case "suporte": {
      const caso = numero(e.caso);
      return em && caso && texto(e.para)
        ? { tipo: "suporte", em, caso, assunto: String(e.assunto ?? ""), de: texto(e.de), para: String(e.para), nota: texto(e.nota), quem: texto(e.quem) }
        : null;
    }
    case "vendedor":
      return em ? { tipo: "vendedor", em, quem: texto(e.quem), por: texto(e.por), proprio: e.proprio === true } : null;
    case "chat": {
      const mensagem = numero(e.mensagem);
      return em && mensagem && texto(e.sala) ? { tipo: "chat", em, sala: String(e.sala), mensagem, quem: texto(e.quem), texto: typeof e.texto === "string" ? e.texto : "" } : null;
    }
    default:
      return null;
  }
}

/** Lê o que `historico_do_pedido` devolve. Nulo é sem acesso; `encontrado` falso é número que o painel não conhece. */
export function lerHistorico(v: unknown, pedido: number): LeituraDoHistorico {
  const l = objeto(v);
  if (!l) return { tipo: "sem_acesso" };
  if (l.encontrado !== true) return { tipo: "nao_achado", numero: pedido };
  const c = objeto(l.cliente) ?? {};
  const o = objeto(l.origem) ?? {};
  const p = objeto(l.pode) ?? {};
  const vend = objeto(l.vendedor);
  return {
    tipo: "ok",
    h: {
      numero: numero(l.numero) ?? pedido,
      dia: texto(l.dia),
      feitoEm: texto(l.feito_em),
      situacao: texto(l.situacao),
      status: texto(l.status),
      etapa: texto(l.etapa),
      entrega: texto(l.entrega),
      cidade: texto(l.cidade),
      uf: texto(l.uf),
      rastreio: texto(l.rastreio),
      total: numero(l.total),
      pagamento: texto(l.pagamento),
      cliente: { nome: texto(c.nome), telefone: texto(c.telefone), ref: texto(c.ref) ?? `p${pedido}` },
      pecas: (Array.isArray(l.pecas) ? l.pecas : [])
        .map(objeto)
        .filter((x): x is Record<string, unknown> => x !== null && typeof x.nome === "string")
        .map((x) => ({ nome: String(x.nome), quantidade: texto(x.quantidade), foto: texto(x.foto) })),
      origem: {
        utmSource: texto(o.utm_source),
        parceiro: texto(o.parceiro),
        canalAnotado: texto(o.canal_anotado),
        chegouEm: texto(o.chegou_em),
        plataforma: texto(o.plataforma),
        campanha: texto(o.campanha),
      },
      vendedor: vend && typeof vend.id === "string" && typeof vend.em === "string"
        ? { id: vend.id, nome: texto(vend.nome), porNome: texto(vend.por_nome), em: vend.em, proprio: vend.proprio === true }
        : null,
      vendasPorFora: (Array.isArray(l.vendas_por_fora) ? l.vendas_por_fora : [])
        .map(objeto)
        .filter((x): x is Record<string, unknown> => x !== null && typeof x.em === "string")
        .map((x) => ({ nome: texto(x.nome), em: String(x.em) })),
      pode: { marcar: p.marcar === true, atribuir: p.atribuir === true, fabrica: p.fabrica === true, ficha: p.ficha === true, suporte: p.suporte === true },
      vendedores: (Array.isArray(l.vendedores) ? l.vendedores : [])
        .map(objeto)
        .filter((x): x is Record<string, unknown> => x !== null && typeof x.id === "string")
        .map((x) => ({ id: String(x.id), nome: texto(x.nome) ?? "Sem nome" })),
      eu: texto(l.eu),
      eventos: (Array.isArray(l.eventos) ? l.eventos : []).map(lerEvento).filter((e): e is EventoDoPedido => e !== null),
    },
  };
}

// --------------------------------------------------------------- as palavras

/**
 * As etapas da fábrica de partida (0191): a mesma lista de `NOME_DA_ETAPA`
 * (`lib/time/chat.ts`) e de `ETAPAS_DE_FABRICA`. Etapa criada no painel cai no
 * nome da chave ("polimento_extra" vira "Polimento extra").
 */
const ETAPA: Record<string, string> = { a_produzir: "Chegou pedido", separacao: "Separação", em_producao: "Produção", gravacao: "Gravação", embalar: "Embalar", verificar: "Verificar", pronto: "Enviar", enviado: "Enviado", entregue: "Entregue" };
export const nomeDaEtapa = (e: string | null) => (e ? (ETAPA[e] ?? e.replace(/_/g, " ").replace(/^./, (l) => l.toUpperCase())) : "");

const RECUPERACAO: Record<string, string> = {
  a_recuperar: "Entrou na fila de recuperação",
  em_contato: "Em contato para recuperar a venda",
  pago_por_fora: "Recuperado: pagou por fora",
  descartado: "Tirado da fila de recuperação",
};

const ASSUNTO: Record<string, string> = {
  pedra: "Caiu a pedra",
  ajuste: "Ajuste de tamanho",
  troca: "Troca",
  defeito: "Defeito ou garantia",
  atraso: "Atraso ou rastreio",
  gravacao: "Gravação errada",
  cancelamento: "Cancelamento",
  outro: "Outro assunto",
};

const SALA: Record<string, string> = { geral: "Geral", vendas: "Vendas", fabrica: "Fábrica", loja: "Loja", trafego: "Tráfego", diretoria: "Diretoria" };

const reais = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const primeiro = (nome: string | null) => (nome ?? "").trim().split(/\s+/)[0] || null;

/** "Fulano" ou "Alguém do time": o primeiro nome de quem fez, como a pessoa é chamada na loja. */
export const quemEmPalavra = (nome: string | null) => primeiro(nome) ?? "Alguém do time";

export type TextoDoEvento = { titulo: string; detalhe: string | null; quem: string | null };

/**
 * O título e o detalhe de cada acontecimento, em português de gente. `canal`
 * traduz o código do canal de chegada ("meta" vira "Instagram e Facebook");
 * vem de fora porque o nome mora em `lib/vendas/origem.ts`. O texto do chat
 * já chega limpo, sem o formato das marcações.
 */
export function textoDoEvento(e: EventoDoPedido, canal: (c: string) => string): TextoDoEvento {
  switch (e.tipo) {
    case "criado":
      return { titulo: "Pedido criado na loja", detalhe: null, quem: null };
    case "chegada": {
      const anuncio = e.campanha ? `${e.plataforma === "google" ? "Anúncio do Google" : e.plataforma === "meta" ? "Anúncio do Meta" : "Anúncio"}: ${e.campanha}` : null;
      return { titulo: `Chegou ao site por ${e.canal ? canal(e.canal) : "um caminho sem nome"}`, detalhe: anuncio, quem: null };
    }
    case "pago":
      return { titulo: "Pagamento confirmado na loja", detalhe: null, quem: null };
    case "status":
      return { titulo: "A loja mudou o status", detalhe: e.de && e.para ? `De "${e.de.toLowerCase()}" para "${e.para.toLowerCase()}"` : e.para, quem: null };
    case "envio":
      return { titulo: "Enviado pela loja", detalhe: e.codigo ? `Rastreio ${e.codigo}` : null, quem: null };
    case "fabrica":
      return { titulo: `Fábrica: ${nomeDaEtapa(e.para).toLowerCase()}`, detalhe: e.de ? `Estava em "${nomeDaEtapa(e.de).toLowerCase()}"` : null, quem: e.quem };
    case "recuperacao":
      return {
        titulo: RECUPERACAO[e.estado] ?? "Recuperação",
        detalhe: [e.valor !== null ? reais(e.valor) : null, e.nota].filter(Boolean).join(". ") || null,
        quem: e.quem,
      };
    case "venda_fora":
      return { titulo: "Venda registrada por fora da loja", detalhe: [e.forma, e.valor !== null ? reais(e.valor) : null].filter(Boolean).join(", ") || null, quem: e.quem };
    case "suporte": {
      const assunto = ASSUNTO[e.assunto] ?? "Suporte";
      const titulo =
        e.para === "na_fila"
          ? `Passado para o suporte: ${assunto}`
          : e.para === "com_suporte"
            ? `Assumido no suporte (caso ${e.caso})`
            : e.para === "resolvido"
              ? `Caso de suporte resolvido (caso ${e.caso})`
              : `Caso devolvido ao vendedor (caso ${e.caso})`;
      return { titulo, detalhe: e.nota, quem: e.quem };
    }
    case "vendedor":
      return e.proprio
        ? { titulo: `${quemEmPalavra(e.quem)} marcou que vendeu`, detalhe: null, quem: e.quem }
        : { titulo: `Venda marcada como de ${quemEmPalavra(e.quem)}`, detalhe: e.por ? `Marcado por ${quemEmPalavra(e.por)}` : null, quem: e.por };
    case "chat":
      return { titulo: `Falado no chat, sala ${SALA[e.sala] ?? e.sala}`, detalhe: e.texto.trim().slice(0, 240) || null, quem: e.quem };
  }
}

/**
 * Quem passou pelo pedido, para o topo da gaveta: quem direcionou ao suporte,
 * quem atendeu (suporte, fábrica e recuperação). Sem repetição, na ordem em
 * que apareceram.
 */
export function pessoasDoPedido(h: Pick<HistoricoDoPedido, "eventos">): { direcionou: string[]; atendeu: string[] } {
  const direcionou: string[] = [];
  const atendeu: string[] = [];
  const por = (l: string[], nome: string | null) => {
    if (nome && !l.includes(nome)) l.push(nome);
  };
  // Os eventos vêm do mais novo para o mais velho; para a ordem de chegada, de trás para frente.
  for (const e of [...h.eventos].reverse()) {
    if (e.tipo === "suporte" && e.para === "na_fila") por(direcionou, e.quem);
    if (e.tipo === "suporte" && e.para !== "na_fila") por(atendeu, e.quem);
    if (e.tipo === "fabrica" || e.tipo === "recuperacao") por(atendeu, e.quem);
  }
  return { direcionou, atendeu };
}

/** O número do pedido digitado (com ou sem #). Nulo quando não é número de pedido. */
export function lerNumeroDoPedido(v: string): number | null {
  const m = /^\s*#?\s*([1-9][0-9]{0,14})\s*$/.exec(v);
  return m ? Number(m[1]) : null;
}
