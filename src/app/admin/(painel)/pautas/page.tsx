import { requireArea } from "@/lib/auth/session";
import { clustersExistentes } from "@/lib/data/admin-contents";
import { listarPautas, oportunidades } from "./actions";
import { TelaDasPautas } from "./Tela";

export const metadata = { title: "Pautas" };

/**
 * A fila editorial.
 *
 * O gargalo do portal nunca foi escrever, foi decidir sobre o que escrever e
 * abrir o editor numa página em branco. Aqui a decisão vira objeto: a consulta
 * que a página quer ganhar, o que o Search Console dizia no dia, e o modelo que
 * o rascunho vai usar. Quando a pauta vira rascunho, o editor abre preenchido.
 *
 * A trava contra canibalização mora na criação, e não na publicação, porque
 * duas páginas na mesma intenção custam barato de evitar antes de existir texto
 * e caro de desfazer depois que as duas estão no ar.
 */
export default async function PautasPage() {
  await requireArea("conteudo");

  const [fila, oportunidadesDaBusca, clusters] = await Promise.all([
    listarPautas(),
    oportunidades(),
    clustersExistentes(),
  ]);

  return <TelaDasPautas fila={fila} oportunidadesDaBusca={oportunidadesDaBusca} clusters={clusters} />;
}
