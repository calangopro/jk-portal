"use client";

import { useEffect, useMemo, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { CorpoDaBio } from "@/components/bio/CorpoDaBio";
import type { Bio, BlocoDe, ProdutoDaBio, VersaoDaBio } from "@/lib/bio/tipos";
import type { Location } from "@/lib/content/types";
import { produtosParaPrevia } from "./actions";

/**
 * A aba aberta, desenhada no celular enquanto a pessoa edita.
 *
 * Desenha com o MESMO `CorpoDaBio` da página pública, então o que aparece aqui
 * é o que vai ao ar. Os produtos vêm da mesma busca ao vivo da loja, pedida ao
 * servidor meio segundo depois da última mudança na vitrine.
 *
 * Nada aqui navega nem envia: clique em link fica na prévia, e o formulário do
 * grupo não manda contato de teste para a base.
 */
export function Previa({
  cabecalho,
  versao,
  lojas,
  legenda,
}: {
  cabecalho: Bio["cabecalho"];
  versao: VersaoDaBio;
  lojas: Location[];
  legenda: string;
}) {
  const [produtos, setProdutos] = useState<Record<string, ProdutoDaBio[]>>({});
  const [carregando, setCarregando] = useState(false);

  // A mesma fonte com o mesmo limite dá os mesmos produtos, então trocar título
  // ou cor não pede nada de novo à loja.
  const vitrines = useMemo(
    () =>
      versao.blocos
        .filter((b): b is BlocoDe<"vitrine"> => b.tipo === "vitrine")
        .map((b) => ({ id: b.id, chave: JSON.stringify([b.fonte, b.limite]), fonte: b.fonte, limite: b.limite })),
    [versao],
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

  return (
    <div>
      <p className="mb-3 flex min-h-5 flex-wrap items-center gap-x-2 text-[0.72rem] text-muted">
        <span className="font-semibold text-ink">{legenda}</span>
        {carregando ? (
          <span className="inline-flex items-center gap-1 text-brand-strong">
            <LoaderCircle size={12} className="animate-spin" aria-hidden /> buscando produtos na loja
          </span>
        ) : null}
      </p>

      {/* Moldura de celular de 390 px, a largura de um iPhone comum. A página
          dentro rola sozinha, como no aparelho. A altura cede em tela baixa,
          senão a prévia presa no topo teria a parte de baixo cortada. */}
      <div className="mx-auto w-[390px] max-w-full rounded-[42px] border-[10px] border-ink bg-ink shadow-[var(--jk-sombra-modal)]">
        <div
          className="h-[min(720px,calc(100dvh-11rem))] overflow-y-auto overflow-x-hidden rounded-[32px] [scrollbar-width:thin]"
          onClickCapture={(e) => {
            if ((e.target as HTMLElement).closest("a")) e.preventDefault();
          }}
          onSubmitCapture={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <CorpoDaBio cabecalho={cabecalho} versao={versao} dados={dados} altura="min-h-full" />
        </div>
      </div>
      <p className="mt-2 text-center text-[0.68rem] text-muted">
        Na prévia os links não abrem e o formulário não envia.
      </p>
    </div>
  );
}
