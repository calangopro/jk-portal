-- 0165: venda ganha na Kommo entra no painel e no ranking (cartão 47, fase 3).
--
-- Quem vende marca a venda na Kommo arrastando o negócio para "Venda ganha"
-- (etapa 142). O painel registra essa venda UMA vez, sem o vendedor lançar de
-- novo em Registrar venda, e sempre pelas portas que já existem:
--   * com "Pedido Tray" que casa com um pedido da loja: `pedido_marcar_vendedor`
--     (o "Fui eu que vendi"), e o ranking de Vendedores anda;
--   * sem pedido: `registrar_venda_avulsa`, com as mesmas travas de duplicidade
--     (`repetida`, `ja_na_loja`, `sem_telefone`). Trava que dispara vai para a
--     conferência da gerência, nunca entra calada;
--   * negócio que sai do ganho: `estornar_venda_avulsa`.
--
-- As portas leem quem está chamando por `auth.uid()`. A rodada roda com a
-- chave de serviço, sem sessão, então ela entra pela porta EM NOME DO
-- VENDEDOR do negócio (`kommo_vendas_entrar_como`), que é quem marcou a venda
-- na Kommo: a porta confere o acesso dele, as travas valem iguais e a
-- marcação fica no nome dele. O que a porta recusar ao vendedor (pedido já
-- marcado para outra pessoa, estorno de venda lançada há mais de um dia) vai
-- para a gerência, que resolve pela tela com a sessão dela.
--
-- A decisão (o que fazer com cada negócio) é a conta pura de
-- `src/lib/kommo/vendas.ts`, com teste. O banco executa e guarda o vínculo.
-- Nada aqui escreve na Kommo nem nas tabelas `kommo_*`.

-- ---------------------------------------------------------------------------
-- O vínculo: um negócio da Kommo, um registro do painel. É a chave que faz o
-- dinheiro contar uma vez só.
-- ---------------------------------------------------------------------------
create table if not exists public.kommo_vendas (
  negocio_id     bigint primary key,
  estado         text not null default 'conferir'
                 check (estado in ('aguardando_pedido', 'conferir', 'marcada', 'registrada', 'desfeita', 'ignorada')),
  motivo         text check (motivo in (
                   'sem_vendedor', 'vendedor_sem_acesso', 'sem_valor', 'servico', 'repetida', 'ja_na_loja',
                   'sem_telefone', 'fora_do_prazo', 'pedido_ambiguo', 'pedido_nao_encontrado', 'pedido_de_outro',
                   'desfeito_marcado', 'desfeito_estorno', 'erro')),
  pedido         bigint,
  venda_id       uuid references public.vendas_avulsas(id),
  marcacao_id    bigint references public.pedidos_vendedor(id),
  vendedor       uuid references public.profiles(id) on delete set null,
  valor          numeric(12, 2),
  dados          jsonb not null default '{}'::jsonb,
  detalhe        jsonb not null default '{}'::jsonb,
  vezes          int not null default 1,
  ganho_em       timestamptz,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  resolvido_por  uuid references public.profiles(id) on delete set null,
  resolvido_em   timestamptz,
  desfeito_em    timestamptz,
  motivo_desfeito text
);
create index if not exists kommo_vendas_estado on public.kommo_vendas (estado);
create index if not exists kommo_vendas_venda on public.kommo_vendas (venda_id) where venda_id is not null;

-- O histórico: o que a rodada e a gerência fizeram com cada negócio.
create table if not exists public.kommo_vendas_movimentos (
  id          bigint generated always as identity primary key,
  negocio_id  bigint not null,
  o_que       text not null,
  por         uuid references public.profiles(id) on delete set null,
  em          timestamptz not null default now(),
  detalhe     jsonb not null default '{}'::jsonb
);
create index if not exists kommo_vendas_movimentos_negocio on public.kommo_vendas_movimentos (negocio_id, em);

-- Desde quando o ganho conta. A carga inicial do espelho traz 90 dias de
-- negócios: sem esta data, toda venda ganha desses 90 dias, já lançada à mão,
-- viraria venda de novo (as travas pegariam parte, não tudo).
create table if not exists public.kommo_vendas_config (
  id     int primary key default 1 check (id = 1),
  desde  timestamptz not null
);
insert into public.kommo_vendas_config (id, desde) values (1, now()) on conflict (id) do nothing;

alter table public.kommo_vendas enable row level security;
alter table public.kommo_vendas_movimentos enable row level security;
alter table public.kommo_vendas_config enable row level security;
revoke all on public.kommo_vendas, public.kommo_vendas_movimentos, public.kommo_vendas_config from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Entrar pela porta em nome do vendedor, e sair. Só as funções desta
-- migration chamam: ninguém de fora executa.
-- ---------------------------------------------------------------------------
create or replace function public.kommo_vendas_entrar_como(p_quem uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_antes jsonb := jsonb_build_object(
    'claims', current_setting('request.jwt.claims', true),
    'sub', current_setting('request.jwt.claim.sub', true)
  );
begin
  perform set_config('request.jwt.claims', jsonb_build_object('sub', p_quem, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', p_quem::text, true);
  return v_antes;
end
$$;

create or replace function public.kommo_vendas_sair(p_antes jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('request.jwt.claims', coalesce(p_antes ->> 'claims', ''), true);
  perform set_config('request.jwt.claim.sub', coalesce(p_antes ->> 'sub', ''), true);
end
$$;

-- ---------------------------------------------------------------------------
-- O que a rodada precisa olhar. Só a chave de serviço.
-- ---------------------------------------------------------------------------
create or replace function public.kommo_vendas_candidatos(p_limite int default 200)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with cfg as (select desde from public.kommo_vendas_config where id = 1),
  base as (
    -- (a) em ganho num funil de venda, desde a data ligada, ainda sem registro ativo.
    -- A expressão do funil de venda é a mesma de `funilDeVenda` (`src/lib/kommo/vendas.ts`).
    select n.id
    from public.kommo_negocios n
    join public.kommo_funis f on f.id = n.funil_id
    left join public.kommo_vendas v on v.negocio_id = n.id
    where not n.apagado and n.etapa_id = 142
      and f.nome ~* '(whats|recupera)' and f.nome !~* '(p[oó]s|sac|pdv)'
      and coalesce(n.fechado_em, n.etapa_desde, n.atualizado_na_kommo) >= (select desde from cfg)
      and (v.negocio_id is null
           or v.estado in ('aguardando_pedido', 'desfeita')
           or (v.estado = 'conferir' and v.motivo in ('sem_vendedor', 'vendedor_sem_acesso', 'sem_valor', 'pedido_ambiguo', 'erro', 'pedido_nao_encontrado')))
    union
    -- (b) o que o painel já registrou ou está esperando: a rodada confere se continua em ganho.
    select v.negocio_id
    from public.kommo_vendas v
    where v.estado in ('marcada', 'registrada', 'aguardando_pedido')
       or (v.estado = 'conferir' and v.motivo not in ('desfeito_marcado', 'desfeito_estorno'))
  )
  select coalesce(jsonb_agg(c order by c ->> 'negocio_id'), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'negocio_id', b.id,
      'nome', n.nome,
      'valor', n.valor,
      'funil', f.nome,
      'etapa_id', n.etapa_id,
      'apagado', coalesce(n.apagado, true),
      'existe', n.id is not null,
      'fechado_em', coalesce(n.fechado_em, n.etapa_desde),
      'pedido_tray', n.pedido_tray,
      'motivo_compra', n.motivo_compra,
      'campos', coalesce(n.campos, '[]'::jsonb),
      'responsavel_id', n.responsavel_id,
      'papel', m.papel,
      'profile_id', m.profile_id,
      'pode_vender', coalesce(public.pedido_pode_vender(m.profile_id), false),
      'estado', v.estado,
      'motivo', v.motivo,
      'ganho_em', v.ganho_em
    ) as c
    from (select id from base limit greatest(1, least(p_limite, 500))) b
    left join public.kommo_negocios n on n.id = b.id
    left join public.kommo_funis f on f.id = n.funil_id
    left join public.kommo_mapa m on m.usuario_id = n.responsavel_id
    left join public.kommo_vendas v on v.negocio_id = b.id
  ) x;
$$;

-- ---------------------------------------------------------------------------
-- Executa a ação que a conta pura decidiu. Só a chave de serviço.
-- p_acao: {tipo: marcar|registrar|conferir|desfazer, vendedor, pedido, motivo, dados{forma, canal, produto}}
-- ---------------------------------------------------------------------------
create or replace function public.kommo_venda_aplicar(p_negocio bigint, p_acao jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tipo     text := p_acao ->> 'tipo';
  v_vendedor uuid := nullif(p_acao ->> 'vendedor', '')::uuid;
  v_pedido   bigint := nullif(p_acao ->> 'pedido', '')::bigint;
  v_dados    jsonb := coalesce(p_acao -> 'dados', '{}'::jsonb);
  v_vinc     public.kommo_vendas;
  v_neg      public.kommo_negocios;
  v_tel      text;
  v_cliente  text;
  v_dia      date;
  v_antes    jsonb;
  v_r        jsonb;
  v_ok       boolean;
  v_marca    bigint;
  v_motivo   text;
begin
  -- Trava o vínculo: duas rodadas ao mesmo tempo (rotina e webhook) não registram duas vezes.
  select * into v_neg from public.kommo_negocios where id = p_negocio;
  insert into public.kommo_vendas (negocio_id, estado, ganho_em)
  values (p_negocio, 'conferir', coalesce(v_neg.fechado_em, v_neg.etapa_desde, now()))
  on conflict (negocio_id) do nothing;
  select * into v_vinc from public.kommo_vendas where negocio_id = p_negocio for update;

  -- Voltou ao ganho depois de desfeito: começa de novo, e o que foi estornado continua estornado.
  if v_vinc.estado = 'desfeita' and v_tipo in ('marcar', 'registrar', 'conferir') then
    update public.kommo_vendas
    set estado = 'conferir', motivo = null, venda_id = null, marcacao_id = null, pedido = null,
        vezes = vezes + 1, ganho_em = coalesce(v_neg.fechado_em, v_neg.etapa_desde, now()), desfeito_em = null, motivo_desfeito = null,
        resolvido_por = null, resolvido_em = null, detalhe = '{}'::jsonb, atualizado_em = now()
    where negocio_id = p_negocio
    returning * into v_vinc;
  end if;

  if v_tipo in ('marcar', 'registrar') and v_vinc.estado in ('marcada', 'registrada', 'ignorada') then
    return jsonb_build_object('ok', true, 'estado', v_vinc.estado, 'ja', true);
  end if;

  if v_tipo = 'conferir' then
    update public.kommo_vendas
    set estado = 'conferir', motivo = p_acao ->> 'motivo', vendedor = v_vendedor, pedido = v_pedido,
        valor = v_neg.valor, dados = v_dados, atualizado_em = now()
    where negocio_id = p_negocio;
    if v_vinc.motivo is distinct from (p_acao ->> 'motivo') then
      insert into public.kommo_vendas_movimentos (negocio_id, o_que, detalhe)
      values (p_negocio, 'conferir', jsonb_build_object('motivo', p_acao ->> 'motivo'));
    end if;
    return jsonb_build_object('ok', true, 'estado', 'conferir', 'motivo', p_acao ->> 'motivo');
  end if;

  if v_tipo = 'marcar' then
    if v_vendedor is null or v_pedido is null then
      return jsonb_build_object('ok', false, 'erro', 'faltou vendedor ou pedido');
    end if;
    if not exists (select 1 from public.tray_pedidos where pedido = v_pedido) then
      -- A loja é lida de dez em dez minutos: espera três dias, depois pede conferência.
      v_motivo := case when v_vinc.ganho_em < now() - interval '3 days' then 'pedido_nao_encontrado' end;
      update public.kommo_vendas
      set estado = case when v_motivo is null then 'aguardando_pedido' else 'conferir' end,
          motivo = v_motivo, vendedor = v_vendedor, pedido = v_pedido, valor = v_neg.valor, dados = v_dados, atualizado_em = now()
      where negocio_id = p_negocio;
      return jsonb_build_object('ok', true, 'estado', case when v_motivo is null then 'aguardando_pedido' else 'conferir' end);
    end if;

    v_antes := public.kommo_vendas_entrar_como(v_vendedor);
    begin
      v_r := public.pedido_marcar_vendedor(v_pedido, v_vendedor);
    exception when others then
      v_r := jsonb_build_object('ok', false, 'erro', sqlerrm);
    end;
    perform public.kommo_vendas_sair(v_antes);

    if coalesce((v_r ->> 'ok')::boolean, false) then
      select pv.id into v_marca from public.pedidos_vendedor pv
      where pv.pedido = v_pedido and pv.vendedor = v_vendedor order by pv.id desc limit 1;
      update public.kommo_vendas
      set estado = 'marcada', motivo = null, vendedor = v_vendedor, pedido = v_pedido, marcacao_id = v_marca,
          valor = (select t.total from public.tray_pedidos t where t.pedido = v_pedido), dados = v_dados,
          detalhe = '{}'::jsonb, atualizado_em = now()
      where negocio_id = p_negocio;
      insert into public.kommo_vendas_movimentos (negocio_id, o_que, detalhe)
      values (p_negocio, 'marcou_pedido', jsonb_build_object('pedido', v_pedido, 'vendedor', v_vendedor));
      return jsonb_build_object('ok', true, 'estado', 'marcada');
    end if;
    update public.kommo_vendas
    set estado = 'conferir', motivo = 'pedido_de_outro', vendedor = v_vendedor, pedido = v_pedido,
        valor = v_neg.valor, dados = v_dados, detalhe = jsonb_build_object('erro', v_r ->> 'erro'), atualizado_em = now()
    where negocio_id = p_negocio;
    insert into public.kommo_vendas_movimentos (negocio_id, o_que, detalhe)
    values (p_negocio, 'conferir', jsonb_build_object('motivo', 'pedido_de_outro', 'erro', v_r ->> 'erro'));
    return jsonb_build_object('ok', true, 'estado', 'conferir', 'motivo', 'pedido_de_outro');
  end if;

  if v_tipo = 'registrar' then
    if v_vendedor is null or coalesce(v_neg.valor, 0) <= 0 then
      return jsonb_build_object('ok', false, 'erro', 'faltou vendedor ou valor');
    end if;
    select c.telefone, c.nome into v_tel, v_cliente from public.kommo_contatos c where c.id = v_neg.contato_id;
    if v_tel !~ '^55[0-9]{10,11}$' then v_tel := null; end if;
    v_dia := (coalesce(v_neg.fechado_em, v_neg.etapa_desde, now()) at time zone 'America/Sao_Paulo')::date;

    v_antes := public.kommo_vendas_entrar_como(v_vendedor);
    begin
      v_r := public.registrar_venda_avulsa(
        p_valor => v_neg.valor,
        p_forma => coalesce(nullif(v_dados ->> 'forma', ''), 'outro'),
        p_canal => coalesce(nullif(v_dados ->> 'canal', ''), 'outro'),
        p_cliente_nome => left(coalesce(v_cliente, v_neg.nome), 160),
        p_telefone => v_tel,
        p_produto => left(nullif(v_dados ->> 'produto', ''), 300),
        p_observacao => 'Venda ganha na Kommo, negócio ' || p_negocio,
        p_dia => v_dia,
        p_vendedor => null,
        p_pedido_recuperado => null,
        p_forcar => false
      );
    exception when others then
      v_r := jsonb_build_object('ok', false, 'motivo', 'erro', 'erro', sqlerrm);
    end;
    perform public.kommo_vendas_sair(v_antes);

    if coalesce((v_r ->> 'ok')::boolean, false) then
      update public.kommo_vendas
      set estado = 'registrada', motivo = null, vendedor = v_vendedor, venda_id = (v_r ->> 'id')::uuid,
          valor = v_neg.valor, dados = v_dados, detalhe = '{}'::jsonb, atualizado_em = now()
      where negocio_id = p_negocio;
      insert into public.kommo_vendas_movimentos (negocio_id, o_que, detalhe)
      values (p_negocio, 'registrou_venda', jsonb_build_object('venda', v_r ->> 'id', 'vendedor', v_vendedor, 'valor', v_neg.valor));
      return jsonb_build_object('ok', true, 'estado', 'registrada');
    end if;
    v_motivo := case v_r ->> 'motivo'
      when 'repetida' then 'repetida'
      when 'ja_na_loja' then 'ja_na_loja'
      when 'sem_telefone' then 'sem_telefone'
      when 'dia' then 'fora_do_prazo'
      when 'sem_acesso' then 'vendedor_sem_acesso'
      when 'valor' then 'sem_valor'
      else 'erro' end;
    update public.kommo_vendas
    set estado = 'conferir', motivo = v_motivo, vendedor = v_vendedor, valor = v_neg.valor, dados = v_dados,
        pedido = case when v_motivo = 'ja_na_loja' then nullif(v_r ->> 'pedido', '')::bigint end,
        detalhe = v_r - 'ok', atualizado_em = now()
    where negocio_id = p_negocio;
    if v_vinc.motivo is distinct from v_motivo then
      insert into public.kommo_vendas_movimentos (negocio_id, o_que, detalhe)
      values (p_negocio, 'conferir', jsonb_build_object('motivo', v_motivo) || (v_r - 'ok'));
    end if;
    return jsonb_build_object('ok', true, 'estado', 'conferir', 'motivo', v_motivo);
  end if;

  if v_tipo = 'desfazer' then
    if v_vinc.estado = 'registrada' then
      v_antes := public.kommo_vendas_entrar_como(v_vinc.vendedor);
      begin
        v_ok := public.estornar_venda_avulsa(v_vinc.venda_id);
      exception when others then
        v_ok := false;
      end;
      perform public.kommo_vendas_sair(v_antes);
      if coalesce(v_ok, false) then
        update public.kommo_vendas
        set estado = 'desfeita', motivo = null, desfeito_em = now(), motivo_desfeito = 'desfeito na Kommo', atualizado_em = now()
        where negocio_id = p_negocio;
        insert into public.kommo_vendas_movimentos (negocio_id, o_que, detalhe)
        values (p_negocio, 'estornou', jsonb_build_object('venda', v_vinc.venda_id, 'motivo', 'desfeito na Kommo'));
        return jsonb_build_object('ok', true, 'estado', 'desfeita');
      end if;
      -- A porta só deixa o vendedor estornar o que lançou hoje ou ontem: o resto é da gerência.
      update public.kommo_vendas
      set estado = 'conferir', motivo = 'desfeito_estorno', atualizado_em = now()
      where negocio_id = p_negocio;
      insert into public.kommo_vendas_movimentos (negocio_id, o_que, detalhe)
      values (p_negocio, 'conferir', jsonb_build_object('motivo', 'desfeito_estorno'));
      return jsonb_build_object('ok', true, 'estado', 'conferir', 'motivo', 'desfeito_estorno');
    end if;
    if v_vinc.estado = 'marcada' then
      -- Não existe porta para desmarcar pedido: o pedido continua pago na loja e a gerência decide de quem é.
      update public.kommo_vendas
      set estado = 'conferir', motivo = 'desfeito_marcado', atualizado_em = now()
      where negocio_id = p_negocio;
      insert into public.kommo_vendas_movimentos (negocio_id, o_que, detalhe)
      values (p_negocio, 'conferir', jsonb_build_object('motivo', 'desfeito_marcado', 'pedido', v_vinc.pedido));
      return jsonb_build_object('ok', true, 'estado', 'conferir', 'motivo', 'desfeito_marcado');
    end if;
    -- Esperando pedido ou conferência: nada entrou, só fecha.
    update public.kommo_vendas
    set estado = 'desfeita', motivo = null, desfeito_em = now(), motivo_desfeito = 'desfeito na Kommo', atualizado_em = now()
    where negocio_id = p_negocio;
    insert into public.kommo_vendas_movimentos (negocio_id, o_que, detalhe)
    values (p_negocio, 'saiu_do_ganho', '{}'::jsonb);
    return jsonb_build_object('ok', true, 'estado', 'desfeita');
  end if;

  return jsonb_build_object('ok', false, 'erro', 'ação desconhecida');
end
$$;

-- ---------------------------------------------------------------------------
-- A tela: vendas que vieram da Kommo e a fila de conferência.
-- Área e régua de valor iguais às de Pedidos do site (0105): abre para
-- `lancar_venda`; o valor só aparece para quem vê o faturamento (`vendas`) ou
-- na venda da própria pessoa.
-- ---------------------------------------------------------------------------
create or replace function public.kommo_vendas_lista(p_de date, p_ate date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_eu      uuid := (select auth.uid());
  v_vendas  boolean := coalesce(public.tem_acesso('vendas'), false);
  v_resolve boolean := coalesce(public.tem_acesso('vendas') and public.tem_acesso('lancar_venda'), false);
begin
  if v_eu is null or not coalesce(public.tem_acesso('lancar_venda'), false) then
    return null;
  end if;
  return (
    with linhas as (
      select v.*, n.nome as negocio_nome, n.pedido_tray, f.nome as funil, n.responsavel_id,
             u.nome as responsavel_nome, c.nome as cliente,
             (coalesce(n.fechado_em, n.etapa_desde, v.ganho_em) at time zone 'America/Sao_Paulo')::date as dia,
             (v_vendas or v.vendedor = v_eu) as ve_valor
      from public.kommo_vendas v
      left join public.kommo_negocios n on n.id = v.negocio_id
      left join public.kommo_funis f on f.id = n.funil_id
      left join public.kommo_usuarios u on u.id = n.responsavel_id
      left join public.kommo_contatos c on c.id = n.contato_id
    ),
    feitas as (
      select l.* from linhas l
      where l.estado in ('marcada', 'registrada', 'desfeita', 'ignorada', 'aguardando_pedido')
        and l.dia between p_de and p_ate
    )
    select jsonb_build_object(
      'pode', jsonb_build_object('resolver', v_resolve, 'ver_valor', v_vendas),
      'vendas', coalesce((
        select jsonb_agg(jsonb_build_object(
          'negocio_id', l.negocio_id, 'negocio', l.negocio_nome, 'cliente', l.cliente, 'funil', l.funil,
          'estado', l.estado, 'pedido', l.pedido, 'dia', l.dia,
          'vendedor_id', l.vendedor, 'vendedor', public.chat_nome(l.vendedor),
          'valor', case when l.ve_valor then l.valor end,
          'motivo_desfeito', l.motivo_desfeito,
          'link', 'https://kathleengfz.kommo.com/leads/detail/' || l.negocio_id
        ) order by l.dia desc, l.negocio_id desc)
        from (select * from feitas order by dia desc limit 300) l
      ), '[]'::jsonb),
      'fila', coalesce((
        select jsonb_agg(jsonb_build_object(
          'negocio_id', l.negocio_id, 'negocio', l.negocio_nome, 'cliente', l.cliente, 'funil', l.funil,
          'motivo', l.motivo, 'pedido', l.pedido, 'pedido_tray', l.pedido_tray, 'dia', l.dia,
          'responsavel', l.responsavel_nome,
          'vendedor_id', l.vendedor, 'vendedor', public.chat_nome(l.vendedor),
          'valor', case when l.ve_valor then l.valor end,
          'erro', l.detalhe ->> 'erro', 'parecida_com', l.detalhe ->> 'parecida_com',
          'tem_venda', l.venda_id is not null,
          'link', 'https://kathleengfz.kommo.com/leads/detail/' || l.negocio_id
        ) order by l.atualizado_em desc)
        from linhas l where l.estado = 'conferir'
      ), '[]'::jsonb),
      'resumo', jsonb_build_object(
        'marcadas', (select count(*) from feitas where estado = 'marcada'),
        'registradas', (select count(*) from feitas where estado = 'registrada'),
        'desfeitas', (select count(*) from feitas where estado = 'desfeita'),
        'esperando_pedido', (select count(*) from linhas where estado = 'aguardando_pedido'),
        'na_fila', (select count(*) from linhas where estado = 'conferir'),
        'valor', case when v_vendas then (select coalesce(sum(valor), 0) from feitas where estado in ('marcada', 'registrada')) end
      ),
      'vendedores', case when v_resolve then coalesce((
        select jsonb_agg(jsonb_build_object('id', p.id, 'nome', p.full_name) order by p.full_name)
        from public.profiles p where public.pedido_pode_vender(p.id)
      ), '[]'::jsonb) else '[]'::jsonb end,
      'desde', (select desde from public.kommo_vendas_config where id = 1)
    )
  );
end
$$;

-- ---------------------------------------------------------------------------
-- A gerência resolve a fila, com a sessão dela, pelas mesmas portas.
-- p_acao: lancar | marcar_pedido | estornar | ignorar
-- ---------------------------------------------------------------------------
create or replace function public.kommo_venda_resolver(p_negocio bigint, p_acao text, p_vendedor uuid default null, p_pedido bigint default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu       uuid := (select auth.uid());
  v_vinc     public.kommo_vendas;
  v_neg      public.kommo_negocios;
  v_vendedor uuid;
  v_pedido   bigint;
  v_tel      text;
  v_cliente  text;
  v_r        jsonb;
  v_ok       boolean;
begin
  if v_eu is null or not coalesce(public.tem_acesso('vendas') and public.tem_acesso('lancar_venda'), false) then
    return jsonb_build_object('ok', false, 'erro', 'Só a gerência e a diretoria resolvem a fila da Kommo.');
  end if;
  select * into v_vinc from public.kommo_vendas where negocio_id = p_negocio for update;
  if not found or v_vinc.estado <> 'conferir' then
    return jsonb_build_object('ok', false, 'erro', 'Esse negócio não está mais na fila.');
  end if;
  select * into v_neg from public.kommo_negocios where id = p_negocio;
  v_vendedor := coalesce(p_vendedor, v_vinc.vendedor);

  if p_acao = 'ignorar' then
    update public.kommo_vendas
    set estado = case when v_vinc.motivo in ('desfeito_marcado', 'desfeito_estorno') then 'desfeita' else 'ignorada' end,
        resolvido_por = v_eu, resolvido_em = now(), atualizado_em = now(),
        desfeito_em = case when v_vinc.motivo in ('desfeito_marcado', 'desfeito_estorno') then now() end,
        motivo_desfeito = case when v_vinc.motivo in ('desfeito_marcado', 'desfeito_estorno') then 'desfeito na Kommo' end
    where negocio_id = p_negocio;
    insert into public.kommo_vendas_movimentos (negocio_id, o_que, por, detalhe)
    values (p_negocio, 'ignorou', v_eu, jsonb_build_object('motivo', v_vinc.motivo));
    return jsonb_build_object('ok', true);
  end if;

  if p_acao = 'estornar' then
    if v_vinc.motivo <> 'desfeito_estorno' or v_vinc.venda_id is null then
      return jsonb_build_object('ok', false, 'erro', 'Não há venda para estornar neste negócio.');
    end if;
    v_ok := public.estornar_venda_avulsa(v_vinc.venda_id);
    if not coalesce(v_ok, false) then
      -- Já estornada por outra porta também resolve.
      if not exists (select 1 from public.vendas_avulsas where id = v_vinc.venda_id and estornada_em is not null) then
        return jsonb_build_object('ok', false, 'erro', 'O estorno não passou.');
      end if;
    end if;
    update public.kommo_vendas
    set estado = 'desfeita', motivo = null, desfeito_em = now(), motivo_desfeito = 'desfeito na Kommo',
        resolvido_por = v_eu, resolvido_em = now(), atualizado_em = now()
    where negocio_id = p_negocio;
    insert into public.kommo_vendas_movimentos (negocio_id, o_que, por, detalhe)
    values (p_negocio, 'estornou', v_eu, jsonb_build_object('venda', v_vinc.venda_id, 'motivo', 'desfeito na Kommo'));
    return jsonb_build_object('ok', true);
  end if;

  -- Lançar e marcar só valem para negócio que continua em ganho.
  if v_neg.id is null or v_neg.apagado or v_neg.etapa_id <> 142 or v_vinc.motivo in ('desfeito_marcado', 'desfeito_estorno') then
    return jsonb_build_object('ok', false, 'erro', 'O negócio não está mais em Venda ganha na Kommo.');
  end if;
  if v_vendedor is null then
    return jsonb_build_object('ok', false, 'erro', 'Escolha o vendedor.');
  end if;

  if p_acao = 'marcar_pedido' then
    v_pedido := coalesce(p_pedido, v_vinc.pedido);
    if v_pedido is null then
      return jsonb_build_object('ok', false, 'erro', 'Diga o número do pedido.');
    end if;
    v_r := public.pedido_marcar_vendedor(v_pedido, v_vendedor);
    if not coalesce((v_r ->> 'ok')::boolean, false) then
      return jsonb_build_object('ok', false, 'erro', coalesce(v_r ->> 'erro', 'Não deu para marcar.'));
    end if;
    update public.kommo_vendas
    set estado = 'marcada', motivo = null, vendedor = v_vendedor, pedido = v_pedido,
        marcacao_id = (select pv.id from public.pedidos_vendedor pv where pv.pedido = v_pedido order by pv.id desc limit 1),
        valor = (select t.total from public.tray_pedidos t where t.pedido = v_pedido),
        resolvido_por = v_eu, resolvido_em = now(), atualizado_em = now()
    where negocio_id = p_negocio;
    insert into public.kommo_vendas_movimentos (negocio_id, o_que, por, detalhe)
    values (p_negocio, 'marcou_pedido', v_eu, jsonb_build_object('pedido', v_pedido, 'vendedor', v_vendedor));
    return jsonb_build_object('ok', true);
  end if;

  if p_acao = 'lancar' then
    if coalesce(v_neg.valor, 0) <= 0 then
      return jsonb_build_object('ok', false, 'erro', 'O negócio está sem valor na Kommo. Preencha o valor lá.');
    end if;
    select c.telefone, c.nome into v_tel, v_cliente from public.kommo_contatos c where c.id = v_neg.contato_id;
    if v_tel !~ '^55[0-9]{10,11}$' then v_tel := null; end if;
    -- A gerência confere e lança mesmo com a trava acesa: a venda entra marcada para conferir, como em Registrar venda.
    v_r := public.registrar_venda_avulsa(
      p_valor => v_neg.valor,
      p_forma => coalesce(nullif(v_vinc.dados ->> 'forma', ''), 'outro'),
      p_canal => coalesce(nullif(v_vinc.dados ->> 'canal', ''), 'outro'),
      p_cliente_nome => left(coalesce(v_cliente, v_neg.nome), 160),
      p_telefone => v_tel,
      p_produto => left(nullif(v_vinc.dados ->> 'produto', ''), 300),
      p_observacao => 'Venda ganha na Kommo, negócio ' || p_negocio,
      p_dia => (coalesce(v_neg.fechado_em, v_neg.etapa_desde, now()) at time zone 'America/Sao_Paulo')::date,
      p_vendedor => v_vendedor,
      p_pedido_recuperado => null,
      p_forcar => true
    );
    if not coalesce((v_r ->> 'ok')::boolean, false) then
      return jsonb_build_object('ok', false, 'erro', case v_r ->> 'motivo'
        when 'dia' then 'A data da venda está fora do prazo que o painel aceita.'
        else 'O painel recusou a venda.' end);
    end if;
    update public.kommo_vendas
    set estado = 'registrada', motivo = null, vendedor = v_vendedor, venda_id = (v_r ->> 'id')::uuid, valor = v_neg.valor,
        resolvido_por = v_eu, resolvido_em = now(), atualizado_em = now()
    where negocio_id = p_negocio;
    insert into public.kommo_vendas_movimentos (negocio_id, o_que, por, detalhe)
    values (p_negocio, 'registrou_venda', v_eu, jsonb_build_object('venda', v_r ->> 'id', 'vendedor', v_vendedor, 'conferir', v_r ->> 'conferir'));
    return jsonb_build_object('ok', true);
  end if;

  return jsonb_build_object('ok', false, 'erro', 'Ação desconhecida.');
end
$$;

revoke execute on function public.kommo_vendas_entrar_como(uuid), public.kommo_vendas_sair(jsonb) from public, anon, authenticated, service_role;
revoke execute on function public.kommo_vendas_candidatos(int), public.kommo_venda_aplicar(bigint, jsonb) from public, anon, authenticated;
grant execute on function public.kommo_vendas_candidatos(int), public.kommo_venda_aplicar(bigint, jsonb) to service_role;
revoke execute on function public.kommo_vendas_lista(date, date), public.kommo_venda_resolver(bigint, text, uuid, bigint) from public, anon;
grant execute on function public.kommo_vendas_lista(date, date), public.kommo_venda_resolver(bigint, text, uuid, bigint) to authenticated;
