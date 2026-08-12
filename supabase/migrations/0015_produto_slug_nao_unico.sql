-- O slug do produto é informativo: o portal nunca roteia por ele, porque o
-- produto vive na Tray. Manter unicidade fazia produtos de nome parecido
-- colidirem e sumirem na sincronização (1110 lidos, 643 gravados).
-- Quem garante identidade é `tray_id`, que continua único.

alter table public.products drop constraint if exists products_slug_key;

create index if not exists products_slug_idx on public.products (slug);
