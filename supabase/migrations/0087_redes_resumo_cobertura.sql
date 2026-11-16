-- 0087: redes sociais, o resumo diz quanto do período anterior foi lido.
--
-- O QUE A PRIMEIRA CONTA DE VERDADE MOSTROU
--
-- O YouTube foi ligado em 16/11/2026. A primeira leitura traz 30 dias, a tela
-- abre na visão de 28, e o "período anterior" (os 28 dias de antes) tinha 2
-- dias de número. A tela comparou 292 visualizações com 13 e escreveu "subiu
-- 2.146%". A soma do período anterior estava certa; o que faltava era dizer
-- que ela não cobria o período.
--
-- O QUE MUDA
--
-- `redes_resumo()` passa a devolver, dentro de `anterior`, em quantos dias do
-- período anterior cada número foi lido (`dias`), e por conta a data da
-- publicação mais antiga que o painel conhece (`primeira_publicacao`). Quem
-- decide se compara é `montarResumo` (`src/lib/redes/resumo.ts`, com teste):
-- número por dia só compara com o período anterior quase inteiro, e contagem
-- de posts só compara quando a lista de posts alcança o período anterior.
--
-- Só acrescenta chaves ao JSON: o código antigo ignora o que não conhece, então
-- a função pode entrar antes do código novo.

create or replace function public.redes_resumo(p_dias integer default 28)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with periodo as (
    select greatest(1, least(coalesce(p_dias, 28), 365)) as dias,
           (now() at time zone 'America/Sao_Paulo')::date as hoje
  ),
  contas as (
    select c.* from public.redes_contas c where c.status <> 'desligada'
  ),
  dias as (
    select d.* from public.redes_contas_dia d, periodo p
    where d.dia > p.hoje - (p.dias * 2) and d.conta_id in (select id from contas)
  ),
  pubs as (
    select b.* from public.redes_publicacoes b, periodo p
    where b.publicado_em > now() - make_interval(days => p.dias * 2) and b.conta_id in (select id from contas)
  )
  select jsonb_build_object(
    'dias', (select dias from periodo),
    'hoje', (select hoje from periodo),
    'contas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'rede', c.rede, 'nome', c.nome, 'usuario', c.usuario, 'foto_url', c.foto_url, 'link', c.link,
        'status', c.status, 'ultimo_erro', c.ultimo_erro, 'lida_em', c.lida_em, 'expira_em', c.expira_em,
        'seguidores', (select d.seguidores from dias d where d.conta_id = c.id and d.seguidores is not null order by d.dia desc limit 1),
        'seguidores_antes', (
          select d.seguidores from public.redes_contas_dia d, periodo p
          where d.conta_id = c.id and d.seguidores is not null and d.dia <= p.hoje - p.dias order by d.dia desc limit 1),
        'serie', coalesce((
          select jsonb_agg(jsonb_build_object(
            'dia', d.dia, 'seguidores', d.seguidores, 'alcance', d.alcance, 'visualizacoes', d.visualizacoes,
            'interacoes', d.interacoes, 'visitas_ao_perfil', d.visitas_ao_perfil, 'cliques_no_link', d.cliques_no_link,
            'novos_seguidores', d.novos_seguidores) order by d.dia)
          from dias d, periodo p where d.conta_id = c.id and d.dia > p.hoje - p.dias), '[]'::jsonb),
        'anterior', (
          select jsonb_build_object(
            'alcance', sum(d.alcance), 'visualizacoes', sum(d.visualizacoes), 'interacoes', sum(d.interacoes),
            'visitas_ao_perfil', sum(d.visitas_ao_perfil), 'cliques_no_link', sum(d.cliques_no_link),
            -- Em quantos dias do período anterior cada número foi lido. É o que diz se dá para comparar.
            'dias', jsonb_build_object(
              'alcance', count(d.alcance), 'visualizacoes', count(d.visualizacoes), 'interacoes', count(d.interacoes),
              'visitas_ao_perfil', count(d.visitas_ao_perfil), 'cliques_no_link', count(d.cliques_no_link)))
          from dias d, periodo p where d.conta_id = c.id and d.dia <= p.hoje - p.dias),
        -- A publicação mais antiga que o painel conhece: diz se a lista de posts alcança o período anterior.
        'primeira_publicacao', (select min(b.publicado_em) from public.redes_publicacoes b where b.conta_id = c.id),
        'posts', (
          select jsonb_build_object(
            'quantos', count(*), 'curtidas', sum(b.curtidas), 'comentarios', sum(b.comentarios), 'salvos', sum(b.salvos),
            'compartilhamentos', sum(b.compartilhamentos), 'alcance', sum(b.alcance), 'visualizacoes', sum(b.visualizacoes))
          from pubs b, periodo p where b.conta_id = c.id and b.publicado_em > now() - make_interval(days => p.dias)),
        'posts_antes', (
          select jsonb_build_object(
            'quantos', count(*), 'curtidas', sum(b.curtidas), 'comentarios', sum(b.comentarios),
            'alcance', sum(b.alcance), 'visualizacoes', sum(b.visualizacoes))
          from pubs b, periodo p where b.conta_id = c.id and b.publicado_em <= now() - make_interval(days => p.dias))
      ) order by c.conectada_em)
      from contas c), '[]'::jsonb),
    'publicacoes', coalesce((
      select jsonb_agg(to_jsonb(t) order by t.publicado_em desc) from (
        select b.id, b.conta_id, b.rede, b.id_na_rede, b.formato, left(b.legenda, 200) as legenda, b.link, b.miniatura_url,
               b.publicado_em, b.curtidas, b.comentarios, b.salvos, b.compartilhamentos, b.alcance, b.visualizacoes
        from pubs b, periodo p
        where b.publicado_em > now() - make_interval(days => p.dias)
        order by b.publicado_em desc
        limit 300
      ) t), '[]'::jsonb)
  )
$$;

revoke execute on function public.redes_resumo(integer) from public, anon;
grant execute on function public.redes_resumo(integer) to authenticated;
