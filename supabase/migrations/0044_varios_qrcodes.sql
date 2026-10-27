-- Vários QR codes, cada um com endereço, destino e contagem próprios.
--
-- POR QUE
--
-- O QR dos banheiros do Tamboré (0043) deu certo, e a JK quer adesivar outros
-- lugares sabendo de onde veio cada contato. Até aqui existia um QR só, com o
-- destino em `site_settings` (`pagina:qrcode`) e a contagem sem dizer de qual
-- impresso veio a leitura.
--
-- COMO
--
-- Cada QR é uma linha em `qrcodes`, e o endereço impresso é
-- `jkaliancas.com.br/qrcode/<slug>`. O do Tamboré continua sendo
-- `jkaliancas.com.br/qrcode`, sem nada depois: é a linha de slug VAZIO, e é
-- ela que responde no endereço curto. Esse endereço está em 36 adesivos e não
-- pode mudar, então o slug vazio não se arquiva (check abaixo) e o portal ainda
-- tem o WhatsApp do Tamboré como padrão de fábrica se a linha sumir.
--
-- O slug não muda depois de criado, porque vai impresso. Nome e destino mudam
-- quando quiser. QR arquivado sai da lista do painel e continua funcionando e
-- contando: adesivo colado não some porque alguém arrumou a tela.
--
-- `qrcode_leituras.qrcode` guarda o slug e nasce com padrão vazio. É isso que
-- deixa o código antigo continuar gravando certo durante o deploy: ele não
-- conhece a coluna, e a leitura cai no QR do Tamboré, que é o único que existe
-- para ele. As 23 leituras de antes desta migration são todas do Tamboré.
--
-- Escrita e leitura só para a equipe. O redirecionamento público lê com a
-- service_role, então a chave anônima não lista os lugares onde há adesivo.

create table public.qrcodes (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique
                check (slug = '' or (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 2 and 40)),
  nome          text not null check (char_length(nome) between 2 and 80),
  modo          text not null default 'whatsapp' check (modo in ('whatsapp', 'link')),
  -- Só os dígitos do número local (DDD + número), sem o 55.
  whatsapp      text not null default '' check (whatsapp ~ '^([1-9][0-9]{9,10})?$'),
  mensagem      text not null default '' check (char_length(mensagem) <= 300),
  link          text not null default '' check (link = '' or (link ~ '^https://' and char_length(link) <= 500)),
  arquivado_em  timestamptz,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por    uuid references public.profiles(id) on delete set null,
  -- O modo escolhido precisa ter para onde levar.
  constraint qrcodes_destino_preenchido
    check ((modo = 'whatsapp' and whatsapp <> '') or (modo = 'link' and link <> '')),
  -- O QR do endereço curto está impresso: não sai da lista.
  constraint qrcodes_principal_nao_arquiva check (slug <> '' or arquivado_em is null)
);

alter table public.qrcodes enable row level security;

create policy qrcodes_staff_select on public.qrcodes
  for select to authenticated using (public.is_staff());
create policy qrcodes_staff_insert on public.qrcodes
  for insert to authenticated with check (public.is_staff());
create policy qrcodes_staff_update on public.qrcodes
  for update to authenticated using (public.is_staff()) with check (public.is_staff());
-- Sem policy de delete: QR se arquiva, não se apaga.

comment on table public.qrcodes is
  'QR codes impressos. slug vazio = jkaliancas.com.br/qrcode (adesivos do Tamboré). O slug não muda depois de criado.';

-- O do Tamboré, com o destino que está no ar hoje. Se alguém já tiver salvo
-- algo em `pagina:qrcode`, é isso que vale; senão, o padrão de fábrica.
insert into public.qrcodes (slug, nome, modo, whatsapp, mensagem, link)
select
  '',
  'Banheiros do Shopping Tamboré',
  coalesce(s.value->>'modo', 'whatsapp'),
  coalesce(nullif(s.value->>'whatsapp', ''), '11991734391'),
  coalesce(s.value->>'mensagem', 'Oi! Vi o QR code da JK aqui no Tamboré e quero saber mais.'),
  coalesce(s.value->>'link', '')
from (select 1) as um
left join public.site_settings s on s.key = 'pagina:qrcode';

alter table public.qrcode_leituras
  add column qrcode text not null default ''
  references public.qrcodes(slug) on update cascade;

create index qrcode_leituras_qrcode_idx on public.qrcode_leituras (qrcode, lido_em desc);

-- Um resumo por QR, com os dias no fuso de São Paulo. Uma linha por QR, então
-- cabe folgado no limite de 1.000 linhas do PostgREST.
create view public.qrcode_resumo
with (security_invoker = true) as
with ref as (
  select (now() at time zone 'America/Sao_Paulo')::date as hoje
),
l as (
  select qrcode, aparelho, lido_em, (lido_em at time zone 'America/Sao_Paulo')::date as dia
  from public.qrcode_leituras
)
select
  l.qrcode,
  count(*)::int                                                              as total,
  count(*) filter (where l.dia = ref.hoje)::int                              as hoje,
  count(*) filter (where l.dia >= ref.hoje - 6)::int                         as ultimos_7,
  count(*) filter (where l.dia >= ref.hoje - 29)::int                        as ultimos_30,
  count(*) filter (where l.dia >= ref.hoje - 29 and l.aparelho = 'iphone')::int  as iphone_30,
  count(*) filter (where l.dia >= ref.hoje - 29 and l.aparelho = 'android')::int as android_30,
  max(l.lido_em)                                                             as ultima
from l cross join ref
group by l.qrcode;

comment on view public.qrcode_resumo is
  'Leituras por QR: total, hoje, 7 e 30 dias (fuso de São Paulo), aparelho em 30 dias e a última.';

-- Leituras por dia, de todos os QRs (p_qrcode nulo) ou de um só. No máximo
-- uma linha por dia, seja qual for o número de QRs.
create function public.qrcode_leituras_diarias(p_desde date, p_qrcode text default null)
returns table (dia date, leituras int)
language sql
stable
security invoker
set search_path = public
as $$
  select (lido_em at time zone 'America/Sao_Paulo')::date as dia, count(*)::int as leituras
  from public.qrcode_leituras
  where lido_em >= (p_desde::timestamp at time zone 'America/Sao_Paulo')
    and (p_qrcode is null or qrcode = p_qrcode)
  group by 1
  order by 1;
$$;

revoke execute on function public.qrcode_leituras_diarias(date, text) from public, anon;
grant execute on function public.qrcode_leituras_diarias(date, text) to authenticated;
