-- A leitura dos detalhes do catálogo entra no relógio, de dez em dez minutos.
--
-- POR QUE
--
-- O arquivo do catálogo do Meta e do Google (rotas /api/catalogo/meta.xml e
-- /api/catalogo/google.xml) junta o preço e a disponibilidade do espelho com
-- as fotos, a descrição, a referência, o GTIN, o peso e as medidas que só a
-- API da Tray entrega (0130). A rota /api/cron/catalogo-detalhes lê esses
-- detalhes um produto por chamada, no máximo 40 por rodada, e só o que pode ter
-- mudado (produto novo, foto principal trocada, ou leitura com mais de três
-- dias). Em regime são umas 400 chamadas por dia, dentro do limite de 10 mil
-- da loja, que a leitura de pedidos divide.
--
-- COMO
--
-- O mesmo desenho das outras rotinas (0060, 0101): o `pg_cron` chama a rota
-- pelo `pg_net`, com o endereço de `site_settings.cron` e o segredo de
-- `integration_tokens` (provider `cron`). Sem endereço ou sem segredo, a
-- função não faz nada.
--
-- Roda nos minutos 8, 18, 28, 38, 48 e 58: longe do minuto 3, que é o da
-- leitura de pedidos, para as duas nunca dividirem o mesmo minuto do limite de
-- 180 chamadas da Tray. A rota deixa pulso em `rotinas_pulso`
-- (`catalogo-detalhes`), que é o que a tela de Saúde olha.
--
-- Aplicada em 17/11/2026, antes do merge do código: até a rota existir em
-- produção, cada chamada recebe 404 e nada acontece.

create or replace function public.disparar_leitura_dos_detalhes_do_catalogo()
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
    url     := rtrim(v_url, '/') || '/api/cron/catalogo-detalhes',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_segredo),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end $$;

revoke execute on function public.disparar_leitura_dos_detalhes_do_catalogo() from public, anon, authenticated;

select cron.schedule(
  'ler-detalhes-do-catalogo',
  '8-59/10 * * * *',
  $$select public.disparar_leitura_dos_detalhes_do_catalogo();$$
);
