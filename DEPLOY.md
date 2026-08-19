# DEPLOY

Como colocar o portal no ar. Passo a passo, sem pular etapa.

> **Onde ele está hoje (19/08/2026):** publicado na Vercel, respondendo em
> https://jk-portal.vercel.app/guias
>
> As etapas 1, 2 e 3 estão cumpridas. A 4 está **travada** no acesso ao Registro.br, que
> a Kathleen ainda vai passar: sem ele não dá para trocar os nameservers para a
> Cloudflare, e nenhum registro de DNS foi alterado até agora. As etapas 5 e 6 valem
> desde já, com o endereço temporário no lugar do domínio final.

## Antes de tudo

O build de produção precisa passar localmente:

```bash
nvm use && npm run build
```

Se falhar aqui, falha na Vercel também.

## 1. Repositório

Repositório privado no GitHub, com `main` protegida e integração por Pull Request.
O `.env.local` nunca é versionado, e o `.gitignore` já cobre isso.

## 2. Vercel

Plano Pro, porque o projeto é comercial. Produção sai de `main`, e cada Pull
Request ganha um ambiente de preview.

**Importante:** marque os ambientes de Preview com proteção de acesso. O admin
já responde `noindex`, mas preview aberto e indexável divide autoridade e
confunde o Google.

## 3. Variáveis de ambiente

Configure separadamente em Development, Preview e Production.

| Variável | Onde usar | Observação |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | todos | **Só a origem, sem `/guias` e sem barra no fim.** Hoje é `https://jk-portal.vercel.app`, e vira `https://www.jkaliancas.com.br` no dia da virada. O prefixo é somado por `absoluteUrl()`. Sem esta variável, canonical e sitemap saem apontando para localhost. |
| `NEXT_PUBLIC_SUPABASE_URL` | todos | Pública. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | todos | Pública, protegida por RLS. |
| `SUPABASE_SERVICE_ROLE_KEY` | servidor | **Secreta.** Convite de editores e sincronização. |
| `OPENAI_API_KEY` | servidor | **Secreta.** Analisador de SEO e GEO. |
| `TRAY_API_URL` | servidor | Endereço da API da loja. |
| `TRAY_CONSUMER_KEY` | servidor | **Secreta.** |
| `TRAY_CONSUMER_SECRET` | servidor | **Secreta.** |
| `TRAY_CODE` | servidor | **Secreta.** |
| `TRAY_WEBHOOK_SECRET` | servidor | **Secreta.** Sem ela o webhook fica desligado. |

Nenhuma chave secreta pode receber o prefixo `NEXT_PUBLIC_`. O arquivo
`src/lib/supabase/admin.ts` importa `server-only`, então o build quebra de
propósito se alguém tentar usar a `service_role` no cliente.

## 4. Domínio

**O portal NÃO recebe domínio na Vercel.** `www.jkaliancas.com.br` continua
apontando para a Tray, no DNS. A Vercel é só a origem que o Cloudflare consulta.

O aplicativo roda sob `basePath: "/guias"`, então tudo que ele serve (rota,
`/_next/*`, `/api/*`, arquivos de `public/`) já nasce dentro do prefixo. Nada é
pedido na raiz do domínio, que é da loja.

O Worker precisa repassar `/guias/*` **sem tirar o prefixo**. Se ele reescrever
para a raiz da Vercel, todas as rotas quebram, porque o aplicativo espera o
`/guias`. Todo o resto do domínio continua indo para a Tray.

Ordem segura: publicar na Vercel, homologar em `https://jk-portal.vercel.app/guias`
e só então ligar o Worker, com plano de rollback (desligar a rota do Worker
devolve tudo para a Tray na hora).

Uma parte pode ser adiantada sem risco nenhum, e vale fazer antes: criar o Worker e
testar num endereço `workers.dev`. Isso não encosta no domínio da loja. O que precisa
esperar os nameservers é só pendurar a rota `www.jkaliancas.com.br/guias*` nele.

O Worker consulta `https://jk-portal.vercel.app` como origem, e repassa o `/guias` **sem
remover o prefixo**.

## 5. Depois de publicar

1. Confira `https://jk-portal.vercel.app/guias`, e também
   `/guias/sitemap.xml` e `/guias/robots.txt`.
2. **O `robots.txt` do portal não governa o domínio.** Rastreador só lê na raiz
   do host, e a raiz é da Tray. Peça para incluírem no robots.txt da loja:
   `Disallow: /guias/admin`, `/guias/api`, `/guias/preview`, `/guias/busca` e
   `Sitemap: https://www.jkaliancas.com.br/guias/sitemap.xml`.
3. Search Console: crie a propriedade de PREFIXO
   `https://www.jkaliancas.com.br/guias/` e envie o sitemap na mão, já que o
   robots do domínio não anuncia ele.
4. Conecte GTM e GA4 em `/guias/admin/integracoes`. As tags só carregam em
   produção e só quando a integração está conectada.
5. **Desligue o cadastro público** no Supabase (Authentication > Sign In /
   Providers), troque a senha do usuário master e rotacione a chave da OpenAI.
6. Ligue "leaked password protection" no painel do Supabase, em Authentication.
7. Preencha `site_settings.cron` **com o prefixo**, senão a publicação agendada
   não dispara: o SQL faz `url || '/api/cron/publicar'`.
8. Rode a primeira sincronização da Tray em `/guias/admin/produtos`.
9. Cadastre o webhook da Tray apontando para
   `https://SEU-DOMINIO/guias/api/tray/webhook?secret=SEU_SEGREDO`.

## 6. Sincronização periódica

Além do webhook, vale um agendamento diário de reconciliação. Na Vercel, use
Cron Jobs chamando a mesma rota do webhook com o segredo, lembrando do `/guias`.
