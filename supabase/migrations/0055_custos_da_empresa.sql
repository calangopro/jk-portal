-- Custos da empresa: o que a loja gasta para funcionar, com o comprovante junto.
--
-- POR QUE
--
-- A dona mandava a lista de despesas "de cabeça" pelo WhatsApp, e ninguém sabia
-- quanto a loja custa de verdade. O custo das PEÇAS já mora em Margem (0049).
-- Aqui fica o resto: folha, anúncio, plataforma, aluguel, embalagem.
--
-- COMO
--
-- Cada linha de `despesas` é um custo de um dos dois tipos:
--   mensal      valor que se repete todo mês (folha, Tray, aluguel);
--   por_pedido  valor gasto a cada pedido enviado (caixa, cartão de garantia).
-- O total do mês é a soma dos mensais mais o por pedido vezes os pedidos pagos,
-- que a tela lê de `tray_pedidos`.
--
-- `confirmado` separa número com comprovante de número de cabeça, e `fonte` diz
-- de onde ele veio. Custo que deixou de existir é desativado, não apagado.
--
-- Os comprovantes ficam no bucket PRIVADO `comprovantes`, e `despesa_anexos`
-- guarda o caminho de cada um. Nada aqui é público: tabela, anexo e arquivo só
-- abrem para administrador, e o arquivo sai por link assinado de curta duração.
--
-- Os valores NÃO estão nesta migration, de propósito: é dinheiro da empresa, e
-- o repositório não é lugar para isso. Eles entram pelo painel.

create table public.despesas (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null check (char_length(nome) between 2 and 120),
  categoria      text not null check (categoria in (
                   'pessoal', 'anuncios', 'plataformas', 'embalagem', 'frete',
                   'impostos_e_taxas', 'estrutura', 'servicos', 'outros')),
  tipo           text not null check (tipo in ('mensal', 'por_pedido')),
  valor          numeric(12, 2) not null check (valor >= 0),
  confirmado     boolean not null default false,
  fonte          text check (char_length(fonte) <= 300),
  observacao     text check (char_length(observacao) <= 500),
  ativo          boolean not null default true,
  criado_por     uuid references public.profiles (id) on delete set null,
  atualizado_por uuid references public.profiles (id) on delete set null,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

comment on table public.despesas is
  'Custos de funcionamento da empresa. O custo das peças fica em produto_custos e custo_familias.';
comment on column public.despesas.confirmado is
  'true quando o valor vem de comprovante ou conta exata; false quando é estimativa.';

create index despesas_criado_por_idx on public.despesas (criado_por);
create index despesas_atualizado_por_idx on public.despesas (atualizado_por);

create table public.despesa_anexos (
  id          uuid primary key default gen_random_uuid(),
  despesa_id  uuid not null references public.despesas (id) on delete cascade,
  caminho     text not null unique,
  nome        text not null check (char_length(nome) between 1 and 200),
  tipo        text,
  tamanho     integer check (tamanho >= 0),
  enviado_por uuid references public.profiles (id) on delete set null,
  criado_em   timestamptz not null default now()
);

create index despesa_anexos_despesa_idx on public.despesa_anexos (despesa_id);
create index despesa_anexos_enviado_por_idx on public.despesa_anexos (enviado_por);

alter table public.despesas enable row level security;
alter table public.despesa_anexos enable row level security;

create policy despesas_admin_select on public.despesas
  for select to authenticated using ((select public.is_admin()));
create policy despesas_admin_insert on public.despesas
  for insert to authenticated with check ((select public.is_admin()));
create policy despesas_admin_update on public.despesas
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy despesa_anexos_admin_select on public.despesa_anexos
  for select to authenticated using ((select public.is_admin()));
create policy despesa_anexos_admin_insert on public.despesa_anexos
  for insert to authenticated with check ((select public.is_admin()));

revoke all on public.despesas from anon;
revoke all on public.despesa_anexos from anon;

-- Bucket privado: PDF e imagem, até 10 MB. Sem policy para anon, e a leitura
-- pede administrador, então nem link direto abre o arquivo.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'comprovantes', 'comprovantes', false, 10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy "comprovantes admin leitura" on storage.objects
  for select to authenticated
  using (bucket_id = 'comprovantes' and (select public.is_admin()));
create policy "comprovantes admin envio" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'comprovantes' and (select public.is_admin()));
