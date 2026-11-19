# Avisos no celular e no navegador (cartão 59)

O painel avisa por **Web Push**: a mensagem do time, o caso de suporte e o
cliente esperando na Kommo chegam com o painel fechado, no computador e no
celular, com o som do próprio aparelho. Com o painel à vista, quem avisa é a
tela, com um som curto.

## Como funciona

1. **A pessoa liga em cada aparelho**, em Time, *Avisos no celular*
   (`/admin/avisos`), no bloco do chat ou pelo atalho da conta. Ligar pede a
   permissão do navegador, registra o service worker (`public/sw.js`),
   inscreve o aparelho no serviço de push do navegador (Google, Apple ou
   Mozilla) e guarda a inscrição em `push_aparelhos` (0190).
2. **O service worker só recebe aviso.** Não tem `fetch`, não guarda página
   nem dado: o painel continua vindo inteiro do servidor (a regra de "nada de
   número velho na tela" continua valendo). Escopo `/guias/admin`, o mesmo do
   app instalado.
3. **Quem dispara é o banco.** Mensagem nova no chat e caso de suporte que
   entra ou fecha chamam `disparar_push()` por gatilho, que chama a rota
   `/api/cron/push` pelo `pg_net`, com o segredo das rotinas. O relógio
   `avisar-por-push` chama de minuto em minuto quando há aparelho ligado (é
   o que pega a Kommo, que é lida de dez em dez minutos, e o que o gatilho
   perdeu) e de 15 em 15 sempre, para deixar pulso na Saúde.
4. **O que vira aviso é a mesma régua de antes.** `push_pendentes()` chama
   `chat_para_avisar` (0081/0082) e `suporte_para_avisar` (0102) em nome de
   cada pessoa, e a régua da Kommo de `kommo_meus_negocios` (0179) com um
   corte a mais: só o negócio que PASSOU a esperar vendedor, ou ficou com
   cliente sem resposta, depois da última rodada. Mudou a régua de um lado,
   muda a do outro.
5. **Um aviso por evento por pessoa.** Cada evento tem uma chave
   (`chat:<id>`, `suporte:<caso>:<estado>`, `kommo:<id>:<motivo>:<desde>`),
   e `push_reservar` só devolve a que entrou agora em `push_enviados`. Duas
   rodadas ao mesmo tempo não avisam em dobro.
6. **Quem está com o painel à vista não recebe push.** A moldura chama
   `push_estou_aqui` de minuto em minuto enquanto a tela está na frente (90
   segundos de folga) e com falso ao sair. O evento é marcado como avisado,
   e a tela toca o som.
7. **Teto de 4 avisos por pessoa por minuto.** Passou disso, o último vira
   "Mais N avisos no painel" (`aplicarTeto`).
8. **Inscrição morta sai sozinha.** O serviço de push respondeu 404 ou 410
   (desinstalou o app, limpou o navegador, negou o aviso): a linha é apagada.

A conta pura (chaves, texto da Kommo, teto, o que cada aparelho escolheu, a
carga, a leitura da inscrição e o que a tela oferece) mora em
`src/lib/avisos/push.ts`, com teste em `npm run verificar:avisos` (no
`verificar:tudo` e no `build`). O envio é `src/lib/avisos/enviar.ts`; o lado
do navegador, `src/lib/avisos/cliente.ts`.

## O que o aviso mostra

Quem escreveu, a sala e o começo do texto; "Caso de suporte: assunto"; ou
"Cliente esperando na Kommo" com funil, etapa e o tempo de espera. **Nunca
telefone, valor ou nome de cliente**: a tela bloqueada do celular é lida por
quem estiver perto. O toque leva direto ao lugar: a mensagem (a janela do
chat abre nela), o suporte ou o negócio na Kommo.

## Onde ficam as chaves VAPID

- **Pública e privada** em `integration_tokens`, provedor `push_vapid`:
  `access_token` é a privada, `meta.publica` a pública, `meta.assunto` o
  contato que os serviços de push pedem (o endereço do portal). A tabela não
  tem policy: só a chave de serviço lê. Geradas em 19/11/2026.
- Se `VAPID_PUBLIC_KEY` e `VAPID_PRIVATE_KEY` existirem na Vercel, valem elas
  (e `VAPID_ASSUNTO`, opcional). Nunca com `NEXT_PUBLIC_`: a pública vai ao
  navegador pela rota `/api/painel/push`, não por variável.

**Trocar as chaves** (só se a privada vazar): gere um par novo
(`npx web-push generate-vapid-keys --json`), grave no mesmo provedor
(`access_token` e `meta.publica`) e espere uns 10 minutos (o servidor guarda
a chave em memória por esse tempo). **Toda inscrição antiga para de
funcionar**: o serviço responde erro, a linha sai, e cada pessoa liga de novo
em cada aparelho, pelo mesmo botão (que refaz a inscrição com a chave nova).

## Como ligar (para a equipe)

- **Computador** (Chrome, Edge, Safari ou Firefox): Time, *Avisos no
  celular*, "Ligar os avisos neste aparelho", e Permitir no navegador.
- **Android** (Chrome): o mesmo. Melhor ainda com o painel instalado
  ("Instalar app" no menu do Chrome), que vira ícone e abre sem a barra.
- **iPhone** (iOS 16.4 ou mais novo): o push só existe no painel instalado.
  No Safari, *Compartilhar*, *Adicionar à Tela de Início*, abrir pelo ícone
  *Painel JK*, entrar e ligar lá. A tela ensina os três passos quando a
  pessoa abre fora do app.
- "Mandar um aviso de teste" confere na hora. A lista "Outros aparelhos"
  desliga o celular esquecido na loja.

## Como testar

- **Rotina:** `select public.disparar_push(true);` chama a rota pelo
  relógio; a resposta aparece no pulso `push` (Sistema, Saúde).
- **Local:** o Chrome aceita push em `localhost`. O navegador do app e o
  Chrome da conferência vinham com a notificação de localhost negada; o
  teste de 19/11 foi feito no Chromium do Playwright com a permissão dada
  pelo contexto. Com uma inscrição real em `push_aparelhos`, um POST em
  `http://localhost:3000/guias/api/cron/push` com o `x-cron-secret` manda
  de verdade, e `registration.getNotifications()` mostra o que chegou.
- **Conferido em 19/11/2026:** inscrição real no FCM, mensagem no chat virou
  notificação "Master JK em Diretoria" com a marca `jk-chat-<id>` e o
  endereço da mensagem; a segunda rodada não repetiu; com o painel à vista,
  nada saiu; inscrição desfeita respondeu 410 e a linha saiu. As funções do
  banco foram conferidas com JWT falso de vendedor, fábrica, gerente,
  anônimo e chave de serviço numa transação desfeita.
- **Só se confere no aparelho de verdade:** o aviso no Android com o Chrome
  fechado, o iPhone com o painel instalado (inscrição, aviso com a tela
  bloqueada, toque abrindo o app no lugar certo), o toque no aviso com o
  painel já aberto (o service worker manda o endereço à moldura) e o som do
  aviso com o painel à vista.

## Limites conhecidos

- O aviso do Android e do computador depende do serviço do navegador estar
  de pé; o do iPhone, do app instalado e da permissão nos Ajustes.
- Aviso que não chega em 15 minutos (celular sem rede) é descartado pelo
  serviço: o painel mostra.
- Quem está com o painel à vista no computador não recebe no celular.
