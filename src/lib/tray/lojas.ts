import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { comBasePath } from "@/lib/seo/base-path";
import { absoluteUrl } from "@/lib/seo/site";
import { TrayCliente } from "./cliente";

/**
 * As lojas da Tray com que o aplicativo "Relatórios de pedidos e vitrine" fala.
 *
 * O MESMO aplicativo (mesma consumer key e mesmo consumer secret) é instalado
 * em cada loja. O que muda por loja é o endereço da API e o `code` da
 * instalação, que a Tray entrega no retorno da autorização e ficam em
 * `integration_tokens.meta`, cada loja na sua linha.
 *
 * A LISTA É FECHADA, e é ela que protege o retorno da autorização: a rota é
 * pública (quem chega nela é o navegador de quem autorizou), então sem a lista
 * qualquer um poderia mandar o código de OUTRA loja e fazer o painel passar a
 * ler pedido alheio como se fosse da JK. Só entra loja com o número e o
 * domínio daqui, e a loja de testes só fora de produção.
 */

export type Loja = { chave: "jk" | "teste"; id: string; host: string; provedor: string; nome: string };

/** `host` é o endereço do PAINEL da loja, onde fica a tela de autorizar o aplicativo. */
export const LOJAS: Loja[] = [
  { chave: "jk", id: "1305187", host: "www.jkaliancas.com.br", provedor: "tray_loja", nome: "JK Alianças" },
  { chave: "teste", id: "1501140", host: "lojatesteintegracaotray01.corpsuite.com.br", provedor: "tray_teste", nome: "Loja de testes da Tray" },
];

/**
 * Onde a API de uma loja pode morar. A Tray não serve a API no domínio da
 * loja: a de testes autoriza em `lojatesteintegracaotray01.corpsuite.com.br` e
 * responde a API em `mcadl04b.commercesuite.com.br`. O endereço vem no retorno
 * da autorização, e é para ele que o painel manda o segredo do aplicativo, por
 * isso só vale domínio que é da própria Tray ou o da loja.
 */
const DOMINIOS_DA_TRAY = [".commercesuite.com.br", ".corpsuite.com.br"];
const hostDaApiVale = (host: string, loja: Loja) =>
  host === loja.host || host === loja.host.replace(/^www\./, "") || DOMINIOS_DA_TRAY.some((d) => host.endsWith(d));

/** Cookie que liga o começo da autorização (`/api/tray/conectar`) ao retorno dela. */
export const COOKIE_DA_TRAY = "jk_tray_loja";

const emProducao = () => process.env.NODE_ENV === "production";

/** Onde as chaves do aplicativo ficam quando não estão em variável de ambiente. */
export const PROVEDOR_DO_APLICATIVO = "tray_aplicativo";

/**
 * As chaves do aplicativo (as mesmas para toda loja em que ele é instalado).
 * Três lugares, nesta ordem:
 *   1. `TRAY_CONSUMER_KEY` e `TRAY_CONSUMER_SECRET` no servidor;
 *   2. `integration_tokens`, provedor `tray_aplicativo` (a chave em
 *      `meta.consumer_key`, o segredo em `access_token`), que é onde elas
 *      ficam em produção, porque o projeto da Vercel está fora do nosso alcance;
 *   3. só fora de produção, as `TRAY_TESTE_*` do `.env.local`, que têm esse
 *      nome para o cliente do catálogo não começar a ler a loja de testes.
 */
export async function chavesDoAplicativo(db: SupabaseClient): Promise<{ key: string; secret: string } | null> {
  const doServidor = { key: process.env.TRAY_CONSUMER_KEY, secret: process.env.TRAY_CONSUMER_SECRET };
  if (doServidor.key && doServidor.secret) return { key: doServidor.key, secret: doServidor.secret };

  const { data } = await db.from("integration_tokens").select("access_token, meta").eq("provider", PROVEDOR_DO_APLICATIVO).maybeSingle();
  const key = (data?.meta as { consumer_key?: string } | null)?.consumer_key;
  if (key && data?.access_token) return { key, secret: data.access_token as string };

  if (emProducao()) return null;
  const teste = { key: process.env.TRAY_TESTE_CONSUMER_KEY, secret: process.env.TRAY_TESTE_CONSUMER_SECRET };
  return teste.key && teste.secret ? { key: teste.key, secret: teste.secret } : null;
}

/**
 * A loja que bate com o que veio no retorno da autorização. `null` para
 * qualquer outra. O número da loja aqui ainda é só o que o endereço DIZ: quem
 * confirma é a resposta da Tray na troca do código (`store_id`), conferida no
 * retorno.
 */
export function lojaDoRetorno(store: string, apiAddress: string): Loja | null {
  let host = "";
  try {
    const u = new URL(apiAddress);
    if (u.protocol !== "https:" || !/^\/web_api\/?$/.test(u.pathname)) return null;
    host = u.host.toLowerCase();
  } catch {
    return null;
  }
  const loja = LOJAS.find((l) => l.id === store);
  if (!loja || !hostDaApiVale(host, loja) || (loja.chave === "teste" && emProducao())) return null;
  return loja;
}

/** O cliente de uma loja já autorizada. `null` quando ela não foi instalada ou faltam as chaves do aplicativo. */
export async function clienteDaLoja(db: SupabaseClient, chave: Loja["chave"]): Promise<TrayCliente | null> {
  const loja = LOJAS.find((l) => l.chave === chave);
  if (!loja || (loja.chave === "teste" && emProducao())) return null;
  const chaves = await chavesDoAplicativo(db);
  if (!chaves) return null;
  const { data } = await db.from("integration_tokens").select("meta").eq("provider", loja.provedor).maybeSingle();
  const meta = (data?.meta ?? {}) as { api_address?: string; code?: string };
  if (!meta.api_address || !meta.code) return null;
  return new TrayCliente({ url: meta.api_address, key: chaves.key, secret: chaves.secret, code: meta.code, provedor: loja.provedor });
}

/**
 * O endereço público do retorno da autorização. Em produção é sempre o do
 * domínio da JK: a Vercel recebe o pedido com o host dela mesma, então o
 * endereço da requisição apontaria para `jk-portal.vercel.app`. E é escrito
 * por extenso porque `nextUrl` dentro de rota chega SEM o `/guias`.
 */
export function enderecoDoRetorno(origemDaRequisicao: string): string {
  return process.env.VERCEL_ENV === "production"
    ? absoluteUrl("/api/tray/retorno")
    : new URL(comBasePath("/api/tray/retorno"), origemDaRequisicao).toString();
}
