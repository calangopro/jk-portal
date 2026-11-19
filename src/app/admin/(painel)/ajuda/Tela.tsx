"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { CircleCheck, Clock, Search } from "lucide-react";
import { tutorialDaTela } from "@/lib/ajuda/indice";
import type { Area } from "@/lib/auth/acessos";
import { nomeDoSetor, setoresDe } from "@/lib/painel/setores";

const Janela = dynamic(() => import("./Janela"), { ssr: false });

const semAcento = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** A lista de todos os tutoriais que a pessoa pode abrir, por setor, com busca. Abrir um usa o mesmo player da janela do topo. */
export function TelaDaAjuda({ papel, areas }: { papel: string; areas: readonly string[] }) {
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState<string | null>(null);
  const grupos = useMemo(() => {
    const q = semAcento(busca.trim());
    return setoresDe(areas as Area[])
      .map((s) => ({
        setor: s,
        itens: s.itens
          .filter((i) => !q || semAcento(`${i.label} ${i.desc} ${nomeDoSetor(s)}`).includes(q))
          .map((i) => ({ item: i, tutorial: tutorialDaTela(i.href) })),
      }))
      .filter((g) => g.itens.length > 0);
  }, [areas, busca]);
  const prontos = grupos.flatMap((g) => g.itens).filter((x) => x.tutorial).length;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-2xl text-ink">Como usar o painel</h1>
      <p className="mt-1 text-sm text-ink/70">
        Um passo a passo animado de cada tela, no jeito do seu nível. Dentro de qualquer tela, o botão Como usar, lá em cima, abre o tutorial dela.
      </p>
      <label className="relative mt-4 block">
        <span className="sr-only">Buscar tutorial</span>
        <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar uma tela"
          className="w-full rounded-full border border-ink/15 bg-white py-2.5 pl-10 pr-4 text-sm text-ink"
        />
      </label>
      <p className="mt-2 text-xs text-muted" aria-live="polite">{prontos} tutoriais prontos nas telas que você abre.</p>

      <div className="mt-4 grid grid-cols-1 gap-4">
        {grupos.map(({ setor, itens }) => (
          <section key={setor.id} aria-labelledby={`aj-${setor.id}`} className="glass rounded-[20px] p-4">
            <h2 id={`aj-${setor.id}`} className="flex items-center gap-2 text-sm font-bold" style={{ color: setor.cor }}>
              <setor.Icone size={15} aria-hidden="true" /> {nomeDoSetor(setor)}
            </h2>
            <ul className="mt-2 grid grid-cols-1 divide-y divide-ink/8">
              {itens.map(({ item, tutorial }) => (
                <li key={item.href}>
                  <button
                    type="button"
                    onClick={() => setAberto(item.href)}
                    disabled={!tutorial}
                    className="flex w-full items-center gap-3 py-3 text-left disabled:cursor-default"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-ink">{item.label}</span>
                      <span className="block text-xs text-muted [overflow-wrap:anywhere]">{tutorial ? tutorial.resumo : item.desc}</span>
                    </span>
                    {tutorial ? (
                      <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-[#1c6b3a]"><CircleCheck size={14} aria-hidden="true" /> Ver</span>
                    ) : (
                      <span className="flex shrink-0 items-center gap-1 text-xs text-muted"><Clock size={14} aria-hidden="true" /> Em breve</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {grupos.length === 0 ? <p className="text-sm text-muted">Nenhuma tela com esse nome. Tente outra palavra.</p> : null}
      </div>

      {aberto ? <Janela href={aberto} papel={papel} areas={areas} aoFechar={() => setAberto(null)} /> : null}
    </div>
  );
}
