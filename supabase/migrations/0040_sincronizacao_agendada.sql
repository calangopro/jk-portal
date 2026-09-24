-- Sincronização com a Tray de quinze em quinze minutos.
--
-- POR QUE
--
-- Não existia relógio nenhum. O preço no portal só mudava quando alguém
-- apertava "Sincronizar agora" no admin, e o webhook da Tray nunca foi
-- cadastrado no painel da loja. Uma mudança de preço feita de manhã ficava
-- errada no portal por semanas, que é exatamente o que o projeto proíbe:
-- anunciar preço que a loja não pratica.
--
-- COMO
--
-- Mesmo desenho da publicação agendada (0027) e do Search Console (0038): o
-- `pg_cron` lê a URL em `site_settings.cron` e o segredo em
-- `integration_tokens`, e chama `/api/cron/sincronizar-tray`. Quem fala com a
-- Tray e refaz as páginas é o portal.
--
-- A grade de quinze minutos passa por 03h00 UTC, que é meia-noite em São
-- Paulo. A primeira rodada do dia refaz as páginas mesmo sem nada mudar na
-- loja, e é ela que tira do ar a promoção que acabou no dia anterior.
--
-- ORDEM
--
-- Aplicar DEPOIS do deploy que cria a rota. Antes disso o relógio bate num 404
-- a cada quinze minutos, sem estrago, mas sem fazer nada.

create or replace function public.disparar_sincronizacao_tray()
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
    url     := rtrim(v_url, '/') || '/api/cron/sincronizar-tray',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_segredo),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end $$;

revoke execute on function public.disparar_sincronizacao_tray() from public, anon, authenticated;

select cron.schedule(
  'sincronizar-tray',
  '*/15 * * * *',
  $$select public.disparar_sincronizacao_tray()$$
);
