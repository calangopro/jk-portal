/*
 * Service worker do painel JK (cartão 59): SÓ RECEBE AVISO.
 *
 * Ele existe para o aviso por push chegar com o painel fechado, no celular e
 * no computador. Não guarda página, não guarda dado e não tem `fetch`: um
 * painel de faturamento servido de cache seria número velho na tela, e essa
 * regra continua valendo. Toda página vem do servidor, como antes.
 *
 * É registrado pela moldura do painel só depois que a pessoa liga os avisos,
 * com o escopo do painel (o mesmo do aplicativo instalado).
 *
 * O texto chega cifrado do servidor (`src/lib/avisos/enviar.ts`) e já sem
 * dado de cliente. O toque leva ao endereço do aviso: se o painel já está
 * aberto, ele vem para a frente e abre o lugar sem recarregar; se não, abre.
 */

// O prefixo do portal sai do endereço do próprio arquivo (`/guias/sw.js`), para não ser escrito à mão aqui.
const BASE = new URL(".", self.location.href).pathname.replace(/\/$/, "");
const PAINEL = `${BASE}/admin`;
const ICONE = `${BASE}/painel-icone-192.png`;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let aviso = {};
  try {
    aviso = event.data ? event.data.json() : {};
  } catch {
    aviso = { corpo: event.data ? event.data.text() : "" };
  }
  const titulo = aviso.titulo || "Painel JK";
  event.waitUntil(
    self.registration.showNotification(titulo, {
      body: aviso.corpo || "",
      tag: aviso.marca || "jk-aviso",
      // Com a mesma marca, o aviso novo troca o antigo e toca de novo (conversa que continua).
      renotify: Boolean(aviso.marca),
      icon: aviso.icone || ICONE,
      badge: aviso.emblema || ICONE,
      lang: "pt-BR",
      data: { url: aviso.url || PAINEL },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || PAINEL, self.location.origin);
  const doPainel = url.origin === self.location.origin;
  event.waitUntil(
    (async () => {
      if (doPainel) {
        const janelas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        const painel = janelas.find((j) => new URL(j.url).pathname.startsWith(PAINEL));
        if (painel) {
          // O painel aberto troca de lugar sozinho (sem recarregar): a moldura escuta esta mensagem.
          painel.postMessage({ tipo: "jk-abrir", url: url.pathname + url.search });
          try {
            await painel.focus();
          } catch {
            // Alguns sistemas não deixam trazer a janela para a frente: a pessoa toca no app.
          }
          return;
        }
      }
      await self.clients.openWindow(url.href);
    })(),
  );
});
