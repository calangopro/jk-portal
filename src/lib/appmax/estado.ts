import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hojeEmSaoPaulo, somarDias } from "@/lib/vendas/periodo";
import { lerCredencial } from "./cliente";

export type EstadoDaAppmax = {
  configurada: boolean;
  /** O último pulso da rotina: quando rodou, se deu certo e o que disse. */
  pulso: { em: string; ok: boolean; detalhe: string | null } | null;
  vinculados: number;
  lidos: number;
  comErro: number;
  /** Os últimos 30 dias, pelo que a Appmax descontou de verdade. Nulo sem acesso de administrador. */
  resumo: {
    pagosNoPeriodo: number;
    pagosNaAppmax: number;
    lidos: number;
    porMeio: { meio: string; pedidos: number; total: number; descontado: number; processamento: number; gateway: number; parcelamento: number; parcelasMedias: number | null }[];
  } | null;
};

const n = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);

/** O que o cartão da Appmax em Integrações mostra. `sessao` é o cliente de quem olha: o resumo confere administrador por dentro. */
export async function lerEstadoDaAppmax(admin: SupabaseClient, sessao: SupabaseClient): Promise<EstadoDaAppmax> {
  const hoje = hojeEmSaoPaulo();
  const tabela = () => admin.from("appmax_pedidos");
  const [cred, pulso, vinculados, lidos, comErro, resumo] = await Promise.all([
    lerCredencial(admin),
    admin.from("rotinas_pulso").select("ultima_em, ok, detalhe").eq("rotina", "appmax").maybeSingle(),
    tabela().select("pedido", { count: "exact", head: true }),
    tabela().select("pedido", { count: "exact", head: true }).not("lido_em", "is", null),
    tabela().select("pedido", { count: "exact", head: true }).is("lido_em", null).gte("tentativas", 5),
    sessao.rpc("appmax_resumo", { p_de: somarDias(hoje, -29), p_ate: hoje }),
  ]);
  const r = (resumo.data ?? null) as Record<string, unknown> | null;
  const porMeio = Array.isArray(r?.por_meio) ? (r!.por_meio as Record<string, unknown>[]) : [];
  return {
    configurada: Boolean(cred),
    pulso: pulso.data ? { em: String(pulso.data.ultima_em), ok: Boolean(pulso.data.ok), detalhe: (pulso.data.detalhe as string | null) ?? null } : null,
    vinculados: vinculados.count ?? 0,
    lidos: lidos.count ?? 0,
    comErro: comErro.count ?? 0,
    resumo: r && !r.erro
      ? {
          pagosNoPeriodo: n(r.pagos_no_periodo),
          pagosNaAppmax: n(r.pagos_na_appmax),
          lidos: n(r.lidos),
          porMeio: porMeio.map((m) => ({
            meio: String(m.meio ?? "outro"),
            pedidos: n(m.pedidos),
            total: n(m.total),
            descontado: n(m.descontado),
            processamento: n(m.processamento),
            gateway: n(m.gateway),
            parcelamento: n(m.parcelamento),
            parcelasMedias: m.parcelas_medias === null || m.parcelas_medias === undefined ? null : n(m.parcelas_medias),
          })),
        }
      : null,
  };
}
