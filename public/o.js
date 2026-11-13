/*
 * Coletor de origem da JK Alianças. A fonte é public/o.js no repositório do portal.
 *
 * Roda na loja e no portal e manda ao portal, pelo mesmo domínio, de onde a
 * pessoa chegou: o endereço da página (com as UTMs), o site anterior, a sessão
 * da Tray e, na página de confirmação, o número do pedido. Não lê formulário,
 * não lê nome, telefone nem e-mail, e não grava cookie: quem grava é a resposta
 * do servidor.
 *
 * Tudo dentro de try: este arquivo nunca pode quebrar a página de ninguém.
 */
(function () {
  "use strict";
  /* Carregado de novo na mesma página (o GTM dispara a etiqueta outra vez na compra): só confere de novo. */
  if (window.__jkOrigem) {
    try { if (typeof window.__jkOrigemPasso === "function") window.__jkOrigemPasso(); } catch (e) { /* nunca quebra a página */ }
    return;
  }
  window.__jkOrigem = 1;

  var API = "/guias/api/origem";
  var ETIQUETA = /[?&](utm_[a-z]+|gclid|gbraid|wbraid|gad_source|gad_campaignid|fbclid|ttclid|msclkid|epik|o)=/i;
  var memoria = {};

  function ler(chave) {
    try { return sessionStorage.getItem(chave); } catch (e) { return memoria[chave] || null; }
  }
  function guardar(chave, valor) {
    memoria[chave] = valor;
    try { sessionStorage.setItem(chave, valor); } catch (e) { /* aba sem armazenamento */ }
  }

  /* A sessão da Tray: a loja põe em <html data-session>, e o carrinho leva no endereço. */
  function sessao() {
    var s = document.documentElement.getAttribute("data-session") || "";
    if (!s) {
      var m = /[?&]session_id=([a-z0-9]{20,40})(?:&|$)/i.exec(location.search);
      if (m) s = m[1];
    }
    return /^[a-z0-9]{20,40}$/i.test(s) ? s : "";
  }

  /* O número do pedido, onde a página de confirmação o informar. */
  function pedido() {
    var achado = "";
    function olhar(o) {
      if (!o || typeof o !== "object" || achado) return;
      var v = o.transactionId || o.transaction_id || o.orderId || o.order_id;
      if (v && /^\d{1,10}$/.test(String(v)) && String(v) !== "0") { achado = String(v); return; }
      if (o.ecommerce) {
        olhar(o.ecommerce);
        /* A Tray informa a compra no formato antigo do Google: ecommerce.purchase.actionField.id é o número do pedido. */
        var compra = o.ecommerce.purchase && o.ecommerce.purchase.actionField;
        if (!achado && compra && /^\d{1,10}$/.test(String(compra.id)) && String(compra.id) !== "0") achado = String(compra.id);
      }
    }
    var filas = [window.dataLayer, window.dataLayerGa4];
    for (var f = 0; f < filas.length && !achado; f++) {
      var fila = filas[f];
      if (!fila || !fila.length) continue;
      for (var i = 0; i < fila.length && !achado; i++) {
        var item = fila[i];
        if (!item) continue;
        /* O gtag guarda cada chamada como lista de argumentos: ["event", "purchase", {...}]. */
        if (typeof item.length === "number" && item[0] === "event") { if (item[1] === "purchase") olhar(item[2]); }
        else olhar(item);
      }
    }
    if (!achado && /checkout|finaliz|obrigado|pedido/i.test(location.pathname)) {
      var m = /[?&](?:order_id|id_pedido|pedido|order)=(\d{1,10})(?:&|$)/i.exec(location.search);
      if (m && m[1] !== "0") achado = m[1];
    }
    return achado;
  }

  function enviar(corpo) {
    var texto = JSON.stringify(corpo);
    if (window.fetch) {
      fetch(API, { method: "POST", body: texto, keepalive: true, credentials: "same-origin", headers: { "Content-Type": "text/plain" } }).catch(function () {});
    } else if (navigator.sendBeacon) {
      navigator.sendBeacon(API, texto);
    }
  }

  function passo() {
    try {
      var s = sessao();
      var p = pedido();
      var primeira = !ler("jk_o");
      var etiquetada = ETIQUETA.test(location.search) && ler("jk_u") !== location.search;
      var deFora = false;
      try {
        deFora = !!document.referrer && new URL(document.referrer).host !== location.host && ler("jk_r") !== document.referrer;
      } catch (e) { /* endereço anterior torto */ }
      var sessaoNova = !!s && ler("jk_s") !== s;
      var pedidoNovo = !!p && ler("jk_p") !== p;
      if (!primeira && !etiquetada && !deFora && !sessaoNova && !pedidoNovo) return;

      guardar("jk_o", "1");
      if (etiquetada) guardar("jk_u", location.search);
      if (deFora) guardar("jk_r", document.referrer);
      if (s) guardar("jk_s", s);
      if (p) guardar("jk_p", p);
      enviar({
        u: location.href.slice(0, 1800),
        r: (document.referrer || "").slice(0, 500),
        s: s || undefined,
        p: p || undefined,
        n: primeira ? 1 : undefined
      });
    } catch (e) { /* nunca quebra a página */ }
  }

  window.__jkOrigemPasso = passo;
  passo();
  /* A loja preenche a sessão e a compra depois que a página abre: confere de novo algumas vezes. */
  var esperas = [1000, 3000, 7000, 15000];
  for (var i = 0; i < esperas.length; i++) setTimeout(passo, esperas[i]);
  try {
    new MutationObserver(passo).observe(document.documentElement, { attributes: true, attributeFilter: ["data-session"] });
  } catch (e) { /* navegador sem observador */ }
})();
