-- Importação automática do Search Console, toda segunda de manhã.
--
-- Mesmo desenho da publicação agendada (0027): o `pg_cron` acorda, lê a URL
-- do portal em `site_settings.cron` e o segredo em `integration_tokens`, e
-- chama a rota do portal com o cabeçalho `x-cron-secret`. Quem fala com o
-- Google é o portal, com a conta de serviço guardada na Vercel
-- (`GSC_SERVICE_ACCOUNT_JSON`). O banco nunca vê essa chave.
--
-- Semanal, e não diária: cada importação grava os últimos 28 dias inteiros
-- (até 8 mil linhas), e uma por dia multiplicaria a tabela por sete sem mudar
-- nenhuma decisão de pauta. Quem quiser o número de hoje usa o botão
-- "Importar agora" da tela de Métricas.

create or replace function public.disparar_importacao_search_console()
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
    url     := rtrim(v_url, '/') || '/api/cron/search-console',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_segredo),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end $$;

revoke execute on function public.disparar_importacao_search_console() from public, anon, authenticated;

-- Segunda-feira, 09h15 UTC, que é 06h15 em Brasília: antes de a equipe abrir o
-- painel na semana.
select cron.schedule(
  'importar-search-console',
  '15 9 * * 1',
  $$select public.disparar_importacao_search_console()$$
);
