-- Fecha a porta pública do registro de 404.
--
-- A versão de 0028 concedia `execute` a `anon` para a página de erro conseguir
-- gravar. Funciona, e abre uma porta que não precisa existir: com a chave
-- anônima (que vai no HTML de toda página) qualquer pessoa poderia chamar a
-- função direto na API do PostgREST e encher a fila de endereços quebrados com
-- caminhos inventados, justamente a tela que deveria mostrar link quebrado de
-- verdade.
--
-- Agora quem grava é o endpoint `/api/404` do portal, com a chave de serviço.
-- É a mesma escolha do resto do projeto: o servidor é a única porta de escrita.
--
-- O teto de linhas é defesa em profundidade. Mesmo com a porta fechada, um
-- defeito no endpoint não pode fazer a tabela crescer sem limite. Contagem de
-- endereço que já existe continua subindo sempre: o teto vale para caminho
-- novo, que é o vetor de inchaço.

revoke execute on function public.registrar_404(text, text) from anon, authenticated;

create or replace function public.registrar_404(p_path text, p_referrer text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_path text;
  v_existe boolean;
  v_total integer;
begin
  v_path := split_part(split_part(coalesce(p_path, ''), '?', 1), '#', 1);

  if v_path = '' or v_path = '/' or left(v_path, 1) <> '/' or length(v_path) > 200 then
    return;
  end if;

  -- Sem lookahead: a expressão regular do Postgres é POSIX, não PCRE.
  if v_path ~* '(wp-|wordpress|xmlrpc|\.env|\.git|\.php|\.asp|\.jsp|/vendor/|/cgi-bin/|phpmyadmin)' then
    return;
  end if;

  select exists(select 1 from public.not_found_hits where path = v_path) into v_existe;

  if not v_existe then
    select count(*) into v_total from public.not_found_hits where not resolved;
    -- Fila com mais de 500 endereços distintos por resolver já não é fila, é
    -- despejo, e ninguém trabalha nela. Parar de aceitar caminho novo preserva
    -- o que está lá em vez de afogar o sinal no ruído.
    if v_total >= 500 then
      return;
    end if;
  end if;

  insert into public.not_found_hits (path, referrer)
  values (v_path, left(nullif(p_referrer, ''), 500))
  on conflict (path) do update
    set hits = public.not_found_hits.hits + 1,
        last_seen = now(),
        referrer = coalesce(left(nullif(excluded.referrer, ''), 500), public.not_found_hits.referrer),
        resolved = case when public.not_found_hits.resolved and public.not_found_hits.last_seen < now() - interval '7 days'
                        then false else public.not_found_hits.resolved end;
end $$;

revoke execute on function public.registrar_404(text, text) from public, anon, authenticated;
