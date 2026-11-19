-- 0190: avisos por push no celular e no navegador (cartão 59).
--
-- O aviso do sistema da 0081 só funcionava com o painel aberto numa aba do
-- computador. Com Web Push o aviso chega com o painel fechado, inclusive no
-- celular com o painel instalado como aplicativo. O texto e o envio moram no
-- servidor (`src/lib/avisos/`); aqui ficam três coisas:
--
--   push_aparelhos  uma linha por aparelho ligado (a inscrição do navegador);
--   push_estado     por pessoa: até onde já foi avisada e se está com o painel
--                   à vista agora (aí não recebe push, a tela já mostra);
--   push_enviados   o que já virou aviso, por pessoa. A chave é única: é o
--                   que garante UM aviso por evento por pessoa, mesmo com duas
--                   rodadas ao mesmo tempo.
--
-- O QUE VIRA AVISO É A MESMA RÉGUA DE ANTES. A rodada chama `chat_para_avisar`
-- (0081/0082) e `suporte_para_avisar` (0102) EM NOME de cada pessoa
-- (`push_pendentes` põe o id dela na sessão do banco, só durante a chamada),
-- então o que chega no celular é exatamente o que o aviso do computador
-- mostraria. A Kommo é a régua de `kommo_meus_negocios` (0179) com um corte
-- de tempo a mais (só o que PASSOU a esperar desde a última rodada): a
-- função de lá devolve os mais antigos primeiro, e o negócio que acabou de
-- entrar na espera nunca caberia no topo. Mudou uma, muda a outra.
--
-- Tabelas com RLS ligada e sem policy: a pessoa só mexe nos próprios
-- aparelhos pelas funções abaixo, e a rotina lê com a chave de serviço.

create table if not exists public.push_aparelhos (
  id bigint generated always as identity primary key,
  pessoa uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://' and length(endpoint) <= 1000),
  p256dh text not null check (length(p256dh) between 20 and 200),
  auth text not null check (length(auth) between 8 and 100),
  tipo text not null default 'computador' check (tipo in ('celular', 'computador')),
  navegador text check (length(navegador) <= 60),
  avisar text[] not null default array['chat', 'suporte', 'kommo']::text[]
    check (avisar <@ array['chat', 'suporte', 'kommo']::text[]),
  criado_em timestamptz not null default now(),
  usado_em timestamptz,
  ultimo_erro text
);
create index if not exists push_aparelhos_pessoa on public.push_aparelhos (pessoa);
alter table public.push_aparelhos enable row level security;

create table if not exists public.push_estado (
  pessoa uuid primary key references public.profiles (id) on delete cascade,
  chat_desde timestamptz not null default now(),
  suporte_desde timestamptz not null default now(),
  kommo_desde timestamptz not null default now(),
  a_vista_ate timestamptz
);
alter table public.push_estado enable row level security;

create table if not exists public.push_enviados (
  pessoa uuid not null references public.profiles (id) on delete cascade,
  chave text not null,
  em timestamptz not null default now(),
  primary key (pessoa, chave)
);
create index if not exists push_enviados_em on public.push_enviados (pessoa, em);
alter table public.push_enviados enable row level security;

-- ------------------------------------------------------- portas da pessoa

/**
 * Liga este aparelho para a pessoa da sessão. O mesmo navegador ligado de
 * novo só atualiza a linha; aparelho que estava com outra pessoa (computador
 * da loja que trocou de mãos) passa para quem ligou agora. A primeira ligação
 * marca "avisada até agora": quem liga não recebe de uma vez o que já passou.
 */
create or replace function public.push_inscrever(
  p_endpoint text, p_p256dh text, p_auth text, p_tipo text, p_navegador text, p_avisar text[] default null
) returns jsonb
language plpgsql security definer set search_path to '' as $$
declare
  v_eu uuid := (select auth.uid());
  v_id bigint;
begin
  if v_eu is null or not coalesce(public.tem_acesso('time'), false) then
    raise exception 'sem_acesso';
  end if;
  insert into public.push_estado (pessoa) values (v_eu) on conflict (pessoa) do nothing;
  insert into public.push_aparelhos (pessoa, endpoint, p256dh, auth, tipo, navegador, avisar)
  values (v_eu, p_endpoint, p_p256dh, p_auth,
          case when p_tipo = 'celular' then 'celular' else 'computador' end,
          left(nullif(btrim(p_navegador), ''), 60),
          coalesce(p_avisar, array['chat', 'suporte', 'kommo']::text[]))
  on conflict (endpoint) do update
    set pessoa = excluded.pessoa, p256dh = excluded.p256dh, auth = excluded.auth,
        tipo = excluded.tipo, navegador = excluded.navegador,
        avisar = coalesce(p_avisar, public.push_aparelhos.avisar),
        ultimo_erro = null
  returning id into v_id;
  return jsonb_build_object('id', v_id);
end $$;

/** Desliga um aparelho da própria pessoa, pelo endereço (este aparelho) ou pelo número (a lista de aparelhos). */
create or replace function public.push_desligar(p_endpoint text default null, p_id bigint default null)
returns integer
language plpgsql security definer set search_path to '' as $$
declare
  v_eu uuid := (select auth.uid());
  v_n integer;
begin
  if v_eu is null then raise exception 'sem_acesso'; end if;
  delete from public.push_aparelhos a
   where a.pessoa = v_eu and ((p_endpoint is not null and a.endpoint = p_endpoint) or (p_id is not null and a.id = p_id));
  get diagnostics v_n = row_count;
  return v_n;
end $$;

/** O que avisa neste aparelho (chat, suporte, Kommo). */
create or replace function public.push_preferencias(p_endpoint text, p_avisar text[])
returns boolean
language plpgsql security definer set search_path to '' as $$
declare
  v_eu uuid := (select auth.uid());
begin
  if v_eu is null then raise exception 'sem_acesso'; end if;
  update public.push_aparelhos set avisar = coalesce(p_avisar, '{}'::text[])
   where pessoa = v_eu and endpoint = p_endpoint;
  return found;
end $$;

/** Os aparelhos ligados da pessoa. O endereço volta para a tela reconhecer "este aparelho"; as chaves não voltam. */
create or replace function public.push_meus_aparelhos()
returns jsonb
language sql stable security definer set search_path to '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id, 'endpoint', a.endpoint, 'tipo', a.tipo, 'navegador', a.navegador, 'avisar', a.avisar,
    'criado_em', a.criado_em, 'usado_em', a.usado_em, 'ultimo_erro', a.ultimo_erro) order by a.criado_em), '[]'::jsonb)
  from public.push_aparelhos a
  where a.pessoa = (select auth.uid());
$$;

/**
 * "Estou com o painel à vista": a moldura chama de minuto em minuto enquanto
 * a tela está na frente, e com falso ao sair. Quem está à vista não recebe
 * push: a tela já mostra (e toca o som). 90 segundos de folga cobrem um
 * minuto perdido; aba que fechou sem dizer nada para de contar sozinha.
 */
create or replace function public.push_estou_aqui(p_a_vista boolean)
returns void
language plpgsql security definer set search_path to '' as $$
declare
  v_eu uuid := (select auth.uid());
begin
  if v_eu is null then return; end if;
  -- Quem nunca ligou um aparelho não precisa de linha: a rodada só olha quem tem aparelho.
  update public.push_estado
     set a_vista_ate = case when p_a_vista then now() + interval '90 seconds' else null end
   where pessoa = v_eu;
end $$;

-- ------------------------------------------------------- portas da rotina

/**
 * O que está pendente para cada pessoa com aparelho ligado. Só a chave de
 * serviço chama. Para cada pessoa, o id dela entra na sessão do banco durante
 * as chamadas, e as funções da 0081, da 0102 e a régua da 0179 respondem como
 * responderiam a ela (com a conferência de acesso de cada uma). Ao fim, a
 * sessão volta ao que era.
 */
create or replace function public.push_pendentes()
returns jsonb
language plpgsql volatile security definer set search_path to '' as $$
declare
  v_claims text := current_setting('request.jwt.claims', true);
  v_sub text := current_setting('request.jwt.claim.sub', true);
  v_atencao interval := interval '30 minutes';
  r record;
  v_kommo jsonb;
  v_saida jsonb := '[]'::jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' and current_user not in ('postgres', 'service_role', 'supabase_admin') then
    raise exception 'sem_acesso';
  end if;

  -- O que já foi avisado há mais de uma semana não segura mais nada.
  delete from public.push_enviados where em < now() - interval '7 days';

  for r in
    select e.*
      from public.push_estado e
      join public.profiles p on p.id = e.pessoa and p.is_active
     where exists (select 1 from public.push_aparelhos a where a.pessoa = e.pessoa)
  loop
    perform set_config('request.jwt.claim.sub', r.pessoa::text, true);
    perform set_config('request.jwt.claims', jsonb_build_object('sub', r.pessoa, 'role', 'authenticated')::text, true);

    v_kommo := null;
    if coalesce(public.tem_acesso('lancar_venda'), false) or coalesce(public.tem_acesso('vendas'), false) or coalesce(public.is_admin(), false) then
      -- A régua de `kommo_meus_negocios` (0179), só com o que entrou na espera desde a última rodada.
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', x.id, 'motivo', x.motivo, 'desde', x.desde, 'funil', f.nome, 'etapa', t.nome) order by x.desde), '[]'::jsonb)
        into v_kommo
        from (
          select n.id, n.funil_id, n.etapa_id,
                 case when s.sem_resposta and n.ultima_msg_cliente_em < now() - v_atencao then 'sem_resposta' else 'esperando_vendedor' end as motivo,
                 case when s.sem_resposta and n.ultima_msg_cliente_em < now() - v_atencao then n.ultima_msg_cliente_em else n.etapa_desde end as desde
            from public.kommo_negocios n
            join public.kommo_mapa m on m.usuario_id = n.responsavel_id and m.profile_id = r.pessoa
            left join public.fases_da_kommo fa on fa.funil_id = n.funil_id and fa.etapa_id = n.etapa_id
            cross join lateral (select coalesce(n.ultima_msg_cliente_em > coalesce(n.ultima_msg_loja_em, '-infinity'::timestamptz), false) as sem_resposta) s
           where not n.apagado
             and n.etapa_id not in (142, 143)
             and coalesce(fa.fase, '') not in ('ganho', 'perdido', 'pos_venda')
             and ((s.sem_resposta and n.ultima_msg_cliente_em < now() - v_atencao)
                  or (fa.fase = 'esperando_vendedor' and n.etapa_desde < now() - v_atencao))
        ) x
        left join public.kommo_funis f on f.id = x.funil_id
        left join public.kommo_etapas t on t.id = x.etapa_id and t.funil_id = x.funil_id
       where x.desde + v_atencao > r.kommo_desde - interval '1 minute'
       limit 20;
    end if;

    v_saida := v_saida || jsonb_build_array(jsonb_build_object(
      'pessoa', r.pessoa,
      'a_vista', coalesce(r.a_vista_ate > now(), false),
      'no_minuto', (select count(*) from public.push_enviados x where x.pessoa = r.pessoa and x.em > now() - interval '60 seconds'),
      'chat', public.chat_para_avisar(r.chat_desde),
      'suporte', public.suporte_para_avisar(r.suporte_desde),
      'kommo', v_kommo,
      'agora', now(),
      'aparelhos', (select coalesce(jsonb_agg(jsonb_build_object(
          'id', a.id, 'endpoint', a.endpoint, 'p256dh', a.p256dh, 'auth', a.auth, 'avisar', a.avisar)), '[]'::jsonb)
        from public.push_aparelhos a where a.pessoa = r.pessoa)
    ));
  end loop;

  perform set_config('request.jwt.claim.sub', coalesce(v_sub, ''), true);
  perform set_config('request.jwt.claims', coalesce(v_claims, ''), true);
  return v_saida;
end $$;

/**
 * Reserva as chaves do que vai virar aviso e anda com os marcadores da
 * pessoa. Devolve só as chaves que entraram AGORA: a que já estava lá foi
 * avisada por outra rodada e não sai de novo.
 */
create or replace function public.push_reservar(
  p_pessoa uuid, p_chaves text[], p_chat_ate timestamptz, p_suporte_ate timestamptz, p_kommo_ate timestamptz
) returns text[]
language plpgsql volatile security definer set search_path to '' as $$
declare
  v_novas text[];
begin
  if coalesce(auth.role(), '') <> 'service_role' and current_user not in ('postgres', 'service_role', 'supabase_admin') then
    raise exception 'sem_acesso';
  end if;
  with entrou as (
    insert into public.push_enviados (pessoa, chave)
    select p_pessoa, c from unnest(coalesce(p_chaves, '{}'::text[])) c
    on conflict do nothing
    returning chave
  )
  select coalesce(array_agg(chave), '{}'::text[]) into v_novas from entrou;
  update public.push_estado
     set chat_desde = greatest(chat_desde, coalesce(p_chat_ate, chat_desde)),
         suporte_desde = greatest(suporte_desde, coalesce(p_suporte_ate, suporte_desde)),
         kommo_desde = greatest(kommo_desde, coalesce(p_kommo_ate, kommo_desde))
   where pessoa = p_pessoa;
  return v_novas;
end $$;

-- ------------------------------------------------------- quem dispara

/**
 * Chama a rota que manda os avisos (`/api/cron/push`), pelo mesmo endereço e
 * segredo das outras rotinas. Sem aparelho ligado, não chama: não há a quem
 * avisar. `p_sempre` é a volta do relógio de 15 em 15 minutos, que deixa
 * pulso para a Saúde mesmo sem ninguém ligado.
 */
create or replace function public.disparar_push(p_sempre boolean default false)
returns void
language plpgsql security definer set search_path to 'public', 'extensions', 'net' as $$
declare
  v_url text;
  v_segredo text;
begin
  if not p_sempre and not exists (select 1 from public.push_aparelhos) then
    return;
  end if;
  select value->>'url' into v_url from public.site_settings where key = 'cron';
  select access_token into v_segredo from public.integration_tokens where provider = 'cron';
  if v_url is null or v_url = '' or v_segredo is null then
    return;
  end if;
  perform net.http_post(
    url     := rtrim(v_url, '/') || '/api/cron/push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_segredo),
    body    := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
end $$;

/**
 * Mensagem nova no chat e caso de suporte que entrou ou fechou chamam a rota
 * na hora. O pedido do `pg_net` só sai depois do commit, então a rota já
 * enxerga a mensagem. Falha aqui NUNCA derruba quem escreveu: o relógio de
 * minuto em minuto cobre.
 */
create or replace function public.push_ao_mudar()
returns trigger
language plpgsql security definer set search_path to '' as $$
begin
  begin
    perform public.disparar_push(false);
  exception when others then
    raise warning 'disparar_push: %', sqlerrm;
  end;
  return null;
end $$;

drop trigger if exists push_chat_mensagem on public.chat_mensagens;
create trigger push_chat_mensagem after insert on public.chat_mensagens
  for each row execute function public.push_ao_mudar();

drop trigger if exists push_suporte_caso on public.suporte_casos;
create trigger push_suporte_caso after insert or update of estado on public.suporte_casos
  for each row execute function public.push_ao_mudar();

-- ------------------------------------------------------- acessos

revoke all on table public.push_aparelhos, public.push_estado, public.push_enviados from public, anon, authenticated;

revoke execute on function public.push_inscrever(text, text, text, text, text, text[]) from public, anon;
revoke execute on function public.push_desligar(text, bigint) from public, anon;
revoke execute on function public.push_preferencias(text, text[]) from public, anon;
revoke execute on function public.push_meus_aparelhos() from public, anon;
revoke execute on function public.push_estou_aqui(boolean) from public, anon;
grant execute on function public.push_inscrever(text, text, text, text, text, text[]) to authenticated;
grant execute on function public.push_desligar(text, bigint) to authenticated;
grant execute on function public.push_preferencias(text, text[]) to authenticated;
grant execute on function public.push_meus_aparelhos() to authenticated;
grant execute on function public.push_estou_aqui(boolean) to authenticated;

revoke execute on function public.push_pendentes() from public, anon, authenticated;
revoke execute on function public.push_reservar(uuid, text[], timestamptz, timestamptz, timestamptz) from public, anon, authenticated;
revoke execute on function public.disparar_push(boolean) from public, anon, authenticated;
revoke execute on function public.push_ao_mudar() from public, anon, authenticated;
grant execute on function public.push_pendentes() to service_role;
grant execute on function public.push_reservar(uuid, text[], timestamptz, timestamptz, timestamptz) to service_role;

-- O relógio: de minuto em minuto quando há aparelho (a Kommo e o que o gatilho perdeu), e de 15 em 15 sempre.
select cron.schedule('avisar-por-push', '* * * * *', $$select public.disparar_push(extract(minute from now())::int % 15 = 0);$$);
