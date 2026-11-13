import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { LOJAS } from "@/lib/tray/lojas";
import { canalDaOrigem } from "@/lib/vendas/origem";
import { ehRobo, lerChegada, pedidoValido, repeteAAnterior, sessaoValida } from "./chegada";

/**
 * O lado do servidor do coletor de origem: confere quem está mandando, anota a
 * chegada, liga a sessão da Tray e o pedido ao visitante.
 *
 * O VISITANTE é um número aleatório guardado no cookie `jk_v`, gravado pela
 * RESPOSTA desta rota. Cookie gravado pelo servidor do próprio domínio dura o
 * prazo que a gente pede; o gravado por script, no iPhone, cai em sete dias (e
 * em um dia quando o endereço traz `fbclid` ou `gclid`), que é justamente o
 * caso de quem chega de anúncio. O cookie não carrega dado nenhum além do
 * número, e nada aqui guarda IP, navegador, nome, telefone ou e-mail.
 */

export const COOKIE_DO_VISITANTE = "jk_v";
/** Noventa dias, renovados a cada visita. A atribuição olha trinta. */
export const VIDA_DO_COOKIE = 90 * 24 * 60 * 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DOMINIO = "jkaliancas.com.br";

const semWww = (h: string) => h.toLowerCase().replace(/^www\./, "").replace(/:\d+$/, "");

/** Domínios nossos: a loja e o portal. Fora de produção, também o computador de quem desenvolve e a loja de testes. */
export function daCasa(host: string): boolean {
  const h = semWww(host);
  if (h === DOMINIO || h.endsWith(`.${DOMINIO}`)) return true;
  if (process.env.NODE_ENV === "production") return false;
  return h === "localhost" || h === "127.0.0.1" || LOJAS.some((l) => l.chave === "teste" && semWww(l.host) === h);
}

/** O número do visitante que veio no cookie, se for mesmo um dos nossos. */
export function visitanteDoCookie(valor: string | undefined): string | null {
  return valor && UUID.test(valor) ? valor.toLowerCase() : null;
}

/**
 * O atributo `Domain` do cookie: o domínio inteiro em produção, para valer com
 * e sem `www` (a bio é divulgada sem). Não dá para decidir pelo host do pedido:
 * atrás do Worker a Vercel recebe o host dela mesma e sobrescreve o
 * `x-forwarded-host` (ver `lib/conector/base.ts`).
 */
export function dominioDoCookie(): string | undefined {
  return process.env.VERCEL_ENV === "production" ? DOMINIO : undefined;
}

export type Recado = { u?: unknown; r?: unknown; s?: unknown; p?: unknown; n?: unknown };

/**
 * Grava o que o recado do navegador traz. Nunca lança: o coletor não pode
 * derrubar página de ninguém, e um recado perdido é só uma chegada a menos.
 */
export async function registrarRecado(db: SupabaseClient, visitante: string, recado: Recado, agente: string | null): Promise<void> {
  try {
    if (ehRobo(agente)) return;
    const sessao = sessaoValida(recado.s);
    const pedido = pedidoValido(recado.p);
    const chegada =
      typeof recado.u === "string"
        ? lerChegada({ url: recado.u.slice(0, 2000), referencia: typeof recado.r === "string" ? recado.r.slice(0, 600) : null, agente, daCasa, canalDaEtiqueta: canalDaOrigem })
        : null;

    // Anota a chegada com etiqueta ou vinda de fora sempre; o acesso direto, só na primeira página da visita.
    if (chegada && (chegada.nova || recado.n === 1)) {
      const { data: anterior } = await db
        .from("origem_toques")
        .select("canal, campaign, content, clique_id, em")
        .eq("visitante", visitante)
        .order("em", { ascending: false })
        .limit(1)
        .maybeSingle();
      const repete = repeteAAnterior(
        chegada,
        anterior ? { canal: anterior.canal, campaign: anterior.campaign, content: anterior.content, clique_id: anterior.clique_id, haMinutos: (Date.now() - new Date(anterior.em).getTime()) / 60_000 } : null,
      );
      if (!repete) {
        const { nova: _nova, ...linha } = chegada;
        const { error } = await db.from("origem_toques").insert({ ...linha, visitante, sessao });
        if (error) console.error("[origem] chegada não gravada:", error.message);
      }
    }

    // A primeira ligação vale: uma sessão é de um visitante só, e um pedido também.
    if (sessao) {
      const { error } = await db.from("origem_sessoes").upsert({ sessao, visitante }, { onConflict: "sessao", ignoreDuplicates: true });
      if (error) console.error("[origem] sessão não gravada:", error.message);
    }
    if (pedido) {
      const { error } = await db.from("origem_pedidos").upsert({ pedido, visitante, sessao }, { onConflict: "pedido", ignoreDuplicates: true });
      if (error) console.error("[origem] pedido não gravado:", error.message);
    }
  } catch (e) {
    console.error("[origem] recado perdido:", e instanceof Error ? e.message : e);
  }
}
