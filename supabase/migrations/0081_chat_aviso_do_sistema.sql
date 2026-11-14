-- 0081: o que avisar a cada pessoa, para o aviso do sistema do chat.
--
-- O chat (0079) mostrava mensagem nova só no número do menu e no título da
-- aba. O dono pediu o aviso do sistema (a notificação do computador) para
-- quando o painel está em segundo plano.
--
-- O canal ao vivo só diz "há novidade na sala tal", sem texto. Para montar o
-- aviso, o navegador pergunta aqui o que chegou PARA A PESSOA desde a última
-- vez. A régua é a mesma do número do menu (`chat_resumo`): a sala geral, as
-- salas do setor dela e resposta a uma mensagem dela, em qualquer sala. O que
-- ela já leu, o que ela mesma escreveu e o que foi apagado ficam de fora.
--
-- Devolve só o que o aviso mostra: quem, em que sala e o começo do texto.
-- Imagem não vai (print de conversa tem dado de cliente): só a contagem.

create function public.chat_para_avisar(p_desde timestamptz default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_quem uuid := (select auth.uid());
  v_setores text[];
  -- Pede um pouco para trás: duas gravações quase juntas podem terminar fora de
  -- ordem. Quem chama guarda os números que já avisou e não repete. E nunca
  -- volta mais de uma hora: aba que dormiu o dia inteiro não despeja a manhã.
  v_desde timestamptz := greatest(coalesce(p_desde, now()) - interval '10 seconds', now() - interval '1 hour');
begin
  if not coalesce(public.tem_acesso('time'), false) then
    return jsonb_build_object('agora', now(), 'mensagens', '[]'::jsonb);
  end if;
  v_setores := public.meus_setores();
  return jsonb_build_object(
    'agora', now(),
    'mensagens', coalesce((
      select jsonb_agg(x.j order by x.id)
      from (
        select c.id, jsonb_build_object(
          'id', c.id,
          'sala', c.sala,
          'autor_nome', public.chat_nome(c.autor),
          'trecho', left(btrim(regexp_replace(c.texto, '\s+', ' ', 'g')), 140),
          'imagens', (select count(*) from public.chat_anexos a where a.mensagem_id = c.id),
          'pede', c.pede_resposta,
          'para_mim', exists (select 1 from public.chat_mensagens o where o.id = c.responde_a and o.autor = v_quem),
          'em', c.criada_em) as j
        from public.chat_mensagens c
        left join public.chat_leituras l on l.pessoa = v_quem and l.sala = c.sala
        where c.criada_em > v_desde
          and c.apagada_em is null
          and c.autor is distinct from v_quem
          and c.id > coalesce(l.lida_ate, 0)
          and (c.sala = 'geral'
               or c.sala = any (v_setores)
               or exists (select 1 from public.chat_mensagens o where o.id = c.responde_a and o.autor = v_quem))
        order by c.id desc
        limit 8
      ) x), '[]'::jsonb)
  );
end
$$;

revoke execute on function public.chat_para_avisar(timestamptz) from public, anon;
grant execute on function public.chat_para_avisar(timestamptz) to authenticated;
