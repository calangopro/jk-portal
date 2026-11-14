import { requireArea } from "@/lib/auth/session";
import { buscarClientes } from "@/lib/clientes/dados";
import { createClient } from "@/lib/supabase/server";
import { buscar } from "./actions";
import { TelaDeClientes } from "./Tela";

export const metadata = { title: "Clientes" };

/**
 * Clientes: a busca e a porta da ficha de cada um.
 *
 * Nasceu de um pedido do dono do projeto: o vendedor não sabia em que fase
 * estava o cliente, e não havia onde ver o que a pessoa já comprou. Quem tem a
 * área de lançar venda (vendas, gerente, GM, dono e administrador) entra. A
 * lista vem de funções do banco que conferem a área por dentro: o vendedor
 * recebe os clientes sem ganhar leitura da tabela de pedidos, que é
 * faturamento. O desenho mora em `Tela.tsx`.
 */
export default async function ClientesPage() {
  await requireArea("lancar_venda");
  const db = await createClient();
  const [recentes, meus] = await Promise.all([buscarClientes(db, null), buscarClientes(db, null, { meus: true })]);
  return <TelaDeClientes buscar={buscar} recentes={recentes} meus={meus ?? []} />;
}
