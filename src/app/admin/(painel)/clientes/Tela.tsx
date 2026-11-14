import type { ResumoDoCliente } from "@/lib/clientes/dados";
import { BuscaDeClientes } from "./BuscaDeClientes";

/**
 * A tela de clientes, só o desenho: a busca em cima e, embaixo, quem está com
 * a pessoa e quem comprou por último. A leitura fica em `page.tsx`, para a tela
 * poder ser vista sem sessão durante o desenvolvimento.
 */
export function TelaDeClientes({
  buscar, recentes, meus,
}: {
  buscar: (q: string) => Promise<ResumoDoCliente[] | null>;
  recentes: ResumoDoCliente[] | null;
  meus: ResumoDoCliente[];
}) {
  return (
    <div data-painel-largo>
      <header>
        <p className="eyebrow">Vendas</p>
        <h1 className="font-display mt-2 text-3xl text-ink sm:text-4xl">Clientes</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted sm:text-base">
          A ficha de cada cliente: o que já comprou, em que fase está, as datas que importam e o que a equipe anotou. Ache
          pelo nome, pelo telefone, pelo e-mail ou pelo número do pedido.
        </p>
      </header>

      <BuscaDeClientes buscar={buscar} recentes={recentes} meus={meus} />
    </div>
  );
}
