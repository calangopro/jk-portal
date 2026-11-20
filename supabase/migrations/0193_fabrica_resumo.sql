-- 0193: Fábrica v2, a visão do gestor (cartão 64).
--
-- Para diretoria, GM e gerentes (área `vendas`), sem separar por setor: o que
-- entrou, o que saiu, quanto tempo cada etapa segura um trabalho e quanto do
-- que entrou é retrabalho (troca, refazer, ajuste). O "agora" (quantos em cada
-- etapa, atrasados) a tela tira da própria fila; aqui fica só o que pede o
-- histórico dos movimentos. "Entradas" conta pela data do pedido, da venda ou
-- da OS: só trabalho que a fábrica conhece (tem linha, desde a 0191).
--
-- TEMPO NA ETAPA é medido ENTRE DOIS MOVIMENTOS do mesmo trabalho: entrou na
-- etapa num movimento e saiu no seguinte. O primeiro movimento de cada
-- trabalho não conta, porque a hora em que ele entrou na fila não é
-- movimento (e as linhas de antes da 0191 nasceram todas no mesmo instante).
-- É conta, sem tabela nova.

create or replace function public.fabrica_resumo(p_dias integer default 30)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  with pode as (select coalesce(public.tem_acesso('vendas') or public.is_admin(), false) as sim),
  janela as (select greatest(least(coalesce(p_dias, 30), 365), 1) as n, now() - make_interval(days => greatest(least(coalesce(p_dias, 30), 365), 1)) as desde),
  movs as (
    select m.*,
      coalesce(m.pedido::text, 'v' || m.venda::text, 'a' || m.avulso::text) as quem,
      lag(m.em) over (partition by coalesce(m.pedido::text, 'v' || m.venda::text, 'a' || m.avulso::text) order by m.em, m.id) as entrou_em
    from public.fabrica_movimentos m
  ),
  tempos as (
    select de as etapa, count(*) as vezes,
      extract(epoch from avg(em - entrou_em))::bigint as media_s,
      extract(epoch from percentile_cont(0.5) within group (order by em - entrou_em))::bigint as mediana_s
    from movs, janela j
    where entrou_em is not null and em >= j.desde
    group by de
  ),
  saidas as (
    select count(distinct quem) as n from movs, janela j
    where em >= j.desde and para in (select chave from public.fabrica_etapas where papel = 'final')
  ),
  -- Quando o trabalho entrou: o dia do pedido, da venda ou da OS. A linha da 0191 nasceu na hora da migration e não serve.
  linhas as (
    select f.tipo, coalesce(t.feito_em, v.feita_em, a.criado_em, f.criado_em) as entrou
    from public.fabrica_pedidos f
    left join public.tray_pedidos t on t.pedido = f.pedido
    left join public.vendas_avulsas v on v.id = f.venda
    left join public.fabrica_avulsos a on a.id = f.avulso
  ),
  entradas as (
    select count(*) as n, count(*) filter (where l.tipo in ('troca', 'refazer', 'ajuste')) as retrabalho
    from linhas l, janela j
    where l.entrou >= j.desde
  ),
  por_tipo as (
    select coalesce(jsonb_object_agg(tipo, n), '{}'::jsonb) as j
    from (select l.tipo, count(*) as n from linhas l, janela j where l.entrou >= j.desde group by l.tipo) x
  ),
  por_dia as (
    select coalesce(jsonb_agg(jsonb_build_object('dia', dia, 'saidas', n) order by dia), '[]'::jsonb) as j
    from (
      select (m.em at time zone 'America/Sao_Paulo')::date as dia, count(distinct m.quem) as n
      from movs m, janela j
      where m.em >= j.desde and m.para in (select chave from public.fabrica_etapas where papel = 'final')
      group by 1
    ) x
  )
  select case when (select sim from pode) then jsonb_build_object(
    'dias', (select n from janela),
    'entradas', (select n from entradas),
    'retrabalho', (select retrabalho from entradas),
    'por_tipo', (select j from por_tipo),
    'saidas', (select n from saidas),
    'saidas_por_dia', (select j from por_dia),
    'tempos', coalesce((select jsonb_agg(jsonb_build_object('etapa', etapa, 'vezes', vezes, 'media_s', media_s, 'mediana_s', mediana_s)) from tempos), '[]'::jsonb)
  ) else null end
$$;

revoke all on function public.fabrica_resumo(integer) from public, anon;
grant execute on function public.fabrica_resumo(integer) to authenticated;
