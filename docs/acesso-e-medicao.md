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
7. **A tag de remarketing do Google Ads no GTM parece mal configurada.** Ela
   chama o destino `AW-AW-16750399342`, com o prefixo repetido. Ver o passo 6.

Os itens 2, 3, 5 e 6 foram corrigidos no código. O resto é configuração, abaixo.

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
8. Medição: ligar o GA4 no painel e configurar o GA4 (passos 6 e 7).

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

### No painel do portal

Em `/guias/admin/integracoes`, no cartão **Google Analytics 4**, clicar em
**Conectar** (o ID `G-9V89YVR635` já está preenchido). O GTM continua ligado.
O GA4 só carrega em produção.

### No GTM (GTM-WWT3T789)

- **GA4: não criar nada.** O portal manda direto, igual a Tray faz na loja. Uma
  tag de GA4 no GTM disparando em todas as páginas contaria em dobro a loja e o
  portal.
- **Corrigir a tag de remarketing do Google Ads.** As requisições saem para
  `AW-AW-16750399342`, com o prefixo duplicado. No modelo de tag "Remarketing
  do Google Ads", o campo "ID de conversão" leva só o número (`16750399342`).
  Confira com o [Tag Assistant](https://tagassistant.google.com) antes e depois
  de publicar: o destino certo é `AW-16750399342`. Isso vale para a loja
  também, porque o contêiner é o mesmo.
- **Conversão de anúncio a partir do portal (opcional):** o caminho mais simples
  é importar os eventos-chave do GA4 no Google Ads (Ferramentas → Conversões →
  Importar → Google Analytics 4), sem tag nova no GTM. Se preferir tag, os
  eventos chegam no `dataLayer` com `event`, `destino`, `posicao`, `url` e
  `origem`.

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

**Admin**, na propriedade da loja:

1. **Coleta e modificação de dados → Retenção de dados → 14 meses.** O padrão
   é 2 meses, e a exploração não enxerga nada além do prazo.
2. **Definições personalizadas → Criar dimensão personalizada**, escopo
   "Evento": `destino` e `posicao`. Dimensão não vale para trás, então crie
   logo depois do deploy.
3. **Eventos-chave:** marcar `clique_whatsapp`, `clique_telefone`,
   `clique_rota` e `clique_waze` (lead de loja física) e `clique_produto` (ida
   para a loja). Dá para cadastrar pelo nome antes de o evento chegar, em
   "Novo evento-chave". Confira que `purchase` já está marcado.
4. **Fluxos de dados → o fluxo web → Medição otimizada:** manter ligado
   "Mudanças de página com base em eventos do histórico do navegador" (o
   portal troca de página sem recarregar) e "Pesquisa no site" (o portal usa
   `q` na busca).
5. **Fluxos de dados → Configurar tag → Listar referências indesejadas:** somar
   os meios de pagamento da loja, `mercadopago.com`, `mercadopago.com.br`,
   `mercadolivre.com` e `appmax.com.br`. Se o pagamento devolver a pessoa por
   um desses domínios, a venda vira "referência" do meio de pagamento e perde
   a origem orgânica.
6. **Vinculações de produto → Search Console:** vincular
   `sc-domain:jkaliancas.com.br`. Traz as buscas do Google para dentro do GA4.
7. **Confirmar que a Tray manda `purchase`:** Relatórios → Monetização →
   Compras de e-commerce precisa ter dados. Não deu para conferir daqui.

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
| `TRAY_API_URL`, `TRAY_CONSUMER_KEY`, `TRAY_CONSUMER_SECRET`, `TRAY_CODE`, `TRAY_WEBHOOK_SECRET`, `TRAY_STORE_URL` | da Tray | Secretas, exceto a URL |
| `PREVIEW_SECRET` | segredo | Assina o link de preview de rascunho |
| `INDEXNOW_KEY` | 32 caracteres hexadecimais | Aviso ao Bing |
| `GOOGLE_SITE_VERIFICATION` | código | Verificação do Search Console |

**A pendência mais séria continua sendo o plano.** O projeto está numa conta
Hobby (o endereço `jk-portal-jk-alianca.vercel.app` do Site URL antigo é dela),
que é para uso não comercial. O time `Agencia Setup` já é Pro. Ao mover, conferir se
`jk-portal.vercel.app` continua respondendo, porque é o endereço que o Worker
da Cloudflare consulta. A equipe editorial não precisa de conta na Vercel.
