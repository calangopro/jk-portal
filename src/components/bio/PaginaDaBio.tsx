import { getPublishedLocations } from "@/lib/data/locations";
import { blocosDoDia, temaDoDia } from "@/lib/bio/agenda";
import { produtosDaVitrine } from "@/lib/bio/produtos";
import { corDaBarra } from "@/lib/bio/temas";
import type { Bio } from "@/lib/bio/tipos";
import { CorpoDaBio, type DadosDaBio } from "./CorpoDaBio";

/**
 * A bio montada para um dia, com os dados buscados no servidor.
 *
 * Recebe o dia de fora, e não lê o relógio aqui dentro, para a prévia poder
 * mostrar como a página vai estar em 01/11 sem esperar novembro. O desenho
 * mora em `CorpoDaBio`, que é o mesmo da prévia do painel.
 */
export async function PaginaDaBio({ bio, hoje }: { bio: Bio; hoje: string }) {
  const tema = temaDoDia(bio, hoje);
  const blocos = blocosDoDia(bio, hoje);

  // Só busca produto de vitrine que aparece HOJE: a da Black não gasta pedido
  // à loja em outubro.
  const vitrines = blocos.filter((b) => b.tipo === "vitrine");
  const [produtos, lojas] = await Promise.all([
    Promise.all(vitrines.map((b) => produtosDaVitrine(b.fonte, b.limite))),
    blocos.some((b) => b.tipo === "lojas") ? getPublishedLocations() : Promise.resolve([]),
  ]);

  const dados: DadosDaBio = {
    vitrines: Object.fromEntries(vitrines.map((b, i) => [b.id, produtos[i]])),
    lojas,
  };

  return (
    <>
      {/* Fundo da janela inteira na cor do tema, inclusive o que aparece no
          "puxar" da rolagem do iPhone. É um <style> comum, sem `precedence`,
          de propósito: assim o React tira ele da página quando a pessoa
          navega para outra rota, e o carvão não vaza para o resto do site. */}
      <style>{`html,body{background:${corDaBarra(tema)}}`}</style>
      <CorpoDaBio bio={bio} hoje={hoje} dados={dados} />
    </>
  );
}
