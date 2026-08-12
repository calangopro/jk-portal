"use client";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Upload, FileSpreadsheet } from "lucide-react";
import { importarSearchConsole, type ImportState } from "./actions";

function Botao() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-brand-light disabled:opacity-60"
    >
      {pending ? "Importando…" : "Importar"}
    </button>
  );
}

export function Importar() {
  const [estado, acao] = useActionState<ImportState, FormData>(importarSearchConsole, {});
  const [csv, setCsv] = useState("");
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const ler = async (arquivo: File) => {
    setNomeArquivo(arquivo.name);
    setCsv(await arquivo.text());
  };

  const hoje = new Date().toISOString().slice(0, 10);
  const tresMeses = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);

  return (
    <form action={acao} className="glass rounded-[18px] p-6">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] border border-brand/30 bg-brand/10 text-brand-nav">
          <FileSpreadsheet size={14} />
        </span>
        <div>
          <p className="text-sm font-semibold text-ink">Importar do Search Console</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted">
            No Search Console, abra Desempenho, clique em Exportar e escolha CSV.
            Envie o arquivo de Consultas ou o de Páginas. Importar de novo o
            mesmo período substitui os dados, sem duplicar.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold text-ink">Período começa em</span>
          <input
            type="date"
            name="periodo_inicio"
            defaultValue={tresMeses}
            required
            className="mt-1 w-full rounded-[10px] border border-border bg-white/80 px-3 py-2 text-sm text-ink outline-none focus:border-brand"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-ink">Período termina em</span>
          <input
            type="date"
            name="periodo_fim"
            defaultValue={hoje}
            required
            className="mt-1 w-full rounded-[10px] border border-border bg-white/80 px-3 py-2 text-sm text-ink outline-none focus:border-brand"
          />
        </label>
      </div>

      <input type="hidden" name="csv" value={csv} />

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="flex items-center gap-2 rounded-full border border-brand/40 bg-brand/8 px-4 py-2 text-xs font-semibold text-brand-nav hover:bg-brand/16"
        >
          <Upload size={13} /> Escolher CSV
        </button>
        {nomeArquivo ? (
          <span className="text-xs text-muted">
            {nomeArquivo}, {csv.split(/\r?\n/).filter(Boolean).length - 1} linhas
          </span>
        ) : (
          <span className="text-xs text-muted">Nenhum arquivo escolhido</span>
        )}
        <input
          ref={input}
          type="file"
          accept=".csv,text/csv"
          hidden
          onChange={(e) => { const f = e.target.files?.[0]; if (f) ler(f); e.target.value = ""; }}
        />
      </div>

      <details className="mt-4">
        <summary className="cursor-pointer text-xs font-semibold text-brand-nav">
          Ou colar o conteúdo direto
        </summary>
        <textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          rows={5}
          placeholder="Principais consultas,Cliques,Impressões,CTR,Posição"
          className="mt-2 w-full resize-y rounded-[10px] border border-border bg-white/80 px-3 py-2 font-mono text-xs text-ink outline-none focus:border-brand"
        />
      </details>

      {estado.erro ? <p className="mt-4 text-sm text-wine">{estado.erro}</p> : null}
      {estado.ok ? <p className="mt-4 text-sm text-brand-strong">{estado.ok}</p> : null}

      <div className="mt-5">
        <Botao />
      </div>
    </form>
  );
}
