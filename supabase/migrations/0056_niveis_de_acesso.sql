-- Níveis de acesso: quem vê o quê no painel.
--
-- POR QUE
--
-- O painel só conhecia administrador, editor, revisor e autor, e tudo que não
-- era conteúdo ficou "só administrador". Com vendas, recuperação e custos no
-- ar, a JK precisa de níveis que acompanhem a empresa: dono, GM, gerente,
-- tráfego, vendas e fábrica.
--
-- COMO
--
-- O que cada nível enxerga mora numa tabela só, `acessos_por_papel` (papel,
-- área). O banco decide por ela (`tem_acesso`) e o painel LÊ a mesma tabela
-- (`meus_acessos`) para montar o menu e barrar a rota. Mudar o acesso de um
-- nível é mudar uma linha, sem publicar código.
--
-- Dono e GM têm o mesmo acesso do administrador: muda só o nome. `is_admin()`
-- passa a valer para os três, então tudo que já era "só administrador"
-- (margem, custos da empresa, aprovar campanha, usuários) abre para eles sem
-- tocar em policy nenhuma.
--
-- Vendas e fábrica NÃO são "staff": `is_staff()` deixa os dois de fora, e com
-- isso as 58 policies das tabelas de conteúdo (posts, redirects, leads,
-- configurações) continuam fechadas para eles. O que esses níveis usam chega
-- por função que confere a área.
--
-- A fila de recuperação vira `security definer` com a conferência da área
-- DENTRO dela: o vendedor recebe a fila sem ganhar leitura da tabela de
-- pedidos, que é faturamento e pede a área `vendas`.
--
-- As pessoas mudam de nível DEPOIS de o código que entende os nomes novos
-- estar publicado. Antes disso, um administrador virado em "gm" seria barrado
-- pelo painel antigo, que só conhece "admin".

alter type public.app_role add value if not exists 'dono';
alter type public.app_role add value if not exists 'gm';
alter type public.app_role add value if not exists 'gerente';
alter type public.app_role add value if not exists 'trafego';
alter type public.app_role add value if not exists 'vendas';
alter type public.app_role add value if not exists 'fabrica';

create table public.acessos_por_papel (
  papel    text not null check (papel in (
             'admin', 'dono', 'gm', 'gerente', 'trafego', 'vendas', 'fabrica',
             'editor', 'reviewer', 'author')),
  area     text not null check (area in (
             'conteudo', 'site', 'catalogo', 'campanhas', 'vendas', 'recuperacao',
             'metricas', 'anuncios', 'margem', 'custos', 'equipe', 'fabrica')),
  liberado boolean not null default true,
  primary key (papel, area)
);

comment on table public.acessos_por_papel is
  'O que cada nível de acesso enxerga. Fonte única: o banco decide por tem_acesso() e o painel lê por meus_acessos().';

alter table public.acessos_por_papel enable row level security;

create policy acessos_admin_select on public.acessos_por_papel
  for select to authenticated using ((select public.is_admin()));
create policy acessos_admin_insert on public.acessos_por_papel
  for insert to authenticated with check ((select public.is_admin()));
create policy acessos_admin_update on public.acessos_por_papel
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

revoke all on public.acessos_por_papel from anon;

-- Administrador, dono e GM: tudo.
insert into public.acessos_por_papel (papel, area)
select p, a
from unnest(array['admin', 'dono', 'gm']) as p,
     unnest(array['conteudo', 'site', 'catalogo', 'campanhas', 'vendas', 'recuperacao',
                  'metricas', 'anuncios', 'margem', 'custos', 'equipe', 'fabrica']) as a;

-- Gerente: quase tudo. Fica de fora o custo (das peças e da empresa), o limite
-- de anúncio, que entrega o custo, e a gestão de acessos e chaves.
insert into public.acessos_por_papel (papel, area)
select 'gerente', a
from unnest(array['conteudo', 'site', 'catalogo', 'campanhas', 'vendas', 'recuperacao', 'metricas', 'fabrica']) as a;

-- Tráfego: o que vendeu, de onde veio, a busca e as campanhas.
insert into public.acessos_por_papel (papel, area)
select 'trafego', a from unnest(array['vendas', 'metricas', 'campanhas', 'catalogo']) as a;

-- Vendas: a fila de quem não pagou e a consulta de produto.
insert into public.acessos_por_papel (papel, area)
select 'vendas', a from unnest(array['recuperacao', 'catalogo']) as a;

-- Fábrica: só a área dela, que ainda vai ser construída.
insert into public.acessos_por_papel (papel, area) values ('fabrica', 'fabrica');

-- Os níveis editoriais continuam com o que já tinham.
insert into public.acessos_por_papel (papel, area)
select 'editor', a from unnest(array['conteudo', 'site', 'catalogo', 'campanhas', 'metricas']) as a;
insert into public.acessos_por_papel (papel, area)
select p, a from unnest(array['reviewer', 'author']) as p, unnest(array['conteudo', 'metricas']) as a;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active and p.role::text in ('admin', 'dono', 'gm')
  );
$function$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active and p.role::text not in ('vendas', 'fabrica')
  );
$function$;

-- Só devolve um booleano, como is_admin(): é o que deixa policy e função
-- perguntarem pela área sem abrir a tabela de perfis para ninguém.
create function public.tem_acesso(p_area text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    join public.acessos_por_papel a on a.papel = p.role::text
    where p.id = (select auth.uid()) and p.is_active and a.area = p_area and a.liberado
  );
$$;

-- As áreas de quem está logado, para o painel montar o menu e barrar a rota.
create function public.meus_acessos()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(a.area order by a.area), '{}')
  from public.profiles p
  join public.acessos_por_papel a on a.papel = p.role::text
  where p.id = (select auth.uid()) and p.is_active and a.liberado;
$$;

revoke execute on function public.tem_acesso(text) from public, anon;
revoke execute on function public.meus_acessos() from public, anon;
grant execute on function public.tem_acesso(text) to authenticated, service_role;
grant execute on function public.meus_acessos() to authenticated, service_role;

-- Pedidos da Tray são faturamento: pedem a área de vendas.
alter policy tray_pedidos_admin_select on public.tray_pedidos
  using ((select public.tem_acesso('vendas')));

-- As decisões da fila pedem a área de recuperação.
alter policy recuperacao_casos_admin_select on public.recuperacao_casos
  using ((select public.tem_acesso('recuperacao')));
alter policy recuperacao_casos_admin_insert on public.recuperacao_casos
  with check ((select public.tem_acesso('recuperacao')));
alter policy recuperacao_casos_admin_update on public.recuperacao_casos
  using ((select public.tem_acesso('recuperacao')))
  with check ((select public.tem_acesso('recuperacao')));

-- A fila passa a rodar com os direitos de quem a criou e confere a área por
-- dentro. O corpo é o mesmo da 0054, com a conferência na primeira leitura.
create or replace function public.fila_de_recuperacao(p_dias integer default 14)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with janela as (
    select p.*, coalesce(p.cliente_telefone, p.cliente_email, p.cliente_codigo) as cliente
    from public.tray_pedidos p
    where p.dia > (now() at time zone 'America/Sao_Paulo')::date - greatest(least(p_dias, 90), 1)
      and public.tem_acesso('recuperacao')
  ),
  por_cliente as (
    select
      cliente,
      count(*) as tentativas,
      min(feito_em) as primeira,
      max(feito_em) as ultima,
      max(total) as maior_valor,
      (array_agg(pedido order by feito_em desc))[1] as pedido_ref,
      array_agg(pedido) as pedidos
    from janela
    where situacao in ('cancelado', 'aguardando') and cliente is not null
    group by cliente
  ),
  casos as (
    select
      c.pedido_ref as pedido,
      c.tentativas,
      c.primeira,
      c.ultima,
      c.maior_valor,
      r.cliente_nome as cliente,
      r.cliente_telefone as telefone,
      r.cliente_email as email,
      r.cidade,
      r.uf,
      r.status,
      (r.situacao = 'aguardando') as aguardando,
      r.pagamento_tipo as pagamento,
      coalesce(r.utm_source, '') as origem,
      (
        select string_agg(i.nome, ' + ')
        from jsonb_to_recordset(coalesce(r.itens, '[]'::jsonb)) as i(nome text, preco numeric)
        where coalesce(i.preco, 0) > 0
      ) as itens,
      pg.pedido as pago_pedido,
      pg.total as pago_valor,
      pg.feito_em as pago_em,
      e.nota,
      e.valor_fora,
      e.atualizado_em as estado_em,
      case
        when pg.pedido is not null then 'recuperado'
        when e.estado in ('em_contato', 'pago_por_fora', 'descartado') then e.estado
        else 'a_recuperar'
      end as fase
    from por_cliente c
    join public.tray_pedidos r on r.pedido = c.pedido_ref
    left join lateral (
      select q.pedido, q.total, q.feito_em
      from public.tray_pedidos q
      where coalesce(q.cliente_telefone, q.cliente_email, q.cliente_codigo) = c.cliente
        and q.situacao = 'pago'
        and q.feito_em >= c.primeira - interval '2 hours'
      order by q.feito_em
      limit 1
    ) pg on true
    left join lateral (
      select s.estado, s.nota, s.valor_fora, s.atualizado_em
      from public.recuperacao_casos s
      where s.pedido = any (c.pedidos)
      order by s.atualizado_em desc
      limit 1
    ) e on true
  ),
  com_valor as (
    select
      casos.*,
      case fase
        when 'recuperado' then pago_valor
        when 'pago_por_fora' then valor_fora
        else maior_valor
      end as valor
    from casos
  )
  select jsonb_build_object(
    'dias', greatest(least(p_dias, 90), 1),
    'resumo', coalesce((
      select jsonb_object_agg(fase, jsonb_build_object('clientes', clientes, 'valor', valor))
      from (
        select fase, count(*) as clientes, coalesce(sum(valor), 0) as valor
        from com_valor
        group by fase
      ) t
    ), '{}'::jsonb),
    'casos', coalesce((
      select jsonb_agg(to_jsonb(l) order by l.valor desc, l.ultima desc)
      from (select * from com_valor order by valor desc limit 400) l
    ), '[]'::jsonb)
  );
$$;

revoke execute on function public.fila_de_recuperacao(integer) from public, anon;
grant execute on function public.fila_de_recuperacao(integer) to authenticated, service_role;
