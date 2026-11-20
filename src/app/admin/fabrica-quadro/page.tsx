import { requireArea } from "@/lib/auth/session";
import { lerFilaDaFabrica } from "@/lib/fabrica/dados";
import { lerEstacao } from "@/lib/fabrica/etapas";
import { createClient } from "@/lib/supabase/server";
import { hojeEmSaoPaulo } from "@/lib/vendas/periodo";
import { darCiencia, moverPedido } from "../(painel)/fabrica/actions";
import { QuadroDaFabrica } from "./Quadro";

export const metadata = { title: "Quadro da fábrica" };

/**
 * O quadro da fábrica em tela cheia (cartão 62): a fila em colunas, uma por
 * etapa, para a TV da fábrica e o tablet da bancada.
 *
 * FICA FORA DO GRUPO `(painel)` DE PROPÓSITO: é o grupo que desenha a moldura
 * (menu, barra de baixo, chat flutuante). Aqui só os pedidos. A sessão e a
 * área são conferidas aqui mesmo, como em qualquer tela do painel, e de novo
 * dentro das funções do banco.
 *
 * `?so=gravacao` (ou `?so=gravacao,embalar`) mostra só as etapas de uma
 * estação: o endereço vira favorito no tablet daquela bancada.
 */
export default async function QuadroPage({ searchParams }: { searchParams: Promise<{ so?: string }> }) {
  const quem = await requireArea("fabrica");
  const sp = await searchParams;
  // 30 dias: o quadro é da bancada, e o que entrou há mais tempo e ninguém pegou continua na fila de 60 dias da tela normal.
  const fila = await lerFilaDaFabrica(await createClient(), 30);
  return (
    <QuadroDaFabrica
      fila={fila}
      hoje={hojeEmSaoPaulo()}
      so={fila ? lerEstacao(sp.so, fila.etapas) : []}
      meuId={quem.areas.includes("time") ? quem.id : null}
      mover={moverPedido}
      ciente={darCiencia}
    />
  );
}
