import type { Metadata } from "next";
import { homeMetadata } from "@/lib/seo/metadata";
import { getPublishedGuias, comCapas } from "@/lib/data/contents";
import { getPublishedLocations } from "@/lib/data/locations";
import { produtosParaVitrine } from "@/lib/data/produtos";
import { lerLayout } from "@/lib/blocos/ler";
import { RenderizarBloco } from "@/components/home/Secoes";

export const metadata: Metadata = homeMetadata();
export const revalidate = 3600; // ISR: HTML estático, revalidado de hora em hora

/**
 * Home montada a partir do layout gravado no banco.
 *
 * A página não decide mais quais seções existem nem em que ordem: ela lê o
 * layout e desenha. Trocar a ordem, ocultar um bloco ou reescrever uma headline
 * deixa de ser mudança de código.
 *
 * Continua sendo Server Component com ISR, então o HTML sai pronto para o
 * Google na primeira resposta. O único pedaço interativo é o campo de busca.
 */
export default async function Home() {
  const [layout, guias, lojas, produtos] = await Promise.all([
    lerLayout("home"),
    comCapas(await getPublishedGuias()),
    getPublishedLocations(),
    produtosParaVitrine(10),
  ]);

  const dados = { guias, lojas, produtos };

  return (
    <main>
      {layout.blocos.map((bloco) => (
        <RenderizarBloco key={bloco.id} bloco={bloco} dados={dados} />
      ))}
    </main>
  );
}
