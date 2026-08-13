import { lerHex, paraTriplete } from "./cor";
import { TOKENS_DE_COR, TOKENS_DE_RAIO, TRIPLETES } from "./tokens";
import { corValida, medidaValida, type Tema } from "./tipos";

/**
 * Transforma o tema em CSS para o `<style>` do layout raiz.
 *
 * Duas decisões que parecem detalhe e não são:
 *
 * 1. O seletor é `:root:root`, não `:root`. Repetir o seletor dobra a
 *    especificidade (0,2,0 contra 0,1,0), então este bloco vence o `:root` que
 *    o Tailwind emite SEM depender da ordem no documento. Ordem é frágil aqui:
 *    muda com o hoisting de `<style>` do React 19, com o `precedence` e com a
 *    injeção de estilo do HMR em desenvolvimento.
 *
 * 2. Todo valor é conferido de novo antes de virar texto. O `zod` já validou na
 *    leitura, mas este é o último ponto antes de o conteúdo entrar em
 *    `dangerouslySetInnerHTML`. Validar duas vezes custa nada e é o que separa
 *    "campo com valor errado" de "site derrubado por uma string".
 */
export function cssDoTema(tema: Tema): string {
  const linhas: string[] = [];

  for (const token of TOKENS_DE_COR) {
    const valor = tema.cores[token.nome];
    if (!valor || !corValida(valor)) continue;
    linhas.push(`--color-${token.nome}:${valor}`);

    // Alguns tokens também saem como triplete, para o CSS conseguir aplicar
    // alfa em cima deles (vidro, sombra, borda, gradiente).
    const varTriplete = TRIPLETES[token.nome];
    if (varTriplete) {
      const rgb = lerHex(valor);
      if (rgb) linhas.push(`${varTriplete}:${paraTriplete(rgb)}`);
    }
  }

  for (const token of TOKENS_DE_RAIO) {
    const valor = tema.raios[token.nome];
    if (!valor || !medidaValida(valor)) continue;
    linhas.push(`--radius-${token.nome}:${valor}`);
  }

  return `:root:root{${linhas.join(";")}}`;
}

/**
 * Identificador curto e estável do tema, para o atributo `href` do `<style>`.
 *
 * O React 19 deduplica estilo içado por `href`: com um `href` fixo, trocar o
 * tema não reinseriria nada e a mudança não apareceria. O hash resolve isso.
 * Não é hash criptográfico e nem precisa ser, só precisa mudar quando o CSS
 * muda, então evita carregar `node:crypto` no layout.
 */
export function hashDoTema(css: string): string {
  let h = 5381;
  for (let i = 0; i < css.length; i++) h = ((h << 5) + h + css.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
