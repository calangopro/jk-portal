# Search Console automático: passo a passo

O painel do portal passa a buscar sozinho, toda segunda às 6h15, os últimos 28
dias do Search Console. Os números aparecem em **Métricas** e alimentam a
**fila de pautas**. Para isso o Google precisa de um "usuário robô", que é uma
conta de serviço. São quatro etapas, e só a primeira tem várias telas.

Leva uns 15 minutos. Use a conta Google **jkaliancasmkt@gmail.com**, que é a
dona do Search Console da JK.

> A chave que você vai baixar na etapa 1 é uma senha. Ela vai para a Vercel e
> para mais lugar nenhum: nada de WhatsApp, e-mail ou Trello. Depois de colar
> na Vercel, apague o arquivo do computador.

---

## Etapa 1. Criar a conta de serviço no Google Cloud

1. Abra [console.cloud.google.com](https://console.cloud.google.com) logado
   como jkaliancasmkt@gmail.com. Se pedir para aceitar os termos, aceite.
2. **Criar projeto.** No topo, clique no seletor de projeto → **Novo projeto**.
   Nome: `jk-portal`. Clique em **Criar** e, quando terminar, selecione esse
   projeto no mesmo seletor. Não precisa de cartão: essa API é gratuita.
3. **Ligar a API.** No menu ☰ → **APIs e serviços** → **Biblioteca**. Busque
   `Google Search Console API`, abra e clique em **Ativar**.
4. **Criar a conta.** Menu ☰ → **IAM e administrador** → **Contas de
   serviço** → **Criar conta de serviço**.
   - Nome: `portal-search-console`
   - Clique em **Criar e continuar**.
   - Na parte de papéis (permissões do projeto), **não escolha nada**. Clique em
     **Continuar** e depois em **Concluir**.
5. **Baixar a chave.** Na lista, clique na conta que você criou → aba
   **Chaves** → **Adicionar chave** → **Criar nova chave** → **JSON** →
   **Criar**. O navegador baixa um arquivo `.json`.
6. Na mesma tela da conta, **copie o e-mail dela**. Ele termina em
   `@jk-portal-XXXXX.iam.gserviceaccount.com`.

## Etapa 2. Dar acesso de leitura no Search Console

1. Abra o [Search Console](https://search.google.com/search-console) e escolha
   a propriedade **jkaliancas.com.br** (a de domínio, sem `https://`).
2. **Configurações** (engrenagem, no menu da esquerda) → **Usuários e
   permissões** → **Adicionar usuário**.
3. Cole o e-mail da conta de serviço e escolha **Restrito**. Restrito só lê,
   não muda nada. Clique em **Adicionar**.

## Etapa 3. Colocar a chave na Vercel

1. Abra o projeto **jk-portal** na Vercel → **Settings** → **Environment
   Variables**.
2. Clique em **Add New** (ou **Add Environment Variable**):
   - **Key:** `GSC_SERVICE_ACCOUNT_JSON`
   - **Value:** abra o arquivo `.json` baixado num editor de texto (TextEdit
     serve), selecione **tudo** e cole aqui, do `{` ao `}`.
   - **Environments:** Production.
   - Se aparecer a opção **Sensitive**, ligue.
3. Salve.
4. **Publique de novo**, porque variável nova só vale em deploy novo: aba
   **Deployments** → no primeiro da lista, **⋯** → **Redeploy**.
5. Apague o arquivo `.json` do computador e esvazie a lixeira.

## Etapa 4. Testar

1. No painel do portal, abra **Métricas**.
2. No quadro **Search Console automático** deve aparecer o e-mail da conta de
   serviço, igual ao da etapa 1.
3. Clique em **Importar agora**. Em alguns segundos aparece algo como
   "Importado: 1000 consultas e 1000 páginas de sc-domain:jkaliancas.com.br".
4. A tela recarrega com os números do período novo, e a fila de **Pautas**
   passa a usar esses dados.

Pronto. A partir daí roda sozinho toda segunda, e o resultado da última vez
fica escrito no mesmo quadro.

---

## Se der erro

| Mensagem no quadro | O que fazer |
|---|---|
| "Ainda não configurado: falta a variável GSC_SERVICE_ACCOUNT_JSON" | A variável não foi salva, ou faltou o **Redeploy** da etapa 3 |
| "O Google recusou a conta de serviço" | O valor colado não é o arquivo inteiro, ou a API da etapa 1.3 não foi ativada |
| "A conta de serviço não tem acesso à propriedade" | Falta a etapa 2, ou o e-mail foi colado com espaço ou letra trocada |
| "Criação de chave desativada" no Google Cloud (etapa 1.5) | A conta está numa organização que bloqueia chaves. Use a conta jkaliancasmkt@gmail.com, que é pessoal e não tem esse bloqueio |

## Perguntas comuns

**Os números são só do portal ou da loja também?** Da propriedade configurada
em **Integrações**, que hoje é `sc-domain:jkaliancas.com.br`, o domínio
inteiro. É o que a planilha trazia antes e é o que a fila de pautas precisa,
porque uma busca em que a loja aparece mal colocada é pauta para um guia. Para
ver só o portal, troque a propriedade no cartão do Search Console em
Integrações para `https://www.jkaliancas.com.br/guias/` e repita a etapa 2
nessa propriedade.

**Posso ainda importar a planilha à mão?** Pode. Continua servindo para
carregar períodos antigos. Mesmo período e mesma dimensão são substituídos,
nunca duplicados, venha da planilha ou do automático.

**E se eu trocar de conta de serviço um dia?** Crie a nova, dê acesso no
Search Console, troque o valor da variável na Vercel, faça o Redeploy e
remova o usuário antigo do Search Console.
