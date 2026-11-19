"use client";

import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { CircleAlert, CircleCheck, ExternalLink, Hammer, Loader2 } from "lucide-react";
import type { ProducaoDoFormulario } from "@/lib/vendas/producao";
import { completarProducao } from "./actions";
import { ProducaoDaVenda, type ProdutoDoFormulario } from "./ProducaoDaVenda";

/**
 * Completar a produção de uma venda que veio da Kommo sem tudo o que a fábrica
 * precisa (cartão 51). É o MESMO pedaço do formulário de venda nova
 * (`ProducaoDaVenda`), já aberto e preenchido com o que o negócio dizia, e com
 * os motivos em cima, para a pessoa saber o que falta.
 */
export type VendaParaCompletar = {
  vendaId: string;
  negocioId: number;
  cliente: string | null;
  dia: string | null;
  motivos: string[];
  formulario: ProducaoDoFormulario | null;
};

const diaCurto = (d: string | null) => (d && /^\d{4}-\d{2}-\d{2}/.test(d) ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : "");

export function CompletarProducao({
  venda, produtos, lojas, aoCompletar = completarProducao,
}: {
  venda: VendaParaCompletar;
  produtos: ProdutoDoFormulario[];
  lojas: string[];
  /** Só para a prévia de desenvolvimento, sem sessão. */
  aoCompletar?: typeof completarProducao;
}) {
  const [enviando, iniciar] = useTransition();
  const [resultado, setResultado] = useState<{ ok: boolean; mensagem: string } | null>(null);

  const aoEnviar = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const producao = String(new FormData(e.currentTarget).get("producao") ?? "");
    setResultado(null);
    iniciar(async () => setResultado(await aoCompletar(venda.vendaId, producao)));
  };

  return (
    <section className="glass mt-6 rounded-[18px] p-5" aria-labelledby="completar-producao">
      <p className="eyebrow">Venda da Kommo</p>
      <h2 id="completar-producao" className="font-display mt-1 text-2xl text-ink">Completar a produção</h2>
      <p className="mt-1 text-sm text-muted [overflow-wrap:anywhere]">
        {[venda.cliente ?? "Cliente sem nome", diaCurto(venda.dia)].filter(Boolean).join(", ")}.{" "}
        <a
          href={`https://kathleengfz.kommo.com/leads/detail/${venda.negocioId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-ink underline decoration-ink/25 underline-offset-4 hover:decoration-ink"
        >
          Negócio {venda.negocioId} na Kommo <ExternalLink size={12} aria-hidden="true" />
        </a>
      </p>
      {venda.motivos.length ? (
        <div className="mt-3 rounded-[12px] px-3 py-2.5 text-sm leading-relaxed" style={{ background: "#fff7e6", color: "#8a4b00" }}>
          <p className="font-semibold">Por que não foi sozinha para a fábrica:</p>
          <ul className="mt-1 list-disc pl-5">
            {venda.motivos.map((m) => (
              <li key={m} className="[overflow-wrap:anywhere]">{m}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {resultado?.ok ? (
        <p role="status" className="mt-4 flex items-start gap-2 rounded-[12px] px-3 py-2.5 text-sm" style={{ background: "#e7f6ee", color: "#046c4e" }}>
          <CircleCheck size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            {resultado.mensagem}{" "}
            <Link href="/admin/vendas-da-kommo" className="font-semibold underline underline-offset-4">Voltar para Vendas da Kommo</Link>
          </span>
        </p>
      ) : (
        <form onSubmit={aoEnviar} className="mt-4 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
          <ProducaoDaVenda produtos={produtos} lojas={lojas} inicial={venda.formulario ?? undefined} sempreLigada />
          {resultado ? (
            <p role="alert" className="flex items-start gap-2 rounded-[12px] px-3 py-2.5 text-sm sm:col-span-2" style={{ background: "#fdecec", color: "#9b1c1c" }}>
              <CircleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" /> {resultado.mensagem}
            </p>
          ) : null}
          <div className="sm:col-span-2">
            <button type="submit" disabled={enviando} className="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-white disabled:opacity-60">
              {enviando ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Hammer size={16} aria-hidden="true" />} Mandar para a fábrica
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
