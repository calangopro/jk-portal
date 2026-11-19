import { notFound } from "next/navigation";
import { requireArea } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { COLUNAS_DO_QRCODE, type Qrcode } from "@/lib/qrcode/tipos";
import { hojeEmSaoPaulo } from "@/lib/tray/preco";
import { comBasePath } from "@/lib/seo/base-path";
import { leiturasPorDia, resumoVazio, trintaDias, type Resumo } from "../dados";
import { TelaDoQrcode } from "./Tela";

export const metadata = { title: "QR code" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Um QR: a arte para baixar, para onde ele leva e quantas vezes foi lido. */
export default async function QrcodePage({ params }: { params: Promise<{ id: string }> }) {
  await requireArea("site");
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();
  const { data } = await supabase.from("qrcodes").select(COLUNAS_DO_QRCODE).eq("id", id).maybeSingle();
  if (!data) notFound();
  const q = data as Qrcode;

  const hoje = hojeEmSaoPaulo();
  const dias = trintaDias(hoje);
  const [resumo, noDia] = await Promise.all([
    supabase.from("qrcode_resumo").select("*").eq("qrcode", q.slug).maybeSingle(),
    leiturasPorDia(supabase, dias, q.slug),
  ]);

  // Caminho cru em <img> e <a>: o basePath entra na mão (ver CLAUDE.md).
  const arte = comBasePath(`/admin/qrcode/${q.id}/arte`);

  return (
    <TelaDoQrcode
      q={q}
      arte={arte}
      resumo={(resumo.data as Resumo | null) ?? resumoVazio(q.slug)}
      dias={dias}
      noDia={noDia}
      hoje={hoje}
    />
  );
}
