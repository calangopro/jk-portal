-- 0088: redes sociais, sequência de stories.
--
-- O QUE É
--
-- Quem cuida das redes posta stories em sequência: cinco telas seguidas que
-- contam uma coisa só. No compositor isso é escolher "Story" e pôr várias
-- fotos ou vídeos. Ao liberar, o núcleo (`liberarPost`, em
-- `src/lib/redes/posts.ts`) parte a peça em UM post por story, todos com a
-- mesma `sequencia` e com a `ordem` de cada um. Cada story anda sozinho na
-- fila, com o próprio envio, o próprio erro e o próprio link.
--
-- A ORDEM É GARANTIDA PELO BANCO
--
-- Story de foto sai em segundos; story de vídeo pode levar minutos na rede.
-- Só pela hora, um story de foto marcado um minuto depois de um de vídeo
-- sairia ANTES dele. Por isso `redes_pegar_envios` não entrega o envio de um
-- story enquanto um story ANTERIOR da mesma sequência, na mesma conta, ainda
-- está marcado, saindo ou sendo preparado pela rede. O que deu erro ou foi
-- cancelado não segura os seguintes: a sequência continua, com o buraco à
-- vista na tela.

alter table public.redes_posts
  add column sequencia uuid,
  add column ordem smallint;

alter table public.redes_posts
  add constraint redes_posts_ordem_da_sequencia
  check ((sequencia is null) = (ordem is null) and (ordem is null or ordem between 1 and 50));

create index redes_posts_sequencia on public.redes_posts (sequencia, ordem) where sequencia is not null;

comment on column public.redes_posts.sequencia is
  'Stories que saem em sequência levam o mesmo valor. Nulo: post solto.';
comment on column public.redes_posts.ordem is
  'A posição do story na sequência, a partir de 1. O banco não deixa um sair antes do anterior na mesma conta.';

-- A mesma função da 0084, com a espera da sequência na escolha dos envios.
create or replace function public.redes_pegar_envios(p_limite integer default 4, p_post uuid default null)
returns setof public.redes_envios
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Preso em "publicando" há mais de dez minutos: a rodada morreu no meio. Não volta para a fila (ver a 0084).
  update public.redes_envios
     set status = 'erro', pego_em = null, proxima_tentativa = null, atualizado_em = now(),
         erro = 'A publicação foi interrompida no meio. Confira na rede se o post saiu antes de tentar de novo.'
   where status = 'publicando' and pego_em < now() - interval '10 minutes';

  -- A rede preparando a mídia há mais de três horas: desiste.
  update public.redes_envios
     set status = 'erro', proxima_tentativa = null, atualizado_em = now(),
         erro = 'A rede passou de três horas preparando a mídia e não terminou. Confira o arquivo e tente de novo.'
   where status = 'processando' and processando_desde < now() - interval '3 hours';

  return query
  update public.redes_envios e
     set status = 'publicando', pego_em = now(), atualizado_em = now()
   where e.id in (
     select x.id from public.redes_envios x
      where x.status in ('agendado', 'processando')
        and coalesce(x.proxima_tentativa, x.agendado_para, now()) <= now()
        and (p_post is null or x.post_id = p_post)
        -- Story de sequência espera o anterior, na mesma conta, terminar (sair, dar erro ou ser cancelado).
        and not exists (
          select 1
            from public.redes_posts p
            join public.redes_posts ant on ant.sequencia = p.sequencia and ant.ordem < p.ordem
            join public.redes_envios ea on ea.post_id = ant.id and ea.conta_id = x.conta_id
           where p.id = x.post_id
             and p.sequencia is not null
             and ea.status in ('agendado', 'publicando', 'processando')
        )
      order by coalesce(x.proxima_tentativa, x.agendado_para)
      limit greatest(1, least(coalesce(p_limite, 4), 20))
      for update of x skip locked
   )
  returning e.*;
end $$;

revoke execute on function public.redes_pegar_envios(integer, uuid) from public, anon, authenticated;
