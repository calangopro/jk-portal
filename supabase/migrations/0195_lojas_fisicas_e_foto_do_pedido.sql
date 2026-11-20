-- 0195: Lojas físicas e a foto do pedido escrito (cartão 66).
--
-- Prepara o terreno para receber o pedido de TODAS as lojas físicas.
--
-- 1. CADA PESSOA PODE SER LIGADA A UMA LOJA (`profiles.loja`, o nome da loja
--    como no sistema do Daniel: "JK Granja", "JK Osasco"...). Só a diretoria
--    liga (`definir_loja_da_pessoa`), pela tela de usuários. A OS aberta por
--    quem tem loja leva a loja dela, e quem tem loja e não é da fábrica nem da
--    diretoria vê na fila só as OS da própria loja (os pedidos do site e as
--    vendas por fora continuam para todos: não são de loja física). Pessoa sem
--    loja vê tudo, como antes.
--
-- 2. A FOTO DO PEDIDO ESCRITO (`fabrica_avulsos.fotos`, balde privado
--    `fabrica-os`): o vendedor fotografa a OS de papel, a IA transcreve e
--    sugere o preenchimento, e ele confere antes de mandar. A foto e a
--    transcrição (`transcricao`) ficam na OS para sempre: se alguém esquecer
--    um campo, a fábrica tem a foto. A foto sobe pela chave de serviço, na
--    pasta da pessoa; a função confere a pasta e que o arquivo existe.
--
-- 3. A FILA PASSA A MOSTRAR O QUE A OS MANDA FAZER (`relato`), as fotos, a
--    transcrição, a loja e o número da OS de papel. Na 0192 o relato era
--    gravado e a fábrica não via.

alter table public.profiles add column loja text check (char_length(loja) between 2 and 60);
comment on column public.profiles.loja is 'A loja física da pessoa (0195). Só a diretoria muda, por definir_loja_da_pessoa.';

create or replace function public.minha_loja()
returns text
language sql
stable
security definer
set search_path to ''
as $$
  select p.loja from public.profiles p where p.id = (select auth.uid()) and p.is_active
$$;

create or replace function public.definir_loja_da_pessoa(p_pessoa uuid, p_loja text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'Só a diretoria liga pessoa a loja.' using errcode = '42501';
  end if;
  if p_loja is not null and char_length(btrim(p_loja)) not between 2 and 60 then
    raise exception 'Loja inválida.' using errcode = '22023';
  end if;
  update public.profiles set loja = nullif(btrim(p_loja), '') where id = p_pessoa;
  if not found then
    raise exception 'Pessoa não encontrada.' using errcode = '22023';
  end if;
  return jsonb_build_object('ok', true);
end
$$;

alter table public.fabrica_avulsos
  add column fotos text[] not null default '{}',
  add column transcricao text check (char_length(transcricao) <= 8000);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fabrica-os', 'fabrica-os', false, 5242880, array['image/jpeg'])
on conflict (id) do nothing;

-- A foto só abre para quem vê a fila e só se for de uma OS de verdade.
create or replace function public.fabrica_foto_permitida(p_caminho text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select coalesce(public.tem_acesso('fabrica') or public.tem_acesso('lancar_venda') or public.tem_acesso('vendas'), false)
     and exists (select 1 from public.fabrica_avulsos a where p_caminho = any(a.fotos))
$$;

create or replace function public.fabrica_abrir_os(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_quem   uuid := (select auth.uid());
  v_tipo   text := coalesce(nullif(p->>'tipo', ''), 'troca');
  v_prio   text := coalesce(nullif(p->>'prioridade', ''), 'normal');
  v_prazo  date;
  v_origem bigint;
  v_tel    text := regexp_replace(coalesce(p->>'cliente_telefone', ''), '[^0-9]', '', 'g');
  v_pecas  jsonb := coalesce(p->'pecas', '[]'::jsonb);
  v_avulso uuid;
  v_linha  public.fabrica_pedidos;
  v_fotos  text[] := '{}';
  v_foto   text;
begin
  if not coalesce(public.tem_acesso('lancar_venda') or public.tem_acesso('fabrica'), false) then
    raise exception 'Seu acesso não abre OS na fábrica.' using errcode = '42501';
  end if;
  if v_tipo not in ('venda_nova', 'troca', 'refazer', 'ajuste', 'upgrade', 'polimento', 'servico') then
    raise exception 'Tipo de trabalho desconhecido.' using errcode = '22023';
  end if;
  if v_prio not in ('normal', 'urgente', 'motoboy') then
    raise exception 'Prioridade desconhecida.' using errcode = '22023';
  end if;
  if jsonb_typeof(v_pecas) <> 'array' or jsonb_array_length(v_pecas) not between 1 and 8 then
    raise exception 'Diga de 1 a 8 peças.' using errcode = '22023';
  end if;
  if nullif(p->>'prazo', '') is not null then
    v_prazo := (p->>'prazo')::date;
    if v_prazo < (now() at time zone 'America/Sao_Paulo')::date or v_prazo > (now() at time zone 'America/Sao_Paulo')::date + 365 then
      raise exception 'O prazo precisa ser de hoje em diante.' using errcode = '22023';
    end if;
  end if;
  if nullif(p->>'pedido_origem', '') is not null then
    v_origem := (p->>'pedido_origem')::bigint;
    if not exists (select 1 from public.tray_pedidos t where t.pedido = v_origem) then
      raise exception 'O pedido % não está no painel.', v_origem using errcode = '22023';
    end if;
  end if;
  if v_tel <> '' then
    if v_tel !~ '^55' and char_length(v_tel) between 10 and 11 then v_tel := '55' || v_tel; end if;
    if v_tel !~ '^55[0-9]{10,11}$' then
      raise exception 'Telefone com DDD, só números.' using errcode = '22023';
    end if;
  end if;
  -- Fotos do pedido escrito (0195): só da pasta de quem abre, e só o que já subiu para o balde.
  if jsonb_typeof(p->'fotos') = 'array' then
    for v_foto in select x from jsonb_array_elements_text(p->'fotos') as t(x) loop
      if v_foto !~ ('^' || (select auth.uid())::text || '/[0-9a-f-]{36}\.jpg$')
         or not exists (select 1 from storage.objects o where o.bucket_id = 'fabrica-os' and o.name = v_foto) then
        raise exception 'A foto do pedido não subiu direito. Tire de novo.' using errcode = '22023';
      end if;
      v_fotos := v_fotos || v_foto;
    end loop;
    if cardinality(v_fotos) > 4 then
      raise exception 'Até 4 fotos por OS.' using errcode = '22023';
    end if;
  end if;
  if v_origem is null and nullif(btrim(coalesce(p->>'cliente_nome', '')), '') is null then
    raise exception 'Diga o pedido de origem ou o nome do cliente.' using errcode = '22023';
  end if;

  insert into public.fabrica_avulsos (pedido_origem, cliente_nome, cliente_telefone, pecas, entrega, endereco, cidade, uf, relato, loja, numero_papel, criado_por, fotos, transcricao)
  values (
    v_origem,
    coalesce(nullif(btrim(p->>'cliente_nome'), ''), (select t.cliente_nome from public.tray_pedidos t where t.pedido = v_origem)),
    coalesce(nullif(v_tel, ''), (select t.cliente_telefone from public.tray_pedidos t where t.pedido = v_origem and t.cliente_telefone ~ '^55[0-9]{10,11}$')),
    v_pecas,
    nullif(btrim(p->>'entrega'), ''),
    nullif(btrim(p->>'endereco'), ''),
    nullif(btrim(p->>'cidade'), ''),
    nullif(upper(btrim(p->>'uf')), ''),
    nullif(btrim(p->>'relato'), ''),
    coalesce(nullif(btrim(p->>'loja'), ''), public.minha_loja()),
    nullif(btrim(p->>'numero_papel'), ''),
    v_quem,
    v_fotos,
    nullif(left(btrim(coalesce(p->>'transcricao', '')), 8000), '')
  )
  returning id into v_avulso;

  insert into public.fabrica_pedidos (avulso, etapa, etapa_em, tipo, prioridade, prazo, atualizado_por)
  values (v_avulso, 'a_produzir', now(), v_tipo, v_prio, v_prazo, v_quem)
  returning * into v_linha;

  return jsonb_build_object('ok', true, 'ref', 'a' || v_avulso::text, 'os', v_linha.os);
end
$$;

create or replace function public.fila_da_fabrica(p_dias integer default 15)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  with pode as (select coalesce(public.tem_acesso('fabrica') or public.tem_acesso('lancar_venda') or public.tem_acesso('vendas'), false) as sim),
  dias as (select greatest(least(p_dias, 120), 1) as n, (now() at time zone 'America/Sao_Paulo')::date as hoje),
  finais as (select e.chave from public.fabrica_etapas e where e.papel = 'final'),
  -- Fora da janela, só fica o que a fábrica já pegou: nem na entrada, nem fora.
  pegou as (select chave from finais union all select 'a_produzir'),
  da_loja as (
    select
      p.pedido::text as ref, 'loja'::text as origem, p.pedido, p.dia, p.feito_em, p.status as status_da_loja,
      p.cliente_nome as cliente, p.cidade, p.uf, p.frete_tipo as entrega, null::text as endereco, null::text as vendedor,
      p.envio_codigo, p.itens,
      f.id as fid, null::bigint as pedido_origem, f.os, f.tipo, f.prioridade, f.prazo,
      f.etapa_em, f.rastreio, f.nota, f.atualizado_por,
      case
        when f.etapa in (select chave from finais) then f.etapa
        when upper(coalesce(p.status, '')) in ('ENVIADO', 'FINALIZADO', 'PROBLEMAS NA ENTREGA') then 'enviado'
        else coalesce(f.etapa, 'a_produzir')
      end as etapa,
      null::bigint as kommo, false as desfeito,
      null::text as relato, null::text[] as fotos, null::text as transcricao, null::text as loja, null::text as numero_papel
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
      f.id as fid, null::bigint as pedido_origem, f.os, f.tipo, f.prioridade, f.prazo,
      f.etapa_em, f.rastreio, f.nota, f.atualizado_por,
      coalesce(f.etapa, 'a_produzir') as etapa,
      fk.negocio_id as kommo,
      (fk.venda is not null and (
        v.estornada_em is not null
        or exists (select 1 from public.kommo_vendas kv
                   where kv.venda_id = v.id and (kv.estado = 'desfeita' or kv.motivo in ('desfeito_estorno', 'desfeito_marcado')))
      )) as desfeito,
      null::text as relato, null::text[] as fotos, null::text as transcricao, null::text as loja, null::text as numero_papel
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
  avulsos as (
    select
      'a' || a.id::text as ref, 'avulso'::text as origem, null::bigint as pedido,
      ((a.criado_em at time zone 'America/Sao_Paulo')::date) as dia, a.criado_em as feito_em, null::text as status_da_loja,
      a.cliente_nome as cliente, a.cidade, a.uf, a.entrega, a.endereco,
      (select nullif(split_part(coalesce(x.full_name, ''), ' ', 1), '') from public.profiles x where x.id = a.criado_por) as vendedor,
      null::text as envio_codigo, a.pecas as itens,
      f.id as fid, a.pedido_origem, f.os, f.tipo, f.prioridade, f.prazo,
      f.etapa_em, f.rastreio, f.nota, f.atualizado_por,
      f.etapa,
      null::bigint as kommo, false as desfeito,
      a.relato, a.fotos, a.transcricao, a.loja, a.numero_papel
    from public.fabrica_avulsos a
    join public.fabrica_pedidos f on f.avulso = a.id
    cross join dias d
    where (select sim from pode)
      and (((a.criado_em at time zone 'America/Sao_Paulo')::date) > d.hoje - d.n or f.etapa not in (select chave from pegou))
      -- Loja física (0195): quem está ligado a uma loja vê as OS dela; fábrica e diretoria veem todas.
      and (coalesce(public.tem_acesso('fabrica') or public.is_admin(), false) or public.minha_loja() is null or a.loja is null or a.loja = public.minha_loja())
  ),
  janela as (select * from da_loja union all select * from por_fora union all select * from avulsos),
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
      (select pr.full_name from public.profiles pr where pr.id = v.atualizado_por) as movido_por,
      (select coalesce(jsonb_agg(jsonb_build_object(
          'id', al.id, 'texto', al.texto, 'em', al.pedido_em,
          'por', (select split_part(coalesce(x.full_name, ''), ' ', 1) from public.profiles x where x.id = al.pedido_por),
          'ciente_em', al.ciente_em,
          'ciente_por', (select split_part(coalesce(x.full_name, ''), ' ', 1) from public.profiles x where x.id = al.ciente_por)
        ) order by al.pedido_em), '[]'::jsonb)
       from public.fabrica_alteracoes al where al.fabrica_id = v.fid) as alteracoes
    from visiveis v
  )
  select jsonb_build_object(
    'dias', (select n from dias),
    'pode_mover', coalesce(public.tem_acesso('fabrica'), false),
    'etapas', case when (select sim from pode) then (
      select coalesce(jsonb_agg(jsonb_build_object(
        'chave', e.chave, 'nome', e.nome, 'frase', e.frase, 'cor', e.cor, 'ativa', e.ativa, 'papel', e.papel
      ) order by e.ordem), '[]'::jsonb) from public.fabrica_etapas e) else '[]'::jsonb end,
    'pedidos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'ref', ref,
        'origem', origem,
        'pedido', pedido,
        'pedido_origem', pedido_origem,
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
        'desfeito_na_kommo', desfeito,
        'alteracoes', alteracoes,
        'relato', relato,
        'fotos', coalesce(to_jsonb(fotos), '[]'::jsonb),
        'transcricao', transcricao,
        'loja', loja,
        'numero_papel', numero_papel
      ) order by feito_em)
      from pronto
    ), '[]'::jsonb)
  )
$$;

revoke all on function public.minha_loja() from public, anon;
revoke all on function public.definir_loja_da_pessoa(uuid, text) from public, anon;
revoke all on function public.fabrica_foto_permitida(text) from public, anon;
grant execute on function public.minha_loja() to authenticated;
grant execute on function public.definir_loja_da_pessoa(uuid, text) to authenticated;
grant execute on function public.fabrica_foto_permitida(text) to authenticated;
