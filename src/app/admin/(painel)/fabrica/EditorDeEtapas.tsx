"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Loader2, Plus, Settings2, X } from "lucide-react";
import { ENTRADA, ENVIADO, type EtapaDaFabrica } from "@/lib/fabrica/etapas";

/**
 * Editar as etapas da fábrica: nome, frase, cor, ordem, ligar e desligar, e
 * criar etapa nova. Só aparece para diretoria e gerente.
 *
 * A lista vai INTEIRA para o banco (`fabrica_etapas_salvar`, 0191), que é quem
 * decide se ela vale: a entrada primeiro, as finais por último, "Chegou
 * pedido" e "Enviado" sempre ligadas, e etapa com trabalho dentro não desliga.
 * A tela só evita o erro óbvio (as setas não passam a entrada nem as finais);
 * a mensagem do banco aparece como veio.
 *
 * Etapa não se apaga: desligada, ela some das abas e da lista de mover, e o
 * histórico dos trabalhos que passaram por ela continua com o nome.
 */
export type SalvarEtapas = (
  etapas: { chave: string | null; nome: string; frase: string | null; cor: string; ativa: boolean }[],
) => Promise<{ ok: true } | { ok: false; erro: string }>;

type Linha = { chave: string | null; nome: string; frase: string; cor: string; ativa: boolean; papel: EtapaDaFabrica["papel"]; id: string };

const FIXAS = new Set([ENTRADA, ENVIADO]);

export function EditorDeEtapas({
  etapas, pedidos, salvar,
}: {
  etapas: EtapaDaFabrica[];
  /** Só para dizer quantos trabalhos estão em cada etapa agora. */
  pedidos: { etapa: string }[];
  salvar: SalvarEtapas;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, comecar] = useTransition();

  const abrir = () => {
    setLinhas(etapas.map((e) => ({ chave: e.chave, nome: e.nome, frase: e.frase ?? "", cor: e.cor, ativa: e.ativa, papel: e.papel, id: e.chave })));
    setErro(null);
    setAberto(true);
  };

  const quantos = (chave: string | null) => (chave ? pedidos.filter((p) => p.etapa === chave).length : 0);

  const mudar = (i: number, parte: Partial<Linha>) => setLinhas((l) => l.map((x, j) => (j === i ? { ...x, ...parte } : x)));

  // A entrada não sai do topo e as finais não sobem acima das do meio: as setas nem oferecem.
  const podeSubir = (i: number) => linhas[i].papel === "meio" && i > 1;
  const podeDescer = (i: number) => linhas[i].papel === "meio" && linhas[i + 1]?.papel === "meio";
  const trocar = (i: number, j: number) =>
    setLinhas((l) => {
      const n = [...l];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  const adicionar = () =>
    setLinhas((l) => {
      const primeiraFinal = l.findIndex((x) => x.papel === "final");
      const nova: Linha = { chave: null, nome: "", frase: "", cor: "#5b6472", ativa: true, papel: "meio", id: `nova-${Date.now()}` };
      const n = [...l];
      n.splice(primeiraFinal < 0 ? n.length : primeiraFinal, 0, nova);
      return n;
    });

  const guardar = () =>
    comecar(async () => {
      setErro(null);
      if (linhas.some((x) => x.nome.trim().length < 2)) {
        setErro("Toda etapa precisa de nome.");
        return;
      }
      const r = await salvar(linhas.map((x) => ({ chave: x.chave, nome: x.nome.trim(), frase: x.frase.trim() || null, cor: x.cor, ativa: x.ativa })));
      if (r.ok) {
        setAberto(false);
        router.refresh();
      } else setErro(r.erro);
    });

  const campo = "h-10 w-full min-w-0 rounded-[10px] border border-ink/15 bg-white px-3 text-sm text-ink outline-none focus:border-[var(--setor)]";
  const seta = "painel-toque inline-flex h-9 w-9 items-center justify-center rounded-full border border-ink/12 bg-white text-ink disabled:opacity-30";

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={abrir}
        className="painel-toque inline-flex h-9 items-center gap-1.5 rounded-full border border-ink/12 bg-white px-3.5 text-xs font-semibold text-ink"
      >
        <Settings2 size={14} aria-hidden="true" /> Editar etapas
      </button>
    );
  }

  return (
    <section aria-label="Editar etapas" className="glass mt-1 w-full rounded-[18px] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-ink">Etapas da fábrica</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            A ordem daqui é a ordem das abas e do botão de avançar. Etapa não se apaga: desligada, ela some da tela. Só
            dá para desligar etapa vazia, e Chegou pedido e Enviado ficam sempre ligadas.
          </p>
        </div>
        <button type="button" onClick={() => setAberto(false)} aria-label="Fechar sem guardar" className={seta}>
          <X size={15} aria-hidden="true" />
        </button>
      </div>

      <ol className="mt-4 space-y-2">
        {linhas.map((x, i) => {
          const n = quantos(x.chave);
          const fixa = x.chave !== null && FIXAS.has(x.chave);
          return (
            <li key={x.id} className={`rounded-[14px] border border-ink/10 bg-white p-3 ${x.ativa ? "" : "opacity-70"}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="numeros w-5 shrink-0 text-xs font-bold text-muted">{i + 1}</span>
                <label className="shrink-0">
                  <span className="sr-only">Cor da etapa {x.nome || "nova"}</span>
                  <input type="color" value={x.cor} onChange={(e) => mudar(i, { cor: e.target.value })} className="h-9 w-9 cursor-pointer rounded-full border border-ink/12 bg-white p-0.5" />
                </label>
                <label className="min-w-0 flex-1 basis-40">
                  <span className="sr-only">Nome da etapa</span>
                  <input value={x.nome} maxLength={40} onChange={(e) => mudar(i, { nome: e.target.value })} placeholder="Nome da etapa" className={campo} />
                </label>
                <div className="flex shrink-0 gap-1">
                  <button type="button" disabled={!podeSubir(i)} onClick={() => trocar(i, i - 1)} aria-label={`Subir ${x.nome}`} className={seta}>
                    <ArrowUp size={14} aria-hidden="true" />
                  </button>
                  <button type="button" disabled={!podeDescer(i)} onClick={() => trocar(i, i + 1)} aria-label={`Descer ${x.nome}`} className={seta}>
                    <ArrowDown size={14} aria-hidden="true" />
                  </button>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 pl-7">
                <label className="min-w-0 flex-1 basis-48">
                  <span className="sr-only">Frase da etapa</span>
                  <input value={x.frase} maxLength={120} onChange={(e) => mudar(i, { frase: e.target.value })} placeholder="O que acontece aqui (opcional)" className={`${campo} h-9 text-xs`} />
                </label>
                <label className={`inline-flex shrink-0 items-center gap-2 text-xs font-semibold ${fixa ? "text-muted" : "text-ink"}`}>
                  <input type="checkbox" checked={x.ativa} disabled={fixa} onChange={(e) => mudar(i, { ativa: e.target.checked })} className="h-4 w-4" />
                  Ligada
                </label>
                <span className="text-[0.7rem] text-muted">
                  {x.chave === null ? "Nova" : x.papel === "entrada" ? "Entrada" : x.papel === "final" ? "Final" : null}
                  {n > 0 ? `${x.chave === null || x.papel !== "meio" ? ", " : ""}${n} agora` : null}
                </span>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={adicionar} disabled={linhas.length >= 20} className="painel-toque inline-flex h-10 items-center gap-1.5 rounded-full border border-ink/12 bg-white px-4 text-xs font-semibold text-ink disabled:opacity-50">
          <Plus size={14} aria-hidden="true" /> Nova etapa
        </button>
        <button type="button" onClick={guardar} disabled={ocupado} className="painel-toque painel-aba-ativa inline-flex h-10 items-center gap-2 rounded-full px-5 text-xs font-semibold disabled:opacity-60">
          {ocupado ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : null} Guardar as etapas
        </button>
      </div>
      {erro ? <p role="alert" className="mt-2 text-xs font-semibold text-[#b01919]">{erro}</p> : null}
    </section>
  );
}
