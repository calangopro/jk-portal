-- Concede a coluna que a view usa no filtro.
--
-- Sem isto, `fatos_publicos` recusava a consulta inteira do anônimo, mesmo com
-- todas as colunas do `select` já concedidas em 0034. Com `security_invoker` a
-- view roda como quem consulta, e o Postgres exige permissão também na coluna do
-- `where`. O erro sai como "permission denied for table facts", sem apontar a
-- coluna, e foi preciso testar pela API para achar.
-- Conceder `status` não abre nada: a policy de `anon` já só deixa ver linha
-- aprovada, então o único valor que ele consegue ler ali é 'aprovado'.
grant select (status) on public.facts to anon;
