-- Endurecimento (parte 2): remover o grant EXECUTE default a PUBLIC.
-- O `revoke ... from anon, authenticated` do 0008 não bastava porque o grant
-- a PUBLIC continuava permitindo a execução. Aqui removemos de PUBLIC e
-- reconcedemos apenas ao papel `authenticated` nas helpers usadas em RLS.

revoke execute on function public.handle_new_user() from public;
revoke execute on function public.is_staff()  from public;
revoke execute on function public.is_admin()  from public;

-- is_staff()/is_admin() são chamadas dentro das policies RLS (role authenticated).
grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_admin() to authenticated;

-- handle_new_user() é SÓ trigger (dispara sem depender do EXECUTE do papel).
