import { ehAdmin } from "@/lib/auth/acessos";
import { requireArea } from "@/lib/auth/session";
import { lerFilaDaFabrica } from "@/lib/fabrica/dados";
import { ENTRADA, lerEtapa } from "@/lib/fabrica/etapas";
import { createClient } from "@/lib/supabase/server";
import { hojeEmSaoPaulo } from "@/lib/vendas/periodo";
import { darCiencia, marcarTrabalho, moverPedido, moverVarios, salvarEtapas } from "./actions";
import { JANELAS, TelaDaFabrica } from "./Tela";

export const metadata = { title: "Fila da fábrica" };

/**
 * A fila da fábrica: os pedidos pagos, da chegada ao envio, pelas etapas da
 * tabela `fabrica_etapas` (0191).
 *
 * Quem tem a área `fabrica` (fábrica, gerente, GM, dono e administrador) vê e
 * move; diretoria e gerente também editam as etapas. A fila vem de uma função
 * do banco que não devolve preço nem custo: a fábrica não tem leitura do
 * faturamento. O desenho mora em `Tela.tsx`.
 */
export default async function FabricaPage({ searchParams }: { searchParams: Promise<{ etapa?: string; dias?: string; busca?: string }> }) {
  const quem = await requireArea("fabrica");
  const sp = await searchParams;
  const dias = JANELAS.includes(Number(sp.dias)) ? Number(sp.dias) : JANELAS[0];
  const fila = await lerFilaDaFabrica(await createClient(), dias);
  // `?busca=<número>` é por onde chega quem clicou num pedido marcado no chat do time: só número, nunca texto digitado.
  const busca = sp.busca && /^[0-9]{1,12}$/.test(sp.busca) ? sp.busca : "";
  const pedida = lerEtapa(sp.etapa);
  const etapa = pedida && fila?.etapas.some((e) => e.chave === pedida && e.ativa) ? pedida : ENTRADA;
  return (
    <TelaDaFabrica
      fila={fila}
      etapa={etapa}
      dias={dias}
      hoje={hojeEmSaoPaulo()}
      buscaInicial={busca}
      mover={moverPedido}
      moverVarios={moverVarios}
      marcar={marcarTrabalho}
      ciente={darCiencia}
      salvarEtapas={ehAdmin(quem.role) || quem.role === "gerente" ? salvarEtapas : undefined}
    />
  );
}
