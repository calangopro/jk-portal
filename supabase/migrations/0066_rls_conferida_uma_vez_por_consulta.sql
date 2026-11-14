-- 0066: a regra de acesso passa a ser conferida UMA vez por consulta, e não
-- uma vez por linha.
--
-- As policies antigas (0002 a 0020) foram escritas como `is_staff()` ou
-- `is_admin()` solto. Escrita assim, o Postgres chama a função para CADA linha
-- que a consulta percorre, e a função é `security definer` com `search_path`,
-- então não pode ser embutida: cada chamada é uma ida à tabela de perfis.
-- Medido em 13/11/2026 com `explain analyze`: descobrir o período mais recente
-- de `analytics_snapshots` (80 mil linhas) levava 1,13 s, com
-- `Filter: is_staff()` avaliado 80.032 vezes. A tela de Métricas somava quase
-- 4 s só nisso.
--
-- Dentro de um `select` escalar a função vira "initplan": roda uma vez, e o
-- resultado vale para a consulta inteira. A resposta é a MESMA (a função não
-- olha a linha, só quem está pedindo), e é como as tabelas novas, de 0052 em
-- diante, já foram escritas.
--
-- A troca é feita só nas policies cuja expressão é EXATAMENTE a chamada da
-- função, sem mais nada. Expressão composta fica como está: reescrever texto
-- de policy por expressão regular é o tipo de esperteza que abre buraco.

do $$
declare
  p record;
  usando text;
  conferindo text;
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (qual in ('is_staff()', 'is_admin()') or with_check in ('is_staff()', 'is_admin()'))
  loop
    usando := case when p.qual in ('is_staff()', 'is_admin()') then format(' using ((select %s))', p.qual) else '' end;
    conferindo := case when p.with_check in ('is_staff()', 'is_admin()') then format(' with check ((select %s))', p.with_check) else '' end;
    execute format('alter policy %I on %I.%I%s%s', p.policyname, p.schemaname, p.tablename, usando, conferindo);
  end loop;
end $$;

-- O período mais recente do Search Console sai direto do índice, sem ordenar
-- as 80 mil linhas a cada visita à tela de Métricas e à fila de pautas.
create index if not exists analytics_source_fim_idx
  on public.analytics_snapshots (source, period_end desc, period_start);
