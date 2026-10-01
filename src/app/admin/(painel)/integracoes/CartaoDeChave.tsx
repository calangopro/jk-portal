"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Check, Circle, Send } from "lucide-react";
import { enviarGuardados, salvarChave, type IntegracaoState } from "./actions";

const campo =
  "w-full rounded-[10px] border border-border bg-white/80 px-3 py-2 text-sm text-ink outline-none transition-colors hover:border-brand/40 focus:border-brand";

function BotaoSalvar() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-brand px-4 py-2 text-xs font-semibold text-ink transition-colors hover:bg-brand-light disabled:opacity-60"
    >
      {pending ? "Conferindo…" : "Salvar"}
    </button>
  );
}

function BotaoEnviar({ quantos }: { quantos: number }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 px-4 py-2 text-xs font-semibold text-ink transition-colors hover:border-brand/50 disabled:opacity-60"
    >
      <Send size={12} aria-hidden />
      {pending ? "Enviando…" : `Enviar os ${quantos} guardados`}
    </button>
  );
}

/**
 * Cartão de um destino do contato do grupo: a chave, o que mais ele precisa e
 * o botão de mandar quem ficou guardado.
 *
 * A chave é só de escrita. O campo nasce vazio mesmo com chave salva, e vazio
 * no salvar quer dizer "mantém a que está": assim dá para trocar o funil da
 * Kommo sem colar o token de novo, e o token nunca volta para a tela.
 */
export function CartaoDeChave({
  provider,
  destino,
  nome,
  descricao,
  rotulo,
  exemplo,
  ajuda,
  configurada,
  atualizadaEm,
  guardados,
  tipo = "password",
  children,
}: {
  provider: string;
  destino: string;
  nome: string;
  descricao: string;
  rotulo: string;
  exemplo?: string;
  ajuda?: React.ReactNode;
  configurada: boolean;
  atualizadaEm: string | null;
  guardados: number;
  tipo?: "password" | "url";
  children?: React.ReactNode;
}) {
  const [estado, salvar] = useActionState<IntegracaoState, FormData>(salvarChave, {});
  const [envio, enviar] = useActionState<IntegracaoState, FormData>(enviarGuardados, {});

  return (
    <div className="glass rounded-[18px] p-5">
      <form action={salvar}>
        <input type="hidden" name="provider" value={provider} />

        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-medium text-ink">{nome}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">{descricao}</p>
          </div>
          <span
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.68rem] font-semibold ${
              configurada ? "bg-brand/15 text-brand-strong" : "bg-ink/8 text-muted"
            }`}
          >
            {configurada ? <Check size={11} /> : <Circle size={9} />}
            {configurada ? "Ligado" : "Sem chave"}
          </span>
        </div>

        <label className="mt-4 block">
          <span className="text-xs font-semibold text-ink">{rotulo}</span>
          <input
            name="valor"
            type={tipo}
            autoComplete="off"
            placeholder={configurada ? "Salva. Deixe em branco para manter." : exemplo}
            className={`${campo} mt-1`}
          />
          {ajuda ? <span className="mt-1 block text-[0.68rem] leading-snug text-muted">{ajuda}</span> : null}
        </label>

        {children ? <div className="mt-3 space-y-3">{children}</div> : null}

        {configurada && atualizadaEm ? (
          <p className="mt-3 text-[0.68rem] text-muted">
            Salva em{" "}
            {new Date(atualizadaEm).toLocaleString("pt-BR", {
              timeZone: "America/Sao_Paulo",
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}
            .
          </p>
        ) : null}

        {estado.erro ? <p className="mt-3 text-xs text-wine">{estado.erro}</p> : null}
        {estado.ok ? <p className="mt-3 text-xs text-brand-strong">{estado.ok}</p> : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <BotaoSalvar />
          {configurada ? (
            <button
              type="submit"
              name="remover"
              value="1"
              className="rounded-full border border-ink/15 px-4 py-2 text-xs font-semibold text-ink transition-colors hover:border-wine/50 hover:text-wine"
            >
              Remover chave
            </button>
          ) : null}
        </div>
      </form>

      {configurada && guardados > 0 ? (
        <form action={enviar} className="mt-4 border-t border-border/70 pt-4">
          <input type="hidden" name="destino" value={destino} />
          <p className="text-[0.7rem] leading-snug text-muted">
            {guardados === 1 ? "1 contato chegou" : `${guardados} contatos chegaram`} antes desta chave, ou falharam.
          </p>
          <div className="mt-2">
            <BotaoEnviar quantos={guardados} />
          </div>
          {envio.erro ? <p className="mt-2 text-xs text-wine">{envio.erro}</p> : null}
          {envio.ok ? <p className="mt-2 text-xs text-brand-strong">{envio.ok}</p> : null}
        </form>
      ) : null}
    </div>
  );
}
