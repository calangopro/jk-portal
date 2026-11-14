-- 0078: a saúde das rotinas que só rodam quando há o que fazer.
--
-- A 0074 julgava toda rotina pelo tempo desde a última rodada boa. Duas delas
-- não rodam por relógio: o reenvio de contatos e a publicação agendada só
-- chamam a rota quando existe contato pendente ou conteúdo vencido (as funções
-- `disparar_reenvio_de_leads` e `disparar_publicacao_agendada` voltam antes).
-- Fila vazia por seis horas apareceria como "rotina parada", e alarme falso na
-- Visão geral ensina a ignorar o alarme.
--
-- A função passa a dizer o que está ESPERANDO: contato pendente há mais de 40
-- minutos e conteúdo agendado vencido há mais de 20. Com isso a regra vira:
-- essas duas só estão paradas quando há fila e não há rodada boa recente.

create or replace function public.saude_das_ligacoes()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when not public.is_admin() then null else jsonb_build_object(
    'agora', now(),
    'rotinas', (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from public.rotinas_pulso r),
    'leituras', (
      select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select jsonb_build_object(
          'fonte', s.source,
          'ultima_em', max(s.created_at),
          'ultima_boa_em', max(s.created_at) filter (where s.status = 'success'),
          'ultimo_status', (array_agg(s.status order by s.created_at desc))[1],
          'ultimo_erro', (array_agg(left(s.error, 200) order by s.created_at desc) filter (where s.status <> 'success'))[1]
        ) as x
        from public.sync_logs s
        where s.created_at > now() - interval '30 days'
        group by s.source
      ) t
    ),
    -- O estado de cada destino é o do ÚLTIMO envio de cada contato: contato que
    -- falhou e depois entrou conta como entregue.
    'destinos', (
      select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select jsonb_build_object(
          'destino', d.key,
          'ok', count(*) filter (where d.value->>'status' = 'ok'),
          'erro', count(*) filter (where d.value->>'status' = 'erro'),
          'sem_chave', count(*) filter (where d.value->>'status' = 'sem_chave'),
          'ignorado', count(*) filter (where d.value->>'status' = 'ignorado'),
          'ultimo_ok_em', max(l.criado_em) filter (where d.value->>'status' = 'ok'),
          'erro_desde', min(l.criado_em) filter (where d.value->>'status' = 'erro'),
          'ultimo_erro', (array_agg(left(d.value->>'erro', 160) order by l.criado_em desc) filter (where d.value->>'status' = 'erro'))[1],
          -- Gastou as tentativas e saiu da fila de reenvio: só volta pelo botão de Integrações.
          'fora_da_fila', count(*) filter (where d.value->>'status' = 'erro' and not l.envio_pendente)
        ) as x
        from public.leads l, jsonb_each(l.envios) d
        where l.criado_em > now() - interval '90 days'
        group by d.key
      ) t
    ),
    'contatos', (select count(*) from public.leads where criado_em > now() - interval '90 days'),
    -- O que está esperando por uma rotina que só roda quando há o que fazer.
    'pendencias', jsonb_build_object(
      'leads_esperando', (select count(*) from public.leads where envio_pendente and criado_em < now() - interval '40 minutes'),
      'agendados_vencidos', (
        select count(*) from public.contents
        where scheduled_at is not null and scheduled_at < now() - interval '20 minutes' and status in ('draft', 'in_review')
      )
    )
  ) end
$$;
