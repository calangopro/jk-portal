import { Skeleton } from "@/components/ui/states";

/** Esqueleto do chat, no formato dele: as salas, a conversa e o campo de escrever. */
export default function Carregando() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="painel-chat flex gap-4">
      <span className="sr-only">Carregando o chat do time</span>
      <div className="hidden w-60 shrink-0 flex-col gap-3 lg:flex">
        <div className="glass space-y-2 rounded-[18px] p-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-10 w-full rounded-[12px]" />
          ))}
        </div>
        <div className="glass flex-1 space-y-3 rounded-[18px] p-3.5">
          <Skeleton className="h-3 w-24" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-2.5">
              <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
              <Skeleton className="h-4 w-28" />
            </div>
          ))}
        </div>
      </div>
      <div className="glass flex min-w-0 flex-1 flex-col overflow-hidden rounded-[18px]">
        <div className="flex gap-1.5 overflow-hidden border-b border-ink/[0.07] p-2.5 lg:hidden">
          {["w-16", "w-20", "w-20", "w-14", "w-20"].map((w, i) => (
            <Skeleton key={i} className={`h-9 shrink-0 rounded-full ${w}`} />
          ))}
        </div>
        <div className="hidden border-b border-ink/[0.07] px-5 py-3 lg:block">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="mt-1.5 h-3 w-56" />
        </div>
        <div className="flex-1 space-y-3 p-4">
          {[["w-2/3", ""], ["w-1/2", ""], ["w-3/5", "ml-auto"], ["w-2/5", ""], ["w-1/2", "ml-auto"]].map(([w, lado], i) => (
            <Skeleton key={i} className={`h-12 rounded-[16px] ${w} ${lado}`} />
          ))}
        </div>
        <div className="flex items-center gap-2 border-t border-ink/[0.07] p-3">
          <Skeleton className="h-11 flex-1 rounded-full" />
          <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
        </div>
      </div>
    </div>
  );
}
