import { unstable_cache } from "next/cache";
import { produtosPorLargura } from "@/lib/data/produtos";
import { LARGURAS_COMUNS } from "@/lib/medidor/larguras";

// supabase-js, então Node.
export const runtime = "nodejs";

const LIMITE = 4;

/**
 * Peças de uma largura, para a vitrine acompanhar o simulador.
 *
 * A página da ferramenta continua sendo HTML pronto, com a vitrine de 4 mm
 * dentro dele, que é o que a busca lê. Esta rota existe só para o caso em que
 * alguém MEXE na ferramenta: aí a vitrine troca sem recarregar a página e sem
 * tornar a rota dinâmica.
 *
 * A consulta é cacheada por largura, por uma hora. São seis larguras, então são
 * seis entradas no máximo, e uma pessoa clicando em todos os botões custa seis
 * consultas para o servidor inteiro, não seis por visita.
 */
const lerPorLargura = unstable_cache(
  async (mm: number) => produtosPorLargura(mm, LIMITE),
  ["vitrine-por-largura", "v1"],
  { revalidate: 3600 },
);

export async function GET(request: Request) {
  const mm = Number(new URL(request.url).searchParams.get("mm"));

  // Só as larguras que a ferramenta oferece. Aceitar número livre daria uma
  // consulta ao banco para cada valor que alguém inventasse na barra de
  // endereço, e uma entrada de cache para cada um deles.
  if (!(LARGURAS_COMUNS as readonly number[]).includes(mm)) {
    return Response.json({ erro: "Largura fora da lista da ferramenta." }, { status: 400 });
  }

  const produtos = await lerPorLargura(mm);
  return Response.json(
    { larguraMm: mm, produtos },
    { headers: { "Cache-Control": "public, max-age=300, s-maxage=3600" } },
  );
}
