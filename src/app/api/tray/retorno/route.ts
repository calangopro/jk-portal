import { NextResponse, type NextRequest } from "next/server";
import { comBasePath } from "@/lib/seo/base-path";
import { createAdminClient } from "@/lib/supabase/admin";
import { trocarCodigoDaTray } from "@/lib/tray/cliente";
import { COOKIE_DA_TRAY, chavesDoAplicativo, enderecoDoRetorno, lojaDoRetorno } from "@/lib/tray/lojas";

/**
 * Retorno da autorização do aplicativo na Tray.
 *
 * Quando o dono da loja autoriza o aplicativo, a Tray manda o navegador dele
 * para cá com `code`, `api_address` e `store`. A rota troca o código pelo
 * primeiro token e, SÓ SE a Tray aceitar, grava a loja como autorizada.
 *
 * São três travas, nesta ordem, e nenhuma grava nada antes de passar:
 *   1. o cookie deixado por `/api/tray/conectar`: só completa a autorização o
 *      navegador que a começou por lá (e lá, em produção, é só administrador);
 *   2. a lista fechada de lojas de `lib/tray/lojas`: o número e o domínio têm
 *      de ser de uma loja nossa, e a mesma que o cookie diz;
 *   3. a própria Tray: o código precisa valer para aquela loja com as chaves do
 *      nosso aplicativo.
 * A ordem importa. A primeira versão gravava o código e depois testava, e um
 * pedido forjado apagava o token bom da loja antes de ser recusado.
 *
 * O código vem no endereço. A resposta redireciona para o mesmo caminho sem
 * parâmetro nenhum, para ele não ficar na barra, no histórico nem em print.
 */

export const dynamic = "force-dynamic";

const html = (titulo: string, texto: string, status = 200) =>
  new NextResponse(
    `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="robots" content="noindex"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${titulo}</title>` +
      `<body style="font-family:system-ui;max-width:34rem;margin:4rem auto;padding:0 1.5rem;line-height:1.5"><h1 style="font-size:1.3rem">${titulo}</h1><p>${texto}</p><p><a href="${comBasePath("/admin/integracoes")}">Voltar para Integrações</a></p></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );

const RESULTADOS: Record<string, [string, string, number]> = {
  ok: ["Loja autorizada", "O painel já consegue ler os pedidos desta loja pela API da Tray. Pode fechar esta aba.", 200],
  expirou: ["A autorização expirou", "Ela precisa começar pelo painel e terminar em até dez minutos, no mesmo navegador. Comece de novo.", 400],
  recusada: ["Loja fora da lista", "O painel só aceita autorização das lojas da JK.", 400],
  erro: ["A autorização não foi concluída", "A Tray devolveu a autorização, mas o painel não conseguiu usá-la. O motivo está no registro do servidor.", 502],
};

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const resultado = q.get("resultado");
  if (resultado) return html(...(RESULTADOS[resultado] ?? RESULTADOS.erro));

  const code = q.get("code") ?? "";
  const store = q.get("store") ?? "";
  const apiAddress = q.get("api_address") ?? "";
  if (!code || !store || !apiAddress) {
    return html("Faltou a autorização", "Esta página só funciona quando a Tray manda a loja de volta para cá depois de autorizar o aplicativo.", 400);
  }

  const destino = (valor: keyof typeof RESULTADOS) => {
    const r = NextResponse.redirect(`${enderecoDoRetorno(request.nextUrl.origin)}?resultado=${valor}`, 303);
    r.cookies.delete({ name: COOKIE_DA_TRAY, path: comBasePath("/api/tray") });
    return r;
  };

  const iniciada = request.cookies.get(COOKIE_DA_TRAY)?.value.split(".")[0];
  if (!iniciada) return destino("expirou");

  const db = createAdminClient();
  const loja = lojaDoRetorno(store, apiAddress);
  const chaves = await chavesDoAplicativo(db);
  if (!loja || loja.chave !== iniciada || !chaves) {
    console.error("[tray] retorno recusado:", !chaves ? "faltam as chaves do aplicativo" : `loja ${store} não é a que começou a autorização`);
    return destino("recusada");
  }

  const url = apiAddress.replace(/\/+$/, "");
  let token;
  try {
    token = await trocarCodigoDaTray({ url, key: chaves.key, secret: chaves.secret, code });
  } catch (e) {
    console.error("[tray] a loja não aceitou o código:", e instanceof Error ? e.message : e);
    return destino("erro");
  }

  // O número da loja no endereço é só uma afirmação. O da resposta é a Tray
  // dizendo de quem é o token, e é esse que precisa ser o da loja esperada.
  if (token.loja !== loja.id) {
    console.error(`[tray] o token é da loja ${token.loja ?? "(não informada)"}, e a autorização era da ${loja.id}`);
    return destino("recusada");
  }

  const { error } = await db
    .from("integration_tokens")
    .upsert(
      {
        provider: loja.provedor,
        access_token: token.access_token,
        refresh_token: token.refresh_token ?? null,
        expires_at: token.expira_em,
        meta: { api_address: url, code, store, autorizada_em: new Date().toISOString() },
      },
      { onConflict: "provider" },
    );
  if (error) {
    console.error("[tray] autorização não gravada:", error.message);
    return destino("erro");
  }
  return destino("ok");
}
