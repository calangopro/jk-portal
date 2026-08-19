import { Skeleton } from "@/components/ui/states";

/**
 * Tela de espera do painel.
 *
 * Vale para toda rota de `(painel)` que não tenha um `loading.tsx` mais
 * específico. Não é enfeite: com este arquivo no lugar, o Next passa a
 * pré-carregar a casca da rota no `hover` do link, então o esqueleto aparece no
 * mesmo instante do clique, e só o conteúdo espera o servidor. Sem ele, o
 * padrão do Next é não buscar nada de rota dinâmica antes do clique, e a tela
 * fica congelada na página anterior.
 *
 * O desenho imita a forma das telas do painel (chapéu, título, linha de apoio e
 * uma pilha de cartões), porque esqueleto que não tem a forma do que vem depois
 * faz a página pular quando o conteúdo chega.
 */
export default function Carregando() {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Carregando a página</span>

      <header>
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-3 h-9 w-64" />
        <Skeleton className="mt-4 h-4 w-full max-w-md" />
      </header>

      <div className="mt-10 space-y-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="glass flex items-center gap-4 rounded-[14px] px-5 py-4"
            // Escalona a opacidade para o bloco parecer profundidade e não
            // uma lista de verdade com cinco itens.
            style={{ opacity: 1 - i * 0.14 }}
          >
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="mt-2 h-3 w-1/2" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
