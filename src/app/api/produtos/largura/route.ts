import { unstable_cache } from "next/cache";
import { linhasPorLargura, paraVitrine } from "@/lib/data/produtos";
import { LARGURAS_COMUNS } from "@/lib/medidor/larguras";
import { TAG_DE_PRECOS } from "@/lib/tray/revalidar";

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
 *
 * O cache guarda a linha do banco, e o preço do dia é resolvido FORA dele, a
 * cada pedido. A "v1" guardava o cartão pronto, com o preço promocional lido
 * sem olhar a janela da promoção. Trocar a versão é o que faz essas entradas
 * pararem de responder. A tag deixa a sincronização jogar o cache fora quando
 * um preço muda na loja, sem esperar a hora vencer.
 */
const lerPorLargura = unstable_cache(
  async (mm: number) => linhasPorLargura(mm, LIMITE),
  ["vitrine-por-largura", "v2"],
  { revalidate: 3600, tags: [TAG_DE_PRECOS] },
);

/**
 * Quanto falta para a meia-noite em São Paulo, em segundos.
 *
 * A resposta fica guardada na CDN, e a CDN não sabe de promoção. Se o prazo
 * atravessasse a meia-noite, a vitrine seguiria anunciando o desconto que
 * acabou até a cópia vencer.
 */
function segundosAteAViradaDoDia(agora = new Date()): number {
  const partes = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(agora);
  const valor = (tipo: string) => Number(partes.find((p) => p.type === tipo)?.value ?? 0);
  const passados = valor("hour") * 3600 + valor("minute") * 60 + valor("second");
  return Math.max(1, 86400 - passados);
}

export async function GET(request: Request) {
  const mm = Number(new URL(request.url).searchParams.get("mm"));

  // Só as larguras que a ferramenta oferece. Aceitar número livre daria uma
  // consulta ao banco para cada valor que alguém inventasse na barra de
  // endereço, e uma entrada de cache para cada um deles.
  if (!(LARGURAS_COMUNS as readonly number[]).includes(mm)) {
    return Response.json({ erro: "Largura fora da lista da ferramenta." }, { status: 400 });
  }

  const produtos = paraVitrine(await lerPorLargura(mm));

  // Cinco minutos de CDN, que é o que a sincronização leva para chegar, e
  // nunca além da meia-noite.
  const cdn = Math.min(300, segundosAteAViradaDoDia());
  return Response.json(
    { larguraMm: mm, produtos },
    { headers: { "Cache-Control": `public, max-age=${Math.min(60, cdn)}, s-maxage=${cdn}` } },
  );
}
