import "server-only";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DestinoDoQrcode } from "./tipos";

export const TAG_QRCODE = "qrcode";

/**
 * O destino de um QR pelo slug, como está em `qrcodes`.
 *
 * Lê com a service_role porque a tabela não abre nada para a chave anônima:
 * a lista de QRs é a lista de lugares onde há adesivo, e isso não é público.
 *
 * Mesma regra de `lerGrupo`: no cache entra só a resposta crua do banco
 * (`null` de slug inexistente incluído), e quem decide o que fazer sem
 * resposta é quem chama. O argumento `slug` entra na chave do cache sozinho.
 * Quem derruba é o salvar do painel, com `revalidateTag(TAG_QRCODE)`.
 *
 * ERRO não entra no cache: ele sobe de dentro da função, e o `unstable_cache`
 * não guarda o que lançou. Com `revalidate: false`, um soluço do Supabase
 * guardado como `null` deixaria o QR preso no destino de fábrica até alguém
 * salvar no painel, sem ninguém saber por quê.
 */
const lerCacheado = unstable_cache(
  async (slug: string): Promise<DestinoDoQrcode | null> => {
    const { data, error } = await createAdminClient()
      .from("qrcodes")
      .select("modo, whatsapp, mensagem, link")
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw error;
    return (data as DestinoDoQrcode | null) ?? null;
  },
  ["qrcode-por-slug", "v2"],
  { tags: [TAG_QRCODE], revalidate: false },
);

export async function lerQrcode(slug: string): Promise<DestinoDoQrcode | null> {
  try {
    return await lerCacheado(slug);
  } catch {
    return null;
  }
}
