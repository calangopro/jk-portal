-- Cartão 76: painel mais rápido ao trocar de aba.
--
-- kommo_alertas e kommo_funil_unico copiavam TODAS as colunas de kommo_negocios
-- (`select n.*`, 685 bytes por linha, com o JSON `campos`) para um CTE usado
-- várias vezes. O CTE não cabia na memória de trabalho e ia para arquivo
-- temporário em disco: 23 MB por chamada no funil e 3,7 MB nos alertas
-- (pg_stat_statements, 21/11), com média de 2,2 s e 2,0 s e picos de 7 s,
-- porque disco é o que oscila numa instância pequena. Eram as duas únicas
-- consultas do banco que escreviam em disco temporário.
--
-- A troca é só a lista de colunas: cada função passa a levar as colunas que
-- usa. Nenhuma conta, filtro, permissão ou formato de resposta muda. No fim, a
-- regra de origem do negócio passa a poder ser embutida na consulta (ver lá).
--
-- Medido numa transação desfeita, com a sessão de um GM e a resposta comparada
-- com a de antes (idêntica): funil de 1,0 a 1,2 s para 0,18 a 0,29 s, alertas de
-- 47 a 57 ms para 20 a 29 ms, nenhum dos dois em disco.

CREATE OR REPLACE FUNCTION public.kommo_alertas(p_atencao_min integer DEFAULT 30, p_ruim_min integer DEFAULT 120)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_atencao interval := make_interval(mins => greatest(1, coalesce(p_atencao_min, 30)));
  v_ruim interval := make_interval(mins => greatest(1, coalesce(p_ruim_min, 120)));
  v jsonb;
begin
  if not (coalesce(public.is_admin(), false) or coalesce(public.tem_acesso('vendas'), false)) then
    return null;
  end if;
  with abertos as (
    select n.funil_id, n.etapa_id, n.etapa_desde, n.valor,
           n.ultima_msg_cliente_em, n.ultima_msg_loja_em, x.fase
      from public.kommo_negocios n
      left join public.fases_da_kommo x on x.funil_id = n.funil_id and x.etapa_id = n.etapa_id
     where not n.apagado and n.etapa_id not in (142, 143)
  )
  select jsonb_build_object(
    'lido_em', (select ultima_leitura_em from public.kommo_estado where id = 1),
    'esperando', (
      select jsonb_build_object(
        'total', count(*),
        'atencao', count(*) filter (where etapa_desde < now() - v_atencao),
        'ruim', count(*) filter (where etapa_desde < now() - v_ruim),
        'valor', coalesce(sum(valor) filter (where etapa_desde < now() - v_atencao), 0),
        'mais_antigo_min', round((extract(epoch from now() - min(etapa_desde)) / 60)::numeric, 0))
      from abertos where fase = 'esperando_vendedor'
    ),
    'sem_resposta', (
      select jsonb_build_object(
        'total', count(*),
        'atencao', count(*) filter (where ultima_msg_cliente_em < now() - v_atencao),
        'ruim', count(*) filter (where ultima_msg_cliente_em < now() - v_ruim),
        'valor', coalesce(sum(valor) filter (where ultima_msg_cliente_em < now() - v_atencao), 0),
        'mais_antigo_min', round((extract(epoch from now() - min(ultima_msg_cliente_em)) / 60)::numeric, 0))
      from abertos
     where ultima_msg_cliente_em > coalesce(ultima_msg_loja_em, '-infinity'::timestamptz)
       and coalesce(fase, '') not in ('ganho', 'perdido', 'pos_venda')
    ),
    'etapas_sem_fase', (select count(distinct (funil_id, etapa_id)) from abertos where fase is null)
  ) into v;
  return v;
end $function$;

CREATE OR REPLACE FUNCTION public.kommo_funil_unico(p_dias integer DEFAULT 30, p_loja uuid DEFAULT NULL::uuid, p_pessoa uuid DEFAULT NULL::uuid, p_funil bigint DEFAULT NULL::bigint, p_origem text DEFAULT NULL::text, p_alerta text DEFAULT NULL::text, p_atencao_min integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_desde timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_dias, 30), 365)));
  v_atencao interval := make_interval(mins => greatest(1, coalesce(p_atencao_min, 30)));
  v jsonb;
begin
  if not (coalesce(public.is_admin(), false) or coalesce(public.tem_acesso('vendas'), false)) then
    return null;
  end if;

  with base as (
    select n.id, n.nome, n.valor, n.funil_id, n.etapa_id, n.responsavel_id, n.etapa_desde,
           n.ultima_msg_cliente_em, n.ultima_msg_loja_em, n.fechado_em, n.criado_em, n.motivo_perda_id,
           x.fase, x.origem as origem_fase, m.profile_id, m.location_id,
           public.kommo_origem_do_negocio(n.meta_ad_id, n.meta_adset_id, n.meta_campaign_id, n.gclid, n.origem_cliente, n.utm_source) as origem,
           n.etapa_id not in (142, 143) as aberto,
           coalesce(n.ultima_msg_cliente_em > coalesce(n.ultima_msg_loja_em, '-infinity'::timestamptz), false) as sem_resposta
      from public.kommo_negocios n
      left join public.fases_da_kommo x on x.funil_id = n.funil_id and x.etapa_id = n.etapa_id
      left join public.kommo_mapa m on m.usuario_id = n.responsavel_id
     where not n.apagado
       and (p_loja is null or m.location_id = p_loja)
       and (p_pessoa is null or m.profile_id = p_pessoa)
       and (p_funil is null or n.funil_id = p_funil)
  ),
  filtrado as (
    select * from base
     where p_origem is null or origem = p_origem
  ),
  abertos as (
    select * from filtrado
     where aberto and coalesce(fase, '') not in ('ganho', 'perdido', 'pos_venda')
  )
  select jsonb_build_object(
    'lido_em', (select ultima_leitura_em from public.kommo_estado where id = 1),
    'dias', greatest(1, least(coalesce(p_dias, 30), 365)),
    'fases', coalesce((
      select jsonb_agg(jsonb_build_object(
        'fase', a.fase, 'abertos', a.abertos, 'valor', a.valor, 'parado_dias', a.parado_dias,
        'parados_7d', a.parados_7d, 'sem_resposta', a.sem_resposta))
      from (
        select fase, count(*) as abertos, coalesce(sum(valor), 0) as valor,
               round(coalesce(percentile_cont(0.5) within group (order by extract(epoch from now() - etapa_desde) / 86400), 0)::numeric, 1) as parado_dias,
               count(*) filter (where etapa_desde < now() - interval '7 days') as parados_7d,
               count(*) filter (where sem_resposta) as sem_resposta
          from abertos group by fase
      ) a
    ), '[]'::jsonb),
    'etapas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'funil_id', a.funil_id, 'funil', f.nome, 'etapa_id', a.etapa_id, 'etapa', e.nome,
        'fase', a.fase, 'origem_fase', a.origem_fase, 'abertos', a.abertos, 'valor', a.valor, 'parado_dias', a.parado_dias)
        order by a.abertos desc)
      from (
        select funil_id, etapa_id, fase, origem_fase, count(*) as abertos, coalesce(sum(valor), 0) as valor,
               round(coalesce(percentile_cont(0.5) within group (order by extract(epoch from now() - etapa_desde) / 86400), 0)::numeric, 1) as parado_dias
          from abertos group by funil_id, etapa_id, fase, origem_fase
      ) a
      left join public.kommo_funis f on f.id = a.funil_id
      left join public.kommo_etapas e on e.funil_id = a.funil_id and e.id = a.etapa_id
    ), '[]'::jsonb),
    'periodo', (
      select jsonb_build_object(
        'ganhos', count(*) filter (where fase = 'ganho' and fechado_em >= v_desde),
        'perdidos', count(*) filter (where fase = 'perdido' and fechado_em >= v_desde),
        'valor_ganho', coalesce(sum(valor) filter (where fase = 'ganho' and fechado_em >= v_desde), 0),
        'valor_perdido', coalesce(sum(valor) filter (where fase = 'perdido' and fechado_em >= v_desde), 0),
        'criados', count(*) filter (where criado_em >= v_desde)
      ) from filtrado
    ),
    'primeira_resposta', (
      select jsonb_build_object(
        'com_resposta', count(r.min_resposta),
        'sem_resposta', count(*) - count(r.min_resposta),
        'mediana_min', round(percentile_cont(0.5) within group (order by r.min_resposta)::numeric, 0)
      )
      from filtrado b
      cross join lateral (
        select extract(epoch from min(ev.criado_em) - b.criado_em) / 60 as min_resposta
          from public.kommo_eventos ev
         where ev.entidade = 'lead' and ev.entidade_id = b.id and ev.tipo = 'outgoing_chat_message'
           and ev.criado_em >= b.criado_em
      ) r
      where b.criado_em >= v_desde and coalesce(b.fase, '') <> 'pos_venda'
    ),
    'motivos', coalesce((
      select jsonb_agg(jsonb_build_object('motivo', a.motivo, 'perdidos', a.perdidos, 'valor', a.valor) order by a.perdidos desc)
      from (
        select coalesce(mp.nome, case when b.motivo_perda_id is null then 'Sem motivo marcado' else 'Motivo ' || b.motivo_perda_id end) as motivo,
               count(*) as perdidos, coalesce(sum(b.valor), 0) as valor
          from filtrado b
          left join public.kommo_motivos_perda mp on mp.id = b.motivo_perda_id
         where b.fase = 'perdido' and b.fechado_em >= v_desde
         group by 1
      ) a
    ), '[]'::jsonb),
    'lista', coalesce((
      select jsonb_agg(l.j order by l.ordem desc)
      from (
        select jsonb_build_object(
                 'id', b.id, 'nome', b.nome, 'valor', b.valor, 'funil', f.nome, 'etapa', e.nome, 'fase', b.fase,
                 'responsavel', u.nome, 'pessoa', p.full_name, 'loja', lo.name, 'origem', b.origem,
                 'etapa_desde', b.etapa_desde, 'ultima_msg_cliente_em', b.ultima_msg_cliente_em,
                 'ultima_msg_loja_em', b.ultima_msg_loja_em, 'sem_resposta', b.sem_resposta,
                 'link', 'https://kathleengfz.kommo.com/leads/detail/' || b.id) as j,
               case when p_alerta = 'sem_resposta' then extract(epoch from now() - b.ultima_msg_cliente_em)
                    else extract(epoch from now() - b.etapa_desde) end as ordem
          from (
            select * from filtrado where aberto
               and case p_alerta
                     when 'esperando' then fase = 'esperando_vendedor' and etapa_desde < now() - v_atencao
                     when 'sem_resposta' then sem_resposta and ultima_msg_cliente_em < now() - v_atencao
                       and coalesce(fase, '') not in ('ganho', 'perdido', 'pos_venda')
                     when 'sem_fase' then fase is null
                     else coalesce(fase, '') not in ('ganho', 'perdido', 'pos_venda')
                   end
          ) b
          left join public.kommo_funis f on f.id = b.funil_id
          left join public.kommo_etapas e on e.funil_id = b.funil_id and e.id = b.etapa_id
          left join public.kommo_usuarios u on u.id = b.responsavel_id
          left join public.profiles p on p.id = b.profile_id
          left join public.locations lo on lo.id = b.location_id
         order by ordem desc nulls last
         limit 60
      ) l
    ), '[]'::jsonb),
    'opcoes', jsonb_build_object(
      'lojas', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'nome', l.name) order by l.name)
                         from public.locations l where exists (select 1 from public.kommo_mapa m where m.location_id = l.id)), '[]'::jsonb),
      'pessoas', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'nome', coalesce(p.full_name, 'Sem nome')) order by p.full_name)
                           from public.profiles p where exists (select 1 from public.kommo_mapa m where m.profile_id = p.id)), '[]'::jsonb),
      'funis', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'nome', f.nome) order by f.principal desc, f.ordem)
                         from public.kommo_funis f where not f.arquivado), '[]'::jsonb),
      'origens', coalesce((select jsonb_agg(o.origem order by o.n desc)
                           from (select origem, count(*) as n from base where aberto or criado_em >= v_desde group by origem order by count(*) desc limit 40) o), '[]'::jsonb)
    ),
    'sem_mapa', (select count(*) from abertos where profile_id is null and location_id is null)
  ) into v;
  return v;
end $function$;

-- kommo_origem_do_negocio é chamada uma vez por negócio (32 mil) no funil. Com
-- `set search_path`, o Postgres não consegue embutir a função na consulta e paga
-- uma chamada por linha (200 ms; embutida, 11 ms). Sem o `set`, cada nome vai
-- qualificado por `pg_catalog`, então o caminho de busca de quem chama não muda
-- nada: a função não é security definer e só usa funções do próprio Postgres.
create or replace function public.kommo_origem_do_negocio(p_meta_ad text, p_meta_adset text, p_meta_campaign text, p_gclid text, p_origem text, p_utm_source text)
 returns text
 language sql
 immutable
as $function$
  select case
    when coalesce(p_meta_ad, p_meta_adset, p_meta_campaign) is not null then 'Anúncio do Meta'
    when nullif(p_gclid, '') is not null then 'Anúncio do Google'
    when nullif(pg_catalog.btrim(p_origem), '') is not null then pg_catalog.btrim(p_origem)
    when nullif(pg_catalog.btrim(p_utm_source), '') is not null then 'UTM: ' operator(pg_catalog.||) pg_catalog.lower(pg_catalog.btrim(p_utm_source))
    else 'Sem origem'
  end;
$function$;
