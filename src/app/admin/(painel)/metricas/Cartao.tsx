import type { Eye } from "lucide-react";

/** Número grande com rótulo, usado nos topos do Search Console e do GA4. */
export function Cartao({
  Icone, rotulo, valor, apoio,
}: {
  Icone: typeof Eye;
  rotulo: string;
  valor: string;
  apoio: string;
}) {
  return (
    <div className="glass rounded-[18px] p-5">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-[8px] border border-brand/30 bg-brand/10 text-brand-nav">
          <Icone size={14} />
        </span>
        <p className="eyebrow text-[0.62rem]">{rotulo}</p>
      </div>
      <p className="font-display mt-3 text-4xl text-ink">{valor}</p>
      <p className="mt-1 text-xs text-muted">{apoio}</p>
    </div>
  );
}

export function numero(n: number) {
  return n.toLocaleString("pt-BR", { maximumFractionDigits: n < 10 ? 1 : 0 });
}
