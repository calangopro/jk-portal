/**
 * A conta pura do espelho da Kommo: transformar o que a API v4 e o webhook
 * devolvem nas linhas do banco (0160). Sem rede, sem banco, com teste em
 * `scripts/teste-kommo.mts` (`npm run verificar:kommo`).
 *
 * O formato foi lido da conta de verdade em 18/11/2026 (docs/kommo.md):
 *   - data em segundos desde 1970 (`created_at: 1779480309`);
 *   - etapas 142 (ganho) e 143 (perdido) existem em todo funil;
 *   - campo de rastreio tem `field_code` (UTM_SOURCE, META_AD_ID...), campo
 *     criado pela JK tem só nome ("Pedido Tray", "Motivo da Compra");
 *   - telefone vem como a pessoa digitou ("991914363", sem DDD, acontece);
 *   - evento tem id em texto (`01m7rk28qy...`) e NÃO traz o texto da mensagem.
 */

// ---------------------------------------------------------------------------
// Formatos da Kommo (só o que o espelho usa)
// ---------------------------------------------------------------------------

export type CampoDaKommo = {
  field_id: number;
  field_name?: string | null;
  field_code?: string | null;
  field_type?: string | null;
  values?: { value?: unknown; enum_id?: number | null; enum_code?: string | null }[] | null;
};

export type NegocioDaKommo = {
  id: number;
  name?: string | null;
  price?: number | null;
  responsible_user_id?: number | null;
  status_id?: number | null;
  pipeline_id?: number | null;
  loss_reason_id?: number | null;
  created_at?: number | null;
  updated_at?: number | null;
  closed_at?: number | null;
  is_deleted?: boolean | null;
  custom_fields_values?: CampoDaKommo[] | null;
  _embedded?: {
    tags?: { id?: number; name?: string | null }[] | null;
    contacts?: { id: number; is_main?: boolean | null }[] | null;
  } | null;
};

export type ContatoDaKommo = {
  id: number;
  name?: string | null;
  responsible_user_id?: number | null;
  created_at?: number | null;
  updated_at?: number | null;
  is_deleted?: boolean | null;
  custom_fields_values?: CampoDaKommo[] | null;
};

export type EventoDaKommo = {
  id: string;
  type: string;
  entity_id: number;
  entity_type: string;
  created_by?: number | null;
  created_at: number;
  value_before?: unknown;
  value_after?: unknown;
};

export type FunilDaKommoApi = {
  id: number;
  name: string;
  sort?: number | null;
  is_main?: boolean | null;
  is_archive?: boolean | null;
  _embedded?: { statuses?: { id: number; name: string; sort?: number | null; type?: number | null }[] | null } | null;
};

export type UsuarioDaKommo = {
  id: number;
  name: string;
  rights?: { is_active?: boolean | null; is_admin?: boolean | null } | null;
};

// ---------------------------------------------------------------------------
// Linhas do banco
// ---------------------------------------------------------------------------

export type LinhaNegocio = {
  id: number;
  nome: string | null;
  valor: number | null;
  funil_id: number | null;
  etapa_id: number | null;
  responsavel_id: number | null;
  contato_id: number | null;
  contatos: number[];
  motivo_perda_id: number | null;
  tags: string[];
  criado_em: string | null;
  atualizado_na_kommo: string | null;
  fechado_em: string | null;
  apagado: boolean;
  pedido_tray: string | null;
  motivo_compra: string | null;
  origem_cliente: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  utm_id: string | null;
  fbclid: string | null;
  gclid: string | null;
  ad_id: string | null;
  meta_ad_id: string | null;
  meta_adset_id: string | null;
  meta_campaign_id: string | null;
  campos: { id: number; nome: string | null; codigo: string | null; valor: string }[];
  espelhado_em: string;
};

export type LinhaContato = {
  id: number;
  nome: string | null;
  telefone: string | null;
  telefones: string[];
  email: string | null;
  responsavel_id: number | null;
  criado_em: string | null;
  atualizado_na_kommo: string | null;
  apagado: boolean;
  espelhado_em: string;
};

export type LinhaEvento = {
  id: string;
  tipo: string;
  entidade: string;
  entidade_id: number;
  autor_id: number | null;
  criado_em: string;
  antes: unknown;
  depois: unknown;
};

export type LinhaFunil = { id: number; nome: string; principal: boolean; arquivado: boolean; ordem: number; lido_em: string };
export type LinhaEtapa = { funil_id: number; id: number; nome: string; ordem: number; tipo: "aberta" | "entrada" | "ganho" | "perdido"; lido_em: string };
export type LinhaUsuario = { id: number; nome: string; ativo: boolean; administrador: boolean; lido_em: string };

// ---------------------------------------------------------------------------
// Pedaços
// ---------------------------------------------------------------------------

export const ETAPA_GANHO = 142;
export const ETAPA_PERDIDO = 143;

/** Segundos da Kommo para ISO. Zero e vazio são "sem data". */
export function dataDaKommo(s: number | null | undefined): string | null {
  if (typeof s !== "number" || !Number.isFinite(s) || s <= 0) return null;
  return new Date(s * 1000).toISOString();
}

/** ISO para os segundos que os filtros da Kommo pedem. */
export function segundos(iso: string): number {
  return Math.floor(Date.parse(iso) / 1000);
}

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

function textoDoCampo(c: CampoDaKommo): string {
  return (c.values ?? [])
    .map((v) => (v?.value == null ? "" : String(v.value).trim()))
    .filter(Boolean)
    .join(", ");
}

/**
 * Telefone brasileiro no formato do painel (`5511999999999`), ou null quando
 * não dá para saber o número inteiro (sem DDD, curto demais, de outro país).
 */
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

/** Os campos de nome que o espelho tira para coluna própria (nome sem acento e sem caixa). */
const POR_NOME: Record<string, "pedido_tray" | "motivo_compra" | "origem_cliente"> = {
  "pedido tray": "pedido_tray",
  "motivo da compra": "motivo_compra",
  "origem do cliente": "origem_cliente",
};

/** Os campos de rastreio, pelo código que a Kommo dá. */
const POR_CODIGO: Record<string, keyof LinhaNegocio> = {
  UTM_SOURCE: "utm_source",
  UTM_MEDIUM: "utm_medium",
  UTM_CAMPAIGN: "utm_campaign",
  UTM_CONTENT: "utm_content",
  UTM_TERM: "utm_term",
  UTM_ID: "utm_id",
  FBCLID: "fbclid",
  GCLID: "gclid",
  AD_ID: "ad_id",
  META_AD_ID: "meta_ad_id",
  META_ADSET_ID: "meta_adset_id",
  META_CAMPAIGN_ID: "meta_campaign_id",
};

/** Negócio da API v4 (`GET /leads`, com `with=contacts`) para a linha de `kommo_negocios`. */
export function linhaDoNegocio(n: NegocioDaKommo, agora: string): LinhaNegocio {
  const linha: LinhaNegocio = {
    id: n.id,
    nome: n.name?.trim() || null,
    valor: typeof n.price === "number" && Number.isFinite(n.price) ? n.price : null,
    funil_id: n.pipeline_id ?? null,
    etapa_id: n.status_id ?? null,
    responsavel_id: n.responsible_user_id || null,
    contato_id: null,
    contatos: [],
    motivo_perda_id: n.loss_reason_id || null,
    tags: (n._embedded?.tags ?? []).map((t) => t?.name?.trim() ?? "").filter(Boolean),
    criado_em: dataDaKommo(n.created_at),
    atualizado_na_kommo: dataDaKommo(n.updated_at),
    fechado_em: dataDaKommo(n.closed_at),
    apagado: Boolean(n.is_deleted),
    pedido_tray: null,
    motivo_compra: null,
    origem_cliente: null,
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    utm_content: null,
    utm_term: null,
    utm_id: null,
    fbclid: null,
    gclid: null,
    ad_id: null,
    meta_ad_id: null,
    meta_adset_id: null,
    meta_campaign_id: null,
    campos: [],
    espelhado_em: agora,
  };

  const contatos = n._embedded?.contacts ?? [];
  linha.contatos = contatos.map((c) => c.id).filter((id) => Number.isFinite(id));
  linha.contato_id = (contatos.find((c) => c.is_main) ?? contatos[0])?.id ?? null;

  for (const c of n.custom_fields_values ?? []) {
    if (c.field_type === "file") continue;
    const valor = textoDoCampo(c);
    if (!valor) continue;
    linha.campos.push({ id: c.field_id, nome: c.field_name ?? null, codigo: c.field_code ?? null, valor });
    const porCodigo = c.field_code ? POR_CODIGO[c.field_code] : undefined;
    if (porCodigo) {
      (linha as Record<string, unknown>)[porCodigo] = valor.slice(0, 500);
      continue;
    }
    const porNome = c.field_name ? POR_NOME[semAcento(c.field_name)] : undefined;
    if (porNome && !linha[porNome]) linha[porNome] = valor.slice(0, 500);
  }
  return linha;
}

/**
 * Contato da API v4 para a linha de `kommo_contatos`. SÓ nome, telefone e
 * e-mail: CPF, endereço, datas e os outros campos ficam na Kommo.
 */
export function linhaDoContato(c: ContatoDaKommo, agora: string): LinhaContato {
  const campos = c.custom_fields_values ?? [];
  const valores = (codigo: string) =>
    campos
      .filter((f) => f.field_code === codigo)
      .flatMap((f) => (f.values ?? []).map((v) => (v?.value == null ? "" : String(v.value).trim())))
      .filter(Boolean);

  const telefones = [...new Set(valores("PHONE").map(telefoneDoPainel).filter((t): t is string => Boolean(t)))];
  const email = valores("EMAIL").map((e) => e.toLowerCase()).find((e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) ?? null;

  return {
    id: c.id,
    nome: c.name?.trim() || null,
    telefone: telefones[0] ?? null,
    telefones,
    email,
    responsavel_id: c.responsible_user_id || null,
    criado_em: dataDaKommo(c.created_at),
    atualizado_na_kommo: dataDaKommo(c.updated_at),
    apagado: Boolean(c.is_deleted),
    espelhado_em: agora,
  };
}

/**
 * Os tipos de evento que o espelho guarda. Mensagem e nota entram para medir
 * tempo de resposta e atividade; o texto nunca vem (a API não manda).
 */
export const TIPOS_DE_EVENTO = [
  "lead_added",
  "lead_deleted",
  "lead_restored",
  "lead_status_changed",
  "entity_responsible_changed",
  "sale_field_changed",
  "contact_added",
  "contact_deleted",
  "contact_restored",
  "incoming_chat_message",
  "outgoing_chat_message",
  "common_note_added",
] as const;

/** Do valor de antes e depois, só o que é id e estado (nunca texto livre). */
function enxugar(v: unknown): unknown {
  if (!Array.isArray(v) || v.length === 0) return null;
  return v.map((item) => {
    if (!item || typeof item !== "object") return null;
    const o = item as Record<string, Record<string, unknown> | undefined>;
    if (o.lead_status) return { lead_status: { id: o.lead_status.id ?? null, pipeline_id: o.lead_status.pipeline_id ?? null } };
    if (o.responsible_user) return { responsible_user: { id: o.responsible_user.id ?? null } };
    if (o.sale_field_value) return { sale_field_value: { sale: o.sale_field_value.sale ?? null } };
    if (o.message) return { message: { talk_id: o.message.talk_id ?? null, origin: o.message.origin ?? null } };
    if (o.note) return { note: { id: o.note.id ?? null } };
    return null;
  });
}

const ENTIDADES: Record<string, string> = { lead: "lead", contact: "contact", company: "company", task: "task" };

export function linhaDoEvento(e: EventoDaKommo): LinhaEvento | null {
  const criado = dataDaKommo(e.created_at);
  if (!e?.id || !criado || !Number.isFinite(e.entity_id)) return null;
  return {
    id: String(e.id),
    tipo: e.type,
    entidade: ENTIDADES[e.entity_type] ?? e.entity_type,
    entidade_id: e.entity_id,
    autor_id: e.created_by || null,
    criado_em: criado,
    antes: enxugar(e.value_before),
    depois: enxugar(e.value_after),
  };
}

export function linhasDosFunis(funis: FunilDaKommoApi[], agora: string): { funis: LinhaFunil[]; etapas: LinhaEtapa[] } {
  const linhasF: LinhaFunil[] = [];
  const linhasE: LinhaEtapa[] = [];
  for (const f of funis) {
    linhasF.push({ id: f.id, nome: f.name, principal: Boolean(f.is_main), arquivado: Boolean(f.is_archive), ordem: f.sort ?? 0, lido_em: agora });
    for (const s of f._embedded?.statuses ?? []) {
      // A Kommo marca a etapa de entrada (leads não triados) com type 1.
      const tipo = s.id === ETAPA_GANHO ? "ganho" : s.id === ETAPA_PERDIDO ? "perdido" : s.type === 1 ? "entrada" : "aberta";
      linhasE.push({ funil_id: f.id, id: s.id, nome: s.name, ordem: s.sort ?? 0, tipo, lido_em: agora });
    }
  }
  return { funis: linhasF, etapas: linhasE };
}

export type MotivoDePerdaDaKommo = { id: number; name: string };

/** Os motivos de perda (`GET /api/v4/leads/loss_reasons`), para o nome na tela do funil (0162). */
export function linhasDosMotivos(motivos: MotivoDePerdaDaKommo[], agora: string): { id: number; nome: string; lido_em: string }[] {
  return motivos.filter((m) => Number.isSafeInteger(m.id) && m.name).map((m) => ({ id: m.id, nome: m.name, lido_em: agora }));
}

export function linhasDosUsuarios(usuarios: UsuarioDaKommo[], agora: string): LinhaUsuario[] {
  return usuarios.map((u) => ({
    id: u.id,
    nome: u.name,
    ativo: u.rights?.is_active !== false,
    administrador: Boolean(u.rights?.is_admin),
    lido_em: agora,
  }));
}

// ---------------------------------------------------------------------------
// Webhook
// ---------------------------------------------------------------------------

export type AvisoDoWebhook = {
  conta: { id: string | null; subdominio: string | null };
  negocios: number[];
  contatos: number[];
  negociosApagados: number[];
  contatosApagados: number[];
  /** Quantos itens de cada ação, para o registro (ex.: { "leads.status": 2 }). */
  acoes: Record<string, number>;
};

/**
 * O corpo do webhook da Kommo, que chega em formulário
 * (`application/x-www-form-urlencoded`) com chaves como `leads[status][0][id]`
 * e `contacts[update][0][id]`, ou `leads[note][0][note][element_id]` para nota.
 *
 * O webhook só diz QUEM mudou: o estado novo é lido de novo pela API, pelo
 * mesmo conversor da rotina. Assim existe um formato só no banco.
 */
export function lerWebhook(pares: Iterable<[string, string]>): AvisoDoWebhook {
  const r: AvisoDoWebhook = { conta: { id: null, subdominio: null }, negocios: [], contatos: [], negociosApagados: [], contatosApagados: [], acoes: {} };
  const vistos = new Set<string>();
  const ids = { leads: new Set<number>(), contacts: new Set<number>(), leadsDel: new Set<number>(), contactsDel: new Set<number>() };

  for (const [chave, valor] of pares) {
    if (chave === "account[id]") r.conta.id = valor;
    if (chave === "account[subdomain]") r.conta.subdominio = valor;
    const m = /^(leads|contacts)\[(\w+)\]\[(\d+)\]\[(?:id|note\]\[element_id)\]$/.exec(chave);
    if (!m) continue;
    const [, tipo, acao, indice] = m;
    const id = Number(valor);
    if (!Number.isSafeInteger(id) || id <= 0) continue;
    const marca = `${tipo}.${acao}.${indice}`;
    if (!vistos.has(marca)) {
      vistos.add(marca);
      r.acoes[`${tipo}.${acao}`] = (r.acoes[`${tipo}.${acao}`] ?? 0) + 1;
    }
    if (acao === "delete") (tipo === "leads" ? ids.leadsDel : ids.contactsDel).add(id);
    else (tipo === "leads" ? ids.leads : ids.contacts).add(id);
  }
  // Apagado e restaurado no mesmo aviso: vale reler (a leitura diz o estado final).
  r.negocios = [...ids.leads];
  r.contatos = [...ids.contacts];
  r.negociosApagados = [...ids.leadsDel].filter((id) => !ids.leads.has(id));
  r.contatosApagados = [...ids.contactsDel].filter((id) => !ids.contacts.has(id));
  return r;
}

/** O que a Kommo deve mandar para o painel (`settings` do `POST /api/v4/webhooks`). */
export const EVENTOS_DO_WEBHOOK = [
  "add_lead",
  "update_lead",
  "status_lead",
  "responsible_lead",
  "delete_lead",
  "restore_lead",
  "note_lead",
  "add_contact",
  "update_contact",
  "delete_contact",
  "restore_contact",
] as const;

// ---------------------------------------------------------------------------
// Cursores
// ---------------------------------------------------------------------------

/**
 * Para onde o cursor de uma leitura "mudados desde" vai depois de uma página.
 * Anda até o maior `updated_at` lido. Se a página inteira caiu no mesmo
 * segundo do cursor (mais de 250 mudanças num instante), o cursor fica e a
 * página sobe; senão, volta para a página 1.
 */
export function proximoCursor(
  cursor: string,
  pagina: number,
  atualizados: (string | null)[],
  tamanhoDaPagina: number,
): { cursor: string; pagina: number; acabou: boolean } {
  const maior = atualizados.reduce<string | null>((m, a) => (a && (!m || a > m) ? a : m), null);
  const acabou = atualizados.length < tamanhoDaPagina;
  if (!maior || Date.parse(maior) <= Date.parse(cursor)) {
    return { cursor, pagina: acabou ? 1 : pagina + 1, acabou };
  }
  return { cursor: maior, pagina: 1, acabou };
}

/**
 * A janela de eventos da próxima leitura: do ponto guardado até uma hora
 * depois (ou até agora). Janela curta para cada uma caber inteira numa rodada,
 * mesmo em hora de muita mensagem. Volta 2 minutos para pegar evento gravado
 * com atraso; o id da Kommo tira a repetição.
 */
export function janelaDeEventos(ate: string | null, agora: string): { de: string; ate: string } {
  const agoraMs = Date.parse(agora);
  const deMs = ate ? Date.parse(ate) - 2 * 60_000 : agoraMs - 60 * 60_000;
  return { de: new Date(deMs).toISOString(), ate: new Date(Math.min(agoraMs, deMs + 60 * 60_000)).toISOString() };
}

/** Partes de até `n` itens. */
export function emLotes<T>(itens: T[], n: number): T[][] {
  const r: T[][] = [];
  for (let i = 0; i < itens.length; i += n) r.push(itens.slice(i, i + n));
  return r;
}
