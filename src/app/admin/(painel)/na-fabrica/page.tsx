import { requireArea } from "@/lib/auth/session";
import { lerLojasDaConsulta, lerProdutosDaConsulta } from "@/lib/consulta/dados";
import { lerFilaDaFabrica } from "@/lib/fabrica/dados";
import { createClient } from "@/lib/supabase/server";
import { hojeEmSaoPaulo } from "@/lib/vendas/periodo";
import { abrirOs, pedirAlteracao } from "./actions";
import { TelaNaFabrica } from "./Tela";

export const metadata = { title: "Na fábrica" };

/**
 * Na fábrica, do lado de quem vende (cartão 63): em que etapa está cada
 * pedido, a frase pronta para o cliente que pergunta, o pedido de alteração e
 * a OS de troca, refazer, ajuste, upgrade, polimento ou serviço.
 *
 * A fila é a mesma da fábrica (`fila_da_fabrica`, aberta para `lancar_venda`
 * na 0192), sem preço nem custo. Quem vende não move: só a fábrica. O desenho
 * mora em `Tela.tsx`.
 */
export default async function NaFabricaPage({ searchParams }: { searchParams: Promise<{ busca?: string }> }) {
  await requireArea("lancar_venda");
  const db = await createClient();
  const hoje = hojeEmSaoPaulo();
  const [fila, produtos, lojas] = await Promise.all([lerFilaDaFabrica(db, 60), lerProdutosDaConsulta(db, hoje), lerLojasDaConsulta(db)]);
  const sp = await searchParams;
  const busca = sp.busca && /^[0-9]{1,12}$/.test(sp.busca) ? sp.busca : "";
  return (
    <TelaNaFabrica
      fila={fila}
      hoje={hoje}
      buscaInicial={busca}
      produtos={(produtos ?? []).map((x) => ({ codigo: x.codigo, nome: x.nome, miniatura: x.miniatura }))}
      lojas={lojas.map((l) => l.shopping ?? l.nome)}
      abrir={abrirOs}
      pedirAlteracao={pedirAlteracao}
    />
  );
}
