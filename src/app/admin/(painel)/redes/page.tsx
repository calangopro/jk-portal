import { ehAdmin } from "@/lib/auth/acessos";
import { requireArea } from "@/lib/auth/session";
import { contarComentarios } from "@/lib/redes/comentarios";
import { lerConteudos } from "@/lib/redes/conteudos-dados";
import { lerResumoDasRedes } from "@/lib/redes/painel";
import { listarPosts } from "@/lib/redes/posts";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { TelaDasRedes } from "./Tela";

export const metadata = { title: "Hoje nas redes" };

const PERIODOS = [7, 28, 90];

/**
 * O começo do Social Media: o que sai nas próximas 48 horas, os comentários
 * esperando, o que está em alta e os números de cada rede. A página só lê o banco:
 * quem fala com as redes é a rotina de leitura (`lib/redes/leitura.ts`), em
 * segundo plano. O desenho mora em `Tela.tsx`.
 */
export default async function RedesPage({ searchParams }: { searchParams: Promise<{ dias?: string }> }) {
  const perfil = await requireArea("redes");
  const pedido = Number((await searchParams).dias);
  const dias = PERIODOS.includes(pedido) ? pedido : 28;
  const db = await createClient();
  const admin = createAdminClient();
  const agora = Date.now();
  // As quatro leituras vão juntas: cada uma é uma ida ao banco, e em fila a tela demoraria a soma delas.
  const [resumo, fila, comentarios, semana] = await Promise.all([lerResumoDasRedes(db, dias), listarPosts(admin, "fila", 40), contarComentarios(admin), lerConteudos(db, 7)]);
  const proximos = fila.filter((p) => p.agendadoPara && Date.parse(p.agendadoPara) <= agora + 48 * 3_600_000);
  const emAlta = (semana?.conteudos ?? []).filter((c) => c.acima).sort((a, b) => (b.fator ?? 0) - (a.fator ?? 0));
  return <TelaDasRedes resumo={resumo} hoje={{ proximos, comentarios, emAlta }} dias={dias} periodos={PERIODOS} agora={agora} podeLigar={ehAdmin(perfil.role)} />;
}
