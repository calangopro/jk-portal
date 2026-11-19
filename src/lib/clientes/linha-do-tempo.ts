/**
 * A linha do tempo do cliente e o bloco "Na Kommo" da ficha (cartões 54 e 31).
 *
 * Arquivo PURO (sem banco, sem navegador e sem importar FUNÇÃO de outro
 * arquivo, só tipo): serve à tela e ao teste (`npm run verificar:clientes`).
 *
 * Quem junta os dados é o banco: `ficha_do_cliente` (0069) traz os pedidos, as
 * vendas por fora, o cadastro no grupo e a recuperação; `linha_do_tempo_do_cliente`
 * (0185) traz a Kommo e, por pedido, o que `historico_do_pedido` e
 * `origem_do_pedido` já sabem. Quem vê o quê (valor, telefone) é decidido
 * lá. Aqui só se lê, se tira o repetido e se põe em ordem.
 */
import type { CadastroDaFicha, CasoDaFicha, PedidoDaFicha, VendaDaFicha } from "./dados";
import type { EventoDoPedido } from "../pedidos/historico";

// ------------------------------------------------------------------ entrada

export type NegocioNaKommo = {
  id: number;
  nome: string | null;
  funil: string | null;
  etapa: string | null;
  fase: string | null;
  aberto: boolean;
  ganho: boolean;
  perdido: boolean;
  apagado: boolean;
  etapaDesde: string | null;
  criadoEm: string | null;
  fechadoEm: string | null;
  /** A última mensagem do cliente, quando ela é mais nova que a da loja. */
  esperandoDesde: string | null;
  /** O nome do usuário na Kommo. */
  responsavel: string | null;
  /** A pessoa do painel ligada a esse usuário pelo `kommo_mapa`; nulo é "sem dono no painel". */
  pessoa: string | null;
  meu: boolean;
  /** Só para a área de vendas ou para o responsável. */
  valor: number | null;
  pedidoTray: string | null;
  link: string;
};

export type EventoDaKommo = {
  id: string;
  tipo: "lead_added" | "lead_deleted" | "lead_restored" | "lead_status_changed" | "entity_responsible_changed";
  em: string;
  negocio: number | null;
  /** Quem fez na Kommo; nulo com `robo` é automação. */
  quem: string | null;
  robo: boolean;
  etapaDe: { funil: string | null; etapa: string | null } | null;
  etapaPara: { funil: string | null; etapa: string | null } | null;
  responsavelPara: string | null;
};

export type ChegadaLida = {
  em: string;
  canal: string | null;
  source: string | null;
  campaign: string | null;
  clique: string | null;
};

export type OrigemLida = {
  /** A chegada que levou a venda, pela régua de `origem_resolvida`. */
  chegouEm: string | null;
  canal: string | null;
  plataforma: string | null;
  campanha: string | null;
  conjunto: string | null;
  anuncio: string | null;
  chegadas: ChegadaLida[];
};

export type DadosDaLinha = {
  kommo: { lidoEm: string | null; contatos: number; negocios: NegocioNaKommo[]; eventos: EventoDaKommo[] };
  pedidos: { pedido: number; eventos: EventoDoPedido[]; origem: OrigemLida | null }[];
  /** Fábrica e suporte das vendas por fora sem pedido da loja. */
  vendas: EventoDoPedido[];
};

export type FichaParaALinha = {
  pedidos: PedidoDaFicha[];
  porFora: VendaDaFicha[];
  cadastros: CadastroDaFicha[];
  recuperacao: CasoDaFicha[];
};

// -------------------------------------------------------------------- saída

export type ItemDaLinha = { chave: string; em: string } & (
  | { tipo: "pedido"; pedido: PedidoDaFicha }
  | { tipo: "venda"; venda: VendaDaFicha }
  | { tipo: "cadastro"; cadastro: CadastroDaFicha }
  | { tipo: "recuperacao"; caso: CasoDaFicha }
  | { tipo: "do_pedido"; pedido: number | null; evento: EventoDoPedido }
  | {
      tipo: "chegada";
      pedido: number;
      canal: string | null;
      campaign: string | null;
      /** Esta é a chegada que levou a venda do pedido. */
      levou: boolean;
      plataforma: string | null;
      campanha: string | null;
      anuncio: string | null;
    }
  | { tipo: "kommo_criado"; negocio: NegocioNaKommo }
  | { tipo: "kommo_fechado"; negocio: NegocioNaKommo }
  | { tipo: "kommo_evento"; evento: EventoDaKommo; negocio: NegocioNaKommo | null }
);

/** Quanto a linha mostra de cada vez. */
export const ITENS_POR_VEZ = 30;

// ------------------------------------------------------------------ leitura

const objeto = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const texto = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);
const lista = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.map(objeto).filter((x): x is Record<string, unknown> => x !== null) : []);
const numero = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};
const etapaLida = (v: unknown) => {
  const o = objeto(v);
  return o ? { funil: texto(o.funil), etapa: texto(o.etapa) } : null;
};

const TIPOS_DA_KOMMO = new Set<EventoDaKommo["tipo"]>(["lead_added", "lead_deleted", "lead_restored", "lead_status_changed", "entity_responsible_changed"]);

/**
 * Lê o que `linha_do_tempo_do_cliente` devolve. Os eventos de cada pedido
 * chegam já lidos por quem chama (o leitor do histórico mora em
 * `lib/pedidos/historico.ts`), para a regra de leitura ficar num lugar só.
 * Nulo é sem acesso ou erro.
 */
export function lerLinhaDoTempo(v: unknown, lerEvento: (e: unknown) => EventoDoPedido | null): DadosDaLinha | null {
  const r = objeto(v);
  if (!r || r.ok !== true) return null;
  const k = objeto(r.kommo) ?? {};
  const negocios: NegocioNaKommo[] = lista(k.negocios).flatMap((n) => {
    const id = numero(n.id);
    const link = texto(n.link);
    return id && link
      ? [{
          id,
          nome: texto(n.nome),
          funil: texto(n.funil),
          etapa: texto(n.etapa),
          fase: texto(n.fase),
          aberto: n.aberto === true,
          ganho: n.ganho === true,
          perdido: n.perdido === true,
          apagado: n.apagado === true,
          etapaDesde: texto(n.etapa_desde),
          criadoEm: texto(n.criado_em),
          fechadoEm: texto(n.fechado_em),
          esperandoDesde: texto(n.esperando_desde),
          responsavel: texto(n.responsavel),
          pessoa: texto(n.pessoa),
          meu: n.meu === true,
          valor: numero(n.valor),
          pedidoTray: texto(n.pedido_tray),
          link,
        }]
      : [];
  });
  const eventos: EventoDaKommo[] = lista(k.eventos).flatMap((e) => {
    const id = texto(e.id);
    const em = texto(e.em);
    const tipo = e.tipo as EventoDaKommo["tipo"];
    return id && em && TIPOS_DA_KOMMO.has(tipo)
      ? [{
          id, tipo, em,
          negocio: numero(e.negocio),
          quem: texto(e.quem),
          robo: e.robo === true,
          etapaDe: etapaLida(e.etapa_de),
          etapaPara: etapaLida(e.etapa_para),
          responsavelPara: texto(e.responsavel_para),
        }]
      : [];
  });
  const pedidos = lista(r.pedidos).flatMap((p) => {
    const pedido = numero(p.pedido);
    if (!pedido) return [];
    const ev = (Array.isArray(p.eventos) ? p.eventos : []).map(lerEvento).filter((e): e is EventoDoPedido => e !== null);
    const o = objeto(p.origem);
    const res = objeto(o?.origem);
    const origem: OrigemLida | null = o
      ? {
          chegouEm: texto(res?.chegou_em),
          canal: texto(res?.canal),
          plataforma: texto(res?.plataforma),
          campanha: texto(res?.campanha_nome),
          conjunto: texto(res?.conjunto_nome),
          anuncio: texto(res?.anuncio_nome),
          chegadas: lista(o.chegadas).flatMap((c) =>
            texto(c.em) ? [{ em: String(c.em), canal: texto(c.canal), source: texto(c.source), campaign: texto(c.campaign), clique: texto(c.clique) }] : [],
          ),
        }
      : null;
    return [{ pedido, eventos: ev, origem }];
  });
  const vs = objeto(r.vendas) ?? {};
  const vendas = [...(Array.isArray(vs.fabrica) ? vs.fabrica : []), ...(Array.isArray(vs.suporte) ? vs.suporte : [])]
    .map(lerEvento)
    .filter((e): e is EventoDoPedido => e !== null);
  return { kommo: { lidoEm: texto(k.lido_em), contatos: numero(k.contatos) ?? 0, negocios, eventos }, pedidos, vendas };
}

// -------------------------------------------------------------------- conta

const tempo = (iso: string) => Date.parse(iso);
const valido = (iso: string | null | undefined): iso is string => typeof iso === "string" && Number.isFinite(Date.parse(iso));

/** O instante de um evento do histórico do pedido. "Pago" e "envio" só têm o dia: vale o fim do dia de São Paulo, como no banco. */
export function instanteDoEvento(e: EventoDoPedido): string {
  if (e.tipo === "pago") return `${e.dia}T23:59:00-03:00`;
  if (e.tipo === "envio") return `${e.dia}T23:58:00-03:00`;
  return e.em;
}

/**
 * Do histórico de cada pedido, o que a ficha já não mostra por conta própria:
 * "criado" é o cartão do pedido, e a venda por fora e a recuperação já vêm da
 * ficha. A chegada sai daqui quando a origem completa do pedido foi lida.
 */
const REPETE_A_FICHA = new Set<EventoDoPedido["tipo"]>(["criado", "venda_fora", "recuperacao"]);

/** Na mesma hora, o que aconteceu antes aparece embaixo: a chegada antes do negócio, o negócio antes do pedido. */
const ORDEM: Record<ItemDaLinha["tipo"], number> = {
  chegada: 0,
  cadastro: 1,
  kommo_criado: 2,
  kommo_evento: 3,
  pedido: 4,
  venda: 5,
  do_pedido: 6,
  recuperacao: 7,
  kommo_fechado: 8,
};

/**
 * A linha do tempo inteira, da mais nova para a mais antiga, sem repetido.
 * Item sem data que se leia sai, em vez de ir parar no começo ou no fim.
 */
export function montarLinhaDoTempo(f: FichaParaALinha, d: DadosDaLinha | null): ItemDaLinha[] {
  const itens: ItemDaLinha[] = [];
  const por = (i: ItemDaLinha) => {
    if (valido(i.em)) itens.push(i);
  };

  for (const p of f.pedidos) por({ tipo: "pedido", chave: `p${p.pedido}`, em: p.feitoEm, pedido: p });
  for (const v of f.porFora) por({ tipo: "venda", chave: `v${v.id}`, em: `${v.dia}T12:00:00-03:00`, venda: v });
  f.cadastros.forEach((c, i) => por({ tipo: "cadastro", chave: `l${i}`, em: c.criadoEm, cadastro: c }));
  for (const c of f.recuperacao) por({ tipo: "recuperacao", chave: `r${c.pedido}`, em: c.atualizadoEm, caso: c });

  if (d) {
    // As chegadas: um mesmo visitante aparece em mais de um pedido, então a mesma chegada vem repetida.
    const chegadas = new Map<string, Extract<ItemDaLinha, { tipo: "chegada" }>>();
    const chaveDaChegada = (em: string, canal: string | null) => `${tempo(em)}|${canal ?? ""}`;
    for (const p of d.pedidos) {
      if (!p.origem) continue;
      for (const c of p.origem.chegadas) {
        if (!valido(c.em)) continue;
        const k = chaveDaChegada(c.em, c.canal);
        const levou = p.origem.chegouEm !== null && valido(p.origem.chegouEm) && tempo(p.origem.chegouEm) === tempo(c.em);
        const ja = chegadas.get(k);
        if (ja && (ja.levou || !levou)) continue;
        chegadas.set(k, {
          tipo: "chegada",
          chave: `c${k}`,
          em: c.em,
          pedido: p.pedido,
          canal: c.canal,
          campaign: c.campaign,
          levou,
          plataforma: levou ? p.origem.plataforma : null,
          campanha: levou ? p.origem.campanha : null,
          anuncio: levou ? p.origem.anuncio : null,
        });
      }
    }
    for (const p of d.pedidos) {
      for (const [n, e] of p.eventos.entries()) {
        if (REPETE_A_FICHA.has(e.tipo)) continue;
        if (e.tipo === "chegada") {
          // Sem a origem completa (pedido não pago, ou além dos três mais novos), vale a chegada do histórico.
          const k = chaveDaChegada(e.em, e.canal);
          if (p.origem || chegadas.has(k)) continue;
          chegadas.set(k, {
            tipo: "chegada", chave: `c${k}`, em: e.em, pedido: p.pedido, canal: e.canal, campaign: null,
            levou: false, plataforma: e.plataforma, campanha: e.campanha, anuncio: null,
          });
          continue;
        }
        por({ tipo: "do_pedido", chave: `h${p.pedido}-${n}`, em: instanteDoEvento(e), pedido: p.pedido, evento: e });
      }
    }
    for (const c of chegadas.values()) por(c);
    d.vendas.forEach((e, n) => por({ tipo: "do_pedido", chave: `hv${n}`, em: instanteDoEvento(e), pedido: null, evento: e }));

    const negocio = new Map(d.kommo.negocios.map((n) => [n.id, n]));
    for (const n of d.kommo.negocios) {
      if (n.criadoEm) por({ tipo: "kommo_criado", chave: `kc${n.id}`, em: n.criadoEm, negocio: n });
      if (n.fechadoEm && (n.ganho || n.perdido)) por({ tipo: "kommo_fechado", chave: `kf${n.id}`, em: n.fechadoEm, negocio: n });
    }
    for (const e of d.kommo.eventos) {
      const n = e.negocio !== null ? (negocio.get(e.negocio) ?? null) : null;
      // "Negócio criado" já vem do próprio negócio.
      if (e.tipo === "lead_added" && n?.criadoEm) continue;
      por({ tipo: "kommo_evento", chave: `ke${e.id}`, em: e.em, evento: e, negocio: n });
    }
  }

  const vistas = new Set<string>();
  return itens
    .filter((i) => (vistas.has(i.chave) ? false : (vistas.add(i.chave), true)))
    .sort((a, b) => tempo(b.em) - tempo(a.em) || ORDEM[b.tipo] - ORDEM[a.tipo] || a.chave.localeCompare(b.chave));
}

/** Os primeiros `quantos` itens e quantos ficam para o "ver mais". */
export function cortar<T>(itens: T[], quantos = ITENS_POR_VEZ): { visiveis: T[]; resto: number } {
  const n = Math.max(0, Math.floor(quantos));
  return { visiveis: itens.slice(0, n), resto: Math.max(0, itens.length - n) };
}

// ------------------------------------------------------------------- Kommo

export type NegocioDoBloco = NegocioNaKommo & {
  /** Minutos na etapa de agora. */
  naEtapaMin: number | null;
  /** Minutos que o cliente espera resposta; nulo quando não espera ou o negócio está fechado. */
  esperandoMin: number | null;
};

const minutosDesde = (iso: string | null, agora: number) => (valido(iso) ? Math.max(0, (agora - tempo(iso)) / 60000) : null);

/**
 * Os negócios do bloco "Na Kommo": abertos primeiro (quem tem cliente
 * esperando na frente, o que espera há mais tempo antes), depois os fechados,
 * do mais novo para o mais antigo. Negócio apagado na Kommo não entra.
 */
export function negociosDoBloco(negocios: NegocioNaKommo[], agora: number): NegocioDoBloco[] {
  return negocios
    .filter((n) => !n.apagado)
    .map((n) => ({
      ...n,
      naEtapaMin: minutosDesde(n.etapaDesde, agora),
      esperandoMin: n.aberto ? minutosDesde(n.esperandoDesde, agora) : null,
    }))
    .sort((a, b) => {
      if (a.aberto !== b.aberto) return a.aberto ? -1 : 1;
      if (a.aberto) {
        const ea = a.esperandoMin ?? -1;
        const eb = b.esperandoMin ?? -1;
        if (ea !== eb) return eb - ea;
      }
      return (valido(b.criadoEm) ? tempo(b.criadoEm) : 0) - (valido(a.criadoEm) ? tempo(a.criadoEm) : 0);
    });
}
