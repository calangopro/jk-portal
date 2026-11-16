import { requireArea } from "@/lib/auth/session";
import { fontesDeIdeia, listarIdeias } from "@/lib/redes/ideias";
import { createAdminClient } from "@/lib/supabase/admin";
import { criar, editar, mover } from "./actions";
import { TelaDeIdeias } from "./Tela";

export const metadata = { title: "Ideias" };

/**
 * O banco de ideias do Social Media: o que guardar para postar, de onde tirar
 * ideia (o que rendeu acima do normal, as perguntas dos comentários, as datas
 * que vêm aí) e "virar post". O desenho mora em `Tela.tsx`; a regra, em
 * `lib/redes/ideias.ts`. A leitura usa a chave de serviço depois da área,
 * para trazer o nome de quem guardou.
 */
export default async function IdeiasPage() {
  await requireArea("redes");
  const admin = createAdminClient();
  const agora = Date.now();
  const [ideias, fontes] = await Promise.all([listarIdeias(admin), fontesDeIdeia(admin, agora)]);
  return <TelaDeIdeias ideias={ideias} fontes={fontes} agora={agora} acoes={{ criar, editar, mover }} />;
}
