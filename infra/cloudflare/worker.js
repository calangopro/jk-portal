// worker.js
//
// Proxy do portal editorial. A rota registrada na zona é
// `www.jkaliancas.com.br/guias*`, ou seja, este código NUNCA responde pela
// loja da Tray. Qualquer coisa fora de /guias segue para a origem original.
var worker_default = {
  async fetch(request) {
    const url = new URL(request.url);
    const p = url.pathname;
    const ehGuias = p === "/guias" || p.startsWith("/guias/");
    if (!ehGuias) {
      if (url.hostname.endsWith(".workers.dev")) {
        return new Response("Fora do /guias. No dominio real, quem responde aqui e a Tray.", { status: 200 });
      }
      return fetch(request);
    }

    // HTTP vira HTTPS aqui dentro, e não pelo "Always Use HTTPS" da zona.
    // Aquele botão vale para o domínio inteiro, e o domínio inteiro é a loja:
    // um callback de pagamento ou de integração ainda apontado para http://
    // perderia o corpo da requisição num 301. Aqui o desvio alcança só /guias.
    //
    // GET e HEAD saem em 301, que é o que o Google espera ver e consolida.
    // Qualquer outro método sai em 308, que preserva método e corpo, para um
    // POST perdido em http não virar GET vazio.
    if (url.protocol === "http:") {
      const seguro = new URL(url);
      seguro.protocol = "https:";
      const permanente = request.method === "GET" || request.method === "HEAD";
      return Response.redirect(seguro.toString(), permanente ? 301 : 308);
    }

    const destino = new URL(p + url.search, "https://jk-portal.vercel.app");
    const pedido = new Request(destino, request);
    pedido.headers.set("x-forwarded-host", url.host);
    pedido.headers.set("x-forwarded-proto", "https");

    const resposta = await fetch(pedido, { redirect: "manual" });
    const headers = new Headers(resposta.headers);
    headers.delete("Strict-Transport-Security");

    // O portal manda `X-Robots-Tag: noindex` em TODA resposta, e quem tira é
    // esta linha. Parece ao contrário, mas é o único desenho que funciona aqui.
    //
    // A Vercel recebe `Host: jk-portal.vercel.app` mesmo no tráfego real: o
    // `new Request` acima aponta para lá, e o domínio da JK não está cadastrado
    // no projeto da Vercel (testado: `Host: www.jkaliancas.com.br` responde
    // DEPLOYMENT_NOT_FOUND). O `x-forwarded-host` também não serve de sinal,
    // porque a Vercel sobrescreve ele com o host dela. Ou seja, o portal NÃO
    // tem como saber por qual endereço está sendo servido.
    //
    // Então a decisão vira: só é indexável o que passa por este proxy. O
    // endereço .vercel.app e toda prévia de branch continuam com o noindex que
    // o portal emitiu, e somem do Google sem que ninguém precise lembrar.
    //
    // Se um dia esta linha sair, o site inteiro sai do índice. Ela anda junto
    // com a regra em next.config.ts, e as duas se conferem em uma requisição:
    //   curl -sI https://www.jkaliancas.com.br/guias | grep -i x-robots  (vazio)
    //   curl -sI https://jk-portal.vercel.app/guias | grep -i x-robots   (noindex)
    headers.delete("X-Robots-Tag");
    return new Response(resposta.body, {
      status: resposta.status,
      statusText: resposta.statusText,
      headers
    });
  }
};
export {
  worker_default as default
};
