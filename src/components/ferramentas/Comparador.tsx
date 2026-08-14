import { materiaisComparados } from "@/lib/data/materiais";

/**
 * Comparador de materiais.
 *
 * Componente de servidor, sem interatividade, de propósito: uma tabela de
 * comparação é justamente o formato que os sistemas de IA extraem melhor, e ela
 * precisa estar no HTML da primeira resposta, não montada depois por
 * JavaScript. Interação aqui só atrapalharia.
 *
 * Cada coluna tem uma origem diferente, e a página diz qual. Linha que depende
 * de afirmação ainda não aprovada não aparece: é melhor uma tabela menor e
 * verdadeira do que uma completa com número inventado.
 */
export async function Comparador({ className = "" }: { className?: string }) {
  const materiais = await materiaisComparados();
  if (materiais.length === 0) return null;

  const dinheiro = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

  const temDurabilidade = materiais.some((m) => m.durabilidade);
  const temManutencao = materiais.some((m) => m.manutencao);

  return (
    <div className={className}>
      <div className="overflow-x-auto">
        <table className="conteudo-rico w-full min-w-[46rem] border-collapse text-sm">
          <caption className="pb-3 text-left text-xs text-muted">
            Materiais de aliança da JK Alianças: teor, faixa de preço praticada e
            quantidade de modelos no catálogo. Preço lido da loja oficial na hora
            de gerar esta página.
          </caption>
          <thead>
            <tr>
              <th scope="col" className="border-b border-border px-3 py-2 text-left text-ink">
                Material
              </th>
              <th scope="col" className="border-b border-border px-3 py-2 text-left text-ink">
                Teor
              </th>
              <th scope="col" className="border-b border-border px-3 py-2 text-left text-ink">
                Preço típico
              </th>
              <th scope="col" className="border-b border-border px-3 py-2 text-left text-ink">
                Modelos
              </th>
              {temDurabilidade ? (
                <th scope="col" className="border-b border-border px-3 py-2 text-left text-ink">
                  No uso diário
                </th>
              ) : null}
              {temManutencao ? (
                <th scope="col" className="border-b border-border px-3 py-2 text-left text-ink">
                  Manutenção
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {materiais.map((m) => (
              <tr key={m.slug}>
                <th scope="row" className="border-b border-border/60 px-3 py-3 text-left font-medium text-ink">
                  {m.nome}
                </th>
                <td className="border-b border-border/60 px-3 py-3 text-muted">
                  {m.teor ?? "a confirmar"}
                </td>
                <td className="border-b border-border/60 px-3 py-3 text-muted">
                  <span className="block font-medium text-ink">{dinheiro(m.precoMediano)}</span>
                  <span className="text-xs">
                    a maioria entre {dinheiro(m.precoTipicoMin)} e {dinheiro(m.precoTipicoMax)}
                  </span>
                </td>
                <td className="border-b border-border/60 px-3 py-3 tabular-nums text-muted">
                  {m.produtos}
                </td>
                {temDurabilidade ? (
                  <td className="border-b border-border/60 px-3 py-3 text-muted">
                    {m.durabilidade ?? "a confirmar"}
                  </td>
                ) : null}
                {temManutencao ? (
                  <td className="border-b border-border/60 px-3 py-3 text-muted">
                    {m.manutencao ?? "a confirmar"}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-muted">
        O valor em destaque é a mediana do catálogo, o número que melhor resume o
        grupo. A faixa abaixo dele deixa de fora os 10% mais baratos e os 10%
        mais caros, porque um caso fora da curva distorceria a leitura. Preço,
        estoque e compra ficam na loja oficial da JK Alianças.
      </p>
    </div>
  );
}
