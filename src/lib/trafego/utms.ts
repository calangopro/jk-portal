/**
 * O padrão de UTM da JK, num lugar só (cartão 69, 20/11/2026).
 *
 * A tela "Links e UTMs" (`/admin/trafego/utms`) mostra estas linhas para
 * copiar, e o teste confere que cada uma cai no canal certo pela MESMA regra
 * que lê a chegada (`canalDaOrigem` e `MIDIA_PAGA`). Mudou a regra de lá e o
 * padrão daqui deixou de casar: o teste quebra.
 *
 * Por que nome E número em campanha, conjunto e anúncio: a conta de origem
 * (`origem_resolvida`, 0112) liga a venda ao anúncio pelo número quando ele
 * vem e pelo nome quando não vem. Com os dois, a ligação não depende de
 * ninguém renomear nada, e o GA4 continua mostrando um nome legível.
 *
 * Arquivo puro, sem `@/`: roda no teste `npm run verificar:pedidos`.
 */
import { MIDIA_PAGA } from "../origem/chegada.ts";
import { canalDaOrigem, type Canal } from "../vendas/origem.ts";

export type PadraoDeAnuncio = {
  plataforma: string;
  onde: string;
  valor: string;
  nota: string;
};

/**
 * Meta: vai em "Parâmetros de URL", no nível do ANÚNCIO. `{{site_source_name}}`
 * vira `ig`, `fb`, `msg` ou `an`, o que separa Instagram de Facebook sem
 * campanha duplicada.
 */
export const PARAMETROS_DO_META =
  "utm_source={{site_source_name}}&utm_medium=paid&utm_campaign={{campaign.name}}|{{campaign.id}}&utm_term={{adset.name}}|{{adset.id}}&utm_content={{ad.name}}|{{ad.id}}&utm_id={{campaign.id}}";

/**
 * Google Ads: vai em "Sufixo do URL final", no nível da CONTA (vale para toda
 * campanha). A marcação automática (gclid) continua ligada: é ela que a
 * compra paga e a retirada dos cancelados usam. O Google não tem macro de nome
 * de campanha, então vai o número, que a conta de origem liga sozinha.
 */
export const SUFIXO_DO_GOOGLE =
  "utm_source=google&utm_medium=cpc&utm_campaign={campaignid}&utm_term={keyword}&utm_content={creative}&utm_id={campaignid}";

export const PADROES: PadraoDeAnuncio[] = [
  {
    plataforma: "Meta (Instagram e Facebook)",
    onde: "No anúncio: Rastreamento, Parâmetros de URL. Em anúncio duplicado ele vem junto; em anúncio novo, cole de novo.",
    valor: PARAMETROS_DO_META,
    nota: "Também vale para anúncio que leva para o link da bio: o site guarda o anúncio e marca a chegada da bio.",
  },
  {
    plataforma: "Google Ads",
    onde: "Administrador, Configurações da conta, Opções de URL de rastreamento, Sufixo do URL final. Uma vez só, vale para a conta toda.",
    valor: SUFIXO_DO_GOOGLE,
    nota: "Não desligue a marcação automática (gclid): a compra paga e a retirada dos cancelados dependem dela.",
  },
];

// ------------------------------------------------------------------ link sem anúncio

export type Atalho = {
  id: string;
  nome: string;
  source: string;
  medium: string;
  /** O canal em que a conta de origem põe esse link. */
  canal: Canal;
  dica: string;
};

/** Os links sem anúncio que mais aparecem. Nenhum usa mídia paga, de propósito. */
export const ATALHOS: Atalho[] = [
  { id: "grupo", nome: "Grupo de ofertas", source: "whatsapp", medium: "grupo", canal: "whatsapp", dica: "A oferta do dia no grupo do WhatsApp." },
  { id: "vendedor", nome: "Vendedor no WhatsApp", source: "whatsapp", medium: "vendedor", canal: "whatsapp", dica: "Link que o vendedor manda na conversa." },
  { id: "status", nome: "Status do WhatsApp", source: "whatsapp", medium: "status", canal: "whatsapp", dica: "Story do WhatsApp da loja." },
  { id: "influenciador", nome: "Influenciador", source: "instagram", medium: "influenciador", canal: "meta", dica: "Em Campanha, o @ de quem divulgou." },
  { id: "email", nome: "E-mail", source: "email", medium: "email", canal: "email", dica: "Disparo de e-mail." },
  { id: "pinterest", nome: "Pinterest orgânico", source: "pinterest", medium: "social", canal: "pinterest", dica: "Pin sem anúncio." },
];

/** Minúsculas, sem acento, espaço vira sublinhado e só sobra letra, número, `_` e `-`. */
export function etiqueta(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/@/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_-]/g, "")
    .replace(/_+/g, "_")
    .replace(/^[_-]+|[_-]+$/g, "")
    .slice(0, 80);
}

export type CamposDoLink = { destino: string; source: string; medium: string; campaign: string; content?: string };
export type LinkMontado = { url: string | null; avisos: string[]; canal: Canal | null };

const DOMINIO_DA_LOJA = /(^|\.)jkaliancas\.com\.br$/i;

/**
 * Monta o link etiquetado. Troca UTM que já estava no endereço (nunca soma
 * duas), preserva o resto da busca e avisa do que estragaria a conta.
 */
export function montarLink(c: CamposDoLink): LinkMontado {
  const avisos: string[] = [];
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(c.destino.trim()) ? c.destino.trim() : `https://${c.destino.trim()}`);
  } catch {
    return { url: null, avisos: ["Esse destino não é um endereço válido."], canal: null };
  }
  if (!DOMINIO_DA_LOJA.test(url.hostname)) {
    avisos.push("O destino não é da JK: o coletor só anota chegada em jkaliancas.com.br.");
  }
  const source = etiqueta(c.source);
  const medium = etiqueta(c.medium);
  const campaign = etiqueta(c.campaign);
  const content = c.content ? etiqueta(c.content) : "";
  if (!source || !medium) return { url: null, avisos: [...avisos, "Origem e meio são obrigatórios."], canal: null };
  if (!campaign) return { url: null, avisos: [...avisos, "Dê um nome à campanha (ex.: black_2026)."], canal: null };
  if (MIDIA_PAGA.test(medium)) {
    avisos.push(`O meio "${medium}" conta como ANÚNCIO na origem dos pedidos. Para link sem anúncio, use outro nome.`);
  }

  for (const k of [...url.searchParams.keys()]) if (/^utm_/i.test(k)) url.searchParams.delete(k);
  url.searchParams.set("utm_source", source);
  url.searchParams.set("utm_medium", medium);
  url.searchParams.set("utm_campaign", campaign);
  if (content) url.searchParams.set("utm_content", content);
  return { url: url.toString(), avisos, canal: canalDaOrigem(source) };
}
