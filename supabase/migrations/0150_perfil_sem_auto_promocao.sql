-- Perfil sem auto-promoção. Achado da auditoria de segurança de 18/11/2026.
--
-- O QUE ESTAVA ABERTO. A policy `profiles_self_update` (0003) deixava toda
-- conta logada fazer UPDATE na PRÓPRIA linha de `profiles`, sem limitar
-- coluna. Policy de linha não restringe coluna, e o papel `authenticated` tem
-- UPDATE na tabela inteira pelas permissões padrão do Supabase (conferido em
-- produção em 18/11: inclusive em `role` e `is_active`, e o único gatilho era
-- o de `updated_at`). Bastava um PATCH em /rest/v1/profiles?id=eq.<o próprio id>
-- com {"role":"admin","is_active":true}, com a chave anônima que vai no HTML e
-- o token da própria sessão. Como `is_admin()`, `is_staff()`, `tem_acesso()`,
-- `meus_acessos()`, o painel (`getSessionProfile`) e o conector leem
-- exatamente essas duas colunas, a conta virava diretoria em tudo. Valia para
-- qualquer nível (tráfego, vendas, autor...), para conta desativada que ainda
-- tem login e para quem se cadastrasse pelo endpoint público do Supabase.
--
-- O CONSERTO, EM DUAS CAMADAS.
-- 1. A policy sai. Nenhuma tela edita o próprio perfil: quem grava em
--    `profiles` é a diretoria (`profiles_admin_manage`, nas ações de
--    /admin/usuarios) e a chave de serviço (convite, reenvio, conector).
-- 2. Um gatilho recusa mudar `role`, `is_active` ou `id` para quem não é
--    diretoria. É a trava que sobra se um dia alguém recriar uma policy de
--    autoedição. A função NÃO é `security definer`, de propósito (ver a
--    armadilha da 0050 no CLAUDE.md): assim `current_user` é quem de fato está
--    gravando, e a chave de serviço e o editor SQL passam pelo nome.

drop policy if exists profiles_self_update on public.profiles;

create or replace function public.profiles_trava_papel()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.role is distinct from old.role
      or new.is_active is distinct from old.is_active
      or new.id is distinct from old.id)
     and not coalesce(public.is_admin(), false)
     and current_user not in ('postgres', 'service_role', 'supabase_admin') then
    raise exception 'Nível e ativação de uma conta só mudam pela diretoria.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_trava_papel on public.profiles;
create trigger profiles_trava_papel
  before update on public.profiles
  for each row execute function public.profiles_trava_papel();
