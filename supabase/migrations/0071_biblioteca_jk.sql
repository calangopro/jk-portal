-- 0071: a Biblioteca JK e a área `time`.
--
-- De onde veio: o grupo do time de vendas no WhatsApp, lido em 14/11/2026. Em
-- dois dias e meio o vendedor novo fez 58 perguntas, duas pessoas responderam
-- 96% delas, a mesma pergunta voltou várias vezes e a mesma regra teve duas
-- respostas no mesmo dia. Faltava um lugar onde a resposta da casa ficasse
-- escrita, com o estado dela à vista: confirmada pela JK, ou ainda não.
--
-- ORDEM DE APLICAÇÃO. Esta migration e a 0072 foram aplicadas DEPOIS da 0073 e
-- da 0074, porque os números foram reservados para sessões que trabalharam ao
-- mesmo tempo. Num banco novo, rodar na ordem do nome quebraria: a 0073 refaz a
-- trava de áreas sem `time`. Por isso a primeira coisa aqui é conferir que a
-- 0073 já passou, e falhar com a instrução certa se não passou.
do $$
begin
  if to_regclass('public.pronta_entrega') is null then
    raise exception 'Aplique a 0073 e a 0074 antes da 0071 e da 0072: foi nessa ordem que elas entraram no banco.';
  end if;
end
$$;

-- TRÊS MUDANÇAS:
--
-- 1. Área nova, `time`, para TODOS os níveis: é o setor onde a casa conversa
--    (biblioteca e chamados), e ninguém fica de fora dele.
--
-- 2. `biblioteca_respostas`: uma resposta por pergunta, com o tema, a
--    explicação para quem atende, a frase pronta para o cliente, o estado e de
--    onde ela veio. Nada se apaga: resposta que não vale mais é arquivada.
--
-- 3. `biblioteca_alteracoes`: quem sugeriu, editou, confirmou e arquivou, com o
--    texto de antes. É o que permite ver quando uma regra mudou e por quem.
--
-- Ninguém lê nem grava direto nas tabelas (RLS ligada, sem policy). Tudo passa
-- por função que confere a área e guarda o autor. Qualquer pessoa ativa lê e
-- sugere; só administrador, dono e GM confirmam, editam o que já foi
-- confirmado e arquivam.
--
-- O CONTEÚDO não está aqui, de propósito: as respostas trazem valor em
-- dinheiro e regra interna da casa, e entram direto no banco e pelo painel.

alter table public.acessos_por_papel drop constraint acessos_por_papel_area_check;
alter table public.acessos_por_papel add constraint acessos_por_papel_area_check check (area in (
  'conteudo', 'site', 'catalogo', 'campanhas', 'vendas', 'recuperacao',
  'metricas', 'anuncios', 'margem', 'custos', 'equipe', 'fabrica', 'lancar_venda',
  'trafego', 'loja', 'consulta', 'time'));

insert into public.acessos_por_papel (papel, area)
select p, 'time'
from unnest(array['admin', 'dono', 'gm', 'gerente', 'trafego', 'vendas', 'fabrica', 'editor', 'reviewer', 'author']) as p
on conflict do nothing;

create table public.biblioteca_respostas (
  id             uuid primary key default gen_random_uuid(),
  tema           text not null check (tema in (
                   'estoque_prazo', 'preco_personalizado', 'troca', 'pos_venda',
                   'gravacao_produto', 'pagamento_pedido', 'processo')),
  -- A pergunta do jeito que o vendedor faz, não como título de manual.
  pergunta       text not null check (char_length(pergunta) between 5 and 300),
  -- A explicação é para quem atende. A frase é o que vai para o cliente.
  explicacao     text not null check (char_length(explicacao) between 5 and 4000),
  frase          text check (frase is null or char_length(frase) between 1 and 2000),
  estado         text not null default 'a_confirmar' check (estado in ('a_confirmar', 'confirmada', 'arquivada')),
  -- De onde veio: "dito no grupo do time em novembro de 2026, pela dona".
  origem         text check (origem is null or char_length(origem) <= 300),
  criado_por     uuid references public.profiles (id) on delete set null,
  criado_em      timestamptz not null default now(),
  confirmado_por uuid references public.profiles (id) on delete set null,
  confirmado_em  timestamptz,
  atualizado_por uuid references public.profiles (id) on delete set null,
  atualizado_em  timestamptz not null default now(),
  constraint biblioteca_confirmada_tem_data check (estado <> 'confirmada' or confirmado_em is not null)
);

comment on table public.biblioteca_respostas is
  'As respostas da casa para quem atende cliente. Cada uma diz se a JK já confirmou. Nada se apaga: o que não vale mais é arquivado.';

create index biblioteca_respostas_estado_idx on public.biblioteca_respostas (estado, tema);
create index biblioteca_respostas_criado_por_idx on public.biblioteca_respostas (criado_por);
create index biblioteca_respostas_confirmado_por_idx on public.biblioteca_respostas (confirmado_por);
create index biblioteca_respostas_atualizado_por_idx on public.biblioteca_respostas (atualizado_por);

create table public.biblioteca_alteracoes (
  id          bigint generated always as identity primary key,
  resposta_id uuid not null references public.biblioteca_respostas (id) on delete cascade,
  acao        text not null check (acao in ('sugeriu', 'editou', 'confirmou', 'arquivou', 'reabriu')),
  -- Como a resposta estava antes da mudança. Vazio na sugestão.
  antes       jsonb,
  por         uuid references public.profiles (id) on delete set null,
  em          timestamptz not null default now()
);

comment on table public.biblioteca_alteracoes is
  'Quem sugeriu, editou, confirmou e arquivou cada resposta da biblioteca, com o texto de antes.';

create index biblioteca_alteracoes_resposta_idx on public.biblioteca_alteracoes (resposta_id, em);
create index biblioteca_alteracoes_por_idx on public.biblioteca_alteracoes (por);

alter table public.biblioteca_respostas enable row level security;
alter table public.biblioteca_alteracoes enable row level security;
revoke all on public.biblioteca_respostas from anon, authenticated;
revoke all on public.biblioteca_alteracoes from anon, authenticated;

/**
 * A biblioteca inteira, com o nome de quem sugeriu e de quem confirmou. Função,
 * e não leitura direta, porque o nome mora em `profiles`, que vendas e fábrica
 * não leem. Resposta arquivada só volta para administrador, dono e GM.
 */
create function public.biblioteca_listar()
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
    'atualizado_em', r.atualizado_em
  ) order by r.criado_em, r.id), '[]'::jsonb)
  from public.biblioteca_respostas r
  where (select public.tem_acesso('time'))
    and (r.estado <> 'arquivada' or (select public.is_admin()))
$$;

/** Confere os textos de uma resposta. Devolve a mensagem para a pessoa, ou null quando está tudo certo. */
create function public.biblioteca_conferir(p_tema text, p_pergunta text, p_explicacao text, p_frase text, p_origem text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_tema is null or p_tema not in ('estoque_prazo', 'preco_personalizado', 'troca', 'pos_venda', 'gravacao_produto', 'pagamento_pedido', 'processo')
      then 'Escolha o tema da resposta.'
    when char_length(btrim(coalesce(p_pergunta, ''))) < 5 then 'Escreva a pergunta, do jeito que ela chega.'
    when char_length(btrim(p_pergunta)) > 300 then 'A pergunta passou de 300 letras.'
    when char_length(btrim(coalesce(p_explicacao, ''))) < 5 then 'Escreva a explicação para quem atende.'
    when char_length(btrim(p_explicacao)) > 4000 then 'A explicação passou de 4.000 letras.'
    when char_length(btrim(coalesce(p_frase, ''))) > 2000 then 'A frase pronta passou de 2.000 letras.'
    when char_length(btrim(coalesce(p_origem, ''))) > 300 then 'O campo de onde veio passou de 300 letras.'
    else null
  end
$$;

/** Sugere uma resposta. Qualquer pessoa ativa pode: ela entra como "a confirmar". */
create function public.sugerir_resposta(
  p_tema text,
  p_pergunta text,
  p_explicacao text,
  p_frase text default null,
  p_origem text default null
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
begin
  if not public.tem_acesso('time') then
    return jsonb_build_object('ok', false, 'erro', 'Seu acesso não inclui a biblioteca.');
  end if;
  v_erro := public.biblioteca_conferir(p_tema, p_pergunta, p_explicacao, p_frase, p_origem);
  if v_erro is not null then
    return jsonb_build_object('ok', false, 'erro', v_erro);
  end if;

  insert into public.biblioteca_respostas (tema, pergunta, explicacao, frase, origem, criado_por, atualizado_por)
  values (p_tema, btrim(p_pergunta), btrim(p_explicacao), nullif(btrim(coalesce(p_frase, '')), ''), nullif(btrim(coalesce(p_origem, '')), ''), v_quem, v_quem)
  returning id into v_id;

  insert into public.biblioteca_alteracoes (resposta_id, acao, por) values (v_id, 'sugeriu', v_quem);
  return jsonb_build_object('ok', true, 'id', v_id);
end
$$;

/**
 * Edita uma resposta. Administrador, dono e GM editam qualquer uma; quem
 * sugeriu edita a própria enquanto ela ainda está "a confirmar". Editar uma
 * resposta confirmada é confirmar o texto novo: fica o nome de quem editou.
 */
create function public.editar_resposta(
  p_id uuid,
  p_tema text,
  p_pergunta text,
  p_explicacao text,
  p_frase text default null,
  p_origem text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quem uuid := (select auth.uid());
  v_admin boolean := public.is_admin();
  v_erro text;
  r public.biblioteca_respostas%rowtype;
begin
  if not public.tem_acesso('time') then
    return jsonb_build_object('ok', false, 'erro', 'Seu acesso não inclui a biblioteca.');
  end if;
  select * into r from public.biblioteca_respostas where id = p_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Resposta não encontrada.');
  end if;
  -- `coalesce`: resposta sem autor (a semente) daria NULL na comparação, e NULL num `if` deixaria passar.
  if not v_admin and not coalesce(r.estado = 'a_confirmar' and r.criado_por = v_quem, false) then
    return jsonb_build_object('ok', false, 'erro', 'Só administrador, dono ou GM edita esta resposta.');
  end if;
  v_erro := public.biblioteca_conferir(p_tema, p_pergunta, p_explicacao, p_frase, p_origem);
  if v_erro is not null then
    return jsonb_build_object('ok', false, 'erro', v_erro);
  end if;

  insert into public.biblioteca_alteracoes (resposta_id, acao, antes, por)
  values (r.id, 'editou', jsonb_build_object(
    'tema', r.tema, 'pergunta', r.pergunta, 'explicacao', r.explicacao, 'frase', r.frase, 'origem', r.origem, 'estado', r.estado), v_quem);

  update public.biblioteca_respostas set
    tema = p_tema,
    pergunta = btrim(p_pergunta),
    explicacao = btrim(p_explicacao),
    frase = nullif(btrim(coalesce(p_frase, '')), ''),
    origem = nullif(btrim(coalesce(p_origem, '')), ''),
    atualizado_por = v_quem,
    atualizado_em = now(),
    confirmado_por = case when r.estado = 'confirmada' then v_quem else confirmado_por end,
    confirmado_em = case when r.estado = 'confirmada' then now() else confirmado_em end
  where id = r.id;

  return jsonb_build_object('ok', true);
end
$$;

/**
 * Confirma, arquiva ou devolve uma resposta para "a confirmar". Só
 * administrador, dono e GM. Confirmar guarda quem confirmou e quando.
 */
create function public.definir_estado_da_resposta(p_id uuid, p_estado text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quem uuid := (select auth.uid());
  r public.biblioteca_respostas%rowtype;
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'erro', 'Só administrador, dono ou GM confirma ou arquiva uma resposta.');
  end if;
  if p_estado is null or p_estado not in ('a_confirmar', 'confirmada', 'arquivada') then
    return jsonb_build_object('ok', false, 'erro', 'Estado desconhecido.');
  end if;
  select * into r from public.biblioteca_respostas where id = p_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Resposta não encontrada.');
  end if;
  if r.estado = p_estado then
    return jsonb_build_object('ok', true);
  end if;

  insert into public.biblioteca_alteracoes (resposta_id, acao, antes, por)
  values (
    r.id,
    case p_estado when 'confirmada' then 'confirmou' when 'arquivada' then 'arquivou' else 'reabriu' end,
    jsonb_build_object('estado', r.estado),
    v_quem);

  update public.biblioteca_respostas set
    estado = p_estado,
    atualizado_por = v_quem,
    atualizado_em = now(),
    -- Arquivar guarda quem tinha confirmado. Voltar para "a confirmar" apaga a confirmação.
    confirmado_por = case p_estado when 'confirmada' then v_quem when 'a_confirmar' then null else confirmado_por end,
    confirmado_em = case p_estado when 'confirmada' then now() when 'a_confirmar' then null else confirmado_em end
  where id = r.id;

  return jsonb_build_object('ok', true);
end
$$;

revoke execute on function public.biblioteca_listar() from public, anon;
revoke execute on function public.biblioteca_conferir(text, text, text, text, text) from public, anon;
revoke execute on function public.sugerir_resposta(text, text, text, text, text) from public, anon;
revoke execute on function public.editar_resposta(uuid, text, text, text, text, text) from public, anon;
revoke execute on function public.definir_estado_da_resposta(uuid, text) from public, anon;
grant execute on function public.biblioteca_listar() to authenticated;
grant execute on function public.sugerir_resposta(text, text, text, text, text) to authenticated;
grant execute on function public.editar_resposta(uuid, text, text, text, text, text) to authenticated;
grant execute on function public.definir_estado_da_resposta(uuid, text) to authenticated;
