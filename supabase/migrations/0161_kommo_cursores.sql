-- 0161: os cursores da leitura da Kommo e a marca das mensagens (cartão 45).
--
-- A rotina não depende só dos eventos para saber o que mudou: ela pede à Kommo
-- os negócios e os contatos alterados desde o último ponto (`filter[updated_at]`),
-- o que pega mudança de QUALQUER campo, inclusive os que não geram evento. A
-- carga inicial é a mesma leitura começando 90 dias atrás.
--
-- `carga_pagina` passa a ser a página dentro do MESMO segundo: se mais de 250
-- negócios mudaram no mesmo instante, o cursor não anda e a página sobe.

alter table public.kommo_estado
  add column if not exists negocios_ate     timestamptz,
  add column if not exists negocios_pagina  integer not null default 1,
  add column if not exists contatos_ate     timestamptz,
  add column if not exists contatos_pagina  integer not null default 1;

-- A última mensagem do cliente e da loja em cada negócio, a partir dos eventos
-- lidos desde `p_desde`. Só anda para a frente (o gatilho de kommo_negocios
-- guarda o maior valor). Chamada pela rotina, com a chave de serviço.
create or replace function public.kommo_marcar_mensagens(p_desde timestamptz)
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  v integer;
begin
  update public.kommo_negocios n
     set ultima_msg_cliente_em = coalesce(x.cliente, n.ultima_msg_cliente_em),
         ultima_msg_loja_em = coalesce(x.loja, n.ultima_msg_loja_em)
    from (
      select entidade_id,
             max(criado_em) filter (where tipo = 'incoming_chat_message') as cliente,
             max(criado_em) filter (where tipo = 'outgoing_chat_message') as loja
        from public.kommo_eventos
       where entidade = 'lead' and lido_em >= p_desde
         and tipo in ('incoming_chat_message', 'outgoing_chat_message')
       group by entidade_id
    ) x
   where n.id = x.entidade_id
     and (x.cliente > coalesce(n.ultima_msg_cliente_em, '-infinity') or x.loja > coalesce(n.ultima_msg_loja_em, '-infinity'));
  get diagnostics v = row_count;
  return v;
end $$;

revoke execute on function public.kommo_marcar_mensagens(timestamptz) from public, anon, authenticated;
