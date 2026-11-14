-- 0072: chamados entre setores.
--
-- De onde veio: o mesmo grupo de WhatsApp da 0071. Pedido que depende de outra
-- pessoa (orçamento de peça personalizada, estoque de loja, prazo) ia para o
-- grupo e ficava sem dono: um orçamento esperou 26 horas, e ninguém via que
-- estava parado. O chamado é o pedido com destino, estado e relógio.
--
-- Depende da 0071 (a área `time` e a biblioteca).
--
-- COMO FOI DESENHADO:
--
-- 1. Todo mundo com a área `time` vê todos os chamados. Ele substitui um grupo
--    em que todos já veem tudo, e esconder chamado de alguém criaria o mesmo
--    "quem sabe disso?" que se quer acabar.
--
-- 2. Ninguém lê nem grava direto nas tabelas (RLS ligada, sem policy). A
--    leitura e a escrita são funções que conferem a área e guardam o autor.
--
-- 3. Três estados. `aberto`: esperando o destino responder. `respondido`:
--    alguém respondeu, e quem abriu diz se resolveu. `resolvido`. Quem abriu
--    escrever de novo depois da resposta devolve o chamado para `aberto`, e o
--    relógio da espera (`aguardando_desde`) recomeça.
--
-- 4. O print fica no bucket PRIVADO `chamados`. A pessoa sobe a imagem direto
--    do navegador, só na própria pasta, e só lê o que ela mesma subiu. O print
--    dos outros sai por link assinado, que o servidor emite depois de conferir
--    a sessão. Print de conversa tem dado de cliente: nada de endereço público.
--
-- 5. O setor de cada nível mora numa tabela (`setores_do_time`), como o acesso:
--    mudar quem recebe os chamados de um setor é mudar uma linha.

create table public.setores_do_time (
  papel text not null check (papel in (
          'admin', 'dono', 'gm', 'gerente', 'trafego', 'vendas', 'fabrica',
          'editor', 'reviewer', 'author')),
  setor text not null check (setor in ('vendas', 'fabrica', 'loja', 'trafego', 'diretoria')),
  primary key (papel, setor)
);

comment on table public.setores_do_time is
  'A que setor cada nível de acesso responde nos chamados. É premissa de partida: a JK ajusta mudando linhas.';

alter table public.setores_do_time enable row level security;

create policy setores_do_time_admin_select on public.setores_do_time
  for select to authenticated using ((select public.is_admin()));
create policy setores_do_time_admin_insert on public.setores_do_time
  for insert to authenticated with check ((select public.is_admin()));
create policy setores_do_time_admin_update on public.setores_do_time
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

revoke all on public.setores_do_time from anon;

-- Ponto de partida. Os níveis editoriais não respondem por setor nenhum: veem
-- tudo e podem receber chamado pelo nome.
insert into public.setores_do_time (papel, setor) values
  ('vendas', 'vendas'),
  ('fabrica', 'fabrica'),
  ('trafego', 'trafego'),
  ('gerente', 'loja'),
  ('dono', 'diretoria'),
  ('gm', 'diretoria'),
  ('admin', 'diretoria');

create table public.chamados (
  id               uuid primary key default gen_random_uuid(),
  -- O número que as pessoas falam: "o chamado 12".
  numero           bigint generated always as identity unique,
  tipo             text not null check (tipo in ('duvida', 'orcamento', 'estoque_prazo', 'outro')),
  texto            text not null check (char_length(texto) between 3 and 4000),
  -- O destino é um setor OU uma pessoa. Quem confere é a função de abrir.
  para_setor       text check (para_setor in ('vendas', 'fabrica', 'loja', 'trafego', 'diretoria')),
  para_pessoa      uuid references public.profiles (id) on delete set null,
  aberto_por       uuid references public.profiles (id) on delete set null,
  estado           text not null default 'aberto' check (estado in ('aberto', 'respondido', 'resolvido')),
  preciso_ate      timestamptz,
  -- A peça de que o chamado fala, quando ele nasce na consulta.
  produto_id       uuid references public.products (id) on delete set null,
  -- Desde quando está esperando resposta. Recomeça toda vez que volta para `aberto`.
  aguardando_desde timestamptz not null default now(),
  respondido_em    timestamptz,
  respondido_por   uuid references public.profiles (id) on delete set null,
  resolvido_em     timestamptz,
  resolvido_por    uuid references public.profiles (id) on delete set null,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now()
);

comment on table public.chamados is
  'Pedido de um setor a outro, com destino, estado e relógio de espera. Todos com a área `time` veem todos.';

create index chamados_estado_idx on public.chamados (estado, aguardando_desde);
create index chamados_para_pessoa_idx on public.chamados (para_pessoa);
create index chamados_aberto_por_idx on public.chamados (aberto_por);
create index chamados_produto_idx on public.chamados (produto_id);
create index chamados_respondido_por_idx on public.chamados (respondido_por);
create index chamados_resolvido_por_idx on public.chamados (resolvido_por);

create table public.chamado_mensagens (
  id         bigint generated always as identity primary key,
  chamado_id uuid not null references public.chamados (id) on delete cascade,
  autor      uuid references public.profiles (id) on delete set null,
  -- Pode vir vazio quando a mensagem é só o print.
  texto      text not null default '' check (char_length(texto) <= 4000),
  criado_em  timestamptz not null default now()
);

create index chamado_mensagens_chamado_idx on public.chamado_mensagens (chamado_id, criado_em);
create index chamado_mensagens_autor_idx on public.chamado_mensagens (autor);

create table public.chamado_anexos (
  id          uuid primary key default gen_random_uuid(),
  chamado_id  uuid not null references public.chamados (id) on delete cascade,
  -- Vazio quando o print veio junto da abertura do chamado.
  mensagem_id bigint references public.chamado_mensagens (id) on delete cascade,
  caminho     text not null unique,
  nome        text check (nome is null or char_length(nome) <= 200),
  tipo        text not null check (tipo in ('image/jpeg', 'image/png', 'image/webp', 'image/gif')),
  tamanho     integer not null check (tamanho between 1 and 5242880),
  enviado_por uuid references public.profiles (id) on delete set null,
  criado_em   timestamptz not null default now()
);

create index chamado_anexos_chamado_idx on public.chamado_anexos (chamado_id);
create index chamado_anexos_mensagem_idx on public.chamado_anexos (mensagem_id);
create index chamado_anexos_enviado_por_idx on public.chamado_anexos (enviado_por);

alter table public.chamados enable row level security;
alter table public.chamado_mensagens enable row level security;
alter table public.chamado_anexos enable row level security;
revoke all on public.chamados from anon, authenticated;
revoke all on public.chamado_mensagens from anon, authenticated;
revoke all on public.chamado_anexos from anon, authenticated;

-- O chamado que virou resposta da biblioteca. Uma resposta por chamado.
alter table public.biblioteca_respostas add column chamado_id uuid references public.chamados (id) on delete set null;
create unique index biblioteca_respostas_chamado_idx on public.biblioteca_respostas (chamado_id) where chamado_id is not null;

-- ------------------------------------------------------------------ o print

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chamados', 'chamados', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

-- Envio só na própria pasta (`<id da pessoa>/arquivo`). Leitura direta só do que
-- a própria pessoa subiu. O print dos outros não tem policy: sai por link
-- assinado, emitido pelo servidor.
create policy "chamados envio na propria pasta" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'chamados'
    and (select public.tem_acesso('time'))
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "chamados leitura do proprio envio" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'chamados'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- --------------------------------------------------------------- as funções

/** Os setores a que a pessoa logada responde nos chamados. */
create function public.meus_setores()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(s.setor order by s.setor), '{}')
  from public.profiles p
  join public.setores_do_time s on s.papel = p.role::text
  where p.id = (select auth.uid()) and p.is_active
$$;

/** As pessoas ativas, para escolher a quem mandar um chamado. Só o nome e o nível. */
create function public.pessoas_do_time()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'nome', coalesce(nullif(btrim(p.full_name), ''), split_part(p.email, '@', 1)),
    'papel', p.role::text
  ) order by lower(coalesce(nullif(btrim(p.full_name), ''), p.email))), '[]'::jsonb)
  from public.profiles p
  where p.is_active and (select public.tem_acesso('time'))
$$;

/**
 * Prende ao chamado as imagens que a pessoa já subiu. Uso interno: só as
 * funções abaixo chamam. O tamanho e o tipo saem do registro do
 * armazenamento, e não do que o navegador disse.
 */
create function public.chamado_prender_anexos(p_chamado uuid, p_mensagem bigint, p_anexos jsonb, p_quem uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  a jsonb;
  v_caminho text;
  v_tamanho bigint;
  v_tipo text;
begin
  if p_anexos is null or jsonb_typeof(p_anexos) <> 'array' then
    return null;
  end if;
  if jsonb_array_length(p_anexos) > 6 then
    return 'Dá para mandar até 6 imagens por vez.';
  end if;
  for a in select * from jsonb_array_elements(p_anexos) loop
    v_caminho := a->>'caminho';
    if v_caminho is null or v_caminho not like p_quem::text || '/%' or v_caminho like '%..%' then
      return 'Imagem inválida. Envie de novo.';
    end if;
    select (o.metadata->>'size')::bigint, o.metadata->>'mimetype'
      into v_tamanho, v_tipo
      from storage.objects o
     where o.bucket_id = 'chamados' and o.name = v_caminho;
    if not found then
      return 'A imagem não chegou. Envie de novo.';
    end if;
    if v_tipo is null or v_tipo not in ('image/jpeg', 'image/png', 'image/webp', 'image/gif') then
      return 'Só imagem: JPG, PNG, WebP ou GIF.';
    end if;
    if v_tamanho is null or v_tamanho < 1 or v_tamanho > 5242880 then
      return 'A imagem passa de 5 MB.';
    end if;
    insert into public.chamado_anexos (chamado_id, mensagem_id, caminho, nome, tipo, tamanho, enviado_por)
    values (p_chamado, p_mensagem, v_caminho, nullif(left(btrim(coalesce(a->>'nome', '')), 200), ''), v_tipo, v_tamanho::integer, p_quem)
    on conflict (caminho) do nothing;
  end loop;
  return null;
end
$$;

/** Abre um chamado para um setor ou para uma pessoa. */
create function public.abrir_chamado(
  p_tipo text,
  p_texto text,
  p_para_setor text default null,
  p_para_pessoa uuid default null,
  p_preciso_ate timestamptz default null,
  p_produto uuid default null,
  p_anexos jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quem uuid := (select auth.uid());
  v_id uuid;
  v_numero bigint;
  v_erro text;
begin
  if not public.tem_acesso('time') then
    return jsonb_build_object('ok', false, 'erro', 'Seu acesso não inclui os chamados.');
  end if;
  if p_tipo is null or p_tipo not in ('duvida', 'orcamento', 'estoque_prazo', 'outro') then
    return jsonb_build_object('ok', false, 'erro', 'Escolha o tipo do chamado.');
  end if;
  if char_length(btrim(coalesce(p_texto, ''))) < 3 then
    return jsonb_build_object('ok', false, 'erro', 'Escreva o que você precisa.');
  end if;
  if char_length(btrim(p_texto)) > 4000 then
    return jsonb_build_object('ok', false, 'erro', 'O texto passou de 4.000 letras.');
  end if;
  if (p_para_setor is null) = (p_para_pessoa is null) then
    return jsonb_build_object('ok', false, 'erro', 'Escolha para quem vai: um setor ou uma pessoa.');
  end if;
  if p_para_setor is not null and p_para_setor not in ('vendas', 'fabrica', 'loja', 'trafego', 'diretoria') then
    return jsonb_build_object('ok', false, 'erro', 'Setor desconhecido.');
  end if;
  if p_para_pessoa is not null then
    if p_para_pessoa = v_quem then
      return jsonb_build_object('ok', false, 'erro', 'O chamado precisa ir para outra pessoa.');
    end if;
    if not exists (select 1 from public.profiles p where p.id = p_para_pessoa and p.is_active) then
      return jsonb_build_object('ok', false, 'erro', 'Essa pessoa não está ativa no painel.');
    end if;
  end if;
  if p_preciso_ate is not null and p_preciso_ate < now() - interval '5 minutes' then
    return jsonb_build_object('ok', false, 'erro', 'O prazo pedido já passou.');
  end if;
  if p_produto is not null and not exists (select 1 from public.products pr where pr.id = p_produto) then
    p_produto := null;
  end if;

  insert into public.chamados (tipo, texto, para_setor, para_pessoa, aberto_por, preciso_ate, produto_id)
  values (p_tipo, btrim(p_texto), p_para_setor, p_para_pessoa, v_quem, p_preciso_ate, p_produto)
  returning id, numero into v_id, v_numero;

  v_erro := public.chamado_prender_anexos(v_id, null, p_anexos, v_quem);
  if v_erro is not null then
    -- Erro de imagem desfaz o chamado inteiro: a pessoa tenta de novo sem deixar um chamado pela metade.
    raise exception '%', v_erro using errcode = 'P0001';
  end if;

  return jsonb_build_object('ok', true, 'id', v_id, 'numero', v_numero);
end
$$;

/**
 * Escreve no chamado. Resposta de outra pessoa leva o chamado para
 * `respondido`. Quem abriu escrever depois da resposta devolve para `aberto`,
 * e a espera recomeça.
 */
create function public.responder_chamado(p_chamado uuid, p_texto text, p_anexos jsonb default '[]'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quem uuid := (select auth.uid());
  v_texto text := btrim(coalesce(p_texto, ''));
  v_tem_imagem boolean := p_anexos is not null and jsonb_typeof(p_anexos) = 'array' and jsonb_array_length(p_anexos) > 0;
  v_mensagem bigint;
  v_erro text;
  c public.chamados%rowtype;
begin
  if not public.tem_acesso('time') then
    return jsonb_build_object('ok', false, 'erro', 'Seu acesso não inclui os chamados.');
  end if;
  if v_texto = '' and not v_tem_imagem then
    return jsonb_build_object('ok', false, 'erro', 'Escreva a mensagem ou mande uma imagem.');
  end if;
  if char_length(v_texto) > 4000 then
    return jsonb_build_object('ok', false, 'erro', 'A mensagem passou de 4.000 letras.');
  end if;
  select * into c from public.chamados where id = p_chamado for update;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Chamado não encontrado.');
  end if;

  insert into public.chamado_mensagens (chamado_id, autor, texto) values (c.id, v_quem, v_texto) returning id into v_mensagem;

  v_erro := public.chamado_prender_anexos(c.id, v_mensagem, p_anexos, v_quem);
  if v_erro is not null then
    raise exception '%', v_erro using errcode = 'P0001';
  end if;

  if v_quem is distinct from c.aberto_por then
    update public.chamados set
      estado = 'respondido',
      respondido_em = coalesce(respondido_em, now()),
      respondido_por = coalesce(respondido_por, v_quem),
      resolvido_em = null,
      resolvido_por = null,
      atualizado_em = now()
    where id = c.id;
  else
    update public.chamados set
      estado = 'aberto',
      -- Só recomeça o relógio quando o chamado estava parado do outro lado.
      aguardando_desde = case when c.estado = 'aberto' then aguardando_desde else now() end,
      resolvido_em = null,
      resolvido_por = null,
      atualizado_em = now()
    where id = c.id;
  end if;

  return jsonb_build_object('ok', true);
end
$$;

/** Marca como resolvido. Quem abriu, quem recebeu (a pessoa ou o setor) e a diretoria. */
create function public.resolver_chamado(p_chamado uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quem uuid := (select auth.uid());
  c public.chamados%rowtype;
begin
  if not public.tem_acesso('time') then
    return jsonb_build_object('ok', false, 'erro', 'Seu acesso não inclui os chamados.');
  end if;
  select * into c from public.chamados where id = p_chamado for update;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Chamado não encontrado.');
  end if;
  -- `coalesce`: chamado para um setor tem `para_pessoa` vazio, a comparação dá NULL, e NULL num `if` deixaria passar.
  if not coalesce(
    c.aberto_por = v_quem
    or c.para_pessoa = v_quem
    or (c.para_setor is not null and c.para_setor = any (public.meus_setores()))
    or public.is_admin(), false
  ) then
    return jsonb_build_object('ok', false, 'erro', 'Só quem abriu, quem recebeu ou a diretoria marca como resolvido.');
  end if;
  if c.estado = 'resolvido' then
    return jsonb_build_object('ok', true);
  end if;
  update public.chamados set estado = 'resolvido', resolvido_em = now(), resolvido_por = v_quem, atualizado_em = now() where id = c.id;
  return jsonb_build_object('ok', true);
end
$$;

/**
 * Todos os chamados em andamento e os resolvidos dos últimos dias, com o nome
 * de cada pessoa e um resumo da conversa.
 */
create function public.chamados_listar(p_dias_resolvidos integer default 30)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id,
    'numero', c.numero,
    'tipo', c.tipo,
    'texto', c.texto,
    'para_setor', c.para_setor,
    'para_pessoa', c.para_pessoa,
    'para_pessoa_nome', (select coalesce(nullif(btrim(p.full_name), ''), split_part(p.email, '@', 1)) from public.profiles p where p.id = c.para_pessoa),
    'aberto_por', c.aberto_por,
    'aberto_por_nome', (select coalesce(nullif(btrim(p.full_name), ''), split_part(p.email, '@', 1)) from public.profiles p where p.id = c.aberto_por),
    'estado', c.estado,
    'preciso_ate', c.preciso_ate,
    'produto', (select pr.name from public.products pr where pr.id = c.produto_id),
    'aguardando_desde', c.aguardando_desde,
    'criado_em', c.criado_em,
    'atualizado_em', c.atualizado_em,
    'mensagens', (select count(*) from public.chamado_mensagens m where m.chamado_id = c.id),
    'anexos', (select count(*) from public.chamado_anexos a where a.chamado_id = c.id),
    'ultima', (
      select jsonb_build_object(
        'autor', (select coalesce(nullif(btrim(p.full_name), ''), split_part(p.email, '@', 1)) from public.profiles p where p.id = m.autor),
        'texto', left(m.texto, 240),
        'em', m.criado_em)
      from public.chamado_mensagens m
      where m.chamado_id = c.id
      order by m.criado_em desc, m.id desc
      limit 1),
    'na_biblioteca', exists (select 1 from public.biblioteca_respostas b where b.chamado_id = c.id)
  ) order by c.criado_em desc), '[]'::jsonb)
  from public.chamados c
  where (select public.tem_acesso('time'))
    and (c.estado <> 'resolvido' or c.resolvido_em >= now() - make_interval(days => greatest(coalesce(p_dias_resolvidos, 30), 1)))
$$;

/** Um chamado inteiro, pelo número: o pedido, a conversa em ordem e os caminhos das imagens. */
create function public.chamado_detalhe(p_numero bigint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', c.id,
    'numero', c.numero,
    'tipo', c.tipo,
    'texto', c.texto,
    'para_setor', c.para_setor,
    'para_pessoa', c.para_pessoa,
    'para_pessoa_nome', (select coalesce(nullif(btrim(p.full_name), ''), split_part(p.email, '@', 1)) from public.profiles p where p.id = c.para_pessoa),
    'aberto_por', c.aberto_por,
    'aberto_por_nome', (select coalesce(nullif(btrim(p.full_name), ''), split_part(p.email, '@', 1)) from public.profiles p where p.id = c.aberto_por),
    'aberto_por_papel', (select p.role::text from public.profiles p where p.id = c.aberto_por),
    'estado', c.estado,
    'preciso_ate', c.preciso_ate,
    'produto', (select jsonb_build_object('id', pr.id, 'nome', pr.name, 'url', pr.url, 'codigo', pr.tray_id) from public.products pr where pr.id = c.produto_id),
    'aguardando_desde', c.aguardando_desde,
    'criado_em', c.criado_em,
    'resolvido_em', c.resolvido_em,
    'resolvido_por_nome', (select coalesce(nullif(btrim(p.full_name), ''), split_part(p.email, '@', 1)) from public.profiles p where p.id = c.resolvido_por),
    'pode_resolver', coalesce(
      c.aberto_por = (select auth.uid())
      or c.para_pessoa = (select auth.uid())
      or (c.para_setor is not null and c.para_setor = any (public.meus_setores()))
      or (select public.is_admin()), false),
    'resposta_da_biblioteca', (select b.id from public.biblioteca_respostas b where b.chamado_id = c.id),
    'anexos', coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'caminho', a.caminho, 'nome', a.nome) order by a.criado_em, a.id)
      from public.chamado_anexos a where a.chamado_id = c.id and a.mensagem_id is null), '[]'::jsonb),
    'mensagens', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id,
        'autor', m.autor,
        'autor_nome', (select coalesce(nullif(btrim(p.full_name), ''), split_part(p.email, '@', 1)) from public.profiles p where p.id = m.autor),
        'autor_papel', (select p.role::text from public.profiles p where p.id = m.autor),
        'texto', m.texto,
        'em', m.criado_em,
        'anexos', coalesce((
          select jsonb_agg(jsonb_build_object('id', a.id, 'caminho', a.caminho, 'nome', a.nome) order by a.criado_em, a.id)
          from public.chamado_anexos a where a.mensagem_id = m.id), '[]'::jsonb)
      ) order by m.criado_em, m.id)
      from public.chamado_mensagens m where m.chamado_id = c.id), '[]'::jsonb)
  )
  from public.chamados c
  where c.numero = p_numero and (select public.tem_acesso('time'))
$$;

/**
 * O aviso do menu e da Visão geral: quantos chamados abertos esperam a pessoa
 * (pelo nome ou pelo setor dela), desde quando espera o mais antigo, e quantos
 * chamados dela já foram respondidos e esperam ela dizer se resolveu.
 */
create function public.chamados_para_mim()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'abertos', count(*) filter (where c.estado = 'aberto' and c.aberto_por is distinct from (select auth.uid())
                                  and (c.para_pessoa = (select auth.uid()) or c.para_setor = any ((select public.meus_setores())::text[]))),
    'desde', min(c.aguardando_desde) filter (where c.estado = 'aberto' and c.aberto_por is distinct from (select auth.uid())
                                  and (c.para_pessoa = (select auth.uid()) or c.para_setor = any ((select public.meus_setores())::text[]))),
    'respondidos', count(*) filter (where c.estado = 'respondido' and c.aberto_por = (select auth.uid()))
  )
  from public.chamados c
  where c.estado <> 'resolvido' and (select public.tem_acesso('time'))
$$;

/**
 * "Virar resposta da biblioteca": um chamado respondido vira uma resposta "a
 * confirmar", já com a origem escrita. É o laço que faz a biblioteca crescer.
 */
create function public.chamado_virar_resposta(
  p_chamado uuid,
  p_tema text,
  p_pergunta text,
  p_explicacao text,
  p_frase text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quem uuid := (select auth.uid());
  v_erro text;
  v_id uuid;
  v_origem text;
  c public.chamados%rowtype;
begin
  if not public.tem_acesso('time') then
    return jsonb_build_object('ok', false, 'erro', 'Seu acesso não inclui a biblioteca.');
  end if;
  select * into c from public.chamados where id = p_chamado for update;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Chamado não encontrado.');
  end if;
  if c.estado = 'aberto' then
    return jsonb_build_object('ok', false, 'erro', 'O chamado ainda não tem resposta.');
  end if;
  if exists (select 1 from public.biblioteca_respostas b where b.chamado_id = c.id) then
    return jsonb_build_object('ok', false, 'erro', 'Este chamado já virou resposta da biblioteca.');
  end if;
  v_origem := 'Chamado ' || c.numero || coalesce(
    ', respondido por ' || (select coalesce(nullif(btrim(p.full_name), ''), split_part(p.email, '@', 1)) from public.profiles p where p.id = c.respondido_por), '')
    || coalesce(' em ' || to_char(c.respondido_em at time zone 'America/Sao_Paulo', 'DD/MM/YYYY'), '');
  v_erro := public.biblioteca_conferir(p_tema, p_pergunta, p_explicacao, p_frase, v_origem);
  if v_erro is not null then
    return jsonb_build_object('ok', false, 'erro', v_erro);
  end if;

  insert into public.biblioteca_respostas (tema, pergunta, explicacao, frase, origem, criado_por, atualizado_por, chamado_id)
  values (p_tema, btrim(p_pergunta), btrim(p_explicacao), nullif(btrim(coalesce(p_frase, '')), ''), v_origem, v_quem, v_quem, c.id)
  returning id into v_id;

  insert into public.biblioteca_alteracoes (resposta_id, acao, por) values (v_id, 'sugeriu', v_quem);
  return jsonb_build_object('ok', true, 'id', v_id);
end
$$;

-- A lista da biblioteca passa a dizer de que chamado a resposta nasceu.
create or replace function public.biblioteca_listar()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id,
    'tema', r.tema,
    'pergunta', r.pergunta,
    'explicacao', r.explicacao,
    'frase', r.frase,
    'estado', r.estado,
    'origem', r.origem,
    'criado_por', r.criado_por,
    'criado_por_nome', (select p.full_name from public.profiles p where p.id = r.criado_por),
    'criado_em', r.criado_em,
    'confirmado_por_nome', (select p.full_name from public.profiles p where p.id = r.confirmado_por),
    'confirmado_em', r.confirmado_em,
    'atualizado_em', r.atualizado_em,
    'chamado', (select c.numero from public.chamados c where c.id = r.chamado_id)
  ) order by r.criado_em, r.id), '[]'::jsonb)
  from public.biblioteca_respostas r
  where (select public.tem_acesso('time'))
    and (r.estado <> 'arquivada' or (select public.is_admin()))
$$;

revoke execute on function public.meus_setores() from public, anon;
revoke execute on function public.pessoas_do_time() from public, anon;
revoke execute on function public.chamado_prender_anexos(uuid, bigint, jsonb, uuid) from public, anon, authenticated;
revoke execute on function public.abrir_chamado(text, text, text, uuid, timestamptz, uuid, jsonb) from public, anon;
revoke execute on function public.responder_chamado(uuid, text, jsonb) from public, anon;
revoke execute on function public.resolver_chamado(uuid) from public, anon;
revoke execute on function public.chamados_listar(integer) from public, anon;
revoke execute on function public.chamado_detalhe(bigint) from public, anon;
revoke execute on function public.chamados_para_mim() from public, anon;
revoke execute on function public.chamado_virar_resposta(uuid, text, text, text, text) from public, anon;
grant execute on function public.meus_setores() to authenticated;
grant execute on function public.pessoas_do_time() to authenticated;
grant execute on function public.abrir_chamado(text, text, text, uuid, timestamptz, uuid, jsonb) to authenticated;
grant execute on function public.responder_chamado(uuid, text, jsonb) to authenticated;
grant execute on function public.resolver_chamado(uuid) to authenticated;
grant execute on function public.chamados_listar(integer) to authenticated;
grant execute on function public.chamado_detalhe(bigint) to authenticated;
grant execute on function public.chamados_para_mim() to authenticated;
grant execute on function public.chamado_virar_resposta(uuid, text, text, text, text) to authenticated;
