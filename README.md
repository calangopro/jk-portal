# Portal JK Alianças

Portal de conteúdo editorial da **JK Alianças** (joalheria, pt-BR), feito para dominar
o Google e as respostas de IA. Tem uma parte pública, quatro ferramentas próprias e um
admin que é a fábrica de conteúdo.

No ar em https://jk-portal.vercel.app/guias (endereço temporário).

## Leia antes de escrever a primeira linha

| Arquivo | Para quê |
|---|---|
| [`REGRAS.md`](REGRAS.md) | Padrões inegociáveis: como escrever, SEO e GEO, UX. **Nunca usar travessão, nunca linguagem de robô.** |
| [`PROJETO.md`](PROJETO.md) | O documento norte: o que estamos construindo e por quê |
| [`CLAUDE.md`](CLAUDE.md) | Operação do dia a dia e as armadilhas que já custaram tempo |
| [`ESTADO.md`](ESTADO.md) | Onde o projeto está hoje e o que fazer a seguir |
| [`DEPLOY.md`](DEPLOY.md) | Como colocar no ar, passo a passo |

## Stack

Next.js 15.5 (App Router, TypeScript) · React 19 · Tailwind v4 (configurado dentro de
`globals.css`, sem `tailwind.config`) · Supabase com `@supabase/ssr` · Node 22 · Vercel.

## Rodando localmente

**Use Node 22.** O `.nvmrc` fixa a versão. Node 24 trava o `next dev` em silêncio:
processo vivo, sem banner, e a porta 3000 nunca abre. Já foi diagnosticado, não é o
código.

```bash
nvm use && npm install
cp .env.example .env.local   # preencha com os valores do projeto
npm run dev
```

O site responde em http://localhost:3000/guias e o admin em
http://localhost:3000/guias/admin.

Se travar depois de uma mudança grande, ou se aparecer bloco em branco com chunk 404 no
console, o cache do `.next` quebrou:

```bash
rm -rf .next && npm run dev
```

**Um `next dev` por pasta, e só.** Dois servidores na mesma pasta escrevem no mesmo
`.next` e se atropelam, e rota que existe começa a responder 404 num deles.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção, mais os dois testes do projeto |
| `npm run build:seguro` | O mesmo, em pasta separada, para rodar **sem derrubar o dev** |
| `npm run verificar:tokens` | Confere que os tokens de cor e raio existem no CSS |
| `npm run verificar:precos` | Confere que a troca de preço no HTML servido continua funcionando |

**Nunca rode `npm run build` com o `next dev` ligado.** Os dois escrevem em `.next` e
corrompem o cache, o que aparece como `Cannot find module './873.js'` e página sem
estilo. Use `build:seguro`.

## O prefixo `/guias`

O domínio `www.jkaliancas.com.br` é da loja Tray, e continua sendo. O portal roda sob
`basePath: "/guias"`, então rota, `/_next/*`, `/api/*` e arquivos de `public/` já nascem
dentro do prefixo, e nada é pedido na raiz do domínio.

- **O prefixo mora em um lugar só:** `src/lib/seo/base-path.ts`. Nunca escreva `/guias`
  à mão em outro arquivo.
- **`NEXT_PUBLIC_SITE_URL` guarda só a ORIGEM**, sem o `/guias`. Quem soma o prefixo é
  `absoluteUrl()`.
- `next/link`, `redirect()`, `next/image` otimizado, `next/font` e `public/` já recebem
  o prefixo sozinhos. Precisam do prefixo na mão: `fetch` escrito por extenso,
  `sendBeacon`, `window.open`, HTML cru e SVG no `next/image`.

## Autenticação

Login por e-mail e senha em `/admin/login`, com o Supabase. **Não existe tela de
cadastro:** usuário entra por convite, e conta sem convite nasce inativa.

O `src/middleware.ts` protege `/admin` e renova a sessão. Ele fica em `src/`, e não na
raiz: com a pasta `src/` o Next ignora o arquivo da raiz **em silêncio**, sem erro
nenhum. Para conferir que está rodando, veja se `Middleware` aparece na saída do
`next build`.

## Mapa do código

```
src/app/(site)/       público: home, [slug], dicas, lojas, ferramentas,
                      medidor-de-aliancas, autor, busca, robots, sitemap, llms.txt
src/app/admin/(painel)/  admin protegido
src/app/layout.tsx    layout raiz: só html, body, fontes e a barra de progresso
src/components/       layout/, ui/, conteudo/, medidor/, ferramentas/, lojas/, schema/
src/lib/content/      tipos do domínio, índice por H2, tempo de leitura
src/lib/data/         acesso a dados (Supabase)
src/lib/schema/       builders de JSON-LD
src/lib/seo/          metadata, constantes do site e o base path
src/lib/supabase/     read (SSG), server, client, admin (service_role), middleware
src/lib/ferramentas/  registro único de onde saem página, sitemap, menu e bloco
src/lib/aliancas/     perfis em milímetros que geram o 3D e o desenho do corte
supabase/migrations/  0001 a 0036, todas em arquivo e todas aplicadas
```

## Banco

36 migrations, 22 tabelas com RLS, bucket `media`. **Toda migration aplicada precisa
virar arquivo em `supabase/migrations/`**, senão um deploy limpo quebra. Para conferir se
há deriva, compare `list_migrations` com `ls supabase/migrations/`.

## Segredos

`SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY` e os tokens da Tray **jamais** recebem o
prefixo `NEXT_PUBLIC_`. O `src/lib/supabase/admin.ts` importa `server-only`, então o
build quebra de propósito se alguém tentar usar a `service_role` no cliente.

O `.env.local` não é versionado. A lista completa de variáveis está em
[`DEPLOY.md`](DEPLOY.md).

## Regras de dado que o código faz valer

- Sem fonte registrada, o conteúdo não publica.
- Horário de loja só vai ao ar com a fonte preenchida.
- Avaliação sem origem é recusada pelo banco, não só pela tela.
- Imagem sem alt ou sem dimensão não vira capa nem foto de loja.
- Preço, estoque e disponibilidade são da Tray. O portal nunca edita produto.
