"use client";

import { useState } from "react";
import { CircleAlert, Loader2 } from "lucide-react";
import { NOME_DA_PRIORIDADE, NOME_DO_TIPO, PRIORIDADES, TETO_DA_DESCRICAO, TETO_DO_TITULO, TIPOS, lerCaminhos, type Prioridade, type Tipo } from "@/lib/roadmap/roadmap";
import { Janela } from "./Janela";
import { Selecao } from "./pecas";
import type { Acoes } from "./tipos";

/** Um cartão novo: o título, o tipo, a prioridade, a coluna e, se já souber, onde vai mexer. */
export function NovoCartao({ acoes, aoFechar, aoCriar }: { acoes: Acoes; aoFechar: () => void; aoCriar: (id: number) => void }) {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipo, setTipo] = useState<Tipo>("melhoria");
  const [prioridade, setPrioridade] = useState<Prioridade>("media");
  const [coluna, setColuna] = useState<"a_fazer" | "ideias">("a_fazer");
  const [caminhos, setCaminhos] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const criar = async () => {
    if (titulo.trim().length < 3) {
      setErro("Escreva o título com pelo menos 3 letras.");
      return;
    }
    setSalvando(true);
    setErro(null);
    const r = await acoes
      .criar({ titulo, descricao, tipo, prioridade, coluna, caminhos: lerCaminhos(caminhos) })
      .catch(() => ({ ok: false as const, erro: "Sem conexão. Tente de novo." }));
    setSalvando(false);
    if (!r.ok) {
      setErro(r.erro);
      return;
    }
    aoCriar(r.id);
  };

  const temAlgo = titulo.trim().length > 0 || descricao.trim().length > 0;

  return (
    <Janela titulo="Novo cartão" aoFechar={aoFechar} segurarEsc={temAlgo}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void criar();
        }}
        className="grid grid-cols-1 gap-3"
      >
        <label className="block">
          <span className="text-sm font-semibold text-ink">O que é</span>
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            maxLength={TETO_DO_TITULO}
            autoFocus
            placeholder="Ex.: conversa privada entre duas pessoas no chat"
            className="mt-1 w-full rounded-[10px] border border-border bg-white px-3 py-2.5 text-sm text-ink placeholder:text-muted"
          />
        </label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Selecao rotulo="Tipo" valor={tipo} aoMudar={(v) => setTipo(v as Tipo)} opcoes={TIPOS.map((t) => [t, NOME_DO_TIPO[t]])} />
          <Selecao rotulo="Prioridade" valor={prioridade} aoMudar={(v) => setPrioridade(v as Prioridade)} opcoes={PRIORIDADES.map((p) => [p, NOME_DA_PRIORIDADE[p]])} />
          <Selecao rotulo="Coluna" valor={coluna} aoMudar={(v) => setColuna(v as "a_fazer" | "ideias")} opcoes={[["a_fazer", "A fazer"], ["ideias", "Ideias"]]} />
        </div>
        <label className="block">
          <span className="text-sm font-semibold text-ink">
            Detalhes <span className="font-normal text-muted">(opcional)</span>
          </span>
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            maxLength={TETO_DA_DESCRICAO}
            rows={4}
            placeholder="Por que, o que é pronto, de quem depende."
            className="mt-1 w-full resize-y rounded-[10px] border border-border bg-white px-3 py-2.5 text-sm leading-relaxed text-ink placeholder:text-muted"
          />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-ink">
            Onde vai mexer <span className="font-normal text-muted">(opcional, um por linha)</span>
          </span>
          <textarea
            value={caminhos}
            onChange={(e) => setCaminhos(e.target.value)}
            rows={3}
            spellCheck={false}
            placeholder={"src/lib/time\n/admin/chat"}
            className="mt-1 w-full resize-y rounded-[10px] border border-border bg-white px-3 py-2.5 font-mono text-xs leading-relaxed text-ink placeholder:text-muted"
          />
          <span className="mt-1 block text-xs text-muted">Pastas, arquivos ou telas do painel. Dá para dizer depois, ao pegar o cartão.</span>
        </label>

        {erro ? (
          <p role="alert" className="flex items-start gap-2 text-sm text-[#b91c1c]">
            <CircleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{erro}</span>
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" disabled={salvando} className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-ink/85 disabled:opacity-60">
            {salvando ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : null}
            Criar cartão
          </button>
        </div>
      </form>
    </Janela>
  );
}
