import { produtosPorLargura } from "@/lib/data/produtos";
import { precoLegivel } from "@/lib/data/produtos";

/**
 * Peças reais na largura mais vendida, como saída do simulador.
 *
 * Ferramenta sem saída entretém e não converte. O preço é o sincronizado da
 * Tray, e produto sem preço não aparece: a regra do projeto é nunca anunciar
 * valor que possa estar velho.
 *
 * A largura de 4 mm é a de maior volume no catálogo hoje. Ficar preso a ela é
 * uma simplificação consciente: o simulador roda no navegador e a vitrine no
 * servidor, então acompanhar a escolha da pessoa exigiria tornar a página
 * dinâmica, o que custaria o HTML pronto que a busca precisa.
 */
export async function VitrineDaFerramenta({ className = "" }: { className?: string }) {
  const produtos = await produtosPorLargura(4, 4);
  if (produtos.length === 0) return null;

  return (
    <section className={`max-w-leitura-larga ${className}`}>
      <h2 className="font-display text-titulo-secao text-ink">Alianças de 4 mm na loja</h2>
      <p className="mt-2 text-apoio text-muted">
        A largura com mais opções no catálogo da JK. A compra acontece na loja
        oficial.
      </p>

      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {produtos.map((p) => {
          const preco = precoLegivel(p.precoPromocional ?? p.preco);
          return (
            <li key={p.id}>
              <a
                href={p.href}
                target="_blank"
                rel="noopener sponsored"
                data-evento="clique_produto"
                data-produto-nome={p.nome}
                className="glass block h-full rounded-[16px] p-4 transition-colors hover:border-brand/50"
              >
                {p.imagem ? (
                  // Imagem da Tray, em domínio que o next/image não conhece.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.imagem}
                    alt={p.nome}
                    loading="lazy"
                    decoding="async"
                    className="aspect-square w-full rounded-[10px] object-cover"
                  />
                ) : null}
                <p className="mt-3 text-sm leading-snug text-ink">{p.nome}</p>
                {preco ? (
                  <p className="mt-1 font-display text-lg text-brand-strong">{preco}</p>
                ) : null}
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
