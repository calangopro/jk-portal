import { requireArea } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { COLUNAS_DO_QRCODE, type Qrcode } from "@/lib/qrcode/tipos";
import { hojeEmSaoPaulo } from "@/lib/tray/preco";
import { TelaDosQrcodes } from "./Tela";
import { leiturasPorDia, trintaDias, type Resumo } from "./dados";

export const metadata = { title: "QR codes" };

/**
 * Os QR codes impressos: um por lugar, cada um com endereço, destino e
 * contagem próprios.
 *
 * A contagem sai de `qrcode_leituras`, gravada pelo próprio redirecionamento
 * (`lib/qrcode/servir.ts`). O GA4 não enxerga essa visita, porque a pessoa vai
 * direto para o WhatsApp sem nenhuma página do site carregar no meio.
 */

export default async function QrcodesPage() {
  await requireArea("site");
  const supabase = await createClient();

  const hoje = hojeEmSaoPaulo();
  const dias = trintaDias(hoje);

  const [lista, resumo, noDia] = await Promise.all([
    supabase.from("qrcodes").select(COLUNAS_DO_QRCODE).order("criado_em", { ascending: true }),
    supabase.from("qrcode_resumo").select("*"),
    leiturasPorDia(supabase, dias),
  ]);

  const qrcodes = (lista.data ?? []) as Qrcode[];
  const resumos = new Map(((resumo.data ?? []) as Resumo[]).map((r) => [r.qrcode, r]));
  const ativos = qrcodes.filter((q) => !q.arquivado_em);
  const arquivados = qrcodes.filter((q) => q.arquivado_em);

  return (
    <TelaDosQrcodes ativos={ativos} arquivados={arquivados} resumos={resumos} dias={dias} noDia={noDia} hoje={hoje} />
  );
}
