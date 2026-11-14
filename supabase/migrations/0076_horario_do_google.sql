-- 0076: o horário que o Google tem de cada loja.
--
-- A leitura diária do Perfil da Empresa (0048) já passa por cada loja para
-- buscar as avaliações. Passa a trazer junto o horário de funcionamento, que
-- vem na mesma chamada. Seis das onze lojas do portal estão sem horário na
-- página pública porque ninguém confirmou, e o Google tem o de quatro delas.
--
-- O horário NÃO vai sozinho para a página da loja: fica guardado aqui, a tela
-- de avaliações mostra, e uma pessoa decide usar. A regra da casa continua
-- valendo: horário só vai ao ar com a fonte escrita.

alter table public.google_locais add column if not exists horario jsonb;

comment on column public.google_locais.horario is
  'O horário de funcionamento como o Google devolve (regularHours). Só é copiado para a página da loja quando uma pessoa manda.';
