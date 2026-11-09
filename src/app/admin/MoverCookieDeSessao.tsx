"use client";

import { useEffect } from "react";
import { OPCOES_DO_COOKIE } from "@/lib/supabase/cookie";

/** Mesmo prazo padrão do Supabase (400 dias, o máximo que o Chrome aceita). */
const PRAZO = 400 * 24 * 60 * 60;

function cookiesDaSessao(): [string, string][] {
  return document.cookie
    .split("; ")
    .filter((par) => par.startsWith("sb-"))
    .map((par) => {
      const i = par.indexOf("=");
      return [par.slice(0, i), par.slice(i + 1)];
    });
}

/**
 * Leva o cookie de sessão antigo, gravado em "/", para /guias, sem deslogar.
 *
 * Até 11/2026 o Supabase gravava a sessão no caminho padrão "/", e ela ia junto
 * em toda página da loja da Tray (ver `lib/supabase/cookie.ts`). O cliente novo
 * já grava em /guias, mas o cookie velho continua no navegador de quem entrou
 * antes. Aqui no /guias o navegador mostra os dois sem dizer o caminho de cada
 * um (o mais específico vem primeiro), então a regra é:
 *   - o nome aparece duas vezes: o de /guias é o atual, só apaga o de "/";
 *   - aparece uma vez: apaga em "/" e confere. Se sumiu, ele estava em "/",
 *     e é regravado em /guias com o mesmo valor. Se continua, já estava certo.
 */
export function MoverCookieDeSessao() {
  useEffect(() => {
    const atuais = cookiesDaSessao();
    if (atuais.length === 0) return;

    const seguro = location.protocol === "https:" ? "; Secure" : "";
    const vistos = new Set<string>();

    for (const [nome, valor] of atuais) {
      if (vistos.has(nome)) continue;
      vistos.add(nome);
      const copias = atuais.filter(([n]) => n === nome).length;

      document.cookie = `${nome}=; Path=/; Max-Age=0; SameSite=Lax${seguro}`;

      const sobrou = cookiesDaSessao().some(([n]) => n === nome);
      if (copias === 1 && !sobrou) {
        document.cookie = `${nome}=${valor}; Path=${OPCOES_DO_COOKIE.path}; Max-Age=${PRAZO}; SameSite=Lax${seguro}`;
      }
    }
  }, []);

  return null;
}
