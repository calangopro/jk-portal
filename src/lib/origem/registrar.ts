import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { LOJAS } from "@/lib/tray/lojas";
import { canalDaOrigem } from "@/lib/vendas/origem";
import {
  COOKIE_DO_ANUNCIO,
  DIAS_DO_ANUNCIO,
  anuncioDeAntes,
  anuncioParaCookie,
  chegouPelaBio,
  comOAnuncioDeAntes,
  ehCliqueDeAnuncio,
  ehRobo,
  lerChegada,
  pedidoValido,
  repeteAAnterior,
  sessaoValida,
  type Chegada,
} from "./chegada";

/**
 * O lado do servidor do coletor de origem: confere quem está mandando, anota a
 * chegada, liga a sessão da Tray e o pedido ao visitante.
 *
 * O VISITANTE é um número aleatório guardado no cookie `jk_v`, gravado pela
 * RESPOSTA desta rota. Cookie gravado pelo servidor do próprio domínio dura o
 * prazo que a gente pede; o gravado por script, no iPhone, cai em sete dias (e
 * em um dia quando o endereço traz `fbclid` ou `gclid`), que é justamente o
 * caso de quem chega de anúncio. O cookie não carrega dado nenhum além do
 * número, e nada aqui guarda nome, telefone ou e-mail. IP, navegador e os
 * cookies do pixel do Meta só são guardados na página de confirmação do pedido
 * e só com o envio ao Meta ligado (`guardarSinais`, 0120), e somem em 30 dias.
 */

export const COOKIE_DO_VISITANTE = "jk_v";
/** Noventa dias, renovados a cada visita. A atribuição olha trinta. */
export const VIDA_DO_COOKIE = 90 * 24 * 60 * 60;

/**
 * O último anúncio em que o visitante clicou, resumido (`anuncioParaCookie`).
 * Ao contrário do `jk_v`, este o navegador LÊ: é por ele que a página da bio
 * conta ao GA4 que a visita é de quem veio de anúncio (`OrigemDaBio`). Só leva
 * as UTMs do anúncio, que já estavam no endereço da página. O que vai para o
 * banco não depende dele: ali quem decide é o histórico do visitante.
 */
export { COOKIE_DO_ANUNCIO };
/** A mesma janela em que a chegada pela bio ainda é do anúncio. */
export const VIDA_DO_ANUNCIO = DIAS_DO_ANUNCIO * 24 * 60 * 60;

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

/** A chegada que o recado descreve. Conta pura: não toca no banco. */
export function chegadaDoRecado(recado: Recado, agente: string | null): Chegada | null {
  return typeof recado.u === "string"
    ? lerChegada({ url: recado.u.slice(0, 2000), referencia: typeof recado.r === "string" ? recado.r.slice(0, 600) : null, agente, daCasa, canalDaEtiqueta: canalDaOrigem })
    : null;
}

/** O valor do cookie do anúncio, quando o recado é de um clique em anúncio. `null` em qualquer outro caso. */
export function anuncioDoRecado(recado: Recado, agente: string | null): string | null {
  if (ehRobo(agente)) return null;
  const chegada = chegadaDoRecado(recado, agente);
  return chegada && ehCliqueDeAnuncio(chegada) ? anuncioParaCookie(chegada) || null : null;
}

/** O que só o navegador sabe e o Meta usa para casar a compra com quem viu o anúncio (0120). */
export type SinaisDoRecado = { fbp?: string | null; fbc?: string | null; ip?: string | null };

const COOKIE_DO_PIXEL = /^fb\.\d\.\d{10,13}\.[A-Za-z0-9_-]{1,500}$/;

/** Cookie do pixel com cara de cookie do pixel; o resto vira nulo. */
export function cookieDoPixel(valor: string | undefined | null): string | null {
  return valor && valor.length <= 600 && COOKIE_DO_PIXEL.test(valor) ? valor : null;
}

/**
 * Guarda os sinais do navegador junto do número do pedido, para o servidor
 * mandar a compra ao Meta (`lib/meta/loja.ts`). Só na página de confirmação
 * (é quando o recado traz o pedido) e só com o envio ao Meta em teste ou
 * ligado: desligado, o coletor continua sem guardar navegador nem IP.
 */
async function guardarSinais(db: SupabaseClient, pedido: number, agente: string | null, sinais: SinaisDoRecado): Promise<void> {
  const { data: config } = await db.from("meta_loja_config").select("modo").eq("id", true).maybeSingle();
  if (!config || config.modo === "desligado") return;
  const linha = {
    pedido,
    fbp: cookieDoPixel(sinais.fbp),
    fbc: cookieDoPixel(sinais.fbc),
    navegador: agente ? agente.slice(0, 500) : null,
    ip: sinais.ip ? sinais.ip.slice(0, 64) : null,
  };
  const { error } = await db.from("meta_sinais").upsert(linha, { onConflict: "pedido", ignoreDuplicates: true });
  if (error) console.error("[origem] sinais do pedido não gravados:", error.message);
}

/**
 * Grava o que o recado do navegador traz. Nunca lança: o coletor não pode
 * derrubar página de ninguém, e um recado perdido é só uma chegada a menos.
 */
export async function registrarRecado(db: SupabaseClient, visitante: string, recado: Recado, agente: string | null, sinais: SinaisDoRecado = {}): Promise<void> {
  try {
    if (ehRobo(agente)) return;
    const sessao = sessaoValida(recado.s);
    const pedido = pedidoValido(recado.p);
    let chegada = chegadaDoRecado(recado, agente);

    // Anota a chegada com etiqueta ou vinda de fora sempre; o acesso direto, só na primeira página da visita.
    if (chegada && (chegada.nova || recado.n === 1)) {
      // O link da bio chega igual para todo mundo. Para saber se quem chegou veio de anúncio, olha-se o que o
      // mesmo visitante fez antes: por isso a chegada pela bio lê mais do que a última linha.
      const procuraAnuncio = chegouPelaBio(chegada) && !ehCliqueDeAnuncio(chegada);
      const { data: ultimas } = await db
        .from("origem_toques")
        .select("canal, source, medium, campaign, content, term, ids, clique, clique_id, em")
        .eq("visitante", visitante)
        .order("em", { ascending: false })
        .limit(procuraAnuncio ? 40 : 1);
      const agora = Date.now();
      const lista = (ultimas ?? []).map((t) => ({ ...t, haDias: (agora - new Date(t.em).getTime()) / 86_400_000 }));
      if (procuraAnuncio) {
        const anuncio = anuncioDeAntes(lista);
        // Daqui para baixo a chegada já é a do anúncio com a marca da bio, inclusive para conferir se repete a anterior.
        if (anuncio) chegada = comOAnuncioDeAntes(chegada, anuncio);
      }
      const anterior = lista[0] ?? null;
      const repete = repeteAAnterior(
        chegada,
        anterior ? { canal: anterior.canal, campaign: anterior.campaign, content: anterior.content, clique_id: anterior.clique_id, haMinutos: anterior.haDias * 1440 } : null,
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
      await guardarSinais(db, pedido, agente, sinais);
    }
  } catch (e) {
    console.error("[origem] recado perdido:", e instanceof Error ? e.message : e);
  }
}
