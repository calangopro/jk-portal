-- 0090: nível de acesso "Social media".
--
-- POR QUE UM NÍVEL PRÓPRIO
--
-- Quem cuida das redes da JK entrava como Editor, e o Editor vê também o
-- conteúdo do site, a home, a bio, os produtos e as campanhas de desconto. O
-- nível "social" abre só o setor Social Media (área `redes`) e o setor Time
-- (área `time`, que todo nível tem: tutor, biblioteca e chat).
--
-- FORA DE `is_staff()`, COMO VENDAS E FÁBRICA
--
-- `is_staff()` é o que libera ESCRITA nas tabelas de conteúdo do site (58
-- policies). Se o nível novo ficasse dentro, a pessoa não veria as telas do
-- site no painel, mas escreveria em `contents` direto pela API, com a chave
-- anônima que vai no HTML e a sessão dela. Por isso ele entra na lista de
-- quem NÃO é staff, junto de vendas e fábrica.
--
-- O conector do Claude abre para este nível só com as operações de redes: a
-- trava mora no código (`src/lib/conector/quem-usa.ts`), porque as operações
-- do conector rodam com a chave de serviço.
--
-- A ORDEM IMPORTA (armadilha da 0056): o valor novo do enum entra agora, mas
-- ninguém deve ser posto neste nível antes de o código que o conhece estar no
-- ar. Antes disso o painel não saberia o nome dele.

alter type public.app_role add value if not exists 'social';

alter table public.acessos_por_papel drop constraint acessos_por_papel_papel_check;
alter table public.acessos_por_papel
  add constraint acessos_por_papel_papel_check
  check (papel = any (array['admin', 'dono', 'gm', 'gerente', 'trafego', 'vendas', 'fabrica', 'editor', 'reviewer', 'author', 'social']));

insert into public.acessos_por_papel (papel, area, liberado)
values ('social', 'redes', true), ('social', 'time', true)
on conflict (papel, area) do update set liberado = excluded.liberado;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active and p.role::text not in ('vendas', 'fabrica', 'social')
  );
$function$;
