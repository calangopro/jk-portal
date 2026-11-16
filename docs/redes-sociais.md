# Redes sociais no painel

O setor **Redes** junta as redes da JK num lugar só: os números de cada uma, o que foi publicado, e (nas próximas partes) publicar, agendar e responder. Este documento diz o que cada rede permite, o que depende de quem, e o passo a passo de cada ligação.

Tudo aqui foi tirado da documentação oficial de cada rede em 16/11/2026. As regras mudam: antes de mexer num módulo, confira de novo.

## Como funciona

- **Tela nenhuma chama API de rede social.** Uma rotina (`/api/cron/redes`, aos 7 e 37 de toda hora) lê cada conta ligada e grava no banco. As telas leem do banco. Se uma rede cair ou um token vencer, a conta aparece como "Ligar de novo" e o resto do painel segue igual.
- **Não usa Worker da Cloudflare.** O que o Worker faz no auto-agenciasetup aqui é rota do Next mais `pg_cron`.
- **Token e chave ficam cifrados** (`redes_credenciais`, AES-GCM) e nunca voltam para a tela. Ligar e desligar conta é de administrador, dono e GM, em **Integrações**, seção Redes sociais.
- **Nada sai para fora sem pessoa.** Publicar e responder têm autor e confirmação.

## O Social Media

O setor se chama **Social Media** na tela. As telas, na ordem do menu:

- **Hoje nas redes:** o que sai nas próximas 48 horas, os comentários esperando resposta, o que está em alta nos últimos 7 dias e os números de cada rede. Atalhos para criar post e story.
- **Posts e stories:** a fila, os rascunhos, o que saiu e o que deu erro.
- **Em alta:** cada publicação comparada com o normal da própria conta (a mediana de 90 dias, da mesma conta, do mesmo tipo e pela mesma régua). Ordena por visualizações, interações, engajamento, comentários, compartilhamentos ou salvos. Cada post abre uma página com os números e os comentários dele.
- **Comentários:** um por um ou agrupados por post.
- **Calendário:** o mês inteiro, com o que saiu (inclusive o que foi postado pelo aplicativo, fora do painel), o que está na fila e as ideias com dia. Tocar num dia mostra o que tem nele e cria post ou story já na data, no melhor horário pelo histórico da conta.
- **Ideias:** guardar uma ideia, tirar das sugestões (o que rendeu acima do normal, as perguntas dos comentários, as campanhas da bio e as datas do comércio dos próximos 60 dias) e "Virar post". O rascunho fica ligado à ideia, e ela anda sozinha para Agendadas e Publicadas.
- **Automações** e **Contas ligadas.**

### Sequência de stories

No compositor, escolha **Story** e ponha várias fotos e vídeos de uma vez (até 10). Cada um vira um story, na ordem da lista (as setas mudam a ordem). Duas opções: **um logo depois do outro**, ou **espaçados** a cada 15 minutos, 30 minutos, 1, 2 ou 3 horas, a partir da hora marcada.

- Um story nunca sai antes do anterior, na mesma conta: se um story de vídeo demorar para a rede preparar, os seguintes esperam. Quem garante é o banco, não a hora.
- Cada story é um item da fila, com o próprio link. Se um der erro, os seguintes saem do mesmo jeito, e a tela mostra o buraco.
- "Tirar a sequência inteira" cancela o que ainda não saiu. O que já saiu continua no ar.

### Horários sugeridos

As sugestões de hora do calendário e do compositor saem do histórico da própria conta: cada post comparado com o normal dela, em faixas de três horas. A faixa com a mediana mais alta é a sugerida, e a tela diz em quantos posts ela se apoia. É o que rendeu mais até aqui, não uma regra: muda conforme a conta posta.

Quem cuida das redes entra como **Editor** por enquanto (vê também Conteúdo, Site e Produtos). Um nível só de redes depende de mexer na trava do conector do Claude, que hoje deixa entrar só a equipe de conteúdo.

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
| Instagram | @jkaliancas | sim | sim | sim, sem figurinha de link | sim, por consulta | só com App Review da Meta | **ligado em 16/11/2026** |
| Facebook | jkaliancasoficial | sim | sim | sim | sim, sem o nome de quem comentou | só com App Review | **ligado em 16/11/2026**, pelo mesmo token do Instagram |
| YouTube | @jkaliancas1 (ligado) e @jk.aliancas | sim, com 2 a 3 dias de atraso | sim, vídeo e Shorts | não existe | sim | não existe | **ligado em 16/11/2026** (canal @jkaliancas1, da conta jkaliancasmkt) |
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

**Feito em 16/11/2026, pelo Chrome do Filipe:**

- Aplicativo **JK Alianças Painel Redes** criado no portfólio da JK, com os casos de uso de Página, Instagram e Threads. Em cada caso de uso, as permissões abaixo foram adicionadas (ficam "Pronto para teste"). O aplicativo `JK Alianças Painel Compras` não serve: o Filipe não é desenvolvedor dele.
- Usuário do sistema **`painel-redes`**, função Employee, com três ativos: a **Página** JK Alianças e a conta do **Instagram** `jkaliancas` (as duas só com Conteúdo, Atividade da comunidade e Insights, sem mensagens nem anúncios) e o **aplicativo** novo (Desenvolver app).

**Ligado em 16/11/2026.** O Filipe gerou o token (o Meta pediu a aprovação de outro administrador do portfólio) e colou no cartão do Instagram em Integrações. Entraram as duas contas: `@jkaliancas` e `@jkaliancasoficial`.

O que a ligação confirmou e mostrou:

- **O token de usuário do sistema serve nos endpoints do Instagram.** A documentação não dizia.
- O token foi gerado com mais permissões do que o painel usa (mensagens, catálogo, conteúdo de marca). O painel não tem código de direct.
- **Comentário do Facebook chega sem o nome de quem escreveu.** O nome depende do recurso "Business Asset User Profile Access" do aplicativo, que não foi adicionado. Para ter o nome: adicionar o recurso nos casos de uso do aplicativo e gerar o token de novo.
- A validade é "Nunca". Se um dia precisar trocar: mesmo caminho (Usuários do sistema, `painel-redes`, Gerar token) com as permissões
  `pages_show_list`, `pages_read_engagement`, `business_management`, `read_insights`, `pages_manage_posts`, `pages_read_user_content`, `pages_manage_engagement`, `instagram_basic`, `instagram_manage_insights`, `instagram_content_publish`, `instagram_manage_comments`.

A área de usuários do sistema pede a chave de acesso (passkey) de quem está logado. A lista de permissões do assistente tem busca: digitar o nome e marcar é mais seguro do que rolar.

### 2. YouTube

**Ligado em 16/11/2026**, canal `@jkaliancas1` (dono: a conta jkaliancasmkt). O que foi feito, para o dia em que precisar ligar outro canal:

1. **Google Cloud**, projeto `jk-portal-509621`, **APIs e serviços, Biblioteca**: ativadas a **YouTube Data API v3** e a **YouTube Analytics API**.
2. **Google Auth Platform, Clientes**, cliente **Portal JK - avaliacoes do Google** (o mesmo do Perfil da Empresa): em URIs de redirecionamento autorizados entrou
   `https://www.jkaliancas.com.br/guias/api/redes/retorno/youtube`
3. Os escopos do YouTube **não** foram declarados em "Acesso a dados", e não precisam: a tela está vazia e o Perfil da Empresa já funcionava assim. Declarar escopo sensível ali só serve para pedir a verificação do Google.
4. No painel, **Integrações**, cartão do **YouTube**: **Ligar com o Google**, com a conta que é **dona do canal** (convidado pelo YouTube Studio não serve) e todas as caixas marcadas. Aparece a tela de "o Google não verificou este app": é esperado, e segue por "Acessar jkaliancas.com.br".

**A JK tem dois canais.** `@jkaliancas1` (o ligado, 102 vídeos e 51 inscritos em 16/11) e `@jk.aliancas` (17 vídeos e 15 inscritos), que é o endereço que o site anuncia no `sameAs`. O segundo pertence a outra conta do Google. Qual é o oficial é decisão da JK; o painel aceita os dois ligados ao mesmo tempo.

### 3. Armazenamento de vídeo (R2)

**Ligado em 16/11/2026.** O balde `jk-redes`, a regra de CORS (só o painel envia) e o endereço público `midia.jkaliancas.com.br` existiam desde a tarde; à noite a chave S3 foi criada pela API da Cloudflare (permissão de ler e escrever objetos, restrita ao balde `jk-redes`) e guardada pelo painel, que antes de aceitar sobe um arquivo de teste, lê pelo endereço público e apaga. O compositor passou a aceitar até 1 GB por arquivo. Conferido: uma foto subiu pelo compositor em produção, ficou pública no endereço do R2, aceitou leitura em pedaços e saiu do balde quando o rascunho foi apagado.

Para trocar a chave: no cartão **Armazenamento de foto e vídeo dos posts**, em Integrações, colar o ID da conta, as duas chaves e clicar em **Conferir e ligar o R2**.

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
