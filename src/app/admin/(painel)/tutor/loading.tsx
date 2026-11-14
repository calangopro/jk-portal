import { Skeleton } from "@/components/ui/states";

/** Esqueleto do tutor: o título e a caixa da pergunta. */
export default function Carregando() {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Carregando o tutor</span>
      <Skeleton className="h-3 w-14" />
      <Skeleton className="mt-3 h-9 w-32" />
      <div className="glass mt-6 rounded-[18px] p-5">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="mt-3 h-11 w-40 rounded-full" />
      </div>
    </div>
  );
}
