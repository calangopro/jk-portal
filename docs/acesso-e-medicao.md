# Acesso da equipe e medição

Passo a passo do que mora FORA do código: painel do Supabase, Vercel, GA4, GTM
e as contas de cada pessoa. O código correspondente está na branch
`fix/convite-senha-e-medicao`. Levantado em 24/09/2026.

---

## O que estava errado

1. **O convite caía na Vercel.** O "Site URL" do Supabase era
   `https://jk-portal-jk-alianca.vercel.app` e o endereço do portal não estava
   na lista de "Redirect URLs". Quando o endereço pedido não está na lista, o
   Supabase ignora o pedido sem avisar e manda para o Site URL.
2. **Não existia tela para criar a senha.** O link levava para `/admin`, que
   exige sessão. A pessoa voltava para o login sem senha nenhuma.
3. **Todo convidado nascia inativo.** O gatilho do banco ativa quem tem
   `invited_at`, mas o Supabase só preenche esse campo depois de criar o
   usuário. Carlos e Filipe estão inativos por causa disso, não por decisão de
   ninguém.
4. **O envio de e-mail é o de teste do Supabase.** Ele só entrega para quem é
   membro do time do projeto no Supabase e tem limite baixo por hora. Para a
   equipe da JK, o convite pode simplesmente não chegar.
5. **O portal não mandava nada para o GA4.** O GTM é o mesmo da loja e não tem
   tag de GA4 (a loja usa a integração nativa da Tray). Ninguém conseguia ligar
   quem leu um guia a uma venda.
6. **Os links para a loja tinham `utm_source=portal`.** Portal e loja são o
   mesmo domínio e o mesmo GA4, então esse UTM abria uma sessão nova com origem
   "portal" e apagava o "Google orgânico" da venda.
7. **O GTM chama `AW-AW-16750399342`, com o prefixo repetido.** Já era
   conhecido e a decisão registrada no Trello (WM-025) é **não corrigir**: a
   conversão que vale é a nativa da Tray, e consertar a do GTM contaria a venda
   em dobro. Ver [`infra/gtm/README.md`](../infra/gtm/README.md).

Os itens 2, 3, 5 e 6 foram corrigidos no código. O item 7 fica como está, por decisão. O resto é configuração, abaixo.

---

## Ordem de execução

A ordem importa. Trocar o modelo de e-mail antes do deploy manda o link para
uma página que ainda não existe em produção.

1. Fazer o deploy desta branch (merge na `main`).
2. Supabase: endereços (passo 1).
3. Supabase: modelos de e-mail (passo 2).
4. Supabase: SMTP próprio (passo 3).
5. Supabase: regras de senha e cadastro público (passo 4).
6. Painel do portal: reativar quem nasceu inativo e reenviar convites (passo 5).
7. Testar com um convite para um e-mail pessoal.
8. Medição: ligar o GA4 no painel e configurar o GA4 (passos 6 e 7). Feito em 24/09, falta só marcar os eventos-chave.

---

## Passo 1. Supabase, endereços

**Authentication → URL Configuration**

| Campo | Valor |
|---|---|
| Site URL | `https://www.jkaliancas.com.br/guias` (sem barra no fim) |
| Redirect URLs | `https://www.jkaliancas.com.br/guias/**` |
| | `http://localhost:3000/guias/**` |

Pode apagar da lista qualquer endereço `*.vercel.app` que estiver lá. O portal
não é acessado por eles.

## Passo 2. Supabase, modelos de e-mail

**Authentication → Emails → Templates**

| Modelo | Assunto | Corpo |
|---|---|---|
| Invite user | Seu acesso ao painel da JK Alianças | conteúdo de `supabase/templates/convite.html` |
| Reset password | Crie uma senha nova para o painel da JK Alianças | conteúdo de `supabase/templates/recuperar-senha.html` |

Os dois links levam para `/guias/admin/senha`. Quem gasta o link é o botão
"Salvar senha e entrar", e não a abertura da página. Isso importa porque
Outlook, Gmail e antivírus corporativos abrem os links do e-mail para checar
se são seguros, e com o link padrão do Supabase o robô gastava o convite antes
da pessoa.

A tela nova também entende o link padrão antigo, então nada quebra se esse
passo atrasar. Mas sem ele o e-mail chega em inglês e fica exposto ao robô.

## Passo 3. Supabase, SMTP próprio

**Authentication → Emails → SMTP Settings → Enable custom SMTP**

O e-mail da JK é da Locaweb (MX conferido em 24/09) e o SPF do domínio já
autoriza a Locaweb, então é o caminho sem mexer em DNS:

1. No painel da Locaweb, criar a caixa `nao-responda@jkaliancas.com.br`.
2. No Supabase:

| Campo | Valor |
|---|---|
| Sender email | `nao-responda@jkaliancas.com.br` |
| Sender name | `JK Alianças` |
| Host | o SMTP da Locaweb (costuma ser `email-ssl.com.br`, confirme no painel da Locaweb) |
| Port | `465` |
| Username | `nao-responda@jkaliancas.com.br` |
| Password | a senha da caixa |

**Alternativa:** Resend (`smtp.resend.com`, porta 465, usuário `resend`, senha
= chave da API). Ele pede três registros na Cloudflare, todos em subdomínio
(`resend._domainkey` e `send`). **Nunca crie um segundo registro SPF na raiz**:
o atual (`v=spf1 include:_spf.tray.com.br include:_spf.locaweb.com.br -all`)
é o que autoriza a Tray e a Locaweb, e dois SPF na raiz invalidam os dois.

Depois de ligar o SMTP, em **Authentication → Rate Limits** o limite de
e-mails por hora pode ficar no padrão.

## Passo 4. Supabase, regras de senha e de cadastro

**Authentication → Sign In / Providers → Email**

| Opção | Valor | Por quê |
|---|---|---|
| Allow new users to sign up | **desligado** | Pendência antiga. O convite continua funcionando com isso desligado |
| Minimum password length | `8` | É o mínimo que a tela pede (`src/app/admin/senha/regras.ts`). Se subir aqui, suba lá |
| Email OTP Expiration | `86400` (24 horas, o máximo permitido) | Prazo do link de convite e de recuperação. Com o padrão, curto, o convite vence antes de muita gente abrir o e-mail |
| Prevent use of leaked passwords | ligado, se o plano permitir | Recusa senha que já apareceu em vazamento |

## Passo 5. Painel do portal, quem já foi convidado

Em `https://www.jkaliancas.com.br/guias/admin/usuarios`:

- **Carlos** e **Filipe**: clicar em "Reativar". Os dois abriram o convite (o
  Supabase marcou o e-mail como confirmado), caíram na Vercel e nunca viram
  uma tela de senha, então **não têm senha**. Depois de reativar, cada um entra
  em `/guias/admin/login`, clica em "Esqueci minha senha" e cria a sua.
  "Reenviar convite" não serve para eles: para o Supabase, o convite já foi
  aceito.
- **Erick Oliveira**: nunca abriu o convite. Clicar em "Reenviar convite",
  que aparece agora ao lado de quem ainda não criou a senha.

Daqui para frente, **convide sempre pelo painel do portal**, nunca pelo painel
do Supabase: é a ação do portal que ativa a conta e define o papel.

## Contas da equipe: quem precisa de quê

| Ferramenta | Quem entra | Como dar acesso |
|---|---|---|
| Painel do portal (`/guias/admin`) | Toda pessoa que escreve, revisa ou publica | Usuários → Convidar pessoa |
| Autores (`/guias/admin/autores`) | Quem assina texto | Cadastro de autor, ligado ao usuário. Sem isso a assinatura do guia não tem página |
| GA4 | Marketing e gestão | GA4 → Admin → Property access management. "Viewer" para quem só lê, "Marketer" para quem configura evento |
| GTM | Uma ou duas pessoas | GTM → Admin → User management. Só uma pessoa com "Publish" |
| Search Console | Marketing e quem escreve | Configurações → Usuários e permissões, propriedade `sc-domain:jkaliancas.com.br`. "Restrito" basta para ler |
| Vercel, Supabase, Cloudflare | Só quem desenvolve | Não dê acesso à equipe editorial. Não é necessário para escrever |

**Papéis do painel, como estão hoje no código:** só "Administrador" é
diferente. Ele gerencia usuários, autores, integrações, aparência, responde
comentários e remove conteúdo. **Editor, Revisor e Autor podem exatamente as
mesmas coisas, inclusive publicar.** O nome do papel ainda não trava nada. Se a
ideia é que autor não publique sozinho, isso é uma mudança de código.

---

## Passo 6. Medição: como fica, e o que fazer no GTM

### Como os dados se ligam

```
Google orgânico → /guias/um-guia        GA4: page_view, sessão "google / organic"
                 → clica "Comprar"      GA4: clique_produto (destino, posicao)
                 → loja, mesma sessão   GA4 da Tray: view_item, add_to_cart
                 → /checkout            GA4 da Tray: purchase
```

Tudo cai na mesma propriedade (**G-9V89YVR635**), com o mesmo cookie `_ga`,
porque portal e loja estão no mesmo domínio. A venda fica com a origem de quem
chegou pelo guia. Por isso o link para a loja NÃO pode ter UTM.

### No GTM (GTM-WWT3T789)

O portal não precisa de nada lá. Detalhes em
[`infra/gtm/README.md`](../infra/gtm/README.md).

Eventos que o portal envia:

| Evento | Quando | Parâmetros no GA4 |
|---|---|---|
| `clique_produto` | Qualquer link para a loja (produto, cabeçalho, rodapé, vitrine, medidor) | `destino`, `posicao`, `link_url` |
| `clique_loja` | Chamada para ação que leva a uma loja física | idem |
| `clique_whatsapp` | WhatsApp de uma unidade | idem |
| `clique_telefone` | Telefone de uma unidade | idem |
| `clique_rota` | "Como chegar" pelo Google Maps | idem |
| `clique_waze` | "Como chegar" pelo Waze | idem |
| `clique_guia` | Chamada para ação que leva a outro guia | idem |

`posicao` é `cabecalho`, `rodape` ou `conteudo`, e substitui o `utm_medium`
que os links carregavam.

## Passo 7. GA4, configuração

Propriedade 430853950 ("jkaliancas.com.br", ID de métrica G-9V89YVR635),
acessada pela conta `jkaliancasmkt@gmail.com`. Estado em 24/09:

| Item | Estado |
|---|---|
| GA4 ligado no painel do portal | **Feito** em 24/09. Conferido: o portal manda `page_view` e `clique_whatsapp` (com `destino` e `posicao`), e a loja continua a MESMA sessão, com o mesmo `_ga` |
| Retenção de dados | Já estava em 14 meses |
| Medição otimizada | Já estava certa: troca de página sem recarregar e pesquisa no site ligadas |
| Dimensões personalizadas | **Criadas** em 24/09: "Destino do clique" (`destino`) e "Posição do clique" (`posicao`), escopo Evento. Não valem para trás |
| Eventos-chave | **Falta.** O GA4 só deixa marcar evento que já apareceu na lista, e evento novo leva até um dia. Em Administrador → Eventos → Eventos recentes, marcar a estrela de `clique_whatsapp`, `clique_telefone`, `clique_rota` e `clique_waze`. Os que já existiam: `add_to_cart`, `begin_checkout`, `purchase`, `close_convert_lead` e `qualify_lead` |
| `clique_produto` | Fica como evento comum, sem estrela. A venda já é o `purchase`, e marcar a ida para a loja inflaria o total de eventos-chave |
| Referências indesejadas | Não mexido. O Trello registra "checkout como referral no GA4"; entra no plano de rastreamento da loja, com os meios de pagamento (Appmax, Mercado Pago) |
| Search Console no GA4 | Não mexido. Administrador → Vinculações de produto → Search Console, `sc-domain:jkaliancas.com.br` |

Qualquer mudança no GA4 segue a regra da casa: registrar na lista RELATÓRIO DE
MUDANÇAS do Trello.

### Os relatórios que respondem às perguntas

Todos em **Explorar → Exploração livre**.

**Quantas vendas começaram num guia?**
Linhas: "Página de destino + string de consulta" (filtro: começa com `/guias`)
e "Grupo de canais padrão da sessão". Valores: Sessões, Compras, Receita.

**Quem leu um guia e comprou depois, mesmo em outra visita?**
Crie um segmento de USUÁRIOS com a condição "Caminho da página contém
`/guias`". Compare Compras e Receita desse segmento com o total.

**Quantos leads de loja física vieram do orgânico?**
Filtro: "Nome do evento" é um de `clique_whatsapp`, `clique_telefone`,
`clique_rota`, `clique_waze`. Linhas: "Grupo de canais padrão da sessão" e
`destino` (nome da unidade). Valor: Contagem de eventos.

**O que o GA4 não vê:** a venda que acontece no WhatsApp ou no balcão da loja
física. A mensagem pronta do WhatsApp do portal já começa com "Olá! Vim pelo
site", então dá para o atendimento marcar essas conversas com uma etiqueta no
WhatsApp Business e contar no fim do mês.

### Como conferir depois do deploy

1. Abrir `https://www.jkaliancas.com.br/guias` no [Tag
   Assistant](https://tagassistant.google.com).
2. Ver `page_view` indo para `G-9V89YVR635`.
3. Clicar em "Comprar alianças" e ver `clique_produto` com `posicao =
   cabecalho`.
4. No GA4, **Relatórios → Tempo real** mostra a visita em `/guias`.

---

## Vercel

Nenhuma variável nova. GTM e GA4 moram no banco (painel de Integrações), não em
variável de ambiente.

| Variável | Produção | Observação |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://www.jkaliancas.com.br` | Só a origem, sem `/guias`. Conferido: o canonical de produção já sai certo |
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto | Pública |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | chave anon | Pública |
| `SUPABASE_SERVICE_ROLE_KEY` | chave service_role | **Secreta.** Sem ela não sai convite, reenvio nem o aviso de convite pendente |
| `OPENAI_API_KEY` | chave | Secreta. Pendente de rotação |
| `TRAY_API_URL`, `TRAY_CONSUMER_KEY`, `TRAY_CONSUMER_SECRET`, `TRAY_CODE` | **deixar vazias** | O catálogo é lido pela busca pública da loja, sem credencial. Essas quatro são da API autenticada, que nenhuma tela usa hoje e exige aplicativo aprovado pela Tray |
| `TRAY_WEBHOOK_SECRET` | opcional | Senha inventada por nós (`openssl rand -hex 32`). Só serve para sincronizar o catálogo sem clicar no painel |
| `TRAY_STORE_URL` | opcional | Padrão `https://www.jkaliancas.com.br` |
| `PREVIEW_SECRET` | segredo | Assina o link de preview de rascunho |
| `INDEXNOW_KEY` | 32 caracteres hexadecimais | Aviso ao Bing |
| `GOOGLE_SITE_VERIFICATION` | código | Verificação do Search Console |

**A pendência mais séria continua sendo o plano.** O projeto está numa conta
Hobby (o endereço `jk-portal-jk-alianca.vercel.app` do Site URL antigo é dela),
que é para uso não comercial. O time `Agencia Setup` já é Pro. Ao mover, conferir se
`jk-portal.vercel.app` continua respondendo, porque é o endereço que o Worker
da Cloudflare consulta. A equipe editorial não precisa de conta na Vercel.
