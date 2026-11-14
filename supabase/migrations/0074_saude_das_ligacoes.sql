-- 0074: saúde das ligações.
--
-- De onde veio: em 14/11/2026, medindo o banco para a revisão geral, apareceu
-- que o RD Station recusava a chave do portal desde 11/11 (erro 401). Foram 31
-- contatos sem entrar lá em três dias, e ninguém viu. Dois motivos:
--
-- 1. O relógio do banco (`pg_cron`) dispara a rota e não olha a resposta. Rota
--    que responde 401 ou 500, ou que nem roda, não deixa rastro nenhum.
-- 2. Só a leitura de pedidos tinha aviso de atraso. O reenvio de contatos e a
--    publicação agendada nem registravam que tinham rodado.
--
-- `rotinas_pulso` guarda UMA linha por rotina: quando rodou pela última vez e
-- quando rodou bem pela última vez. É a rota que grava, ao terminar. Rotina
-- parada é rotina sem pulso recente, seja qual for o motivo: o painel não
-- precisa adivinhar se foi segredo errado, erro de código ou relógio desligado.
--
-- `saude_das_ligacoes()` junta o pulso, as leituras de `sync_logs` e o estado
-- de cada destino dos contatos (RD, Kommo, Meta, webhook) numa resposta só,
-- para a tela de saúde e para os avisos da Visão geral.

create table public.rotinas_pulso (
  rotina        text primary key check (char_length(rotina) <= 60),
  ultima_em     timestamptz not null default now(),
  ok            boolean not null,
  detalhe       text check (char_length(detalhe) <= 300),
  ultima_boa_em timestamptz
);

comment on table public.rotinas_pulso is
  'Uma linha por rotina agendada: a última vez que rodou e a última vez que rodou bem. Quem grava é a própria rota, com a chave de serviço.';

alter table public.rotinas_pulso enable row level security;

-- Leitura para administrador, dono e GM. Escrita, só a chave de serviço.
create policy rotinas_pulso_select on public.rotinas_pulso
  for select to authenticated using ((select public.is_admin()));

revoke all on public.rotinas_pulso from anon;

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
    'contatos', (select count(*) from public.leads where criado_em > now() - interval '90 days')
  ) end
$$;

revoke execute on function public.saude_das_ligacoes() from public, anon;
grant execute on function public.saude_das_ligacoes() to authenticated;
