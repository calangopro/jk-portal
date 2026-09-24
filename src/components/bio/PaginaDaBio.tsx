import { getPublishedLocations } from "@/lib/data/locations";
import { blocosDoDia, temaDoDia } from "@/lib/bio/agenda";
import { produtosDaVitrine } from "@/lib/bio/produtos";
import { corDaBarra, variaveisDoTema } from "@/lib/bio/temas";
import type { Bio, TemaDaBio } from "@/lib/bio/tipos";
import { BlocoCampanha, BlocoLinks, BlocoLojas, Cabecalho, Rodape, TituloDaVitrine } from "./Blocos";
import { Captura } from "./Captura";
import { Carrossel } from "./Carrossel";

/**
 * Código da campanha nos eventos de captura, o MESMO que o tema da loja manda
 * em `jk_campanha` (`esq`, `black`). Relatório que junta loja e bio precisa do
 * mesmo valor dos dois lados.
 */
const CAMPANHA_DO_TEMA: Record<TemaDaBio, string> = { padrao: "", esquenta: "esq", black: "black" };

/**
 * A bio montada para um dia.
 *
 * Recebe o dia de fora, e não lê o relógio aqui dentro, para a prévia do painel
 * poder mostrar como a página vai estar em 01/11 sem esperar novembro.
 */
export async function PaginaDaBio({ bio, hoje }: { bio: Bio; hoje: string }) {
  const tema = temaDoDia(bio, hoje);
  const blocos = blocosDoDia(bio, hoje);
  const campanha = CAMPANHA_DO_TEMA[tema];

  const [vitrines, lojas] = await Promise.all([
    Promise.all(
      blocos.map((b) => (b.tipo === "vitrine" ? produtosDaVitrine(b.fonte, b.limite) : Promise.resolve([]))),
    ),
    blocos.some((b) => b.tipo === "lojas") ? getPublishedLocations() : Promise.resolve([]),
  ]);

  // Só a PRIMEIRA vitrine com produto carrega a foto com prioridade: é ela que
  // aparece na primeira tela.
  const primeiraVitrine = blocos.findIndex((b, i) => b.tipo === "vitrine" && vitrines[i].length > 0);

  return (
    <div
      data-tema={tema}
      style={variaveisDoTema(tema)}
      className="bio-pagina relative min-h-dvh overflow-x-clip bg-[var(--bio-fundo)] text-[var(--bio-texto)]"
    >
      {/* Fundo da janela inteira na cor do tema, inclusive o que aparece no
          "puxar" da rolagem do iPhone. É um <style> comum, sem `precedence`,
          de propósito: assim o React tira ele da página quando a pessoa
          navega para outra rota, e o carvão não vaza para o resto do site. */}
      <style>{`html,body{background:${corDaBarra(tema)}}`}</style>

      <span
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-72 w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--bio-brilho)] blur-3xl"
      />

      <main className="relative mx-auto max-w-[30rem] px-4 pb-12 pt-8">
        <Cabecalho nome={bio.cabecalho.nome} frase={bio.cabecalho.frase} />

        <div className="mt-7 space-y-7">
          {blocos.map((bloco, i) => {
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
                const produtos = vitrines[i];
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
                      prioridade={i === primeiraVitrine}
                    />
                  </section>
                );
              }
              case "links":
                return <BlocoLinks key={bloco.id} bloco={bloco} />;
              case "lojas":
                return <BlocoLojas key={bloco.id} bloco={bloco} lojas={lojas} />;
            }
          })}
        </div>

        <Rodape />
      </main>
    </div>
  );
}
