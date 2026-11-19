import { requireArea } from "@/lib/auth/session";
import { montarHoje, oQueOlharDepois } from "@/lib/painel/hoje";
import { lerHoje } from "@/lib/painel/hoje-dados";
import { createClient } from "@/lib/supabase/server";
import { TelaDoHoje } from "./Tela";

export const metadata = { title: "Hoje" };

/**
 * Hoje: o que a pessoa logada precisa fazer agora, numa lista só.
 *
 * É a primeira tela do Início para todo mundo. Só lê: cada fonte é a função
 * que a tela de origem já usa (`lib/painel/hoje-dados.ts`), chamada só quando
 * a pessoa tem a área, e a conta que junta, ordena e corta repetido é pura
 * (`lib/painel/hoje.ts`, com teste). Nada aqui distribui trabalho, troca dono
 * ou escreve na Kommo: cada botão leva ao lugar de resolver.
 */
export default async function HojePage() {
  const profile = await requireArea("time");
  const entrada = await lerHoje(await createClient(), profile);
  const dia = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Sao_Paulo" });
  const nome = (profile.fullName ?? "equipe").split(" ")[0];
  return <TelaDoHoje nome={nome} dia={dia} hoje={montarHoje(entrada)} depois={oQueOlharDepois(profile.areas)} />;
}
