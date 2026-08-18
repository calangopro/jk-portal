import { materiaisComparados } from "@/lib/data/materiais";
import { AliancaEm3D } from "./AliancaEm3D";

/**
 * Comparador de materiais.
 *
 * São duas peças com trabalhos diferentes, e é de propósito que elas não se
 * misturem.
 *
 * A TABELA é servidor puro, sem uma linha de JavaScript. Tabela de comparação é
 * o formato que os sistemas de IA extraem melhor, e para isso ela precisa estar
 * no HTML da primeira resposta, não montada depois no navegador.
 *
 * O VISOR 3D é a parte que texto nenhum resolve. Material de joia se decide
 * pelo brilho, e brilho é movimento: a diferença entre a prata e o ouro 18k
 * aparece quando a luz corre pela peça, não numa palavra da coluna. Ele carrega
 * sozinho, depois, e só quando chega na tela. Se não carregar, a tabela abaixo
 * continua inteira.
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
      <h2 className="font-display text-titulo-secao text-ink">A aliança em 3D</h2>
      <p className="mt-3 max-w-leitura-larga text-corpo leading-relaxed text-muted">
        Metal polido não tem cor própria: ele devolve a luz do lugar onde está.
        Por isso a diferença entre a prata e o ouro 18k aparece quando a peça
        gira, e não numa palavra da tabela. Gire a aliança abaixo e troque o
        modelo, o formato e o material.
      </p>

      <AliancaEm3D
        className="mt-6 mb-12"
        materiais={materiais.map((m) => ({
          slug: m.slug,
          nome: m.nome,
          produtos: m.produtos,
          precoMediano: m.precoMediano,
        }))}
      />

      <h2 className="font-display text-titulo-secao text-ink">
        Os materiais lado a lado
      </h2>

      {/* No celular a tabela não cabe, e sem aviso ninguém descobre que ela rola:
          a pessoa lê três colunas e conclui que o resto não existe. Encolher a
          tabela até caber deixaria a fonte pequena demais para comparar número. */}
      <p className="mt-3 text-nota text-muted sm:hidden">
        Arraste a tabela para o lado para ver todas as colunas.
      </p>

      <div className="rolagem-discreta mt-6 overflow-x-auto">
        <table className="conteudo-rico w-full min-w-[46rem] border-collapse text-apoio">
          <caption className="pb-3 text-left text-nota text-muted">
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
                  <span className="text-nota">
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

      <p className="mt-4 text-nota leading-relaxed text-muted">
        O valor em destaque é a mediana do catálogo, o número que melhor resume o
        grupo. A faixa abaixo dele deixa de fora os 10% mais baratos e os 10%
        mais caros, porque um caso fora da curva distorceria a leitura. Preço,
        estoque e compra ficam na loja oficial da JK Alianças.
      </p>
    </div>
  );
}
