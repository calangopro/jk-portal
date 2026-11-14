"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCw, TriangleAlert } from "lucide-react";

/**
 * Erro de uma tela do painel, desenhado DENTRO do painel.
 *
 * Sem este arquivo o erro subia até `src/app/error.tsx`, que é a página de erro
 * do site público: a pessoa perdia o menu e ganhava um botão "Voltar ao início"
 * que levava para a home do site, fora do painel. Aqui o menu continua no
 * lugar, e as duas saídas são tentar de novo e ir para a Visão geral.
 *
 * O código mostrado é o `digest` que o Next gera: é o que liga esta tela à
 * linha do registro do servidor, sem expor a mensagem técnica.
 */
export default function ErroDoPainel({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[painel]", error);
  }, [error]);

  return (
    <div className="glass mx-auto mt-10 max-w-xl rounded-[18px] p-6" role="alert">
      <p className="flex items-center gap-2 text-base font-semibold text-ink">
        <TriangleAlert size={18} className="shrink-0 text-[#9a4a07]" aria-hidden="true" /> Esta tela não abriu
      </p>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Alguma leitura falhou no caminho. Costuma ser passageiro: tente de novo. O resto do painel continua funcionando
        pelo menu.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={reset} className="painel-toque painel-aba-ativa inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold">
          <RotateCw size={15} aria-hidden="true" /> Tentar de novo
        </button>
        <Link href="/admin" className="painel-toque inline-flex h-11 items-center rounded-full border border-ink/12 bg-white px-5 text-sm font-semibold text-ink">
          Ir para a Visão geral
        </Link>
      </div>
      {error.digest ? <p className="numeros mt-4 text-[0.7rem] text-muted">Se continuar, mande este código para quem cuida do painel: {error.digest}</p> : null}
    </div>
  );
}
