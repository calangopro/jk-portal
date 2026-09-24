import { blocosDoDia, temaDoDia } from "@/lib/bio/agenda";
import { variaveisDoTema } from "@/lib/bio/temas";
import type { Bio, ProdutoDaBio, TemaDaBio } from "@/lib/bio/tipos";
import type { Location } from "@/lib/content/types";
import { BlocoCampanha, BlocoLinks, BlocoLojas, Cabecalho, Rodape, TituloDaVitrine } from "./Blocos";
import { Captura } from "./Captura";
import { Carrossel } from "./Carrossel";

/**
 * Código da campanha nos eventos de captura, o MESMO que o tema da loja manda
 * em `jk_campanha` (`esq`, `black`). Relatório que junta loja e bio precisa do
 * mesmo valor dos dois lados.
 */
const CAMPANHA_DO_TEMA: Record<TemaDaBio, string> = { padrao: "", esquenta: "esq", black: "black" };

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
 */
export function CorpoDaBio({
  bio,
  hoje,
  dados,
  altura = "min-h-dvh",
}: {
  bio: Bio;
  hoje: string;
  dados: DadosDaBio;
  /** Na página é a tela inteira; na prévia do painel, a moldura do celular. */
  altura?: string;
}) {
  const tema = temaDoDia(bio, hoje);
  const blocos = blocosDoDia(bio, hoje);
  const campanha = CAMPANHA_DO_TEMA[tema];

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
      <span
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-72 w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--bio-brilho)] blur-3xl"
      />

      <main className="relative mx-auto max-w-[30rem] px-4 pb-12 pt-8">
        <Cabecalho nome={bio.cabecalho.nome} frase={bio.cabecalho.frase} />

        <div className="mt-7 space-y-7">
          {blocos.map((bloco) => {
            switch (bloco.tipo) {
              case "campanha":
                return <BlocoCampanha key={bloco.id} bloco={bloco} />;
              case "captura":
                return (
                  <section key={bloco.id} data-regiao={`bio-${bloco.id}`}>
                    <Captura bloco={bloco} campanha={campanha} />
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
