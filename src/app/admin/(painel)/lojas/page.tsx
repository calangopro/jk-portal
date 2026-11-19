import { requireArea } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { TelaDeLojas, type Linha } from "./Tela";

export const metadata = { title: "Lojas" };

export default async function LojasPage() {
  await requireArea("catalogo");
  const supabase = await createClient();

  const { data } = await supabase
    .from("locations")
    .select("id, slug, name, address, address_locality, phone, latitude, status, updated_at")
    .order("name");

  return <TelaDeLojas itens={(data ?? []) as Linha[]} />;
}
