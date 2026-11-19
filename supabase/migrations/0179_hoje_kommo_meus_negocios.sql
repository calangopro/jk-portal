-- Cartão 52, tela Hoje: os negócios da Kommo que esperam a PRÓPRIA pessoa.
--
-- `kommo_alertas` (0162) conta o time inteiro e só abre para a área `vendas`
-- e a diretoria. O vendedor tem `lancar_venda` e não `vendas`, então não via
-- nem os negócios dele. Esta função devolve só os negócios cujo responsável na
-- Kommo está ligado à pessoa logada em `kommo_mapa`, pela MESMA régua dos
-- alertas: aberto, fora de ganho, perdido e pós-venda, e
--   - na fase "esperando vendedor" há mais que o prazo (desde `etapa_desde`), ou
--   - com mensagem do cliente sem resposta da loja há mais que o prazo
--     (desde `ultima_msg_cliente_em`).
-- O teto (`p_limite`) vale para CADA motivo: senão 190 negócios parados há
-- semanas escondiam o cliente sem resposta de agora. Os totais vêm contados.
-- Só leitura. Não devolve telefone, e-mail nem valor: a tela só precisa do
-- nome, do motivo, de desde quando e do link do negócio.

create or replace function public.kommo_meus_negocios(p_atencao_min integer default 30, p_limite integer default 10)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_eu uuid := (select auth.uid());
  v_atencao interval := make_interval(mins => greatest(1, coalesce(p_atencao_min, 30)));
  v_limite integer := greatest(1, least(coalesce(p_limite, 10), 50));
  v jsonb;
begin
  if v_eu is null or not (
    coalesce(public.tem_acesso('lancar_venda'), false)
    or coalesce(public.tem_acesso('vendas'), false)
    or coalesce(public.is_admin(), false)
  ) then
    return null;
  end if;

  with meus as (
    select m.usuario_id from public.kommo_mapa m where m.profile_id = v_eu
  ),
  abertos as (
    select n.id, n.nome, n.contato_id, n.funil_id, n.etapa_id, n.etapa_desde, n.ultima_msg_cliente_em,
           coalesce(n.ultima_msg_cliente_em > coalesce(n.ultima_msg_loja_em, '-infinity'::timestamptz), false) as sem_resposta,
           x.fase
      from public.kommo_negocios n
      join meus on meus.usuario_id = n.responsavel_id
      left join public.fases_da_kommo x on x.funil_id = n.funil_id and x.etapa_id = n.etapa_id
     where not n.apagado
       and n.etapa_id not in (142, 143)
       and coalesce(x.fase, '') not in ('ganho', 'perdido', 'pos_venda')
  ),
  esperando as (
    select a.*,
           case when a.sem_resposta and a.ultima_msg_cliente_em < now() - v_atencao then 'sem_resposta' else 'esperando_vendedor' end as motivo,
           case when a.sem_resposta and a.ultima_msg_cliente_em < now() - v_atencao then a.ultima_msg_cliente_em else a.etapa_desde end as desde
      from abertos a
     where (a.sem_resposta and a.ultima_msg_cliente_em < now() - v_atencao)
        or (a.fase = 'esperando_vendedor' and a.etapa_desde < now() - v_atencao)
  )
  select jsonb_build_object(
    'lido_em', (select ultima_leitura_em from public.kommo_estado where id = 1),
    'mapeado', exists (select 1 from meus),
    'total', (select count(*) from esperando),
    'sem_resposta', (select count(*) from esperando where motivo = 'sem_resposta'),
    'esperando_vendedor', (select count(*) from esperando where motivo = 'esperando_vendedor'),
    'negocios', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id,
        'nome', e.nome,
        'cliente', c.nome,
        'funil', f.nome,
        'etapa', t.nome,
        'motivo', e.motivo,
        'desde', e.desde,
        'link', 'https://kathleengfz.kommo.com/leads/detail/' || e.id
      ) order by e.desde asc nulls last)
      from (select *, row_number() over (partition by motivo order by desde asc nulls last) as n_do_motivo from esperando) e
      left join public.kommo_contatos c on c.id = e.contato_id
      left join public.kommo_funis f on f.id = e.funil_id
      left join public.kommo_etapas t on t.id = e.etapa_id and t.funil_id = e.funil_id
     where e.n_do_motivo <= v_limite
    ), '[]'::jsonb)
  ) into v;
  return v;
end $$;

revoke execute on function public.kommo_meus_negocios(integer, integer) from public, anon;
grant execute on function public.kommo_meus_negocios(integer, integer) to authenticated;
