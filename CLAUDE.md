# CLAUDE.md — Portal JK Alianças

> **Primeira coisa de toda sessão, nesta ordem:**
> 1. [`REGRAS.md`](REGRAS.md), padrões inegociáveis (como escrever, SEO/GEO, UX, ferramentas). **Regra absoluta: nunca usar travessão, nunca linguagem de robô.**
> 2. [`PROJETO.md`](PROJETO.md), o documento-norte (o que estamos construindo e por quê).
>
> Este arquivo guarda o **essencial de operação** para não perder tempo.

## O que é este projeto (resumo de uma linha)
Portal de conteúdo editorial da **JK Alianças** (joalheria, pt-BR) em **Next.js 15 + Supabase**,
feito para **dominar Google e respostas de IA (SEO + GEO)**. Tem **parte pública** (funciona hoje)
e um **admin/CMS ainda a construir** (usuários/editores, edição de conteúdo, comentários,
compartilhamento, métricas, integração Search Console/GA4/GTM, analisador SEO/GEO ao vivo).
Backlog: Trello 🧠 JK Alianças | ADM → https://trello.com/b/S7IXlYDi

## ⚠️ Ambiente de desenvolvimento — LEIA ANTES DE RODAR
- **Use Node 22 LTS (via nvm).** O `.nvmrc` fixa `22`. **Node 24 trava o `next dev` em silêncio**
  (processo vivo, sem banner, porta 3000 nunca abre). Já diagnosticado — não é o código.
- Rodar o dev server:
  ```bash
  nvm use && npm run dev   # → http://localhost:3000
  ```
- **Nunca** suba o dev server com Bash direto; neste ambiente use o preview tool.
- Se travar de novo: confirme `node -v` (deve ser 22) e faça um reinstall limpo:
  ```bash
  rm -rf node_modules .next && npm install
  ```
- **NUNCA rode `npm run build` com o `next dev` ligado.** Os dois escrevem na
  mesma pasta `.next` e corrompem o cache, o que aparece como
  `Cannot find module './873.js'` e página sem estilo. Para conferir o build sem
  derrubar o dev, use a pasta separada:
  ```bash
  npm run build:seguro
  ```
  Se acontecer: pare o servidor, `rm -rf .next` e suba de novo.
- O servidor escuta em IPv6 `*:3000`. Se `localhost` der problema no macplace, teste `127.0.0.1:3000`.

## Stack & versões
Next.js 15.5 (App Router, TS) · React 19 · Tailwind v4 (config em `globals.css`, sem `tailwind.config`)
· Supabase (`@supabase/ssr`) · Node 22.

## Mapa do código
```
src/app/            rotas: page (home), guia/, lojas/, medidor-de-aliancas/, robots.ts, sitemap.ts, llms.txt/
src/components/      layout/ (Header, NavPrincipal, Footer, Container, Sidebar), ui/ (Button, Card, Pill,
                     Acordeao, Trilha, Figura, FaqLista, states), conteudo/, medidor/, lojas/, schema/JsonLd
src/lib/content/     tipos do domínio
src/lib/data/        acesso a dados (Supabase) + fallback para samples.ts
src/lib/content/     tipos, índice por H2, tempo de leitura, fatos institucionais com fonte
src/lib/schema/      builders de JSON-LD (Article, Breadcrumb, Organization, JewelryStore, FAQ, HowTo)
src/lib/seo/         metadata + constantes do site
src/lib/supabase/    read (SSG), server, client, admin (service_role), middleware
src/lib/data/rotas.ts  links de Google Maps, Waze, WhatsApp e telefone das lojas
supabase/migrations/ 0001 a 0017, todas em arquivo e todas aplicadas
public/              logo.png, logo.svg, og/ (og/default.png ainda falta)
docs/                identidade-visual-jk.md (marca)
```

## Armadilhas já pagas (não repetir)
- **`middleware.ts` fica em `src/middleware.ts`**, não na raiz. Com a pasta `src/`
  o Next ignora o arquivo da raiz **em silêncio**: nada de erro, o middleware
  simplesmente não roda. Ficou meses sem rodar assim. Para conferir, veja se
  `Middleware` aparece na saída do `next build`, ou olhe
  `.next/server/middleware-manifest.json`.
- **Nunca rode `npm run build` com o `next dev` ligado** (ver seção acima).
- **Toda migration aplicada precisa virar arquivo** (ver seção do Supabase).
- **Existem dois servidores Supabase no MCP e só um funciona.** As ferramentas
  `mcp__supabase__*` funcionam. As do outro servidor recusam tudo, inclusive leitura,
  com mensagem de permissão. Se DDL falhar, troque de ferramenta antes de concluir que
  a sessão perdeu autorização.
- **Depois de DDL, erro de "column does not exist" costuma ser cache.** O PostgREST
  guarda o schema e o Next segura a rota por ISR. Resolve com
  `notify pgrst, 'reload schema'` e um toque em qualquer arquivo da rota.
- **RLS `to authenticated using (true)` não protege nada.** As policies de escrita
  de 0002 usavam isso, e o cadastro público do Supabase estava ligado. Qualquer
  pessoa criava conta com a chave anônima (que vai no HTML) e ganhava escrita em
  `contents`, `locations`, `sources`, `content_links` e `redirects`. O pior era
  `redirects`, que o middleware serve em toda requisição. Corrigido em 0020:
  escrita exige `is_staff()`, e conta sem convite nasce inativa. Antes de dar
  policy por pronta, teste com um JWT falso:
  `set local role authenticated; set local request.jwt.claims = '{"sub":"...","role":"authenticated"}'`.
- **`is_staff()` é só "tem perfil ativo", não "foi convidado".** Todo usuário do
  auth ganha perfil pelo trigger `handle_new_user`. A trava de convite mora no
  `is_active`, que agora sai de `invited_at`.
- **`.conteudo-rico` é a MESMA classe no editor e no site publicado.** Mexeu nela, confira
  os dois lados, senão o preview passa a mentir sobre o que vai ao ar.
- **`.conteudo-rico` é um container CSS (`container-name: leitura`).** Bloco de dentro
  que muda de layout por largura usa `@container leitura`, **nunca `@media`**. Com
  `@media`, a vitrine de dois produtos ficava lado a lado no site e empilhada no
  editor na mesma janela, porque a coluna do editor é mais estreita que a do
  artigo. A tela do editor também é mais larga que o resto do painel, por
  `.painel-conteudo:has([data-painel-largo])`.
- **Preço do card de produto tem contrato entre dois arquivos.** `cartaoEmHtml()`
  (`src/lib/editor/VitrineNode.ts`) emite preço, preço antigo, selo e aviso como
  elementos **folha**, com `data-*-de="<id>"` e só texto dentro. É isso que deixa
  `aplicarPrecos()` (`src/lib/conteudo/precos-html.ts`) trocar o valor no servidor
  sem parser de HTML, para a página nunca anunciar preço velho. Se um desses
  elementos ganhar filho, a troca para em silêncio. O teste
  `npm run verificar:precos` roda junto do build e pega isso.

## Convenções & regras
- **Idioma do produto e do conteúdo: pt-BR.**
- O portal **complementa a loja Tray** — nunca duplicar checkout nem editar preço/estoque aqui.
  Preço/estoque/disponibilidade = fonte de verdade na Tray (sincronização só-leitura no futuro).
- **Sem afirmação institucional sem fonte aprovada pela JK.** Nunca inventar avaliações, notas,
  preços ou FAQ.
- Conteúdo é **"resposta primeiro"** (bloco de resposta rápida no topo) — chave para SEO/GEO.
- Schema só quando real (`Product` só com produto real; nada de `AggregateRating` fabricado).
- Acessibilidade é requisito (contraste WCAG AA, foco visível, alt útil, teclado) — inclusive
  quando aplicar o **glassmorphism** (o vidro nunca pode prejudicar a leitura).
- **Soft-delete / desativar** em vez de apagar — preservar histórico.
- Secrets: `service_role` e tokens da Tray **jamais** com prefixo `NEXT_PUBLIC_`. `.env.local` não é versionado.

## Estado atual (12/08/2026)
✅ **Público:** home, `/guia`, `/guia/[slug]`, `/lojas`, `/lojas/[slug]`, `/medidor-de-aliancas`, robots/sitemap/llms.txt, JSON-LD, compartilhamento.
✅ **Estrutura:** `src/app/(site)/` = público, `src/app/admin/(painel)/` = protegido, `src/app/layout.tsx` = só html/body/fontes.
✅ **Supabase:** 20 migrations aplicadas e em arquivo, 22 tabelas com RLS, bucket `media`.
✅ **Admin:** login por e-mail e senha (sem tela de cadastro; o endpoint de signup do Supabase ainda está aberto, ver Pendências), rotas protegidas por middleware, `noindex`, dashboard, usuários, mídia, comentários, produtos, métricas, integrações e lojas.
✅ **Editor de conteúdo:** blocos com TipTap, salvamento automático com detecção de conflito, modelos, links internos com busca, fontes com trava na publicação, canibalização determinística, preview de rascunho assinado, analisador SEO/GEO ao vivo e assistente de IA.
✅ **Inserção no editor (13/08):** botão `+` na margem, alinhado à linha do cursor, e comando por `/` no texto (filtra sem acento, setas, Enter, Esc). Tudo entra no ponto onde o cursor está, não no fim do artigo: linha vazia é substituída, linha com texto recebe o bloco logo abaixo. Linha de texto garantida no fim para bloco atômico não prender o cursor.
✅ **Vitrine de produtos (13/08):** de um a quatro produtos no mesmo bloco, em três formatos (vertical, quadrado, horizontal), com mover e remover por card. O card inteiro é o link. Conteúdo antigo (card solto `div[data-produto]`) sobe para vitrine ao abrir. O preço exibido sai da tabela `products` na hora de servir a página, não do que ficou gravado no texto.
✅ **Tray:** cliente só-leitura, sincronização com upsert por `tray_id`, webhook, 1.110 produtos. Funciona SEM credencial, pela busca pública.
✅ **Medidor:** página clara e indexável mais **modo de medição em tela cheia** sobre carvão. Anel em SVG com manipulação direta (arrastar, pinçar, roda, teclado), objetos de calibração desenhados, tabela ligada ao resultado, `aria-valuetext` e `aria-live`. Fórmula: circunferência = aro + 40.
✅ **Design editorial (12/08):** capa de revista na entrada do artigo, corpo de jornal na leitura. Escala tipográfica fluida em `clamp()`, coluna de leitura em `ch`, vidro em três níveis (`.glass-sutil`, `.glass`, `.glass-escuro`), raios unificados nos tokens, componentes compartilhados em `ui/`, header com gaveta no celular.
✅ **Resposta rápida:** deixou de ser caixa de vidro e virou **linha de apoio editorial** (standfirst). Continua sendo o primeiro texto do artigo, então o GEO segue intacto. Não voltar ao formato de caixa: foi rejeitado explicitamente.
✅ **Capa por guia:** `content_media` com papel `hero`, com campo no admin e trava que recusa imagem sem alt ou sem dimensão. É o elemento LCP quando existe.
✅ **10 lojas físicas publicadas:** endereço, telefone/WhatsApp e link do Maps do site oficial; coordenada e place id resolvidos dos próprios links curtos. Página com galeria, mapa (OpenStreetMap, sem chave), rota por Maps e por Waze, horário dia a dia, serviços, história, avaliações e FAQ.
✅ **Alinhamento com a documentação de SEO do Google (12/08):** `max-image-preview:large`, `max-snippet:-1` e `max-video-preview:-1` em toda página indexável (sem isso o site ficava fora do Discover); `robots.txt` com `Disallow` repetido em cada grupo de bot de IA (grupo específico substitui o `*`, então o admin estava aberto para os seis agentes); canonical do `<head>` e `@id` do JSON-LD saindo da mesma função; 404 com `noindex, follow`, cabeçalho, rodapé e saídas, dentro do grupo `(site)`; relacionados vindo do grafo; `viewport` e verificação do Search Console. Sitemap sem `priority`/`changefreq` (o Google ignora os dois), com `lastmod` nas rotas fixas e extensão de imagem. `primaryImageOfPage`, `WebPage`, `ItemList`, `creditText`/`copyrightNotice` a partir do campo `credit`, `Product` só com preço real. **Páginas de autor** (`0018_autores.sql`) com `ProfilePage`, `/autor/[slug]`, tela `/admin/autores` e assinatura clicável. **Trava de publicação** para erros objetivos, nas duas portas. 7 regras novas no analisador. Blocos de figura com legenda, tabela com `<caption>` e `scope`, vídeo com `title`. Assistente que escreve o `alt` lendo a imagem. Preview do Google por largura em pixel, mais preview do card de compartilhamento. FAQ aberta no desktop, 410 com marca, headers de segurança e AVIF.
⚠️ **O que a documentação mudou e vale saber:** o rich result de **FAQ acabou em 07/05/2026** e o de **HowTo em 2023**. O markup dos dois continua no ar (custo zero, e Bing e as IAs ainda leem), mas não é mais argumento de busca no Google. O **`llms.txt` não é lido pelo Google** (confirmado em 15/06/2026), fica para os outros sistemas. E **não existe otimização separada para IA**: o guia de IA generativa diz que otimizar para busca generativa é SEO, e desmonta picotar conteúdo e depender de dados estruturados.
🔲 **A construir:** conteúdo (só 1 guia publicado), OAuth do Search Console e do GMB, deploy na Vercel.
⚠️ **Pendências:** **desligar o cadastro público no painel do Supabase**
(Authentication → Sign In / Providers → "Allow new users to sign up"), que hoje
está ligado e é a única parte da falha de 0020 que não dá para fechar por
migration. Trocar a senha temporária do master e rotacionar a chave da OpenAI.
Ligar "leaked password protection" no Supabase. Projeto sem `eslint.config.js`,
então o lint não roda. README desatualizado.
⚠️ **Depende da JK:** fotos das lojas, horário confirmado de sete unidades, história por unidade, avaliações reais do GMB, razão social e CNPJ.

## Regras de dado que o código faz valer
- **Horário de loja só vai ao ar com `hours_source` preenchido.** Sem fonte, a página avisa e manda conferir no Google.
- **Avaliação só existe com origem.** Há constraint no banco (`locations_rating_com_fonte`) que recusa nota sem `reviews_source`, e o admin barra antes com mensagem legível.
- **Imagem sem alt ou sem dimensão não vira capa nem foto de loja.** A validação é no servidor, não no navegador.
- Nunca fabricar `AggregateRating`, preço, estoque ou avaliação.

## Supabase (MCP)

> **Regra: toda migration aplicada precisa virar arquivo.** Já aconteceu de 6
> migrations existirem só no banco (0010 a 0015), o que faria um deploy limpo
> quebrar. Depois de qualquer `apply_migration`, salve o mesmo SQL em
> `supabase/migrations/` com o mesmo nome. Para conferir se há deriva, compare
> `list_migrations` com `ls supabase/migrations/`.
> **Existem dois servidores Supabase no MCP e só um funciona.** Use as ferramentas
> `mcp__supabase__*`. As do outro servidor respondem
> "You do not have permission to perform this action" em tudo, inclusive leitura.
Projeto remoto: `jtteytvzxplnpqgzmqdq`, já conectado e autorizado via MCP.
Se perder o acesso, reautorize com `/mcp` numa sessão interativa. O `project_ref` correto fica
em `~/.claude.json`, cuidado para não apontar para outro projeto.

---
Padrões de escrita, SEO/GEO, UX e ferramentas → **[`REGRAS.md`](REGRAS.md)**.
Visão, estratégia, design e roadmap → **[`PROJETO.md`](PROJETO.md)**.
