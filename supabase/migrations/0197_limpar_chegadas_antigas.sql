-- Chegadas ao site guardadas por 13 meses, nunca mais (cartão 70, 20/11/2026).
--
-- A política de privacidade de 20/11/2026 promete guardar o registro de
-- chegadas ao site por 13 meses (o mesmo padrão do Google Analytics). Até aqui
-- nada apagava `origem_toques` (cada chegada: visitante, etiquetas, página de
-- entrada, aparelho, sessão da Tray) nem `origem_pedidos` (o número do pedido
-- visto na página de confirmação, ligado ao visitante).
--
-- Nenhuma conta olha tão longe: a origem do pedido procura a chegada até 30
-- dias antes dele (`origem_resolvida`), o clique em anúncio até 7 dias, e a
-- bio herda o anúncio de até 7 dias antes. O que se perde é só a origem de
-- pedido com mais de 13 meses, que a tela de origem não mostra em período
-- nenhum (o mais longo é "desde maio").
--
-- O mesmo desenho de `limpar_meta_sinais` (0120): função que só a chave de
-- serviço chama e um relógio por dia, às 4h45 (UTC), entre as outras limpezas.

create or replace function public.limpar_chegadas_antigas()
returns integer
language sql
security definer
set search_path to ''
as $$
  with toques as (
    delete from public.origem_toques where em < now() - interval '13 months' returning 1
  ),
  pedidos as (
    delete from public.origem_pedidos where em < now() - interval '13 months' returning 1
  )
  select ((select count(*) from toques) + (select count(*) from pedidos))::integer;
$$;

revoke execute on function public.limpar_chegadas_antigas() from public, anon, authenticated;

select cron.unschedule('limpar-chegadas-antigas') where exists (select 1 from cron.job where jobname = 'limpar-chegadas-antigas');
select cron.schedule(
  'limpar-chegadas-antigas',
  '45 4 * * *',
  $$select public.limpar_chegadas_antigas();$$
);
