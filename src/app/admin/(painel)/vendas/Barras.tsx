/**
 * Gráfico de barras de uma série só, sem biblioteca e sem JavaScript no
 * navegador: a dica aparece por `:hover` e por foco do teclado.
 *
 * Uma série, uma cor (a do setor em que a tela está), sem legenda: o título
 * do bloco já diz o que a barra mede. Com `destaque`, a barra apontada fica na
 * cor cheia e as outras recuam um tom: é a barra de que a frase em cima do
 * gráfico fala ("Melhor dia: 10/11"), e o olho a encontra sem procurar. A escala fica na linha do topo, com o maior valor
 * escrito, e os números de cada barra moram na dica e na tabela que a página
 * oferece logo abaixo. A coluna inteira é a área de toque, não só a barra, para
 * dia fraco não virar alvo de dois pixels.
 */

export type Barra = {
  chave: string;
  /** Texto do eixo, embaixo da barra. Vazio esconde o rótulo. */
  eixo: string;
  valor: number;
  /** Primeira linha da dica: "12/11, quinta". */
  titulo: string;
  /** Segunda linha da dica: "R$ 3.818,26 em 9 pedidos". */
  detalhe: string;
};

export function Barras({ barras, topo, descricao, destaque }: { barras: Barra[]; topo: string; descricao: string; destaque?: string }) {
  const maior = Math.max(...barras.map((b) => b.valor), 0);

  return (
    <div className="mt-5" role="group" aria-label={descricao}>
      <div className="relative">
        {maior > 0 ? (
          <p className="numeros absolute -top-2 left-0 z-[1] bg-transparent pr-2 text-[0.65rem] leading-none text-muted">
            {topo}
          </p>
        ) : null}
        <div className="absolute inset-x-0 top-1.5 border-t border-dashed border-border" aria-hidden />

        <div className="flex h-44 items-end gap-[2px] border-b border-border pt-1.5">
          {barras.map((b, i) => {
            const altura = maior > 0 ? (b.valor / maior) * 100 : 0;
            // Dica das pontas alinhada para dentro, senão sai do cartão.
            const lado =
              i < barras.length / 4
                ? "left-0"
                : i >= (barras.length * 3) / 4
                  ? "right-0"
                  : "left-1/2 -translate-x-1/2";
            return (
              <div
                key={b.chave}
                tabIndex={0}
                aria-label={`${b.titulo}: ${b.detalhe}`}
                className="group relative flex h-full min-w-0 flex-1 items-end rounded-[4px] outline-none focus-visible:ring-2 focus-visible:ring-brand-nav"
              >
                <div
                  className={
                    // A coluna inteira é a área de toque; a barra tem teto de largura
                    // para sete dias não virarem sete blocos.
                    b.valor > 0
                      ? `painel-coluna mx-auto w-full max-w-10 rounded-t-[4px] ${destaque && destaque !== b.chave ? "painel-coluna-recuada" : ""}`
                      : "mx-auto w-full max-w-10 bg-border"
                  }
                  style={{ height: b.valor > 0 ? `max(${altura}%, 3px)` : "2px" }}
                />
                <div
                  role="tooltip"
                  className={`pointer-events-none absolute z-10 hidden whitespace-nowrap rounded-[8px] bg-ink px-2.5 py-1.5 text-left shadow-lg group-hover:block group-focus-visible:block ${lado}`}
                  style={{ bottom: `calc(${altura}% + 8px)` }}
                >
                  <span className="block text-[0.68rem] text-white/75">{b.titulo}</span>
                  <span className="numeros block text-xs font-semibold text-white">{b.detalhe}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-1.5 flex gap-[2px]" aria-hidden>
          {barras.map((b) => (
            <span key={b.chave} className="numeros min-w-0 flex-1 text-center text-[0.62rem] leading-none text-muted">
              {b.eixo}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
