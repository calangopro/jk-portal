import type { CSSProperties } from "react";
import { ArrowUpRight } from "lucide-react";
import { LinkRapido } from "@/components/ui/LinkRapido";
import type { Area } from "@/lib/auth/acessos";
import { setoresDe, type SetorId } from "@/lib/painel/setores";

/**
 * As salas do escritório, na Visão geral: um cartão por setor, com a cor dele
 * e o número que resume o que acontece lá dentro. É a porta de cada setor para
 * quem chega pela Diretoria.
 *
 * O número vem pronto de quem chama, e só para os setores que têm um. Setor
 * sem número mostra a frase dele: melhor uma frase verdadeira do que um zero
 * inventado para preencher o cartão.
 */
export type NumerosDasSalas = Partial<Record<SetorId, { valor: string; apoio: string }>>;

export function Salas({ areas, numeros }: { areas: Area[]; numeros: NumerosDasSalas }) {
  // A própria Diretoria fica de fora: a pessoa já está nela.
  const setores = setoresDe(areas).filter((s) => s.id !== "diretoria");
  if (setores.length === 0) return null;

  return (
    <section className="mt-8" aria-label="Setores">
      <p className="eyebrow">Setores</p>
      <ul className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {setores.map((s) => {
          const n = numeros[s.id];
          return (
            <li key={s.id} style={{ "--setor": s.cor } as CSSProperties}>
              <LinkRapido
                href={s.itens[0].href}
                className="painel-toque glass flex h-full min-h-[7.5rem] flex-col rounded-[16px] p-3.5 transition-shadow hover:shadow-md"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="painel-selo painel-selo-ativo grid h-8 w-8 shrink-0 place-items-center rounded-[10px]">
                    <s.Icone size={15} aria-hidden="true" />
                  </span>
                  <ArrowUpRight size={15} className="painel-cor shrink-0" aria-hidden="true" />
                </span>
                <span className="painel-cor mt-2.5 block text-[0.7rem] font-bold uppercase tracking-wider">{s.nome}</span>
                {n ? (
                  <>
                    <span className="font-display numeros mt-1 block text-xl leading-tight text-ink">{n.valor}</span>
                    <span className="mt-0.5 block text-[0.7rem] leading-snug text-muted">{n.apoio}</span>
                  </>
                ) : (
                  <span className="mt-1 block text-[0.78rem] leading-snug text-ink/80">{s.frase}</span>
                )}
              </LinkRapido>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
