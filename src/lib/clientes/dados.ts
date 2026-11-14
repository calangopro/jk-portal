import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPublishedLocations } from "@/lib/data/locations";
import { lerEspecificacoes } from "@/lib/fabrica/etapas";
import { nomeLimpo } from "@/lib/vendas/origem";
import { nomeArrumado, primeiroNome, type Busca } from "./identidade";
import {
  MAIOR_ESPERA, MARCOS_EM_MESES, lerFase, lerTipo, oportunidadesDoCliente, somarDias, sugestoesDaGravacao,
  type ClienteParaConta, type CompraParaConta, type DataParcial, type Decisao, type Fase, type FichaParaConta,
  type LojaFisica, type MarcaParaConta, type Oportunidade, type Sugestao, type TipoDeOportunidade,
} from "./oportunidades";

/**
 * Leitura e escrita da ficha do cliente e das oportunidades (0069).
 *
 * Tudo passa por função do banco que confere a área `lancar_venda` por dentro:
 * o vendedor não tem leitura de `tray_pedidos`, que é faturamento, e recebe
 * daqui só o que é do cliente que ele abriu. Por isso o cliente usado é o da
 * pessoa logada, nunca o de serviço: é a sessão dela que a função confere.
 *
 * As contas (o que é oportunidade, o que a gravação sugere) moram em
 * `oportunidades.ts`, puro e com teste. Aqui só se busca e se arruma o formato.
 */

const texto = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const lista = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? (v as Record<string, unknown>[]) : []);

// ------------------------------------------------------------------- resumo

export type ResumoDoCliente = {
  /** A referência que abre a ficha. Não é telefone nem e-mail. */
  ref: string;
  nome: string | null;
  telefone: string | null;
  email: string | null;
  cidade: string | null;
  uf: string | null;
  pedidosPagos: number;
  pedidosNaoPagos: number;
  vendasPorFora: number;
  /** Dia da última compra paga, na loja ou por fora. */
  ultimaCompra: string | null;
  noGrupo: boolean;
  fase: Fase | null;
  responsavelId: string | null;
  responsavel: string | null;
};

function lerResumo(c: Record<string, unknown>): ResumoDoCliente | null {
  const ref = texto(c.ref);
  if (!ref) return null;
  return {
    ref,
    nome: nomeArrumado(texto(c.nome)),
    telefone: texto(c.telefone),
    email: texto(c.email),
    cidade: nomeArrumado(texto(c.cidade)),
    uf: texto(c.uf),
    pedidosPagos: Number(c.pedidos_pagos) || 0,
    pedidosNaoPagos: Number(c.pedidos_nao_pagos) || 0,
    vendasPorFora: Number(c.vendas_por_fora) || 0,
    ultimaCompra: texto(c.ultima_compra),
    noGrupo: c.no_grupo === true,
    fase: lerFase(c.fase),
    responsavelId: texto(c.responsavel_id),
    responsavel: texto(c.responsavel),
  };
}

/**
 * A lista da tela de clientes. Com busca, quem casa com ela. Sem busca, quem
 * comprou por último (ou, com `meus`, os clientes de quem a pessoa cuida).
 * Erro do banco vira `null`, e a tela diz que não deu para ler.
 */
export async function buscarClientes(
  db: SupabaseClient,
  busca: Busca | null,
  opcoes: { meus?: boolean; limite?: number } = {},
): Promise<ResumoDoCliente[] | null> {
  const { data, error } = await db.rpc("buscar_clientes", {
    p_nome: busca?.nome ?? null,
    p_telefone: busca?.telefone ?? null,
    p_email: busca?.email ?? null,
    p_pedido: busca?.pedido ?? null,
    p_meus: opcoes.meus === true,
    p_limite: opcoes.limite ?? 30,
  });
  if (error) {
    console.error("[clientes] buscar_clientes:", error.message);
    return null;
  }
  return lista(data).map(lerResumo).filter((c): c is ResumoDoCliente => c !== null);
}

// -------------------------------------------------------------------- ficha

export type ItemDoPedido = { nome: string; quantidade: number; preco: number | null; referencia: string | null; info: string | null };

export type PedidoDaFicha = {
  pedido: number;
  feitoEm: string;
  dia: string;
  /** O status que a Tray mostra ("A ENVIAR", "CANCELADO"). */
  status: string;
  situacao: "pago" | "aguardando" | "cancelado";
  total: number;
  pagamento: string | null;
  frete: string | null;
  cidade: string | null;
  uf: string | null;
  rastreio: string | null;
  /** `null`: os itens deste pedido não foram importados. */
  itens: ItemDoPedido[] | null;
};

export type VendaDaFicha = {
  id: string;
  dia: string;
  valor: number;
  forma: string;
  canal: string;
  produto: string | null;
  vendedor: string | null;
  estornada: boolean;
};

export type CadastroDaFicha = {
  criadoEm: string;
  origem: string | null;
  campanha: string | null;
  momento: string | null;
  entrouNoGrupoEm: string | null;
};

export type CasoDaFicha = { pedido: number; estado: string; nota: string | null; atualizadoEm: string; quem: string | null };

export type MarcaDaFicha = { tipo: TipoDeOportunidade; ocorrencia: string; decisao: Decisao; em: string; por: string | null };

export type DadosDaFicha = FichaParaConta & {
  anotacoes: string | null;
  responsavelId: string | null;
  atualizadoEm: string | null;
  atualizadoPor: string | null;
};

export type FichaDoCliente = ResumoDoCliente & {
  /** A pessoa logada, para a tela oferecer "eu cuido deste cliente". */
  eu: string;
  ficha: DadosDaFicha | null;
  pedidos: PedidoDaFicha[];
  porFora: VendaDaFicha[];
  cadastros: CadastroDaFicha[];
  recuperacao: CasoDaFicha[];
  marcadas: MarcaDaFicha[];
  historico: { em: string; por: string | null; campos: string[] }[];
  equipe: { id: string; nome: string }[];
};

function lerDadosDaFicha(f: unknown): DadosDaFicha | null {
  if (!f || typeof f !== "object") return null;
  const r = f as Record<string, unknown>;
  return {
    fase: lerFase(r.fase) ?? "nao_sei",
    parNome: texto(r.par_nome),
    aniversario: texto(r.aniversario),
    aniversarioPar: texto(r.aniversario_par),
    dataNamoro: texto(r.data_namoro),
    dataCasamento: texto(r.data_casamento),
    datasRecusadas: Array.isArray(r.datas_recusadas) ? (r.datas_recusadas as unknown[]).filter((d): d is string => typeof d === "string") : [],
    anotacoes: texto(r.anotacoes),
    responsavelId: texto(r.responsavel_id),
    atualizadoEm: texto(r.atualizado_em),
    atualizadoPor: texto(r.atualizado_por),
  };
}

function lerMarcas(v: unknown): MarcaDaFicha[] {
  return lista(v).flatMap((m) => {
    const tipo = lerTipo(m.tipo);
    const decisao = m.decisao === "falei" || m.decisao === "nao_vale" || m.decisao === "reaberta" ? m.decisao : null;
    const ocorrencia = texto(m.ocorrencia);
    return tipo && decisao && ocorrencia ? [{ tipo, ocorrencia, decisao, em: String(m.em ?? ""), por: texto(m.por) }] : [];
  });
}

export type LeituraDaFicha =
  | { ok: true; ficha: FichaDoCliente }
  | { ok: false; motivo: "sem_acesso" | "nao_encontrado" | "sem_telefone" | "erro" };

export async function lerFichaDoCliente(db: SupabaseClient, ref: string): Promise<LeituraDaFicha> {
  const { data, error } = await db.rpc("ficha_do_cliente", { p_ref: ref });
  if (error) {
    console.error("[clientes] ficha_do_cliente:", error.message);
    return { ok: false, motivo: "erro" };
  }
  const r = (data ?? {}) as Record<string, unknown>;
  const resumo = r.ok === true ? lerResumo(r) : null;
  if (!resumo) {
    const motivo = r.motivo === "sem_acesso" || r.motivo === "sem_telefone" ? r.motivo : r.ok === true ? "erro" : "nao_encontrado";
    return { ok: false, motivo };
  }

  const situacao = (v: unknown): PedidoDaFicha["situacao"] => (v === "pago" || v === "aguardando" ? v : "cancelado");
  return {
    ok: true,
    ficha: {
      ...resumo,
      eu: String(r.eu ?? ""),
      ficha: lerDadosDaFicha(r.ficha),
      pedidos: lista(r.pedidos).map((p) => ({
        pedido: Number(p.pedido),
        feitoEm: String(p.feito_em ?? ""),
        dia: String(p.dia ?? ""),
        status: texto(p.status) ?? "",
        situacao: situacao(p.situacao),
        total: Number(p.total) || 0,
        pagamento: texto(p.pagamento),
        frete: texto(p.frete),
        cidade: nomeArrumado(texto(p.cidade)),
        uf: texto(p.uf),
        rastreio: texto(p.rastreio),
        itens: Array.isArray(p.itens)
          ? lista(p.itens).map((i) => ({
              nome: texto(i.nome) ?? "Peça sem nome",
              quantidade: Number(i.quantidade) || 1,
              preco: i.preco === null || i.preco === undefined || i.preco === "" ? null : Number(i.preco),
              referencia: texto(i.referencia),
              info: texto(i.info),
            }))
          : null,
      })),
      porFora: lista(r.por_fora).map((v) => ({
        id: String(v.id),
        dia: String(v.dia ?? ""),
        valor: Number(v.valor) || 0,
        forma: texto(v.forma) ?? "outro",
        canal: texto(v.canal) ?? "outro",
        produto: texto(v.produto),
        vendedor: texto(v.vendedor),
        estornada: v.estornada === true,
      })),
      cadastros: lista(r.cadastros).map((c) => ({
        criadoEm: String(c.criado_em ?? ""),
        origem: texto(c.origem),
        campanha: texto(c.campanha),
        momento: texto(c.momento),
        entrouNoGrupoEm: texto(c.entrou_grupo_em),
      })),
      recuperacao: lista(r.recuperacao).map((c) => ({
        pedido: Number(c.pedido),
        estado: texto(c.estado) ?? "",
        nota: texto(c.nota),
        atualizadoEm: String(c.atualizado_em ?? ""),
        quem: texto(c.quem),
      })),
      marcadas: lerMarcas(r.marcadas),
      historico: lista(r.historico).map((h) => ({
        em: String(h.em ?? ""),
        por: texto(h.por),
        campos: Array.isArray(h.campos) ? (h.campos as unknown[]).filter((c): c is string => typeof c === "string") : [],
      })),
      equipe: lista(r.equipe).flatMap((p) => (texto(p.id) ? [{ id: String(p.id), nome: texto(p.nome) ?? "Sem nome" }] : [])),
    },
  };
}

// ---------------------------------------------------------- para as contas

/** O texto que vai gravado em cada peça, tirado do campo de informação do item. */
const gravacoesDe = (info: string | null) => lerEspecificacoes(info).filter((e) => e.tipo === "gravar").map((e) => e.valor);

/** A ficha aberta, no formato que as contas de oportunidade leem. */
export function contaDaFicha(f: FichaDoCliente): ClienteParaConta {
  const daLoja: CompraParaConta[] = f.pedidos
    .filter((p) => p.situacao === "pago")
    .map((p) => ({
      pedido: p.pedido,
      dia: p.dia,
      frete: p.frete,
      cidade: p.cidade,
      uf: p.uf,
      // Brinde tem preço zero e não diz o que a pessoa comprou.
      pecas: p.itens === null ? null : p.itens.filter((i) => (i.preco ?? 0) > 0).map((i) => ({ nome: nomeLimpo(i.nome), gravacoes: gravacoesDe(i.info) })),
    }));
  const porFora: CompraParaConta[] = f.porFora
    .filter((v) => !v.estornada)
    .map((v) => ({ pedido: null, dia: v.dia, frete: null, cidade: f.cidade, uf: f.uf, pecas: v.produto ? [{ nome: v.produto, gravacoes: [] }] : null }));
  return {
    nome: primeiroNome(f.nome),
    ficha: f.ficha,
    compras: [...daLoja, ...porFora].sort((a, b) => a.dia.localeCompare(b.dia)),
    marcadas: f.marcadas.map((m): MarcaParaConta => ({ tipo: m.tipo, ocorrencia: m.ocorrencia, decisao: m.decisao })),
  };
}

/** As lojas físicas publicadas, com a cidade: é o que diz para onde convidar o cliente. */
export async function lerLojasFisicas(): Promise<LojaFisica[]> {
  const lojas = await getPublishedLocations();
  return lojas.flatMap((l) => (l.addressLocality ? [{ nome: l.name, cidade: l.addressLocality }] : []));
}

// ------------------------------------------------------------ oportunidades

export type OportunidadeDaLista = Oportunidade & {
  ref: string;
  cliente: string | null;
  telefone: string | null;
  cidade: string | null;
  uf: string | null;
  fase: Fase | null;
  responsavelId: string | null;
  responsavel: string | null;
};

export type ListaDeOportunidades = {
  /** A pessoa logada, para o filtro "só os meus clientes". */
  eu: string | null;
  dias: number;
  lista: OportunidadeDaLista[];
};

/**
 * O que vence nos próximos `dias`, para todos os clientes.
 *
 * O banco separa quem pode ter alguma coisa na janela (`base_de_oportunidades`)
 * e a conta de cada um é `oportunidadesDoCliente`. Erro do banco vira `null`.
 */
export async function lerOportunidades(db: SupabaseClient, hoje: string, dias: number, lojas: LojaFisica[]): Promise<ListaDeOportunidades | null> {
  const { data, error } = await db.rpc("base_de_oportunidades", {
    p_de: somarDias(hoje, -MAIOR_ESPERA),
    p_ate: somarDias(hoje, dias),
    p_marcos: MARCOS_EM_MESES,
  });
  if (error) {
    console.error("[clientes] base_de_oportunidades:", error.message);
    return null;
  }
  const cru = (data ?? {}) as { eu?: string | null; clientes?: unknown };
  const todas: OportunidadeDaLista[] = [];
  for (const c of lista(cru.clientes)) {
    const resumo = lerResumo(c);
    if (!resumo) continue;
    const compras: CompraParaConta[] = [
      ...lista(c.compras).map((p) => ({
        pedido: Number(p.pedido),
        dia: String(p.dia ?? ""),
        frete: texto(p.frete),
        cidade: nomeArrumado(texto(p.cidade)),
        uf: texto(p.uf),
        pecas: Array.isArray(p.pecas) ? lista(p.pecas).map((i) => ({ nome: nomeLimpo(texto(i.nome) ?? ""), gravacoes: gravacoesDe(texto(i.info)) })) : null,
      })),
      ...lista(c.por_fora).map((v) => ({
        pedido: null,
        dia: String(v.dia ?? ""),
        frete: null,
        cidade: resumo.cidade,
        uf: resumo.uf,
        pecas: texto(v.produto) ? [{ nome: texto(v.produto) as string, gravacoes: [] }] : null,
      })),
    ].sort((a, b) => a.dia.localeCompare(b.dia));
    const conta: ClienteParaConta = {
      nome: primeiroNome(resumo.nome),
      ficha: lerDadosDaFicha(c.ficha),
      compras,
      marcadas: lerMarcas(c.marcadas).map((m) => ({ tipo: m.tipo, ocorrencia: m.ocorrencia, decisao: m.decisao })),
    };
    for (const o of oportunidadesDoCliente(conta, hoje, dias, lojas)) {
      todas.push({
        ...o,
        ref: resumo.ref,
        cliente: resumo.nome,
        telefone: resumo.telefone,
        cidade: resumo.cidade,
        uf: resumo.uf,
        fase: resumo.fase,
        responsavelId: resumo.responsavelId,
        responsavel: resumo.responsavel,
      });
    }
  }
  todas.sort((a, b) => a.ocorrencia.localeCompare(b.ocorrencia) || (a.cliente ?? "").localeCompare(b.cliente ?? ""));
  return { eu: texto(cru.eu), dias, lista: todas };
}

export type { Sugestao };
export { sugestoesDaGravacao };

// ------------------------------------------------------------------ escrita

export type CamposDaFicha = Partial<{
  fase: Fase;
  par_nome: string | null;
  aniversario: DataParcial | null;
  aniversario_par: DataParcial | null;
  data_namoro: DataParcial | null;
  data_casamento: DataParcial | null;
  anotacoes: string | null;
  responsavel_id: string | null;
  recusar_data: DataParcial;
}>;

const ERRO_AO_SALVAR: Record<string, string> = {
  sem_acesso: "O seu acesso não permite alterar a ficha.",
  nao_encontrado: "Não achei este cliente. Volte para a busca e abra a ficha de novo.",
  fase: "Escolha uma das fases da lista.",
  data: "Uma das datas não existe no calendário. Escreva como 12/06 ou 12/06/2024.",
  longo: "Texto comprido demais. O nome do par aceita até 120 letras e as anotações, até 2.000.",
  responsavel: "Essa pessoa não pode cuidar de cliente: escolha alguém da lista.",
  campos: "Não chegou nada para gravar.",
  dados: "Não deu para marcar: os dados da oportunidade chegaram incompletos.",
};

type Gravacao = { ok: true } | { ok: false; erro: string };

function respostaDaGravacao(onde: string, data: unknown, error: { message: string } | null): Gravacao {
  if (error) {
    console.error(`[clientes] ${onde}:`, error.message);
    return { ok: false, erro: "Não deu para gravar agora. Tente de novo em alguns segundos." };
  }
  const r = (data ?? {}) as { ok?: boolean; motivo?: string };
  return r.ok ? { ok: true } : { ok: false, erro: ERRO_AO_SALVAR[r.motivo ?? ""] ?? "Não deu para gravar agora." };
}

/** Grava só os campos que vierem. `null` apaga o campo. */
export async function salvarFicha(db: SupabaseClient, ref: string, campos: CamposDaFicha): Promise<Gravacao> {
  const { data, error } = await db.rpc("salvar_ficha_do_cliente", { p_ref: ref, p_campos: campos });
  return respostaDaGravacao("salvar_ficha_do_cliente", data, error);
}

export async function marcarOportunidade(
  db: SupabaseClient,
  a: { ref: string; tipo: TipoDeOportunidade; ocorrencia: string; decisao: Decisao },
): Promise<Gravacao> {
  const { data, error } = await db.rpc("marcar_oportunidade", {
    p_ref: a.ref,
    p_tipo: a.tipo,
    p_ocorrencia: a.ocorrencia,
    p_decisao: a.decisao,
    p_nota: null,
  });
  return respostaDaGravacao("marcar_oportunidade", data, error);
}
