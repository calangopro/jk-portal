-- Custo, margem e campanhas de desconto com aprovação.
--
-- POR QUE
--
-- A JK não sabia a margem de cada peça: o "Preço de custo" da Tray estava
-- preenchido em 1 de 1.167 produtos, e o "Peso" da exportação é peso de frete.
-- Sem margem, desconto de campanha é chute. O dono preenche o custo (planilha
-- ou painel) e o painel calcula margem e desconto máximo, e a campanha só vai
-- para a loja depois que um administrador aprova.
--
-- COMO
--
-- Peça de ouro custa gramas x preço do grama + o resto (feitio, pedras, prata,
-- caixinha). O mesmo modelo pesa igual, então o peso mora na FAMÍLIA
-- (material, tipo, largura, perfil) e o produto só guarda o que for diferente.
-- O preço do grama é um número só em `custo_parametros`: mudou o ouro, todas
-- as margens mudam junto. Prata e semijoia têm custo fixo por produto.
--
-- As famílias nascem aqui com os MESMOS códigos (F01 a F37) da planilha que foi
-- para o dono em 09/11/2026, para a importação dela casar linha a linha.
--
-- Campanha guarda o PREÇO de cada item, que é o que vai para a Tray; o
-- desconto é conta. Aprovar é de administrador, e a trava está no banco
-- (gatilhos abaixo), não só na tela: depois de aprovada, a campanha não muda
-- sem um administrador reabrir.
--
-- Custo e parâmetros: só administrador (é custo da empresa). Campanhas: a
-- equipe propõe, o administrador aprova.

-- ------------------------------------------------------------------ custo

create table public.custo_parametros (
  id             boolean primary key default true check (id),
  cotacao_18k    numeric(10, 2) check (cotacao_18k > 0),
  cotacao_10k    numeric(10, 2) check (cotacao_10k > 0),
  taxa           numeric(6, 4) check (taxa >= 0 and taxa < 1),
  imposto        numeric(6, 4) check (imposto >= 0 and imposto < 1),
  frete          numeric(10, 2) check (frete >= 0),
  embalagem      numeric(10, 2) check (embalagem >= 0),
  margem_minima  numeric(6, 4) check (margem_minima >= 0 and margem_minima < 1),
  atualizado_por uuid references public.profiles(id) on delete set null,
  atualizado_em  timestamptz not null default now()
);
insert into public.custo_parametros (id) values (true);

create table public.custo_familias (
  codigo          text primary key check (codigo ~ '^F[0-9]{2,3}$'),
  material        text not null check (material in ('ouro_18k', 'ouro_10k', 'prata_com_ouro')),
  tipo            text not null,
  largura         text not null,
  perfil          text not null,
  gramas          numeric(8, 3) check (gramas > 0),
  aros_referencia text check (char_length(aros_referencia) <= 60),
  resto           numeric(10, 2) check (resto >= 0),
  atualizado_por  uuid references public.profiles(id) on delete set null,
  atualizado_em   timestamptz not null default now(),
  unique (material, tipo, largura, perfil)
);
create index custo_familias_atualizado_por_idx on public.custo_familias (atualizado_por);

create table public.produto_custos (
  product_id     uuid primary key references public.products(id) on delete cascade,
  -- Nulo = custo fixo (prata, semijoia). Preenchido = custo pelo grama.
  material       text check (material in ('ouro_18k', 'ouro_10k', 'prata_com_ouro')),
  familia        text references public.custo_familias(codigo) on update cascade on delete set null,
  -- Só o que for diferente da família.
  gramas         numeric(8, 3) check (gramas > 0),
  resto          numeric(10, 2) check (resto >= 0),
  custo_fixo     numeric(10, 2) check (custo_fixo >= 0),
  atualizado_por uuid references public.profiles(id) on delete set null,
  atualizado_em  timestamptz not null default now()
);
create index produto_custos_familia_idx on public.produto_custos (familia);
create index produto_custos_atualizado_por_idx on public.produto_custos (atualizado_por);

alter table public.custo_parametros enable row level security;
alter table public.custo_familias enable row level security;
alter table public.produto_custos enable row level security;

create policy custo_parametros_admin_select on public.custo_parametros
  for select to authenticated using ((select public.is_admin()));
create policy custo_parametros_admin_update on public.custo_parametros
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy custo_familias_admin_select on public.custo_familias
  for select to authenticated using ((select public.is_admin()));
create policy custo_familias_admin_insert on public.custo_familias
  for insert to authenticated with check ((select public.is_admin()));
create policy custo_familias_admin_update on public.custo_familias
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy produto_custos_admin_select on public.produto_custos
  for select to authenticated using ((select public.is_admin()));
create policy produto_custos_admin_insert on public.produto_custos
  for insert to authenticated with check ((select public.is_admin()));
create policy produto_custos_admin_update on public.produto_custos
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

comment on table public.custo_parametros is 'Preço do grama, taxas, frete e margem mínima. Uma linha só. Só administrador.';
comment on table public.custo_familias is 'Peso e resto da peça por família de ouro (códigos da planilha do dono). Só administrador.';
comment on table public.produto_custos is 'Custo de cada produto: família de ouro com exceções, ou custo fixo. Só administrador.';

-- ------------------------------------------------------------------ campanhas

create table public.campanhas (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null check (char_length(nome) between 2 and 80),
  inicio        date not null,
  fim           date not null,
  status        text not null default 'rascunho'
                check (status in ('rascunho', 'em_aprovacao', 'aprovada', 'encerrada')),
  nota          text check (char_length(nota) <= 1000),
  criada_por    uuid references public.profiles(id) on delete set null,
  enviada_em    timestamptz,
  decidida_por  uuid references public.profiles(id) on delete set null,
  decidida_em   timestamptz,
  exportada_em  timestamptz,
  criada_em     timestamptz not null default now(),
  atualizada_em timestamptz not null default now(),
  check (fim >= inicio)
);
create index campanhas_status_idx on public.campanhas (status, inicio desc);
create index campanhas_criada_por_idx on public.campanhas (criada_por);
create index campanhas_decidida_por_idx on public.campanhas (decidida_por);

create table public.campanha_itens (
  campanha_id    uuid not null references public.campanhas(id) on delete cascade,
  product_id     uuid not null references public.products(id) on delete cascade,
  -- O preço que vai para a Tray como "Preço promoção". O desconto é conta.
  preco_campanha numeric(12, 2) not null check (preco_campanha > 0),
  adicionado_por uuid references public.profiles(id) on delete set null,
  adicionado_em  timestamptz not null default now(),
  primary key (campanha_id, product_id)
);
create index campanha_itens_produto_idx on public.campanha_itens (product_id);
create index campanha_itens_adicionado_por_idx on public.campanha_itens (adicionado_por);

/**
 * Administrador logado, ou o próprio servidor (service_role, SQL editor).
 * Lê o papel do PEDIDO (`auth.role()`), e não `current_user`: dentro de função
 * com privilégio de dono o `current_user` é o dono, e a trava liberaria todo
 * mundo. Pelo mesmo motivo os gatilhos abaixo rodam com o papel de quem chama.
 */
create or replace function public.pode_aprovar_campanha()
returns boolean
language sql
stable
set search_path = ''
as $$
  select public.is_admin()
      or coalesce(auth.role(), '') = 'service_role'
      or session_user in ('postgres', 'supabase_admin')
$$;

create or replace function public.campanhas_trava()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizada_em := now();
  if new.status is distinct from old.status then
    -- Aprovar, e qualquer saída de "aprovada", é de administrador.
    if (new.status = 'aprovada' or old.status = 'aprovada') and not public.pode_aprovar_campanha() then
      raise exception 'Só administrador aprova ou reabre campanha.' using errcode = '42501';
    end if;
  elsif old.status = 'aprovada'
    and (new.nome, new.inicio, new.fim) is distinct from (old.nome, old.inicio, old.fim)
    and not public.pode_aprovar_campanha() then
    raise exception 'Campanha aprovada não muda sem um administrador reabrir.' using errcode = '42501';
  end if;
  return new;
end
$$;

create trigger campanhas_trava
  before update on public.campanhas
  for each row execute function public.campanhas_trava();

/**
 * Item só muda com a campanha em rascunho. Em aprovação, só o administrador
 * (ajustar um preço antes de aprovar). Aprovada ou encerrada, ninguém.
 */
create or replace function public.campanha_itens_trava()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  situacao text;
begin
  select c.status into situacao
  from public.campanhas c
  where c.id = coalesce(new.campanha_id, old.campanha_id);

  if situacao = 'rascunho'
     or (situacao = 'em_aprovacao' and public.pode_aprovar_campanha()) then
    return coalesce(new, old);
  end if;
  raise exception 'A campanha está %: os itens só mudam em rascunho.', situacao using errcode = '42501';
end
$$;

create trigger campanha_itens_trava
  before insert or update or delete on public.campanha_itens
  for each row execute function public.campanha_itens_trava();

alter table public.campanhas enable row level security;
alter table public.campanha_itens enable row level security;

create policy campanhas_staff_select on public.campanhas
  for select to authenticated using ((select public.is_staff()));
create policy campanhas_staff_insert on public.campanhas
  for insert to authenticated with check ((select public.is_staff()) and status = 'rascunho');
create policy campanhas_staff_update on public.campanhas
  for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
-- Sem delete: campanha se encerra, e o histórico de preço fica.

create policy campanha_itens_staff_select on public.campanha_itens
  for select to authenticated using ((select public.is_staff()));
create policy campanha_itens_staff_insert on public.campanha_itens
  for insert to authenticated with check ((select public.is_staff()));
create policy campanha_itens_staff_update on public.campanha_itens
  for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
-- Tirar item de um rascunho é normal (o gatilho barra fora do rascunho).
create policy campanha_itens_staff_delete on public.campanha_itens
  for delete to authenticated using ((select public.is_staff()));

comment on table public.campanhas is 'Campanhas de desconto. A equipe propõe, administrador aprova (trava no gatilho).';
comment on table public.campanha_itens is 'Preço de campanha de cada produto. Só muda em rascunho.';

-- ------------------------------------------------------------------ carga inicial
-- Famílias e produtos de ouro da planilha do dono (09/11/2026).

insert into public.custo_familias (codigo, material, tipo, largura, perfil) values
  ('F01', 'ouro_18k', 'Par', '1 mm', 'Reta'),
  ('F02', 'ouro_18k', 'Par', '2 mm', 'Reta'),
  ('F03', 'ouro_10k', 'Par', '1,5 mm', 'Reta'),
  ('F04', 'ouro_18k', 'Par', '1,5 mm', 'Reta'),
  ('F05', 'ouro_10k', 'Par', '4 mm', 'Reta'),
  ('F06', 'prata_com_ouro', 'Par', '2 mm', 'Sem perfil no nome'),
  ('F07', 'ouro_18k', 'Par', '3 mm', 'Anatômica'),
  ('F08', 'ouro_18k', 'Par', '4 mm', 'Reta'),
  ('F09', 'ouro_10k', 'Par', '1 mm', 'Reta'),
  ('F10', 'ouro_18k', 'Par', '4 mm', 'Anatômica'),
  ('F11', 'ouro_18k', 'Par', '7 mm', 'Sem perfil no nome'),
  ('F12', 'prata_com_ouro', 'Par', '3 mm', 'Sem perfil no nome'),
  ('F13', 'prata_com_ouro', 'Par', '4 mm', 'Sem perfil no nome'),
  ('F14', 'ouro_10k', 'Par', '2 mm', 'Reta'),
  ('F15', 'ouro_10k', 'Par', '4 mm', 'Anatômica'),
  ('F16', 'ouro_10k', 'Par', '3 mm', 'Reta'),
  ('F17', 'ouro_18k', 'Par', '3 mm', 'Reta'),
  ('F18', 'ouro_18k', 'Par', '6 mm', 'Reta'),
  ('F19', 'ouro_18k', 'Par', '8 mm', 'Sem perfil no nome'),
  ('F20', 'ouro_10k', 'Par', '2,5 mm', 'Anatômica'),
  ('F21', 'ouro_10k', 'Par', '3 mm', 'Anatômica'),
  ('F22', 'ouro_10k', 'Par', '3,5 mm', 'Reta'),
  ('F23', 'ouro_18k', 'Par', '10 mm', 'Sem perfil no nome'),
  ('F24', 'ouro_18k', 'Par', '2 mm', 'Anatômica'),
  ('F25', 'ouro_18k', 'Par', '2,5 mm', 'Anatômica'),
  ('F26', 'ouro_18k', 'Par', '3,5 mm', 'Reta'),
  ('F27', 'ouro_18k', 'Par', '5 mm', 'Anatômica'),
  ('F28', 'ouro_18k', 'Par', '5 mm', 'Reta'),
  ('F29', 'ouro_18k', 'Par', '6 mm', 'Anatômica'),
  ('F30', 'ouro_18k', 'Par', '6 mm', 'Sem perfil no nome'),
  ('F31', 'ouro_18k', 'Par', '7 mm', 'Anatômica'),
  ('F32', 'ouro_18k', 'Par', '7 mm', 'Reta'),
  ('F33', 'prata_com_ouro', 'Par', '10 mm', 'Sem perfil no nome'),
  ('F34', 'prata_com_ouro', 'Par', '5 mm', 'Sem perfil no nome'),
  ('F35', 'prata_com_ouro', 'Par', '6 mm', 'Sem perfil no nome'),
  ('F36', 'prata_com_ouro', 'Par', '7 mm', 'Sem perfil no nome'),
  ('F37', 'prata_com_ouro', 'Par', '8 mm', 'Sem perfil no nome');

insert into public.produto_custos (product_id, material, familia)
select p.id, v.material, v.familia
from (values
  ('1769', 'ouro_18k', 'F01'),
  ('303', 'ouro_18k', null),
  ('2279', 'ouro_10k', 'F03'),
  ('97', 'ouro_18k', 'F04'),
  ('243', 'prata_com_ouro', 'F06'),
  ('1401', 'ouro_18k', 'F02'),
  ('1675', 'ouro_18k', null),
  ('1655', 'ouro_18k', null),
  ('2525', 'ouro_10k', 'F09'),
  ('77', 'prata_com_ouro', 'F12'),
  ('1191', 'ouro_18k', 'F11'),
  ('101', 'ouro_18k', 'F02'),
  ('413', 'ouro_18k', 'F08'),
  ('1659', 'ouro_18k', null),
  ('2595', 'ouro_18k', null),
  ('1657', 'ouro_18k', null),
  ('1667', 'ouro_18k', null),
  ('87', 'prata_com_ouro', 'F13'),
  ('2287', 'ouro_10k', 'F14'),
  ('2335', 'ouro_10k', 'F05'),
  ('2353', 'ouro_10k', 'F05'),
  ('401', 'ouro_18k', 'F10'),
  ('1673', 'ouro_18k', null),
  ('1671', 'ouro_18k', null),
  ('1195', 'ouro_18k', null),
  ('2749', 'ouro_10k', null),
  ('2651', 'ouro_18k', null),
  ('1661', 'ouro_18k', null),
  ('89', 'prata_com_ouro', 'F13'),
  ('1165', 'ouro_18k', 'F19'),
  ('2329', 'ouro_10k', 'F15'),
  ('2331', 'ouro_10k', 'F15'),
  ('2291', 'ouro_10k', 'F16'),
  ('2307', 'ouro_10k', 'F05'),
  ('2343', 'ouro_10k', 'F05'),
  ('115', 'ouro_18k', 'F07'),
  ('335', 'ouro_18k', 'F07'),
  ('361', 'ouro_18k', 'F07'),
  ('367', 'ouro_18k', 'F07'),
  ('381', 'ouro_18k', 'F07'),
  ('407', 'ouro_18k', 'F10'),
  ('425', 'ouro_18k', 'F10'),
  ('105', 'ouro_18k', 'F02'),
  ('113', 'ouro_18k', 'F17'),
  ('415', 'ouro_18k', 'F08'),
  ('421', 'ouro_18k', 'F08'),
  ('637', 'ouro_18k', 'F18'),
  ('1199', 'ouro_18k', null),
  ('2593', 'ouro_18k', null),
  ('2609', 'ouro_18k', null),
  ('2607', 'ouro_18k', null),
  ('2605', 'ouro_18k', null),
  ('2611', 'ouro_18k', null),
  ('2623', 'ouro_18k', null),
  ('2627', 'ouro_18k', null),
  ('2629', 'ouro_18k', null),
  ('2617', 'ouro_18k', null),
  ('2613', 'ouro_18k', null),
  ('2633', 'ouro_18k', null),
  ('2639', 'ouro_18k', null),
  ('2647', 'ouro_18k', null),
  ('2653', 'ouro_18k', null),
  ('2655', 'ouro_18k', null),
  ('2659', 'ouro_18k', null),
  ('2665', 'ouro_18k', null),
  ('2637', 'ouro_18k', null),
  ('2643', 'ouro_18k', null),
  ('2645', 'ouro_18k', null),
  ('2663', 'ouro_18k', null),
  ('2615', 'ouro_18k', null),
  ('2619', 'ouro_18k', null),
  ('2621', 'ouro_18k', null),
  ('2641', 'ouro_18k', null),
  ('2649', 'ouro_18k', null),
  ('2625', 'ouro_18k', null),
  ('2631', 'ouro_18k', null),
  ('2635', 'ouro_18k', null),
  ('1653', 'ouro_18k', null),
  ('1669', 'ouro_18k', null),
  ('1663', 'ouro_18k', null),
  ('1665', 'ouro_18k', null),
  ('1515', 'ouro_18k', null),
  ('1505', 'ouro_18k', null),
  ('1503', 'ouro_18k', null),
  ('1501', 'ouro_18k', null),
  ('3019', 'ouro_18k', null),
  ('3027', 'ouro_18k', null),
  ('3029', 'ouro_18k', null),
  ('2779', 'ouro_18k', null),
  ('1123', 'prata_com_ouro', 'F33'),
  ('1125', 'prata_com_ouro', 'F33'),
  ('1127', 'prata_com_ouro', 'F33'),
  ('1129', 'prata_com_ouro', 'F33'),
  ('1131', 'prata_com_ouro', 'F33'),
  ('1133', 'prata_com_ouro', 'F33'),
  ('1135', 'prata_com_ouro', 'F33'),
  ('79', 'prata_com_ouro', 'F12'),
  ('81', 'prata_com_ouro', 'F12'),
  ('83', 'prata_com_ouro', 'F12'),
  ('85', 'prata_com_ouro', 'F12'),
  ('1047', 'prata_com_ouro', 'F12'),
  ('91', 'prata_com_ouro', 'F13'),
  ('93', 'prata_com_ouro', 'F13'),
  ('95', 'prata_com_ouro', 'F13'),
  ('1041', 'prata_com_ouro', 'F13'),
  ('1043', 'prata_com_ouro', 'F13'),
  ('1045', 'prata_com_ouro', 'F13'),
  ('1049', 'prata_com_ouro', 'F13'),
  ('1051', 'prata_com_ouro', 'F13'),
  ('1055', 'prata_com_ouro', 'F13'),
  ('1057', 'prata_com_ouro', 'F13'),
  ('1059', 'prata_com_ouro', 'F13'),
  ('1053', 'prata_com_ouro', 'F34'),
  ('1061', 'prata_com_ouro', 'F34'),
  ('1063', 'prata_com_ouro', 'F34'),
  ('1065', 'prata_com_ouro', 'F34'),
  ('1067', 'prata_com_ouro', 'F34'),
  ('1069', 'prata_com_ouro', 'F34'),
  ('1071', 'prata_com_ouro', 'F34'),
  ('1073', 'prata_com_ouro', 'F34'),
  ('325', 'prata_com_ouro', 'F35'),
  ('1075', 'prata_com_ouro', 'F35'),
  ('1077', 'prata_com_ouro', 'F35'),
  ('1079', 'prata_com_ouro', 'F35'),
  ('1081', 'prata_com_ouro', 'F35'),
  ('1083', 'prata_com_ouro', 'F35'),
  ('1085', 'prata_com_ouro', 'F35'),
  ('1087', 'prata_com_ouro', 'F35'),
  ('1089', 'prata_com_ouro', 'F35'),
  ('1091', 'prata_com_ouro', 'F35'),
  ('1093', 'prata_com_ouro', 'F36'),
  ('1095', 'prata_com_ouro', 'F36'),
  ('1097', 'prata_com_ouro', 'F36'),
  ('1099', 'prata_com_ouro', 'F36'),
  ('1101', 'prata_com_ouro', 'F36'),
  ('1103', 'prata_com_ouro', 'F36'),
  ('1105', 'prata_com_ouro', 'F37'),
  ('1107', 'prata_com_ouro', 'F37'),
  ('1109', 'prata_com_ouro', 'F37'),
  ('1111', 'prata_com_ouro', 'F37'),
  ('1113', 'prata_com_ouro', 'F37'),
  ('1115', 'prata_com_ouro', 'F37'),
  ('1117', 'prata_com_ouro', 'F37'),
  ('1119', 'prata_com_ouro', 'F37'),
  ('1121', 'prata_com_ouro', 'F37'),
  ('1201', 'ouro_18k', 'F23'),
  ('1189', 'ouro_18k', 'F30'),
  ('2293', 'ouro_10k', 'F20'),
  ('2297', 'ouro_10k', 'F21'),
  ('2301', 'ouro_10k', 'F21'),
  ('2303', 'ouro_10k', 'F21'),
  ('2305', 'ouro_10k', 'F21'),
  ('2309', 'ouro_10k', 'F21'),
  ('2311', 'ouro_10k', 'F21'),
  ('2313', 'ouro_10k', 'F21'),
  ('2315', 'ouro_10k', 'F21'),
  ('2317', 'ouro_10k', 'F21'),
  ('2319', 'ouro_10k', 'F21'),
  ('2323', 'ouro_10k', 'F15'),
  ('2347', 'ouro_10k', 'F15'),
  ('2351', 'ouro_10k', 'F15'),
  ('2359', 'ouro_10k', 'F15'),
  ('2281', 'ouro_10k', 'F14'),
  ('2283', 'ouro_10k', 'F14'),
  ('2285', 'ouro_10k', 'F14'),
  ('2289', 'ouro_10k', 'F14'),
  ('2327', 'ouro_10k', 'F22'),
  ('2321', 'ouro_10k', 'F05'),
  ('2333', 'ouro_10k', 'F05'),
  ('2337', 'ouro_10k', 'F05'),
  ('2339', 'ouro_10k', 'F05'),
  ('2349', 'ouro_10k', 'F05'),
  ('2355', 'ouro_10k', 'F05'),
  ('2357', 'ouro_10k', 'F05'),
  ('331', 'ouro_18k', 'F25'),
  ('99', 'ouro_18k', 'F24'),
  ('333', 'ouro_18k', 'F07'),
  ('337', 'ouro_18k', 'F07'),
  ('339', 'ouro_18k', 'F07'),
  ('341', 'ouro_18k', 'F07'),
  ('343', 'ouro_18k', 'F07'),
  ('345', 'ouro_18k', 'F07'),
  ('347', 'ouro_18k', 'F07'),
  ('349', 'ouro_18k', 'F07'),
  ('353', 'ouro_18k', 'F07'),
  ('355', 'ouro_18k', 'F07'),
  ('359', 'ouro_18k', 'F07'),
  ('363', 'ouro_18k', 'F07'),
  ('365', 'ouro_18k', 'F07'),
  ('369', 'ouro_18k', 'F07'),
  ('371', 'ouro_18k', 'F07'),
  ('373', 'ouro_18k', 'F07'),
  ('375', 'ouro_18k', 'F07'),
  ('377', 'ouro_18k', 'F07'),
  ('379', 'ouro_18k', 'F07'),
  ('383', 'ouro_18k', 'F10'),
  ('391', 'ouro_18k', 'F10'),
  ('393', 'ouro_18k', 'F10'),
  ('395', 'ouro_18k', 'F10'),
  ('397', 'ouro_18k', 'F10'),
  ('399', 'ouro_18k', 'F10'),
  ('403', 'ouro_18k', 'F10'),
  ('411', 'ouro_18k', 'F10'),
  ('433', 'ouro_18k', 'F10'),
  ('435', 'ouro_18k', 'F10'),
  ('437', 'ouro_18k', 'F10'),
  ('439', 'ouro_18k', 'F10'),
  ('441', 'ouro_18k', 'F10'),
  ('455', 'ouro_18k', 'F10'),
  ('459', 'ouro_18k', 'F10'),
  ('461', 'ouro_18k', 'F10'),
  ('463', 'ouro_18k', 'F10'),
  ('469', 'ouro_18k', 'F10'),
  ('473', 'ouro_18k', 'F10'),
  ('481', 'ouro_18k', 'F10'),
  ('529', 'ouro_18k', 'F10'),
  ('483', 'ouro_18k', 'F27'),
  ('485', 'ouro_18k', 'F27'),
  ('487', 'ouro_18k', 'F27'),
  ('489', 'ouro_18k', 'F27'),
  ('491', 'ouro_18k', 'F27'),
  ('501', 'ouro_18k', 'F27'),
  ('509', 'ouro_18k', 'F27'),
  ('515', 'ouro_18k', 'F27'),
  ('535', 'ouro_18k', 'F27'),
  ('539', 'ouro_18k', 'F27'),
  ('543', 'ouro_18k', 'F27'),
  ('545', 'ouro_18k', 'F27'),
  ('563', 'ouro_18k', 'F27'),
  ('565', 'ouro_18k', 'F27'),
  ('567', 'ouro_18k', 'F27'),
  ('575', 'ouro_18k', 'F29'),
  ('577', 'ouro_18k', 'F29'),
  ('581', 'ouro_18k', 'F29'),
  ('583', 'ouro_18k', 'F29'),
  ('585', 'ouro_18k', 'F29'),
  ('591', 'ouro_18k', 'F29'),
  ('593', 'ouro_18k', 'F29'),
  ('613', 'ouro_18k', 'F29'),
  ('615', 'ouro_18k', 'F29'),
  ('619', 'ouro_18k', 'F29'),
  ('629', 'ouro_18k', 'F29'),
  ('651', 'ouro_18k', 'F29'),
  ('655', 'ouro_18k', 'F29'),
  ('657', 'ouro_18k', 'F29'),
  ('659', 'ouro_18k', 'F29'),
  ('671', 'ouro_18k', 'F29'),
  ('673', 'ouro_18k', 'F29'),
  ('687', 'ouro_18k', 'F29'),
  ('707', 'ouro_18k', 'F31'),
  ('103', 'ouro_18k', 'F02'),
  ('107', 'ouro_18k', 'F02'),
  ('109', 'ouro_18k', 'F02'),
  ('389', 'ouro_18k', 'F26'),
  ('111', 'ouro_18k', 'F17'),
  ('357', 'ouro_18k', 'F08'),
  ('385', 'ouro_18k', 'F08'),
  ('387', 'ouro_18k', 'F08'),
  ('405', 'ouro_18k', 'F08'),
  ('409', 'ouro_18k', 'F08'),
  ('417', 'ouro_18k', 'F08'),
  ('419', 'ouro_18k', 'F08'),
  ('431', 'ouro_18k', 'F08'),
  ('443', 'ouro_18k', 'F08'),
  ('445', 'ouro_18k', 'F08'),
  ('447', 'ouro_18k', 'F08'),
  ('451', 'ouro_18k', 'F08'),
  ('453', 'ouro_18k', 'F08'),
  ('457', 'ouro_18k', 'F08'),
  ('465', 'ouro_18k', 'F08'),
  ('475', 'ouro_18k', 'F08'),
  ('477', 'ouro_18k', 'F08'),
  ('479', 'ouro_18k', 'F08'),
  ('525', 'ouro_18k', 'F08'),
  ('527', 'ouro_18k', 'F08'),
  ('531', 'ouro_18k', 'F08'),
  ('493', 'ouro_18k', 'F28'),
  ('495', 'ouro_18k', 'F28'),
  ('497', 'ouro_18k', 'F28'),
  ('503', 'ouro_18k', 'F28'),
  ('505', 'ouro_18k', 'F28'),
  ('507', 'ouro_18k', 'F28'),
  ('511', 'ouro_18k', 'F28'),
  ('513', 'ouro_18k', 'F28'),
  ('517', 'ouro_18k', 'F28'),
  ('519', 'ouro_18k', 'F28'),
  ('521', 'ouro_18k', 'F28'),
  ('523', 'ouro_18k', 'F28'),
  ('533', 'ouro_18k', 'F28'),
  ('537', 'ouro_18k', 'F28'),
  ('541', 'ouro_18k', 'F28'),
  ('547', 'ouro_18k', 'F28'),
  ('549', 'ouro_18k', 'F28'),
  ('551', 'ouro_18k', 'F28'),
  ('553', 'ouro_18k', 'F28'),
  ('555', 'ouro_18k', 'F28'),
  ('557', 'ouro_18k', 'F28'),
  ('559', 'ouro_18k', 'F28'),
  ('561', 'ouro_18k', 'F28'),
  ('569', 'ouro_18k', 'F28'),
  ('677', 'ouro_18k', 'F28'),
  ('571', 'ouro_18k', 'F18'),
  ('579', 'ouro_18k', 'F18'),
  ('587', 'ouro_18k', 'F18'),
  ('589', 'ouro_18k', 'F18'),
  ('595', 'ouro_18k', 'F18'),
  ('597', 'ouro_18k', 'F18'),
  ('599', 'ouro_18k', 'F18'),
  ('601', 'ouro_18k', 'F18'),
  ('603', 'ouro_18k', 'F18'),
  ('607', 'ouro_18k', 'F18'),
  ('611', 'ouro_18k', 'F18'),
  ('617', 'ouro_18k', 'F18'),
  ('621', 'ouro_18k', 'F18'),
  ('623', 'ouro_18k', 'F18'),
  ('625', 'ouro_18k', 'F18'),
  ('627', 'ouro_18k', 'F18'),
  ('631', 'ouro_18k', 'F18'),
  ('633', 'ouro_18k', 'F18'),
  ('639', 'ouro_18k', 'F18'),
  ('641', 'ouro_18k', 'F18'),
  ('643', 'ouro_18k', 'F18'),
  ('647', 'ouro_18k', 'F18'),
  ('649', 'ouro_18k', 'F18'),
  ('653', 'ouro_18k', 'F18'),
  ('661', 'ouro_18k', 'F18'),
  ('663', 'ouro_18k', 'F18'),
  ('665', 'ouro_18k', 'F18'),
  ('669', 'ouro_18k', 'F18'),
  ('675', 'ouro_18k', 'F18'),
  ('679', 'ouro_18k', 'F18'),
  ('683', 'ouro_18k', 'F18'),
  ('689', 'ouro_18k', 'F18'),
  ('691', 'ouro_18k', 'F18'),
  ('729', 'ouro_18k', 'F32'),
  ('737', 'ouro_18k', 'F32'),
  ('741', 'ouro_18k', 'F32')
) as v(tray_id, material, familia)
join public.products p on p.tray_id = v.tray_id;
