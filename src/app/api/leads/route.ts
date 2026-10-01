import { NextResponse, after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { repassarLead } from "@/lib/leads/repassar";
import { EMAIL_VALIDO, comPais, soDigitos, telefoneValido } from "@/lib/leads/telefone";
import { esquemaDoEnvio, type Lead } from "@/lib/leads/tipos";

/**
 * Recebe o formulário do grupo de ofertas (folha da bio e página /grupo).
 *
 * Grava primeiro e repassa depois. A pessoa recebe a resposta assim que o
 * contato está no banco, e só então o portal fala com Kommo, RD, webhook e
 * Meta (em `after`, que a Vercel deixa rodar depois da resposta). Um destino
 * lento ou fora do ar nunca segura quem está esperando para entrar no grupo,
 * e o relógio de dez minutos tenta de novo o que falhar.
 *
 * É rota comum, e não Server Action, de propósito: a página é servida pelo
 * Worker da Cloudflare em outro endereço (/bio, /grupo), e a trava de origem
 * das Server Actions já derrubou o login do painel atrás desse proxy.
 */

export const dynamic = "force-dynamic";

const recusa = (erro: string, status = 400) => NextResponse.json({ ok: false, erro }, { status });

/** IP de quem preencheu. O Worker manda o original em `x-jk-ip-cliente`, porque a Vercel só vê a Cloudflare. */
function ipDoCliente(request: Request): string | null {
  const h = request.headers;
  const bruto =
    h.get("x-jk-ip-cliente") || h.get("x-real-ip") || h.get("x-forwarded-for")?.split(",")[0] || "";
  const ip = bruto.trim().slice(0, 64);
  return /^[0-9a-fA-F.:]+$/.test(ip) ? ip : null;
}

export async function POST(request: Request) {
  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return recusa("corpo inválido");
  }

  const lido = esquemaDoEnvio.safeParse(corpo);
  if (!lido.success) return recusa("dados inválidos");
  const e = lido.data;

  // Robô preencheu a isca: responde como se tivesse dado certo e não grava.
  if (e.empresa) return NextResponse.json({ ok: true, id: null });

  const local = soDigitos(e.whatsapp);
  if (!telefoneValido(local)) return recusa("whatsapp inválido");
  if (e.email && !EMAIL_VALIDO.test(e.email)) return recusa("e-mail inválido");

  const supabase = createAdminClient();

  // O mesmo envio repetido (duplo toque, conexão que caiu e voltou) devolve o
  // contato que já existe, sem gravar nem repassar de novo.
  const { data: repetido } = await supabase.from("leads").select("id").eq("event_id", e.event_id).maybeSingle();
  if (repetido) return NextResponse.json({ ok: true, id: repetido.id });

  const ip = ipDoCliente(request);
  if (ip) {
    const desde = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("ip", ip)
      .gte("criado_em", desde);
    if ((count ?? 0) >= 8) return recusa("muitos envios", 429);
  }

  // O `_fbc` só existe se o pixel carregou. Sem ele, o clique do anúncio ainda
  // está no `fbclid` da URL, e o formato do cookie é público.
  const fbc = e.fbc || (e.fbclid ? `fb.1.${Date.now()}.${e.fbclid}` : "");

  const linha = {
    origem: e.origem,
    campanha: e.campanha,
    nome: e.nome,
    whatsapp: comPais(local),
    email: e.email ? e.email.toLowerCase() : null,
    momento: e.momento || null,
    pagina: e.pagina || null,
    referencia: e.referencia || null,
    rede: e.rede || null,
    utm_source: e.utm_source || null,
    utm_medium: e.utm_medium || null,
    utm_campaign: e.utm_campaign || null,
    utm_content: e.utm_content || null,
    utm_term: e.utm_term || null,
    gclid: e.gclid || null,
    fbclid: e.fbclid || null,
    fbc: fbc || null,
    fbp: e.fbp || null,
    ip,
    user_agent: request.headers.get("user-agent")?.slice(0, 400) ?? null,
    aceite_texto: e.aceite_texto,
    aceite_em: new Date(e.aceite_em).toISOString(),
    event_id: e.event_id,
    // Pendente até o primeiro repasse terminar. Se a função morrer antes, o
    // relógio pega o contato e nada se perde.
    envio_pendente: true,
  };

  const { data: gravado, error } = await supabase.from("leads").insert(linha).select("*").single();
  if (error || !gravado) {
    // Corrida com um envio igual que chegou junto: o outro gravou.
    if (error?.code === "23505") {
      const { data } = await supabase.from("leads").select("id").eq("event_id", e.event_id).maybeSingle();
      if (data) return NextResponse.json({ ok: true, id: data.id });
    }
    return recusa("não gravou", 500);
  }

  after(async () => {
    try {
      await repassarLead(supabase, gravado as Lead);
    } catch {
      // Fica `envio_pendente`, e o relógio tenta de novo.
    }
  });

  return NextResponse.json({ ok: true, id: gravado.id });
}
