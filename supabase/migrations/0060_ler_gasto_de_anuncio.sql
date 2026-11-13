-- Leitura do gasto de anúncio pela API das plataformas, de hora em hora.
--
-- POR QUE
--
-- O gasto do Meta e do Google Ads entrava em `anuncios_gasto` (0059) à mão. A
-- rota /api/cron/gasto-de-anuncio busca o gasto direto nas duas plataformas e
-- regrava os últimos sete dias, porque elas corrigem o gasto dos dias recentes.
--
-- COMO
--
-- O mesmo desenho das outras rotinas: o `pg_cron` chama a rota pelo `pg_net`,
-- com o endereço de `site_settings.cron` e o segredo de `integration_tokens`
-- (provider `cron`). Sem endereço ou sem segredo, a função não faz nada.
--
-- Roda no minuto 20 de toda hora. Plataforma que ainda não tem acesso só deixa
-- o motivo em `sync_logs`, que é de onde a tela de tráfego lê o que falta.

create or replace function public.disparar_leitura_do_gasto()
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
    url     := rtrim(v_url, '/') || '/api/cron/gasto-de-anuncio',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_segredo),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end $$;

revoke execute on function public.disparar_leitura_do_gasto() from public, anon, authenticated;

select cron.schedule(
  'ler-gasto-de-anuncio',
  '20 * * * *',
  $$select public.disparar_leitura_do_gasto();$$
);
