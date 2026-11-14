"use client";

import { useId, useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { TEMAS, conferirResposta, type RascunhoDeResposta } from "@/lib/time/biblioteca";
import { botaoCheio, botaoClaro, campo, type Feito } from "./pecas";

/**
 * O formulário de uma resposta da biblioteca. Serve a três lugares: sugerir
 * uma resposta nova, editar uma que existe e transformar um chamado em
 * resposta. Quem chama diz o que acontece ao salvar.
 *
 * A pergunta e a explicação são obrigatórias; a frase pronta e a origem, não.
 * A conferência roda aqui antes de ir ao servidor, que confere de novo.
 */
export function FormularioDeResposta({
  inicial, comOrigem = true, rotuloDoBotao, aviso, onSalvar, onCancelar,
}: {
  inicial?: Partial<RascunhoDeResposta>;
  /** A origem some quando a resposta nasce de um chamado: quem escreve é o banco. */
  comOrigem?: boolean;
  rotuloDoBotao: string;
  aviso?: React.ReactNode;
  onSalvar: (r: RascunhoDeResposta) => Promise<Feito>;
  onCancelar: () => void;
}) {
  const id = useId();
  const [r, setR] = useState<RascunhoDeResposta>({
    tema: inicial?.tema ?? "",
    pergunta: inicial?.pergunta ?? "",
    explicacao: inicial?.explicacao ?? "",
    frase: inicial?.frase ?? "",
    origem: inicial?.origem ?? "",
  });
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, comecar] = useTransition();
  const mudar = (campoMudado: keyof RascunhoDeResposta) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setR((antes) => ({ ...antes, [campoMudado]: e.target.value }));

  const salvar = () => {
    const falta = conferirResposta(r);
    if (falta) return setErro(falta);
    setErro(null);
    comecar(async () => {
      const feito = await onSalvar(r);
      if (!feito.ok) setErro(feito.erro);
    });
  };

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        salvar();
      }}
    >
      {aviso}
      <label className="block" htmlFor={`${id}-tema`}>
        <span className="text-xs font-semibold text-ink">Tema</span>
        <select id={`${id}-tema`} value={r.tema} onChange={mudar("tema")} className={`${campo} h-12`}>
          <option value="">Escolha o tema</option>
          {TEMAS.map((t) => (
            <option key={t.chave} value={t.chave}>
              {t.nome}
            </option>
          ))}
        </select>
      </label>

      <label className="block" htmlFor={`${id}-pergunta`}>
        <span className="text-xs font-semibold text-ink">A pergunta</span>
        <span className="block text-[0.7rem] text-muted">Do jeito que ela chega, como quem pergunta fala.</span>
        <input
          id={`${id}-pergunta`}
          value={r.pergunta}
          onChange={mudar("pergunta")}
          maxLength={300}
          placeholder="Ex.: O polimento custa alguma coisa?"
          className={`${campo} h-12`}
        />
      </label>

      <label className="block" htmlFor={`${id}-explicacao`}>
        <span className="text-xs font-semibold text-ink">A explicação, para quem atende</span>
        <span className="block text-[0.7rem] text-muted">O que vale, e o que conferir antes de responder.</span>
        <textarea id={`${id}-explicacao`} value={r.explicacao} onChange={mudar("explicacao")} maxLength={4000} rows={4} className={campo} />
      </label>

      <label className="block" htmlFor={`${id}-frase`}>
        <span className="text-xs font-semibold text-ink">A frase pronta, para mandar ao cliente</span>
        <span className="block text-[0.7rem] text-muted">Pode ficar vazia. Só prometa o que a regra diz.</span>
        <textarea id={`${id}-frase`} value={r.frase} onChange={mudar("frase")} maxLength={2000} rows={3} className={campo} />
      </label>

      {comOrigem ? (
        <label className="block" htmlFor={`${id}-origem`}>
          <span className="text-xs font-semibold text-ink">De onde veio</span>
          <span className="block text-[0.7rem] text-muted">Pode ficar vazio. Quem disse, e quando.</span>
          <input
            id={`${id}-origem`}
            value={r.origem}
            onChange={mudar("origem")}
            maxLength={300}
            placeholder="Ex.: dito pela diretoria em reunião de novembro"
            className={`${campo} h-12`}
          />
        </label>
      ) : null}

      {erro ? (
        <p role="alert" className="text-xs font-semibold text-[#b01919]">
          {erro}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={ocupado} className={botaoCheio}>
          {ocupado ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Check size={14} aria-hidden="true" />} {rotuloDoBotao}
        </button>
        <button type="button" disabled={ocupado} onClick={onCancelar} className={botaoClaro}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
