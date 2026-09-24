-- Impressão de cada produto na última sincronização.
--
-- POR QUE
--
-- A sincronização com a Tray gravava os 1.162 produtos um por um, a cada
-- rodada, e passava de dois minutos. Na Vercel a função morria no meio: em
-- 24/09/2026 ficaram 740 produtos com preço do dia e o resto com preço de
-- agosto, sem registro em `sync_logs`. Para rodar de quinze em quinze minutos
-- (0040), a rodada precisa gravar só o que mudou na loja.
--
-- `sync_hash` é um SHA-1 da linha que a sincronização gravaria (produto mais
-- variação, com o `raw` inteiro). Mesma impressão, nada a gravar. Preço,
-- promoção, janela e disponibilidade são conferidos também campo a campo no
-- código, para o preço nunca depender só desta coluna.
--
-- Nula quer dizer "regrave": é o estado de toda linha logo depois desta
-- migration, de produto desativado e de produto cuja variação falhou.

alter table public.products
  add column if not exists sync_hash text;

comment on column public.products.sync_hash is
  'SHA-1 da última linha gravada pela sincronização com a Tray. Nula força regravar.';
