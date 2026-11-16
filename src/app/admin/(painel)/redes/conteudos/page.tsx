import { requireArea } from "@/lib/auth/session";
import { ordenarConteudos } from "@/lib/redes/conteudos";
import { lerConteudos } from "@/lib/redes/conteudos-dados";
import { createClient } from "@/lib/supabase/server";
import { TelaEmAlta, filtroDoEndereco } from "./Tela";

export const metadata = { title: "Em alta" };

const PERIODOS = [7, 28, 90];

/**
 * O que mais rendeu nas redes, post a post, comparado com o normal de cada
 * conta. Só lê o banco: quem traz os números de cada post é a rotina de
 * leitura. A conta mora em `lib/redes/conteudos.ts`; o desenho, em `Tela.tsx`.
 */
export default async function EmAltaPage({ searchParams }: { searchParams: Promise<{ dias?: string; rede?: string; tipo?: string; ordem?: string; todos?: string }> }) {
  await requireArea("redes");
  const filtro = filtroDoEndereco(await searchParams, PERIODOS);
  const dados = await lerConteudos(await createClient(), filtro.dias);
  const filtrados = dados?.conteudos.filter((c) => (!filtro.rede || c.rede === filtro.rede) && (!filtro.grupo || c.grupo === filtro.grupo)) ?? null;
  return <TelaEmAlta conteudos={filtrados ? ordenarConteudos(filtrados, filtro.ordem) : null} contas={dados?.contas ?? []} filtro={filtro} periodos={PERIODOS} />;
}
