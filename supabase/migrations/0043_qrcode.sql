-- Leituras do QR code impresso: jkaliancas.com.br/qrcode.
--
-- POR QUE
--
-- Os adesivos dos banheiros do Shopping Tamboré (18 espelhos e 18 portas, em
-- outubro de 2026) levam um QR só, com `https://www.jkaliancas.com.br/qrcode`.
-- O endereço é fixo e o destino mora no painel (`site_settings`, chave
-- `pagina:qrcode`): o número do WhatsApp muda, troca no painel, e nenhum
-- adesivo precisa ser reimpresso.
--
-- O destino é o WhatsApp, então o GA4 não enxerga essa visita: a pessoa sai
-- antes de qualquer página carregar. Quem conta é o próprio redirecionamento,
-- uma linha por leitura, gravada pelo servidor.
--
-- COMO
--
-- `origem` sai de `?o=` e fica vazia nos adesivos de hoje. Existe para um
-- impresso futuro poder ser separado com o mesmo endereço (`/qrcode?o=vitrine`).
-- `aparelho` é lido do navegador e guardado já resumido. IP e navegador
-- inteiro não ficam: aqui não há pessoa para casar com nada, só contagem.

create table public.qrcode_leituras (
  id        bigint generated always as identity primary key,
  lido_em   timestamptz not null default now(),
  origem    text not null default '' check (origem ~ '^[a-z0-9-]{0,40}$'),
  aparelho  text not null check (aparelho in ('iphone', 'android', 'outro')),
  -- O endereço para onde a pessoa foi naquela hora. Quando o número muda, dá
  -- para saber quantas leituras foram para cada um.
  destino   text not null check (char_length(destino) <= 600)
);

create index qrcode_leituras_lido_em_idx on public.qrcode_leituras (lido_em desc);

alter table public.qrcode_leituras enable row level security;

-- Leitura para a equipe, no painel. Escrita nenhuma por policy: só o servidor
-- grava, com a service_role.
create policy qrcode_leituras_staff_select on public.qrcode_leituras
  for select to authenticated using (public.is_staff());

comment on table public.qrcode_leituras is
  'Uma linha por leitura do QR impresso (/qrcode). Escrita só pela service_role.';

-- Contagem por dia no fuso de São Paulo, que é o dia de quem leu o adesivo.
-- O PostgREST entrega no máximo 1.000 linhas por pedido, então somar no banco
-- é o que deixa o painel certo depois de um mês movimentado.
-- `security_invoker` faz a view obedecer à RLS da tabela: fora da equipe, vazia.
create view public.qrcode_leituras_por_dia
with (security_invoker = true) as
select
  (lido_em at time zone 'America/Sao_Paulo')::date as dia,
  origem,
  aparelho,
  count(*)::int as leituras
from public.qrcode_leituras
group by 1, 2, 3;

comment on view public.qrcode_leituras_por_dia is
  'Leituras do QR por dia (fuso de São Paulo), origem e aparelho.';
