import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { analisarConteudos, type Conteudo, type PublicacaoCrua } from "./conteudos";
import { ehRede, nomeDaRede, type RedeId } from "./redes";

/**
 * A leitura do "Em alta". Recebe o cliente com a sessão de quem abriu: a RLS
 * de `redes_publicacoes` libera para quem tem a área `redes`.
 *
 * O normal de cada conta sai sempre dos últimos 90 dias, mesmo quando a tela
 * mostra 7: com uma semana só, o "normal" seria a própria semana.
 */

const COLUNAS = "id, conta_id, rede, id_na_rede, formato, legenda, link, miniatura_url, publicado_em, curtidas, comentarios, salvos, compartilhamentos, alcance, visualizacoes, metricas_em";
export const DIAS_DO_NORMAL = 90;

export type ContaDoConteudo = { id: string; rede: RedeId; nome: string };

/** As publicações dos últimos 90 dias. O Supabase entrega mil linhas por pedido: as páginas vão juntas. */
async function lerBase(db: SupabaseClient, contaId?: string): Promise<PublicacaoCrua[] | null> {
  const desde = new Date(Date.now() - DIAS_DO_NORMAL * 86_400_000).toISOString();
  const pagina = (i: number) => {
    let q = db.from("redes_publicacoes").select(COLUNAS).gte("publicado_em", desde).order("publicado_em", { ascending: false }).order("id").range(i * 1000, i * 1000 + 999);
    if (contaId) q = q.eq("conta_id", contaId);
    return q;
  };
  const paginas = await Promise.all([0, 1, 2].map(pagina));
  const erro = paginas.find((p) => p.error)?.error;
  if (erro) {
    console.error("[redes] conteúdos:", erro.message);
    return null;
  }
  return paginas.flatMap((p) => (p.data ?? []) as PublicacaoCrua[]).filter((p) => ehRede(p.rede));
}

async function lerContas(db: SupabaseClient): Promise<ContaDoConteudo[]> {
  const { data } = await db.from("redes_contas").select("id, rede, usuario, nome").neq("status", "desligada").order("conectada_em");
  return ((data ?? []) as { id: string; rede: string; usuario: string | null; nome: string | null }[])
    .filter((c) => ehRede(c.rede))
    .map((c) => ({ id: c.id, rede: c.rede as RedeId, nome: c.usuario || c.nome || nomeDaRede(c.rede) }));
}

/** As publicações do período, cada uma comparada com o normal da própria conta. Nulo: a leitura falhou. */
export async function lerConteudos(db: SupabaseClient, dias: number): Promise<{ conteudos: Conteudo[]; contas: ContaDoConteudo[] } | null> {
  const [base, contas] = await Promise.all([lerBase(db), lerContas(db)]);
  if (!base) return null;
  const desde = Date.now() - dias * 86_400_000;
  const doPeriodo = base.filter((p) => p.publicado_em && Date.parse(p.publicado_em) >= desde);
  return { conteudos: analisarConteudos(doPeriodo, base), contas };
}

/** Uma publicação, com o normal da conta. Nulo: não existe, ou a sessão não alcança. */
export async function lerConteudo(db: SupabaseClient, id: string): Promise<{ conteudo: Conteudo; conta: ContaDoConteudo | null } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data, error } = await db.from("redes_publicacoes").select(COLUNAS).eq("id", id).maybeSingle();
  if (error || !data || !ehRede((data as PublicacaoCrua).rede)) return null;
  const p = data as PublicacaoCrua;
  const [base, contas] = await Promise.all([lerBase(db, p.conta_id), lerContas(db)]);
  const [conteudo] = analisarConteudos([p], base ?? [p]);
  return { conteudo, conta: contas.find((c) => c.id === p.conta_id) ?? null };
}
