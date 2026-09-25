import { variaveisDoTema } from "@/lib/bio/temas";
import type { Bio, ProdutoDaBio, VersaoDaBio } from "@/lib/bio/tipos";
import type { Location } from "@/lib/content/types";
import { BlocoCampanha, BlocoLinks, BlocoLojas, Cabecalho, Rodape, TituloDaVitrine } from "./Blocos";
import { Captura } from "./Captura";
import { Carrossel } from "./Carrossel";
import { Enfeites } from "./Enfeites";

/** Produtos de cada vitrine, pelo id do bloco. */
export type DadosDaBio = {
  vitrines: Record<string, ProdutoDaBio[]>;
  lojas: Location[];
};

/**
 * O desenho da bio, sem buscar nada.
 *
 * Existe separado de `PaginaDaBio` para a MESMA marcação servir em dois
 * lugares: a página pública, que busca os dados no servidor, e a prévia do
 * painel, que desenha no navegador enquanto a pessoa edita. Se a prévia tivesse
 * o próprio desenho, ela mentiria sobre o que vai ao ar na primeira mudança que
 * alguém esquecesse de fazer nos dois.
 *
 * Por isso nada aqui pode ser só de servidor.
 *
 * O fundo é chapado, sem o brilho dourado que havia atrás do logo. Foi pedido
 * pela JK em 24/09: o off white limpo destaca o logo, e o degradê sujava o topo.
 */
export function CorpoDaBio({
  cabecalho,
  versao,
  dados,
  altura = "min-h-dvh",
}: {
  cabecalho: Bio["cabecalho"];
  versao: VersaoDaBio;
  dados: DadosDaBio;
  /** Na página é a tela inteira; na prévia do painel, a moldura do celular. */
  altura?: string;
}) {
  const { tema, blocos } = versao;

  // Só a PRIMEIRA vitrine com produto carrega a foto com prioridade: é ela que
  // aparece na primeira tela.
  const primeiraVitrine = blocos.find(
    (b) => b.tipo === "vitrine" && (dados.vitrines[b.id]?.length ?? 0) > 0,
  )?.id;

  return (
    <div
      data-tema={tema}
      style={variaveisDoTema(tema)}
      className={`bio-pagina relative ${altura} overflow-x-clip bg-[var(--bio-fundo)] text-[var(--bio-texto)]`}
    >
      <Enfeites tema={tema} />
      <main className="relative z-10 mx-auto max-w-[30rem] px-4 pb-12 pt-8">
        <Cabecalho nome={cabecalho.nome} frase={cabecalho.frase} />

        <div className="mt-7 space-y-7">
          {blocos.map((bloco) => {
            switch (bloco.tipo) {
              case "campanha":
                return <BlocoCampanha key={bloco.id} bloco={bloco} fimDaCampanha={versao.fim} />;
              case "captura":
                return (
                  <section key={bloco.id} data-regiao={`bio-${bloco.id}`}>
                    <Captura bloco={bloco} campanha={versao.codigo} />
                  </section>
                );
              case "vitrine": {
                const produtos = dados.vitrines[bloco.id] ?? [];
                // Categoria de campanha ainda vazia na loja: o bloco some, em vez
                // de mostrar um título em cima do nada.
                if (produtos.length === 0) return null;
                return (
                  <section key={bloco.id} data-regiao={`bio-${bloco.id}`}>
                    <TituloDaVitrine titulo={bloco.titulo} verTudo={bloco.verTudo} />
                    <Carrossel
                      lista={{ id: `bio_${bloco.id}`, nome: `Bio: ${bloco.titulo}` }}
                      produtos={produtos}
                      rotuloComprar={bloco.rotuloComprar}
                      prioridade={bloco.id === primeiraVitrine}
                      chapeu={tema === "natal"}
                    />
                  </section>
                );
              }
              case "links":
                return <BlocoLinks key={bloco.id} bloco={bloco} />;
              case "lojas":
                return <BlocoLojas key={bloco.id} bloco={bloco} lojas={dados.lojas} />;
            }
          })}
        </div>

        <Rodape />
      </main>
    </div>
  );
}
