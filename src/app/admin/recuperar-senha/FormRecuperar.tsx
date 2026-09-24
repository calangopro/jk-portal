"use client";

import { useActionState } from "react";
import { pedirLinkDeSenha, type RecuperarState } from "./actions";
import { AvisoDeErro, CAMPO_DE_ACESSO } from "../_acesso/Moldura";
import { BotaoDeAcesso } from "../_acesso/BotaoDeAcesso";

export function FormRecuperar() {
  const [state, formAction] = useActionState<RecuperarState, FormData>(
    pedirLinkDeSenha,
    {},
  );

  if (state.enviado) {
    return (
      <p
        role="status"
        className="mt-8 rounded-[12px] border border-brand/30 bg-brand/5 px-4 py-3 text-left text-sm text-ink"
      >
        Se este e-mail tiver acesso ao painel, o link chega em alguns minutos.
        Confira também o spam. O link funciona uma vez só e vale por pouco
        tempo, então use o mais recente.
      </p>
    );
  }

  return (
    <form action={formAction} className="mt-8 text-left">
      <label className="block text-sm font-medium text-ink" htmlFor="email">
        E-mail
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className={CAMPO_DE_ACESSO}
          placeholder="voce@jkaliancas.com.br"
        />
      </label>

      {state.erro ? <AvisoDeErro>{state.erro}</AvisoDeErro> : null}

      <div className="mt-6">
        <BotaoDeAcesso texto="Enviar link" esperando="Enviando…" />
      </div>
    </form>
  );
}
