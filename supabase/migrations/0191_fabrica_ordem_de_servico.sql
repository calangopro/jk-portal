-- 0191: Fábrica v2, a ordem de serviço (cartão 61).
--
-- Pedido da reunião de 19/11 com o Daniel, dono da fábrica. Quatro coisas:
--
-- 1. AS ETAPAS VIRAM TABELA (`fabrica_etapas`), editáveis pela diretoria e
--    pelo gerente sem publicar código. As chaves antigas continuam valendo e
--    querendo dizer a mesma coisa, porque meia dúzia de funções (chat, suporte,
--    histórico do pedido, venda por fora) olham para elas:
--      a_produzir  "Chegou pedido"  é a ENTRADA (pedido sem linha está aqui)
--      em_producao "Produção"
--      pronto      "Enviar"         feito e conferido, esperando sair
--      enviado     "Enviado"        FINAL, e é para onde vai o pedido que a loja marca como enviado
--    Entram separação, gravação, embalar, verificar e o final "entregue"
--    (desligado até as lojas confirmarem entrega pelo painel, cartão 63).
--    Etapa não se apaga, se desliga, e só desliga vazia.
--
-- 2. CÓDIGO DA ORDEM DE SERVIÇO (`fabrica_pedidos.os`), sequencial, a partir
--    de 1001 para não se confundir com a numeração do sistema do Daniel. Para
--    o código existir desde o primeiro momento, o trabalho ganha linha em
--    `fabrica_pedidos` quando entra: pedido da loja ao ficar pago (gatilho em
--    `tray_pedidos`, só pedido dos últimos 60 dias) e venda por fora ao ir para
--    a produção (gatilho em `vendas_producao`). Até aqui a linha só nascia
--    quando alguém movia. A fila continua sendo conta: o que a esconde ou
--    mostra é a etapa, não a existência da linha.
--
-- 3. TIPO do trabalho (venda nova, troca, refazer, ajuste, upgrade, polimento,
--    serviço) e PRIORIDADE (normal, urgente ou refazer, motoboy).
--
-- 4. PRAZO da loja (`prazo`, a data em que o cliente precisa). A data interna
--    da fábrica é conta, no código (`dataInterna` em `lib/fabrica/etapas.ts`):
--    prazo menos 3 dias corridos, e o próprio prazo em urgente e motoboy. É a
--    regra que o sistema do Daniel aplica de fato.

-- ------------------------------------------------------------------ etapas

create table public.fabrica_etapas (
  chave     text primary key check (chave ~ '^[a-z][a-z0-9_]{1,39}$'),
  nome      text not null check (char_length(btrim(nome)) between 2 and 40),
  frase     text check (char_length(frase) <= 120),
  ordem     integer not null,
  cor       text not null default '#5b6472' check (cor ~ '^#[0-9a-f]{6}$'),
  ativa     boolean not null default true,
  -- entrada: a primeira, onde cai o pedido novo. final: o trabalho saiu da fábrica.
  papel     text not null default 'meio' check (papel in ('entrada', 'meio', 'final')),
  mudou_em  timestamptz not null default now(),
  mudou_por uuid references public.profiles(id) on delete set null
);

comment on table public.fabrica_etapas is
  'Etapas da fila da fábrica, editáveis pelo painel (0191). Chave nunca muda; etapa se desliga, não se apaga.';

alter table public.fabrica_etapas enable row level security;
-- Sem policy: leitura e escrita só pelas funções abaixo.

insert into public.fabrica_etapas (chave, nome, frase, ordem, cor, ativa, papel) values
  ('a_produzir',  'Chegou pedido', 'Pago, esperando a fábrica começar',  10, '#5b6472', true,  'entrada'),
  ('separacao',   'Separação',     'Separando metal, pedras e caixinha',  20, '#1d5fa8', true,  'meio'),
  ('em_producao', 'Produção',      'Na bancada',                          30, '#6a3fb5', true,  'meio'),
  ('gravacao',    'Gravação',      'Gravando o texto do cliente',         40, '#a3540f', true,  'meio'),
  ('embalar',     'Embalar',       'Embalando com o cartão',              50, '#0e6e69', true,  'meio'),
  ('verificar',   'Verificar',     'Conferência final antes de sair',     60, '#a3195b', true,  'meio'),
  ('pronto',      'Enviar',        'Conferido, esperando sair',           70, '#1d6b3a', true,  'meio'),
  ('enviado',     'Enviado',       'Saiu da fábrica',                     80, '#2f3a48', true,  'final'),
  ('entregue',    'Entregue',      'Na mão do cliente',                   90, '#2f3a48', false, 'final');

alter table public.fabrica_pedidos drop constraint fabrica_pedidos_etapa_check;
alter table public.fabrica_movimentos drop constraint fabrica_movimentos_de_check;
alter table public.fabrica_movimentos drop constraint fabrica_movimentos_para_check;

alter table public.fabrica_pedidos
  add constraint fabrica_pedidos_etapa_fkey foreign key (etapa) references public.fabrica_etapas(chave);
alter table public.fabrica_movimentos
  add constraint fabrica_movimentos_de_fkey foreign key (de) references public.fabrica_etapas(chave),
  add constraint fabrica_movimentos_para_fkey foreign key (para) references public.fabrica_etapas(chave);

-- ------------------------------------------------- ordem de serviço, tipo, prazo

create sequence public.fabrica_os_seq start 1001;

alter table public.fabrica_pedidos
  add column os bigint not null default nextval('public.fabrica_os_seq'),
  add column tipo text not null default 'venda_nova'
    check (tipo in ('venda_nova', 'troca', 'refazer', 'ajuste', 'upgrade', 'polimento', 'servico')),
  add column prioridade text not null default 'normal'
    check (prioridade in ('normal', 'urgente', 'motoboy')),
  add column prazo date;

alter sequence public.fabrica_os_seq owned by public.fabrica_pedidos.os;
alter table public.fabrica_pedidos add constraint fabrica_pedidos_os_key unique (os);

comment on column public.fabrica_pedidos.os is 'Código da ordem de serviço da fábrica (0191): o número grande da tela e do envelope.';
comment on column public.fabrica_pedidos.prazo is 'A data em que o cliente precisa da peça. A data interna da fábrica sai dela, no código.';

-- O trabalho entra com linha, e com o código, assim que existe.
create or replace function public.fabrica_entra_pedido_pago()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if new.situacao = 'pago'
     and new.dia > (now() at time zone 'America/Sao_Paulo')::date - 60
     and upper(coalesce(new.status, '')) not in ('ENVIADO', 'FINALIZADO', 'PROBLEMAS NA ENTREGA') then
    insert into public.fabrica_pedidos (pedido, etapa, etapa_em)
    values (new.pedido, 'a_produzir', coalesce(new.feito_em, now()))
    on conflict (pedido) do nothing;
  end if;
  return null;
end
$$;

create trigger fabrica_entra_pedido_pago
  after insert or update of situacao on public.tray_pedidos
  for each row when (new.situacao = 'pago')
  execute function public.fabrica_entra_pedido_pago();

create or replace function public.fabrica_entra_venda()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  insert into public.fabrica_pedidos (venda, etapa, etapa_em)
  values (new.venda, 'a_produzir', now())
  on conflict (venda) do nothing;
  return null;
end
$$;

create trigger fabrica_entra_venda
  after insert on public.vendas_producao
  for each row execute function public.fabrica_entra_venda();

revoke all on function public.fabrica_entra_pedido_pago() from public, anon, authenticated;
revoke all on function public.fabrica_entra_venda() from public, anon, authenticated;

-- O que já está na fila ganha código agora, na ordem em que entrou.
insert into public.fabrica_pedidos (pedido, etapa, etapa_em)
select p.pedido, 'a_produzir', coalesce(p.feito_em, now())
from public.tray_pedidos p
where p.situacao = 'pago'
  and p.dia > (now() at time zone 'America/Sao_Paulo')::date - 60
  and upper(coalesce(p.status, '')) not in ('ENVIADO', 'FINALIZADO', 'PROBLEMAS NA ENTREGA')
  and not exists (select 1 from public.fabrica_pedidos f where f.pedido = p.pedido)
order by p.feito_em, p.pedido;

insert into public.fabrica_pedidos (venda, etapa, etapa_em)
select vp.venda, 'a_produzir', now()
from public.vendas_producao vp
join public.vendas_avulsas v on v.id = vp.venda
where v.estornada_em is null
  and not exists (select 1 from public.fabrica_pedidos f where f.venda = vp.venda)
order by v.feita_em;

-- ------------------------------------------------------------- funções

-- Acha o trabalho pela referência ("11389" ou "v<uuid>"), confere que ele pode
-- estar na fábrica e garante a linha. Devolve o id. Só para as funções daqui.
create or replace function public.fabrica_garantir_linha(p_ref text)
returns bigint
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_pedido bigint;
  v_venda  uuid;
  v_id     bigint;
begin
  if p_ref ~ '^[0-9]{1,12}$' then
    v_pedido := p_ref::bigint;
    if not exists (select 1 from public.tray_pedidos p where p.pedido = v_pedido and p.situacao = 'pago') then
      raise exception 'Só pedido pago entra na fábrica.' using errcode = '22023';
    end if;
  elsif p_ref ~ '^v[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    v_venda := substr(p_ref, 2)::uuid;
    -- Venda estornada só continua quando veio da Kommo e a fábrica já tinha começado (0176).
    if not exists (
      select 1 from public.vendas_producao vp join public.vendas_avulsas v on v.id = vp.venda
      where vp.venda = v_venda
        and (v.estornada_em is null
             or (exists (select 1 from public.fabrica_kommo fk where fk.venda = v_venda)
                 and exists (select 1 from public.fabrica_pedidos f where f.venda = v_venda and f.etapa <> 'a_produzir')))
    ) then
      raise exception 'Esta venda não está na fábrica.' using errcode = '22023';
    end if;
  else
    raise exception 'Pedido desconhecido.' using errcode = '22023';
  end if;

  select f.id into v_id from public.fabrica_pedidos f
  where (v_pedido is not null and f.pedido = v_pedido) or (v_venda is not null and f.venda = v_venda);

  if v_id is null then
    insert into public.fabrica_pedidos (pedido, venda, etapa, etapa_em)
    values (v_pedido, v_venda, 'a_produzir', now())
    returning id into v_id;
  end if;
  return v_id;
end
$$;

revoke all on function public.fabrica_garantir_linha(text) from public, anon, authenticated;

create or replace function public.mover_na_fabrica(p_ref text, p_etapa text, p_rastreio text default null, p_nota text default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_quem uuid := (select auth.uid());
  v_id   bigint;
  v_de   text;
  v_linha public.fabrica_pedidos;
begin
  if not coalesce(public.tem_acesso('fabrica'), false) then
    raise exception 'Seu acesso não inclui a fábrica.' using errcode = '42501';
  end if;
  if p_etapa is null or not exists (select 1 from public.fabrica_etapas e where e.chave = p_etapa and e.ativa) then
    raise exception 'Etapa desconhecida.' using errcode = '22023';
  end if;
  if char_length(coalesce(p_rastreio, '')) > 80 or char_length(coalesce(p_nota, '')) > 500 then
    raise exception 'Texto longo demais.' using errcode = '22023';
  end if;

  v_id := public.fabrica_garantir_linha(p_ref);
  select f.etapa into v_de from public.fabrica_pedidos f where f.id = v_id;

  update public.fabrica_pedidos f set
    etapa = p_etapa,
    etapa_em = case when f.etapa is distinct from p_etapa then now() else f.etapa_em end,
    rastreio = case when p_rastreio is null then f.rastreio else nullif(btrim(p_rastreio), '') end,
    nota = case when p_nota is null then f.nota else nullif(btrim(p_nota), '') end,
    atualizado_por = v_quem
  where f.id = v_id
  returning * into v_linha;

  if v_de is distinct from p_etapa then
    insert into public.fabrica_movimentos (pedido, venda, de, para, por)
    values (v_linha.pedido, v_linha.venda, v_de, p_etapa, v_quem);
  end if;

  return jsonb_build_object('ok', true, 'de', v_de, 'para', p_etapa, 'os', v_linha.os);
end
$$;

create or replace function public.mover_varios_na_fabrica(p_refs text[], p_etapa text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_ref     text;
  v_movidos integer := 0;
  v_fora    text[] := '{}';
begin
  if not coalesce(public.tem_acesso('fabrica'), false) then
    raise exception 'Seu acesso não inclui a fábrica.' using errcode = '42501';
  end if;
  if p_etapa is null or not exists (select 1 from public.fabrica_etapas e where e.chave = p_etapa and e.ativa) then
    raise exception 'Etapa desconhecida.' using errcode = '22023';
  end if;
  if coalesce(array_length(p_refs, 1), 0) = 0 or array_length(p_refs, 1) > 200 then
    raise exception 'Escolha de 1 a 200 pedidos por vez.' using errcode = '22023';
  end if;

  for v_ref in select distinct x from unnest(p_refs) as t(x) where x is not null loop
    begin
      perform public.mover_na_fabrica(v_ref, p_etapa);
      v_movidos := v_movidos + 1;
    exception when sqlstate '22023' then
      v_fora := v_fora || v_ref;
    end;
  end loop;

  return jsonb_build_object('ok', true, 'movidos', v_movidos, 'fora', to_jsonb(v_fora));
end
$$;

-- Tipo, prioridade e prazo de um trabalho. Parâmetro nulo não mexe;
-- `p_sem_prazo` apaga o prazo.
create or replace function public.fabrica_marcar(
  p_ref text, p_tipo text default null, p_prioridade text default null, p_prazo date default null, p_sem_prazo boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_id    bigint;
  v_linha public.fabrica_pedidos;
begin
  if not coalesce(public.tem_acesso('fabrica'), false) then
    raise exception 'Seu acesso não inclui a fábrica.' using errcode = '42501';
  end if;
  if p_tipo is not null and p_tipo not in ('venda_nova', 'troca', 'refazer', 'ajuste', 'upgrade', 'polimento', 'servico') then
    raise exception 'Tipo de trabalho desconhecido.' using errcode = '22023';
  end if;
  if p_prioridade is not null and p_prioridade not in ('normal', 'urgente', 'motoboy') then
    raise exception 'Prioridade desconhecida.' using errcode = '22023';
  end if;
  if p_prazo is not null and (p_prazo < (now() at time zone 'America/Sao_Paulo')::date - 60
                              or p_prazo > (now() at time zone 'America/Sao_Paulo')::date + 365) then
    raise exception 'Prazo fora do razoável.' using errcode = '22023';
  end if;

  v_id := public.fabrica_garantir_linha(p_ref);
  update public.fabrica_pedidos f set
    tipo = coalesce(p_tipo, f.tipo),
    prioridade = coalesce(p_prioridade, f.prioridade),
    prazo = case when coalesce(p_sem_prazo, false) then null else coalesce(p_prazo, f.prazo) end,
    atualizado_por = (select auth.uid())
  where f.id = v_id
  returning * into v_linha;

  return jsonb_build_object('ok', true, 'os', v_linha.os, 'tipo', v_linha.tipo, 'prioridade', v_linha.prioridade, 'prazo', v_linha.prazo);
end
$$;

-- As etapas, para quem vê a fábrica ou pedido em alguma tela.
create or replace function public.fabrica_etapas_lista()
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  select case when coalesce(public.tem_acesso('fabrica') or public.tem_acesso('lancar_venda') or public.tem_acesso('vendas')
                            or public.tem_acesso('suporte') or public.tem_acesso('recuperacao'), false)
    then coalesce((
      select jsonb_agg(jsonb_build_object(
        'chave', e.chave, 'nome', e.nome, 'frase', e.frase, 'cor', e.cor, 'ativa', e.ativa, 'papel', e.papel,
        'trabalhos', (select count(*) from public.fabrica_pedidos f where f.etapa = e.chave)
      ) order by e.ordem)
      from public.fabrica_etapas e
    ), '[]'::jsonb)
    else null end
$$;

-- Salva a lista inteira de etapas, na ordem. Diretoria e gerente.
-- Cada item: { chave?, nome, frase?, cor?, ativa }. Item sem chave é etapa nova.
create or replace function public.fabrica_etapas_salvar(p_etapas jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_quem   uuid := (select auth.uid());
  v_item   jsonb;
  v_i      integer := 0;
  v_chave  text;
  v_nome   text;
  v_papel  text;
  v_ativa  boolean;
  v_cor    text;
  v_vistas text[] := '{}';
  v_viu_meio boolean := false;
  v_viu_final boolean := false;
  v_n      integer;
begin
  if not coalesce(public.tem_acesso('fabrica'), false)
     or not coalesce(public.is_admin() or exists (
       select 1 from public.profiles p where p.id = v_quem and p.is_active and p.role::text = 'gerente'
     ), false) then
    raise exception 'Só a diretoria e o gerente mudam as etapas.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_etapas) is distinct from 'array' or jsonb_array_length(p_etapas) not between 2 and 20 then
    raise exception 'Mande de 2 a 20 etapas.' using errcode = '22023';
  end if;

  for v_item in select x from jsonb_array_elements(p_etapas) as t(x) loop
    v_i := v_i + 1;
    v_nome := btrim(coalesce(v_item->>'nome', ''));
    if char_length(v_nome) not between 2 and 40 then
      raise exception 'Toda etapa precisa de um nome de 2 a 40 letras.' using errcode = '22023';
    end if;
    if v_nome ~ '[—–]' then
      raise exception 'Sem travessão no nome da etapa.' using errcode = '22023';
    end if;
    v_ativa := coalesce((v_item->>'ativa')::boolean, true);
    v_cor := lower(coalesce(nullif(v_item->>'cor', ''), '#5b6472'));
    if v_cor !~ '^#[0-9a-f]{6}$' then
      raise exception 'Cor inválida na etapa %.', v_nome using errcode = '22023';
    end if;

    v_chave := nullif(v_item->>'chave', '');
    if v_chave is null then
      -- Etapa nova: a chave sai do nome e nunca mais muda.
      v_chave := left(btrim(regexp_replace(lower(extensions.unaccent('extensions.unaccent'::regdictionary, v_nome)), '[^a-z0-9]+', '_', 'g'), '_'), 36);
      if v_chave !~ '^[a-z]' then v_chave := 'etapa_' || v_chave; end if;
      v_n := 1;
      while exists (select 1 from public.fabrica_etapas e where e.chave = v_chave) or v_chave = any(v_vistas) loop
        v_n := v_n + 1;
        v_chave := left(v_chave, 36) || '_' || v_n;
      end loop;
      v_papel := 'meio';
      insert into public.fabrica_etapas (chave, nome, ordem, papel) values (v_chave, v_nome, v_i * 10, 'meio');
    else
      select e.papel into v_papel from public.fabrica_etapas e where e.chave = v_chave;
      if v_papel is null then
        raise exception 'Etapa desconhecida: %.', v_chave using errcode = '22023';
      end if;
    end if;
    if v_chave = any(v_vistas) then
      raise exception 'A etapa % veio duas vezes.', v_nome using errcode = '22023';
    end if;
    v_vistas := v_vistas || v_chave;

    -- A entrada vem primeiro, as finais por último, e as duas fixas não desligam.
    if v_papel = 'entrada' and v_i <> 1 then
      raise exception 'A etapa de entrada (%) precisa ser a primeira.', v_nome using errcode = '22023';
    end if;
    if v_papel = 'meio' then
      if v_viu_final then
        raise exception 'A etapa % não pode vir depois das etapas finais.', v_nome using errcode = '22023';
      end if;
      v_viu_meio := true;
    end if;
    if v_papel = 'final' then v_viu_final := true; end if;
    if not v_ativa and v_chave in ('a_produzir', 'enviado') then
      raise exception 'A etapa % não se desliga: é por onde o pedido entra ou sai.', v_nome using errcode = '22023';
    end if;
    if not v_ativa and v_papel <> 'final' then
      select count(*) into v_n from public.fabrica_pedidos f where f.etapa = v_chave;
      if v_n > 0 then
        raise exception 'A etapa % tem % trabalho(s). Mova antes de desligar.', v_nome, v_n using errcode = '22023';
      end if;
    end if;

    update public.fabrica_etapas e set
      nome = v_nome,
      frase = nullif(btrim(coalesce(v_item->>'frase', '')), ''),
      cor = v_cor,
      ativa = v_ativa,
      ordem = v_i * 10,
      mudou_em = case when (e.nome, coalesce(e.frase, ''), e.cor, e.ativa, e.ordem)
                         is distinct from (v_nome, btrim(coalesce(v_item->>'frase', '')), v_cor, v_ativa, v_i * 10)
                      then now() else e.mudou_em end,
      mudou_por = v_quem
    where e.chave = v_chave;
  end loop;

  if exists (select 1 from public.fabrica_etapas e where not (e.chave = any(v_vistas))) then
    raise exception 'Faltou etapa na lista. Etapa não se apaga, se desliga.' using errcode = '22023';
  end if;
  if not v_viu_meio then
    raise exception 'A fila precisa de pelo menos uma etapa entre a entrada e a saída.' using errcode = '22023';
  end if;

  return public.fabrica_etapas_lista();
end
$$;

-- O nome que o chat, o suporte e o histórico mostram: etapa final que a fábrica
-- marcou vale mais do que o status da loja.
create or replace function public.chat_etapa_do_pedido(p_situacao text, p_status text, p_etapa text)
returns text
language sql
immutable
set search_path to ''
as $$
  select case
    when p_situacao is distinct from 'pago' then null
    when p_etapa in ('enviado', 'entregue') then p_etapa
    when upper(coalesce(p_status, '')) in ('ENVIADO', 'FINALIZADO', 'PROBLEMAS NA ENTREGA') then 'enviado'
    else coalesce(p_etapa, 'a_produzir') end
$$;

create or replace function public.fila_da_fabrica(p_dias integer default 15)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  with pode as (select coalesce(public.tem_acesso('fabrica'), false) as sim),
  dias as (select greatest(least(p_dias, 120), 1) as n, (now() at time zone 'America/Sao_Paulo')::date as hoje),
  finais as (select e.chave from public.fabrica_etapas e where e.papel = 'final'),
  -- Fora da janela, só fica o que a fábrica já pegou: nem na entrada, nem fora.
  pegou as (select chave from finais union all select 'a_produzir'),
  da_loja as (
    select
      p.pedido::text as ref, 'loja'::text as origem, p.pedido, p.dia, p.feito_em, p.status as status_da_loja,
      p.cliente_nome as cliente, p.cidade, p.uf, p.frete_tipo as entrega, null::text as endereco, null::text as vendedor,
      p.envio_codigo, p.itens,
      f.os, f.tipo, f.prioridade, f.prazo,
      f.etapa_em, f.rastreio, f.nota, f.atualizado_por,
      case
        when f.etapa in (select chave from finais) then f.etapa
        when upper(coalesce(p.status, '')) in ('ENVIADO', 'FINALIZADO', 'PROBLEMAS NA ENTREGA') then 'enviado'
        else coalesce(f.etapa, 'a_produzir')
      end as etapa,
      null::bigint as kommo, false as desfeito
    from public.tray_pedidos p
    left join public.fabrica_pedidos f on f.pedido = p.pedido
    cross join dias d
    where (select sim from pode)
      and p.situacao = 'pago'
      and (p.dia > d.hoje - d.n or (f.etapa is not null and f.etapa not in (select chave from pegou)))
  ),
  por_fora as (
    select
      'v' || v.id::text as ref, 'por_fora'::text as origem, null::bigint as pedido, v.dia, v.feita_em as feito_em, null::text as status_da_loja,
      v.cliente_nome as cliente, vp.cidade, vp.uf, vp.entrega, vp.endereco,
      (select nullif(split_part(coalesce(x.full_name, ''), ' ', 1), '') from public.profiles x where x.id = v.vendedor_id) as vendedor,
      null::text as envio_codigo, vp.pecas as itens,
      f.os, f.tipo, f.prioridade, f.prazo,
      f.etapa_em, f.rastreio, f.nota, f.atualizado_por,
      coalesce(f.etapa, 'a_produzir') as etapa,
      fk.negocio_id as kommo,
      (fk.venda is not null and (
        v.estornada_em is not null
        or exists (select 1 from public.kommo_vendas kv
                   where kv.venda_id = v.id and (kv.estado = 'desfeita' or kv.motivo in ('desfeito_estorno', 'desfeito_marcado')))
      )) as desfeito
    from public.vendas_producao vp
    join public.vendas_avulsas v on v.id = vp.venda
    left join public.fabrica_pedidos f on f.venda = v.id
    left join public.fabrica_kommo fk on fk.venda = v.id
    cross join dias d
    where (select sim from pode)
      and (v.estornada_em is null
           or (fk.venda is not null and f.etapa is not null and f.etapa not in (select chave from pegou)))
      and (v.dia > d.hoje - d.n or (f.etapa is not null and f.etapa not in (select chave from pegou)))
  ),
  janela as (select * from da_loja union all select * from por_fora),
  -- O que entrou só por ter linha antiga e já saiu não precisa aparecer.
  visiveis as (
    select j.* from janela j cross join dias d
    where j.etapa not in (select chave from finais) or j.dia > d.hoje - d.n
  ),
  pronto as (
    select
      v.*,
      (select coalesce(jsonb_agg(jsonb_build_object(
          'nome', i->>'nome',
          'quantidade', i->>'quantidade',
          'referencia', i->>'referencia',
          'info', i->>'info',
          'produto', i->>'produto_tray_id',
          'foto', (select pr.main_image_url from public.products pr where pr.tray_id = i->>'produto_tray_id')
        )), '[]'::jsonb)
       from jsonb_array_elements(case when jsonb_typeof(v.itens) = 'array' then v.itens else '[]'::jsonb end) i) as pecas,
      (select pr.full_name from public.profiles pr where pr.id = v.atualizado_por) as movido_por
    from visiveis v
  )
  select jsonb_build_object(
    'dias', (select n from dias),
    'etapas', case when (select sim from pode) then (
      select coalesce(jsonb_agg(jsonb_build_object(
        'chave', e.chave, 'nome', e.nome, 'frase', e.frase, 'cor', e.cor, 'ativa', e.ativa, 'papel', e.papel
      ) order by e.ordem), '[]'::jsonb) from public.fabrica_etapas e) else '[]'::jsonb end,
    'pedidos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'ref', ref,
        'origem', origem,
        'pedido', pedido,
        'os', os,
        'tipo', coalesce(tipo, 'venda_nova'),
        'prioridade', coalesce(prioridade, 'normal'),
        'prazo', prazo,
        'dia', dia,
        'feito_em', feito_em,
        'status_da_loja', status_da_loja,
        'etapa', etapa,
        'etapa_em', etapa_em,
        'movido_por', movido_por,
        'cliente', cliente,
        'cidade', cidade,
        'uf', uf,
        'entrega', entrega,
        'endereco', endereco,
        'vendedor', vendedor,
        'rastreio', coalesce(nullif(rastreio, ''), nullif(envio_codigo, '')),
        'nota', nota,
        'pecas', pecas,
        'kommo', kommo,
        'desfeito_na_kommo', desfeito
      ) order by feito_em)
      from pronto
    ), '[]'::jsonb)
  )
$$;

revoke all on function public.mover_na_fabrica(text, text, text, text) from public, anon;
revoke all on function public.mover_varios_na_fabrica(text[], text) from public, anon;
revoke all on function public.fabrica_marcar(text, text, text, date, boolean) from public, anon;
revoke all on function public.fabrica_etapas_lista() from public, anon;
revoke all on function public.fabrica_etapas_salvar(jsonb) from public, anon;
revoke all on function public.fila_da_fabrica(integer) from public, anon;
grant execute on function public.mover_na_fabrica(text, text, text, text) to authenticated;
grant execute on function public.mover_varios_na_fabrica(text[], text) to authenticated;
grant execute on function public.fabrica_marcar(text, text, text, date, boolean) to authenticated;
grant execute on function public.fabrica_etapas_lista() to authenticated;
grant execute on function public.fabrica_etapas_salvar(jsonb) to authenticated;
grant execute on function public.fila_da_fabrica(integer) to authenticated;
