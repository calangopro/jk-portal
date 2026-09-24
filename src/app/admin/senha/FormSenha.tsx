"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { definirSenha, type SenhaState } from "./actions";
import { SENHA_MINIMA, tipoDeLink, type TipoDeLink } from "./regras";
import { AvisoDeErro, CAMPO_DE_ACESSO, MolduraDeAcesso } from "../_acesso/Moldura";
import { BotaoDeAcesso } from "../_acesso/BotaoDeAcesso";

type Situacao = "abrindo" | "pronto" | "sem-link" | "vencido";

const TEXTOS: Record<TipoDeLink | "sessao", { rotulo: string; titulo: string; intro: string }> = {
  invite: {
    rotulo: "Primeiro acesso",
    titulo: "Crie sua senha",
    intro:
      "Seu acesso ao painel editorial da JK Alianças está pronto. Escolha a senha que você vai usar para entrar.",
  },
  recovery: {
    rotulo: "Recuperar acesso",
    titulo: "Crie uma senha nova",
    intro: "A senha antiga deixa de valer assim que você salvar a nova.",
  },
  sessao: {
    rotulo: "Sua conta",
    titulo: "Trocar senha",
    intro: "A senha antiga deixa de valer assim que você salvar a nova.",
  },
};

const LINK =
  "font-medium text-ink underline decoration-brand/50 underline-offset-4 hover:decoration-brand";

export function FormSenha({
  tokenHash,
  tipo: tipoInicial,
  temSessao,
  linkInvalido,
}: {
  tokenHash: string | null;
  tipo: TipoDeLink | null;
  temSessao: boolean;
  linkInvalido: boolean;
}) {
  const [situacao, setSituacao] = useState<Situacao>(
    linkInvalido ? "vencido" : tokenHash ? "pronto" : "abrindo",
  );
  const [tipo, setTipo] = useState<TipoDeLink | null>(tipoInicial);
  const [state, formAction] = useActionState<SenhaState, FormData>(definirSenha, {});
  // O `#` é lido UMA vez. Em desenvolvimento o React roda o efeito duas vezes
  // seguidas, e a segunda passada, já sem o `#` que a primeira apagou,
  // concluía "sem link" por cima da resposta certa.
  const hashLido = useRef(false);

  useEffect(() => {
    if (situacao !== "abrindo" || hashLido.current) return;
    hashLido.current = true;

    // Link no formato antigo do Supabase: a verificação já aconteceu no
    // servidor dele, e a sessão chega depois do `#`, que só o navegador lê.
    // O `#` é apagado ANTES de criar o cliente, senão o cliente tenta ler a
    // sessão da URL sozinho, recusa por não ser fluxo PKCE e ainda derruba a
    // sessão que houver. Apagar também tira o token da barra e do histórico.
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const temAlgo = hash.has("access_token") || hash.has("error") || hash.has("error_code");
    if (temAlgo) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }

    if (hash.has("error") || hash.has("error_code")) {
      setSituacao("vencido");
      return;
    }

    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");
    if (accessToken && refreshToken) {
      setTipo(tipoDeLink(hash.get("type")));
      // Import sob demanda: o cliente do Supabase dobra o peso da página, e
      // só este caso precisa dele. O link novo não passa por aqui.
      void import("@/lib/supabase/client")
        .then(({ createClient }) =>
          createClient().auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          }),
        )
        .then(({ error }) => setSituacao(error ? "vencido" : "pronto"))
        .catch(() => setSituacao("vencido"));
      return;
    }

    setSituacao(temSessao ? "pronto" : "sem-link");
  }, [situacao, temSessao]);

  if (state.fim === "inativo") {
    return (
      <MolduraDeAcesso rotulo="Painel editorial" titulo="Senha salva">
        <p className="mt-3 text-sm text-muted">
          Falta liberar o seu acesso. Peça para quem administra o painel ativar a
          sua conta em Usuários e depois entre com a senha que você acabou de criar.
        </p>
        <p className="mt-6 text-sm">
          <Link href="/admin/login" className={LINK}>
            Ir para a entrada
          </Link>
        </p>
      </MolduraDeAcesso>
    );
  }

  if (state.fim === "vencido" || situacao === "vencido") {
    return (
      <MolduraDeAcesso rotulo="Painel editorial" titulo="Este link não vale mais">
        <p className="mt-3 text-sm text-muted">
          O link já foi usado ou passou do prazo. Se você recebeu um convite, peça
          outro para quem administra o painel. Se já tinha acesso, peça um link
          novo por aqui.
        </p>
        <p className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
          <Link href="/admin/recuperar-senha" className={LINK}>
            Pedir link novo
          </Link>
          <Link href="/admin/login" className={LINK}>
            Voltar para a entrada
          </Link>
        </p>
      </MolduraDeAcesso>
    );
  }

  if (situacao === "abrindo") {
    return (
      <MolduraDeAcesso rotulo="Painel editorial" titulo="Abrindo seu link">
        <p className="mt-3 text-sm text-muted" aria-live="polite">
          Só um instante.
        </p>
      </MolduraDeAcesso>
    );
  }

  if (situacao === "sem-link") {
    return (
      <MolduraDeAcesso rotulo="Painel editorial" titulo="Abra pelo link do e-mail">
        <p className="mt-3 text-sm text-muted">
          A senha é criada a partir do link que chega por e-mail. Se ele não
          chegou, confira o spam ou peça outro.
        </p>
        <p className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
          <Link href="/admin/recuperar-senha" className={LINK}>
            Pedir link novo
          </Link>
          <Link href="/admin/login" className={LINK}>
            Voltar para a entrada
          </Link>
        </p>
      </MolduraDeAcesso>
    );
  }

  const textos = TEXTOS[tipo ?? "sessao"];
  // Depois que a ação verificou o link, ele não vale mais: a próxima
  // tentativa vai só com a sessão que a verificação deixou.
  const mandarLink = tokenHash && tipo && !state.comSessao;

  return (
    <MolduraDeAcesso rotulo={textos.rotulo} titulo={textos.titulo}>
      <p className="mt-3 text-sm text-muted">{textos.intro}</p>

      <form action={formAction} className="mt-8 text-left">
        {mandarLink ? (
          <>
            <input type="hidden" name="token_hash" value={tokenHash} />
            <input type="hidden" name="tipo" value={tipo} />
          </>
        ) : null}

        <label className="block text-sm font-medium text-ink" htmlFor="senha">
          Senha nova
          <input
            id="senha"
            name="senha"
            type="password"
            autoComplete="new-password"
            minLength={SENHA_MINIMA}
            required
            aria-describedby="senha-ajuda"
            className={CAMPO_DE_ACESSO}
          />
        </label>
        <p id="senha-ajuda" className="mt-1.5 text-xs text-muted">
          Pelo menos {SENHA_MINIMA} caracteres. Uma frase curta é mais fácil de
          lembrar e mais difícil de adivinhar.
        </p>

        <label className="mt-5 block text-sm font-medium text-ink" htmlFor="repetida">
          Repita a senha
          <input
            id="repetida"
            name="repetida"
            type="password"
            autoComplete="new-password"
            minLength={SENHA_MINIMA}
            required
            className={CAMPO_DE_ACESSO}
          />
        </label>

        {state.erro ? <AvisoDeErro>{state.erro}</AvisoDeErro> : null}

        <div className="mt-6">
          <BotaoDeAcesso texto="Salvar senha e entrar" esperando="Salvando…" />
        </div>
      </form>
    </MolduraDeAcesso>
  );
}
