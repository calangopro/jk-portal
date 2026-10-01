// worker.js
//
// Proxy do portal editorial. As rotas registradas na zona são
// `www.jkaliancas.com.br/guias*`, `www.jkaliancas.com.br/bio*` e
// `www.jkaliancas.com.br/grupo*`. As duas últimas também casam com qualquer
// caminho da loja que comece com "bio" ou "grupo" (nenhum, no sitemap de 24/09
// e no de 01/10), e por isso tudo que não é /guias, /bio nem /grupo segue
// intacto para a origem original, que é a Tray.
var worker_default = {
  async fetch(request) {
    const url = new URL(request.url);
    const p = url.pathname;
    const ehGuias = p === "/guias" || p.startsWith("/guias/");
    // O link da bio mora no portal em /guias/bio, mas a pessoa vê /bio. O
    // Next não aceita reescrever para dentro do basePath um caminho que está
    // fora dele (recusa no boot, "Invalid rewrite found"), então a máscara é
    // feita aqui: o navegador pede /bio e recebe a página de /guias/bio sem o
    // endereço mudar. Testado: a página hidrata sem erro e a navegação para o
    // resto do portal funciona, porque tudo que ela carrega já sai em /guias.
    const ehBio = p === "/bio" || p.startsWith("/bio/");
    // A página do anúncio do grupo de ofertas, mesma máscara da bio: o
    // navegador pede /grupo e recebe /guias/grupo. /grupo/entrar é o link fixo
    // que leva ao convite do grupo salvo no painel.
    const ehGrupo = p === "/grupo" || p.startsWith("/grupo/");
    if (!ehGuias && !ehBio && !ehGrupo) {
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

    // Um endereço só para a bio e para o grupo. Com barra no fim, o Next
    // responderia 308 para /guias/bio e a máscara cairia na frente da pessoa.
    if (p === "/bio/" || p === "/grupo/") {
      return Response.redirect(`${url.origin}${p.slice(0, -1)}${url.search}`, 301);
    }

    const caminho = ehBio || ehGrupo ? `/guias${p}` : p;
    const destino = new URL(caminho + url.search, "https://jk-portal.vercel.app");
    const pedido = new Request(destino, request);
    pedido.headers.set("x-forwarded-host", url.host);
    pedido.headers.set("x-forwarded-proto", "https");
    // O IP de quem está no navegador. A Vercel só enxerga a Cloudflare, e o
    // portal precisa do IP real para a API de Conversões do Meta casar o Lead
    // com a pessoa (`app/api/leads/route.ts`).
    pedido.headers.set("x-jk-ip-cliente", request.headers.get("cf-connecting-ip") || "");

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
