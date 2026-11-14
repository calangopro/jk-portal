import { ehAdmin } from "@/lib/auth/acessos";
import { requireArea } from "@/lib/auth/session";
import { lerAvaliacoesDoPainel } from "@/lib/google-perfil/painel";
import { responder, usarHorario } from "./actions";
import { TelaDeAvaliacoes } from "./Tela";

export const metadata = { title: "Avaliações do Google" };

/**
 * As avaliações do Google que estão sem resposta, por loja, e o horário que o
 * Google tem de cada uma. Abre para quem cuida do catálogo; responder e mexer
 * no horário é de administrador, dono, GM e gerente. O desenho mora em `Tela.tsx`.
 */
export default async function AvaliacoesPage() {
  const perfil = await requireArea("catalogo");
  const podeFalar = ehAdmin(perfil.role) || perfil.role === "gerente";
  return <TelaDeAvaliacoes lojas={await lerAvaliacoesDoPainel()} responder={podeFalar ? responder : undefined} usarHorario={podeFalar ? usarHorario : undefined} />;
}
