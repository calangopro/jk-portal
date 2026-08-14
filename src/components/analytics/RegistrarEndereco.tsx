"use client";

import { useEffect } from "react";

/**
 * Avisa o painel de que este endereço não existe.
 *
 * Fica na página 404 e dispara uma vez por endereço visto, por sessão, para
 * quem volta e recarrega não inflar a contagem.
 *
 * `sendBeacon` de propósito: a pessoa costuma sair da página de erro
 * imediatamente, e um `fetch` comum seria cancelado na saída.
 */
export function RegistrarEndereco() {
  useEffect(() => {
    const caminho = window.location.pathname;
    const chave = `jk-404:${caminho}`;

    try {
      if (window.sessionStorage.getItem(chave)) return;
      window.sessionStorage.setItem(chave, "1");
    } catch {
      // Navegador com armazenamento bloqueado ainda registra, só sem a trava
      // contra repetição. Perder a trava é melhor que perder o registro.
    }

    const dados = JSON.stringify({ path: caminho, referrer: document.referrer });
    const blob = new Blob([dados], { type: "application/json" });

    if (!navigator.sendBeacon?.("/api/404", blob)) {
      void fetch("/api/404", { method: "POST", body: dados, keepalive: true }).catch(() => {});
    }
  }, []);

  return null;
}
