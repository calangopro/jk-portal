import { requireArea } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { Midia } from "./Biblioteca";
import { TelaDaMidia } from "./Tela";

export const metadata = { title: "Mídia" };

export default async function MidiaPage() {
  await requireArea("conteudo");
  const supabase = await createClient();

  const { data } = await supabase
    .from("media")
    .select("id, url, storage_path, alt, title, caption, credit, width, height, bytes, mime, deactivated_at")
    .order("created_at", { ascending: false });

  // Quantas vezes cada imagem é usada em conteúdo.
  const { data: usos } = await supabase.from("content_media").select("media_id");
  const contagem = new Map<string, number>();
  for (const u of usos ?? []) {
    const k = (u as { media_id: string }).media_id;
    contagem.set(k, (contagem.get(k) ?? 0) + 1);
  }

  const itens: Midia[] = (data ?? []).map((m) => ({
    ...(m as Omit<Midia, "usos">),
    usos: contagem.get((m as { id: string }).id) ?? 0,
  }));

  return <TelaDaMidia itens={itens} />;
}
