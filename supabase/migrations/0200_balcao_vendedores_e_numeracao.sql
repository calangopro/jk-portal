-- 0200: dois acertos do balcão da loja (cartão 71), achados no ensaio da 0199.
--
-- 1. A conta de nível `loja` ainda sem loja escolhida não via pedido nenhum
--    (0199), mas a lista de vendedores ainda mostrava os nomes de qualquer
--    loja pedida. Agora a lista passa pela mesma régua (`balcao_pode`).
-- 2. Os ensaios com transação desfeita gastam número de sequência, que não
--    volta atrás. Com as tabelas vazias, o primeiro pedido da loja é o PL-1 e
--    a próxima OS segue a última que existe.

create or replace function public.balcao_vendedores(p_loja text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare v_loja text := coalesce(public.minha_loja(), nullif(btrim(coalesce(p_loja, '')), ''));
begin
  if not coalesce(public.tem_acesso('balcao'), false) then
    raise exception 'Seu acesso não abre o balcão.' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', v.id, 'loja', v.loja, 'nome', v.nome, 'ativo', v.ativo) order by v.ativo desc, v.nome)
    from public.loja_vendedores v
    where (v_loja is null or v.loja = v_loja)
      and public.balcao_pode(v.loja)
  ), '[]'::jsonb);
end
$$;

do $$
begin
  if not exists (select 1 from public.loja_pedidos) then
    alter table public.loja_pedidos alter column numero restart with 1;
  end if;
  if not exists (select 1 from public.fabrica_alteracoes) then
    alter table public.fabrica_alteracoes alter column id restart with 1;
  end if;
  perform setval('public.fabrica_os_seq', greatest((select max(os) from public.fabrica_pedidos), 1000));
end
$$;
