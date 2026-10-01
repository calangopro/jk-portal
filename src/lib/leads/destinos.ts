import "server-only";
import { createHash } from "node:crypto";
import { SITE } from "@/lib/seo/site";
import { legivel } from "./telefone";
import { PIXEL_DA_JK, SUBDOMINIO_KOMMO, type Chave } from "./chaves";
import type { Lead } from "./tipos";

/**
 * Os quatro lugares para onde um contato vai depois de gravado.
 *
 * Cada função recebe a linha já gravada e a chave do destino, e devolve uma
 * referência (id no CRM, código de resposta) ou lança erro. Quem decide se
 * tenta de novo é `repassar.ts`; aqui só se fala com o destino.
 *
 * Os nomes de etiqueta (`grupo-whatsapp`, `campanha-esq`, `momento-namoro`)
 * são os MESMOS do pop-up do tema da loja, então uma automação montada no RD
 * para a loja pega a bio e o /grupo sem nada a mais.
 */

export class Ignorado extends Error {}

const PRAZO_MS = 10_000;

function etiquetas(lead: Lead): string[] {
  const t = ["grupo-whatsapp", `origem-${lead.origem}`];
  if (lead.campanha) t.push(`campanha-${lead.campanha}`);
  if (lead.momento) t.push(`momento-${lead.momento}`);
  return t;
}

/** Endereço que a pessoa viu na barra, que é o que o Meta e o RD esperam. */
function enderecoDaPagina(lead: Lead): string {
  const caminho = lead.pagina?.startsWith("/") ? lead.pagina : `/${lead.origem}`;
  return `${SITE.lojaUrl}${caminho}`;
}

async function lerResposta(r: Response, quem: string): Promise<unknown> {
  const texto = await r.text();
  if (!r.ok) throw new Error(`${quem} respondeu ${r.status}: ${texto.slice(0, 240)}`);
  if (!texto) return null;
  try {
    return JSON.parse(texto);
  } catch {
    return texto;
  }
}

// ---------------------------------------------------------------------------
// Kommo
// ---------------------------------------------------------------------------

type CampoKommo = {
  field_id?: number;
  field_code?: string;
  values: { value?: string | boolean; enum_code?: string; enum_id?: number }[];
};

type ContatoKommo = {
  id: number;
  custom_fields_values?: { field_code?: string | null; values?: { value?: string }[] }[] | null;
};

/** Mesmo número, aceitando o 9 a mais ou a menos dos celulares antigos. */
function mesmoTelefone(gravado: string, lead: Lead): boolean {
  let a = gravado.replace(/\D/g, "");
  if (a.length > 11 && a.startsWith("55")) a = a.slice(2);
  const b = lead.whatsapp.slice(2);
  if (a === b) return true;
  return a.slice(0, 2) === b.slice(0, 2) && a.slice(-8) === b.slice(-8);
}

/** "Receber ofertas?" = Sim, achado pelo nome. O id é da conta, e muda se alguém recriar o campo. */
let campoReceberOfertas: Promise<CampoKommo | null> | null = null;

function kommo(chave: Chave) {
  const base = `https://${chave.meta.subdominio || SUBDOMINIO_KOMMO}.kommo.com/api/v4`;
  return async (caminho: string, init: RequestInit = {}): Promise<unknown> => {
    const r = await fetch(`${base}${caminho}`, {
      ...init,
      headers: { Authorization: `Bearer ${chave.valor}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(PRAZO_MS),
      cache: "no-store",
    });
    // A busca da Kommo responde 204, sem corpo, quando não acha nada.
    if (r.status === 204) return null;
    return lerResposta(r, "Kommo");
  };
}

async function receberOfertas(pedir: ReturnType<typeof kommo>): Promise<CampoKommo | null> {
  campoReceberOfertas ??= (async () => {
    try {
      const r = (await pedir("/contacts/custom_fields?limit=250")) as {
        _embedded?: { custom_fields?: { id: number; name: string; enums?: { id: number; value: string }[] | null }[] };
      } | null;
      const campo = r?._embedded?.custom_fields?.find((c) => c.name.trim().toLowerCase() === "receber ofertas?");
      const sim = campo?.enums?.find((e) => e.value.trim().toLowerCase() === "sim");
      return campo && sim ? { field_id: campo.id, values: [{ enum_id: sim.id }] } : null;
    } catch {
      campoReceberOfertas = null;
      return null;
    }
  })();
  return campoReceberOfertas;
}

function nota(lead: Lead): string {
  const linhas = [
    `Grupo de ofertas no WhatsApp, pelo formulário ${lead.origem === "grupo" ? "da página /grupo" : "do link da bio"}.`,
    lead.campanha ? `Campanha: ${lead.campanha}` : "",
    lead.momento ? `Momento do casal: ${lead.momento}` : "",
    lead.utm_source || lead.rede ? `Origem: ${[lead.utm_source || lead.rede, lead.utm_medium].filter(Boolean).join(" / ")}` : "",
    lead.utm_campaign ? `Anúncio: ${[lead.utm_campaign, lead.utm_content].filter(Boolean).join(" / ")}` : "",
    `Aceite: "${lead.aceite_texto}" em ${new Date(lead.aceite_em).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
  ];
  return linhas.filter(Boolean).join("\n");
}

export async function enviarParaKommo(lead: Lead, chave: Chave): Promise<string> {
  const pedir = kommo(chave);
  const tags = etiquetas(lead).map((name) => ({ name }));
  const ofertas = await receberOfertas(pedir);

  // Procura pelos 8 últimos dígitos, que batem com qualquer formato gravado
  // ("+55 11 9...", "(11) 9...", "119..."), e confere o número inteiro depois.
  const achados = (await pedir(`/contacts?limit=25&query=${lead.whatsapp.slice(-8)}`)) as {
    _embedded?: { contacts?: ContatoKommo[] };
  } | null;
  const existente = achados?._embedded?.contacts?.find((c) =>
    (c.custom_fields_values ?? []).some(
      (f) => f.field_code === "PHONE" && (f.values ?? []).some((v) => v.value && mesmoTelefone(v.value, lead)),
    ),
  );

  let contatoId: number;
  if (existente) {
    contatoId = existente.id;
    const temEmail = (existente.custom_fields_values ?? []).some((f) => f.field_code === "EMAIL");
    const campos: CampoKommo[] = [];
    if (ofertas) campos.push(ofertas);
    if (lead.email && !temEmail) campos.push({ field_code: "EMAIL", values: [{ value: lead.email, enum_code: "PRIV" }] });
    await pedir(`/contacts/${contatoId}`, {
      method: "PATCH",
      body: JSON.stringify({ tags_to_add: tags, ...(campos.length ? { custom_fields_values: campos } : {}) }),
    });
  } else {
    const campos: CampoKommo[] = [
      { field_code: "PHONE", values: [{ value: `+${lead.whatsapp}`, enum_code: "MOB" }] },
    ];
    if (lead.email) campos.push({ field_code: "EMAIL", values: [{ value: lead.email, enum_code: "PRIV" }] });
    if (ofertas) campos.push(ofertas);
    const criado = (await pedir("/contacts", {
      method: "POST",
      body: JSON.stringify([{ name: lead.nome, custom_fields_values: campos, _embedded: { tags } }]),
    })) as { _embedded?: { contacts?: { id: number }[] } } | null;
    const id = criado?._embedded?.contacts?.[0]?.id;
    if (!id) throw new Error("A Kommo não devolveu o id do contato.");
    contatoId = id;
  }

  await pedir(`/contacts/${contatoId}/notes`, {
    method: "POST",
    body: JSON.stringify([{ note_type: "common", params: { text: nota(lead) } }]),
  });

  // Negócio só quando alguém escolheu o funil no painel. Criar negócio dispara
  // as automações da etapa (Salesbot, mensagem no WhatsApp), e isso é decisão
  // de quem cuida da Kommo, não do formulário.
  const funil = Number(chave.meta.funil_id || 0);
  if (!funil) return `contato ${contatoId}`;

  const etapa = Number(chave.meta.etapa_id || 0);
  const rastreio: CampoKommo[] = (
    [
      ["UTM_SOURCE", lead.utm_source || lead.rede],
      ["UTM_MEDIUM", lead.utm_medium],
      ["UTM_CAMPAIGN", lead.utm_campaign],
      ["UTM_CONTENT", lead.utm_content],
      ["UTM_TERM", lead.utm_term],
      ["GCLID", lead.gclid],
      ["FBCLID", lead.fbclid],
      ["REFERRER", lead.referencia],
    ] as const
  )
    .filter(([, v]) => v)
    .map(([field_code, v]) => ({ field_code, values: [{ value: String(v).slice(0, 250) }] }));

  const negocio = {
    name: `Grupo de ofertas: ${lead.nome}`,
    pipeline_id: funil,
    ...(etapa ? { status_id: etapa } : {}),
    _embedded: { contacts: [{ id: contatoId }], tags },
  };
  let criado: unknown;
  try {
    criado = await pedir("/leads", {
      method: "POST",
      body: JSON.stringify([{ ...negocio, ...(rastreio.length ? { custom_fields_values: rastreio } : {}) }]),
    });
  } catch {
    // Campo de rastreio recusado não pode custar o negócio: vai sem ele.
    criado = await pedir("/leads", { method: "POST", body: JSON.stringify([negocio]) });
  }
  const negocioId = (criado as { _embedded?: { leads?: { id: number }[] } } | null)?._embedded?.leads?.[0]?.id;
  return negocioId ? `contato ${contatoId}, negócio ${negocioId}` : `contato ${contatoId}`;
}

// ---------------------------------------------------------------------------
// RD Station
// ---------------------------------------------------------------------------

/**
 * Conversão pela API pública do RD, igual ao pop-up da loja. O RD não aceita
 * contato sem e-mail, então quem deixou só o WhatsApp vai para a Kommo e para
 * o webhook, e aqui fica como `ignorado`.
 */
export async function enviarParaRd(lead: Lead, chave: Chave): Promise<string> {
  if (!lead.email) throw new Ignorado("sem e-mail");

  const payload: Record<string, unknown> = {
    conversion_identifier: chave.meta.identificador || "grupo-ofertas-whatsapp",
    name: lead.nome,
    email: lead.email,
    mobile_phone: legivel(lead.whatsapp),
    tags: etiquetas(lead),
    legal_bases: [{ category: "communications", type: "consent", status: "granted" }],
  };
  if (lead.utm_source || lead.rede) payload.traffic_source = lead.utm_source || lead.rede;
  if (lead.utm_medium) payload.traffic_medium = lead.utm_medium;
  if (lead.utm_campaign) payload.traffic_campaign = lead.utm_campaign;

  const r = await fetch(`https://api.rd.services/platform/conversions?api_key=${encodeURIComponent(chave.valor)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event_type: "CONVERSION", event_family: "CDP", payload }),
    signal: AbortSignal.timeout(PRAZO_MS),
    cache: "no-store",
  });
  const corpo = (await lerResposta(r, "RD Station")) as { event_uuid?: string } | null;
  return corpo?.event_uuid ?? String(r.status);
}

// ---------------------------------------------------------------------------
// Webhook do grupo (DevZapp, Make, n8n)
// ---------------------------------------------------------------------------

/** Mesmos campos do pop-up da loja, mais o id do contato e do evento. */
export async function enviarParaWebhook(lead: Lead, chave: Chave): Promise<string> {
  const corpo = {
    id: lead.id,
    event_id: lead.event_id,
    nome: lead.nome,
    whatsapp: lead.whatsapp,
    whatsapp_local: lead.whatsapp.slice(2),
    email: lead.email ?? "",
    momento: lead.momento ?? "",
    origem: lead.origem,
    campanha: lead.campanha,
    pagina: lead.pagina ?? "",
    utm_source: lead.utm_source ?? "",
    utm_medium: lead.utm_medium ?? "",
    utm_campaign: lead.utm_campaign ?? "",
    utm_content: lead.utm_content ?? "",
    utm_term: lead.utm_term ?? "",
    tags: etiquetas(lead),
    aceite: "sim",
    aceite_texto: lead.aceite_texto,
    aceite_em: lead.aceite_em,
    criado_em: lead.criado_em,
  };
  const r = await fetch(chave.valor, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
    signal: AbortSignal.timeout(PRAZO_MS),
    cache: "no-store",
  });
  await lerResposta(r, "Webhook");
  return String(r.status);
}

// ---------------------------------------------------------------------------
// Meta, API de Conversões
// ---------------------------------------------------------------------------

const VERSAO_GRAPH = "v24.0";
const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;

const hash = (v: string) => createHash("sha256").update(v.trim().toLowerCase()).digest("hex");

/**
 * O MESMO Lead que a tag do GTM manda pelo navegador, com o mesmo `event_id`.
 * O Meta junta os dois e conta um. Vale a pena mandar pelos dois lados porque
 * o do navegador some com bloqueador e no Safari, e o do servidor sozinho
 * casa pior com a pessoa (sem o cookie `_fbp` quando o pixel não carregou).
 *
 * Telefone, e-mail e nome vão em SHA-256, como o Meta exige. IP e navegador
 * vão abertos, que é como a API pede.
 */
export async function enviarParaMeta(lead: Lead, chave: Chave): Promise<string> {
  const quando = Date.parse(lead.criado_em);
  // O Meta recusa evento com mais de sete dias.
  if (Date.now() - quando > SETE_DIAS_MS) throw new Ignorado("mais de sete dias");

  const nomes = lead.nome.split(" ").filter(Boolean);
  const user_data: Record<string, unknown> = {
    ph: [hash(lead.whatsapp)],
    external_id: [hash(lead.whatsapp)],
    fn: [hash(nomes[0] ?? lead.nome)],
    country: [hash("br")],
  };
  if (nomes.length > 1) user_data.ln = [hash(nomes[nomes.length - 1])];
  if (lead.email) user_data.em = [hash(lead.email)];
  if (lead.ip) user_data.client_ip_address = lead.ip;
  if (lead.user_agent) user_data.client_user_agent = lead.user_agent;
  if (lead.fbc) user_data.fbc = lead.fbc;
  if (lead.fbp) user_data.fbp = lead.fbp;

  const corpo: Record<string, unknown> = {
    data: [
      {
        event_name: "Lead",
        event_time: Math.floor(quando / 1000),
        event_id: lead.event_id,
        action_source: "website",
        event_source_url: enderecoDaPagina(lead),
        user_data,
        custom_data: { lead_source: lead.origem, campanha: lead.campanha || undefined, content_name: "grupo-ofertas-whatsapp" },
      },
    ],
  };
  if (chave.meta.codigo_de_teste) corpo.test_event_code = chave.meta.codigo_de_teste;

  const pixel = chave.meta.pixel_id || PIXEL_DA_JK;
  const r = await fetch(
    `https://graph.facebook.com/${VERSAO_GRAPH}/${pixel}/events?access_token=${encodeURIComponent(chave.valor)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
      signal: AbortSignal.timeout(PRAZO_MS),
      cache: "no-store",
    },
  );
  const resposta = (await lerResposta(r, "Meta")) as { events_received?: number; fbtrace_id?: string } | null;
  if (!resposta?.events_received) throw new Error("O Meta não confirmou o recebimento do evento.");
  return resposta.fbtrace_id ?? "ok";
}
