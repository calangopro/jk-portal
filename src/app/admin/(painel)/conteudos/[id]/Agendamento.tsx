"use client";

import { useState, useTransition } from "react";
import { CalendarClock, AlertTriangle } from "lucide-react";
import { agendarPublicacao } from "./actions";
import {
  atrasado,
  instanteDeSaoPaulo,
  paraCampoLocal,
  quandoLegivel,
} from "@/lib/content/agenda";

/**
 * Marca a hora de entrar no ar.
 *
 * Escrever cinco guias num dia e soltar um por semana é o que transforma um dia
 * de trabalho num mês de frequência. Sem isso, publicar depende de alguém estar
 * na frente do computador na hora certa, e é por isso que conteúdo sai em
 * rajada e depois some por três semanas.
 *
 * O horário é sempre o de São Paulo, independente de como o computador de quem
 * edita está configurado. A conversão acontece aqui, e o servidor recebe o
 * instante já resolvido.
 */
export function Agendamento({
  contentId,
  publicado,
  agendadoPara,
  erroDoAgendamento,
}: {
  contentId: string;
  publicado: boolean;
  agendadoPara: string | null;
  erroDoAgendamento: string | null;
}) {
  const [valor, setValor] = useState(paraCampoLocal(agendadoPara));
  const [gravado, setGravado] = useState<string | null>(agendadoPara);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();

  if (publicado) {
    return (
      <p className="text-xs leading-relaxed text-muted">
        Esta página já está no ar. Agendamento só existe para o que ainda não foi
        publicado.
      </p>
    );
  }

  const salvar = () => {
    setErro(null);
    const instante = valor ? instanteDeSaoPaulo(valor) : null;
    if (valor && !instante) {
      setErro("Não entendi essa data. Use o seletor do campo.");
      return;
    }
    iniciar(async () => {
      const r = await agendarPublicacao(contentId, instante);
      if (!r.ok) {
        setErro(r.erro ?? "Não foi possível agendar.");
        return;
      }
      setGravado(instante);
    });
  };

  const limpar = () => {
    setErro(null);
    setValor("");
    iniciar(async () => {
      const r = await agendarPublicacao(contentId, null);
      if (r.ok) setGravado(null);
      else setErro(r.erro ?? "Não foi possível desmarcar.");
    });
  };

  // Mínimo de agora, para o seletor não oferecer o passado.
  const minimo = paraCampoLocal(new Date().toISOString());
  const estaAtrasado = atrasado(gravado);

  return (
    <div>
      {gravado ? (
        <p
          className={`mb-3 rounded-[10px] px-3 py-2.5 text-xs leading-relaxed ${
            estaAtrasado ? "bg-wine/10 text-wine" : "bg-brand/15 text-ink"
          }`}
        >
          {estaAtrasado ? (
            <>
              A hora marcada ({quandoLegivel(gravado)}) já passou e a página não
              entrou no ar. Veja o motivo abaixo, ou publique agora pelo botão do
              topo.
            </>
          ) : (
            <>Marcado para {quandoLegivel(gravado)}, horário de São Paulo.</>
          )}
        </p>
      ) : null}

      {erroDoAgendamento ? (
        <p className="mb-3 flex items-start gap-2 rounded-[10px] bg-wine/10 px-3 py-2.5 text-xs leading-relaxed text-wine">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden />
          <span>
            A publicação automática tentou e não passou: {erroDoAgendamento}
          </span>
        </p>
      ) : null}

      <label className="block text-xs font-medium text-ink">
        Data e hora
        <input
          type="datetime-local"
          value={valor}
          min={minimo}
          onChange={(e) => setValor(e.target.value)}
          className="mt-1.5 w-full rounded-[10px] border border-border bg-white/80 px-3 py-2 text-sm text-ink outline-none transition-colors hover:border-brand/40 focus:border-brand"
        />
      </label>

      {erro ? (
        <p role="alert" className="mt-2 text-xs text-wine">
          {erro}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={salvar}
          disabled={ocupado || !valor}
          className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white transition-opacity disabled:opacity-40"
        >
          <CalendarClock size={13} aria-hidden />
          {gravado ? "Mudar o horário" : "Agendar"}
        </button>

        {gravado ? (
          <button
            type="button"
            onClick={limpar}
            disabled={ocupado}
            className="text-xs text-muted underline underline-offset-4 transition-colors hover:text-ink disabled:opacity-40"
          >
            Desmarcar
          </button>
        ) : null}
      </div>

      <p className="mt-3 text-[0.68rem] leading-relaxed text-muted">
        Na hora marcada a página passa pelas mesmas travas do botão Publicar:
        precisa de fonte registrada e do analisador sem erro que barre. Se algo
        faltar, ela não entra no ar e o motivo aparece aqui.
      </p>
    </div>
  );
}
