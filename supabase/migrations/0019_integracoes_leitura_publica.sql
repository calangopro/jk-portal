-- GA4 e GTM nunca chegavam ao HTML público.
--
-- `obterConfigPublica()` (src/lib/data/integracoes.ts) lê a tabela com o
-- cliente anônimo, mas `integrations` só tinha a policy `integrations_staff_all`,
-- que é `to authenticated using (is_staff())`. Para o visitante anônimo não
-- existia policy nenhuma, e RLS sem policy nega tudo. A leitura voltava vazia
-- sempre, então a medição do site inteiro estava desligada em silêncio, sem
-- erro em lugar nenhum.
--
-- A liberação aqui é a mais estreita que resolve: apenas os dois provedores de
-- medição, apenas quando já marcados como conectados. O id de medição do GA4 e
-- o do contêiner do GTM são públicos por natureza, aparecem no HTML de qualquer
-- visitante e são exatamente o que o script precisa.
--
-- Não vaza segredo: `salvarIntegracao` monta o `config` de gtm e ga4 do zero,
-- com uma única chave cada (`container_id` e `measurement_id`), validada por
-- regex. Provedor que guarda credencial (gsc, gmb, tray, resend) continua
-- fechado, e `integration_tokens` segue sem policy nenhuma, exclusivo da
-- service_role.

create policy integrations_medicao_publica on public.integrations
  for select to anon, authenticated
  using (provider in ('ga4', 'gtm') and status = 'connected');
