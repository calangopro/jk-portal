import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Aviso de que alguém entrou no grupo, mandado pela ferramenta do grupo
 * (DevZapp ou outra) por webhook.
 *
 * É o que fecha a conta "teve interesse e não entrou": o site enxerga até o
 * clique no link do grupo, e a entrada de verdade só a ferramenta do grupo
 * sabe. Com o aviso, o contato ganha `entrou_grupo_em`.
 *
 * O formato do aviso varia de ferramenta para ferramenta e só se conhece
 * depois do primeiro. Por isso o corpo inteiro fica guardado em
 * `grupo_entradas`, e o telefone é procurado em qualquer campo: o primeiro
 * valor com cara de celular brasileiro. Se o casamento falhar, o aviso continua
 * lá para ajustar a leitura depois.
 *
 * O segredo vai na URL (`?segredo=`), porque a maioria dessas ferramentas não
 * deixa escolher cabeçalho. Ele mora em `integration_tokens`, provedor
 * `grupo_entrada`, e o endereço completo aparece no painel do grupo.
 */

export const dynamic = "force-dynamic";

function confere(recebido: string, esperado: string): boolean {
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Todos os textos e números do corpo, em qualquer profundidade. */
function valores(v: unknown, saida: string[] = []): string[] {
  if (typeof v === "string" || typeof v === "number") saida.push(String(v));
  else if (Array.isArray(v)) v.forEach((x) => valores(x, saida));
  else if (v && typeof v === "object") Object.values(v).forEach((x) => valores(x, saida));
  return saida;
}

/** Primeiro valor que é celular brasileiro, já no formato `55DDDNUMERO`. */
function telefoneDoCorpo(corpo: unknown): string | null {
  for (const bruto of valores(corpo)) {
    // `5511999999999@c.us` é como várias APIs de WhatsApp escrevem o número.
    let d = bruto.split("@")[0].replace(/\D/g, "");
    if (d.length === 10 || d.length === 11) d = `55${d}`;
    if (/^55[1-9][0-9]{9,10}$/.test(d)) return d;
  }
  return null;
}

async function lerCorpo(request: Request): Promise<unknown> {
  const tipo = request.headers.get("content-type") ?? "";
  const texto = await request.text();
  if (tipo.includes("application/x-www-form-urlencoded")) return Object.fromEntries(new URLSearchParams(texto));
  try {
    return JSON.parse(texto);
  } catch {
    return { texto: texto.slice(0, 4000) };
  }
}

export async function POST(request: Request) {
  const supabase = createAdminClient();
  const recebido = new URL(request.url).searchParams.get("segredo") ?? "";
  const { data: chave } = await supabase
    .from("integration_tokens")
    .select("access_token")
    .eq("provider", "grupo_entrada")
    .maybeSingle();
  const esperado = (chave?.access_token ?? "") as string;
  if (!recebido || !esperado || !confere(recebido, esperado)) {
    return NextResponse.json({ erro: "segredo inválido" }, { status: 401 });
  }

  const corpo = await lerCorpo(request);
  const telefone = telefoneDoCorpo(corpo);

  let leadId: string | null = null;
  if (telefone) {
    // O cadastro mais recente desse número, com ou sem o 9 dos celulares antigos.
    const variante =
      telefone.length === 13
        ? `${telefone.slice(0, 4)}${telefone.slice(5)}`
        : `${telefone.slice(0, 4)}9${telefone.slice(4)}`;
    const { data } = await supabase
      .from("leads")
      .select("id, entrou_grupo_em")
      .in("whatsapp", [telefone, variante])
      .order("criado_em", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      leadId = data.id;
      if (!data.entrou_grupo_em) {
        await supabase.from("leads").update({ entrou_grupo_em: new Date().toISOString() }).eq("id", data.id);
      }
    }
  }

  await supabase.from("grupo_entradas").insert({ telefone, lead_id: leadId, bruto: corpo ?? {} });

  return NextResponse.json({ ok: true, casou: Boolean(leadId) });
}
