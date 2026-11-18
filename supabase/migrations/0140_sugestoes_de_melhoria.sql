-- Sugestões de melhoria do painel: o roadmap que o próprio time escreve.
--
-- Pedido do dono em 17/11/2026: em toda tela, um botão "Sugerir melhoria" que
-- abre uma janela para escrever o que seria bom ter e anexar prints, e tudo
-- fica guardado num roadmap de sugestões.
--
-- QUEM VÊ O QUÊ. Qualquer pessoa ativa sugere (área `time`, a única que todo
-- nível tem) e vê as PRÓPRIAS sugestões, com o estado e a resposta. Só a
-- diretoria (`is_admin()`: administrador, dono e GM) vê todas e muda o estado.
-- Não é um mural aberto de propósito: o print de uma tela do painel pode
-- mostrar faturamento ou nome de cliente.
--
-- OS PRINTS. Ficam no balde PRIVADO `sugestoes`, sempre em webp, na pasta de
-- quem sugeriu (`<id da pessoa>/<uuid>.webp`). Quem converte e grava é o
-- servidor (`/api/painel/sugestoes`, com o sharp e a chave de serviço): o
-- navegador do iPhone não sabe gerar webp. Ninguém lê o balde direto; a
-- imagem abre por link assinado, emitido depois de a função de leitura dizer
-- que a pessoa pode ver aquela sugestão.
--
-- Tabela com RLS ligada e SEM policy: tudo passa pelas funções abaixo, que
-- conferem o acesso por dentro, em `coalesce(..., false)`.

create table public.sugestoes (
  id bigint generated always as identity primary key,
  criada_em timestamptz not null default now(),
  autor uuid not null references public.profiles (id),
  -- Onde a pessoa estava: o endereço, o nome da tela e o tamanho da janela.
  tela text not null check (char_length(tela) <= 200),
  tela_nome text check (char_length(tela_nome) <= 120),
  aparelho text check (aparelho in ('celular', 'computador')),
  janela text check (char_length(janela) <= 20),
  texto text not null check (char_length(btrim(texto)) between 5 and 4000),
  imagens text[] not null default '{}' check (cardinality(imagens) <= 4),
  estado text not null default 'nova' check (estado in ('nova', 'planejada', 'em_andamento', 'feita', 'recusada')),
  resposta text check (char_length(resposta) <= 2000),
  estado_mudou_em timestamptz,
  estado_por uuid references public.profiles (id)
);

create index sugestoes_autor_idx on public.sugestoes (autor, criada_em desc);
create index sugestoes_estado_idx on public.sugestoes (estado, criada_em desc);

alter table public.sugestoes enable row level security;
revoke all on public.sugestoes from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sugestoes', 'sugestoes', false, 3145728, array['image/webp'])
on conflict (id) do nothing;

-- Registrar uma sugestão. As imagens já estão no balde (o servidor gravou
-- antes): aqui se confere que cada uma é da pasta de quem sugere, tem o nome
-- no formato do servidor e existe de fato.
create or replace function public.sugestao_enviar(
  p_tela text,
  p_tela_nome text,
  p_aparelho text,
  p_janela text,
  p_texto text,
  p_imagens text[] default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu      uuid := (select auth.uid());
  v_texto   text := btrim(coalesce(p_texto, ''));
  v_imagens text[] := coalesce(p_imagens, '{}');
  v_caminho text;
  v_id      bigint;
begin
  if v_eu is null or not coalesce(public.tem_acesso('time'), false) then
    return jsonb_build_object('ok', false, 'motivo', 'sem_acesso');
  end if;
  if char_length(v_texto) < 5 or char_length(v_texto) > 4000 then
    return jsonb_build_object('ok', false, 'motivo', 'texto');
  end if;
  if cardinality(v_imagens) > 4 then
    return jsonb_build_object('ok', false, 'motivo', 'imagens');
  end if;
  -- Teto para um envio repetido sem querer não encher o roadmap.
  if (select count(*) from public.sugestoes s where s.autor = v_eu and s.criada_em > now() - interval '1 day') >= 30 then
    return jsonb_build_object('ok', false, 'motivo', 'teto');
  end if;

  foreach v_caminho in array v_imagens loop
    if v_caminho !~ ('^' || v_eu::text || '/[0-9a-f-]{36}\.webp$')
       or not exists (select 1 from storage.objects o where o.bucket_id = 'sugestoes' and o.name = v_caminho) then
      return jsonb_build_object('ok', false, 'motivo', 'imagem');
    end if;
  end loop;

  insert into public.sugestoes (autor, tela, tela_nome, aparelho, janela, texto, imagens)
  values (
    v_eu,
    left(coalesce(nullif(btrim(p_tela), ''), '/admin'), 200),
    left(nullif(btrim(coalesce(p_tela_nome, '')), ''), 120),
    case when p_aparelho in ('celular', 'computador') then p_aparelho end,
    left(nullif(btrim(coalesce(p_janela, '')), ''), 20),
    v_texto,
    v_imagens
  )
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

-- O roadmap. A diretoria recebe todas; os outros, só as próprias.
create or replace function public.sugestoes_lista()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with quem as (
    select (select auth.uid()) as eu,
           coalesce((select public.is_admin()), false) as diretoria,
           coalesce((select public.tem_acesso('time')), false) as pode
  ),
  visiveis as (
    select s.*
    from public.sugestoes s, quem q
    where q.pode and q.eu is not null and (q.diretoria or s.autor = q.eu)
    order by s.criada_em desc
    limit 400
  )
  select jsonb_build_object(
    'eu', (select eu from quem),
    'diretoria', (select diretoria from quem),
    'itens', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', v.id,
        'criada_em', v.criada_em,
        'minha', v.autor = (select eu from quem),
        'autor', a.full_name,
        'tela', v.tela,
        'tela_nome', v.tela_nome,
        'aparelho', v.aparelho,
        'janela', v.janela,
        'texto', v.texto,
        'imagens', to_jsonb(v.imagens),
        'estado', v.estado,
        'resposta', v.resposta,
        'estado_mudou_em', v.estado_mudou_em,
        'estado_por', e.full_name
      ) order by v.criada_em desc)
      from visiveis v
      left join public.profiles a on a.id = v.autor
      left join public.profiles e on e.id = v.estado_por
    ), '[]'::jsonb)
  )
$$;

-- Mudar o estado e responder. Só a diretoria.
create or replace function public.sugestao_mudar(p_id bigint, p_estado text, p_resposta text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu uuid := (select auth.uid());
begin
  if v_eu is null or not coalesce(public.is_admin(), false) then
    return jsonb_build_object('ok', false, 'motivo', 'sem_acesso');
  end if;
  if p_estado is null or p_estado not in ('nova', 'planejada', 'em_andamento', 'feita', 'recusada') then
    return jsonb_build_object('ok', false, 'motivo', 'estado');
  end if;
  update public.sugestoes s
  set estado = p_estado,
      resposta = left(nullif(btrim(coalesce(p_resposta, '')), ''), 2000),
      estado_mudou_em = now(),
      estado_por = v_eu
  where s.id = p_id;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'nao_achou');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- Quantas esperam a diretoria olhar: o número do item no menu. Zero para os outros.
create or replace function public.sugestoes_novas()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case when coalesce((select public.is_admin()), false)
    then (select count(*)::integer from public.sugestoes s where s.estado = 'nova')
    else 0 end
$$;

revoke execute on function public.sugestao_enviar(text, text, text, text, text, text[]) from public, anon;
revoke execute on function public.sugestoes_lista() from public, anon;
revoke execute on function public.sugestao_mudar(bigint, text, text) from public, anon;
revoke execute on function public.sugestoes_novas() from public, anon;
grant execute on function public.sugestao_enviar(text, text, text, text, text, text[]) to authenticated, service_role;
grant execute on function public.sugestoes_lista() to authenticated, service_role;
grant execute on function public.sugestao_mudar(bigint, text, text) to authenticated, service_role;
grant execute on function public.sugestoes_novas() to authenticated, service_role;
