-- Revisão de post das redes: aprovar, ou recusar dizendo ONDE está o erro.
--
-- Pedido do Filipe (cartão 83): na lista de Posts e stories ninguém conseguia ler o carrossel
-- inteiro para aprovar. Quem revisa vê o carrossel, aprova, ou recusa marcando o card errado e
-- escrevendo nele. A recusa fica guardada para a equipe (e o Claude, pelo conector) ver onde
-- erra e ajustar.
--
-- Uma linha por decisão, nunca editada: aprovar e recusar viram histórico. `versao` é o resumo
-- do conteúdo que foi visto (legenda, título e mídias), calculado pelo servidor: quando o post é
-- editado depois, a revisão deixa de valer sem ninguém precisar apagá-la, e a tela diz
-- "ajustado, rever". `atualizado_em` do post não serve para isso, porque o gatilho dos envios
-- também mexe nele.
--
-- `notas` é uma lista de { card, x, y, texto }: `card` é a posição 1, 2, 3 da mídia (nulo é
-- observação geral), `x` e `y` (0 a 1) são o ponto que a pessoa marcou na imagem, quando marcou.
--
-- Escrita só pela chave de serviço (a ação confere a área `redes`); leitura para quem tem a área.

create table public.redes_revisoes (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.redes_posts(id) on delete cascade,
  decisao    text not null check (decisao in ('aprovado', 'recusado')),
  versao     text not null check (char_length(versao) between 8 and 64),
  notas      jsonb not null default '[]'::jsonb check (jsonb_typeof(notas) = 'array' and jsonb_array_length(notas) <= 40),
  por        uuid references public.profiles(id) on delete set null,
  criado_em  timestamptz not null default now(),
  -- Recusa sem dizer o motivo não ensina nada: pede ao menos uma nota.
  constraint redes_revisoes_recusa_com_motivo check (decisao = 'aprovado' or jsonb_array_length(notas) > 0)
);

create index redes_revisoes_do_post on public.redes_revisoes (post_id, criado_em desc);
create index redes_revisoes_recentes on public.redes_revisoes (decisao, criado_em desc);

comment on table public.redes_revisoes is
  'Aprovação ou recusa de um post das redes, com notas por card. Histórico: não se edita. A versão diz qual conteúdo foi visto. Escrita só pela chave de serviço.';

alter table public.redes_revisoes enable row level security;

create policy redes_revisoes_select on public.redes_revisoes
  for select to authenticated using ((select public.tem_acesso('redes')));

revoke all on public.redes_revisoes from anon;
-- O padrão do Supabase dá a quem está logado também TRUNCATE, REFERENCES e TRIGGER, e TRUNCATE passa por cima da RLS.
revoke insert, update, delete, truncate, references, trigger on public.redes_revisoes from authenticated;
