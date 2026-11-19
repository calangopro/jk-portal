import type { Tom } from "./tons.ts";

/**
 * A tela Hoje: o que a pessoa logada precisa fazer agora, numa lista só.
 *
 * A revisão de 14/11 mostrou que o gargalo do painel é uso, não falta de tela:
 * o vendedor precisaria abrir oito telas para saber o que fazer. Esta conta
 * junta o que cada uma delas já sabe, em ordem de urgência, com o motivo em
 * uma frase, há quanto tempo espera e o botão que leva ao lugar de resolver.
 *
 * NADA AQUI DECIDE COR NEM PRAZO. Cada fonte chega com o tom calculado pela
 * régua dela (o chat por `esperaDoPedido`, o suporte por `esperaDoCaso`, a
 * Kommo por `tomDaEsperaNaKommo`, a fábrica por `tomDaEspera`, as
 * oportunidades por `tomDoPrazo`, a saúde pelo estado da ligação). Esta conta
 * só junta, ordena e corta o repetido. Assim a tela Hoje nunca diz "atrasado"
 * onde a tela de origem diz "atenção".
 *
 * Fonte que não veio (a pessoa não tem a área, ou a leitura falhou) é `null` e
 * não vira item: falta de dado nunca vira zero nem "tudo em dia".
 *
 * Arquivo puro: só importa tipo. Serve ao servidor e ao teste
 * (`npm run verificar:hoje`).
 */

export type Espera = { tom: Tom; minutos: number | null };

export type NegocioMeu = {
  id: number;
  nome: string | null;
  cliente: string | null;
  motivo: "sem_resposta" | "esperando_vendedor";
  link: string;
} & Espera;

export type EntradaDoHoje = {
  /** Os negócios da Kommo ligados à pessoa no mapa (0179). */
  kommoMeus: { lidoEm: string | null; mapeado: boolean; totais: Record<NegocioMeu["motivo"], number>; negocios: NegocioMeu[] } | null;
  /** Os alertas do time inteiro na Kommo (0162), para quem tem a área de vendas. */
  kommoTime: {
    lidoEm: string | null;
    esperando: { atencao: number; ruim: number } & Espera;
    semResposta: { atencao: number; ruim: number } & Espera;
  } | null;
  /** A fila de conferência das vendas da Kommo (0165). */
  vendasDaKommo: {
    eu: string;
    resolve: boolean;
    fila: { negocioId: number; quem: string | null; vendedorId: string | null; motivo: string; link: string; minutos: number | null }[];
  } | null;
  /** Pedidos pagos dos últimos 30 dias sem vendedor (0105). */
  pedidosSemVendedor: number | null;
  /** Oportunidades da semana e as que passaram da data (a conta do menu). */
  oportunidades: { daSemana: ({ cliente: string | null; tipo: string; quando: string } & Espera)[]; atrasadas: number; tomAtrasadas: Tom } | null;
  suporte: {
    fila: number;
    esperaDaFila: Espera | null;
    comigo: number;
    esperaComigo: Espera | null;
    novidades: number;
  } | null;
  chat: { novas: number; pedidosDoSetor: number; esperaDoPedido: Espera | null } | null;
  /** Pedidos da fila da fábrica com a cor de espera de atenção ou ruim. */
  fabrica: { atrasados: ({ ref: string; cliente: string | null; etapa: string } & Espera)[] } | null;
  /** Fila de recuperação: clientes que não pagaram e ninguém chamou. */
  recuperacao: { clientes: number } | null;
  /** Saúde das ligações, só para a diretoria. */
  /** Os avisos da saúde das ligações (`sinaisDaSaude`), só para a diretoria. */
  saude: { chave: string; tom: Tom; titulo: string; texto: string; href: string; rotulo: string }[] | null;
};

export type Botao = { href: string; rotulo: string; externo?: boolean };

export type ItemDaTarefa = { chave: string; texto: string; apoio: string | null; href: string | null; externo: boolean };

export type Tarefa = {
  chave: string;
  /** Tarefa é o que espera a pessoa; convite é o que vale olhar, sem prazo. */
  tipo: "tarefa" | "convite";
  /** O setor de onde vem, para a cor de identidade e o ícone. */
  fonte: "kommo" | "vendas" | "suporte" | "chat" | "fabrica" | "saude";
  tom: Tom;
  titulo: string;
  motivo: string;
  /** Há quanto tempo espera, por extenso curto. `null` quando a fonte não tem relógio. */
  espera: string | null;
  minutos: number | null;
  botao: Botao;
  itens: ItemDaTarefa[];
};

export type Hoje = {
  tarefas: Tarefa[];
  convites: Tarefa[];
  /** Aviso discreto: os negócios da pessoa na Kommo só aparecem com o mapa. */
  avisoDaKommo: string | null;
};

// ------------------------------------------------------------------ palavras

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** "agora", "12 min", "3 h", "2 dias": curto, para caber ao lado do título. */
export function esperaEmPalavra(minutos: number | null): string | null {
  if (minutos === null || !Number.isFinite(minutos)) return null;
  const m = Math.max(0, Math.floor(minutos));
  if (m < 1) return "agora";
  if (m < 60) return `há ${m} min`;
  if (m < 48 * 60) return `há ${Math.floor(m / 60)} h`;
  return `há ${Math.floor(m / 1440)} dias`;
}

const RANK: Record<Tom, number> = { ruim: 0, atencao: 1, neutro: 2, bom: 3 };

/** O pior tom de uma lista. Lista vazia é neutro. */
export function piorTom(tons: readonly Tom[]): Tom {
  return tons.reduce<Tom>((pior, t) => (RANK[t] < RANK[pior] ? t : pior), "neutro");
}

const maior = (xs: readonly (number | null)[]): number | null => {
  const ok = xs.filter((x): x is number => x !== null && Number.isFinite(x));
  return ok.length ? Math.max(...ok) : null;
};

function tarefa(t: Omit<Tarefa, "espera" | "itens"> & { itens?: ItemDaTarefa[] }): Tarefa {
  return { ...t, espera: esperaEmPalavra(t.minutos), itens: t.itens ?? [] };
}

// ------------------------------------------------------------------ cada fonte

function daKommo(e: EntradaDoHoje): Tarefa[] {
  const k = e.kommoMeus;
  // Espelho nunca lido não vira tarefa nem "tudo em dia".
  if (!k || !k.lidoEm || !k.mapeado) return [];
  const grupos = [
    {
      motivo: "sem_resposta" as const,
      titulo: (n: number) => `${plural(n, "cliente seu", "clientes seus")} sem resposta na Kommo`,
      frase: "O cliente mandou a última mensagem e ninguém da loja respondeu.",
    },
    {
      motivo: "esperando_vendedor" as const,
      titulo: (n: number) => `${plural(n, "negócio seu parado", "negócios seus parados")} em esperando vendedor`,
      frase: "Está na fase de alguém da loja assumir, na sua carteira da Kommo.",
    },
  ];
  const tarefas: Tarefa[] = [];
  for (const g of grupos) {
    const lista = k.negocios.filter((n) => n.motivo === g.motivo);
    if (lista.length === 0) continue;
    // A lista chega do mais antigo para o mais novo e tem teto; o total de cada motivo vem contado pelo banco.
    const n = Math.max(k.totais[g.motivo] ?? 0, lista.length);
    const mais = lista[0];
    tarefas.push(
      tarefa({
        chave: `kommo-meus-${g.motivo}`,
        tipo: "tarefa",
        fonte: "kommo",
        tom: piorTom(lista.map((x) => x.tom)),
        titulo: g.titulo(n),
        motivo: g.frase,
        minutos: maior(lista.map((x) => x.minutos)),
        botao: { href: mais.link, rotulo: "Abrir o mais antigo na Kommo", externo: true },
        itens: lista.slice(0, 3).map((x) => ({
          chave: `kommo-${x.id}`,
          texto: x.cliente ?? x.nome ?? `Negócio ${x.id}`,
          apoio: esperaEmPalavra(x.minutos),
          href: x.link,
          externo: true,
        })),
      }),
    );
  }
  return tarefas;
}

function doTimeNaKommo(e: EntradaDoHoje): Tarefa[] {
  const k = e.kommoTime;
  if (!k || !k.lidoEm) return [];
  const casos = [
    { chave: "kommo-time-esperando", x: k.esperando, um: "negócio do time esperando vendedor", varios: "negócios do time esperando vendedor", href: "/admin/funil?alerta=esperando", frase: "Ninguém da loja assumiu na Kommo. Veja no funil quem está com cada um." },
    { chave: "kommo-time-sem-resposta", x: k.semResposta, um: "conversa do time sem resposta", varios: "conversas do time sem resposta", href: "/admin/funil?alerta=sem_resposta", frase: "O cliente mandou a última mensagem e ninguém da loja respondeu na Kommo." },
  ];
  return casos
    .filter((c) => c.x.atencao > 0)
    .map((c) =>
      tarefa({
        chave: c.chave,
        tipo: "tarefa",
        fonte: "kommo",
        tom: c.x.tom,
        titulo: plural(c.x.atencao, c.um, c.varios),
        motivo: c.x.ruim > 0 ? `${c.frase} ${plural(c.x.ruim, "passou", "passaram")} do prazo de atraso.` : c.frase,
        minutos: c.x.minutos,
        botao: { href: c.href, rotulo: "Ver no funil" },
      }),
    );
}

function dasVendasDaKommo(e: EntradaDoHoje): Tarefa[] {
  const v = e.vendasDaKommo;
  if (!v || v.fila.length === 0) return [];
  // Quem resolve a fila vê a fila inteira numa tarefa só; a parte dele já está dentro, e não se repete.
  if (v.resolve) {
    return [
      tarefa({
        chave: "kommo-vendas-conferir",
        tipo: "tarefa",
        fonte: "vendas",
        tom: "neutro",
        titulo: `${plural(v.fila.length, "venda da Kommo", "vendas da Kommo")} para conferir`,
        motivo: "Negócio ganho na Kommo que o painel não lançou sozinho. Cada um diz o motivo.",
        minutos: maior(v.fila.map((f) => f.minutos)),
        botao: { href: "/admin/vendas-da-kommo", rotulo: "Abrir a fila" },
        itens: v.fila.slice(0, 3).map((f) => ({ chave: `kv-${f.negocioId}`, texto: f.quem ?? `Negócio ${f.negocioId}`, apoio: f.motivo, href: f.link, externo: true })),
      }),
    ];
  }
  const minhas = v.fila.filter((f) => f.vendedorId === v.eu);
  if (minhas.length === 0) return [];
  return [
    tarefa({
      chave: "kommo-vendas-minhas",
      tipo: "tarefa",
      fonte: "vendas",
      tom: "neutro",
      titulo: `${plural(minhas.length, "venda sua da Kommo", "vendas suas da Kommo")} esperando conferência`,
      motivo: "Ainda não contam no seu mês. Veja o motivo; quem resolve é a gerência.",
      minutos: maior(minhas.map((f) => f.minutos)),
      botao: { href: "/admin/vendas-da-kommo", rotulo: "Ver o motivo" },
      itens: minhas.slice(0, 3).map((f) => ({ chave: `kv-${f.negocioId}`, texto: f.quem ?? `Negócio ${f.negocioId}`, apoio: f.motivo, href: f.link, externo: true })),
    }),
  ];
}

function doSuporte(e: EntradaDoHoje): Tarefa[] {
  const s = e.suporte;
  if (!s) return [];
  const t: Tarefa[] = [];
  if (s.fila > 0) {
    t.push(
      tarefa({
        chave: "suporte-fila",
        tipo: "tarefa",
        fonte: "suporte",
        tom: s.esperaDaFila?.tom ?? "neutro",
        titulo: `${plural(s.fila, "caso", "casos")} de suporte sem dono`,
        motivo: "O vendedor passou o cliente e ninguém assumiu ainda.",
        minutos: s.esperaDaFila?.minutos ?? null,
        botao: { href: "/admin/suporte", rotulo: "Assumir no suporte" },
      }),
    );
  }
  if (s.comigo > 0) {
    t.push(
      tarefa({
        chave: "suporte-comigo",
        tipo: "tarefa",
        fonte: "suporte",
        tom: s.esperaComigo?.tom ?? "neutro",
        titulo: `${plural(s.comigo, "caso", "casos")} de suporte com você`,
        motivo: "Você assumiu e o caso ainda está aberto.",
        minutos: s.esperaComigo?.minutos ?? null,
        botao: { href: "/admin/suporte", rotulo: "Abrir o suporte" },
      }),
    );
  }
  if (s.novidades > 0) {
    t.push(
      tarefa({
        chave: "suporte-voltou",
        tipo: "tarefa",
        fonte: "suporte",
        tom: "neutro",
        titulo: s.novidades === 1 ? "1 caso que você passou foi fechado" : `${s.novidades} casos que você passou foram fechados`,
        motivo: "Leia a nota de quem resolveu antes de falar com o cliente.",
        minutos: null,
        botao: { href: "/admin/suporte", rotulo: "Ler a nota" },
      }),
    );
  }
  return t;
}

function doChat(e: EntradaDoHoje): Tarefa[] {
  const c = e.chat;
  if (!c) return [];
  const t: Tarefa[] = [];
  if (c.pedidosDoSetor > 0) {
    t.push(
      tarefa({
        chave: "chat-pedidos",
        tipo: "tarefa",
        fonte: "chat",
        tom: c.esperaDoPedido?.tom ?? "neutro",
        titulo: c.pedidosDoSetor === 1 ? "1 pedido de resposta espera o seu setor" : `${c.pedidosDoSetor} pedidos de resposta esperam o seu setor`,
        motivo: "Alguém do time pediu resposta no chat e ninguém respondeu ainda.",
        minutos: c.esperaDoPedido?.minutos ?? null,
        botao: { href: "/admin/chat", rotulo: "Responder no chat" },
      }),
    );
  }
  if (c.novas > 0) {
    t.push(
      tarefa({
        chave: "chat-novas",
        tipo: "tarefa",
        fonte: "chat",
        tom: "neutro",
        titulo: `${plural(c.novas, "mensagem nova", "mensagens novas")} no chat`,
        motivo: "Nas salas do seu setor, na Geral ou em resposta a você.",
        minutos: null,
        botao: { href: "/admin/chat", rotulo: "Ler no chat" },
      }),
    );
  }
  return t;
}

function daFabrica(e: EntradaDoHoje): Tarefa[] {
  const f = e.fabrica;
  if (!f || f.atrasados.length === 0) return [];
  const ruins = f.atrasados.filter((p) => p.tom === "ruim");
  const lista = [...f.atrasados].sort((a, b) => (b.minutos ?? 0) - (a.minutos ?? 0));
  const atencao = f.atrasados.length - ruins.length;
  return [
    tarefa({
      chave: "fabrica-atrasados",
      tipo: "tarefa",
      fonte: "fabrica",
      tom: piorTom(f.atrasados.map((p) => p.tom)),
      titulo: ruins.length > 0 ? `${plural(ruins.length, "pedido atrasado", "pedidos atrasados")} na fábrica` : `${plural(atencao, "pedido pede", "pedidos pedem")} atenção na fábrica`,
      motivo:
        ruins.length > 0 && atencao > 0
          ? `Pagos e ainda sem sair. E ${plural(atencao, "outro chega", "outros chegam")} perto do prazo.`
          : "Pagos e ainda sem sair da fábrica, contando desde o pagamento.",
      minutos: maior(lista.map((p) => p.minutos)),
      botao: { href: "/admin/fabrica", rotulo: "Abrir a fila" },
      itens: lista.slice(0, 3).map((p) => ({
        chave: `fab-${p.ref}`,
        texto: `${p.ref.startsWith("v") ? "Venda" : "Pedido"} ${p.ref.replace(/^v/, "")}${p.cliente ? `, ${p.cliente}` : ""}`,
        apoio: `${p.etapa}, ${esperaEmPalavra(p.minutos) ?? ""}`.replace(/, $/, ""),
        href: `/admin/fabrica?busca=${encodeURIComponent(p.ref.replace(/^v/, ""))}`,
        externo: false,
      })),
    }),
  ];
}

function daSaude(e: EntradaDoHoje): Tarefa[] {
  return (e.saude ?? []).map((q) =>
    tarefa({ chave: q.chave, tipo: "tarefa", fonte: "saude", tom: q.tom, titulo: q.titulo, motivo: q.texto, minutos: null, botao: { href: q.href, rotulo: q.rotulo } }),
  );
}

function convites(e: EntradaDoHoje): Tarefa[] {
  const t: Tarefa[] = [];
  const o = e.oportunidades;
  if (o && o.daSemana.length + o.atrasadas > 0) {
    const tom = piorTom([...o.daSemana.map((x) => x.tom), ...(o.atrasadas > 0 ? [o.tomAtrasadas] : [])]);
    t.push(
      tarefa({
        chave: "oportunidades",
        // Passou da data sem ninguém marcar: vira tarefa. Só a semana adiante é convite.
        tipo: o.atrasadas > 0 || tom !== "neutro" ? "tarefa" : "convite",
        fonte: "vendas",
        tom,
        titulo:
          o.daSemana.length === 0
            ? `${plural(o.atrasadas, "oportunidade passou", "oportunidades passaram")} da data`
            : `${plural(o.daSemana.length, "cliente vale", "clientes valem")} uma mensagem nesta semana`,
        motivo:
          o.daSemana.length > 0 && o.atrasadas > 0
            ? `Aniversário, data do casal ou marco da compra. E ${plural(o.atrasadas, "passou", "passaram")} da data sem ninguém marcar.`
            : o.daSemana.length > 0
              ? "Aniversário, data do casal ou marco da compra, nos próximos dias."
              : "Ninguém marcou que falou com o cliente.",
        minutos: null,
        botao: { href: "/admin/oportunidades", rotulo: "Ver quem chamar" },
        itens: o.daSemana.slice(0, 3).map((x, i) => ({ chave: `op-${i}`, texto: `${x.cliente ?? "Cliente sem nome"}, ${x.tipo.toLowerCase()}`, apoio: x.quando, href: null, externo: false })),
      }),
    );
  }
  if (e.recuperacao && e.recuperacao.clientes > 0) {
    t.push(
      tarefa({
        chave: "recuperacao",
        tipo: "convite",
        fonte: "vendas",
        tom: "neutro",
        titulo: plural(e.recuperacao.clientes, "cliente criou pedido e não pagou", "clientes criaram pedido e não pagaram"),
        motivo: "Nos últimos 14 dias, e ninguém chamou ainda. A fila está por ordem de valor.",
        minutos: null,
        botao: { href: "/admin/recuperacao", rotulo: "Abrir a fila" },
      }),
    );
  }
  if (e.pedidosSemVendedor !== null && e.pedidosSemVendedor > 0) {
    t.push(
      tarefa({
        chave: "pedidos-sem-vendedor",
        tipo: "convite",
        fonte: "vendas",
        tom: "neutro",
        titulo: `${plural(e.pedidosSemVendedor, "pedido do site", "pedidos do site")} sem vendedor`,
        motivo: "Dos últimos 30 dias. Algum é seu? Marque e ele entra no seu mês.",
        minutos: null,
        botao: { href: "/admin/pedidos-do-site", rotulo: "Achar o meu" },
      }),
    );
  }
  return t;
}

// ------------------------------------------------------------------ a conta

/** Mais urgente primeiro: a cor, depois quanto tempo espera (sem relógio vai depois), depois a ordem de chegada. */
export function ordenar(lista: readonly Tarefa[]): Tarefa[] {
  return lista
    .map((t, i) => ({ t, i }))
    .sort((a, b) => RANK[a.t.tom] - RANK[b.t.tom] || (b.t.minutos ?? -1) - (a.t.minutos ?? -1) || a.i - b.i)
    .map((x) => x.t);
}

/** Corta o repetido pela chave, ficando com o mais urgente. */
export function semRepetidos(lista: readonly Tarefa[]): Tarefa[] {
  const por = new Map<string, Tarefa>();
  for (const t of lista) {
    const ja = por.get(t.chave);
    if (!ja || RANK[t.tom] < RANK[ja.tom] || (RANK[t.tom] === RANK[ja.tom] && (t.minutos ?? -1) > (ja.minutos ?? -1))) por.set(t.chave, t);
  }
  return [...por.values()];
}

export function montarHoje(e: EntradaDoHoje): Hoje {
  const todas = semRepetidos([
    ...daSaude(e),
    ...daKommo(e),
    ...doTimeNaKommo(e),
    ...doSuporte(e),
    ...doChat(e),
    ...daFabrica(e),
    ...dasVendasDaKommo(e),
    ...convites(e),
  ]);
  const ordenadas = ordenar(todas);
  const k = e.kommoMeus;
  return {
    tarefas: ordenadas.filter((t) => t.tipo === "tarefa"),
    convites: ordenadas.filter((t) => t.tipo === "convite"),
    avisoDaKommo:
      k && !k.mapeado
        ? "Os seus negócios da Kommo aparecem aqui quando a diretoria ligar o seu usuário da Kommo em Quem é quem na Kommo."
        : null,
  };
}

/** Para onde olhar quando não há nada esperando: as telas do dia a dia de cada área. */
export function oQueOlharDepois(areas: readonly string[]): Botao[] {
  const opcoes: (Botao & { area: string })[] = [
    { area: "lancar_venda", href: "/admin/pedidos-do-site", rotulo: "Pedidos do site" },
    { area: "lancar_venda", href: "/admin/oportunidades", rotulo: "Oportunidades" },
    { area: "vendas", href: "/admin/funil", rotulo: "Funil da Kommo" },
    { area: "fabrica", href: "/admin/fabrica", rotulo: "Fila da fábrica" },
    { area: "redes", href: "/admin/redes", rotulo: "Hoje nas redes" },
    { area: "conteudo", href: "/admin/conteudos", rotulo: "Conteúdos" },
    { area: "time", href: "/admin/biblioteca", rotulo: "Biblioteca JK" },
  ];
  return opcoes.filter((o) => areas.includes(o.area)).slice(0, 3).map(({ href, rotulo }) => ({ href, rotulo }));
}
