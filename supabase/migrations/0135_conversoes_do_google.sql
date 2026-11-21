-- Conversões do Google Ads pelo painel: retirar o pedido cancelado e mandar a compra paga.
--
-- POR QUE
--
-- No Google Ads a compra é contada pela etiqueta do GTM (ação
-- "Conversão automática tray - Não Remover", código 7575406236), que dispara
-- quando o pedido é CRIADO. De 13/10 a 14/11, 138 de 366 pedidos criados não
-- foram pagos, 64% do valor. As campanhas aprendem com quem faz pedido, não com
-- quem paga. Decisão do Filipe em 17/11/2026: o painel passa a cuidar disso, e
-- tudo liga em 01/12, quando ele assume o tráfego. Até lá fica desligado e em
-- modo de validação. O passo a passo está em docs/google-compra-paga.md.
--
-- São duas peças, e elas vão por APIs diferentes do Google:
--
-- 1. RETIRADA. O pedido que a etiqueta contou e a Tray cancelou recebe um
--    ajuste do tipo retirada (RETRACTION), pelo número do pedido, na ação da
--    etiqueta. Vai pela API do Google Ads (`uploadConversionAdjustments`): a
--    Data Manager API não faz retirada.
-- 2. COMPRA PAGA. O pedido que virou pago, de quem chegou por clique do Google
--    (gclid, gbraid ou wbraid), vira conversão numa ação nova, "Compra paga",
--    com o valor pago. Vai pela Data Manager API (`events:ingest`): desde
--    15/06/2026 o Google só aceita conversão de clique pela API do Google Ads
--    de projeto que já mandava antes disso, e o projeto do painel nasceu em
--    setembro.
--
-- A FILA
--
-- `google_conversoes` tem UMA linha por pedido e por tipo (a chave única é o
-- que impede mandar duas vezes). A linha guarda o que foi mandado, quando, o
-- que o Google respondeu e o erro. Ninguém lê nem grava pela chave anônima;
-- quem tem a área de tráfego lê (é o que a tela de acompanhamento vai mostrar),
-- e quem grava é a rotina, com a chave de serviço.
--
-- Estados:
--   pendente      a mandar, a partir de `proxima_em`
--   enviando      marcada por uma rodada; volta a pendente se ficar presa 15 min
--   validado      mandada em modo de validação (validate_only): o Google leu e
--                 não gravou nada. Volta a ser mandada quando a validação desliga
--   enviado       o Google aceitou (na compra paga, falta a confirmação)
--   confirmado    a Data Manager confirmou que processou
--   nao_contado   retirada de um pedido que o Google não tinha contado
--   fora_do_prazo passou do prazo do Google antes de sair
--   recusado      o Google recusou, ou as tentativas acabaram
--   cancelado     o pedido mudou antes de sair (a retirada de um pedido que
--                 virou pago, por exemplo) e a linha não sai mais
--
-- A TRAVA DO PEDIDO PAGO
--
-- Retirada de pedido pago não existe. A regra mora em três lugares: na conta
-- que escolhe os pedidos (`src/lib/google-ads/conversoes.ts`), na função que
-- separa o lote de cada rodada (`google_conversoes_marcar`, abaixo, que
-- confere o pedido NA HORA e cancela a linha se ele não estiver cancelado ou
-- se tiver qualquer sinal de pagamento) e no teste.
--
-- O INTERRUPTOR
--
-- Mora em `site_settings`, chave `google:conversoes`, e nasce DESLIGADO e em
-- validação. Como a policy de escrita de `site_settings` é de qualquer pessoa
-- da equipe de conteúdo, um gatilho deixa só administrador (e a chave de
-- serviço) mexer em chave que começa com `google:`.
--
-- O RELÓGIO
--
-- `disparar_conversoes_do_google()` existe, mas NÃO está agendada: o
-- `cron.schedule` entra no dia de ligar, como migration própria (o texto está
-- em docs/google-compra-paga.md).

create table public.google_conversoes (
  id            bigint generated always as identity primary key,
  pedido        bigint not null,
  tipo          text not null check (tipo in ('retirada', 'compra_paga')),
  estado        text not null default 'pendente' check (estado in (
                  'pendente', 'enviando', 'validado', 'enviado', 'confirmado',
                  'nao_contado', 'fora_do_prazo', 'recusado', 'cancelado')),
  -- Quando o pedido foi feito: é dele que saem os prazos do Google.
  pedido_em     timestamptz not null,
  -- Compra paga: o momento do pagamento. Retirada: o momento do cancelamento.
  momento       timestamptz not null,
  valor         numeric(12,2),
  moeda         text check (moeda is null or moeda ~ '^[A-Z]{3}$'),
  clique        text check (clique is null or clique in ('gclid', 'gbraid', 'wbraid')),
  clique_id     text check (clique_id is null or char_length(clique_id) <= 300),
  clique_em     timestamptz,
  -- Se o evento foi com e-mail e telefone em SHA-256. Os resumos não ficam aqui.
  com_cliente   boolean not null default false,
  tentativas    integer not null default 0,
  proxima_em    timestamptz not null default now(),
  marcado_em    timestamptz,
  enviado_em    timestamptz,
  validado_em   timestamptz,
  confirmado_em timestamptz,
  -- Data Manager: o número do pedido feito ao Google e a posição do evento nele.
  requisicao    text,
  indice        integer,
  -- O que foi mandado, sem dado de cliente, e o que o Google respondeu.
  corpo         jsonb,
  resposta      jsonb,
  codigo        text,
  erro          text check (erro is null or char_length(erro) <= 600),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (pedido, tipo)
);

comment on table public.google_conversoes is
  'Fila do que o painel manda ao Google Ads: uma linha por pedido e por tipo (retirada do pedido cancelado, compra paga). Quem grava é a rotina /api/cron/google-conversoes, com a chave de serviço.';

create index google_conversoes_a_mandar on public.google_conversoes (tipo, proxima_em)
  where estado in ('pendente', 'enviando', 'validado');
create index google_conversoes_a_confirmar on public.google_conversoes (requisicao)
  where estado = 'enviado' and requisicao is not null;

alter table public.google_conversoes enable row level security;

create policy google_conversoes_select on public.google_conversoes
  for select to authenticated
  using ((select public.tem_acesso('trafego')));

revoke all on public.google_conversoes from anon;
revoke insert, update, delete on public.google_conversoes from authenticated;

-- ---------------------------------------------------------------------------
-- O interruptor, desligado e em validação.

insert into public.site_settings (key, value, is_public)
values (
  'google:conversoes',
  jsonb_build_object(
    'ligado', false,
    'validar', true,
    'retirada', true,
    'compra_paga', true,
    'acao_da_etiqueta', '7575406236',
    'acao_compra_paga', null,
    'retirar_desde', '2026-09-26',
    'compra_paga_desde', '2026-11-13',
    'dados_do_cliente', false,
    'pedidos_sem_clique', false
  ),
  false
)
on conflict (key) do nothing;

-- Só administrador (ou a chave de serviço, ou o editor SQL) mexe em chave `google:`.
-- Sem `security definer`: `current_user` precisa ser o papel de quem chama (ver 0050).
create or replace function public.site_settings_trava_google()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_chave text := coalesce(new.key, old.key);
begin
  if tg_op = 'UPDATE' and old.key like 'google:%' then
    v_chave := old.key;
  end if;
  if v_chave like 'google:%'
     and not coalesce(public.is_admin() or current_user in ('postgres', 'service_role', 'supabase_admin'), false) then
    raise exception 'Só administrador muda as conversões do Google.' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end $$;

create trigger site_settings_trava_google
  before insert or update or delete on public.site_settings
  for each row execute function public.site_settings_trava_google();

-- ---------------------------------------------------------------------------
-- O que a conta precisa saber dos pedidos.
--
-- Uma linha por pedido: os feitos desde `p_retirada_desde` (é de onde saem as
-- retiradas, e o pedido pago entra também, para a conta cancelar a retirada de
-- quem pagou) e os pagos desde `p_compra_desde`, com o clique da chegada que
-- vale para o pedido (`origem_resolvida`, a mesma regra de Tráfego e Vendas).
-- E-mail e telefone só saem com `p_com_cliente`.

create or replace function public.google_conversoes_candidatos(
  p_retirada_desde date,
  p_compra_desde date,
  p_com_cliente boolean default false
)
returns table (
  pedido bigint, feito_em timestamptz, dia date, situacao text, status text,
  status_anterior text, status_mudou_em timestamptz, total numeric, valor_pago numeric,
  pagamento_em date, email text, telefone text,
  clique text, clique_id text, clique_em timestamptz
)
language sql
stable
set search_path = ''
as $$
  with resolvida as (
    select r.pedido, r.visitante, r.clique, r.chegou_em
    from public.origem_resolvida(p_compra_desde, (now() at time zone 'America/Sao_Paulo')::date + 1) r
    where r.situacao = 'pago' and r.clique in ('gclid', 'gbraid', 'wbraid')
  )
  select
    p.pedido, p.feito_em, p.dia, p.situacao, p.status,
    p.status_anterior, p.status_mudou_em, p.total, p.valor_pago,
    p.pagamento_em,
    case when p_com_cliente then p.cliente_email end,
    case when p_com_cliente then p.cliente_telefone end,
    r.clique, t.clique_id, r.chegou_em
  from public.tray_pedidos p
  left join resolvida r on r.pedido = p.pedido
  left join lateral (
    select t.clique_id
    from public.origem_toques t
    where t.visitante = r.visitante and t.em = r.chegou_em and t.clique = r.clique
    limit 1
  ) t on true
  where p.feito_em >= p_retirada_desde::timestamp at time zone 'America/Sao_Paulo'
     or (p.situacao = 'pago' and p.dia >= p_compra_desde)
$$;

revoke execute on function public.google_conversoes_candidatos(date, date, boolean) from public, anon, authenticated;
grant execute on function public.google_conversoes_candidatos(date, date, boolean) to service_role;

-- ---------------------------------------------------------------------------
-- O lote de uma rodada, separado de uma vez (duas rodadas juntas não pegam a
-- mesma linha). Antes de devolver, confere o pedido NA HORA:
--   retirada de pedido que não está cancelado, ou que tem sinal de pagamento,
--   vira `cancelado` e não sai; compra paga de pedido que deixou de ser pago
--   também.
-- `p_validar`: em validação, a linha já validada não volta; fora dela, volta.

create or replace function public.google_conversoes_marcar(p_tipo text, p_limite integer, p_validar boolean)
returns setof public.google_conversoes
language plpgsql
set search_path = ''
as $$
begin
  update public.google_conversoes g
     set estado = 'cancelado',
         erro = case g.tipo
                  when 'retirada' then 'O pedido não está mais cancelado, ou teve pagamento: retirada não sai.'
                  else 'O pedido deixou de estar pago antes de sair.'
                end,
         marcado_em = null,
         atualizado_em = now()
    from public.tray_pedidos p
   where p.pedido = g.pedido
     and g.tipo = p_tipo
     and g.estado in ('pendente', 'enviando', 'validado')
     and case g.tipo
           when 'retirada' then p.situacao <> 'cancelado' or p.pagamento_em is not null or coalesce(p.valor_pago, 0) > 0
           else p.situacao <> 'pago'
         end;

  return query
  update public.google_conversoes g
     set estado = 'enviando', marcado_em = now(), atualizado_em = now()
   where g.id in (
     select x.id
     from public.google_conversoes x
     where x.tipo = p_tipo
       and (
         (x.estado = 'pendente' and x.proxima_em <= now())
         or (x.estado = 'validado' and not p_validar)
         or (x.estado = 'enviando' and x.marcado_em < now() - interval '15 minutes')
       )
     order by x.proxima_em, x.id
     limit greatest(1, least(p_limite, 2000))
     for update skip locked
   )
  returning g.*;
end $$;

revoke execute on function public.google_conversoes_marcar(text, integer, boolean) from public, anon, authenticated;
grant execute on function public.google_conversoes_marcar(text, integer, boolean) to service_role;

-- O resultado de uma rodada, gravado de uma vez. A conta manda o estado
-- inteiro de cada linha; o que não veio fica como estava.
create or replace function public.google_conversoes_gravar(p_linhas jsonb)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_n integer;
begin
  update public.google_conversoes g
     set estado        = x.estado,
         tentativas    = coalesce(x.tentativas, g.tentativas),
         proxima_em    = coalesce(x.proxima_em, g.proxima_em),
         marcado_em    = null,
         enviado_em    = coalesce(x.enviado_em, g.enviado_em),
         validado_em   = coalesce(x.validado_em, g.validado_em),
         confirmado_em = coalesce(x.confirmado_em, g.confirmado_em),
         requisicao    = coalesce(x.requisicao, g.requisicao),
         indice        = coalesce(x.indice, g.indice),
         corpo         = coalesce(x.corpo, g.corpo),
         resposta      = coalesce(x.resposta, g.resposta),
         codigo        = x.codigo,
         erro          = left(x.erro, 600),
         atualizado_em = now()
    from jsonb_to_recordset(p_linhas) as x(
      id bigint, estado text, tentativas integer, proxima_em timestamptz,
      enviado_em timestamptz, validado_em timestamptz, confirmado_em timestamptz,
      requisicao text, indice integer, corpo jsonb, resposta jsonb, codigo text, erro text
    )
   where g.id = x.id;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

revoke execute on function public.google_conversoes_gravar(jsonb) from public, anon, authenticated;
grant execute on function public.google_conversoes_gravar(jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- A chamada do relógio, no mesmo desenho das outras rotinas (0060, 0101). NÃO
-- agendada: entra no dia de ligar.

create or replace function public.disparar_conversoes_do_google()
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
    url     := rtrim(v_url, '/') || '/api/cron/google-conversoes',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_segredo),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end $$;

revoke execute on function public.disparar_conversoes_do_google() from public, anon, authenticated;
