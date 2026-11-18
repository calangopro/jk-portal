import { requireArea } from "@/lib/auth/session";
import { lerQuadro } from "@/lib/roadmap/roadmap";
import { createClient } from "@/lib/supabase/server";
import { conferirCaminhos, criarCartao, editarCartao, levarSugestao, ligarPr, moverCartao, pegarCartao, verCartao } from "./actions";
import { QuadroDoRoadmap } from "./Quadro";

export const metadata = { title: "Roadmap" };

/**
 * O Roadmap do painel: o quadro de trabalho de quem mexe no código (o Filipe,
 * o Erick e o Claude de cada um). Mostra o que está para fazer, o que está
 * sendo feito, por quem, em qual ramo e em quais caminhos, e avisa quando dois
 * cartões em trabalho mexem no mesmo lugar.
 *
 * Abre para a área `roadmap` (administrador, dono e GM). O banco decide o que
 * cada um recebe (`roadmap_quadro`, 0141). `?cartao=<número>` abre o cartão:
 * é o link que o conector do Claude devolve.
 */
export default async function RoadmapPage({ searchParams }: { searchParams: Promise<{ cartao?: string }> }) {
  const perfil = await requireArea("roadmap");
  const sp = await searchParams;
  const db = await createClient();
  const { data, error } = await db.rpc("roadmap_quadro");
  if (error) console.error("[roadmap] roadmap_quadro:", error.message);
  const quadro = error ? null : lerQuadro(data);
  const abrir = sp.cartao && /^[1-9][0-9]{0,9}$/.test(sp.cartao) ? Number(sp.cartao) : null;

  return (
    <QuadroDoRoadmap
      quadro={quadro}
      eu={{ id: perfil.id, nome: perfil.fullName ?? "" }}
      abrir={abrir}
      acoes={{
        ver: verCartao,
        conferir: conferirCaminhos,
        criar: criarCartao,
        pegar: pegarCartao,
        mover: moverCartao,
        ligarPr,
        editar: editarCartao,
        levar: levarSugestao,
      }}
    />
  );
}
