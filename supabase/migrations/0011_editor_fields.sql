-- Campos que o editor em blocos precisa.
-- body_html guarda a saída do editor (HTML semântico, que é o que o SEO lê).
-- target_query é a consulta principal que a página quer ganhar, usada pelo
-- analisador e para checar canibalização.

alter table public.contents
  add column if not exists body_html   text,
  add column if not exists target_query text;

comment on column public.contents.body_html is
  'HTML semântico gerado pelo editor em blocos (TipTap). Fonte do que vai ao ar.';
comment on column public.contents.target_query is
  'Consulta principal alvo, ex.: "aliança de namoro".';
