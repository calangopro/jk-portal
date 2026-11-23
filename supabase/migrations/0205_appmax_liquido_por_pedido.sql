-- Appmax pela API: o que foi descontado de cada venda (cartão 78).
--
-- Cada pedido pago pela Appmax tem um número dela, que a Tray guarda no pedido
-- (`Payment[].unique_number`, "AM-133444274"). Esta tabela liga os dois e guarda
-- o que a Appmax descontou, lido de `GET /v1/orders/total-liquid/{id}` (a tela
-- "Ver taxas"): taxa de processamento, gateway e antifraude, parcelamento e o
-- líquido. A conta é dela, nunca estimada aqui.
--
-- Só a chave de serviço grava e lê (RLS ligada, sem policy): o líquido por
-- venda é dado da empresa. A tela lê pelo resumo, que confere `is_admin()`.
--
-- Pedido mais velho que a primeira leitura entra pelo vínculo e pela leitura
-- da rotina (`/api/cron/appmax`), que também aceita `{"vincular": dias}`.

create table public.appmax_pedidos (
  pedido             bigint primary key,
  appmax_id          bigint not null,
  meio               text,
  parcelas           integer check (parcelas is null or parcelas between 1 and 24),
  total_pedido       numeric(12, 2),
  liquido            numeric(12, 2),
  descontado         numeric(12, 2),
  taxa_processamento numeric(12, 2),
  taxa_gateway       numeric(12, 2),
  taxa_parcelamento  numeric(12, 2),
  outras_taxas       numeric(12, 2),
  taxas              jsonb,
  vinculado_em       timestamptz not null default now(),
  lido_em            timestamptz,
  tentativas         integer not null default 0,
  ultimo_erro        text
);
create unique index appmax_pedidos_appmax_id_idx on public.appmax_pedidos (appmax_id);
create index appmax_pedidos_sem_leitura_idx on public.appmax_pedidos (pedido) where lido_em is null;

alter table public.appmax_pedidos enable row level security;

-- Os pedidos pagos que ainda esperam a leitura do líquido, os mais novos primeiro.
-- Só a chave de serviço chama. Cinco tentativas e para: pedido que a Appmax não
-- reconhece não deve ser perguntado para sempre.
create or replace function public.appmax_pendentes(p_limite integer default 40)
returns table (pedido bigint, appmax_id bigint)
language sql
stable
security definer
set search_path to ''
as $$
  select a.pedido, a.appmax_id
  from public.appmax_pedidos a
  join public.tray_pedidos t on t.pedido = a.pedido
  where a.lido_em is null
    and a.tentativas < 5
    and t.situacao = 'pago'
  order by t.feito_em desc
  limit greatest(1, least(coalesce(p_limite, 40), 200));
$$;

revoke execute on function public.appmax_pendentes(integer) from public, anon, authenticated;
grant execute on function public.appmax_pendentes(integer) to service_role;

-- O resumo para a tela: o que a Appmax descontou de verdade nos pedidos pagos do
-- período, por meio de pagamento, e quantos pedidos pagos ainda estão sem leitura.
create or replace function public.appmax_resumo(p_de date, p_ate date)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v jsonb;
begin
  if not coalesce(public.is_admin(), false) then
    return jsonb_build_object('erro', 'sem_acesso');
  end if;

  select jsonb_build_object(
    'pagos_no_periodo', (select count(*) from public.tray_pedidos t
                         where t.situacao = 'pago' and t.dia between p_de and p_ate),
    'pagos_na_appmax',  (select count(*) from public.tray_pedidos t
                         join public.appmax_pedidos a on a.pedido = t.pedido
                         where t.situacao = 'pago' and t.dia between p_de and p_ate),
    'lidos', (select count(*) from public.tray_pedidos t
              join public.appmax_pedidos a on a.pedido = t.pedido
              where t.situacao = 'pago' and t.dia between p_de and p_ate and a.lido_em is not null),
    'por_meio', coalesce((
      select jsonb_agg(jsonb_build_object(
        'meio', coalesce(x.meio, 'outro'),
        'pedidos', x.n,
        'total', x.total,
        'descontado', x.descontado,
        'processamento', x.processamento,
        'gateway', x.gateway,
        'parcelamento', x.parcelamento,
        'parcelas_medias', x.parcelas
      ) order by x.total desc)
      from (
        select a.meio,
               count(*) n,
               sum(a.total_pedido) total,
               sum(a.descontado) descontado,
               sum(a.taxa_processamento) processamento,
               sum(a.taxa_gateway) gateway,
               sum(a.taxa_parcelamento) parcelamento,
               round(avg(a.parcelas)::numeric, 1) parcelas
        from public.tray_pedidos t
        join public.appmax_pedidos a on a.pedido = t.pedido
        where t.situacao = 'pago' and t.dia between p_de and p_ate and a.lido_em is not null
        group by a.meio
      ) x
    ), '[]'::jsonb),
    'ultima_leitura', (select max(lido_em) from public.appmax_pedidos),
    'com_erro', (select count(*) from public.appmax_pedidos where lido_em is null and tentativas >= 5)
  ) into v;

  return v;
end $$;

revoke execute on function public.appmax_resumo(date, date) from public, anon;
grant execute on function public.appmax_resumo(date, date) to authenticated;

-- O relógio: de dez em dez minutos, cinco minutos depois da leitura de pedidos
-- da Tray (0101, minutos 3, 13, 23...), para o vínculo do pedido novo já existir.
-- Sem chave da Appmax a rota só deixa o pulso e volta.
create or replace function public.disparar_leitura_da_appmax()
returns void
language plpgsql
security definer
set search_path to 'public', 'extensions', 'net'
as $$
declare
  v_url     text;
  v_segredo text;
begin
  select value->>'url' into v_url from public.site_settings where key = 'cron';
  select access_token into v_segredo from public.integration_tokens where provider = 'cron';

  if v_url is null or v_url = '' or v_segredo is null then
    return;
  end if;

  perform net.http_post(
    url     := rtrim(v_url, '/') || '/api/cron/appmax',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_segredo),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end $$;

revoke execute on function public.disparar_leitura_da_appmax() from public, anon, authenticated;

select cron.schedule(
  'ler-liquido-da-appmax',
  '8-59/10 * * * *',
  $$select public.disparar_leitura_da_appmax();$$
);

notify pgrst, 'reload schema';
