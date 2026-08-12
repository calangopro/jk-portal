"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { RefreshCw } from "lucide-react";
import { sincronizarAgora, type SyncState } from "./actions";

function Botao() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-brand-light disabled:opacity-60"
    >
      <RefreshCw size={14} className={pending ? "animate-spin" : ""} />
      {pending ? "Sincronizando…" : "Sincronizar agora"}
    </button>
  );
}

export function Sincronizar({ configurada }: { configurada: boolean }) {
  const [estado, acao] = useActionState<SyncState, FormData>(sincronizarAgora, {});

  return (
    <form action={acao} className="glass rounded-[18px] p-5">
      <p className="text-sm font-semibold text-ink">Sincronizar com a Tray</p>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        Traz categorias, produtos, preço, disponibilidade, imagem e propriedades
        (largura, acabamento) direto da loja. A Tray continua sendo a fonte de
        verdade, e nada é escrito de volta lá.
      </p>

      {!configurada ? (
        <p className="mt-4 rounded-[10px] border border-border bg-white/60 px-3 py-2 text-xs leading-relaxed text-muted">
          Lendo pela busca pública da loja, que não exige credencial. Com as
          credenciais da API autenticada dá para complementar depois com estoque
          por SKU e variação de aro.
        </p>
      ) : null}

      {estado.erro ? <p className="mt-4 text-xs text-wine">{estado.erro}</p> : null}
      {estado.ok ? <p className="mt-4 text-xs text-brand-strong">{estado.ok}</p> : null}

      <div className="mt-4">
        <Botao />
      </div>
    </form>
  );
}
