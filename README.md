# JK Alianças | Portal

Portal interno da JK Alianças. **Next.js 15** (App Router, TypeScript, Tailwind CSS) com autenticação via **Supabase**, pronto para deploy na **Vercel**.

## Stack

- [Next.js 15](https://nextjs.org) — App Router
- TypeScript + Tailwind CSS v4
- [Supabase](https://supabase.com) — auth com `@supabase/ssr`
- Deploy: [Vercel](https://vercel.com)

## Rodando localmente

1. Instale as dependências:

   ```bash
   npm install
   ```

2. Copie as variáveis de ambiente e preencha com os dados do seu projeto Supabase
   (Dashboard → Project Settings → API):

   ```bash
   cp .env.example .env.local
   ```

   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ```

3. Rode o servidor de desenvolvimento:

   ```bash
   npm run dev
   ```

   Acesse [http://localhost:3000](http://localhost:3000).

## Autenticação

- O `middleware.ts` protege todas as rotas: quem não estiver autenticado é
  redirecionado para `/login`.
- Login por e-mail/senha em `/login`. Crie usuários pelo Dashboard do Supabase
  (Authentication → Users) ou habilite o fluxo de cadastro conforme necessário.

## Deploy na Vercel

1. Importe o repositório na Vercel.
2. Adicione as variáveis de ambiente `NEXT_PUBLIC_SUPABASE_URL` e
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` nas configurações do projeto.
3. A Vercel detecta o Next.js automaticamente — o deploy roda `next build`.

## Estrutura

```
src/
  app/
    login/          # página e server actions de login/logout
    layout.tsx
    page.tsx        # home (rota protegida)
    globals.css
  lib/supabase/     # clients browser, server e middleware
middleware.ts       # refresh de sessão + proteção de rotas
```
