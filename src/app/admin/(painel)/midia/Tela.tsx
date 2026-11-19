import { Biblioteca, type Midia } from "./Biblioteca";

/** O desenho da tela, separado da leitura para a demonstração do Como usar. */
export function TelaDaMidia({ itens }: { itens: Midia[] }) {

  return (
    <>
      <header>
        <p className="eyebrow">Conteúdo</p>
        <h1 className="font-display mt-2 text-4xl text-ink">Mídia</h1>
        <p className="mt-3 max-w-2xl text-muted">
          Toda imagem do portal fica aqui, com texto alternativo, legenda e
          crédito. Imagem sem alt não ajuda no Google e falha em acessibilidade,
          então ela aparece marcada.
        </p>
      </header>

      <Biblioteca itens={itens} />
    </>
  );
}
