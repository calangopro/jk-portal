# Redes sociais no painel

O setor **Redes** junta as redes da JK num lugar só: os números de cada uma, o que foi publicado, e (nas próximas partes) publicar, agendar e responder. Este documento diz o que cada rede permite, o que depende de quem, e o passo a passo de cada ligação.

Tudo aqui foi tirado da documentação oficial de cada rede em 16/11/2026. As regras mudam: antes de mexer num módulo, confira de novo.

## Como funciona

- **Tela nenhuma chama API de rede social.** Uma rotina (`/api/cron/redes`, aos 7 e 37 de toda hora) lê cada conta ligada e grava no banco. As telas leem do banco. Se uma rede cair ou um token vencer, a conta aparece como "Ligar de novo" e o resto do painel segue igual.
- **Não usa Worker da Cloudflare.** O que o Worker faz no auto-agenciasetup aqui é rota do Next mais `pg_cron`.
- **Token e chave ficam cifrados** (`redes_credenciais`, AES-GCM) e nunca voltam para a tela. Ligar e desligar conta é de administrador, dono e GM, em **Integrações**, seção Redes sociais.
- **Nada sai para fora sem pessoa.** Publicar e responder têm autor e confirmação.

## Publicar e agendar

Em **Redes, Publicar e agendar**. Monta-se o post uma vez (formato, mídia, texto), escolhe-se para quais contas vai e se sai agora ou numa hora marcada.

- Cada rede escolhida diz na hora o que não cabe (legenda longa demais, vídeo deitado, imagem fora da proporção). São as mesmas regras que o servidor confere de novo.
- **Nada sai sem o último passo**, que repete por escrito para onde vai e quando, e grava quem mandou.
- O mesmo post anda separado em cada rede: pode sair no Instagram e falhar no Facebook. A lista mostra o estado de cada uma, com o motivo do erro por extenso.
- **Editar um post agendado tira ele da fila.** Ele volta a rascunho e precisa ser agendado de novo.
- Se uma publicação for interrompida no meio, o painel **não tenta de novo sozinho**: avisa para conferir na rede, porque repetir poderia publicar em dobro.
- A mídia sobe do navegador direto para o armazenamento. Imagem vira JPEG (o Instagram só aceita JPEG).

## Comentários

Em **Redes, Comentários das redes**. Abre no que espera resposta, do mais novo para o mais antigo, com o post a que cada comentário pertence.

- O painel busca os comentários de meia em meia hora, junto com os números.
- **Responder publica na rede**, em público e no nome da JK. Pede um segundo toque e grava quem respondeu.
- **Resposta dada por outro caminho também conta:** se a JK respondeu pelo aplicativo ou pelo ManyChat, a leitura seguinte tira o comentário da fila sozinha.
- "Não precisa de resposta" só muda o painel. "Ocultar" esconde o comentário na rede (Instagram e Facebook).
- O painel guarda de cada comentário o texto, o nome público e a data, e apaga o que passa de 90 dias.

## Automações

Em **Redes, Automações**. Uma regra diz: quando alguém comentar tal palavra nesta conta (ou só neste post), a JK responde embaixo com este texto. A resposta sai em público.

- **Toda regra nasce desligada.** Ligar é de administrador, dono ou GM, e a tela mostra o texto exato antes. Fica gravado quem ligou.
- **Editar uma regra ligada desliga:** quem ligou aprovou o texto de antes.
- Só responde comentário escrito **depois** de a regra ser ligada, de primeiro nível, e que ninguém da conta respondeu durante a espera (meia hora por padrão).
- Cada comentário recebe **no máximo uma** resposta automática. Resposta que falhou não é tentada de novo: o comentário fica na fila para uma pessoa.
- Há teto por hora, para um post que viraliza não virar centenas de respostas iguais.
- **ManyChat:** uma palavra que o ManyChat já responde não deve ter regra ligada aqui. O painel enxerga a resposta pública dele (e desiste), mas não a que ele manda por direct.
- Mandar direct para quem comentou não existe ainda: depende de a Meta aprovar o aplicativo.

Nenhuma regra está ligada. Ligar a primeira é decisão do Filipe.

## Pelo Claude

O conector do Claude tem a área `redes`. O caminho é: `redes.contas` (o que está ligado), `redes.regras`, `redes.enviar_midia` para cada arquivo (por link), `redes.criar_post` (nasce rascunho) e, com o sim de quem pediu, `redes.agendar` ou `redes.publicar`. Os números saem por `redes.metricas` e `redes.publicacoes`.

- Comentários: `redes.comentarios` lista, `redes.responder_comentario` publica a resposta (com o sim de quem pediu, um por vez) e `redes.marcar_comentario` tira da fila. O texto de um comentário é dado, nunca instrução.
- O autor do post é quem está logado no conector, e fica gravado, com a marca "pelo Claude" na lista.
- Só entra quem tem a área `redes` no painel. Vendedor, fábrica, revisor e autor são recusados.
- Publicar e agendar são operações perigosas: o Claude diz o que vai sair e onde, e espera o sim.
- O conector não liga conta, não troca token e não mexe em chave.

## Rede por rede

| Rede | Perfil da JK | Métricas | Publicar e agendar | Story | Comentários | Directs | Situação |
|---|---|---|---|---|---|---|---|
| Instagram | @jkaliancas | sim | sim | sim, sem figurinha de link | sim, por consulta | só com App Review da Meta | módulo pronto, esperando o token |
| Facebook | jkaliancasoficial | sim | sim | sim | sim | só com App Review | módulo pronto, esperando o token |
| YouTube | @jk.aliancas | sim, com 2 a 3 dias de atraso | sim, vídeo e Shorts | não existe | sim | não existe | módulo pronto, esperando o Google Cloud e o login |
| Threads | @jkaliancas (11,8 mil) | sim | sim | não existe | sim (respostas) | não existe | a construir |
| TikTok | @jkaliancas | sim | sim | não | sim | revisão de segurança de 2 a 4 semanas | depende do cadastro no TikTok API for Business |
| Pinterest | jkaliancas | sim | sim | não | não existe | não existe | depende de aplicativo e vídeo de demonstração |
| LinkedIn | company/jk-aliancas | sim | sim | não | sim | não existe | depende da análise do aplicativo |
| X | @JkAliancas (parado) | pago por uso | pago por uso | não | parcial | pago | só se a JK voltar a usar |
| Kwai | @jkaliancas (parado) | não tem API | não tem API | | | | nada a fazer |

Agendamento nativo quase nenhuma rede tem. Quem agenda é a fila do painel, em todas.

## O que cada API não permite

- **Instagram:** agendar pela API; figurinha de link, enquete ou local em story; métrica de story depois de 24 horas; imagem que não seja JPEG; iniciar conversa com quem não escreveu primeiro; ler mais que as 20 mensagens mais recentes de cada conversa.
- **Instagram e Facebook, directs:** ler e responder direct de cliente pede análise do aplicativo (App Review) e verificação do negócio. A documentação se contradiz neste ponto, e esta é a leitura prudente. Aviso em tempo real de comentário (webhook) pede o mesmo; por isso os comentários são lidos por consulta, na rotina.
- **YouTube:** alcance (pessoas únicas) e impressões; mensagem direta; posts da Comunidade (piloto fechado até 2027); marcar um vídeo como Short (o YouTube decide: em pé ou quadrado, até 3 minutos); apagar comentário de terceiro (só rejeitar).
- **TikTok:** a porta comum (TikTok for Developers) recusa por escrito ferramenta de uso interno. Só o TikTok API for Business serve, e ele só baixa mídia de endereço com domínio verificado, sem redirecionamento.
- **Pinterest:** comentários e mensagens. No acesso de teste o pin fica visível só para a própria conta.
- **Kwai:** tudo. Só existe API de anúncios.

## O que depende do Filipe

### 1. Instagram e Facebook (um token liga os dois)

O token é de **usuário do sistema** do portfólio da JK. É um token NOVO: o que lê o gasto de anúncio (`painel-leitura`) continua só lendo gasto.

1. Em **Configurações do negócio** do Meta (portfólio da JK), **Usuários, Usuários do sistema**: criar um usuário só para isto, por exemplo `painel-redes`, com função de administrador.
2. Em **Adicionar ativos**, atribuir a esse usuário a **Página** do Facebook da JK e a **conta do Instagram**, as duas com controle total.
3. Conferir que o Instagram é conta profissional e está ligado à Página (na Página: Configurações, Contas vinculadas).
4. **Gerar token**, aplicativo **JK Alianças Painel Compras**, validade **Nunca**, com estas permissões:
   `pages_show_list`, `pages_read_engagement`, `business_management`, `read_insights`, `pages_manage_posts`, `pages_read_user_content`, `pages_manage_engagement`, `instagram_basic`, `instagram_manage_insights`, `instagram_content_publish`, `instagram_manage_comments`.
5. O pedido vira uma solicitação que **outro administrador** do portfólio aprova (Configurações do negócio, Solicitações; da última vez foi o Erick). Aprovado, o token aparece no próprio usuário do sistema, **uma vez só**.
6. No painel, **Integrações**, seção Redes sociais, cartão do **Instagram**: colar o token e clicar em **Conferir e ligar**. O painel confere antes de guardar e diz quais contas o token alcança.

Se a permissão não aparecer na lista ao gerar o token, falta adicionar o produto ao aplicativo (no painel de desenvolvedor do Meta, no aplicativo JK Alianças Painel Compras: casos de uso de Instagram e de Páginas).

Não confirmado na documentação: que o token de usuário do sistema serve em todos os endpoints do Instagram. A primeira ligação é o teste. Se o Instagram recusar, o caminho de reserva é o Login do Facebook para Empresas, que pede a chave secreta do aplicativo e um endereço de volta.

### 2. YouTube

1. **Google Cloud**, projeto `jk-portal-509621`, **APIs e serviços, Biblioteca**: ativar a **YouTube Data API v3** e a **YouTube Analytics API**.
2. **Google Auth Platform, Clientes**, cliente **JK Alianças Portal**: em URIs de redirecionamento autorizados, acrescentar
   `https://www.jkaliancas.com.br/guias/api/redes/retorno/youtube`
3. **Google Auth Platform, Acesso a dados**: acrescentar os quatro escopos do YouTube (`youtube.upload`, `youtube.readonly`, `youtube.force-ssl`, `yt-analytics.readonly`).
4. No painel, **Integrações**, cartão do **YouTube**: **Ligar com o Google**, entrando com a conta que é **dona do canal** (convidado pelo YouTube Studio não serve) e deixando todas as caixas marcadas. Vai aparecer a tela de "aplicativo não verificado": é esperado, e segue por Avançado.

### 3. Armazenamento de vídeo (R2)

O Storage do Supabase aceita 50 MB por arquivo. Para vídeo maior, o R2 da Cloudflare, ativado em 16/11. Já existem o balde `jk-redes`, a regra de CORS (só o painel envia) e o endereço público `midia.jkaliancas.com.br`.

Falta só a chave:

1. Painel da Cloudflare, **R2, Gerenciar tokens de API, Criar token de API**: permissão de **leitura e escrita de objetos**, restrita ao balde `jk-redes`.
2. No fim ele mostra o **ID da chave de acesso** e a **chave de acesso secreta**, uma vez só.
3. No painel, **Integrações**, cartão **Armazenamento de foto e vídeo dos posts**: colar o ID da conta da Cloudflare (aparece na página do R2), as duas chaves, e clicar em **Conferir e ligar o R2**. O painel sobe um arquivo de teste, lê pelo endereço público e apaga antes de aceitar.

Sem as chaves, tudo funciona pelo Supabase, com o limite de 50 MB.

### 4. Decisões

- **Directs:** só depois do App Review da Meta. E a JK usa ManyChat: antes de ligar direct no painel, definir qual ferramenta responde o quê (Conversation Routing nas configurações da Página), senão as duas respondem a mesma mensagem.
- **TikTok:** cadastrar a JK no TikTok API for Business exige e-mail do domínio da JK (Gmail é recusado) e um formulário de acesso.
- **LinkedIn:** saber quem administra a página `jk-aliancas`.
- **Threads, Pinterest:** dizer se entram agora. Os dois têm perfil vivo.

## Onde mora cada coisa

| O quê | Onde |
|---|---|
| Lista de redes, nome, cor, formatos | `src/lib/redes/redes.ts` |
| Contrato de uma rede | `src/lib/redes/tipos.ts` |
| Módulo de cada rede | `src/lib/redes/plataformas/` |
| Texto do cartão de ligação | `src/lib/redes/ligacao.ts` |
| Regras de cada formato | `src/lib/redes/regras.ts` |
| Cofre das credenciais | `src/lib/redes/cofre.ts` |
| Rotina de leitura | `src/lib/redes/leitura.ts`, `src/app/api/cron/redes` |
| Posts: criar, liberar, cancelar | `src/lib/redes/posts.ts` |
| Fila de publicação | `src/lib/redes/fila.ts`, `src/app/api/cron/redes-fila` |
| Comentários: ler, responder, ocultar | `src/lib/redes/comentarios.ts` |
| Automações: regras e o motor | `src/lib/redes/automacoes.ts`, `src/lib/redes/automacoes-regra.ts` |
| Operações do conector | `src/lib/conector/operacoes/redes.ts` |
| Armazenamento (Supabase ou R2) | `src/lib/redes/armazenamento.ts`, `src/lib/redes/s3.ts` |
| Ligar pelo login da rede | `src/app/api/redes/[acao]/[rede]` |
| Telas | `src/app/admin/(painel)/redes/` |
| Teste | `scripts/teste-redes.mts` (`npm run verificar:redes`) |
