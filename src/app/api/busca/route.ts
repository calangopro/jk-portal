import { buscar } from "@/lib/busca/consultar";

// Node, e não Edge: a consulta passa pela OpenAI e pelo supabase-js.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Limite por IP, em memória.
 *
 * Cada consulta custa uma chamada de embedding. Sem freio, um laço de script
 * transforma a busca em conta de OpenAI. Memória do processo basta aqui: o
 * objetivo é conter abuso bobo, não sobreviver a ataque distribuído. Numa
 * instância nova o contador zera, e tudo bem.
 */
const JANELA_MS = 60_000;
const TETO_POR_JANELA = 30;
const visitas = new Map<string, { contagem: number; ate: number }>();

function excedeu(ip: string): boolean {
  const agora = Date.now();
  const atual = visitas.get(ip);

  if (!atual || agora > atual.ate) {
    visitas.set(ip, { contagem: 1, ate: agora + JANELA_MS });
    // Faxina simples, para o mapa não crescer sem fim.
    if (visitas.size > 5000) {
      for (const [chave, v] of visitas) if (agora > v.ate) visitas.delete(chave);
    }
    return false;
  }

  atual.contagem += 1;
  return atual.contagem > TETO_POR_JANELA;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const consulta = url.searchParams.get("q") ?? "";

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "desconhecido";

  if (excedeu(ip)) {
    return Response.json(
      { consulta, achados: [], comSignificado: false, erro: "Muitas buscas seguidas. Espere um pouco." },
      { status: 429 },
    );
  }

  const resultado = await buscar(consulta);
  return Response.json(resultado, {
    // Consulta repetida (link compartilhado, voltar do navegador) não precisa
    // pagar embedding de novo.
    headers: { "Cache-Control": "public, max-age=60, s-maxage=300" },
  });
}
