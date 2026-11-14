import { notFound } from "next/navigation";
import { requireArea } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { lerChamado } from "@/lib/time/dados";
import { resolver, responder, virar } from "../actions";
import { TelaDoChamado } from "./Tela";

export async function generateMetadata({ params }: { params: Promise<{ numero: string }> }) {
  const { numero } = await params;
  return { title: /^\d{1,9}$/.test(numero) ? `Chamado ${numero}` : "Chamado" };
}

/**
 * Um chamado, pelo número: o pedido, a conversa e os prints.
 *
 * O endereço leva só o número do chamado. Os prints saem por link assinado de
 * uma hora, emitido depois de a função do banco devolver o chamado para a
 * sessão de quem pediu: sem a área `time`, não há chamado nem link.
 */
export default async function ChamadoPage({ params }: { params: Promise<{ numero: string }> }) {
  const perfil = await requireArea("time");
  const { numero } = await params;
  if (!/^\d{1,9}$/.test(numero)) notFound();
  const chamado = await lerChamado(await createClient(), Number(numero));
  if (!chamado) notFound();
  return (
    <TelaDoChamado
      chamado={chamado}
      meuId={perfil.id}
      agora={new Date().toISOString()}
      responder={responder}
      resolver={resolver}
      virar={virar}
    />
  );
}
