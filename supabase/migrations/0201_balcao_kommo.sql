-- 0201: o balcão da loja na Kommo (cartão 72).
--
-- Fase 2 do balcão (0198). Em 20/11/2026 os usuários das lojas já estavam
-- DESATIVADOS na Kommo (só KDM, Kevyn, Thiago e Pedro ativos), e a loja
-- registrava a venda do balcão no funil LOJA | PDV, etapa Lançamento, onde
-- começa o pós-venda (boas-vindas, NPS, cashback, manutenção, aniversário).
-- Agora o painel faz esse registro sozinho:
--
--   balcao_pedido  pedido salvo no balcão vira negócio no funil e na etapa
--                  escolhidos para a loja, com os campos que a loja preenchia
--                  à mão, uma nota com o resumo e as tags;
--   balcao_lead    lead do balcão (quem visitou e não comprou) vira negócio no
--                  funil e na etapa escolhidos para lead daquela loja.
--
-- As mesmas regras das automações da 0173, sem exceção: nascem DESLIGADAS;
-- funil, etapa e responsável de cada loja são escolhidos pela diretoria na
-- tela, nunca no código (`balcao_kommo`); mudar a ligação de uma loja DESLIGA
-- as duas; ligar é de administrador, dono e GM, que vira o autor de cada
-- escrita; só vale o que for salvo DEPOIS de ligar; uma escrita por pedido ou
-- lead (a chave 'balcao_pedido:<id>' e 'balcao_lead:<id>' de `kommo_escritas`),
-- e a que falhou não é tentada de novo sozinha. Quem escreve continua sendo só
-- `src/lib/kommo/escrever.ts`.
--
-- Criar negócio na etapa pode disparar o Salesbot dela e mandar WhatsApp ao
-- cliente. No PDV isso é o que já acontecia quando a loja lançava à mão.
--
-- Junto: a origem do cliente no pedido ("como conheceu", o campo Origem do
-- cliente da Kommo) e o lead do balcão (`loja_leads`).

-- ------------------------------------------------------------------ pedido e lead

alter table public.loja_pedidos add column origem_cliente text
  check (origem_cliente is null or origem_cliente in ('shopping', 'google', 'instagram', 'indicacao', 'recompra', 'whatsapp'));

create table public.loja_leads (
  id uuid primary key,
  loja text not null check (char_length(loja) between 2 and 60),
  vendedor uuid not null references public.loja_vendedores (id),
  cliente_nome text not null check (char_length(btrim(cliente_nome)) between 2 and 120),
  cliente_telefone text not null check (cliente_telefone ~ '^55[0-9]{10,11}$'),
  interesse text check (interesse is null or char_length(interesse) <= 300),
  tipo_produto text check (tipo_produto is null or tipo_produto in ('aliancas', 'aneis', 'brinco', 'colares', 'corrente', 'gargantilha', 'pulseira', 'outro')),
  motivo text check (motivo is null or motivo in ('namoro', 'noivado', 'casamento', 'bodas', 'presente', 'outro')),
  data_especial date,
  origem_cliente text check (origem_cliente is null or origem_cliente in ('shopping', 'google', 'instagram', 'indicacao', 'recompra', 'whatsapp')),
  observacao text check (observacao is null or char_length(observacao) <= 1000),
  criado_por uuid not null references auth.users (id),
  criado_em timestamptz not null default now()
);
create index loja_leads_loja_criado on public.loja_leads (loja, criado_em desc);
alter table public.loja_leads enable row level security;
revoke all on table public.loja_leads from anon, authenticated;

-- ------------------------------------------------------------------ ligação loja e Kommo

create table public.balcao_kommo (
  loja text primary key check (char_length(loja) between 2 and 60),
  -- A opção do campo "Loja" da Kommo (Aricanduva, Granja Vianna, Osasco Plaza...). Nulo: o campo fica vazio.
  loja_kommo text check (loja_kommo is null or char_length(loja_kommo) <= 60),
  tag text check (tag is null or char_length(tag) between 2 and 60),
  funil_pedido bigint,
  etapa_pedido bigint,
  funil_lead bigint,
  etapa_lead bigint,
  responsavel_id bigint,
  editado_por uuid references public.profiles (id) on delete set null,
  editado_em timestamptz not null default now()
);
alter table public.balcao_kommo enable row level security;
revoke all on table public.balcao_kommo from anon, authenticated;

alter table public.kommo_automacoes drop constraint kommo_automacoes_id_check;
alter table public.kommo_automacoes add constraint kommo_automacoes_id_check
  check (id in ('recuperacao', 'pos_venda', 'sac', 'tarefas', 'balcao_pedido', 'balcao_lead'));
insert into public.kommo_automacoes (id, espera_min, limite_por_hora) values ('balcao_pedido', 0, 30), ('balcao_lead', 0, 30)
on conflict (id) do nothing;

-- A ligação de uma loja está completa para o pedido (ou para o lead)?
create or replace function public.balcao_kommo_completa(p_loja text, p_tipo text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select
      b.responsavel_id is not null
      and exists (select 1 from public.kommo_usuarios u where u.id = b.responsavel_id and u.ativo)
      and exists (
        select 1 from public.kommo_etapas e join public.kommo_funis f on f.id = e.funil_id
        where not f.arquivado and e.tipo in ('entrada', 'aberta')
          and e.funil_id = case when p_tipo = 'pedido' then b.funil_pedido else b.funil_lead end
          and e.id = case when p_tipo = 'pedido' then b.etapa_pedido else b.etapa_lead end
      )
    from public.balcao_kommo b where b.loja = p_loja
  ), false)
$$;

-- A conferência das automações (0173), com as duas do balcão: elas não têm um
-- funil só, têm uma ligação por loja, e ligam com pelo menos uma loja completa.
create or replace function public.kommo_automacao_problema(p_id text, p_funil bigint, p_etapa bigint, p_etapas jsonb, p_responsavel bigint)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_marco text;
  v_etapa bigint;
  v_ordem integer;
  v_ultima integer := -1;
begin
  if p_id in ('balcao_pedido', 'balcao_lead') then
    if not exists (select 1 from public.balcao_kommo b where public.balcao_kommo_completa(b.loja, case when p_id = 'balcao_pedido' then 'pedido' else 'lead' end)) then
      return 'lojas';
    end if;
    return null;
  end if;
  if p_responsavel is not null and not exists (select 1 from public.kommo_usuarios u where u.id = p_responsavel and u.ativo) then
    return 'responsavel';
  end if;
  if p_id = 'tarefas' then
    if p_funil is not null and not exists (select 1 from public.kommo_funis f where f.id = p_funil and not f.arquivado) then
      return 'funil';
    end if;
    return null;
  end if;
  if p_funil is null or not exists (select 1 from public.kommo_funis f where f.id = p_funil and not f.arquivado) then
    return 'funil';
  end if;
  if p_id in ('recuperacao', 'sac') then
    if p_etapa is null or not exists (
      select 1 from public.kommo_etapas e where e.funil_id = p_funil and e.id = p_etapa and e.tipo in ('entrada', 'aberta')
    ) then
      return 'etapa';
    end if;
    return null;
  end if;
  if p_etapas is null or jsonb_typeof(p_etapas) <> 'object' or not (p_etapas ?| array['pago', 'enviado', 'entregue']) then
    return 'etapas';
  end if;
  foreach v_marco in array array['pago', 'enviado', 'entregue'] loop
    continue when not (p_etapas ? v_marco) or jsonb_typeof(p_etapas -> v_marco) = 'null';
    if jsonb_typeof(p_etapas -> v_marco) <> 'number' then return 'etapas'; end if;
    v_etapa := (p_etapas ->> v_marco)::bigint;
    select e.ordem into v_ordem from public.kommo_etapas e where e.funil_id = p_funil and e.id = v_etapa and e.tipo in ('entrada', 'aberta');
    if v_ordem is null then return 'etapas'; end if;
    if v_ordem <= v_ultima then return 'ordem'; end if;
    v_ultima := v_ordem;
  end loop;
  if v_ultima < 0 then return 'etapas'; end if;
  return null;
end
$$;

-- A tela da diretoria: as ligações, as duas automações e o que foi escrito.
create or replace function public.balcao_kommo_config()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when not coalesce(public.is_admin(), false) then null else jsonb_build_object(
    'lojas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'loja', b.loja, 'loja_kommo', b.loja_kommo, 'tag', b.tag,
        'funil_pedido', b.funil_pedido, 'etapa_pedido', b.etapa_pedido, 'funil_lead', b.funil_lead, 'etapa_lead', b.etapa_lead,
        'responsavel_id', b.responsavel_id,
        'completa_pedido', public.balcao_kommo_completa(b.loja, 'pedido'), 'completa_lead', public.balcao_kommo_completa(b.loja, 'lead'),
        'editado_em', b.editado_em
      ) order by b.loja)
      from public.balcao_kommo b
    ), '[]'::jsonb),
    'automacoes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'ativa', a.ativa, 'ativada_em', a.ativada_em, 'limite_por_hora', a.limite_por_hora,
        'ativada_por', (select coalesce(nullif(p.full_name, ''), split_part(p.email, '@', 1)) from public.profiles p where p.id = a.ativada_por),
        'problema', public.kommo_automacao_problema(a.id, null, null, null, null),
        'feitas_30d', (select count(*) from public.kommo_escritas e where e.automacao = a.id and e.estado = 'ok' and e.criado_em > now() - interval '30 days'),
        'falhas_30d', (select count(*) from public.kommo_escritas e where e.automacao = a.id and e.estado in ('recusada', 'erro', 'enviando') and e.criado_em > now() - interval '30 days')
      ) order by a.id desc)
      from public.kommo_automacoes a where a.id in ('balcao_pedido', 'balcao_lead')
    ), '[]'::jsonb),
    'pedidos_30d', (select count(*) from public.loja_pedidos p where p.criado_em > now() - interval '30 days'),
    'leads_30d', (select count(*) from public.loja_leads l where l.criado_em > now() - interval '30 days')
  ) end
$$;

-- Salva a ligação de UMA loja. Mudar a ligação desliga as duas automações do
-- balcão: o que a diretoria aprovou era a ligação anterior.
create or replace function public.balcao_kommo_salvar(p_loja text, p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu uuid := (select auth.uid());
  v_fp bigint; v_ep bigint; v_fl bigint; v_el bigint; v_resp bigint;
  v_tag text := nullif(btrim(coalesce(p->>'tag', '')), '');
  v_lk text := nullif(btrim(coalesce(p->>'loja_kommo', '')), '');
  v_desligou boolean;
begin
  if not coalesce(public.is_admin(), false) or v_eu is null then
    return jsonb_build_object('ok', false, 'erro', 'sem_acesso');
  end if;
  if char_length(btrim(coalesce(p_loja, ''))) not between 2 and 60 then
    return jsonb_build_object('ok', false, 'erro', 'dados');
  end if;
  begin
    v_fp := nullif(p->>'funil_pedido', '')::bigint; v_ep := nullif(p->>'etapa_pedido', '')::bigint;
    v_fl := nullif(p->>'funil_lead', '')::bigint; v_el := nullif(p->>'etapa_lead', '')::bigint;
    v_resp := nullif(p->>'responsavel_id', '')::bigint;
  exception when others then
    return jsonb_build_object('ok', false, 'erro', 'dados');
  end;
  if v_tag ~ '[—–]' or v_lk ~ '[—–]' then
    return jsonb_build_object('ok', false, 'erro', 'dados');
  end if;
  if v_resp is not null and not exists (select 1 from public.kommo_usuarios u where u.id = v_resp and u.ativo) then
    return jsonb_build_object('ok', false, 'erro', 'responsavel');
  end if;
  if (v_fp is not null or v_ep is not null) and not exists (
    select 1 from public.kommo_etapas e join public.kommo_funis f on f.id = e.funil_id
    where not f.arquivado and e.funil_id = v_fp and e.id = v_ep and e.tipo in ('entrada', 'aberta')
  ) then
    return jsonb_build_object('ok', false, 'erro', 'etapa');
  end if;
  if (v_fl is not null or v_el is not null) and not exists (
    select 1 from public.kommo_etapas e join public.kommo_funis f on f.id = e.funil_id
    where not f.arquivado and e.funil_id = v_fl and e.id = v_el and e.tipo in ('entrada', 'aberta')
  ) then
    return jsonb_build_object('ok', false, 'erro', 'etapa');
  end if;
  insert into public.balcao_kommo (loja, loja_kommo, tag, funil_pedido, etapa_pedido, funil_lead, etapa_lead, responsavel_id, editado_por, editado_em)
  values (btrim(p_loja), v_lk, v_tag, v_fp, v_ep, v_fl, v_el, v_resp, v_eu, now())
  on conflict (loja) do update set
    loja_kommo = excluded.loja_kommo, tag = excluded.tag, funil_pedido = excluded.funil_pedido, etapa_pedido = excluded.etapa_pedido,
    funil_lead = excluded.funil_lead, etapa_lead = excluded.etapa_lead, responsavel_id = excluded.responsavel_id,
    editado_por = excluded.editado_por, editado_em = excluded.editado_em;
  select bool_or(a.ativa) into v_desligou from public.kommo_automacoes a where a.id in ('balcao_pedido', 'balcao_lead');
  update public.kommo_automacoes a set ativa = false where a.id in ('balcao_pedido', 'balcao_lead') and a.ativa;
  return jsonb_build_object('ok', true, 'desligou', coalesce(v_desligou, false));
end
$$;

-- A rodada (só a chave de serviço): o que está pronto para ir à Kommo. Só o
-- que foi salvo DEPOIS de a automação ser ligada, da loja com ligação
-- completa, e que nunca teve escrita. `p_pedido` e `p_lead` pedem um só (o
-- envio na hora, logo depois de salvar).
create or replace function public.balcao_kommo_candidatos(p_pedido uuid default null, p_lead uuid default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with ap as (select * from public.kommo_automacoes a where a.id = 'balcao_pedido' and a.ativa),
       al as (select * from public.kommo_automacoes a where a.id = 'balcao_lead' and a.ativa)
  select jsonb_build_object(
    'automacoes', coalesce((select jsonb_agg(a.id) from public.kommo_automacoes a where a.id in ('balcao_pedido', 'balcao_lead') and a.ativa), '[]'::jsonb),
    'lojas', coalesce((select jsonb_agg(to_jsonb(b)) from public.balcao_kommo b), '[]'::jsonb),
    'pedidos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'numero', p.numero, 'loja', p.loja, 'vendedor', v.nome,
        'cliente_nome', p.cliente_nome, 'cliente_telefone', p.cliente_telefone, 'cliente_email', p.cliente_email,
        'motivo', p.motivo, 'data_especial', p.data_especial, 'origem_cliente', p.origem_cliente,
        'pecas', p.pecas, 'total', p.total, 'entrega_texto', p.entrega_texto, 'prazo', p.prazo, 'observacao', p.observacao,
        'criado_em', p.criado_em,
        'pagamentos', coalesce((
          select jsonb_agg(jsonb_build_object('valor', g.valor, 'forma', g.forma, 'parcelas', g.parcelas) order by g.criado_em)
          from public.loja_pagamentos g where g.pedido = p.id and g.estornado_em is null
        ), '[]'::jsonb)
      ) order by p.criado_em)
      from public.loja_pedidos p
      join public.loja_vendedores v on v.id = p.vendedor
      cross join ap
      where p.cancelado_em is null
        and p.criado_em >= ap.ativada_em
        and p.criado_em <= now() - make_interval(mins => ap.espera_min)
        and (p_pedido is null or p.id = p_pedido)
        and public.balcao_kommo_completa(p.loja, 'pedido')
        and not exists (select 1 from public.kommo_escritas e where e.chave = 'balcao_pedido:' || p.id::text)
        and (p_lead is null or p_pedido is not null)
      limit 40
    ), '[]'::jsonb),
    'leads', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', l.id, 'loja', l.loja, 'vendedor', v.nome,
        'cliente_nome', l.cliente_nome, 'cliente_telefone', l.cliente_telefone,
        'interesse', l.interesse, 'tipo_produto', l.tipo_produto, 'motivo', l.motivo, 'data_especial', l.data_especial,
        'origem_cliente', l.origem_cliente, 'observacao', l.observacao, 'criado_em', l.criado_em
      ) order by l.criado_em)
      from public.loja_leads l
      join public.loja_vendedores v on v.id = l.vendedor
      cross join al
      where l.criado_em >= al.ativada_em
        and l.criado_em <= now() - make_interval(mins => al.espera_min)
        and (p_lead is null or l.id = p_lead)
        and (p_pedido is null or p_lead is not null)
        and public.balcao_kommo_completa(l.loja, 'lead')
        and not exists (select 1 from public.kommo_escritas e where e.chave = 'balcao_lead:' || l.id::text)
      limit 40
    ), '[]'::jsonb)
  )
$$;

-- ------------------------------------------------------------------ o balcão

-- A origem do cliente ("como conheceu"), gravada logo depois de salvar o pedido.
create or replace function public.balcao_definir_origem(p_pedido uuid, p_origem text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_loja text;
begin
  select loja into v_loja from public.loja_pedidos where id = p_pedido;
  if v_loja is null or not public.balcao_pode(v_loja) then
    raise exception 'Pedido não encontrado.' using errcode = '42501';
  end if;
  if p_origem is not null and p_origem not in ('shopping', 'google', 'instagram', 'indicacao', 'recompra', 'whatsapp') then
    raise exception 'Origem desconhecida.' using errcode = '22023';
  end if;
  update public.loja_pedidos set origem_cliente = p_origem where id = p_pedido;
  return jsonb_build_object('ok', true);
end
$$;

-- O lead do balcão: quem visitou e não comprou. `p.id` nasce no navegador; mandar duas vezes não cria dois.
create or replace function public.balcao_salvar_lead(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id   uuid;
  v_loja text := coalesce(public.minha_loja(), nullif(btrim(coalesce(p->>'loja', '')), ''));
  v_vend uuid;
  v_tel  text := public.balcao_telefone(p->>'cliente_telefone');
  v_nome text := regexp_replace(btrim(coalesce(p->>'cliente_nome', '')), '\s+', ' ', 'g');
  v_data date;
begin
  if not coalesce(public.tem_acesso('balcao'), false) then
    raise exception 'Seu acesso não abre o balcão.' using errcode = '42501';
  end if;
  begin
    v_id := (p->>'id')::uuid;
    v_vend := (p->>'vendedor')::uuid;
  exception when others then
    raise exception 'Escolha quem atendeu.' using errcode = '22023';
  end;
  if v_id is null then raise exception 'Lead sem identificação. Recarregue a tela.' using errcode = '22023'; end if;
  if exists (select 1 from public.loja_leads l where l.id = v_id) then
    return jsonb_build_object('ok', true, 'id', v_id, 'repetido', true);
  end if;
  if v_loja is null then raise exception 'Escolha a loja.' using errcode = '22023'; end if;
  if not public.balcao_pode(v_loja) then raise exception 'Esta loja não é a sua.' using errcode = '42501'; end if;
  if v_vend is null or not exists (select 1 from public.loja_vendedores x where x.id = v_vend and x.loja = v_loja and x.ativo) then
    raise exception 'Escolha quem atendeu.' using errcode = '22023';
  end if;
  if char_length(v_nome) not between 2 and 120 then raise exception 'Escreva o nome do cliente.' using errcode = '22023'; end if;
  if v_tel is null then raise exception 'WhatsApp do cliente com DDD.' using errcode = '22023'; end if;
  if coalesce(p->>'interesse', '') ~ '[—–]' or coalesce(p->>'observacao', '') ~ '[—–]' then
    raise exception 'Sem travessão no texto.' using errcode = '22023';
  end if;
  if coalesce(p->>'tipo_produto', '') <> '' and p->>'tipo_produto' not in ('aliancas', 'aneis', 'brinco', 'colares', 'corrente', 'gargantilha', 'pulseira', 'outro') then
    raise exception 'Tipo de produto desconhecido.' using errcode = '22023';
  end if;
  if coalesce(p->>'motivo', '') <> '' and p->>'motivo' not in ('namoro', 'noivado', 'casamento', 'bodas', 'presente', 'outro') then
    raise exception 'Motivo desconhecido.' using errcode = '22023';
  end if;
  if coalesce(p->>'origem_cliente', '') <> '' and p->>'origem_cliente' not in ('shopping', 'google', 'instagram', 'indicacao', 'recompra', 'whatsapp') then
    raise exception 'Origem desconhecida.' using errcode = '22023';
  end if;
  if nullif(p->>'data_especial', '') is not null then v_data := (p->>'data_especial')::date; end if;
  insert into public.loja_leads (id, loja, vendedor, cliente_nome, cliente_telefone, interesse, tipo_produto, motivo, data_especial, origem_cliente, observacao, criado_por)
  values (
    v_id, v_loja, v_vend, v_nome, v_tel,
    nullif(left(btrim(coalesce(p->>'interesse', '')), 300), ''), nullif(p->>'tipo_produto', ''), nullif(p->>'motivo', ''), v_data,
    nullif(p->>'origem_cliente', ''), nullif(left(btrim(coalesce(p->>'observacao', '')), 1000), ''), (select auth.uid())
  );
  return jsonb_build_object('ok', true, 'id', v_id, 'repetido', false);
end
$$;

-- Os leads da loja, com o que aconteceu na Kommo.
create or replace function public.balcao_leads(p_loja text default null, p_dias integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_loja text := coalesce(public.minha_loja(), nullif(btrim(coalesce(p_loja, '')), ''));
begin
  if not coalesce(public.tem_acesso('balcao'), false) then
    raise exception 'Seu acesso não abre o balcão.' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', l.id, 'loja', l.loja, 'vendedor_nome', v.nome, 'cliente_nome', l.cliente_nome, 'cliente_telefone', l.cliente_telefone,
      'interesse', l.interesse, 'tipo_produto', l.tipo_produto, 'motivo', l.motivo, 'data_especial', l.data_especial,
      'origem_cliente', l.origem_cliente, 'observacao', l.observacao, 'criado_em', l.criado_em,
      'kommo', (select jsonb_build_object('estado', e.estado, 'negocio_id', e.negocio_id, 'erro', e.erro) from public.kommo_escritas e where e.chave = 'balcao_lead:' || l.id::text)
    ) order by l.criado_em desc)
    from public.loja_leads l
    join public.loja_vendedores v on v.id = l.vendedor
    where (v_loja is null or l.loja = v_loja)
      and public.balcao_pode(l.loja)
      and l.criado_em > now() - make_interval(days => greatest(least(coalesce(p_dias, 30), 365), 1))
  ), '[]'::jsonb);
end
$$;

create or replace function public.balcao_montar(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  select jsonb_build_object(
    'id', p.id, 'numero', p.numero, 'loja', p.loja,
    'vendedor', p.vendedor, 'vendedor_nome', v.nome,
    'cliente_nome', p.cliente_nome, 'cliente_telefone', p.cliente_telefone, 'cliente_email', p.cliente_email,
    'motivo', p.motivo, 'data_especial', p.data_especial, 'origem_cliente', p.origem_cliente,
    'pecas', p.pecas, 'formulario', p.formulario,
    'entrega', p.entrega, 'entrega_texto', p.entrega_texto, 'endereco', p.endereco, 'cidade', p.cidade, 'uf', p.uf,
    'prazo', p.prazo, 'total', p.total, 'observacao', p.observacao, 'numero_papel', p.numero_papel,
    'fotos', to_jsonb(p.fotos), 'transcricao', p.transcricao,
    'pago', coalesce(pg.pago, 0),
    'fabrica_em', p.fabrica_em, 'recebido_em', p.recebido_em, 'entregue_em', p.entregue_em,
    'cancelado_em', p.cancelado_em, 'cancelado_motivo', p.cancelado_motivo,
    'criado_em', p.criado_em, 'atualizado_em', p.atualizado_em,
    'criado_por_nome', (select nullif(split_part(coalesce(x.full_name, ''), ' ', 1), '') from public.profiles x where x.id = p.criado_por),
    'os', f.os, 'etapa', f.etapa, 'etapa_nome', e.nome, 'etapa_papel', e.papel, 'etapa_em', f.etapa_em, 'rastreio', f.rastreio,
    'ref', case when a.id is null then null else 'a' || a.id::text end,
    'pagamentos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.id, 'valor', g.valor, 'forma', g.forma, 'parcelas', g.parcelas, 'pago_em', g.pago_em,
        'comprovante', g.comprovante, 'criado_em', g.criado_em,
        'estornado_em', g.estornado_em, 'estornado_motivo', g.estornado_motivo
      ) order by g.criado_em)
      from public.loja_pagamentos g where g.pedido = p.id
    ), '[]'::jsonb),
    'kommo', (
      select jsonb_build_object('estado', e.estado, 'negocio_id', e.negocio_id, 'erro', e.erro, 'em', coalesce(e.terminado_em, e.criado_em))
      from public.kommo_escritas e where e.chave = 'balcao_pedido:' || p.id::text
    ),
    'alteracoes', coalesce((
      select jsonb_agg(jsonb_build_object('id', al.id, 'texto', al.texto, 'pedido_em', al.pedido_em, 'ciente_em', al.ciente_em) order by al.pedido_em)
      from public.fabrica_alteracoes al where al.fabrica_id = f.id
    ), '[]'::jsonb),
    'anexos', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'caminho', x.caminho, 'tipo', x.tipo, 'nome', x.nome, 'criado_em', x.criado_em) order by x.criado_em)
      from public.loja_anexos x where x.pedido = p.id and x.tirado_em is null
    ), '[]'::jsonb)
  )
  from public.loja_pedidos p
  join public.loja_vendedores v on v.id = p.vendedor
  left join lateral (select sum(g.valor) as pago from public.loja_pagamentos g where g.pedido = p.id and g.estornado_em is null) pg on true
  left join public.fabrica_avulsos a on a.loja_pedido = p.id
  left join public.fabrica_pedidos f on f.avulso = a.id
  left join public.fabrica_etapas e on e.chave = f.etapa
  where p.id = p_id
$$;

revoke execute on function public.balcao_montar(uuid) from public, anon, authenticated;
revoke execute on function public.balcao_kommo_candidatos(uuid, uuid) from public, anon, authenticated;
grant execute on function public.balcao_kommo_candidatos(uuid, uuid) to service_role;
revoke execute on function public.balcao_kommo_completa(text, text) from public, anon;
do $$
declare f text;
begin
  foreach f in array array[
    'balcao_kommo_config()', 'balcao_kommo_salvar(text, jsonb)', 'balcao_definir_origem(uuid, text)',
    'balcao_salvar_lead(jsonb)', 'balcao_leads(text, integer)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated, service_role', f);
  end loop;
end
$$;
