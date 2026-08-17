import { comBasePath } from "@/lib/seo/base-path";

/**
 * HTML da resposta 410, escrito à mão.
 *
 * Precisa ser HTML puro porque o middleware roda antes do React e não consegue
 * renderizar componente. Antes esta resposta era `text/plain` com uma frase,
 * o que deixava quem chegou por um link antigo sem nenhuma saída, exatamente
 * onde a documentação de links do Google diz que a página mais precisa levar a
 * outra.
 *
 * As cores vêm dos tokens da marca em globals.css, copiadas aqui porque o CSS
 * do site não é carregado nesta resposta. Sem fonte externa e sem imagem: a
 * página precisa aparecer inteira num único pedido.
 *
 * Os links levam `comBasePath` na mão: aqui não há `next/link` para somar o
 * prefixo do portal, e um href na raiz sairia do /guias e cairia na loja.
 */
export function paginaRemovidaHtml(): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, follow">
<title>Página removida | JK Alianças</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem 1.25rem;
    background: #f7f3ec;
    color: #1a1815;
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    line-height: 1.6;
  }
  main { max-width: 34rem; width: 100%; }
  .marca {
    font-size: 0.75rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #84663c;
    font-weight: 600;
    margin: 0 0 1.25rem;
  }
  h1 {
    font-family: Georgia, "Times New Roman", serif;
    font-size: clamp(1.9rem, 1.4rem + 2vw, 2.8rem);
    line-height: 1.1;
    margin: 0 0 1rem;
    font-weight: 500;
  }
  p { margin: 0 0 1.75rem; color: #56504a; }
  .filete { height: 1px; background: linear-gradient(90deg, #be9b60, transparent); margin: 0 0 1.75rem; }
  ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.75rem; }
  a {
    display: block;
    padding: 1rem 1.25rem;
    border: 1px solid #e8e2d8;
    border-radius: 14px;
    background: #fff;
    color: #1a1815;
    text-decoration: none;
    font-weight: 600;
  }
  a:hover, a:focus-visible { border-color: #be9b60; }
  a span { display: block; font-weight: 400; font-size: 0.875rem; color: #56504a; margin-top: 0.2rem; }
</style>
</head>
<body>
<main>
  <p class="marca">JK Alianças</p>
  <h1>Esta página saiu do ar</h1>
  <p>O conteúdo que estava neste endereço foi removido e não tem substituto direto. Abaixo estão as páginas mais procuradas do site.</p>
  <div class="filete"></div>
  <ul>
    <li><a href="${comBasePath("/dicas")}">Dicas de alianças e joias<span>Tamanho, largura, material e cuidados.</span></a></li>
    <li><a href="${comBasePath("/medidor-de-aliancas")}">Medidor de aliança<span>Descubra o tamanho da sua aliança pela tela.</span></a></li>
    <li><a href="${comBasePath("/lojas")}">Lojas JK Alianças<span>Endereço, horário e rota das unidades.</span></a></li>
    <li><a href="${comBasePath("/")}">Início<span>A capa do portal.</span></a></li>
  </ul>
</main>
</body>
</html>`;
}
