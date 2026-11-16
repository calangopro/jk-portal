import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { diaEmSaoPaulo, type ItemDoCalendario, type SituacaoNoCalendario } from "./calendario";
import { ehRede, type RedeId } from "./redes";
import type { Midia } from "./tipos";

/**
 * A leitura do calendário: o que saiu (as publicações que a rotina leu de cada
 * rede, inclusive as feitas fora do painel) e o que o painel tem marcado (os
 * posts agendados, os que estão saindo e os que deram erro).
 *
 * Post do painel que já foi lido da rede aparece UMA vez, pela publicação lida:
 * o envio dele está em `redes_publicacoes.envio_id`. Recebe o cliente com a
 * chave de serviço, depois de a área ser conferida.
 */

type PublicacaoCrua = { id: string; rede: string; formato: string | null; legenda: string | null; miniatura_url: string | null; publicado_em: string | null; envio_id: string | null };
type PostCru = {
  id: string; formato: string; legenda: string; titulo: string | null; midias: unknown; status: string; agendado_para: string | null; publicado_em: string | null;
  sequencia: string | null; ordem: number | null;
  redes_envios: { id: string; rede: string; status: string }[];
};

const SITUACAO: Record<string, SituacaoNoCalendario> = { agendado: "agendado", publicando: "publicando", processando: "publicando", erro: "erro", parcial: "erro", publicado: "publicado" };

export async function lerCalendario(admin: SupabaseClient, de: string, ate: string): Promise<ItemDoCalendario[] | null> {
  const [publicacoes, agendados, saidos, ideias] = await Promise.all([
    admin.from("redes_publicacoes").select("id, rede, formato, legenda, miniatura_url, publicado_em, envio_id").gte("publicado_em", de).lt("publicado_em", ate).order("publicado_em").limit(2000),
    admin
      .from("redes_posts")
      .select("id, formato, legenda, titulo, midias, status, agendado_para, publicado_em, sequencia, ordem, redes_envios(id, rede, status)")
      .in("status", ["agendado", "publicando", "erro", "parcial"])
      .gte("agendado_para", de)
      .lt("agendado_para", ate)
      .limit(1000),
    admin
      .from("redes_posts")
      .select("id, formato, legenda, titulo, midias, status, agendado_para, publicado_em, sequencia, ordem, redes_envios(id, rede, status)")
      .in("status", ["publicado", "parcial"])
      .gte("publicado_em", de)
      .lt("publicado_em", ate)
      .limit(1000),
    // As ideias com dia marcado que ainda não viraram post na fila (0089).
    admin
      .from("redes_ideias")
      .select("id, titulo, formato, redes, quando")
      .in("estado", ["ideia", "produzindo"])
      .gte("quando", diaEmSaoPaulo(de))
      .lte("quando", diaEmSaoPaulo(Date.parse(ate) - 1))
      .limit(500),
  ]);
  const erro = publicacoes.error ?? agendados.error ?? saidos.error;
  if (erro) {
    console.error("[redes] calendário:", erro.message);
    return null;
  }

  const lidas = ((publicacoes.data ?? []) as PublicacaoCrua[]).filter((p) => ehRede(p.rede) && p.publicado_em);
  const enviosLidos = new Set(lidas.map((p) => p.envio_id).filter(Boolean));

  const itens: ItemDoCalendario[] = lidas.map((p) => ({
    chave: `p${p.id}`,
    situacao: "publicado",
    quando: p.publicado_em as string,
    redes: [p.rede as RedeId],
    formato: p.formato,
    legenda: (p.legenda ?? "").slice(0, 160),
    miniatura: p.miniatura_url,
    href: `/admin/redes/conteudos/${p.id}`,
    sequencia: null,
  }));

  const vistos = new Set<string>();
  for (const p of [...((agendados.data ?? []) as PostCru[]), ...((saidos.data ?? []) as PostCru[])]) {
    if (vistos.has(p.id)) continue;
    vistos.add(p.id);
    // Saiu e já foi lido em todas as redes: a publicação lida já está no calendário.
    const envios = p.redes_envios ?? [];
    const faltaLer = envios.filter((e) => !enviosLidos.has(e.id));
    if (p.status === "publicado" && faltaLer.length === 0) continue;
    const quando = p.status === "publicado" || (p.status === "parcial" && !p.agendado_para) ? p.publicado_em : p.agendado_para ?? p.publicado_em;
    if (!quando) continue;
    const midias = (Array.isArray(p.midias) ? p.midias : []) as Midia[];
    const imagem = midias.find((m) => m.tipo === "imagem");
    itens.push({
      chave: `r${p.id}`,
      situacao: SITUACAO[p.status] ?? "agendado",
      quando,
      redes: [...new Set((faltaLer.length ? faltaLer : envios).map((e) => e.rede).filter(ehRede))] as RedeId[],
      formato: p.formato,
      legenda: (p.legenda || p.titulo || "").slice(0, 160),
      miniatura: imagem?.url ?? null,
      href: `/admin/redes/publicar/${p.id}`,
      sequencia: p.sequencia && p.ordem ? `${p.sequencia}:${p.ordem}` : null,
    });
  }
  for (const i of (ideias.data ?? []) as { id: string; titulo: string; formato: string | null; redes: string[] | null; quando: string }[]) {
    itens.push({
      chave: `i${i.id}`,
      situacao: "ideia",
      // Meio-dia de Brasília: a ideia tem dia, não hora.
      quando: `${i.quando}T15:00:00.000Z`,
      redes: (i.redes ?? []).filter(ehRede) as RedeId[],
      formato: i.formato,
      legenda: i.titulo,
      miniatura: null,
      href: `/admin/redes/ideias#${i.id}`,
      sequencia: null,
    });
  }
  return itens;
}
