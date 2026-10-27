import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { MENSAGEM_PADRAO, destinoDeFabrica, type DestinoDoQrcode } from "@/lib/qrcode/tipos";
import { FormularioDoQrcode } from "../FormularioDoQrcode";

export const metadata = { title: "Novo QR code" };

/**
 * Criar um QR. O número já vem o mesmo do QR do Tamboré, que é o WhatsApp que
 * a JK usa nos impressos; a mensagem vem genérica, para a pessoa citar o lugar.
 */
export default async function NovoQrcodePage() {
  await requireStaff();
  const supabase = await createClient();
  const { data } = await supabase.from("qrcodes").select("whatsapp").eq("slug", "").maybeSingle();

  const destino: DestinoDoQrcode = {
    modo: "whatsapp",
    whatsapp: data?.whatsapp || destinoDeFabrica().whatsapp,
    mensagem: MENSAGEM_PADRAO,
    link: "",
  };

  return (
    <>
      <Link
        href="/admin/qrcode"
        className="inline-flex items-center gap-1 text-xs font-semibold text-brand-nav hover:underline"
      >
        <ArrowLeft size={13} aria-hidden />
        Todos os QR codes
      </Link>
      <header className="mt-4">
        <p className="eyebrow">QR codes</p>
        <h1 className="font-display mt-2 text-4xl text-ink">Novo QR code</h1>
        <p className="mt-3 max-w-2xl text-muted">
          Um para cada lugar onde vai adesivo. Depois de criar, a arte fica pronta para baixar e mandar para a gráfica.
        </p>
      </header>
      <div className="mt-8 max-w-2xl">
        <FormularioDoQrcode nome="" destino={destino} />
      </div>
    </>
  );
}
