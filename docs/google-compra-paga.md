# Google Ads: compra paga e retirada dos cancelados

O painel passa a dizer ao Google Ads quais pedidos viraram dinheiro. São duas
peças: **retirar** do Google a compra que a etiqueta contou e a Tray cancelou,
e mandar uma **compra paga** quando o pedido de quem veio por anúncio do Google
é pago. Está pronto e **desligado**, em modo de validação. Liga em 01/12/2026,
quando o Filipe assume o tráfego (decisão de 17/11). Nada muda nas campanhas
antes disso.

Código: `src/lib/google-ads/conversoes.ts` (a conta, pura, com teste),
`src/lib/google-ads/envio.ts` (fala com o Google e com o banco),
`src/app/api/cron/google-conversoes/route.ts` (a rotina) e a migration
`0135_conversoes_do_google.sql`.

## Por que

A compra no Google Ads é contada por uma etiqueta do GTM, na ação
"Conversão automática tray - Não Remover (1776189228867)", código `7575406236`,
com o número do pedido como `transaction_id` (`infra/gtm/README.md`, seção de
16/11). Ela dispara quando o pedido é **criado**. De 13/10 a 14/11, 138 de 366
pedidos criados não foram pagos, 64% do valor. A campanha aprende a achar quem
faz pedido, não quem paga.

## O que cada peça faz

| | Retirada | Compra paga |
|---|---|---|
| Quando | O pedido foi cancelado na Tray e nunca teve pagamento | O pedido virou pago e a chegada que vale para ele é um clique do Google (gclid, gbraid ou wbraid) |
| Onde no Google | Na ação da etiqueta (`7575406236`), que já existe | Numa ação nova, "Compra paga", que **ainda não existe** |
| Pela API | Google Ads, `customers/1355887754:uploadConversionAdjustments`, tipo `RETRACTION`, pelo número do pedido | Data Manager, `events:ingest`, com o número do pedido em `transactionId`, o valor pago e BRL |
| Prazo do Google | A compra precisa ter entre 24 horas e 54 dias | O clique precisa ter mais de 6 horas e menos de 90 dias (e caber na janela da ação) |
| O painel usa | 25 horas e 53 dias (uma hora e um dia de folga), mais 6 horas depois do cancelamento | 7 horas e 90 dias |

**Por que duas APIs.** Desde 15/06/2026 o Google só aceita conversão de clique
pela API do Google Ads de projeto do Google Cloud que já mandava entre
dezembro de 2025 e junho de 2026; os outros recebem
`CUSTOMER_NOT_ALLOWLISTED_FOR_THIS_FEATURE` e são mandados para a Data Manager
API. O projeto do painel (`jk-portal-509621`) é de setembro. E a Data Manager
**não faz retirada**, então a retirada continua na API do Google Ads.

**Pedido pago nunca é retirado.** Nem o que foi pago e depois cancelado
(estorno): aquilo foi venda. A regra mora em três lugares: na conta que escolhe
os pedidos, na função do banco que separa o lote de cada rodada (que confere o
pedido na hora e cancela a linha se ele não estiver cancelado ou tiver qualquer
sinal de pagamento) e no teste, que tenta 96 combinações.

**Qual clique vale.** O mesmo de Tráfego e Vendas: `origem_resolvida` (clique
em anúncio nos sete dias antes do pedido vem na frente; sem ele, a última
chegada que não seja direta, em trinta dias). Se a chegada que vale for um
clique do Meta, a compra paga **não** vai ao Google, mesmo que a pessoa tenha
clicado num anúncio do Google antes. É a escolha que evita a mesma venda contar
para as duas plataformas na conta do painel; o Google contaria pela própria
regra (30 dias). Mudar isso é mudar `google_conversoes_candidatos`.

## A fila

`google_conversoes` tem uma linha por pedido e por tipo. A chave única
(pedido, tipo) é o que impede mandar duas vezes. Cada linha guarda o que foi
mandado (`corpo`, sem e-mail nem telefone), quando, o que o Google respondeu, o
código do erro e a frase em português.

| Estado | Quer dizer |
|---|---|
| `pendente` | A mandar a partir de `proxima_em` |
| `enviando` | Separada por uma rodada. Volta a pendente se ficar presa 15 minutos (mandar de novo não faz mal: a retirada repetida volta "já retirada", e a compra repetida é desfeita pelo número do pedido) |
| `validado` | Mandada em validação. O Google leu e não gravou. Quando a validação desliga, sai de novo, valendo |
| `enviado` | Compra paga aceita, esperando a Data Manager confirmar (ela processa em até 24 horas; o painel pergunta depois de 30 minutos) |
| `confirmado` | Retirada aceita, ou compra paga confirmada |
| `nao_contado` | Retirada de pedido que o Google não tinha contado (`CONVERSION_NOT_FOUND`). **É o caso mais comum**: a etiqueta só conta o pedido que o Google atribuiu a anúncio |
| `fora_do_prazo` | Passou do prazo do Google antes de sair |
| `recusado` | O Google recusou, ou as oito tentativas acabaram |
| `cancelado` | O pedido mudou antes de sair (a retirada de um pedido que virou pago, por exemplo) |

Falha passageira (429, 5xx, rede) tenta de novo em 15 minutos, 1 hora, 3, 6, 12
e 24, e desiste na oitava. Falta de acesso ou de configuração não gasta
tentativa: a linha fica pendente e a rotina acusa o erro na tela de saúde.

Quem tem a área de tráfego lê a fila; ninguém grava pela tela. A tela de
acompanhamento (frente 6 de `docs/medicao-pelo-painel.md`) é da outra frente e
lê daqui.

## O interruptor

Mora em `site_settings`, chave `google:conversoes`. Só administrador, dono e GM
mudam (um gatilho barra o resto da equipe, que tem escrita em `site_settings`).

| Campo | Padrão | Para quê |
|---|---|---|
| `ligado` | `false` | Desligado, a rotina não faz nada, nem enfileira |
| `validar` | `true` | Manda com `validate_only`: o Google confere e não grava |
| `retirada` | `true` | Liga e desliga só a retirada |
| `compra_paga` | `true` | Liga e desliga só a compra paga |
| `acao_da_etiqueta` | `"7575406236"` | A ação que recebe a retirada |
| `acao_compra_paga` | `null` | O número da ação "Compra paga". Sem ele, as compras ficam na fila esperando |
| `retirar_desde` | `"2026-09-26"` | Dia em que a etiqueta passou a usar o rótulo certo |
| `compra_paga_desde` | `"2026-11-13"` | Dia em que o coletor começou a anotar o clique |
| `dados_do_cliente` | `false` | Manda e-mail e telefone em SHA-256 junto do clique |
| `pedidos_sem_clique` | `false` | Manda também o pedido pago sem clique, só com e-mail e telefone. Só vale com `dados_do_cliente` |

## O que sairia hoje

Prévia de 17/11/2026, conferida direto em `tray_pedidos` (`npm run google:previa`):

| | Se ligasse hoje | Se ligar em 01/12 às 10h |
|---|---|---|
| Retiradas | 188 pedidos (R$ 204.917,69), mais 4 que entram ao completar 25 horas | 138 pedidos (R$ 174.170,68) |
| Cancelados que ficam fora do prazo | 0 | **54 (R$ 36.590,79)**, os de 26/09 a 09/10 |
| Estornos que não se retiram | 6 (R$ 5.352,85) | 6 |
| Compras pagas com clique do Google | 2 (R$ 509,80) | 2, mais o que entrar até lá |
| Pagos desde 13/11 sem clique do Google | 22 (R$ 11.650,23) | |

**Uma decisão para o Filipe:** cada dia de espera tira do alcance os cancelados
de 54 dias antes. Ligar só a retirada antes de 01/12 salva esses pedidos, mas
muda o que as campanhas aprendem durante a Black, que é o que ficou combinado
não mexer. A maioria dos 188 deve voltar `nao_contado`, porque a etiqueta só
contou os que o Google atribuiu a anúncio; o número de retiradas de verdade só
aparece depois da primeira rodada valendo.

## O que depende do Filipe

1. **Acesso de edição da conta de serviço.** No Google Ads: Administrador,
   Acesso e segurança, Usuários, `portal-search-console@jk-portal-509621.iam.gserviceaccount.com`,
   trocar "Somente leitura" por "Padrão". As duas APIs recusam escrita com a
   conta só de leitura (a Data Manager diz `PERMISSION_DENIED` por extenso). Se
   a validação passa com ela assim não foi testado.
2. **Ativar a Data Manager API** no projeto `jk-portal-509621` do Google Cloud
   (APIs e serviços, Biblioteca, "Data Manager API", Ativar). Sem isso a compra
   paga volta `SERVICE_DISABLED`. A retirada não precisa.
3. **Criar a ação "Compra paga"** no dia de ligar (passo 3 do roteiro). O
   painel não cria nem altera ação de conversão.
4. **Só para os dados do cliente:** aceitar os termos de dados do cliente no
   Google Ads (Metas, Configurações) e a política de privacidade revisada (com a
   Kathleen). Sem os termos, o Google recusa o evento com
   `DESTINATION_ACCOUNT_ENHANCED_CONVERSIONS_TERMS_NOT_SIGNED`.

## Testar antes de ligar

**A lista, sem chamar o Google** (na pasta do projeto, com o `.env.local`):

```bash
npm run google:previa -- --lista
```

**Contra a conta de verdade, em validação**, depois do passo 1. A conta de
serviço só existe na Vercel, então a chamada vai para o portal no ar, pelo
banco, sem copiar segredo (pelo editor SQL do Supabase ou pelo Claude):

```sql
select net.http_post(
  url := (select value->>'url' from site_settings where key = 'cron') || '/api/cron/google-conversoes',
  headers := jsonb_build_object('Content-Type', 'application/json',
    'x-cron-secret', (select access_token from integration_tokens where provider = 'cron')),
  body := '{"modo": "validar", "maximo": 20}'::jsonb,
  timeout_milliseconds := 60000
);
-- uns segundos depois, com o número que a linha acima devolveu:
select status_code, content from net._http_response where id = <número>;
```

O modo `validar` monta os corpos com os pedidos que sairiam agora e manda tudo
com `validate_only`, **sem mexer na fila** e com o interruptor como estiver.
Para validar a compra paga antes de o número estar colado, acrescente
`"acao_compra_paga": "<número>"` no corpo. O modo `previa` devolve a lista sem
chamar o Google.

## Roteiro de 01/12

1. Conferir a prévia (`npm run google:previa`) e o passo 1 e 2 de "O que
   depende do Filipe".
2. Rodar o teste em validação (acima). Retirada respondendo 200, com falhas só
   `CONVERSION_NOT_FOUND`, está certo.
3. **Criar a ação "Compra paga"** no Google Ads: Metas, Conversões, Resumo,
   "+ Criar ação de conversão", Importar, "Acompanhar conversões de cliques"
   (outras fontes de dados ou CRM). Categoria Compra, valor "usar valores
   diferentes para cada conversão", contagem "Todas", janela de clique de 30
   dias, atribuição baseada em dados. **Como ação secundária** (fora da meta
   de otimização). O número é o `ctId=` do endereço da página da ação. O
   Google pede 6 horas entre criar a ação e receber o primeiro envio.
4. Colar o número e ligar, ainda em validação:
   ```sql
   update site_settings
      set value = value || '{"acao_compra_paga": "<número>", "ligado": true}'::jsonb
    where key = 'google:conversoes';
   ```
5. Pôr a rotina no relógio, como migration própria (`0136_conversoes_do_google_no_relogio.sql`),
   de 15 em 15 minutos, nos minutos 11, 26, 41 e 56 (fora dos minutos das
   outras rotinas):
   ```sql
   select cron.schedule('conversoes-do-google', '11-59/15 * * * *',
     $$select public.disparar_conversoes_do_google();$$);
   ```
6. Na rodada seguinte, conferir a fila (`select tipo, estado, codigo, count(*)
   from google_conversoes group by 1, 2, 3`) e o pulso na tela de saúde
   ("Compras no Google Ads"). Tudo `validado`, sem erro de configuração.
7. Tirar da validação:
   ```sql
   update site_settings set value = value || '{"validar": false}'::jsonb
    where key = 'google:conversoes';
   ```
8. No dia seguinte: no Google Ads, a coluna de conversões da ação da etiqueta
   cai nos dias dos cancelados, e a "Compra paga" recebe as primeiras compras.
   Na fila, retiradas em `confirmado` ou `nao_contado` e compras em
   `confirmado`.
9. Decidir, campanha por campanha, se a otimização passa para "Compra paga"
   (ela vira principal e a da etiqueta, secundária).

## Como voltar

- **Parar tudo na hora:** `update site_settings set value = value ||
  '{"ligado": false}'::jsonb where key = 'google:conversoes';`. A rodada
  seguinte não faz nada. Para tirar também do relógio:
  `select cron.unschedule('conversoes-do-google');`.
- **Só uma peça:** `{"retirada": false}` ou `{"compra_paga": false}`.
- **A retirada não se desfaz.** O Google não devolve uma conversão retirada.
  Por isso a espera de 6 horas depois do cancelamento e a trava do pedido pago.
- **A compra paga** fica na ação "Compra paga". Como secundária, não muda lance
  nenhum; se já tiver virado principal, volte a ação da etiqueta para principal
  e a "Compra paga" para secundária.

## Limites conhecidos

- **Só o clique visto no mesmo navegador.** A compra paga depende do clique que
  o coletor anotou (desde 13/11). Quem clicou no celular e comprou no
  computador não entra. É o caso para `pedidos_sem_clique`, que pede os dados
  do cliente.
- **A compra paga estornada depois não é retirada da "Compra paga".** O tipo
  existe (`RETRACTION` vale para ação de importação de cliques), mas a fila tem
  uma linha de retirada por pedido, a da etiqueta. Fica para depois de a ação
  existir.
- **Consentimento não vai no evento.** O Google recomenda o campo e o exige
  para quem está no Espaço Econômico Europeu. A loja não pergunta esse
  consentimento, e mandar "concedido" seria afirmar o que ela não perguntou. Se
  o Google passar a recusar por consentimento (`NO_CONSENT`), a linha fica
  pendente e a saúde acusa.
- **O instante do pagamento é aproximado.** A loja guarda o dia do pagamento e,
  quando a importação viu a troca de "aguardando" para pago, o instante da
  troca. Sem os dois, vale a hora do pedido (cartão aprovado na hora).
- **A conferência da Data Manager** pergunta por até 26 horas. Depois disso a
  linha fica `enviado`, sem a confirmação.
