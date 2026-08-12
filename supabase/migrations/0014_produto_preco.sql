-- 1) Preço direto no produto.
-- O card de produto no conteúdo precisa de preço, e depender de variação
-- complica sem necessidade. Continua sendo espelho: quem manda é a Tray.
alter table public.products
  add column if not exists price             numeric(12, 2),
  add column if not exists promotional_price numeric(12, 2),
  add column if not exists availability_text text;

comment on column public.products.price is 'Espelho do preço na Tray. Nunca editar aqui.';

-- 2) O índice parcial da 0013 não serve para ON CONFLICT: o Postgres exige que
-- o destino do conflito case com o índice, e um índice com WHERE não casa.
drop index if exists public.product_variants_tray_variant_id_key;

create unique index if not exists product_variants_tray_variant_id_key
  on public.product_variants (tray_variant_id);
