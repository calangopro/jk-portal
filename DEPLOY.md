# DEPLOY

Como colocar o portal no ar. Passo a passo, sem pular etapa.

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
| `NEXT_PUBLIC_SITE_URL` | todos | Endereço público. Em produção, `https://guia.jkaliancas.com.br`. Sem isso, canonical e sitemap saem apontando para localhost. |
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

Fase 1: subdomínio `guia.jkaliancas.com.br`, que é seguro e não mexe na loja.

Fase 2: mover para `/guia/` no domínio principal por proxy ou rewrite, o que
concentra autoridade. **Só depois de homologação e com plano de rollback.**
Nunca trocar nameserver nem colocar proxy na raiz sem isso.

## 5. Depois de publicar

1. Confira `https://.../robots.txt` e `https://.../sitemap.xml`.
2. Cadastre a propriedade no Search Console e envie o sitemap.
3. Conecte GTM e GA4 em `/admin/integracoes`. As tags só carregam em produção
   e só quando a integração está conectada.
4. Troque a senha do usuário master e rotacione a chave da OpenAI.
5. Ligue "leaked password protection" no painel do Supabase, em Authentication.
6. Rode a primeira sincronização da Tray em `/admin/produtos`.
7. Cadastre o webhook da Tray apontando para
   `https://SEU-DOMINIO/api/tray/webhook?secret=SEU_SEGREDO`.

## 6. Sincronização periódica

Além do webhook, vale um agendamento diário de reconciliação. Na Vercel, use
Cron Jobs chamando a mesma rota do webhook com o segredo.
