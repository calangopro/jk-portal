"use client";

import { useEffect } from "react";
import { BASE_PATH, semBasePath } from "@/lib/seo/base-path";

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
    // O navegador mostra o caminho COM o prefixo (/guias/algo). O que vai
    // para o banco é o caminho interno, porque é ele que a fila de endereços
    // quebrados vira `redirects.source_path`, e é com o caminho interno que o
    // middleware compara. Gravar com prefixo faria todo redirect criado a
    // partir da fila nunca casar.
    const caminho = semBasePath(window.location.pathname);
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

    if (!navigator.sendBeacon?.(`${BASE_PATH}/api/404`, blob)) {
      void fetch(`${BASE_PATH}/api/404`, { method: "POST", body: dados, keepalive: true }).catch(() => {});
    }
  }, []);

  return null;
}
