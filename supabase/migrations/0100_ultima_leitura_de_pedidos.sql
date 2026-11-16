-- Quando os pedidos da loja foram lidos pela última vez, por qualquer das portas.
--
-- POR QUE
--
-- Até 16/11/2026 o pedido só entrava pela exportação do painel da Tray, e a
-- tela de vendas e a Visão geral diziam "a última leitura foi há tanto tempo"
-- olhando o registro dela em `sync_logs`. Com a loja da JK autorizada, o pedido
-- passa a entrar pela API, de dez em dez minutos, e a exportação fica só para
-- trazer a origem. Olhando só a exportação, o aviso de atraso dispararia com os
-- pedidos em dia.
--
-- A leitura pela API não deixa linha em `sync_logs` quando não há pedido novo
-- (de propósito, senão seriam 144 linhas vazias por dia). O que diz que ela
-- rodou é o pulso em `rotinas_pulso`, e essa tabela só abre para administrador.
-- Quem tem a área de vendas e não é administrador (o gerente) precisa da mesma
-- resposta, então a conta mora aqui, com a conferência da área por dentro.
--
-- O QUE DEVOLVE
--
--   quando  a última leitura BOA, a mais recente entre as duas portas
--   fonte   de qual porta ela veio: 'api' ou 'exportacao'
--   erro    o motivo da última tentativa, quando ela falhou. Olha a API se ela
--           já tem pulso, senão a exportação.
--
-- Uma rodada ruim no meio de várias boas não atrasa número nenhum: por isso
-- `quando` é da última boa, e quem decide se há aviso é a idade dela.
-- Sem a área de vendas, devolve nulo.

create or replace function public.ultima_leitura_de_pedidos()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with api as (
    select p.ultima_boa_em, p.ok, p.detalhe
    from public.rotinas_pulso p
    where p.rotina = 'pedidos-api'
  ),
  exportacao as (
    select
      (select max(s.finished_at)
         from public.sync_logs s
        where s.source = 'tray_pedidos' and s.status = 'success') as boa,
      (select case when s.status = 'success' then null else coalesce(s.error, 'sem detalhe') end
         from public.sync_logs s
        where s.source = 'tray_pedidos' and s.finished_at is not null
        order by s.finished_at desc
        limit 1) as ultimo_erro
  )
  select case
    when not coalesce((select public.tem_acesso('vendas')), false) then null
    else (
      select jsonb_build_object(
        'quando', greatest((select a.ultima_boa_em from api a), e.boa),
        'fonte', case
                   when (select a.ultima_boa_em from api a) is not null
                    and (e.boa is null or (select a.ultima_boa_em from api a) >= e.boa)
                   then 'api' else 'exportacao'
                 end,
        'erro', case
                  when exists (select 1 from api)
                  then (select case when a.ok then null else coalesce(a.detalhe, 'sem detalhe') end from api a)
                  else e.ultimo_erro
                end
      )
      from exportacao e
    )
  end;
$$;

comment on function public.ultima_leitura_de_pedidos() is
  'A última leitura boa dos pedidos da Tray, pela API ou pela exportação, e o erro da última tentativa. Só para quem tem a área de vendas.';

revoke execute on function public.ultima_leitura_de_pedidos() from public, anon;
grant execute on function public.ultima_leitura_de_pedidos() to authenticated, service_role;
