"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { requireStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { TAG_QRCODE } from "@/lib/qrcode/ler";
import { esquemaDoQrcode, linkAceito } from "@/lib/qrcode/tipos";
import { soDigitos, telefoneValido } from "@/lib/leads/telefone";

export type EstadoDoQrcode = { ok?: string; erro?: string };

/** Salva para onde o QR impresso leva. */
export async function salvarQrcode(_anterior: EstadoDoQrcode, form: FormData): Promise<EstadoDoQrcode> {
  const perfil = await requireStaff();

  const modo = String(form.get("modo") ?? "whatsapp");
  const whatsapp = soDigitos(String(form.get("whatsapp") ?? ""));
  const mensagem = String(form.get("mensagem") ?? "").trim();
  const link = String(form.get("link") ?? "").trim();

  // Os dois campos ficam gravados, para a troca de modo não apagar o outro.
  // Só o do modo escolhido precisa estar certo.
  if (modo === "whatsapp" && !telefoneValido(whatsapp)) {
    return { erro: "Confira o número: DDD e número, como (11) 99999-9999." };
  }
  if (modo === "link" && !linkAceito(link)) {
    return { erro: "O link precisa começar com https:// e não pode ser o próprio endereço do QR." };
  }

  const lido = esquemaDoQrcode.safeParse({
    versao: 1,
    modo,
    whatsapp: telefoneValido(whatsapp) ? whatsapp : "",
    mensagem,
    link: linkAceito(link) ? link : "",
  });
  if (!lido.success) return { erro: "A mensagem passa de 300 caracteres. Encurte um pouco." };

  const supabase = await createClient();
  const { error } = await supabase.from("site_settings").upsert(
    { key: "pagina:qrcode", value: lido.data, is_public: true, updated_by: perfil.id },
    { onConflict: "key" },
  );
  if (error) return { erro: error.message };

  revalidateTag(TAG_QRCODE);
  revalidatePath("/admin/qrcode");
  return { ok: "Salvo. A próxima leitura do QR já vai para o destino novo." };
}
