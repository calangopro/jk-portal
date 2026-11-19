import "server-only";
import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BASE_PATH } from "@/lib/seo/base-path";
import { avisosDoSistema, lerParaAvisar } from "@/lib/time/chat";
import { avisoDoSuporte, lerSuporteParaAvisar } from "@/lib/suporte/casos";
import {
  aplicarTeto,
  avisoDaKommo,
  cargaDoPush,
  chaveDaKommo,
  chaveDoChat,
  chaveDoSuporte,
  inscricaoMorreu,
  lerCategorias,
  lerNegocios,
  paraOAparelho,
  urlDoChat,
  urlDoSuporte,
  type Aviso,
} from "./push";

/**
 * O envio dos avisos por push (cartão 59). Só no servidor.
 *
 * AS CHAVES VAPID. A pública vai ao navegador na hora de ligar; a privada
 * assina cada envio e NUNCA sai do servidor. Moram em `integration_tokens`
 * (provedor `push_vapid`: `access_token` é a privada, `meta.publica` a
 * pública, `meta.assunto` o contato que os serviços de push pedem), tabela
 * sem policy que só a chave de serviço lê. As variáveis `VAPID_PUBLIC_KEY` e
 * `VAPID_PRIVATE_KEY`, se existirem na Vercel, têm precedência. Trocar as
 * chaves desliga TODOS os aparelhos (a inscrição é presa à chave pública):
 * cada pessoa liga de novo. Passo a passo em `docs/avisos.md`.
 */

type Chaves = { publica: string; privada: string; assunto: string };
let guardadas: { chaves: Chaves; em: number } | null = null;

export async function chavesDoPush(db: SupabaseClient): Promise<Chaves | null> {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (pub && priv) return { publica: pub, privada: priv, assunto: process.env.VAPID_ASSUNTO || "https://www.jkaliancas.com.br/guias" };
  if (guardadas && Date.now() - guardadas.em < 10 * 60_000) return guardadas.chaves;
  const { data } = await db.from("integration_tokens").select("access_token, meta").eq("provider", "push_vapid").maybeSingle();
  const meta = (data?.meta ?? {}) as Record<string, unknown>;
  if (!data?.access_token || typeof meta.publica !== "string") return null;
  const chaves = { publica: meta.publica, privada: data.access_token as string, assunto: typeof meta.assunto === "string" ? meta.assunto : "https://www.jkaliancas.com.br/guias" };
  guardadas = { chaves, em: Date.now() };
  return chaves;
}

type Aparelho = { id: number; endpoint: string; p256dh: string; auth: string; avisar: string[] };

type Resultado = { ok: number; mortos: number; falhas: number };

/** Manda os avisos a um aparelho, um por um. Inscrição morta (404, 410) sai da tabela. */
async function mandar(db: SupabaseClient, chaves: Chaves, ap: Aparelho, avisos: readonly Aviso[], r: Resultado) {
  let erro: string | null = null;
  let entregou = false;
  for (const a of avisos) {
    try {
      await webpush.sendNotification(
        { endpoint: ap.endpoint, keys: { p256dh: ap.p256dh, auth: ap.auth } },
        JSON.stringify(cargaDoPush(a, BASE_PATH)),
        {
          vapidDetails: { subject: chaves.assunto, publicKey: chaves.publica, privateKey: chaves.privada },
          // Aviso que não chegou em 15 minutos (celular sem rede) já não serve: o painel mostra.
          TTL: 15 * 60,
          urgency: "high",
          topic: a.marca.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32),
          timeout: 10_000,
        },
      );
      entregou = true;
      r.ok++;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode ?? 0;
      if (inscricaoMorreu(status)) {
        await db.from("push_aparelhos").delete().eq("id", ap.id);
        r.mortos++;
        return;
      }
      r.falhas++;
      erro = `${status || "rede"}: ${String((e as { body?: string }).body ?? (e as Error).message ?? e).slice(0, 200)}`;
    }
  }
  await db
    .from("push_aparelhos")
    .update(entregou ? { usado_em: new Date().toISOString(), ultimo_erro: erro } : { ultimo_erro: erro })
    .eq("id", ap.id);
}

/**
 * Uma rodada: pergunta ao banco o que está pendente para cada pessoa com
 * aparelho ligado, reserva as chaves (o que outra rodada já reservou não sai
 * de novo), corta no teto do minuto e manda. Quem está com o painel à vista
 * tem os eventos marcados como avisados sem receber push: a tela já mostra.
 */
export async function rodadaDoPush(db: SupabaseClient): Promise<{ pessoas: number; avisos: number; mortos: number; falhas: number; detalhe: string }> {
  const chaves = await chavesDoPush(db);
  if (!chaves) return { pessoas: 0, avisos: 0, mortos: 0, falhas: 0, detalhe: "sem as chaves do push" };
  const { data, error } = await db.rpc("push_pendentes");
  if (error) throw new Error(`push_pendentes: ${error.message}`);
  const pessoas = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
  const r: Resultado = { ok: 0, mortos: 0, falhas: 0 };
  let avisados = 0;

  await Promise.all(
    pessoas.map(async (p) => {
      const pessoa = String(p.pessoa);
      const chat = lerParaAvisar(p.chat);
      const suporte = lerSuporteParaAvisar(p.suporte);
      const kommo = lerNegocios(p.kommo);
      const agora = typeof p.agora === "string" ? p.agora : new Date().toISOString();

      const chavesPropostas = [
        ...chat.mensagens.map((m) => chaveDoChat(m.id)),
        ...suporte.casos.map((c) => chaveDoSuporte(c.id, c.tipo)),
        ...kommo.map(chaveDaKommo),
      ];
      const { data: novas, error: e2 } = await db.rpc("push_reservar", {
        p_pessoa: pessoa,
        p_chaves: chavesPropostas,
        p_chat_ate: chat.agora,
        p_suporte_ate: suporte.agora,
        p_kommo_ate: agora,
      });
      if (e2) throw new Error(`push_reservar: ${e2.message}`);
      const reservadas = new Set(Array.isArray(novas) ? (novas as string[]) : []);
      if (reservadas.size === 0 || p.a_vista === true) return;

      const doChat = chat.mensagens.filter((m) => reservadas.has(chaveDoChat(m.id)));
      const avisos: Aviso[] = [
        ...avisosDoSistema(doChat).map(
          (a): Aviso => ({ categoria: "chat", marca: a.marca, titulo: a.titulo, corpo: a.corpo, url: urlDoChat(a.sala, a.mensagem) }),
        ),
        ...suporte.casos
          .filter((c) => reservadas.has(chaveDoSuporte(c.id, c.tipo)))
          .map((c): Aviso => ({ categoria: "suporte", ...avisoDoSuporte(c), url: urlDoSuporte(c.id) })),
        ...kommo.filter((k) => reservadas.has(chaveDaKommo(k))).map((k) => avisoDaKommo(k, Date.now())),
      ];
      const noTeto = aplicarTeto(avisos, Number(p.no_minuto) || 0);
      if (noTeto.length === 0) return;
      avisados += noTeto.length;
      const aparelhos = (Array.isArray(p.aparelhos) ? p.aparelhos : []) as Aparelho[];
      await Promise.all(
        aparelhos.map((ap) => {
          const deste = paraOAparelho(noTeto, lerCategorias(ap.avisar));
          return deste.length ? mandar(db, chaves, ap, deste, r) : null;
        }),
      );
    }),
  );

  const detalhe = `${pessoas.length} com aparelho, ${avisados} avisos, ${r.ok} entregues${r.mortos ? `, ${r.mortos} aparelhos desligados` : ""}${r.falhas ? `, ${r.falhas} falhas` : ""}`;
  return { pessoas: pessoas.length, avisos: avisados, mortos: r.mortos, falhas: r.falhas, detalhe };
}

/** O aviso de teste, pedido pela própria pessoa na tela. Vai só aos aparelhos dela (ou só a este, com o endereço). */
export async function enviarTeste(db: SupabaseClient, pessoa: string, endpoint: string | null): Promise<Resultado & { aparelhos: number }> {
  const chaves = await chavesDoPush(db);
  const r: Resultado = { ok: 0, mortos: 0, falhas: 0 };
  if (!chaves) return { ...r, aparelhos: 0 };
  let q = db.from("push_aparelhos").select("id, endpoint, p256dh, auth, avisar").eq("pessoa", pessoa);
  if (endpoint) q = q.eq("endpoint", endpoint);
  const { data } = await q;
  const aparelhos = (data ?? []) as Aparelho[];
  const teste: Aviso = {
    categoria: "chat",
    marca: "jk-teste",
    titulo: "Aviso de teste do painel JK",
    corpo: "Chegou! É assim que a mensagem do time, o caso de suporte e o cliente esperando vão aparecer aqui.",
    url: "/admin/chat",
  };
  await Promise.all(aparelhos.map((ap) => mandar(db, chaves, ap, [teste], r)));
  return { ...r, aparelhos: aparelhos.length };
}
