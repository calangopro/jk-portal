"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { RefreshCw, Copy, Check } from "lucide-react";
import { importarAgora, type ImportarAgoraState } from "./actions";

function Botao({ desligado }: { desligado: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || desligado}
      className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-brand-light disabled:opacity-60"
    >
      <RefreshCw size={14} className={pending ? "animate-spin" : undefined} aria-hidden />
      {pending ? "Importando…" : "Importar agora"}
    </button>
  );
}

function quando(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  });
}

/**
 * Leitura automática do Search Console: de quem é a conta, quando rodou pela
 * última vez e o botão para rodar agora.
 */
export function Automatico({
  email,
  ultima,
}: {
  email: string | null;
  ultima: { ok: boolean; mensagem: string; quando: string } | null;
}) {
  const [estado, acao] = useActionState<ImportarAgoraState, FormData>(importarAgora, {});
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    if (!email) return;
    try {
      await navigator.clipboard.writeText(email);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sem permissão de área de transferência: o e-mail continua na tela.
    }
  };

  return (
    <form action={acao} className="glass rounded-[18px] p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] border border-brand/30 bg-brand/10 text-brand-nav">
            <RefreshCw size={14} />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink">Search Console automático</p>
            <p className="mt-0.5 max-w-[62ch] text-xs leading-relaxed text-muted">
              Toda segunda de manhã o painel busca sozinho os últimos 28 dias do
              Search Console, no mesmo formato da planilha. A fila de pautas usa
              esses números.
            </p>
          </div>
        </div>
        <Botao desligado={!email} />
      </div>

      {email ? (
        <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-muted">
          <span>Conta de serviço:</span>
          <code className="rounded-[8px] border border-border bg-white/70 px-2 py-1 text-ink">{email}</code>
          <button
            type="button"
            onClick={copiar}
            className="inline-flex items-center gap-1 rounded-full border border-ink/15 px-2.5 py-1 font-semibold text-ink transition-colors hover:border-brand/50"
          >
            {copiado ? <Check size={12} aria-hidden /> : <Copy size={12} aria-hidden />}
            {copiado ? "Copiado" : "Copiar"}
          </button>
          <span>Esse e-mail precisa estar como usuário da propriedade no Search Console.</span>
        </div>
      ) : (
        <p className="mt-5 rounded-[10px] border border-dashed border-border px-3 py-2.5 text-xs leading-relaxed text-muted">
          Ainda não configurado: falta a variável GSC_SERVICE_ACCOUNT_JSON na
          Vercel. O passo a passo está em docs/search-console-automatico.md, no
          repositório do portal.
        </p>
      )}

      {ultima ? (
        <p className={`mt-3 text-xs leading-relaxed ${ultima.ok ? "text-muted" : "text-wine"}`}>
          Última execução em {quando(ultima.quando)}: {ultima.mensagem}
        </p>
      ) : null}

      {estado.ok ? (
        <p role="status" className="mt-3 text-xs font-semibold text-brand-strong">
          {estado.ok}
        </p>
      ) : null}
      {estado.erro ? (
        <p role="alert" className="mt-3 text-xs leading-relaxed text-wine">
          {estado.erro}
        </p>
      ) : null}
    </form>
  );
}
