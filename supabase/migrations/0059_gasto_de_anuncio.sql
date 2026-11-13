-- Gasto de anúncio por dia e plataforma, para o painel dizer o retorno real.
--
-- POR QUE
--
-- Para saber o gasto era preciso abrir Meta, Google e Pinterest, e para saber
-- a venda, a Tray. Ninguém cruzava os dois, e o retorno que cada plataforma
-- mostra conta pedido criado, não pedido pago (43% dos criados são cancelados).
--
-- COMO
--
-- `anuncios_gasto` guarda quanto foi gasto em cada dia, por plataforma e, se
-- houver, por campanha. A venda vem de `tray_pedidos`, pela etiqueta de origem
-- do pedido PAGO. O retorno é a divisão dos dois, feita na tela.
--
-- A linha diz de onde veio (`manual` ou `api`), porque as duas fontes vão
-- conviver: hoje quem lança é gente, e a leitura automática das plataformas
-- passa a gravar na mesma tabela quando os acessos existirem. A chave (dia,
-- plataforma, campanha) faz o lançamento novo do mesmo dia substituir o velho,
-- em vez de somar duas vezes.
--
-- Área nova, `trafego`: quem lança e vê o gasto. Os valores entram pelo painel,
-- nunca por migration.

alter table public.acessos_por_papel drop constraint acessos_por_papel_area_check;
alter table public.acessos_por_papel add constraint acessos_por_papel_area_check check (area in (
  'conteudo', 'site', 'catalogo', 'campanhas', 'vendas', 'recuperacao',
  'metricas', 'anuncios', 'margem', 'custos', 'equipe', 'fabrica', 'lancar_venda', 'trafego'));

insert into public.acessos_por_papel (papel, area)
select p, 'trafego' from unnest(array['admin', 'dono', 'gm', 'gerente', 'trafego']) as p;

create table public.anuncios_gasto (
  dia           date not null,
  plataforma    text not null check (plataforma in ('meta', 'google', 'pinterest', 'tiktok', 'outro')),
  campanha      text not null default '' check (char_length(campanha) <= 200),
  gasto         numeric(12, 2) not null check (gasto >= 0),
  impressoes    integer check (impressoes >= 0),
  cliques       integer check (cliques >= 0),
  fonte         text not null default 'manual' check (fonte in ('manual', 'api')),
  lancado_por   uuid references public.profiles (id) on delete set null,
  atualizado_em timestamptz not null default now(),
  primary key (dia, plataforma, campanha)
);

comment on table public.anuncios_gasto is
  'Gasto de anúncio por dia, plataforma e campanha. Campanha vazia é o total da plataforma no dia.';

create index anuncios_gasto_lancado_por_idx on public.anuncios_gasto (lancado_por);

alter table public.anuncios_gasto enable row level security;

create policy anuncios_gasto_select on public.anuncios_gasto
  for select to authenticated using ((select public.tem_acesso('trafego')));
create policy anuncios_gasto_insert on public.anuncios_gasto
  for insert to authenticated with check ((select public.tem_acesso('trafego')));
create policy anuncios_gasto_update on public.anuncios_gasto
  for update to authenticated
  using ((select public.tem_acesso('trafego'))) with check ((select public.tem_acesso('trafego')));

revoke all on public.anuncios_gasto from anon;

-- Gasto do intervalo, somado por plataforma e por dia. Roda com os direitos de
-- quem chama: sem a área de tráfego, vem tudo zerado.
create function public.resumo_de_gasto(p_de date, p_ate date)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with base as (
    select * from public.anuncios_gasto where dia between p_de and p_ate
  )
  select jsonb_build_object(
    'gasto', (select coalesce(sum(gasto), 0) from base),
    'dias_com_gasto', (select count(distinct dia) from base),
    'por_plataforma', coalesce((
      select jsonb_agg(l order by (l->>'gasto')::numeric desc)
      from (
        select jsonb_build_object(
          'plataforma', plataforma, 'gasto', sum(gasto), 'cliques', sum(cliques), 'impressoes', sum(impressoes),
          'dias', count(distinct dia), 'ultimo_dia', max(dia), 'por_api', bool_or(fonte = 'api')
        ) as l
        from base group by plataforma
      ) x
    ), '[]'::jsonb),
    'por_dia', coalesce((
      select jsonb_agg(l order by l->>'dia')
      from (select jsonb_build_object('dia', dia, 'gasto', sum(gasto)) as l from base group by dia) x
    ), '[]'::jsonb)
  );
$$;

revoke execute on function public.resumo_de_gasto(date, date) from public, anon;
grant execute on function public.resumo_de_gasto(date, date) to authenticated, service_role;
