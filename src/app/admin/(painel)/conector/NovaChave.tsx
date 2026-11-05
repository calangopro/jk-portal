"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { KeyRound } from "lucide-react";
import { BotaoCopiar } from "../bio/LinksParaDivulgar";
import { criarChave, type EstadoDaChave } from "./actions";

const CAMPO =
  "mt-1 w-full rounded-[10px] border border-border bg-white/70 px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-muted/60 focus:border-brand";

function Enviar() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-xs font-semibold text-ink transition-colors hover:bg-brand-light disabled:opacity-60"
    >
      <KeyRound size={14} aria-hidden />
      {pending ? "Criando…" : "Criar chave"}
    </button>
  );
}

/**
 * Chave para o Claude Code. Depois de criada, mostra a chave e o comando
 * pronto para colar no terminal, uma vez só.
 */
export function NovaChave({ mcp }: { mcp: string }) {
  const [estado, acao] = useActionState<EstadoDaChave, FormData>(criarChave, {});

  if (estado.chave) {
    const comando = `claude mcp add --transport http jk ${mcp} --header "Authorization: Bearer ${estado.chave}"`;
    return (
      <div className="rounded-[14px] border border-brand/40 bg-brand/8 p-4" role="status">
        <p className="text-sm font-semibold text-ink">Chave “{estado.nome}” criada</p>
        <p className="mt-1 text-xs text-muted">
          Copie agora: ela não aparece de novo. Se perder, desligue esta e crie outra.
        </p>
        <div className="mt-3 flex items-center gap-2 rounded-[10px] border border-border bg-white/80 p-2.5">
          <code className="min-w-0 flex-1 break-all text-xs text-ink">{estado.chave}</code>
          <BotaoCopiar valor={estado.chave} />
        </div>
        <p className="mt-3 text-xs font-semibold text-ink">Comando para o terminal (Claude Code)</p>
        <div className="mt-1.5 flex items-start gap-2 rounded-[10px] border border-border bg-white/80 p-2.5">
          <code className="min-w-0 flex-1 break-all text-xs text-ink">{comando}</code>
          <BotaoCopiar valor={comando} />
        </div>
      </div>
    );
  }

  return (
    <form action={acao} className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
      <label className="block text-xs font-medium text-ink">
        Nome da chave
        <input name="nome" required maxLength={60} placeholder="Claude Code do Filipe" className={CAMPO} />
      </label>
      <label className="block text-xs font-medium text-ink">
        Pode
        <select name="escopo" defaultValue="completo" className={CAMPO}>
          <option value="completo">Ler e escrever</option>
          <option value="leitura">Só ler</option>
        </select>
      </label>
      <Enviar />
      {estado.erro ? (
        <p role="alert" className="text-xs text-wine sm:col-span-3">
          {estado.erro}
        </p>
      ) : null}
    </form>
  );
}
