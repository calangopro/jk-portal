-- 0080: tira o que sobrou dos chamados entre setores.
--
-- Os chamados da 0072 viraram o chat do time (0079) um dia depois de entrarem
-- no ar. Esta migration só roda DEPOIS de o código do chat estar publicado: o
-- código antigo chamava as funções que saem aqui.
--
-- NADA DE DADO É APAGADO. Os chamados nunca tiveram uma linha gravada, e a
-- primeira coisa que este arquivo faz é conferir isso: se existir um chamado,
-- uma mensagem, um anexo ou uma resposta da biblioteca presa a um chamado, a
-- migration para com erro e não tira nada.
--
-- O QUE FICA, porque o chat usa: `setores_do_time`, `meus_setores()`,
-- `pessoas_do_time()`, o bucket `chamados` (bucket não muda de nome) e as duas
-- policies de armazenamento dele.

do $$
begin
  if exists (select 1 from public.chamados)
     or exists (select 1 from public.chamado_mensagens)
     or exists (select 1 from public.chamado_anexos)
     or exists (select 1 from public.biblioteca_respostas where chamado_id is not null) then
    raise exception 'Há chamados gravados: a 0080 não tira tabela com dado. Leve os chamados para o chat antes.';
  end if;
end
$$;

drop function public.chamado_virar_resposta(uuid, text, text, text, text);
drop function public.chamados_para_mim();
drop function public.chamado_detalhe(bigint);
drop function public.chamados_listar(integer);
drop function public.resolver_chamado(uuid);
drop function public.responder_chamado(uuid, text, jsonb);
drop function public.abrir_chamado(text, text, text, uuid, timestamptz, uuid, jsonb);
drop function public.chamado_prender_anexos(uuid, bigint, jsonb, uuid);

drop index public.biblioteca_respostas_chamado_idx;
alter table public.biblioteca_respostas drop column chamado_id;

drop table public.chamado_anexos;
drop table public.chamado_mensagens;
drop table public.chamados;

comment on table public.setores_do_time is
  'A que setor cada nível de acesso responde no chat do time: é o que decide de quais salas a mensagem nova vira número no menu, e de quem é o pedido que espera resposta. É premissa de partida: a JK ajusta mudando linhas.';
