"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FileUp, Loader2 } from "lucide-react";
import { montarPlanilhaDePromocao, type ResultadoDaPlanilha } from "@/lib/catalogo/planilha-tray";
import { marcarNaPlanilhaDaTray, pedidosDePromocao } from "../actions";

/**
 * Leva a campanha aprovada para a loja, pelo mesmo caminho das fotos: a
 * exportação da Tray de agora entra, e volta a mesma planilha só com "Preço
 * promoção", "Inicio promoção" e "Fim promoção" trocados nas linhas da
 * campanha (ver `lib/catalogo/planilha-tray.ts`).
 */
export function LevarPromocaoParaLoja({ campanhaId, exportadaEm }: { campanhaId: string; exportadaEm: string | null }) {
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
      const r = await pedidosDePromocao(campanhaId);
      if (!r.ok) throw new Error(r.erro);
      const planilha = montarPlanilhaDePromocao(new Uint8Array(await arquivo.arrayBuffer()), r.pedidos);
      const { arquivo: bytes, ...resumo } = planilha;
      setResultado(resumo);
      if (planilha.incluidos.length) {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "text/csv;charset=iso-8859-1" }));
        link.download = `promocao-para-a-tray-${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
        await marcarNaPlanilhaDaTray(campanhaId);
        router.refresh();
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu para montar a planilha.");
    } finally {
      setTrabalhando(false);
      if (entrada.current) entrada.current.value = "";
    }
  };

  return (
    <div>
      <p className="text-sm font-semibold text-ink">Levar para a loja</p>
      <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs leading-relaxed text-muted">
        <li>Na Tray, exporte os produtos agora.</li>
        <li>Escolha o arquivo aqui. Volta uma planilha só com os produtos da campanha e o preço de promoção com as datas.</li>
        <li>
          Importe essa planilha na Tray logo em seguida: ela regrava a linha inteira de cada produto, inclusive o estoque
          daquele momento. Na primeira vez, teste com um produto só.
        </li>
      </ol>
      {exportadaEm ? (
        <p className="mt-2 text-xs text-brand-strong">
          Planilha já gerada em{" "}
          {new Date(exportadaEm).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}.
        </p>
      ) : null}
      <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-charcoal">
        {trabalhando ? <Loader2 size={14} className="animate-spin" /> : <FileUp size={14} />}
        {trabalhando ? "Montando…" : "Escolher a exportação da Tray"}
        <input ref={entrada} type="file" accept=".csv,text/csv" className="sr-only" disabled={trabalhando} onChange={(e) => montar(e.target.files?.[0])} />
      </label>
      {erro ? (
        <p role="alert" className="mt-2 text-xs text-wine">
          {erro}
        </p>
      ) : null}
      {resultado ? (
        <div className="mt-2 space-y-1 text-xs" aria-live="polite">
          {resultado.incluidos.length ? (
            <p className="flex items-center gap-1.5 text-brand-strong">
              <Download size={12} /> Planilha baixada com {resultado.incluidos.length} produtos.
            </p>
          ) : null}
          {resultado.precoDiferente.length ? (
            <p className="text-wine">
              {resultado.precoDiferente.length} ficaram de fora porque o preço cheio da exportação não bate com o da loja agora:{" "}
              {resultado.precoDiferente.slice(0, 4).map((p) => p.nome).join(", ")}. Exporte de novo e tente outra vez.
            </p>
          ) : null}
          {resultado.naoAchados.length ? (
            <p className="text-muted">{resultado.naoAchados.length} não estão na exportação.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
