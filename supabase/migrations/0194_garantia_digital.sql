-- 0194: Garantia digital com QR (cartão 65).
--
-- Troca o folder impresso de três páginas por um cartão pequeno com QR. Cada
-- trabalho da fábrica pode ter UMA garantia (`garantias`), com um CÓDIGO
-- ÚNICO de 10 letras e números (sem I, O, 0 e 1, que se confundem no
-- impresso). O QR abre jkaliancas.com.br/guias/garantia/<código>.
--
-- O QUE A PÁGINA PÚBLICA MOSTRA a quem tem o código: as peças (nome e
-- quantidade), a data, o número do pedido e da OS, e os benefícios que a JK
-- aprovou na base de fatos. O que é dado pessoal (nome, texto da gravação) e
-- o registro do casal só abrem depois de a pessoa digitar os 4 últimos
-- números do telefone do pedido. Cinco tentativas erradas na mesma hora
-- travam a garantia por uma hora. O sistema do Daniel tinha uma "via do
-- cliente" pública com dado pessoal e financeiro para quem tivesse o link:
-- aqui não.
--
-- O REGISTRO (nome do par, aniversários, namoro, casamento) fica na garantia
-- e preenche a ficha do cliente (`clientes_fichas`) SÓ onde ela está vazia:
-- o que o time já anotou não é apagado pelo que o cliente digita. A ficha
-- alimenta Oportunidades.
--
-- A garantia guarda uma FOTOGRAFIA do trabalho na hora da emissão (nome,
-- telefone, peças): o pedido pode mudar depois, o certificado não.
--
-- As funções públicas (`garantia_ver`, `garantia_abrir`, `garantia_registrar`)
-- só a chave de serviço chama: a página pública fala com o banco pelo servidor,
-- nunca com a chave anônima.

create table public.garantias (
  codigo           text primary key check (codigo ~ '^[A-HJ-NP-Z2-9]{10}$'),
  fabrica_id       bigint not null unique references public.fabrica_pedidos(id) on delete cascade,
  os               bigint,
  pedido           bigint,
  cliente_nome     text,
  cliente_telefone text,
  pecas            jsonb not null default '[]'::jsonb,
  emitida_em       timestamptz not null default now(),
  emitida_por      uuid references public.profiles(id) on delete set null,
  registro         jsonb,
  registrado_em    timestamptz,
  erros            integer not null default 0,
  erro_em          timestamptz,
  vista_em         timestamptz
);
comment on table public.garantias is 'Garantia digital de um trabalho da fábrica, com código único para o QR do cartão (0194).';
alter table public.garantias enable row level security;

-- Emite (ou devolve) a garantia de um trabalho. Fábrica e quem vende.
create or replace function public.fabrica_emitir_garantia(p_ref text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_id     bigint;
  v_f      public.fabrica_pedidos;
  v_codigo text;
  v_letras text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_nome   text;
  v_tel    text;
  v_pecas  jsonb;
begin
  if not coalesce(public.tem_acesso('fabrica') or public.tem_acesso('lancar_venda'), false) then
    raise exception 'Seu acesso não emite garantia.' using errcode = '42501';
  end if;
  v_id := public.fabrica_garantir_linha(p_ref);
  select g.codigo into v_codigo from public.garantias g where g.fabrica_id = v_id;
  if v_codigo is not null then
    return jsonb_build_object('ok', true, 'codigo', v_codigo, 'nova', false);
  end if;

  select * into v_f from public.fabrica_pedidos f where f.id = v_id;
  if v_f.pedido is not null then
    select t.cliente_nome, t.cliente_telefone, t.itens into v_nome, v_tel, v_pecas from public.tray_pedidos t where t.pedido = v_f.pedido;
  elsif v_f.venda is not null then
    select v.cliente_nome, v.cliente_telefone, vp.pecas into v_nome, v_tel, v_pecas
    from public.vendas_avulsas v join public.vendas_producao vp on vp.venda = v.id where v.id = v_f.venda;
  else
    select a.cliente_nome, a.cliente_telefone, a.pecas into v_nome, v_tel, v_pecas from public.fabrica_avulsos a where a.id = v_f.avulso;
  end if;
  if coalesce(v_tel, '') !~ '^55[0-9]{10,11}$' then
    raise exception 'Este trabalho não tem o telefone do cliente: sem ele a garantia não abre para ninguém.' using errcode = '22023';
  end if;

  loop
    v_codigo := (select string_agg(substr(v_letras, 1 + floor(random() * 32)::int, 1), '') from generate_series(1, 10));
    exit when not exists (select 1 from public.garantias g where g.codigo = v_codigo);
  end loop;

  insert into public.garantias (codigo, fabrica_id, os, pedido, cliente_nome, cliente_telefone, pecas, emitida_por)
  values (
    v_codigo, v_id, v_f.os, coalesce(v_f.pedido, (select a.pedido_origem from public.fabrica_avulsos a where a.id = v_f.avulso)),
    v_nome, v_tel,
    coalesce((select jsonb_agg(jsonb_build_object('nome', i->>'nome', 'quantidade', coalesce((i->>'quantidade')::int, 1), 'info', i->>'info'))
              from jsonb_array_elements(case when jsonb_typeof(v_pecas) = 'array' then v_pecas else '[]'::jsonb end) i), '[]'::jsonb),
    (select auth.uid())
  );
  return jsonb_build_object('ok', true, 'codigo', v_codigo, 'nova', true);
end
$$;

-- O que o cartão impresso precisa. Fábrica e quem vende.
create or replace function public.garantia_para_imprimir(p_codigo text)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  select case when coalesce(public.tem_acesso('fabrica') or public.tem_acesso('lancar_venda'), false) then (
    select jsonb_build_object('codigo', g.codigo, 'os', g.os, 'pedido', g.pedido, 'emitida_em', g.emitida_em,
      'pecas', (select coalesce(jsonb_agg(jsonb_build_object('nome', p->>'nome', 'quantidade', p->'quantidade')), '[]'::jsonb) from jsonb_array_elements(g.pecas) p))
    from public.garantias g where g.codigo = upper(p_codigo)
  ) end
$$;

-- A parte pública: sem dado pessoal. Só a chave de serviço chama.
create or replace function public.garantia_ver(p_codigo text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v public.garantias;
begin
  select * into v from public.garantias g where g.codigo = upper(btrim(coalesce(p_codigo, '')));
  if not found then return null; end if;
  update public.garantias set vista_em = now() where codigo = v.codigo;
  return jsonb_build_object(
    'codigo', v.codigo, 'os', v.os, 'pedido', v.pedido, 'emitida_em', v.emitida_em,
    'registrada', v.registrado_em is not null,
    'travada', v.erros >= 5 and v.erro_em > now() - interval '1 hour',
    'pecas', (select coalesce(jsonb_agg(jsonb_build_object('nome', p->>'nome', 'quantidade', p->'quantidade')), '[]'::jsonb) from jsonb_array_elements(v.pecas) p),
    'beneficios', (select coalesce(jsonb_agg(f.claim order by f.captured_at), '[]'::jsonb) from public.fatos_publicos f where f.module = 'garantias')
  );
end
$$;

-- Abre o que é pessoal, conferindo os 4 últimos números do telefone.
create or replace function public.garantia_abrir(p_codigo text, p_digitos text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v public.garantias;
begin
  select * into v from public.garantias g where g.codigo = upper(btrim(coalesce(p_codigo, ''))) for update;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'nao_existe');
  end if;
  if v.erros >= 5 and v.erro_em > now() - interval '1 hour' then
    return jsonb_build_object('ok', false, 'motivo', 'travada');
  end if;
  if coalesce(p_digitos, '') !~ '^[0-9]{4}$' or right(v.cliente_telefone, 4) <> p_digitos then
    update public.garantias set
      erros = case when erro_em is null or erro_em < now() - interval '1 hour' then 1 else erros + 1 end,
      erro_em = now()
    where codigo = v.codigo;
    return jsonb_build_object('ok', false, 'motivo', 'errado');
  end if;
  update public.garantias set erros = 0, erro_em = null where codigo = v.codigo;
  return jsonb_build_object(
    'ok', true,
    'nome', v.cliente_nome,
    'pecas', v.pecas,
    'registro', v.registro
  );
end
$$;

-- O registro do casal: na garantia e na ficha do cliente, onde ela está vazia.
create or replace function public.garantia_registrar(p_codigo text, p_digitos text, p jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_abriu jsonb;
  v       public.garantias;
  v_reg   jsonb;
  v_campo text;
begin
  v_abriu := public.garantia_abrir(p_codigo, p_digitos);
  if not (v_abriu->>'ok')::boolean then
    return v_abriu;
  end if;
  if coalesce((p->>'aceite')::boolean, false) is not true then
    return jsonb_build_object('ok', false, 'motivo', 'sem_aceite');
  end if;
  select * into v from public.garantias g where g.codigo = upper(btrim(p_codigo));

  v_reg := jsonb_strip_nulls(jsonb_build_object(
    'par_nome', nullif(left(btrim(coalesce(p->>'par_nome', '')), 120), ''),
    'aniversario', nullif(p->>'aniversario', ''),
    'aniversario_par', nullif(p->>'aniversario_par', ''),
    'data_namoro', nullif(p->>'data_namoro', ''),
    'data_casamento', nullif(p->>'data_casamento', ''),
    'aceite_em', now()
  ));
  -- Data só no formato da ficha (MM-DD ou AAAA-MM-DD); o resto é descartado.
  foreach v_campo in array array['aniversario', 'aniversario_par', 'data_namoro', 'data_casamento'] loop
    if v_reg ? v_campo and (v_reg->>v_campo) !~ '^([0-9]{4}-)?(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$' then
      v_reg := v_reg - v_campo;
    end if;
  end loop;

  update public.garantias set registro = v_reg, registrado_em = now() where codigo = v.codigo;

  insert into public.clientes_fichas (chave, par_nome, aniversario, aniversario_par, data_namoro, data_casamento)
  values (v.cliente_telefone, v_reg->>'par_nome', v_reg->>'aniversario', v_reg->>'aniversario_par', v_reg->>'data_namoro', v_reg->>'data_casamento')
  on conflict (chave) do update set
    par_nome = coalesce(public.clientes_fichas.par_nome, excluded.par_nome),
    aniversario = coalesce(public.clientes_fichas.aniversario, excluded.aniversario),
    aniversario_par = coalesce(public.clientes_fichas.aniversario_par, excluded.aniversario_par),
    data_namoro = coalesce(public.clientes_fichas.data_namoro, excluded.data_namoro),
    data_casamento = coalesce(public.clientes_fichas.data_casamento, excluded.data_casamento),
    atualizado_em = now();

  return jsonb_build_object('ok', true);
end
$$;

revoke all on function public.fabrica_emitir_garantia(text) from public, anon;
revoke all on function public.garantia_para_imprimir(text) from public, anon;
revoke all on function public.garantia_ver(text) from public, anon, authenticated;
revoke all on function public.garantia_abrir(text, text) from public, anon, authenticated;
revoke all on function public.garantia_registrar(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.fabrica_emitir_garantia(text) to authenticated;
grant execute on function public.garantia_para_imprimir(text) to authenticated;
grant execute on function public.garantia_ver(text) to service_role;
grant execute on function public.garantia_abrir(text, text) to service_role;
grant execute on function public.garantia_registrar(text, text, jsonb) to service_role;
