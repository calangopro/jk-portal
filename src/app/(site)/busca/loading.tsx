import { Container } from "@/components/layout/Container";
import { Skeleton } from "@/components/ui/states";

/**
 * Tela de espera da busca.
 *
 * A busca é a única rota do site público que consulta o banco a cada visita
 * (`force-dynamic`), então é a única que faz a pessoa esperar de verdade. O
 * resto do site é servido pronto e trocado no clique.
 */
export default function CarregandoBusca() {
  return (
    <main>
      <Container size="wide" className="py-14 sm:py-20">
        <div role="status" aria-live="polite" aria-busy="true">
          <span className="sr-only">Buscando</span>

          <Skeleton className="h-10 w-2/3 max-w-lg" />
          <Skeleton className="mt-7 h-12 w-full max-w-2xl rounded-full" />
          <Skeleton className="mt-4 h-4 w-40" />

          <div className="mt-12 space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="glass-card rounded-lg p-5"
                style={{ opacity: 1 - i * 0.16 }}
              >
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="mt-3 h-4 w-full" />
                <Skeleton className="mt-2 h-4 w-4/5" />
              </div>
            ))}
          </div>
        </div>
      </Container>
    </main>
  );
}
