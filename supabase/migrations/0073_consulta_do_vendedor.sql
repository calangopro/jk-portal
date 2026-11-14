-- 0073: a consulta do vendedor ("dá para entregar?").
--
-- De onde veio: o grupo do time de vendas no WhatsApp, lido em 14/11/2026. Em
-- dois dias e meio, 15 das 58 dúvidas do vendedor novo eram "tem em tal loja?"
-- ou "dá para amanhã?", e duas pessoas respondiam todas, de cabeça. O painel
-- não tinha onde consultar produto, pronta entrega nem prazo.
--
-- TRÊS MUDANÇAS:
--
-- 1. Área nova, `consulta`, para quem atende cliente ou despacha peça:
--    administrador, dono, GM, gerente, vendas e fábrica.
--
-- 2. O vendedor perde a área `catalogo`. Ela abria no menu dele "Produtos" e
--    "Lojas físicas", que são telas de quem cuida do catálogo e devolviam o
--    vendedor para o início. A consulta é a tela dele para ver produto.
--
-- 3. `pronta_entrega`: o que se sabe que cada loja física tem para entregar na
--    hora. NÃO é estoque contado, e a tabela não finge que é: é um quadro de
--    avisos, em que cada linha diz quem informou e quando. Informação velha
--    aparece como velha na tela. O estoque de verdade só vem com a API da Tray
--    ou com um sistema de loja, e nenhum dos dois existe hoje.

alter table public.acessos_por_papel drop constraint acessos_por_papel_area_check;
alter table public.acessos_por_papel add constraint acessos_por_papel_area_check check (area in (
  'conteudo', 'site', 'catalogo', 'campanhas', 'vendas', 'recuperacao',
  'metricas', 'anuncios', 'margem', 'custos', 'equipe', 'fabrica', 'lancar_venda',
  'trafego', 'loja', 'consulta'));

insert into public.acessos_por_papel (papel, area)
select p, 'consulta' from unnest(array['admin', 'dono', 'gm', 'gerente', 'vendas', 'fabrica']) as p
on conflict do nothing;

delete from public.acessos_por_papel where papel = 'vendas' and area = 'catalogo';

create table public.pronta_entrega (
  id             bigint generated always as identity primary key,
  location_id    uuid not null references public.locations (id) on delete cascade,
  product_id     uuid not null references public.products (id) on delete cascade,
  -- `false` é "acabou": a linha fica, para a tela dizer quando e quem viu acabar.
  tem            boolean not null default true,
  -- As numerações, como a pessoa escreveu ("16, 17 e 22").
  numeracoes     text check (char_length(numeracoes) <= 120),
  observacao     text check (char_length(observacao) <= 200),
  atualizado_por uuid references public.profiles (id) on delete set null,
  atualizado_em  timestamptz not null default now(),
  unique (location_id, product_id)
);

comment on table public.pronta_entrega is
  'Quadro de avisos do que cada loja física tem para entregar na hora. Não é estoque contado: cada linha diz quem informou e quando.';

create index pronta_entrega_produto_idx on public.pronta_entrega (product_id);
create index pronta_entrega_quem_idx on public.pronta_entrega (atualizado_por);

alter table public.pronta_entrega enable row level security;

-- Leitura para quem tem a área. Escrita, nenhuma: quem grava é a função abaixo.
create policy pronta_entrega_select on public.pronta_entrega
  for select to authenticated using ((select public.tem_acesso('consulta')));

revoke all on public.pronta_entrega from anon;

/**
 * Informa o que uma loja tem (ou deixou de ter) de um produto. É a única porta
 * de escrita: confere a área e guarda quem informou e quando.
 */
create or replace function public.informar_pronta_entrega(
  p_loja uuid,
  p_produto uuid,
  p_tem boolean,
  p_numeracoes text default null,
  p_observacao text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quem uuid := (select auth.uid());
begin
  if not public.tem_acesso('consulta') then
    raise exception 'Seu acesso não inclui a consulta.' using errcode = '42501';
  end if;
  if p_tem is null then
    raise exception 'Diga se a loja tem ou não tem a peça.' using errcode = '22023';
  end if;
  if char_length(coalesce(p_numeracoes, '')) > 120 or char_length(coalesce(p_observacao, '')) > 200 then
    raise exception 'Texto longo demais.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.locations l where l.id = p_loja and l.status = 'published') then
    raise exception 'Loja desconhecida.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.products pr where pr.id = p_produto and pr.is_active) then
    raise exception 'Produto desconhecido.' using errcode = '22023';
  end if;

  insert into public.pronta_entrega as e (location_id, product_id, tem, numeracoes, observacao, atualizado_por, atualizado_em)
  values (p_loja, p_produto, p_tem, nullif(btrim(p_numeracoes), ''), nullif(btrim(p_observacao), ''), v_quem, now())
  on conflict (location_id, product_id) do update set
    tem = excluded.tem,
    -- Quando acaba, a numeração antiga não vale mais.
    numeracoes = case when excluded.tem then excluded.numeracoes else null end,
    observacao = excluded.observacao,
    atualizado_por = v_quem,
    atualizado_em = now();

  return jsonb_build_object('ok', true);
end
$$;

revoke execute on function public.informar_pronta_entrega(uuid, uuid, boolean, text, text) from public, anon;
grant execute on function public.informar_pronta_entrega(uuid, uuid, boolean, text, text) to authenticated;

/**
 * O quadro inteiro, com o nome de quem informou. Função, e não leitura direta,
 * porque o nome mora em `profiles`, que o vendedor não lê.
 */
create or replace function public.quadro_de_pronta_entrega()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'loja', e.location_id,
    'produto', e.product_id,
    'tem', e.tem,
    'numeracoes', e.numeracoes,
    'observacao', e.observacao,
    'por', (select pr.full_name from public.profiles pr where pr.id = e.atualizado_por),
    'em', e.atualizado_em
  ) order by e.atualizado_em desc), '[]'::jsonb)
  from public.pronta_entrega e
  where (select public.tem_acesso('consulta'))
$$;

revoke execute on function public.quadro_de_pronta_entrega() from public, anon;
grant execute on function public.quadro_de_pronta_entrega() to authenticated;
