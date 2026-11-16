"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowUpRight, RefreshCw } from "lucide-react";
import { LigacoesDasRedes } from "@/components/redes/Ligacoes";
import { LinkRapido } from "@/components/ui/LinkRapido";
import type { LigacaoDaRede } from "@/lib/redes/painel";
import type { RespostaDasRedes } from "../actions";

/**
 * "Contas ligadas", só o desenho. Quem tem a área vê o estado de cada rede e
 * pode pedir uma leitura na hora. Os campos de chave não existem nesta tela:
 * ficam em Integrações, para administrador, dono e GM.
 */

function BotaoDeLer() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="painel-toque inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-white/70 px-4 py-2 text-xs font-semibold text-ink transition-colors hover:border-[var(--setor)] disabled:opacity-60"
    >
      <RefreshCw size={13} className={pending ? "animate-spin" : ""} aria-hidden="true" />
      {pending ? "Lendo as redes…" : "Ler agora"}
    </button>
  );
}

export function TelaDeContas({
  ligacoes, agora, podeLigar, retornoBase, lerAgora,
}: {
  ligacoes: LigacaoDaRede[];
  agora: number;
  podeLigar: boolean;
  retornoBase: string;
  lerAgora?: (anterior: RespostaDasRedes, dados: FormData) => Promise<RespostaDasRedes>;
}) {
  const [resposta, acao] = useActionState<RespostaDasRedes, FormData>(lerAgora ?? (async () => ({})), {});
  const ligadas = ligacoes.reduce((n, l) => n + l.contas.filter((c) => c.status === "ativa").length, 0);

  return (
    <div data-painel-largo>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow">Social Media</p>
          <h1 className="font-display mt-2 text-3xl text-ink sm:text-4xl">Contas ligadas</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted sm:text-base">
            O que está ligado ao painel, o que venceu e o que falta para ligar cada rede. O painel lê as contas ligadas sozinho, de meia em meia hora.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {ligadas > 0 && lerAgora ? (
            <form action={acao}>
              <BotaoDeLer />
            </form>
          ) : null}
          {/* Todo nível com a área das redes usa o conector (o Social media, só com as operações das redes). */}
          <LinkRapido href="/admin/conector" className="painel-toque inline-flex items-center gap-1 rounded-full border border-ink/15 bg-white/70 px-4 py-2 text-xs font-semibold text-ink transition-colors hover:border-[var(--setor)]">
            Usar pelo Claude <ArrowUpRight size={13} aria-hidden="true" />
          </LinkRapido>
          {podeLigar ? (
            <LinkRapido href="/admin/integracoes#redes" className="painel-toque inline-flex items-center gap-1 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white">
              Ligar em Integrações <ArrowUpRight size={13} aria-hidden="true" />
            </LinkRapido>
          ) : null}
        </div>
      </header>

      {resposta.erro ? (
        <p role="alert" className="mt-4 text-sm text-wine">
          {resposta.erro}
        </p>
      ) : null}
      {resposta.ok ? (
        <p role="status" className="mt-4 text-sm font-semibold" style={{ color: "#046c4e" }}>
          {resposta.ok}
        </p>
      ) : null}

      {!podeLigar ? (
        <p className="mt-5 max-w-3xl text-xs leading-relaxed text-muted">
          Ligar e desligar conta é de administrador, dono ou GM. Se uma rede aparecer como Ligar de novo, avise um deles.
        </p>
      ) : null}

      <div className="mt-6">
        <LigacoesDasRedes ligacoes={ligacoes} agora={agora} retornoBase={retornoBase} />
      </div>
    </div>
  );
}
