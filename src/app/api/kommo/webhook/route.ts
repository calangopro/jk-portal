import { after, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { lerChaves, SUBDOMINIO_KOMMO } from "@/lib/leads/chaves";
import { clienteDaKommo } from "@/lib/kommo/cliente";
import { lerWebhook } from "@/lib/kommo/conta";
import { processarPendentes } from "@/lib/kommo/espelho";
import { processarVendasDaKommo } from "@/lib/kommo/vendas-rodada";
import { segredoConfere, segredoDoWebhook } from "@/lib/kommo/webhook";

/**
 * O aviso da Kommo de que um negócio ou contato mudou (cartão 45).
 *
 * Pública, porque quem chama é a Kommo; protegida pelo segredo no endereço
 * (`?segredo=`), já que a Kommo não assina. O corpo vem em formulário, com
 * chaves como `leads[status][0][id]`, e só é usado para saber QUEM mudou: os
 * ids vão para `kommo_pendentes` e o estado novo é relido pela API, pelo mesmo
 * conversor da rotina. Assim o banco tem um formato só, e um aviso forjado
 * não consegue gravar nada que a Kommo não confirme.
 *
 * Responde na hora e trabalha depois (`after`): a Kommo desliga o webhook que
 * demora ou falha seguidas vezes, e quem cobre o que se perdeu é a rotina de
 * dez em dez minutos.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const db = createAdminClient();
  const recebido = new URL(request.url).searchParams.get("segredo") ?? "";
  if (!segredoConfere(recebido, await segredoDoWebhook(db))) {
    return NextResponse.json({ erro: "segredo inválido" }, { status: 401 });
  }

  const texto = await request.text().catch(() => "");
  if (texto.length > 2_000_000) return NextResponse.json({ erro: "corpo grande demais" }, { status: 413 });
  const aviso = lerWebhook(new URLSearchParams(texto).entries());

  // Aviso de outra conta da Kommo não é nosso.
  if (aviso.conta.subdominio && aviso.conta.subdominio !== SUBDOMINIO_KOMMO) {
    return NextResponse.json({ ok: true, ignorado: "outra conta" });
  }

  after(async () => {
    try {
      const agora = new Date().toISOString();
      const linhas = [
        ...aviso.negocios.map((id) => ({ entidade: "negocio", id, acao: "atualizar", avisado_em: agora })),
        ...aviso.contatos.map((id) => ({ entidade: "contato", id, acao: "atualizar", avisado_em: agora })),
        ...aviso.negociosApagados.map((id) => ({ entidade: "negocio", id, acao: "apagar", avisado_em: agora })),
        ...aviso.contatosApagados.map((id) => ({ entidade: "contato", id, acao: "apagar", avisado_em: agora })),
      ];
      if (linhas.length) {
        const { error } = await db.from("kommo_pendentes").upsert(linhas, { onConflict: "entidade,id" });
        if (error) console.error("[kommo/webhook] pendentes:", error.message);
      }
      const { data: estado } = await db.from("kommo_estado").select("webhooks_recebidos").eq("id", 1).maybeSingle();
      await db
        .from("kommo_estado")
        .update({ ultimo_webhook_em: agora, webhooks_recebidos: Number(estado?.webhooks_recebidos ?? 0) + 1 })
        .eq("id", 1);

      // Com a chave, relê já: é o que deixa o espelho em tempo real.
      const chave = (await lerChaves(db)).kommo;
      if (chave && linhas.length) {
        await processarPendentes(db, clienteDaKommo(chave), agora, 200);
        // A venda ganha (cartão 47) anda junto, num passo que não lança.
        await processarVendasDaKommo(db, { prazoMs: 8_000 });
      }
    } catch (e) {
      // O que falhou fica em kommo_pendentes, e a rotina relê.
      console.error("[kommo/webhook]", e instanceof Error ? e.message : e);
    }
  });

  return NextResponse.json({ ok: true });
}
