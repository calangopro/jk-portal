-- O upsert de variação usa onConflict em tray_variant_id, o que exige índice
-- único. Sem ele o Postgres recusa a operação e a variação nunca era gravada.
--
-- ATENÇÃO: o índice PARCIAL criado aqui não resolveu, porque o ON CONFLICT do
-- Postgres não casa com índice parcial. A correção definitiva está na 0014.

-- Limpa eventuais duplicados antes de criar o índice.
delete from public.product_variants a
using public.product_variants b
where a.tray_variant_id is not null
  and a.tray_variant_id = b.tray_variant_id
  and a.ctid > b.ctid;

create unique index if not exists product_variants_tray_variant_id_key
  on public.product_variants (tray_variant_id)
  where tray_variant_id is not null;
