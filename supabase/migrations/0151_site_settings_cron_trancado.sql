-- 0151: três chaves de `site_settings` só mudam pela diretoria, e a principal é `cron`.
--
-- O furo: `cron` guarda o endereço para onde as funções `disparar_*` (doze em
-- 18/11/2026) mandam o segredo das rotinas, no cabeçalho `x-cron-secret`, lido
-- de `integration_tokens`. A policy `site_settings_staff_write` (0021) deixa
-- qualquer perfil com `is_staff()` gravar QUALQUER chave da tabela, e
-- `is_staff()` vale para todo nível menos vendas, fábrica e social media:
-- editor, revisor, autor, gerente e tráfego entram. Quem trocasse o endereço
-- por um dele, pela API com a chave anônima e a própria sessão, receberia o
-- segredo na rodada seguinte do relógio e passaria a chamar toda rota de
-- `/api/cron`. Apagar a linha parava o relógio inteiro. Achado escrito no PR 141.
--
-- A trava é um gatilho, e não uma policy, pelo mesmo motivo da 0135: a policy de
-- escrita é uma só para a tabela inteira, e `pagina:home`, `pagina:bio` e
-- `pagina:grupo` continuam sendo da equipe do site (área `site`).
--
-- As chaves trancadas são as que nenhuma tela deixa a equipe gravar hoje:
--   cron            o endereço do segredo (o furo)
--   tema            a tela de Aparência e `aparencia.salvar` no conector já
--                   pedem a diretoria (`requireAdmin`, `soAdmin`)
--   vendas:entrega  as regras do malote: quem grava é a ação da Consulta, que
--                   pede a diretoria e usa a chave de serviço
-- As `google:*` já têm a trava da 0135 e ficam com ela.
--
-- Diretoria é `is_admin()` (administrador, dono e GM). A chave de serviço e o
-- editor SQL passam, e é por ela que o conector e a Consulta gravam: o que eles
-- deixam ou não fazer continua no código deles.
--
-- Sem `security definer`: `current_user` precisa ser o papel de quem chama, e
-- `session_user` engana no editor SQL (ver 0050). Vale para criar, mudar e
-- apagar, e trocar o nome de uma linha também conta: a chave de antes e a de
-- depois são conferidas.

create or replace function public.site_settings_trava_diretoria()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_trancadas constant text[] := array['cron', 'tema', 'vendas:entrega'];
begin
  if (tg_op in ('UPDATE', 'DELETE') and old.key = any (v_trancadas))
     or (tg_op in ('INSERT', 'UPDATE') and new.key = any (v_trancadas)) then
    if not coalesce(public.is_admin() or current_user in ('postgres', 'service_role', 'supabase_admin'), false) then
      raise exception 'Só a diretoria muda esta configuração do site.' using errcode = '42501';
    end if;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end $$;

create trigger site_settings_trava_diretoria
  before insert or update or delete on public.site_settings
  for each row execute function public.site_settings_trava_diretoria();
