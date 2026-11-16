-- 0102: suporte pós-venda. O vendedor passa o caso para o gerente.
--
-- De onde veio: áudio do Thiago (vendedor) em 16/11/2026: "a gente perde
-- muito tempo resolvendo B.O.zinho ('caiu tal pedrinha'), e eu tenho que
-- ficar perguntando pro Carlos pra depois responder. Seria ideal transferir
-- essas mensagens de suporte direto pra ele, e você fica só com as vendas."
-- O dono do projeto pediu para aplicar, no painel e não pela Kommo.
--
-- COMO FOI DESENHADO:
--
-- 1. É uma PASSAGEM, não um chamado. O caso troca de dono: o vendedor entrega
--    o cliente ao suporte e sai. Não existe conversa dentro do caso (quem
--    precisa perguntar alguma coisa usa o chat do time); existe um dono, um
--    relógio e uma nota de fechamento, que é o que o vendedor lê. Os chamados
--    entre setores (0072) foram tirados na 0080 por serem pesados; este é
--    outro bicho, de quatro estados e um formulário de uma tela.
--
-- 2. Estados: na_fila (ninguém pegou, o relógio corre) -> com_suporte (alguém
--    assumiu) -> resolvido ou devolvido (com a nota). Devolvido é "isso não é
--    suporte, é venda": o caso volta ao vendedor com o motivo.
--
-- 3. Quem abre: quem tem a área `lancar_venda` (vendas, gerente, GM, dono e
--    administrador), a mesma que já vê a ficha do cliente. Quem atende: a área
--    NOVA `suporte`, que nasce com gerente, dono, GM e administrador. Mudar
--    quem atende é mudar uma linha em `acessos_por_papel`, sem publicar
--    código. O vendedor vê os casos que ele passou; o suporte vê todos.
--
-- 4. O cliente vai junto, para o gerente não perguntar de novo: o pedido da
--    loja (ou a venda por fora) ou o telefone, o que o cliente disse e até
--    quatro prints. Do pedido saem o nome, o telefone e a etapa da fábrica. O
--    telefone fica gravado (sem ele não há como chamar o cliente), numa
--    tabela que ninguém lê direto.
--
-- 5. Ninguém lê nem grava direto (RLS ligada, sem policy). Tudo é função
--    `security definer` com a conferência da área por dentro, sempre em
--    `coalesce(..., false)`: comparação com NULL dentro de `if not (...)`
--    deixa passar (armadilha paga na 0072).
--
-- 6. Os prints moram no bucket privado do chat (`chamados`), na pasta de
--    quem envia, como os do chat. O link assinado sai pelo servidor, depois de
--    `suporte_imagens` devolver o caminho para a sessão de quem pediu.
--
-- 7. O que o painel NÃO faz: não manda mensagem ao cliente (só o link
--    `wa.me`) e não mexe na Kommo. Trocar o dono da conversa na Kommo é a
--    fase 2, que depende da chave da Kommo e de decidir o funil.

-- ------------------------------------------------------------------ a área

-- A trava de áreas é refeita a partir da que está no banco na hora, com
-- `suporte` acrescentada: outra frente pode ter acrescentado área entre a
-- escrita deste arquivo e a aplicação dele.
do $$
declare
  v_def text;
  v_areas text[];
begin
  select pg_get_constraintdef(c.oid) into v_def
  from pg_constraint c
  where c.conname = 'acessos_por_papel_area_check' and c.conrelid = 'public.acessos_por_papel'::regclass;
  select array_agg(t.m[1] order by t.n) into v_areas
  from regexp_matches(v_def, '''([a-z_]+)''', 'g') with ordinality as t (m, n);
  if v_areas is null or cardinality(v_areas) < 10 then
    raise exception 'A trava de áreas não foi lida como esperado: %', v_def;
  end if;
  if not ('suporte' = any (v_areas)) then
    v_areas := v_areas || 'suporte'::text;
  end if;
  alter table public.acessos_por_papel drop constraint acessos_por_papel_area_check;
  -- `area in (...)`, como as outras migrations escrevem, para a trava sair no mesmo formato de sempre.
  execute format('alter table public.acessos_por_papel add constraint acessos_por_papel_area_check check (area in (%s))',
    (select string_agg(quote_literal(a), ', ' order by n) from unnest(v_areas) with ordinality as u (a, n)));
end
$$;

insert into public.acessos_por_papel (papel, area)
select p, 'suporte' from unnest(array['admin', 'dono', 'gm', 'gerente']) as p
on conflict do nothing;

-- ---------------------------------------------------------------- as tabelas

create table public.suporte_casos (
  id bigint generated always as identity primary key,
  assunto text not null check (assunto in ('pedra', 'ajuste', 'troca', 'defeito', 'atraso', 'gravacao', 'cancelamento', 'outro')),
  relato text not null check (char_length(relato) between 5 and 2000),
  urgente boolean not null default false,
  -- O cliente: o pedido da loja, a venda por fora ou o telefone (pelo menos um).
  pedido bigint,
  venda uuid,
  cliente_nome text check (cliente_nome is null or char_length(cliente_nome) <= 120),
  cliente_telefone text check (cliente_telefone is null or cliente_telefone ~ '^55[0-9]{10,11}$'),
  imagens text[] not null default '{}' check (cardinality(imagens) <= 4),
  estado text not null default 'na_fila' check (estado in ('na_fila', 'com_suporte', 'resolvido', 'devolvido')),
  aberto_por uuid not null references public.profiles (id),
  aberto_em timestamptz not null default now(),
  assumido_por uuid references public.profiles (id),
  assumido_em timestamptz,
  fechado_por uuid references public.profiles (id),
  fechado_em timestamptz,
  -- O que foi feito (resolvido) ou por que voltou (devolvido). É o que o vendedor lê.
  nota text check (nota is null or char_length(nota) <= 1000),
  na_biblioteca uuid references public.biblioteca_respostas (id),
  -- Quando quem passou o caso viu o fechamento. Nulo e fechado é novidade para ele.
  visto_pelo_vendedor_em timestamptz,
  mudou_em timestamptz not null default now(),
  constraint suporte_casos_tem_cliente check (pedido is not null or venda is not null or cliente_telefone is not null),
  constraint suporte_casos_fechado_tem_nota check (estado in ('na_fila', 'com_suporte') or (fechado_em is not null and nota is not null))
);

create index suporte_casos_abertos on public.suporte_casos (aberto_em) where estado in ('na_fila', 'com_suporte');
create index suporte_casos_de_quem on public.suporte_casos (aberto_por, fechado_em desc);

-- Quem mexeu e quando. Abrir, assumir, fechar: uma linha cada.
create table public.suporte_movimentos (
  id bigint generated always as identity primary key,
  caso bigint not null references public.suporte_casos (id),
  quem uuid references public.profiles (id),
  em timestamptz not null default now(),
  de text,
  para text not null,
  nota text
);
create index suporte_movimentos_do_caso on public.suporte_movimentos (caso, em);

alter table public.suporte_casos enable row level security;
alter table public.suporte_movimentos enable row level security;
revoke all on public.suporte_casos from anon, authenticated;
revoke all on public.suporte_movimentos from anon, authenticated;

-- ------------------------------------------------------------ as peças de dentro

/** O telefone só com dígitos e com o 55 na frente, ou nulo quando não dá para ser telefone. É o formato dos pedidos da loja. */
create or replace function public.suporte_telefone(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when d ~ '^[0-9]{10,11}$' then '55' || d
    when d ~ '^55[0-9]{10,11}$' then d
  end
  from (select regexp_replace(coalesce(p, ''), '\D', '', 'g') as d) x;
$$;

create or replace function public.suporte_nome_do_assunto(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p
    when 'pedra' then 'Caiu a pedra'
    when 'ajuste' then 'Ajuste de tamanho'
    when 'troca' then 'Troca'
    when 'defeito' then 'Defeito ou garantia'
    when 'atraso' then 'Atraso ou rastreio'
    when 'gravacao' then 'Gravação errada'
    when 'cancelamento' then 'Cancelamento'
    else 'Outro assunto'
  end;
$$;

/** O caso como a tela recebe. Só é chamado por funções que já conferiram quem pode ver este caso. */
create or replace function public.suporte_caso_json(c public.suporte_casos)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', c.id,
    'assunto', c.assunto,
    'relato', c.relato,
    'urgente', c.urgente,
    'estado', c.estado,
    'aberto_em', c.aberto_em,
    'aberto_por', c.aberto_por,
    'aberto_por_nome', public.chat_nome(c.aberto_por),
    'assumido_por', c.assumido_por,
    'assumido_por_nome', public.chat_nome(c.assumido_por),
    'assumido_em', c.assumido_em,
    'fechado_por_nome', public.chat_nome(c.fechado_por),
    'fechado_em', c.fechado_em,
    'nota', c.nota,
    'imagens', cardinality(c.imagens),
    'na_biblioteca', c.na_biblioteca,
    'visto', c.visto_pelo_vendedor_em is not null,
    'mudou_em', c.mudou_em,
    'cliente', jsonb_build_object(
      'nome', coalesce(c.cliente_nome, t.cliente_nome, v.cliente_nome),
      'telefone', coalesce(c.cliente_telefone, public.suporte_telefone(t.cliente_telefone), public.suporte_telefone(v.cliente_telefone)),
      'pedido', c.pedido,
      -- A ficha do cliente abre por referência, nunca pelo telefone no endereço.
      'ref', case
        when c.pedido is not null then 'p' || c.pedido
        when c.venda is not null then 'v' || c.venda
        else (select 'p' || t2.pedido from public.tray_pedidos t2 where t2.cliente_telefone = c.cliente_telefone order by t2.pedido desc limit 1)
      end,
      'situacao', t.situacao,
      'etapa', case when t.pedido is not null
        then public.chat_etapa_do_pedido(t.situacao, t.status, (select f.etapa from public.fabrica_pedidos f where f.pedido = t.pedido limit 1)) end
    )
  )
  from (select 1) as um
  left join public.tray_pedidos t on t.pedido = c.pedido
  left join public.vendas_avulsas v on v.id = c.venda;
$$;

-- ------------------------------------------------------------- abrir o caso

create or replace function public.suporte_abrir(
  p_assunto text,
  p_relato text,
  p_ref text default null,
  p_nome text default null,
  p_telefone text default null,
  p_urgente boolean default false,
  p_imagens text[] default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quem uuid := (select auth.uid());
  v_relato text := btrim(coalesce(p_relato, ''));
  v_nome text := nullif(btrim(coalesce(p_nome, '')), '');
  v_ref text := btrim(coalesce(p_ref, ''));
  v_imagens text[] := coalesce(p_imagens, '{}');
  v_pedido bigint;
  v_venda uuid;
  v_tel text;
  v_id bigint;
begin
  if not coalesce(public.tem_acesso('lancar_venda'), false) then
    return jsonb_build_object('ok', false, 'erro', 'O seu acesso não passa caso para o suporte.');
  end if;
  if p_assunto is null or p_assunto not in ('pedra', 'ajuste', 'troca', 'defeito', 'atraso', 'gravacao', 'cancelamento', 'outro') then
    return jsonb_build_object('ok', false, 'erro', 'Escolha o assunto do caso.');
  end if;
  if char_length(v_relato) < 5 then
    return jsonb_build_object('ok', false, 'erro', 'Conte o que o cliente disse, nem que seja em uma frase.');
  end if;
  if char_length(v_relato) > 2000 then
    return jsonb_build_object('ok', false, 'erro', 'O relato passou de 2.000 letras.');
  end if;
  if v_nome is not null and char_length(v_nome) > 120 then
    return jsonb_build_object('ok', false, 'erro', 'O nome do cliente passou de 120 letras.');
  end if;

  if v_ref <> '' then
    if v_ref ~ '^p[1-9][0-9]{0,14}$' then
      v_pedido := substr(v_ref, 2)::bigint;
      if not exists (select 1 from public.tray_pedidos t where t.pedido = v_pedido) then
        return jsonb_build_object('ok', false, 'erro', format('O pedido %s não está no painel. Confira o número, ou passe pelo telefone do cliente.', v_pedido));
      end if;
    elsif v_ref ~ '^v[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      v_venda := substr(v_ref, 2)::uuid;
      if not exists (select 1 from public.vendas_avulsas v where v.id = v_venda) then
        return jsonb_build_object('ok', false, 'erro', 'Essa venda não foi achada. Passe pelo telefone do cliente.');
      end if;
    else
      return jsonb_build_object('ok', false, 'erro', 'Não deu para entender o cliente. Escolha o pedido de novo ou passe pelo telefone.');
    end if;
  end if;

  if btrim(coalesce(p_telefone, '')) <> '' then
    v_tel := public.suporte_telefone(p_telefone);
    if v_tel is null then
      return jsonb_build_object('ok', false, 'erro', 'O telefone precisa ter DDD e número, como 11 98765 4321.');
    end if;
  end if;

  if v_pedido is null and v_venda is null and v_tel is null then
    return jsonb_build_object('ok', false, 'erro', 'Diga quem é o cliente: o número do pedido ou o telefone.');
  end if;

  if cardinality(v_imagens) > 4 then
    return jsonb_build_object('ok', false, 'erro', 'Dá para mandar até 4 prints por caso.');
  end if;
  -- O print precisa estar na pasta de quem passa o caso, e precisa existir: ninguém pendura o arquivo de outra pessoa.
  if exists (
    select 1 from unnest(v_imagens) i
    where i !~ ('^' || v_quem::text || '/[0-9a-f-]{36}\.(jpg|png|webp|gif)$')
       or not exists (select 1 from storage.objects o where o.bucket_id = 'chamados' and o.name = i)
  ) then
    return jsonb_build_object('ok', false, 'erro', 'Um dos prints não chegou. Mande de novo.');
  end if;

  insert into public.suporte_casos (assunto, relato, urgente, pedido, venda, cliente_nome, cliente_telefone, imagens, aberto_por)
  values (p_assunto, v_relato, coalesce(p_urgente, false), v_pedido, v_venda, v_nome, v_tel, v_imagens, v_quem)
  returning id into v_id;

  insert into public.suporte_movimentos (caso, quem, de, para) values (v_id, v_quem, null, 'na_fila');
  return jsonb_build_object('ok', true, 'id', v_id);
end
$$;

-- ------------------------------------------------------------------ ler

/**
 * Os casos que a pessoa vê. O suporte vê todos os abertos e os fechados nos
 * últimos 7 dias; quem passou vê os dele abertos e os fechados nos últimos 30.
 */
create or replace function public.suporte_lista()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_quem uuid := (select auth.uid());
  v_atende boolean := coalesce(public.tem_acesso('suporte'), false);
  v_abre boolean := coalesce(public.tem_acesso('lancar_venda'), false);
begin
  if not (v_atende or v_abre) then
    return jsonb_build_object('agora', now(), 'atende', false, 'abre', false, 'casos', '[]'::jsonb);
  end if;
  return jsonb_build_object(
    'agora', now(),
    'atende', v_atende,
    'abre', v_abre,
    'casos', coalesce((
      select jsonb_agg(public.suporte_caso_json(c) order by c.id desc)
      from (
        select *
        from public.suporte_casos c
        where (v_atende and (c.estado in ('na_fila', 'com_suporte') or c.fechado_em > now() - interval '7 days'))
           or (c.aberto_por = v_quem and (c.estado in ('na_fila', 'com_suporte') or c.fechado_em > now() - interval '30 days'))
        order by c.id desc
        limit 200
      ) c
    ), '[]'::jsonb)
  );
end
$$;

/**
 * Os números do menu, da Visão geral e do botão do chat. Para o suporte: os
 * casos sem dono (`fila`) e os que estão com a própria pessoa (`comigo`). Para
 * quem passou: os casos dele que fecharam e ele ainda não viu (`novidades`).
 */
create or replace function public.suporte_resumo()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_quem uuid := (select auth.uid());
  v_atende boolean := coalesce(public.tem_acesso('suporte'), false);
  v_abre boolean := coalesce(public.tem_acesso('lancar_venda'), false);
begin
  if not (v_atende or v_abre) then
    return jsonb_build_object('fila', 0, 'fila_desde', null, 'comigo', 0, 'comigo_desde', null, 'meus_abertos', 0, 'novidades', 0);
  end if;
  return (
    select jsonb_build_object(
      'fila', case when v_atende then count(*) filter (where c.estado = 'na_fila') else 0 end,
      'fila_desde', case when v_atende then min(c.aberto_em) filter (where c.estado = 'na_fila') end,
      'comigo', count(*) filter (where c.estado = 'com_suporte' and c.assumido_por = v_quem),
      'comigo_desde', min(c.assumido_em) filter (where c.estado = 'com_suporte' and c.assumido_por = v_quem),
      'meus_abertos', count(*) filter (where c.aberto_por = v_quem and c.estado in ('na_fila', 'com_suporte')),
      'novidades', count(*) filter (where c.aberto_por = v_quem and c.estado in ('resolvido', 'devolvido') and c.visto_pelo_vendedor_em is null)
    )
    from public.suporte_casos c
    where c.estado in ('na_fila', 'com_suporte')
       or (c.aberto_por = v_quem and c.visto_pelo_vendedor_em is null)
  );
end
$$;

/** Os caminhos dos prints de um caso, para o servidor assinar o link. Só para quem pode ver o caso. */
create or replace function public.suporte_imagens(p_caso bigint)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select c.imagens
  from public.suporte_casos c
  where c.id = p_caso
    and (coalesce(public.tem_acesso('suporte'), false) or (c.aberto_por = (select auth.uid()) and coalesce(public.tem_acesso('lancar_venda'), false)));
$$;

-- --------------------------------------------------------------- atender

create or replace function public.suporte_assumir(p_caso bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quem uuid := (select auth.uid());
  v_caso public.suporte_casos;
begin
  if not coalesce(public.tem_acesso('suporte'), false) then
    return jsonb_build_object('ok', false, 'erro', 'Só quem atende o suporte assume um caso.');
  end if;
  select * into v_caso from public.suporte_casos where id = p_caso for update;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Caso não encontrado.');
  end if;
  if v_caso.estado not in ('na_fila', 'com_suporte') then
    return jsonb_build_object('ok', false, 'erro', 'Esse caso já foi fechado.');
  end if;
  if v_caso.estado = 'com_suporte' and v_caso.assumido_por = v_quem then
    return jsonb_build_object('ok', true);
  end if;
  update public.suporte_casos
     set estado = 'com_suporte', assumido_por = v_quem, assumido_em = now(), mudou_em = now()
   where id = p_caso;
  insert into public.suporte_movimentos (caso, quem, de, para, nota)
  values (p_caso, v_quem, v_caso.estado, 'com_suporte',
          case when v_caso.assumido_por is not null then 'Assumiu no lugar de ' || coalesce(public.chat_nome(v_caso.assumido_por), 'outra pessoa') end);
  return jsonb_build_object('ok', true);
end
$$;

create or replace function public.suporte_fechar(p_caso bigint, p_resultado text, p_nota text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quem uuid := (select auth.uid());
  v_nota text := btrim(coalesce(p_nota, ''));
  v_caso public.suporte_casos;
begin
  if not coalesce(public.tem_acesso('suporte'), false) then
    return jsonb_build_object('ok', false, 'erro', 'Só quem atende o suporte fecha um caso.');
  end if;
  if p_resultado is null or p_resultado not in ('resolvido', 'devolvido') then
    return jsonb_build_object('ok', false, 'erro', 'Diga se o caso foi resolvido ou se volta para o vendedor.');
  end if;
  if char_length(v_nota) < 3 then
    return jsonb_build_object('ok', false, 'erro', case when p_resultado = 'resolvido'
      then 'Escreva em uma frase o que foi feito. É o que o vendedor vai ler.'
      else 'Diga por que o caso volta para o vendedor.' end);
  end if;
  if char_length(v_nota) > 1000 then
    return jsonb_build_object('ok', false, 'erro', 'A nota passou de 1.000 letras.');
  end if;
  select * into v_caso from public.suporte_casos where id = p_caso for update;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Caso não encontrado.');
  end if;
  if v_caso.estado not in ('na_fila', 'com_suporte') then
    return jsonb_build_object('ok', false, 'erro', 'Esse caso já foi fechado.');
  end if;
  update public.suporte_casos
     set estado = p_resultado,
         assumido_por = coalesce(assumido_por, v_quem),
         assumido_em = coalesce(assumido_em, now()),
         fechado_por = v_quem,
         fechado_em = now(),
         nota = v_nota,
         -- Quem fecha o próprio caso não precisa ser avisado dele.
         visto_pelo_vendedor_em = case when aberto_por = v_quem then now() end,
         mudou_em = now()
   where id = p_caso;
  insert into public.suporte_movimentos (caso, quem, de, para, nota) values (p_caso, v_quem, v_caso.estado, p_resultado, v_nota);
  return jsonb_build_object('ok', true);
end
$$;

/** Quem passou os casos viu como eles fecharam: o número dele zera. */
create or replace function public.suporte_marcar_visto()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer;
begin
  update public.suporte_casos
     set visto_pelo_vendedor_em = now()
   where aberto_por = (select auth.uid())
     and estado in ('resolvido', 'devolvido')
     and visto_pelo_vendedor_em is null;
  get diagnostics v_n = row_count;
  return v_n;
end
$$;

/**
 * O caso resolvido cuja resposta serve para outros vira sugestão na
 * Biblioteca JK, "a confirmar", pela MESMA porta de sugerir resposta. A
 * pessoa tira o dado de cliente antes; a origem é escrita aqui.
 */
create or replace function public.suporte_virar_resposta(p_caso bigint, p_tema text, p_pergunta text, p_explicacao text, p_frase text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caso public.suporte_casos;
  v_r jsonb;
begin
  if not coalesce(public.tem_acesso('suporte'), false) then
    return jsonb_build_object('ok', false, 'erro', 'Só quem atende o suporte guarda um caso na biblioteca.');
  end if;
  select * into v_caso from public.suporte_casos where id = p_caso for update;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Caso não encontrado.');
  end if;
  if v_caso.estado <> 'resolvido' then
    return jsonb_build_object('ok', false, 'erro', 'Só caso resolvido vira resposta da biblioteca.');
  end if;
  if v_caso.na_biblioteca is not null then
    return jsonb_build_object('ok', false, 'erro', 'Esse caso já está na biblioteca.');
  end if;
  v_r := public.sugerir_resposta(p_tema, p_pergunta, p_explicacao, p_frase,
    format('Caso de suporte %s (%s), resolvido por %s', v_caso.id, public.suporte_nome_do_assunto(v_caso.assunto), coalesce(public.chat_nome(v_caso.fechado_por), 'o suporte')));
  if (v_r ->> 'ok') = 'true' then
    update public.suporte_casos set na_biblioteca = (v_r ->> 'id')::uuid, mudou_em = now() where id = p_caso;
  end if;
  return v_r;
end
$$;

/**
 * O que vira aviso do sistema (a notificação do computador). Para o suporte:
 * caso novo de outra pessoa. Para quem passou: o caso dele que outra pessoa
 * fechou. Sem `p_desde`, devolve só o instante de agora, que vira o ponto de
 * partida (o que já existia não vira aviso).
 */
create or replace function public.suporte_para_avisar(p_desde timestamptz default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_quem uuid := (select auth.uid());
  v_atende boolean := coalesce(public.tem_acesso('suporte'), false);
begin
  if p_desde is null or not (v_atende or coalesce(public.tem_acesso('lancar_venda'), false)) then
    return jsonb_build_object('agora', now(), 'casos', '[]'::jsonb);
  end if;
  return jsonb_build_object(
    'agora', now(),
    'casos', coalesce((
      select jsonb_agg(x.j order by x.em)
      from (
        select c.aberto_em as em, jsonb_build_object('id', c.id, 'tipo', 'novo', 'assunto', c.assunto, 'urgente', c.urgente, 'quem', public.chat_nome(c.aberto_por)) as j
        from public.suporte_casos c
        where v_atende and c.estado = 'na_fila' and c.aberto_em > p_desde and c.aberto_por <> v_quem
        union all
        select c.fechado_em, jsonb_build_object('id', c.id, 'tipo', c.estado, 'assunto', c.assunto, 'urgente', false, 'quem', public.chat_nome(c.fechado_por))
        from public.suporte_casos c
        where c.aberto_por = v_quem and c.estado in ('resolvido', 'devolvido') and c.fechado_em > p_desde and c.fechado_por <> v_quem
        limit 20
      ) x
    ), '[]'::jsonb)
  );
end
$$;

-- -------------------------------------------------------------- os acessos

revoke execute on function public.suporte_telefone(text) from public, anon, authenticated;
revoke execute on function public.suporte_nome_do_assunto(text) from public, anon, authenticated;
revoke execute on function public.suporte_caso_json(public.suporte_casos) from public, anon, authenticated;

revoke execute on function public.suporte_abrir(text, text, text, text, text, boolean, text[]) from public, anon;
revoke execute on function public.suporte_lista() from public, anon;
revoke execute on function public.suporte_resumo() from public, anon;
revoke execute on function public.suporte_imagens(bigint) from public, anon;
revoke execute on function public.suporte_assumir(bigint) from public, anon;
revoke execute on function public.suporte_fechar(bigint, text, text) from public, anon;
revoke execute on function public.suporte_marcar_visto() from public, anon;
revoke execute on function public.suporte_virar_resposta(bigint, text, text, text, text) from public, anon;
revoke execute on function public.suporte_para_avisar(timestamptz) from public, anon;

grant execute on function public.suporte_abrir(text, text, text, text, text, boolean, text[]) to authenticated;
grant execute on function public.suporte_lista() to authenticated;
grant execute on function public.suporte_resumo() to authenticated;
grant execute on function public.suporte_imagens(bigint) to authenticated;
grant execute on function public.suporte_assumir(bigint) to authenticated;
grant execute on function public.suporte_fechar(bigint, text, text) to authenticated;
grant execute on function public.suporte_marcar_visto() to authenticated;
grant execute on function public.suporte_virar_resposta(bigint, text, text, text, text) to authenticated;
grant execute on function public.suporte_para_avisar(timestamptz) to authenticated;
