-- 0079: chat do time, ao vivo.
--
-- De onde veio: os chamados da 0072 resolviam o pedido sem dono, mas pediam
-- formulário (tipo, destino, prazo) para uma pergunta de uma linha. O dono do
-- projeto pediu no mesmo dia: "só a parte do chamado poderia ser um chat, papo
-- reto, mais veloz, que mostra quem está online". Os chamados nunca tiveram
-- uma linha gravada. Esta migration cria o chat; a 0080 tira o que sobrou dos
-- chamados, e só roda depois de o código novo estar no ar.
--
-- COMO FOI DESENHADO:
--
-- 1. Salas fixas: `geral` e uma por setor (os mesmos cinco setores de
--    `setores_do_time`). Toda pessoa com a área `time` lê e escreve em todas.
--    A sala substitui o "para quem vai" do chamado: quem quer falar com a
--    fábrica escreve na sala da fábrica.
--
-- 2. O que o chamado tinha de bom ficou como PEDIDO: qualquer mensagem pode
--    pedir resposta. O pedido tem relógio (`esperando_desde`) e deixa de
--    esperar quando outra pessoa responde A ELE, ou quando alguém marca como
--    resolvido. Mensagem comum não tem estado nenhum.
--
-- 3. Ninguém lê nem grava direto nas tabelas (RLS ligada, sem policy). Tudo é
--    função que confere a área `time`. As funções são chamadas direto do
--    navegador, com a sessão da pessoa: é uma ida ao banco em vez de duas, e
--    num chat essa diferença aparece.
--
-- 4. O tempo real é do Realtime do Supabase, num canal PRIVADO (`painel:time`).
--    Pelo canal passa só o aviso "há mensagem nova" e a presença (quem está
--    com o painel aberto), nunca o texto: o texto é lido pela função, que
--    confere o acesso. As duas policies de `realtime.messages` no fim deste
--    arquivo são o que deixa entrar no canal só quem tem a área `time`.
--
-- 5. A imagem continua no bucket privado da 0072, que segue se chamando
--    `chamados` (bucket não muda de nome), com as mesmas duas policies: envio
--    só na própria pasta, e leitura do print dos outros só por link assinado.

create table public.chat_mensagens (
  id              bigint generated always as identity primary key,
  sala            text not null check (sala in ('geral', 'vendas', 'fabrica', 'loja', 'trafego', 'diretoria')),
  autor           uuid references public.profiles (id) on delete set null,
  -- Pode vir vazio quando a mensagem é só a imagem.
  texto           text not null default '' check (char_length(texto) <= 4000),
  responde_a      bigint references public.chat_mensagens (id) on delete set null,
  -- O pedido: a mensagem que espera resposta.
  pede_resposta   boolean not null default false,
  -- Desde quando espera. Recomeça quando quem pediu diz que ainda precisa.
  esperando_desde timestamptz,
  atendida_em     timestamptz,
  atendida_por    uuid references public.profiles (id) on delete set null,
  -- Mensagem não se apaga do banco: some da tela e fica o registro.
  apagada_em      timestamptz,
  apagada_por     uuid references public.profiles (id) on delete set null,
  criada_em       timestamptz not null default now(),
  -- O que a tela usa para saber o que mudou desde a última leitura.
  atualizada_em   timestamptz not null default now()
);

comment on table public.chat_mensagens is
  'Chat do time: uma linha por mensagem, em salas fixas. Mensagem com pede_resposta é o pedido que tem relógio. Leitura e escrita só por função.';

create index chat_mensagens_sala_idx on public.chat_mensagens (sala, id desc);
create index chat_mensagens_mudou_idx on public.chat_mensagens (atualizada_em);
create index chat_mensagens_responde_idx on public.chat_mensagens (responde_a) where responde_a is not null;
create index chat_mensagens_esperando_idx on public.chat_mensagens (sala)
  where pede_resposta and atendida_em is null and apagada_em is null;
create index chat_mensagens_autor_idx on public.chat_mensagens (autor, criada_em desc);
create index chat_mensagens_atendida_por_idx on public.chat_mensagens (atendida_por) where atendida_por is not null;
create index chat_mensagens_apagada_por_idx on public.chat_mensagens (apagada_por) where apagada_por is not null;

create table public.chat_anexos (
  id          uuid primary key default gen_random_uuid(),
  mensagem_id bigint not null references public.chat_mensagens (id) on delete cascade,
  caminho     text not null unique,
  tipo        text not null check (tipo in ('image/jpeg', 'image/png', 'image/webp', 'image/gif')),
  tamanho     integer not null check (tamanho between 1 and 5242880),
  criado_em   timestamptz not null default now()
);

create index chat_anexos_mensagem_idx on public.chat_anexos (mensagem_id);

-- Até onde cada pessoa leu cada sala.
create table public.chat_leituras (
  pessoa        uuid not null references public.profiles (id) on delete cascade,
  sala          text not null check (sala in ('geral', 'vendas', 'fabrica', 'loja', 'trafego', 'diretoria')),
  lida_ate      bigint not null default 0,
  atualizada_em timestamptz not null default now(),
  primary key (pessoa, sala)
);

alter table public.chat_mensagens enable row level security;
alter table public.chat_anexos enable row level security;
alter table public.chat_leituras enable row level security;
revoke all on public.chat_mensagens from anon, authenticated;
revoke all on public.chat_anexos from anon, authenticated;
revoke all on public.chat_leituras from anon, authenticated;

-- A mensagem do chat que virou resposta da biblioteca. Uma resposta por mensagem.
alter table public.biblioteca_respostas add column mensagem_id bigint references public.chat_mensagens (id) on delete set null;
create unique index biblioteca_respostas_mensagem_idx on public.biblioteca_respostas (mensagem_id) where mensagem_id is not null;

-- --------------------------------------------------------------- uso interno

/** `atualizada_em` anda em toda mudança, venha de onde vier. */
create function public.chat_tocar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizada_em := now();
  return new;
end
$$;

create trigger chat_mensagens_tocar before update on public.chat_mensagens
  for each row execute function public.chat_tocar();

/** O nome de uma pessoa, do jeito que o painel mostra. Uso interno. */
create function public.chat_nome(p_pessoa uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(nullif(btrim(p.full_name), ''), split_part(p.email, '@', 1))
  from public.profiles p
  where p.id = p_pessoa
$$;

/**
 * A mensagem do jeito que a tela recebe. Uso interno: só as funções abaixo
 * chamam, depois de conferir o acesso. Mensagem apagada sai sem texto e sem
 * imagem.
 */
create function public.chat_mensagem_json(m public.chat_mensagens)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', m.id,
    'sala', m.sala,
    'autor', m.autor,
    'autor_nome', public.chat_nome(m.autor),
    'autor_papel', (select p.role::text from public.profiles p where p.id = m.autor),
    'texto', case when m.apagada_em is null then m.texto else '' end,
    'apagada', m.apagada_em is not null,
    'responde_a', (
      select jsonb_build_object(
        'id', o.id,
        'autor', o.autor,
        'autor_nome', public.chat_nome(o.autor),
        'trecho', case when o.apagada_em is null then left(o.texto, 140) else '' end,
        'apagada', o.apagada_em is not null,
        'imagens', case when o.apagada_em is null then (select count(*) from public.chat_anexos a where a.mensagem_id = o.id) else 0 end)
      from public.chat_mensagens o
      where o.id = m.responde_a),
    'pede', m.pede_resposta,
    'esperando_desde', m.esperando_desde,
    'atendida_em', m.atendida_em,
    'atendida_por_nome', public.chat_nome(m.atendida_por),
    -- Quantas respostas de OUTRAS pessoas a mensagem tem: é o que libera "guardar na biblioteca".
    'respostas', (
      select count(*) from public.chat_mensagens r
      where r.responde_a = m.id and r.apagada_em is null and r.autor is distinct from m.autor),
    'na_biblioteca', (select b.id from public.biblioteca_respostas b where b.mensagem_id = m.id),
    'em', m.criada_em,
    'mudou', m.atualizada_em,
    'anexos', case when m.apagada_em is null
      then coalesce((select jsonb_agg(a.id order by a.criado_em, a.id) from public.chat_anexos a where a.mensagem_id = m.id), '[]'::jsonb)
      else '[]'::jsonb end
  )
$$;

/**
 * Prende à mensagem as imagens que a pessoa já subiu. Uso interno. O tamanho
 * e o tipo saem do registro do armazenamento, e não do que o navegador disse.
 * Devolve a frase do erro, ou null quando deu certo.
 */
create function public.chat_prender_anexos(p_mensagem bigint, p_anexos jsonb, p_quem uuid)
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
    insert into public.chat_anexos (mensagem_id, caminho, tipo, tamanho)
    values (p_mensagem, v_caminho, v_tipo, v_tamanho::integer)
    on conflict (caminho) do nothing;
  end loop;
  return null;
end
$$;

-- ------------------------------------------------------------------ leitura

/**
 * O que a tela precisa para abrir: as últimas mensagens de cada sala, todo
 * pedido que ainda espera (por mais antigo), até onde a pessoa leu, quem é do
 * time e a que setores ela responde. `janelas` diz, para a sala que tem mais
 * mensagem do que veio, a partir de qual a lista está completa.
 */
create function public.chat_abrir(p_por_sala integer default 40)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_quem uuid := (select auth.uid());
  v_n integer := least(greatest(coalesce(p_por_sala, 40), 10), 100);
begin
  if not coalesce(public.tem_acesso('time'), false) then
    return null;
  end if;
  return jsonb_build_object(
    'agora', now(),
    'setores', to_jsonb(public.meus_setores()),
    'lidas', coalesce((select jsonb_object_agg(l.sala, l.lida_ate) from public.chat_leituras l where l.pessoa = v_quem), '{}'::jsonb),
    'pessoas', public.pessoas_do_time(),
    'janelas', coalesce((
      select jsonb_object_agg(x.sala, x.id)
      from (
        select c.sala, c.id,
               row_number() over (partition by c.sala order by c.id desc) as n,
               count(*) over (partition by c.sala) as total
        from public.chat_mensagens c
      ) x
      where x.n = v_n and x.total > v_n), '{}'::jsonb),
    'mensagens', coalesce((
      select jsonb_agg(public.chat_mensagem_json(m) order by m.id)
      from public.chat_mensagens m
      where m.id in (
        select x.id
        from (select c.id, row_number() over (partition by c.sala order by c.id desc) as n from public.chat_mensagens c) x
        where x.n <= v_n
        union
        select c.id from public.chat_mensagens c
        where c.pede_resposta and c.atendida_em is null and c.apagada_em is null
      )), '[]'::jsonb)
  );
end
$$;

/**
 * O que mudou desde um instante: mensagem nova, pedido atendido, mensagem
 * apagada. No máximo 300 de uma vez; se vier cheio, a tela abre de novo.
 */
create function public.chat_sincronizar(p_desde timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_quem uuid := (select auth.uid());
  v_mensagens jsonb;
begin
  if not coalesce(public.tem_acesso('time'), false) then
    return null;
  end if;
  select coalesce(jsonb_agg(public.chat_mensagem_json(m) order by m.id), '[]'::jsonb)
    into v_mensagens
    from public.chat_mensagens m
    where m.id in (
      select c.id from public.chat_mensagens c
      where c.atualizada_em > coalesce(p_desde, now())
      order by c.atualizada_em
      limit 300
    );
  return jsonb_build_object(
    'agora', now(),
    'cheio', jsonb_array_length(v_mensagens) >= 300,
    'lidas', coalesce((select jsonb_object_agg(l.sala, l.lida_ate) from public.chat_leituras l where l.pessoa = v_quem), '{}'::jsonb),
    'mensagens', v_mensagens
  );
end
$$;

/** As mensagens mais antigas de uma sala, para "carregar anteriores". */
create function public.chat_anteriores(p_sala text, p_antes bigint, p_limite integer default 40)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_n integer := least(greatest(coalesce(p_limite, 40), 10), 100);
  v_mensagens jsonb;
begin
  if not coalesce(public.tem_acesso('time'), false) then
    return null;
  end if;
  select coalesce(jsonb_agg(public.chat_mensagem_json(m) order by m.id), '[]'::jsonb)
    into v_mensagens
    from public.chat_mensagens m
    where m.id in (
      select c.id from public.chat_mensagens c
      where c.sala = p_sala and c.id < coalesce(p_antes, 0)
      order by c.id desc
      limit v_n
    );
  return jsonb_build_object(
    'mensagens', v_mensagens,
    'tem_mais', exists (
      select 1 from public.chat_mensagens c
      where c.sala = p_sala and c.id < coalesce((select min((x->>'id')::bigint) from jsonb_array_elements(v_mensagens) x), 0))
  );
end
$$;

/**
 * O número do menu e da Visão geral. `novas`: mensagens dos últimos 7 dias que
 * a pessoa não leu, na sala geral, nas salas do setor dela e em resposta a uma
 * mensagem dela (em qualquer sala). `pedidos`: pedidos que esperam o setor
 * dela e que ela JÁ leu (os não lidos estão em `novas`, para não contar duas
 * vezes). `pedidos_do_setor` e `desde`: todos os que esperam o setor dela, e
 * há quanto tempo espera o mais antigo.
 */
create function public.chat_resumo()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_quem uuid := (select auth.uid());
  v_setores text[];
begin
  if not coalesce(public.tem_acesso('time'), false) then
    return jsonb_build_object('novas', 0, 'pedidos', 0, 'pedidos_do_setor', 0, 'desde', null);
  end if;
  v_setores := public.meus_setores();
  return (
    with salas as (
      select s.sala,
             coalesce(l.lida_ate, 0) as lida_ate,
             (s.sala = 'geral' or s.sala = any (v_setores)) as minha,
             s.sala = any (v_setores) as do_setor
      from unnest(array['geral', 'vendas', 'fabrica', 'loja', 'trafego', 'diretoria']) as s (sala)
      left join public.chat_leituras l on l.pessoa = v_quem and l.sala = s.sala
    ),
    esperando as (
      select c.id, c.esperando_desde, c.id <= s.lida_ate as lido
      from public.chat_mensagens c
      join salas s on s.sala = c.sala and s.do_setor
      where c.pede_resposta and c.atendida_em is null and c.apagada_em is null
        and c.autor is distinct from v_quem
    )
    select jsonb_build_object(
      'novas', (
        select count(*)
        from salas s
        join public.chat_mensagens c on c.sala = s.sala and c.id > s.lida_ate
        where c.apagada_em is null
          and c.autor is distinct from v_quem
          and c.criada_em > now() - interval '7 days'
          and (s.minha or exists (select 1 from public.chat_mensagens o where o.id = c.responde_a and o.autor = v_quem))),
      'pedidos', (select count(*) from esperando e where e.lido),
      'pedidos_do_setor', (select count(*) from esperando),
      'desde', (select min(e.esperando_desde) from esperando e)
    )
  );
end
$$;

/** O caminho das imagens, para o servidor assinar o link. Só de mensagem que não foi apagada. */
create function public.chat_caminhos(p_anexos uuid[])
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'caminho', a.caminho)), '[]'::jsonb)
  from public.chat_anexos a
  join public.chat_mensagens m on m.id = a.mensagem_id
  where a.id = any (p_anexos[1:60])
    and m.apagada_em is null
    and (select public.tem_acesso('time'))
$$;

-- ------------------------------------------------------------------- escrita

/**
 * Manda uma mensagem. Responder ao pedido de OUTRA pessoa marca o pedido como
 * atendido. Erro de imagem vem como exceção `P0001`, para desfazer a mensagem
 * inteira.
 */
create function public.chat_enviar(
  p_sala text,
  p_texto text,
  p_responde_a bigint default null,
  p_pede boolean default false,
  p_anexos jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quem uuid := (select auth.uid());
  v_texto text := btrim(coalesce(p_texto, ''));
  v_pede boolean := coalesce(p_pede, false);
  v_tem_imagem boolean := p_anexos is not null and jsonb_typeof(p_anexos) = 'array' and jsonb_array_length(p_anexos) > 0;
  v_id bigint;
  v_erro text;
  o public.chat_mensagens%rowtype;
  m public.chat_mensagens%rowtype;
begin
  if not coalesce(public.tem_acesso('time'), false) then
    return jsonb_build_object('ok', false, 'erro', 'Seu acesso não inclui o chat do time.');
  end if;
  if p_sala is null or p_sala not in ('geral', 'vendas', 'fabrica', 'loja', 'trafego', 'diretoria') then
    return jsonb_build_object('ok', false, 'erro', 'Sala desconhecida.');
  end if;
  if v_texto = '' and not v_tem_imagem then
    return jsonb_build_object('ok', false, 'erro', 'Escreva a mensagem ou mande uma imagem.');
  end if;
  if char_length(v_texto) > 4000 then
    return jsonb_build_object('ok', false, 'erro', 'A mensagem passou de 4.000 letras.');
  end if;
  if (select count(*) from public.chat_mensagens c where c.autor = v_quem and c.criada_em > now() - interval '1 minute') >= 30 then
    return jsonb_build_object('ok', false, 'erro', 'Muitas mensagens em um minuto. Espere um pouco e mande de novo.');
  end if;
  if p_responde_a is not null then
    select * into o from public.chat_mensagens where id = p_responde_a for update;
    if not found or o.sala <> p_sala or o.apagada_em is not null then
      return jsonb_build_object('ok', false, 'erro', 'A mensagem que você ia responder não está mais nesta sala.');
    end if;
  end if;

  insert into public.chat_mensagens (sala, autor, texto, responde_a, pede_resposta, esperando_desde)
  values (p_sala, v_quem, v_texto, p_responde_a, v_pede, case when v_pede then now() end)
  returning id into v_id;

  v_erro := public.chat_prender_anexos(v_id, p_anexos, v_quem);
  if v_erro is not null then
    raise exception '%', v_erro using errcode = 'P0001';
  end if;

  if p_responde_a is not null then
    -- Toca na mensagem respondida mesmo sem mudar o estado: a contagem de respostas dela mudou.
    update public.chat_mensagens set
      atendida_em = case when pede_resposta and atendida_em is null and autor is distinct from v_quem then now() else atendida_em end,
      atendida_por = case when pede_resposta and atendida_em is null and autor is distinct from v_quem then v_quem else atendida_por end,
      atualizada_em = now()
    where id = p_responde_a;
  end if;

  -- Quem escreve na sala leu a sala.
  insert into public.chat_leituras (pessoa, sala, lida_ate) values (v_quem, p_sala, v_id)
  on conflict (pessoa, sala) do update
    set lida_ate = greatest(public.chat_leituras.lida_ate, excluded.lida_ate), atualizada_em = now();

  select * into m from public.chat_mensagens where id = v_id;
  return jsonb_build_object('ok', true, 'mensagem', public.chat_mensagem_json(m));
end
$$;

/**
 * Marca um pedido como resolvido. Qualquer pessoa do time marca, porque no
 * chat a resposta muitas vezes vem numa mensagem solta, sem "responder": fica
 * gravado quem marcou.
 */
create function public.chat_resolver(p_mensagem bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quem uuid := (select auth.uid());
  m public.chat_mensagens%rowtype;
begin
  if not coalesce(public.tem_acesso('time'), false) then
    return jsonb_build_object('ok', false, 'erro', 'Seu acesso não inclui o chat do time.');
  end if;
  select * into m from public.chat_mensagens where id = p_mensagem for update;
  if not found or m.apagada_em is not null then
    return jsonb_build_object('ok', false, 'erro', 'Mensagem não encontrada.');
  end if;
  if not m.pede_resposta then
    return jsonb_build_object('ok', false, 'erro', 'Essa mensagem não pede resposta.');
  end if;
  if m.atendida_em is null then
    update public.chat_mensagens set atendida_em = now(), atendida_por = v_quem where id = m.id returning * into m;
  end if;
  return jsonb_build_object('ok', true, 'mensagem', public.chat_mensagem_json(m));
end
$$;

/**
 * Faz a mensagem pedir resposta: serve para quem esqueceu de pedir ao mandar e
 * para quem recebeu uma resposta que não resolveu ("ainda preciso"). Só quem
 * escreveu a mensagem, ou a diretoria. O relógio recomeça.
 */
create function public.chat_pedir(p_mensagem bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quem uuid := (select auth.uid());
  m public.chat_mensagens%rowtype;
begin
  if not coalesce(public.tem_acesso('time'), false) then
    return jsonb_build_object('ok', false, 'erro', 'Seu acesso não inclui o chat do time.');
  end if;
  select * into m from public.chat_mensagens where id = p_mensagem for update;
  if not found or m.apagada_em is not null then
    return jsonb_build_object('ok', false, 'erro', 'Mensagem não encontrada.');
  end if;
  -- `coalesce`: mensagem sem autor dá NULL na comparação, e NULL num `if not` deixaria passar.
  if not coalesce(m.autor = v_quem or public.is_admin(), false) then
    return jsonb_build_object('ok', false, 'erro', 'Só quem escreveu a mensagem pede resposta para ela.');
  end if;
  update public.chat_mensagens
     set pede_resposta = true, esperando_desde = now(), atendida_em = null, atendida_por = null
   where id = m.id
   returning * into m;
  return jsonb_build_object('ok', true, 'mensagem', public.chat_mensagem_json(m));
end
$$;

/** Tira a mensagem da tela. Só quem escreveu, ou a diretoria. A linha fica no banco. */
create function public.chat_apagar(p_mensagem bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quem uuid := (select auth.uid());
  m public.chat_mensagens%rowtype;
begin
  if not coalesce(public.tem_acesso('time'), false) then
    return jsonb_build_object('ok', false, 'erro', 'Seu acesso não inclui o chat do time.');
  end if;
  select * into m from public.chat_mensagens where id = p_mensagem for update;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Mensagem não encontrada.');
  end if;
  if not coalesce(m.autor = v_quem or public.is_admin(), false) then
    return jsonb_build_object('ok', false, 'erro', 'Só quem escreveu a mensagem apaga.');
  end if;
  if m.apagada_em is null then
    update public.chat_mensagens set apagada_em = now(), apagada_por = v_quem where id = m.id returning * into m;
    -- Quem respondeu a ela mostra um trecho dela: precisa chegar de novo à tela, sem o trecho.
    update public.chat_mensagens set atualizada_em = now() where responde_a = m.id;
  end if;
  return jsonb_build_object('ok', true, 'mensagem', public.chat_mensagem_json(m));
end
$$;

/** Guarda até onde a pessoa leu a sala. Nunca anda para trás. */
create function public.chat_marcar_lida(p_sala text, p_ate bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quem uuid := (select auth.uid());
  v_ate bigint;
begin
  if not coalesce(public.tem_acesso('time'), false) then
    return jsonb_build_object('ok', false);
  end if;
  if p_sala is null or p_sala not in ('geral', 'vendas', 'fabrica', 'loja', 'trafego', 'diretoria') then
    return jsonb_build_object('ok', false);
  end if;
  -- Não aceita "li até a mensagem um milhão": o teto é a última que existe na sala.
  select least(coalesce(p_ate, 0), coalesce(max(c.id), 0)) into v_ate from public.chat_mensagens c where c.sala = p_sala;
  insert into public.chat_leituras (pessoa, sala, lida_ate) values (v_quem, p_sala, v_ate)
  on conflict (pessoa, sala) do update
    set lida_ate = greatest(public.chat_leituras.lida_ate, excluded.lida_ate), atualizada_em = now();
  return jsonb_build_object('ok', true);
end
$$;

/**
 * "Guardar na biblioteca": a mensagem que já tem resposta de outra pessoa vira
 * uma resposta "a confirmar", com a origem escrita pelo banco. É o laço que
 * faz a biblioteca crescer, o mesmo que os chamados tinham.
 */
create function public.chat_virar_resposta(
  p_mensagem bigint,
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
  v_sala text;
  m public.chat_mensagens%rowtype;
  r public.chat_mensagens%rowtype;
begin
  if not coalesce(public.tem_acesso('time'), false) then
    return jsonb_build_object('ok', false, 'erro', 'Seu acesso não inclui a biblioteca.');
  end if;
  select * into m from public.chat_mensagens where id = p_mensagem for update;
  if not found or m.apagada_em is not null then
    return jsonb_build_object('ok', false, 'erro', 'Mensagem não encontrada.');
  end if;
  select * into r from public.chat_mensagens c
   where c.responde_a = m.id and c.apagada_em is null and c.autor is distinct from m.autor
   order by c.id
   limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Essa mensagem ainda não tem resposta de outra pessoa.');
  end if;
  if exists (select 1 from public.biblioteca_respostas b where b.mensagem_id = m.id) then
    return jsonb_build_object('ok', false, 'erro', 'Essa conversa já virou resposta da biblioteca.');
  end if;
  v_sala := case m.sala
    when 'geral' then 'Geral' when 'vendas' then 'Vendas' when 'fabrica' then 'Fábrica'
    when 'loja' then 'Loja' when 'trafego' then 'Tráfego' else 'Diretoria' end;
  v_origem := 'Chat do time, sala ' || v_sala
    || coalesce(', respondido por ' || public.chat_nome(r.autor), '')
    || ' em ' || to_char(r.criada_em at time zone 'America/Sao_Paulo', 'DD/MM/YYYY');
  v_erro := public.biblioteca_conferir(p_tema, p_pergunta, p_explicacao, p_frase, v_origem);
  if v_erro is not null then
    return jsonb_build_object('ok', false, 'erro', v_erro);
  end if;

  insert into public.biblioteca_respostas (tema, pergunta, explicacao, frase, origem, criado_por, atualizado_por, mensagem_id)
  values (p_tema, btrim(p_pergunta), btrim(p_explicacao), nullif(btrim(coalesce(p_frase, '')), ''), v_origem, v_quem, v_quem, m.id)
  returning id into v_id;

  insert into public.biblioteca_alteracoes (resposta_id, acao, por) values (v_id, 'sugeriu', v_quem);
  -- Para a tela saber que a mensagem agora tem resposta na biblioteca.
  update public.chat_mensagens set atualizada_em = now() where id = m.id;
  return jsonb_build_object('ok', true, 'id', v_id);
end
$$;

-- A lista da biblioteca passa a dizer de que conversa do chat a resposta nasceu.
-- Não olha mais a tabela de chamados, que a 0080 tira.
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
    'conversa', (select jsonb_build_object('sala', c.sala, 'mensagem', c.id) from public.chat_mensagens c where c.id = r.mensagem_id)
  ) order by r.criado_em, r.id), '[]'::jsonb)
  from public.biblioteca_respostas r
  where (select public.tem_acesso('time'))
    and (r.estado <> 'arquivada' or (select public.is_admin()))
$$;

-- ---------------------------------------------------------------- permissões

revoke execute on function public.chat_tocar() from public, anon, authenticated;
revoke execute on function public.chat_nome(uuid) from public, anon, authenticated;
revoke execute on function public.chat_mensagem_json(public.chat_mensagens) from public, anon, authenticated;
revoke execute on function public.chat_prender_anexos(bigint, jsonb, uuid) from public, anon, authenticated;

revoke execute on function public.chat_abrir(integer) from public, anon;
revoke execute on function public.chat_sincronizar(timestamptz) from public, anon;
revoke execute on function public.chat_anteriores(text, bigint, integer) from public, anon;
revoke execute on function public.chat_resumo() from public, anon;
revoke execute on function public.chat_caminhos(uuid[]) from public, anon;
revoke execute on function public.chat_enviar(text, text, bigint, boolean, jsonb) from public, anon;
revoke execute on function public.chat_resolver(bigint) from public, anon;
revoke execute on function public.chat_pedir(bigint) from public, anon;
revoke execute on function public.chat_apagar(bigint) from public, anon;
revoke execute on function public.chat_marcar_lida(text, bigint) from public, anon;
revoke execute on function public.chat_virar_resposta(bigint, text, text, text, text) from public, anon;
grant execute on function public.chat_abrir(integer) to authenticated;
grant execute on function public.chat_sincronizar(timestamptz) to authenticated;
grant execute on function public.chat_anteriores(text, bigint, integer) to authenticated;
grant execute on function public.chat_resumo() to authenticated;
grant execute on function public.chat_caminhos(uuid[]) to authenticated;
grant execute on function public.chat_enviar(text, text, bigint, boolean, jsonb) to authenticated;
grant execute on function public.chat_resolver(bigint) to authenticated;
grant execute on function public.chat_pedir(bigint) to authenticated;
grant execute on function public.chat_apagar(bigint) to authenticated;
grant execute on function public.chat_marcar_lida(text, bigint) to authenticated;
grant execute on function public.chat_virar_resposta(bigint, text, text, text, text) to authenticated;

-- ------------------------------------------------------------ o canal ao vivo
--
-- O Realtime confere estas duas policies quando alguém entra num canal
-- privado. Sem elas, ninguém entra em canal privado nenhum (a tabela tem RLS
-- ligada e não tinha policy). Elas liberam UM canal, `painel:time`, e só para
-- quem tem a área `time`:
--   leitura  receber o aviso de mensagem nova e ver quem está online;
--   escrita  mandar o aviso de mensagem nova e dizer "estou online".
-- O aviso não leva texto: leva o número e a sala da mensagem.

create policy "painel_time_recebe" on realtime.messages
  for select to authenticated
  using ((select realtime.topic()) = 'painel:time' and (select public.tem_acesso('time')));

create policy "painel_time_envia" on realtime.messages
  for insert to authenticated
  with check (
    (select realtime.topic()) = 'painel:time'
    and extension in ('broadcast', 'presence')
    and (select public.tem_acesso('time'))
  );
