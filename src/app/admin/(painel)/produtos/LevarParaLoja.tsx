"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FileUp, Loader2 } from "lucide-react";
import { montarPlanilhaDeFotos, PlanilhaInvalida, type ResultadoDaPlanilha } from "@/lib/catalogo/planilha-tray";
import { fotosParaPlanilha, marcarNaPlanilha } from "./actions";

/**
 * Leva as fotos aprovadas para a Tray.
 *
 * A planilha é montada AQUI, no navegador, a partir da exportação que a pessoa
 * acabou de baixar da Tray: o arquivo tem uns 8 MB e uma Server Action aceita
 * 1 MB. Só a lista de fotos aprovadas vem do servidor. O porquê de partir da
 * exportação (e não de uma planilha só com as imagens) está em
 * `lib/catalogo/planilha-tray.ts`.
 */
export function LevarParaLoja({ aprovados }: { aprovados: number }) {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [trabalhando, setTrabalhando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Omit<ResultadoDaPlanilha, "arquivo"> | null>(null);

  const montar = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    setErro(null);
    setResultado(null);
    setTrabalhando(true);
    try {
      const r = await fotosParaPlanilha();
      if (!r.ok) throw new Error(r.erro);
      if (!r.pedidos.length) throw new Error("Nenhuma foto aprovada esperando ir para a loja.");

      const planilha = montarPlanilhaDeFotos(new Uint8Array(await arquivo.arrayBuffer()), r.pedidos);
      const { arquivo: bytes, ...resumo } = planilha;
      setResultado(resumo);

      if (planilha.incluidos.length) {
        const blob = new Blob([bytes as BlobPart], { type: "text/csv;charset=iso-8859-1" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `fotos-para-a-tray-${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);

        const incluidos = new Set(planilha.incluidos);
        const ids = r.pedidos.filter((p) => incluidos.has(p.codigo)).flatMap((p) => p.fotoIds);
        await marcarNaPlanilha(ids);
        router.refresh();
      }
    } catch (e) {
      setErro(
        e instanceof PlanilhaInvalida || e instanceof Error ? e.message : "Não deu para montar a planilha.",
      );
    } finally {
      setTrabalhando(false);
      if (entrada.current) entrada.current.value = "";
    }
  };

  return (
    <div className="glass rounded-[20px] p-5">
      <p className="text-sm font-semibold text-ink">Levar para a loja</p>
      <p className="mt-1 text-sm text-muted">
        <span className="font-display text-2xl text-ink">{aprovados.toLocaleString("pt-BR")}</span>{" "}
        {aprovados === 1 ? "produto com foto aprovada" : "produtos com foto aprovada"}
      </p>

      <ol className="mt-3 list-decimal space-y-1 pl-4 text-xs leading-relaxed text-muted">
        <li>Na Tray, exporte os produtos agora (a mesma planilha de sempre).</li>
        <li>Escolha o arquivo aqui. Volta uma planilha só com as fotos novas.</li>
        <li>
          Importe essa planilha na Tray logo em seguida: ela regrava a linha inteira de cada produto, inclusive o estoque
          daquele momento. Na primeira vez, teste com um produto só.
        </li>
      </ol>

      <label
        className={`mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${
          aprovados && !trabalhando ? "cursor-pointer bg-ink text-white hover:bg-charcoal" : "bg-ink/10 text-muted"
        }`}
      >
        {trabalhando ? <Loader2 size={14} className="animate-spin" /> : <FileUp size={14} />}
        {trabalhando ? "Montando…" : "Escolher a exportação da Tray"}
        <input
          ref={entrada}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          disabled={!aprovados || trabalhando}
          onChange={(e) => montar(e.target.files?.[0])}
        />
      </label>

      {erro ? (
        <p role="alert" className="mt-3 text-xs text-wine">
          {erro}
        </p>
      ) : null}

      {resultado ? (
        <div className="mt-3 space-y-2 text-xs" aria-live="polite">
          {resultado.incluidos.length ? (
            <p className="flex items-center gap-1.5 text-brand-strong">
              <Download size={12} /> Planilha baixada com {resultado.incluidos.length}{" "}
              {resultado.incluidos.length === 1 ? "produto" : "produtos"}.
            </p>
          ) : null}
          {resultado.precoDiferente.length ? (
            <div className="rounded-[10px] bg-wine/10 p-3 text-wine">
              <p className="font-semibold">
                {resultado.precoDiferente.length} ficaram de fora porque o preço da exportação não bate com o da loja agora.
                Exporte de novo (ou sincronize, se o preço acabou de mudar) e tente outra vez.
              </p>
              <ul className="mt-1.5 space-y-0.5">
                {resultado.precoDiferente.slice(0, 6).map((p) => (
                  <li key={p.codigo}>
                    {p.nome}: planilha {p.naPlanilha}, loja {p.noPortal}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {resultado.naoAchados.length ? (
            <p className="text-muted">
              {resultado.naoAchados.length} não estão nessa exportação (códigos {resultado.naoAchados.slice(0, 8).join(", ")}).
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
