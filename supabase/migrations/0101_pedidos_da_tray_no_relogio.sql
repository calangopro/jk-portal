-- A leitura de pedidos pela API da Tray entra no relógio, de dez em dez minutos.
--
-- POR QUE
--
-- A Tray homologou o aplicativo em 16/11/2026 e a loja da JK foi autorizada no
-- mesmo dia. A rota /api/cron/pedidos-da-tray existia desde 13/11 e ficou fora
-- do relógio de propósito, até uma conferência mostrar que a API e a exportação
-- escrevem o pedido do mesmo jeito. A conferência foi feita (60 pedidos, campo
-- por campo), as três diferenças de escrita foram igualadas no código, e só
-- então esta migration foi aplicada. O passo a passo está em
-- docs/tray-api-de-pedidos.md.
--
-- Até aqui o pedido só entrava pela exportação do painel da loja, que roda no
-- Mac do Filipe, pelo Chrome, e para quando o Mac desliga ou a Tray desloga
-- (foi o que aconteceu de 15 a 16/11: dois dias sem pedido novo no painel).
--
-- COMO
--
-- O mesmo desenho das outras rotinas (0060): o `pg_cron` chama a rota pelo
-- `pg_net`, com o endereço de `site_settings.cron` e o segredo de
-- `integration_tokens` (provider `cron`). Sem endereço ou sem segredo, a função
-- não faz nada.
--
-- Roda nos minutos 3, 13, 23, 33, 43 e 53, para não cair junto das rotinas que
-- rodam em minuto redondo. Corpo vazio é o modo que grava. A rota deixa pulso
-- em `rotinas_pulso` (`pedidos-api`), que é o que a tela de saúde olha: esta
-- rotina roda por relógio, sempre, então é julgada pelo tempo.

create or replace function public.disparar_leitura_de_pedidos()
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
    url     := rtrim(v_url, '/') || '/api/cron/pedidos-da-tray',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_segredo),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end $$;

revoke execute on function public.disparar_leitura_de_pedidos() from public, anon, authenticated;

select cron.schedule(
  'ler-pedidos-da-tray',
  '3-59/10 * * * *',
  $$select public.disparar_leitura_de_pedidos();$$
);
