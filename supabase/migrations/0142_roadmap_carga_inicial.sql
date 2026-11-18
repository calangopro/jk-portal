-- 0142: a carga inicial do Roadmap (0141), tirada das listas "Falta" e
-- "Pendências" do CLAUDE.md em 18/11/2026.
--
-- Entra o que é trabalho de código ou de configuração do sistema. Fica de
-- fora o que só depende de resposta da JK (confirmar a biblioteca, prazos,
-- quem atende). Nenhum valor em dinheiro, nenhum nome ou telefone de cliente.
--
-- Pode ser refeita: cada cartão tem uma `referencia`, e `roadmap_criar` pula
-- o que já existe. Todos entram sem dono; quem pega diz o ramo e os caminhos.
-- Quem cria é o perfil do Filipe (quem pediu o quadro); sem esse perfil (um
-- banco novo), a carga não entra e a migration segue.

do $$
declare
  v_quem uuid;
  v_r jsonb;
begin
  select p.id into v_quem from public.profiles p where p.full_name = 'Filipe' and p.role::text = 'gm' and p.is_active limit 1;
  if v_quem is null then
    raise notice 'Sem o perfil do Filipe: a carga inicial do Roadmap não entrou.';
    return;
  end if;

  -- O banco só aceita `p_quem` vindo da chave de serviço.
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);

  v_r := public.roadmap_criar($carga$[
    {"referencia":"carga-2026-11-18:vercel-pro","origem":"carga","coluna":"a_fazer","tipo":"atualizacao","prioridade":"urgente",
     "titulo":"Tirar o jk-portal do plano gratuito da Vercel",
     "descricao":"A conta que hospeda o jk-portal está no plano Hobby, que é para uso não comercial, e serve o domínio de uma loja. É motivo de suspensão: se a Vercel agir, o /guias sai do ar inteiro. O time Agencia Setup já está em Pro e não tem projeto com esse nome.\n\nPronto é: projeto no time Pro, e jk-portal.vercel.app respondendo (é o destino escrito no Worker). Se o endereço mudar, ajustar infra/cloudflare/worker.js e republicar.",
     "caminhos":["infra/cloudflare/worker.js","vercel.json"]},
    {"referencia":"carga-2026-11-18:supabase-cadastro-publico","origem":"carga","coluna":"a_fazer","tipo":"seguranca","prioridade":"urgente",
     "titulo":"Desligar o cadastro público no Supabase",
     "descricao":"Authentication, Sign In / Providers, \"Allow new users to sign up\" está ligado. É a única parte da falha corrigida na 0020 que não dá para fechar por migration. Conta sem convite nasce inativa, mas o endpoint continua aberto.\n\nPronto é: a chave desligada no painel do Supabase e um teste de cadastro pela chave anônima sendo recusado."},
    {"referencia":"carga-2026-11-18:supabase-site-url-smtp","origem":"carga","coluna":"a_fazer","tipo":"seguranca","prioridade":"alta",
     "titulo":"Supabase: Site URL do domínio da JK e SMTP próprio",
     "descricao":"O Site URL ainda é o da Vercel e o SMTP é o de teste, que só entrega para quem é do time do projeto no Supabase. Convite e recuperação de senha dependem disso. Passo a passo em docs/acesso-e-medicao.md.\n\nPronto é: Site URL https://www.jkaliancas.com.br/guias, a lista de Redirect URLs com /guias/**, os modelos de supabase/templates colados e um convite de teste chegando num e-mail de fora.",
     "caminhos":["supabase/templates","docs/acesso-e-medicao.md"]},
    {"referencia":"carga-2026-11-18:senhas-e-chaves","origem":"carga","coluna":"a_fazer","tipo":"seguranca","prioridade":"alta",
     "titulo":"Trocar a senha temporária do master e rotacionar a chave da OpenAI",
     "descricao":"Pendência antiga do CLAUDE.md. A chave da OpenAI é a do assistente do editor e do tutor do vendedor: trocar na Vercel e conferir as duas telas depois."},
    {"referencia":"carga-2026-11-18:supabase-senha-vazada","origem":"carga","coluna":"a_fazer","tipo":"seguranca","prioridade":"media",
     "titulo":"Ligar a proteção de senha vazada no Supabase",
     "descricao":"\"Leaked password protection\", em Authentication. O advisor do Supabase aponta."},
    {"referencia":"carga-2026-11-18:chaves-de-integracao","origem":"carga","coluna":"a_fazer","tipo":"atualizacao","prioridade":"alta",
     "titulo":"Colar as chaves que faltam em Integrações: RD Station, Kommo, Meta e DevZapp",
     "descricao":"Os contatos captados (bio, /grupo, pop-up da loja) não chegam ao CRM: a chave do RD Station é recusada desde 11/11, e Kommo, API de Conversões do Meta e o webhook e aviso de entrada do DevZapp nunca foram colados. O que ficou guardado sai pelo botão \"Enviar os guardados\".\n\nPronto é: Saúde das ligações sem destino recusando nem \"não ligado\"."},
    {"referencia":"carga-2026-11-18:meta-compra-servidor","origem":"carga","coluna":"a_fazer","tipo":"atualizacao","prioridade":"alta",
     "titulo":"Ligar a compra da loja pelo servidor no Meta (01/12)",
     "descricao":"A medição pelo painel está construída e desligada (docs/medicao-pelo-painel.md). Falta o token de usuário do sistema com o conjunto de dados no cartão do Meta em Integrações, a resposta da Tray sobre desligar o pixel sem perder o catálogo, e o roteiro do dia 01/12, quando o Filipe assume o tráfego.\n\nDepende do cartão da política de privacidade.",
     "caminhos":["src/lib/meta","infra/gtm/loja-meta.json"]},
    {"referencia":"carga-2026-11-18:politica-meta-sinais","origem":"carga","coluna":"a_fazer","tipo":"atualizacao","prioridade":"alta",
     "titulo":"Política de privacidade: os sinais guardados para o Meta",
     "descricao":"Antes de ligar o envio pelo servidor, a política precisa dizer que o painel guarda _fbp, _fbc, navegador e IP por 30 dias, só com número de pedido (meta_sinais, 0120)."},
    {"referencia":"carga-2026-11-18:estoque-pela-api","origem":"carga","coluna":"a_fazer","tipo":"melhoria","prioridade":"alta",
     "titulo":"Estoque do catálogo pela API da Tray",
     "descricao":"O espelho tem as variações sem estoque nem numeração, porque a busca pública da Tray não entrega. Com a API, a Consulta do vendedor e a pronta entrega passam a ter estoque de verdade. Rota nova da API só entra em uso depois de ter evidência na homologação.\n\nDepende da JK dizer onde vive o estoque de cada loja.",
     "caminhos":["src/lib/tray","src/lib/consulta","src/lib/vendas/pedidos-da-api.ts"]},
    {"referencia":"carga-2026-11-18:carrinho-abandonado","origem":"carga","coluna":"ideias","tipo":"melhoria","prioridade":"media",
     "titulo":"Carrinho abandonado pela API da Tray",
     "descricao":"Testado na loja de testes: GET /carts, /carts/:session_id e /complete respondem 200, com e-mail e sem telefone, sem mexer no aplicativo. Nada foi construído, e essas rotas não estão entre as sete da homologação: precisam de evidência antes de entrar em uso.",
     "caminhos":["src/lib/tray","src/lib/vendas"]},
    {"referencia":"carga-2026-11-18:pedido-status-rastreio","origem":"carga","coluna":"ideias","tipo":"melhoria","prioridade":"media",
     "titulo":"Levar o status e o rastreio da fábrica para o pedido na Tray",
     "descricao":"O rastreio anotado na fila da fábrica não vai para a loja. Escrita em pedido não foi testada na API (criar pedido de teste exige cliente com CPF). Toda escrita na loja passa por src/lib/loja/alterar.ts.",
     "caminhos":["src/lib/fabrica","src/lib/loja"]},
    {"referencia":"carga-2026-11-18:notinha-do-pedido","origem":"carga","coluna":"a_fazer","tipo":"melhoria","prioridade":"media",
     "titulo":"Notinha do pedido para imprimir na fábrica",
     "descricao":"A ficha de cada pedido para a bancada: peças, numeração de cada aro, texto da gravação como o cliente escreveu, entrega. Vale para pedido da loja e venda por fora (os dois já saem no mesmo formato).",
     "caminhos":["/admin/fabrica","src/lib/fabrica"]},
    {"referencia":"carga-2026-11-18:venda-corrigir-producao","origem":"carga","coluna":"a_fazer","tipo":"melhoria","prioridade":"media",
     "titulo":"Corrigir a produção de uma venda por fora já lançada",
     "descricao":"Hoje as peças e a entrega só se informam na hora de registrar a venda. Depois que a fábrica pega, o vendedor não corrige por baixo: a correção precisa respeitar isso.",
     "caminhos":["/admin/registrar-venda","src/lib/vendas/producao.ts"]},
    {"referencia":"carga-2026-11-18:apagar-endereco-entregue","origem":"carga","coluna":"ideias","tipo":"seguranca","prioridade":"media",
     "titulo":"Apagar o endereço da venda por fora depois da entrega",
     "descricao":"vendas_producao.endereco é gravado porque sem ele a fábrica não despacha. Depois de entregue, não precisa ficar.",
     "caminhos":["src/lib/vendas/producao.ts","supabase/migrations"]},
    {"referencia":"carga-2026-11-18:chat-conversa-privada","origem":"carga","coluna":"a_fazer","tipo":"melhoria","prioridade":"media",
     "titulo":"Conversa privada entre duas pessoas no chat do time",
     "descricao":"Hoje todo o time lê todas as salas, e a tela diz isso. Conversa privada precisa de regra de quem lê, no banco, e de aparecer no número do menu e no aviso do sistema.",
     "caminhos":["src/lib/time","/admin/chat"]},
    {"referencia":"carga-2026-11-18:chat-digitando","origem":"carga","coluna":"ideias","tipo":"melhoria","prioridade":"baixa",
     "titulo":"Mostrar \"digitando\" no chat do time",
     "descricao":"Pela presença do canal ao vivo (painel:time), sem gravar nada.",
     "caminhos":["src/lib/time/ao-vivo.ts","/admin/chat"]},
    {"referencia":"carga-2026-11-18:chat-marcacoes","origem":"carga","coluna":"ideias","tipo":"melhoria","prioridade":"baixa",
     "titulo":"Chat: marcar produto do catálogo, venda por fora e @todos",
     "descricao":"As marcações de hoje são pessoa, setor, pedido e meta (0082). Quem escreve o que vai dentro é o banco (chat_normalizar).",
     "caminhos":["src/lib/time/chat.ts","/admin/chat"]},
    {"referencia":"carga-2026-11-18:threads","origem":"carga","coluna":"a_fazer","tipo":"atualizacao","prioridade":"media",
     "titulo":"Threads no Social Media",
     "descricao":"O módulo segue o molde dos outros três (src/lib/redes/plataformas, contrato em tipos.ts) e o aplicativo do Meta já tem o caso de uso do Threads. Falta escrever o módulo e o login próprio dele.",
     "caminhos":["src/lib/redes/plataformas","src/lib/redes/redes.ts","src/lib/redes/ligacao.ts"]},
    {"referencia":"carga-2026-11-18:tiktok","origem":"carga","coluna":"ideias","tipo":"atualizacao","prioridade":"media",
     "titulo":"TikTok no Social Media",
     "descricao":"O TikTok for Developers recusa por escrito ferramenta de uso interno: o caminho é o TikTok API for Business. Depende de um aplicativo que o Filipe cria.",
     "caminhos":["src/lib/redes/plataformas"]},
    {"referencia":"carga-2026-11-18:pinterest-linkedin","origem":"carga","coluna":"ideias","tipo":"atualizacao","prioridade":"baixa",
     "titulo":"Pinterest e LinkedIn no Social Media",
     "descricao":"Cada um depende de um aplicativo que o Filipe cria.",
     "caminhos":["src/lib/redes/plataformas"]},
    {"referencia":"carga-2026-11-18:redes-directs","origem":"carga","coluna":"ideias","tipo":"melhoria","prioridade":"baixa",
     "titulo":"Directs do Instagram e do Facebook no Social Media",
     "descricao":"Direct de cliente e webhook de comentário pedem App Review da Meta. O token já tem permissões de mensagem, mas o painel não tem código de direct, de propósito.",
     "caminhos":["src/lib/redes"]},
    {"referencia":"carga-2026-11-18:redes-midia-antiga","origem":"carga","coluna":"ideias","tipo":"melhoria","prioridade":"baixa",
     "titulo":"Apagar do armazenamento a mídia de post antigo",
     "descricao":"A mídia das redes fica no R2 (balde jk-redes) ou no Storage para sempre.",
     "caminhos":["src/lib/redes/armazenamento.ts"]},
    {"referencia":"carga-2026-11-18:trafego-bio-no-meta","origem":"carga","coluna":"a_fazer","tipo":"correcao","prioridade":"media",
     "titulo":"Tráfego compara o gasto do Meta com toda venda do canal, inclusive a do link da bio",
     "descricao":"O link da bio chega no mesmo canal \"Instagram e Facebook\" que o anúncio. As telas de origem já separam (ehAnuncio); a tela de Tráfego ainda não.",
     "caminhos":["/admin/trafego","src/lib/trafego/retorno.ts"]},
    {"referencia":"carga-2026-11-18:recuperacao-veio-de","origem":"carga","coluna":"ideias","tipo":"correcao","prioridade":"baixa",
     "titulo":"Fila de recuperação: o \"veio de\" pela origem anotada",
     "descricao":"A fila ainda mostra só a etiqueta da Tray. Vendas, Visão geral e Tráfego já usam a etiqueta e, sem ela, a chegada anotada (0111).",
     "caminhos":["/admin/recuperacao","src/lib/vendas"]},
    {"referencia":"carga-2026-11-18:origem-visitante-divergente","origem":"carga","coluna":"ideias","tipo":"correcao","prioridade":"baixa",
     "titulo":"Investigar pedidos em que a confirmação aponta outro visitante",
     "descricao":"Em 4 dos 34 pedidos de 13 a 16/11 ligados pela sessão, a página de confirmação apontava um visitante diferente. Ainda não investigado (docs/origem-do-pedido.md).",
     "caminhos":["src/lib/origem","public/o.js"]},
    {"referencia":"carga-2026-11-18:trafego-limite","origem":"carga","coluna":"ideias","tipo":"melhoria","prioridade":"baixa",
     "titulo":"Limite de anúncio para o nível Tráfego",
     "descricao":"O nível Tráfego ainda não vê o limite de anúncio porque a tela manda o custo das peças para o navegador. Precisa de uma leitura que entregue só o limite.",
     "caminhos":["/admin/anuncios","src/lib/margem"]},
    {"referencia":"carga-2026-11-18:tela-acessos","origem":"carga","coluna":"ideias","tipo":"melhoria","prioridade":"baixa",
     "titulo":"Tela para editar quem vê o quê (acessos_por_papel)",
     "descricao":"Hoje mudar o acesso de um nível é mudar uma linha no banco. Uma tela de diretoria evitaria SQL para isso.",
     "caminhos":["/admin/usuarios","src/lib/auth"]},
    {"referencia":"carga-2026-11-18:nivel-da-dona","origem":"carga","coluna":"ideias","tipo":"melhoria","prioridade":"baixa",
     "titulo":"Custos: um nível de acesso só da dona",
     "descricao":"Hoje quatro perfis de diretoria veem os custos da empresa.",
     "caminhos":["/admin/custos","src/lib/auth/acessos.ts"]},
    {"referencia":"carga-2026-11-18:sugestoes-prints-antigos","origem":"carga","coluna":"ideias","tipo":"melhoria","prioridade":"baixa",
     "titulo":"Apagar os prints das sugestões feitas ou recusadas depois de um tempo",
     "descricao":"Ficam para sempre no balde privado sugestoes. Só se o uso pedir.",
     "caminhos":["src/lib/sugestoes"]},
    {"referencia":"carga-2026-11-18:suporte-kommo","origem":"carga","coluna":"ideias","tipo":"melhoria","prioridade":"media",
     "titulo":"Suporte pós-venda, fase 2: trocar o dono do lead na Kommo",
     "descricao":"Passar o caso aqui não troca o dono do lead lá. Pede a chave da Kommo, decidir se o suporte é um usuário ou um funil, e cuidado com o Salesbot: mover lead pode mandar mensagem para cliente de verdade.",
     "caminhos":["src/lib/suporte"]},
    {"referencia":"carga-2026-11-18:ficha-funil-kommo","origem":"carga","coluna":"ideias","tipo":"melhoria","prioridade":"baixa",
     "titulo":"A etapa do funil da Kommo na ficha do cliente",
     "descricao":"Precisa da chave da Kommo.",
     "caminhos":["src/lib/clientes","/admin/clientes"]},
    {"referencia":"carga-2026-11-18:tutor-no-conector","origem":"carga","coluna":"ideias","tipo":"melhoria","prioridade":"baixa",
     "titulo":"Área de vendas no conector, para o tutor valer dentro do Claude",
     "descricao":"Vendas e fábrica hoje não usam o conector (quem-usa.ts).",
     "caminhos":["src/lib/conector","src/lib/tutor"]},
    {"referencia":"carga-2026-11-18:loja-produto-completo","origem":"carga","coluna":"ideias","tipo":"melhoria","prioridade":"baixa",
     "titulo":"A loja pelo painel: descrição, categoria, marca, medidas e produto novo",
     "descricao":"O que falta da fase 2 em docs/loja-pelo-painel.md. Toda escrita na loja passa por src/lib/loja/alterar.ts, e rota nova da API só entra com evidência na homologação.",
     "caminhos":["src/lib/loja","/admin/produtos"]},
    {"referencia":"carga-2026-11-18:historico-antes-de-maio","origem":"carga","coluna":"ideias","tipo":"melhoria","prioridade":"baixa",
     "titulo":"Trazer os pedidos de antes de 01/05/2026",
     "descricao":"A loja responde pelo número (npm run vendas:historico -- --desde=...). Ninguém pediu ainda.",
     "caminhos":["scripts/trazer-historico-da-tray.mts"]},
    {"referencia":"carga-2026-11-18:webhook-tray","origem":"carga","coluna":"ideias","tipo":"atualizacao","prioridade":"baixa",
     "titulo":"Cadastrar o webhook da Tray no painel da loja",
     "descricao":"Apontando para /guias/api/tray/webhook com o segredo. O status que muda já chega pela rotina em até dez minutos; o webhook encurta isso."},
    {"referencia":"carga-2026-11-18:ga4-eventos-chave","origem":"carga","coluna":"a_fazer","tipo":"atualizacao","prioridade":"baixa",
     "titulo":"Marcar os eventos-chave no GA4",
     "descricao":"clique_whatsapp, clique_telefone, clique_rota e clique_waze. O GA4 só deixa marcar depois que o evento aparece na lista."},
    {"referencia":"carga-2026-11-18:eslint","origem":"carga","coluna":"ideias","tipo":"correcao","prioridade":"baixa",
     "titulo":"Ligar o lint (o projeto não tem eslint.config.js)",
     "descricao":"Sem o arquivo, o lint não roda. Ao ligar, conferir quantos avisos aparecem antes de exigir no build.",
     "caminhos":["eslint.config.js","package.json"]},
    {"referencia":"carga-2026-11-18:build-next-font","origem":"carga","coluna":"ideias","tipo":"correcao","prioridade":"baixa",
     "titulo":"Prévia da Vercel que falha no começo por causa do next/font",
     "descricao":"A primeira montagem às vezes morre em 20 segundos com erro no carregador de fontes do Google (visto também no build local em 16/11). Rodar de novo passa. Saída possível: fontes locais.",
     "caminhos":["src/app/layout.tsx"]},
    {"referencia":"carga-2026-11-18:gravacao-previa","origem":"carga","coluna":"ideias","tipo":"melhoria","prioridade":"baixa",
     "titulo":"Ferramenta de pré-visualização da gravação",
     "descricao":"A única das quatro ferramentas não construída: não tem dado próprio. As perguntas para a JK estão como fatos em validar (0033).",
     "caminhos":["src/lib/ferramentas","src/components/ferramentas"]}
  ]$carga$::jsonb, v_quem);

  perform set_config('request.jwt.claims', '', true);

  if jsonb_array_length(v_r -> 'recusados') > 0 then
    raise exception 'A carga do Roadmap teve cartão recusado: %', v_r -> 'recusados';
  end if;
  raise notice 'Roadmap: % cartões criados, % já existiam.', jsonb_array_length(v_r -> 'criados'), jsonb_array_length(v_r -> 'ja_existiam');
end
$$;
