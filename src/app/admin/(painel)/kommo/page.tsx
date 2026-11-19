import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { TelaDoMapa, type MapaDaKommo } from "./Tela";
import { salvarMapaDaKommo } from "./actions";

export const metadata = { title: "Quem é quem na Kommo" };

/**
 * O mapa da Kommo (0160): cada usuário de lá ligado a uma pessoa do painel, a
 * uma loja física, ou às duas. As lojas são usuários na Kommo (ARICANDUVA,
 * GRANJA VIANNA...), e os vendedores do e-commerce também. Só diretoria; a
 * função do banco confere de novo. O desenho mora em `Tela.tsx`.
 */
export default async function KommoPage() {
  await requireAdmin();
  const { data } = await (await createClient()).rpc("kommo_mapa_lista");
  const mapa = (data ?? null) as MapaDaKommo | null;
  return <TelaDoMapa mapa={mapa} aoSalvar={salvarMapaDaKommo} />;
}
