"use client";

import { useEffect, useMemo, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { CorpoDaBio } from "@/components/bio/CorpoDaBio";
import { blocosDoDia, temaDoDia } from "@/lib/bio/agenda";
import type { Bio, BlocoDe, ProdutoDaBio } from "@/lib/bio/tipos";
import type { Location } from "@/lib/content/types";
import { produtosParaPrevia } from "./actions";

const NOME_DO_TEMA = { padrao: "Padrão", esquenta: "Esquenta", black: "Black" } as const;

function dataLegivel(dia: string) {
  const [a, m, d] = dia.split("-");
  return `${d}/${m}/${a}`;
}

/** Um dia no meio da campanha, para a prévia não cair no primeiro dia de contador cheio. */
function diaDaCampanha(inicio: string, fim: string): string {
  const i = Date.parse(`${inicio}T12:00:00-03:00`);
  const f = Date.parse(`${fim}T12:00:00-03:00`);
  const meio = new Date(i + Math.max(0, (f - i) / 3));
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(meio);
}

/**
 * A bio no celular, enquanto a pessoa edita.
 *
 * Desenha com o MESMO `CorpoDaBio` da página pública, então o que aparece aqui
 * é o que vai ao ar. Os produtos vêm da mesma busca ao vivo da loja, pedida ao
 * servidor meio segundo depois da última mudança na vitrine.
 *
 * Nada aqui navega nem envia: clique em link fica na prévia, e o formulário do
 * grupo não manda contato de teste para a base.
 */
export function Previa({ bio, lojas, hoje }: { bio: Bio; lojas: Location[]; hoje: string }) {
  const [dia, setDia] = useState(hoje);
  const [produtos, setProdutos] = useState<Record<string, ProdutoDaBio[]>>({});
  const [carregando, setCarregando] = useState(false);

  // Chave de cada vitrine: a mesma fonte e o mesmo limite dão os mesmos produtos,
  // então não se pede de novo à loja por mudança de título ou de cor.
  const vitrines = useMemo(
    () =>
      blocosDoDia(bio, dia)
        .filter((b): b is BlocoDe<"vitrine"> => b.tipo === "vitrine")
        .map((b) => ({ id: b.id, chave: JSON.stringify([b.fonte, b.limite]), fonte: b.fonte, limite: b.limite })),
    [bio, dia],
  );
  const faltando = vitrines.filter((v) => !(v.chave in produtos));
  const assinaturaFaltando = faltando.map((v) => v.chave).join("|");

  useEffect(() => {
    if (faltando.length === 0) return;
    let vivo = true;
    setCarregando(true);
    const espera = window.setTimeout(async () => {
      const pares = await Promise.all(
        faltando.map(async (v) => [v.chave, await produtosParaPrevia(v.fonte, v.limite)] as const),
      );
      if (!vivo) return;
      setProdutos((atual) => ({ ...atual, ...Object.fromEntries(pares) }));
      setCarregando(false);
    }, 500);
    return () => {
      vivo = false;
      window.clearTimeout(espera);
    };
    // `faltando` muda de identidade a cada render; a assinatura é o que importa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assinaturaFaltando]);

  const dados = {
    vitrines: Object.fromEntries(vitrines.map((v) => [v.id, produtos[v.chave] ?? []])),
    lojas,
  };

  const atalhos = [
    { rotulo: "Hoje", dia: hoje },
    ...bio.campanhas.map((c) => ({ rotulo: NOME_DO_TEMA[c.tema], dia: diaDaCampanha(c.inicio, c.fim) })),
  ];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted">Ver como fica</span>
        {atalhos.map((a) => (
          <button
            key={a.rotulo}
            type="button"
            onClick={() => setDia(a.dia)}
            aria-pressed={dia === a.dia}
            className={`rounded-full px-3 py-1 text-[0.72rem] font-semibold transition-colors ${
              dia === a.dia ? "bg-ink text-white" : "border border-ink/15 text-ink hover:border-brand/50"
            }`}
          >
            {a.rotulo}
          </button>
        ))}
        <input
          type="date"
          value={dia}
          onChange={(e) => e.target.value && setDia(e.target.value)}
          aria-label="Outra data"
          className="rounded-full border border-ink/15 bg-white/80 px-2.5 py-1 text-[0.72rem] text-ink"
        />
      </div>

      <p className="mb-2 flex items-center gap-2 text-[0.72rem] text-muted">
        Em {dataLegivel(dia)}, tema {NOME_DO_TEMA[temaDoDia(bio, dia)]}.
        {carregando ? (
          <span className="inline-flex items-center gap-1 text-brand-strong">
            <LoaderCircle size={12} className="animate-spin" aria-hidden /> buscando produtos na loja
          </span>
        ) : null}
      </p>

      {/* Moldura de celular de 390 px, a largura de um iPhone comum. A página
          dentro rola sozinha, como no aparelho. */}
      <div className="mx-auto w-[390px] max-w-full rounded-[42px] border-[10px] border-ink bg-ink shadow-[var(--jk-sombra-modal)]">
        <div
          className="h-[720px] overflow-y-auto overflow-x-hidden rounded-[32px] [scrollbar-width:thin]"
          onClickCapture={(e) => {
            if ((e.target as HTMLElement).closest("a")) e.preventDefault();
          }}
          onSubmitCapture={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <CorpoDaBio bio={bio} hoje={dia} dados={dados} altura="min-h-full" />
        </div>
      </div>
      <p className="mt-2 text-center text-[0.68rem] text-muted">
        Na prévia os links não abrem e o formulário não envia.
      </p>
    </div>
  );
}
