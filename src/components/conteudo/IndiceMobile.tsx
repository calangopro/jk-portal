import { List, ChevronDown } from "lucide-react";
import { IndiceAtivo } from "./IndiceAtivo";
import type { ItemIndice } from "@/lib/content/indice";

/**
 * Índice recolhível do celular, logo abaixo do cabeçalho.
 *
 * Antes o índice só existia na coluna lateral, que no celular cai depois de
 * todo o texto. Índice que aparece no fim do artigo não navega nada.
 */
export function IndiceMobile({ itens }: { itens: ItemIndice[] }) {
  if (itens.length < 2) return null;

  return (
    <details className="acordeao glass-sutil group mt-10 rounded-lg lg:hidden">
      <summary className="flex items-center justify-between gap-3 px-4 py-3.5">
        <span className="eyebrow flex items-center gap-1.5">
          <List size={12} aria-hidden /> Neste guia
        </span>
        <span className="flex items-center gap-1.5 text-nota text-muted">
          {itens.length} seções
          <ChevronDown
            size={16}
            aria-hidden
            className="text-brand-nav transition-transform duration-300 group-open:rotate-180"
          />
        </span>
      </summary>
      <div className="acordeao-corpo">
        <div>
          <div className="px-4 pb-4">
            <IndiceAtivo itens={itens} className="[&>p]:sr-only" />
          </div>
        </div>
      </div>
    </details>
  );
}
