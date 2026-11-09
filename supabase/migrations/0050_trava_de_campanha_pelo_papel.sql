-- Corrige a trava de aprovação de campanha da 0049.
--
-- A 0049 liberava o "servidor" por `session_user in ('postgres', ...)`. Pelo
-- PostgREST o `session_user` é `authenticator` e a trava funcionava, mas no
-- editor SQL e em qualquer conexão direta ele é `postgres` MESMO depois de
-- `set role authenticated`, então o teste com JWT de editor aprovava campanha.
--
-- Como os gatilhos e esta função rodam com o papel de quem chama (sem
-- `security definer`), `current_user` é o papel do pedido: `authenticated`
-- para qualquer pessoa logada, `service_role` para o servidor do portal e
-- `postgres` no editor SQL. É ele que decide, mais o `is_admin()`.

create or replace function public.pode_aprovar_campanha()
returns boolean
language sql
stable
set search_path = ''
as $$
  select public.is_admin()
      or current_user in ('postgres', 'service_role', 'supabase_admin')
$$;
