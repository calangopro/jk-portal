-- Endurecimento de segurança (resolve avisos do Security Advisor).

-- 1) search_path fixo no trigger de updated_at (evita hijack de search_path).
alter function public.set_updated_at() set search_path = public;

-- 2) Funções auxiliares NÃO devem ser chamáveis via RPC pública (anon).
--    Elas continuam funcionando dentro das policies RLS (role authenticated) e
--    o trigger continua disparando handle_new_user normalmente (o gatilho não
--    depende do EXECUTE do usuário).
revoke execute on function public.handle_new_user() from anon, authenticated;
revoke execute on function public.is_staff() from anon;
revoke execute on function public.is_admin() from anon;
