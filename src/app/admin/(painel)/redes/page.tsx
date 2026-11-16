import { ehAdmin } from "@/lib/auth/acessos";
import { requireArea } from "@/lib/auth/session";
import { lerResumoDasRedes } from "@/lib/redes/painel";
import { createClient } from "@/lib/supabase/server";
import { TelaDasRedes } from "./Tela";

export const metadata = { title: "Todas as redes" };

const PERIODOS = [7, 28, 90];

/**
 * Os números de todas as redes ligadas, lado a lado. A página só lê o banco:
 * quem fala com as redes é a rotina de leitura (`lib/redes/leitura.ts`), em
 * segundo plano. O desenho mora em `Tela.tsx`.
 */
export default async function RedesPage({ searchParams }: { searchParams: Promise<{ dias?: string }> }) {
  const perfil = await requireArea("redes");
  const pedido = Number((await searchParams).dias);
  const dias = PERIODOS.includes(pedido) ? pedido : 28;
  const resumo = await lerResumoDasRedes(await createClient(), dias);
  return <TelaDasRedes resumo={resumo} dias={dias} periodos={PERIODOS} agora={Date.now()} podeLigar={ehAdmin(perfil.role)} />;
}
