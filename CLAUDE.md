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
- **Sintoma do `.next` corrompido: bloco em branco e chunk 404.** Quando o
  cache quebra, a página responde 200 e o texto do servidor aparece, mas a
  parte interativa fica um retângulo vazio. No console está o motivo:
  `/_next/static/chunks/app/(site)/.../page.js` com 404 e "MIME type
  ('text/plain') is not executable". A pasta do chunk existe no disco e está
  VAZIA. Nem `touch` no arquivo de origem resolve, porque o servidor em memória
  acha que já compilou aquilo. É `rm -rf .next` e subir de novo, sem meio termo.
- **Um `next dev` por pasta, e só.** Dois servidores de desenvolvimento na
  mesma pasta escrevem no MESMO `.next` e se atropelam: rota que existe começa
  a responder 404 ou 500 em um deles enquanto funciona no outro. É o mesmo
  estrago do build com o dev ligado, e o conserto é o mesmo: derrube os dois,
  `rm -rf .next` e suba um só. Por isso o `.claude/launch.json` fica com
  `autoPort: false`, para a segunda tentativa falhar na cara em vez de subir em
  outra porta e corromper o cache em silêncio.
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

## Produção: o portal vive em `/guias`

O domínio **não é do portal**. `www.jkaliancas.com.br` continua na Tray, e um
proxy no Cloudflare manda só `/guias/*` para a Vercel. Por isso o aplicativo roda
sob `basePath: "/guias"` (mecanismo oficial do Next), e não por rewrite.

- **O prefixo mora em um lugar só:** `src/lib/seo/base-path.ts`. O
  `next.config.ts` importa de lá. Nunca escreva `/guias` à mão em outro arquivo.
- **`NEXT_PUBLIC_SITE_URL` guarda só a ORIGEM**, sem o `/guias`. Quem soma o
  prefixo é `absoluteUrl()`. Com o prefixo na variável, `new URL("/x", base)`
  descartaria o caminho e todo canonical sairia apontando para a loja.
- **O que o Next já resolve sozinho, e onde não se mexe:** `next/link`,
  `router.push`, `redirect()`, `next/image` otimizado, `next/font`, `public/`,
  `/_next/*`, o `source` de `headers()` e o `matcher` do middleware (que recebe o
  prefixo no build). No middleware, `nextUrl.pathname` chega SEM o prefixo.
- **O que precisa do prefixo na mão:** `fetch` escrito por extenso,
  `sendBeacon`, `window.open`, HTML cru fora do React, e SVG no `next/image`
  (SVG é servido as-is, sem otimizador, então o `src` sai cru).
- **URL de post é plana:** `/guias/<slug>`, de `(site)/[slug]`. O índice é
  `/guias/dicas`. Isso faz o post dividir espaço de nome com as páginas fixas, e
  no Next o segmento estático ganha do dinâmico EM SILÊNCIO. A trava é
  `src/lib/content/slugs-reservados.ts`, consultada por `slugDisponivel`.
  **Pasta nova em `src/app/(site)/` precisa entrar naquela lista.**
- **Link interno no corpo do artigo fica sem prefixo no banco.** O prefixo entra
  ao servir, em `comBasePathNosLinks` (`src/lib/conteudo/links-html.ts`). É o que
  deixa a tabela sobreviver a uma troca de prefixo sem migration.
- **`robots.txt` do portal NÃO governa o domínio.** Rastreador só lê na raiz do
  host, e a raiz é da Tray. O nosso responde em `/guias/robots.txt` e vale para o
  endereço da Vercel, onde ele É a raiz. Desde 18/09 o robots da Tray traz as
  linhas do `/guias` e anuncia o nosso sitemap, subido pelo painel em
  **Configurações → SEO → Robots**. Duas coisas para lembrar antes de mexer nele
  de novo: subir arquivo próprio **substitui** o automático da Tray inteiro (são
  72 user-agents e os `Disallow` de checkout e carrinho, que precisam ir junto),
  e **a Cloudflare cacheia o `robots.txt` por 4 horas**, então logo depois de
  subir ele ainda responde a versão velha e é preciso limpar o cache daquele
  arquivo. De toda forma, quem de fato protege `/admin` e `/preview` continua
  sendo a metatag `noindex` que essas rotas emitem.
- **Sem HSTS no aplicativo, de propósito.** HSTS é política de host, não de
  pasta. Quem liga é o dono do domínio, na borda. Segue **desligado na zona**,
  e o Worker remove o cabeçalho que a Vercel injeta.

## Mapa do código
```
src/app/            rotas: page (home), [slug]/ (post), dicas/ (índice), lojas/, ferramentas/,
                    medidor-de-aliancas/, robots.ts, sitemap.ts, llms.txt/
src/components/      layout/ (Header, NavPrincipal, Footer, Container, Sidebar), ui/ (Button, Card, Pill,
                     Acordeao, Trilha, Figura, FaqLista, states), conteudo/, medidor/, lojas/, schema/JsonLd
src/lib/content/     tipos do domínio
src/lib/data/        acesso a dados (Supabase) + fallback para samples.ts
src/lib/content/     tipos, índice por H2, tempo de leitura, fatos institucionais com fonte
src/lib/schema/      builders de JSON-LD (Article, Breadcrumb, Organization, JewelryStore, FAQ, HowTo)
src/lib/seo/         metadata + constantes do site
src/lib/supabase/    read (SSG), server, client, admin (service_role), middleware
src/lib/data/rotas.ts  links de Google Maps, Waze, WhatsApp e telefone das lojas
supabase/migrations/ 0001 a 0040, todas em arquivo e todas aplicadas
supabase/templates/  modelos de e-mail do Supabase (convite, recuperar senha): a fonte do que
                     está colado no painel dele
public/              logo.png, logo.svg, og/ (og/default.png ainda falta)
docs/                identidade-visual-jk.md (marca)
```

## Armadilhas já pagas (não repetir)
- **`metadataBase` com caminho duplica o `og:image`.** Com `basePath`, o Next
  monta o caminho da imagem de convenção JÁ com o prefixo e depois junta com o
  `pathname` do `metadataBase`. Com `/guias` nos dois lados, o build emitiu
  `.../guias/guias/guia/x/opengraph-image`. Por isso `metadataBase` é a ORIGEM
  pura: canonical e `og:url` não dependem dele, porque `buildMetadata` já entrega
  URL absoluta.
- **`next/image` NÃO prefixa SVG.** Sem `dangerouslyAllowSVG`, o otimizador não
  toca em `.svg` e o `src` sai cru, sem o basePath: o logo do cabeçalho pedia
  `/logo.svg` na raiz do domínio. Imagem otimizada não tem o problema, e
  prefixar o `url` dela faria o otimizador procurar em `public/guias/`.
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
- **O site público não lê `facts`, lê `fatos_publicos`.** A RLS de `facts` só
  libera para quem tem perfil ativo, e a chave anônima do site enxergava zero:
  o comparador saiu com "a confirmar" em toda linha de teor, com os fatos
  aprovados no banco. A view `fatos_publicos` é `security_invoker = false` de
  propósito (ligado, herdaria a RLS e continuaria vazia), e por isso o filtro de
  `status = 'aprovado'` mora dentro dela. `detail` fica de fora: é contexto
  interno, inclusive lembrete de perguntar à JK.
- **Número em texto de ferramenta se confere na tela renderizada.** Duas vezes o
  texto do registro saiu errado e o build não pegava: "aro 18 é o 8 americano"
  (é 8,5) e "4 mm cobre 23% do dedo" (cobre 22%). São contas que o próprio
  componente faz, então a checagem certa é comparar o texto com o que a página
  mostra, e não reler o que se escreveu.
- **Ferramenta dentro do artigo precisa cortar o HTML.** O corpo do guia vai para
  a página como HTML servido de uma vez, então componente React não mora lá
  dentro. `separarFerramentas` (`src/lib/content/ferramentas-html.ts`) corta o
  corpo nos marcadores `div[data-ferramenta]` e `PaginaDoGuia` intercala o
  componente entre os pedaços. Marcador de ferramenta que saiu do ar continua no
  HTML e some por CSS, senão herdaria a margem entre blocos e abriria um vão.
- **`not-found.tsx` roda em página que responde 200.** O componente faz parte da
  árvore de layout e entra no pacote de navegação, então gravar 404 dali contava
  guia publicado como link quebrado: uma visita ao guia real somava três "404".
  O registro passou a sair do navegador (`RegistrarEndereco` + `/api/404`), que
  só dispara quando a página de erro apareceu de verdade para alguém.
- **Publicar mora em `src/lib/publicacao/publicar.ts`, não nas actions.** São três
  portas para o mesmo ato: botão do editor, botão da lista e o relógio do
  agendamento. A terceira não tem ninguém logado. Se cada porta tivesse a própria
  verificação, bastaria agendar para o conteúdo entrar no ar sem fonte e sem
  passar pelo analisador. As travas moram no núcleo e as três portas chamam ele.
- **Instrução de gesto se escreve pelo CONTATO, não pela ausência.** O medidor
  dizia "cresça até o escuro sumir", "sobrou escuro em volta" e "o dourado
  escapou por fora". Fora o duplo sentido que isso abriu, a frase pedia que a
  pessoa acompanhasse uma coisa que NÃO está lá. Virou "aumente o dourado até
  ele tocar a aliança", com os três estados em "Pequeno: ainda não toca",
  "Certo: toca a aliança" e "Grande: passou da aliança". Mesma checagem a olho,
  sem depender de sombra e sem margem para piada.
- **Desenho de medir não pode ter duas bordas.** O anel dourado do medidor era
  bonito e ambíguo: metade das pessoas encostava a aliança na borda de fora.
  Ferramenta de medida se desenha com UMA borda só, e com um estado final que a
  própria tela confirma ("o escuro sumiu"), nunca com um texto explicando qual
  linha vale.
- **Área que rola enquanto o desenho cresce anda sozinha debaixo da mão.** Na
  calibração, cada toque no controle recalculava a rolagem e a tela fugia com o
  objeto real encostado nela. Desenho que a pessoa vai medir se prende por
  âncora absoluta, e o que não couber muda de orientação, em vez de ganhar
  barra de rolagem.
- **Desenho que a pessoa ajusta não pode dividir altura com painel de texto.**
  No modo de medição, o painel de resultado ficava no fluxo e crescia quando o
  aviso de "entre dois tamanhos" aparecia. O palco era `flex-1`, então encolhia,
  e o disco SUBIA sozinho no meio da medição, com a aliança encostada na tela.
  Instrução e resultado agora flutuam por cima, o palco ocupa a etapa inteira e
  o centro do disco é uma fração da altura, que não muda nunca.
- **Dedo sozinho não lê como dedo, e vetor não faz pele.** O simulador de
  largura queimou três desenhos: retângulo com faixa, dedo único cortado
  embaixo, e três dedos com pele em degradê. Os dois primeiros erravam a
  composição (o que faz o olho reconhecer a cena é contexto: vizinhos, alturas
  diferentes, leque, mão se dissolvendo embaixo). O terceiro errava a
  linguagem: vetor tem teto para realismo de pele, e quase-real fica pior que
  assumidamente desenhado. A saída foi ilustração de traço, com o material
  guardado só para o produto. Não tentar a quarta rodada de realismo em SVG.
- **Cache que guarda o PADRÃO do código não deixa o código mudar mais nada.**
  `lerLayout` montava o layout de fábrica dentro do `unstable_cache` e devolvia
  ele junto. Como não existe linha de `pagina:home` no banco, o que ficava
  gravado era uma cópia do texto de fábrica, com `revalidate: false`, ou seja,
  para sempre: a única coisa que mata a entrada é o `revalidateTag('layout')`
  que só o admin dispara ao salvar. Reescrever o título da home no código não
  aparecia na tela, nem depois de recompilar, e parecia que a edição não tinha
  sido feita. Agora o cacheado é só a resposta crua do Supabase (`null`
  incluído) e o padrão é aplicado FORA do cache. Regra geral: dentro do cache
  vai o que veio do banco, nunca o que veio do código. Ao mexer nisso, troque
  também a versão em `keyParts`, senão a entrada velha continua respondendo.
- **Extensão do TipTap com `parseHTML` errado destrói conteúdo ao ABRIR.** O
  `CabecalhoDeTabela` tinha a regra copiada da tabela (`caption`, `table`) e
  nunca reconhecia `<th>`. Abrir um rascunho no editor achatava o cabeçalho numa
  célula só ("MaterialCorManutençãoFaixa de preço") e o salvamento automático
  gravava o estrago: foram as 30 tabelas dos rascunhos de 23/09. Nó novo no
  editor se testa abrindo HTML que já existe e comparando com o que volta.
- **Tabela não rola por `display: block` nela mesma.** Isso transformava
  `<thead>` e `<tbody>` em duas grades com colunas desalinhadas e espremia a
  `<caption>`. A rolagem mora na caixa em volta: `.tabela-rolavel`, posta ao
  servir por `comTabelasRolaveis` (`src/lib/conteudo/tabelas-html.ts`), e
  `.tableWrapper`, que o TipTap cria no editor.
- **`.conteudo-rico` é a MESMA classe no editor e no site publicado.** Mexeu nela, confira
  os dois lados, senão o preview passa a mentir sobre o que vai ao ar.
- **`.conteudo-rico` é um container CSS (`container-name: leitura`).** Bloco de dentro
  que muda de layout por largura usa `@container leitura`, **nunca `@media`**. Com
  `@media`, a vitrine de dois produtos ficava lado a lado no site e empilhada no
  editor na mesma janela, porque a coluna do editor é mais estreita que a do
  artigo. A tela do editor também é mais larga que o resto do painel, por
  `.painel-conteudo:has([data-painel-largo])`.
- **Coluna que existe não quer dizer trava que existe.** `comments.parent_id`
  estava lá desde a 0006, e a policy pública de inserção nunca olhou para ela:
  qualquer pessoa com a chave anônima (que vai no HTML) podia pendurar texto
  como resposta de um comentário, e a resposta é justamente o lugar onde o site
  fala em nome da JK. Fechado na 0036, junto com a policy que autoriza a
  resposta de verdade. Ao conferir o PAI dentro de uma policy da própria tabela,
  a subconsulta reentra na RLS e o Postgres levanta recursão infinita: por isso
  `comentario_e_raiz()` é `security definer` e devolve só um booleano.
- **`position: fixed` dentro de `.glass` não se ancora na janela.** O visor 3D
  ganhou tela cheia trocando o palco de `absolute` para `fixed`, e a tela cheia
  saiu do tamanho do CARTÃO, com a peça cortada: `backdrop-filter` (que é o que
  faz o `.glass`) cria bloco de contenção para descendente `fixed`, e o
  `overflow-hidden` do cartão ainda recorta o que sobra. A saída foi portal em
  `document.body` (`AliancaEm3D.tsx`), com o canvas MOVIDO para o palco novo
  (`mudarDePalco`) em vez de a cena ser remontada: remontar recompila shader,
  gera o ambiente de novo e devolve a peça ao ângulo inicial no meio do gesto.
- **No celular, girar disputa o gesto com rolar, e a peça perdia sempre.** O
  palco declara `touch-action: pan-y`, então o navegador fica com o vertical,
  mas o código começava a girar no `pointerdown`: quem arrastava para cima via a
  página descer e a aliança ficar parada, como se estivesse travada. Agora o
  PRIMEIRO movimento decide (`Gesto` em `AliancaEm3D.tsx`): saiu para o lado, a
  peça captura o ponteiro e a partir dali gira nos dois eixos; saiu para cima ou
  para baixo, ninguém mexe e a página rola. Em tela cheia é `touch-action: none`
  e o gesto é todo da peça, com pinça. Instruções de gesto no celular só valem
  depois de conferidas com dois dedos, e desenho de 19 rem de altura fixa deixa
  a peça do tamanho de uma moeda num aparelho de 390 px.
- **Ferramenta no navegador com saída no servidor mente sobre o que mostra.** A
  vitrine do simulador de largura ficava presa em 4 mm: a pessoa pedia 8 mm e a
  página continuava anunciando "Alianças de 4 mm", com preço de outra peça. A
  correção não foi tornar a página dinâmica: o HTML servido continua com a
  largura de maior volume dentro dele, e a troca acontece pelo navegador
  (`LarguraEscolhida.tsx` mais `/api/produtos/largura`, cacheada por largura).
  Regra que ficou: largura e produtos moram no MESMO estado
  (`VitrineDaLargura.tsx`), porque em estados separados um erro de rede deixa o
  título de 8 mm em cima do preço de 4 mm.
- **Preço do card de produto tem contrato entre dois arquivos.** `cartaoEmHtml()`
  (`src/lib/editor/VitrineNode.ts`) emite preço, preço antigo, selo e aviso como
  elementos **folha**, com `data-*-de="<id>"` e só texto dentro. É isso que deixa
  `aplicarPrecos()` (`src/lib/conteudo/precos-html.ts`) trocar o valor no servidor
  sem parser de HTML, para a página nunca anunciar preço velho. Se um desses
  elementos ganhar filho, a troca para em silêncio. O teste
  `npm run verificar:precos` roda junto do build e pega isso.
- **`shrink-0` em título é o que abre barra de rolagem horizontal no celular.**
  O cabeçalho de seção (título, filete e link) era uma linha de flex com
  `shrink-0` no título e no link, e no celular ele vazava a tela: a home ficava
  com 467 px de largura num aparelho de 375. Quem não encolhe também não quebra
  linha, então o título ficava travado na largura de conteúdo máximo. O arranjo
  que ficou tem três partes, e nenhuma resolve sozinha: `flex-wrap` no pai,
  `min-w-0` mais `break-words` no título (item de flex tem largura mínima igual
  à palavra mais longa, e uma trava a caixa enquanto a outra parte a palavra), e
  filete mais link dentro do MESMO div, senão o filete fica no fim da primeira
  linha apontando para o nada e o link cai sozinho na esquerda. São 7 cabeçalhos
  iguais, em `home/Secoes.tsx` (3), `dicas/page.tsx` (2), `lojas/page.tsx` e
  `lojas/[slug]/page.tsx`. A checagem é comparar `scrollWidth` com `clientWidth`
  do `documentElement` a 320 px e a 375 px, ignorando quem está dentro de
  container com `overflow-x` (carrossel de produto rola de propósito).
- **CSS fora de `@layer` vence utilitário do Tailwind, e `.eyebrow` estava fora.**
  O arquivo já registrava a armadilha para o seletor `a` (`globals.css`, comentário
  do `@layer base`), mas a classe `.eyebrow` continuava solta com
  `color: var(--color-brand-nav)`. Resultado: os oito pontos do site público que
  escrevem `eyebrow text-brand-light` para fundo escuro renderizavam em `#84663c`
  sobre carvão, 3,33:1, reprovado no WCAG AA. Pegava o rodapé inteiro, o CTA da
  home, a faixa do medidor em `/lojas`, o hero de `/ferramentas` e o "Passo N de 3"
  do modo de medição. O `font-size` sofria o mesmo, então os `text-[0.66rem]` das
  lojas nunca valeram. Agora `.eyebrow` mora em `@layer components`. Ao criar
  classe nova em `globals.css` que defina cor ou tamanho, ela vai dentro de um
  layer, senão o TSX perde o poder de sobrescrever e ninguém percebe.
- **`opengraph-image.tsx` NÃO desce para os segmentos de baixo.** A convenção vale
  para o segmento onde o arquivo está, e só. Na raiz de `app/` ele não alcançava
  nem a home, porque as páginas vivem em `(site)`; movido para dentro do grupo,
  passou a valer só para a home. Conferido no HTML do `next build`: `/dicas`,
  `/lojas`, `/ferramentas`, `/medidor-de-aliancas`, toda página de loja e toda
  página de autor saíam com `twitter:card: summary_large_image` e nenhum
  `og:image`, ou seja, card cego no WhatsApp, que é o canal desse mercado. A arte
  virou rota de endereço fixo (`(site)/og/route.tsx`, mais `[slug]/og` para a arte
  por guia) e quem escreve a tag é o `buildMetadata`, de uma vez para o site todo.
  Consequência: **metadata declarado vence arquivo de convenção**, então criar um
  `opengraph-image.tsx` novo agora não faz nada sem apontar para ele.
- **Sorteio por deslocamento em faixa contígua devolve vizinhança, não amostra.**
  A vitrine da home tirava dez produtos com `.order("name")` mais `.range` de
  início aleatório. Como a faixa é contígua e o catálogo estava ordenado por nome,
  saía sempre um pedaço do alfabeto: a home anunciava "Tudo sobre alianças" com
  nove anéis de formatura na vitrine. São duas correções, e uma sozinha não basta:
  filtro de categoria (`categories` por padrão de slug `alianca%`, 639 peças) e
  ordem por `id`, que é uuid e não tem relação com o nome.
- **`products` chega em `categories` por dois caminhos, e o PostgREST recusa o
  embed ambíguo.** Existem a chave estrangeira `products.category_id` e a tabela
  de ligação `product_categories` (que está VAZIA). Pedir `categories(...)` levanta
  `PGRST201`, e como o acesso a dados devolve `[]` no erro, o sintoma é seção
  sumida sem nenhuma mensagem. Escreva a chave por extenso:
  `categories!products_category_id_fkey!inner(slug)`.
- **`.conteudo-rico` é aplicado uma vez por PEDAÇO do corpo, não por artigo.** O
  corpo é cortado nos marcadores de ferramenta, então `> p:first-child` casava com
  o primeiro parágrafo depois de CADA ferramenta, como se o artigo recomeçasse
  ali. A mesma classe ainda veste a história da loja, o passo a passo das
  ferramentas e a tabela do comparador. A abertura de jornal agora pede a classe
  `abertura`, que só entra no primeiro pedaço de texto e só quando o guia não tem
  linha de apoio no cabeçalho.
- **Barra de progresso da rota tem que escutar o clique na CAPTURA.** O
  `next/link` chama `preventDefault()` no próprio clique para trocar a página
  pelo lado do cliente, então um ouvinte na fase de bolha recebe todo link
  interno já com `defaultPrevented` e desiste. A primeira versão de
  `BarraDeRota.tsx` era assim e nunca desenhou barra nenhuma, sem erro no
  console e sem nada quebrado: só não aparecia. Na captura passamos antes do
  React. O preço é não saber se alguém vai cancelar o clique depois, e por isso
  existe o prazo de `DESISTIR`.
- **Quem termina a espera é o `usePathname`, e ele só muda no commit.** Foi
  medido: em rota fria o caminho troca ao fim da navegação, não no clique. Nas
  rotas do admin, que têm `loading.tsx`, o commit é o esqueleto entrando, então
  a barra encerra exatamente quando o esqueleto assume. É a passagem de bastão
  que faz a espera parecer curta.
- **`loading.tsx` em rota dinâmica não é enfeite, é o que liga o prefetch.** O
  padrão do `next/link` (`prefetch` nulo) só busca de rota dinâmica até o
  primeiro `loading.tsx`. Sem esse arquivo, o Next não busca NADA antes do
  clique, para não puxar árvore demais, e a tela fica congelada na página
  anterior até o servidor responder. Com ele, o esqueleto já está na mão quando
  a pessoa clica.

- **Convite fora da lista de "Redirect URLs" cai no "Site URL", em silêncio.**
  O Supabase não recusa o `redirectTo` desconhecido: troca pelo Site URL do
  painel dele, que era `jk-portal-jk-alianca.vercel.app`. Era esse o "convite
  que cai na Vercel". Site URL certo é `https://www.jkaliancas.com.br/guias`, e
  a lista leva `https://www.jkaliancas.com.br/guias/**`. O log de auth mostra o
  destino usado no campo `referer`, e é o jeito de conferir sem mandar e-mail.
- **Convidado nascia INATIVO, por ordem de gravação no Supabase.** O trigger
  `handle_new_user` ativa quem tem `invited_at`, mas o Supabase insere o
  usuário e só preenche `invited_at` num UPDATE seguinte, depois do trigger de
  INSERT. Quem ativa agora é a ação `inviteUser` (service_role,
  `is_active: true`). Consequência: convite feito pelo painel do SUPABASE
  continua nascendo inativo. Convide sempre pelo `/admin/usuarios`.
- **Link de e-mail se gasta no ENVIO do formulário, nunca ao abrir a página.**
  Leitor de e-mail corporativo abre os links da mensagem para checar segurança,
  e com o `{{ .ConfirmationURL }}` padrão o robô gastava o convite antes da
  pessoa. Os modelos em `supabase/templates/` mandam `token_hash` para
  `/admin/senha`, e quem chama `verifyOtp` é a ação `definirSenha`. A mesma
  tela ainda entende o formato antigo (sessão depois do `#`), então trocar o
  modelo no painel não precisa ser sincronizado com o deploy, só vir depois dele.
- **Recuperação de senha usa cliente em fluxo IMPLÍCITO, não o do servidor.** O
  cliente de `lib/supabase/server` é PKCE, e em PKCE o link só funciona no
  navegador que pediu. Quem pede no computador e abre o e-mail no celular
  cairia em erro (`recuperar-senha/actions.ts`).
- **O GTM do portal é o da LOJA, e ele não tem GA4.** GTM-WWT3T789 carrega
  Google Ads e Pinterest. O GA4 da loja (G-9V89YVR635) vem da integração nativa
  da Tray, por gtag com fila própria (`dataLayerGa4`). A regra antiga do
  `Medicao` ("com GTM ligado, GA4 não carrega") partia de um GTM com GA4 dentro,
  e deixou o portal meses sem mandar nada ao GA4. Agora os dois carregam juntos,
  espelhando a loja, e tag de GA4 no GTM NÃO pode disparar em `/guias`.
- **UTM em link para a loja apaga o orgânico.** Mesmo domínio, mesma
  propriedade, mesmo `_ga`: a pessoa que veio do Google continua na mesma
  sessão ao clicar para a loja. `utm_source=portal` abria sessão nova e a venda
  virava "portal". A posição do clique saiu da URL e foi para o evento
  (`posicao`, lida de `data-regiao` no cabeçalho e no rodapé do site).
- **A Tray não apaga `promotional_price` quando a promoção acaba.** O campo
  fica preenchido com a janela vencida (`raw->>start_promotion`,
  `raw->>end_promotion`, formato `AAAA-MM-DD`, `0000-00-00` quando vazia) e a
  loja volta a cobrar o cheio. Em 24/09 eram 589 produtos com promocional
  guardado e 8 dentro da janela, e o portal anunciava "de 1.549,90 por
  1.399,90" com promoção de agosto de 2025. Todo preço que vai para a tela
  passa por `precoVigente` (`src/lib/tray/preco.ts`), com o dia de São Paulo e
  as duas pontas inclusivas. Consulta nova de produto que mostra preço precisa
  trazer as duas datas do `raw`.
- **Produto indisponível não entra em vitrine.** A Tray tira a página dele do
  ar (quatro de cinco caíam em "sem resultados na busca"), então o cartão
  anunciava preço de peça que a loja não vende e levava para página morta.
  Vitrine pede `status = available`, e o card no corpo do artigo fica só com
  "Sem estoque no momento".
- **A sincronização gravava produto por produto e morria na Vercel.** Eram
  mais de dois minutos, e em 24/09 ficaram 740 produtos com preço do dia e o
  resto com preço de agosto, sem nenhuma linha em `sync_logs` (o registro era
  feito no fim). Agora grava em lotes e só o que mudou (`sync_hash`, 0039):
  10 s na primeira rodada, 7 s nas seguintes. O `pg_cron` roda de 15 em 15
  minutos (0040) e a rota refaz as páginas quando um preço muda e na primeira
  rodada do dia, que é a que tira do ar a promoção vencida à meia-noite.

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

## Estado atual (18/09/2026)

🟢 **O portal está NO AR no domínio da JK: https://www.jkaliancas.com.br/guias**
A virada aconteceu em 17/09/2026. Os nameservers estão na Cloudflare, `www` é CNAME para
`1305187.tcdn.com.br` com o **proxy ligado**, e a rota `www.jkaliancas.com.br/guias*` vai
para o Worker `jk-guias`, que busca em `jk-portal.vercel.app`. Todo o resto do domínio
continua indo para a Tray, **sem passar pelo Worker**. É essa rota única que faz editar o
Worker não alcançar a loja.
**A fonte do Worker é versionada em `infra/cloudflare/worker.js`**, com o README ao lado.
Ele já se perdeu uma vez por existir só dentro da Cloudflare: o desvio de 404 que havia
nos testes sumiu e ninguém tinha como comparar o que rodava com o que se pretendia.
⚠️ **`jk-portal.vercel.app` continua respondendo, e isso é de propósito:** é a origem que
o Worker consulta. O que tira essa cópia do Google é o `X-Robots-Tag: noindex` que o
portal emite em TODA resposta e o Worker apaga na saída. Lido de fora parece invertido, e
é: a Vercel recebe `Host: jk-portal.vercel.app` mesmo no tráfego real (testado, com o host
da JK ela responde `DEPLOYMENT_NOT_FOUND`), então a aplicação **não tem como saber** por
qual endereço está sendo servida, e a decisão passa a ser do proxy. Explicado por extenso
em `next.config.ts`. A conferência é de uma linha, e a primeira é a que importa:
```bash
curl -sI https://www.jkaliancas.com.br/guias | grep -i x-robots   # vazio
curl -sI https://jk-portal.vercel.app/guias  | grep -i x-robots   # noindex
```
⚠️ **O `http` vira `https` dentro do Worker, e não pelo "Always Use HTTPS" da zona.**
Aquele botão vale para o domínio inteiro, e o domínio inteiro é a loja: um callback de
pagamento ainda apontado para `http://` perderia o corpo num 301. A loja já se vira
sozinha, porque a própria Tray desvia na origem.
🟢 **A loja aponta para o portal** desde 18/09: rodapé com três links e item "Dicas" no
menu, e o portal devolve com o botão "Comprar alianças" no cabeçalho. Antes disso a loja
não linkava `/guias` em página nenhuma, e o portal só era alcançável pelo sitemap.
O tema da loja vive em `~/Projetos/jk-tema-loja`, e **toda mudança lá precisa entrar nos
dois temas** (raiz e `Esquenta/`), como o `TEMAS.md` daquele repositório exige.
✅ **Público:** home, `/dicas`, `/[slug]`, `/lojas`, `/lojas/[slug]`, `/medidor-de-aliancas`, robots/sitemap/llms.txt, JSON-LD, compartilhamento.
✅ **Estrutura:** `src/app/(site)/` = público, `src/app/admin/(painel)/` = protegido, `src/app/layout.tsx` = só html/body/fontes.
✅ **Supabase:** 36 migrations aplicadas e em arquivo, 22 tabelas com RLS, bucket `media`.
✅ **Admin:** login por e-mail e senha (sem tela de cadastro; o endpoint de signup do Supabase ainda está aberto, ver Pendências), rotas protegidas por middleware, `noindex`, dashboard, usuários, mídia, comentários, produtos, métricas, integrações e lojas.
✅ **Convite e senha (24/09):** o convite leva para `/admin/senha`, onde a pessoa cria a senha e entra direto. "Esqueci minha senha" no login (`/admin/recuperar-senha`). Na lista de usuários, aviso de quem ainda não criou a senha e botão de reenviar. **Falta a parte do painel do Supabase** (endereços, modelos de e-mail, SMTP próprio), passo a passo em `docs/acesso-e-medicao.md`.
✅ **Medição (24/09):** GA4 carregado direto no portal, na mesma propriedade da loja (G-9V89YVR635), ligado em Integrações e conferido: portal e loja caem na MESMA sessão. Links para a loja sem UTM. Dimensões "Destino do clique" e "Posição do clique" criadas no GA4. **Falta marcar como evento-chave** `clique_whatsapp`, `clique_telefone`, `clique_rota` e `clique_waze` (o GA4 só deixa depois que o evento aparece na lista). O portal não precisa de nada no GTM (`infra/gtm/README.md`).
✅ **Editor de conteúdo:** blocos com TipTap, salvamento automático com detecção de conflito, modelos, links internos com busca, fontes com trava na publicação, canibalização determinística, preview de rascunho assinado, analisador SEO/GEO ao vivo e assistente de IA.
✅ **Inserção no editor (13/08):** botão `+` na margem, alinhado à linha do cursor, e comando por `/` no texto (filtra sem acento, setas, Enter, Esc). Tudo entra no ponto onde o cursor está, não no fim do artigo: linha vazia é substituída, linha com texto recebe o bloco logo abaixo. Linha de texto garantida no fim para bloco atômico não prender o cursor.
✅ **Vitrine de produtos (13/08):** de um a quatro produtos no mesmo bloco, em três formatos (vertical, quadrado, horizontal), com mover e remover por card. O card inteiro é o link. Conteúdo antigo (card solto `div[data-produto]`) sobe para vitrine ao abrir. O preço exibido sai da tabela `products` na hora de servir a página, não do que ficou gravado no texto.
✅ **Tray:** cliente só-leitura, sincronização com upsert por `tray_id`, webhook, 1.162 produtos. Funciona SEM credencial, pela busca pública. Roda sozinha de 15 em 15 minutos (`/api/cron/sincronizar-tray`, migration 0040) e refaz as páginas com preço quando algo muda (`revalidarPrecos`).
✅ **Medidor:** página clara e indexável mais **modo de medição em tela cheia** sobre carvão. Anel em SVG com manipulação direta (arrastar, pinçar, roda, teclado), objetos de calibração desenhados, tabela ligada ao resultado, `aria-valuetext` e `aria-live`. Fórmula: circunferência = aro + 40.
✅ **Design editorial (12/08):** capa de revista na entrada do artigo, corpo de jornal na leitura. Escala tipográfica fluida em `clamp()`, coluna de leitura em `ch`, vidro em três níveis (`.glass-sutil`, `.glass`, `.glass-escuro`), raios unificados nos tokens, componentes compartilhados em `ui/`, header com gaveta no celular.
✅ **Resposta rápida:** deixou de ser caixa de vidro e virou **linha de apoio editorial** (standfirst). Continua sendo o primeiro texto do artigo, então o GEO segue intacto. Não voltar ao formato de caixa: foi rejeitado explicitamente.
✅ **Capa por guia:** `content_media` com papel `hero`, com campo no admin e trava que recusa imagem sem alt ou sem dimensão. É o elemento LCP quando existe.
✅ **10 lojas físicas publicadas:** endereço, telefone/WhatsApp e link do Maps do site oficial; coordenada e place id resolvidos dos próprios links curtos. Página com galeria, mapa (OpenStreetMap, sem chave), rota por Maps e por Waze, horário dia a dia, serviços, história, avaliações e FAQ.
✅ **Alinhamento com a documentação de SEO do Google (12/08):** `max-image-preview:large`, `max-snippet:-1` e `max-video-preview:-1` em toda página indexável (sem isso o site ficava fora do Discover); `robots.txt` com `Disallow` repetido em cada grupo de bot de IA (grupo específico substitui o `*`, então o admin estava aberto para os seis agentes); canonical do `<head>` e `@id` do JSON-LD saindo da mesma função; 404 com `noindex, follow`, cabeçalho, rodapé e saídas, dentro do grupo `(site)`; relacionados vindo do grafo; `viewport` e verificação do Search Console. Sitemap sem `priority`/`changefreq` (o Google ignora os dois), com `lastmod` nas rotas fixas e extensão de imagem. `primaryImageOfPage`, `WebPage`, `ItemList`, `creditText`/`copyrightNotice` a partir do campo `credit`, `Product` só com preço real. **Páginas de autor** (`0018_autores.sql`) com `ProfilePage`, `/autor/[slug]`, tela `/admin/autores` e assinatura clicável. **Trava de publicação** para erros objetivos, nas duas portas. 7 regras novas no analisador. Blocos de figura com legenda, tabela com `<caption>` e `scope`, vídeo com `title`. Assistente que escreve o `alt` lendo a imagem. Preview do Google por largura em pixel, mais preview do card de compartilhamento. FAQ aberta no desktop, 410 com marca, headers de segurança e AVIF.
⚠️ **O que a documentação mudou e vale saber:** o rich result de **FAQ acabou em 07/05/2026** e o de **HowTo em 2023**. O markup dos dois continua no ar (custo zero, e Bing e as IAs ainda leem), mas não é mais argumento de busca no Google. O **`llms.txt` não é lido pelo Google** (confirmado em 15/06/2026), fica para os outros sistemas. E **não existe otimização separada para IA**: o guia de IA generativa diz que otimizar para busca generativa é SEO, e desmonta picotar conteúdo e depender de dados estruturados.
✅ **Motor de produção (13/08):** **base de fatos** (`facts`, tela `/admin/fatos`),
com o fato escrito uma vez e a linha de `sources` nascendo do gesto de citar no
editor, que é o que destrava a trava de publicação. **Fila de pautas**
(`briefings`, `/admin/pautas`) lendo `analytics_snapshots` e ordenando por
impressão alta com CTR baixo, com recusa de pauta que canibaliza página
existente, e "virar rascunho" que já preenche consulta alvo, modelo e produtos.
**Histórico de versões** com restaurar, que só reescreve os campos presentes no
retrato (retrato antigo não tem `authorId`, e escrever null apagaria a autoria de
hoje). **Agendamento** (`contents.scheduled_at`) disparado pelo `pg_cron` via
`pg_net` no endpoint `/api/cron/publicar`, passando pelas MESMAS travas, com o
motivo da recusa em `scheduled_error`. **Calendário** em `/admin/calendario`.
**Redirects** em `/admin/redirects`, com a fila de endereços quebrados
(`not_found_hits`) e palpite de destino por semelhança de slug.
**Blocos novos no editor:** resumo em destaque, passo a passo (`data-passos`),
FAQ no corpo (que soma ao `FAQPage` junto do campo antigo, via
`src/lib/content/faq-html.ts`) e chamada para ação com `data-evento`.

✅ **Ferramentas (13/08):** registro em `src/lib/ferramentas/registro.ts`, no
espírito de `blocos/tipos.ts`. Cada ferramenta se declara uma vez e dela saem a
página `/ferramentas/[slug]` (resposta primeiro, `HowTo`, `FAQPage`), a entrada
no sitemap e no `llms.txt`, o item no menu do editor e o bloco embutido no
artigo. Duas ferramentas no ar: **conversor de tamanhos** (aro brasileiro, EUA,
ISO 8653, circunferência e diâmetro), com a matemática em
`src/lib/medidor/conversao.ts` conferida contra a tabela americana publicada, e
**simulador de largura** (`src/lib/medidor/larguras.ts`), que desenha 2 a 8 mm em
tamanho real reaproveitando a calibração do medidor e fecha com peças reais
daquela largura vindas de `product_variants.width_mm`, e **comparador de
materiais**, que separa por ORIGEM: teor sai de definição metrológica (fato
aprovado), faixa de preço sai da view `aliancas_por_material` sobre o catálogo
sincronizado, e durabilidade e garantia só aparecem quando a JK aprovar o fato.
A **pré-visualização de gravação** não foi construída: é a única das quatro sem
nenhum dado próprio, e as perguntas para a JK ficaram registradas como fatos em
`validar` (migration 0033).
O medidor continua em `/medidor-de-aliancas`, sem mexer na URL que já tem
histórico de busca.

✅ **Ferramentas na navegação e home nova (13/08):** as quatro ferramentas
aparecem pelo nome no cabeçalho (painel no desktop, cartões na gaveta do
celular) e no rodapé, tudo saindo de `itensDeFerramenta()` no registro, então
ferramenta nova entra nos três lugares sem caçada. Emblema próprio de cada uma
em `src/components/ferramentas/Simbolo.tsx`, em traço e `currentColor`, do menu
de 16 px à marca d'água de 224 px no cartão. A home `/ferramentas` deixou de ser
índice de blog: abre em painel carvão com a resposta primeiro e segue em cartões
com emblema, marca d'água e cara de aplicativo, sem perder `ItemList`.

✅ **Medidor sem ambiguidade (13/08):** o desenho de medir era um ANEL, e anel
tem duas bordas, então ninguém sabia qual encostar. Virou **disco cheio**
(`Disco.tsx`), de uma borda só, e o gesto virou verificável a olho: crescer até
o escuro em volta sumir. A instrução (`ComoApoiar.tsx`) mostra os três estados
desenhados e **flutua sobre o palco**, aberta na primeira vez e recolhida
sozinha no primeiro arrasto. A calibração não rola mais: o objeto é posicionado
por absoluto, preso ao mesmo eixo do título, e o cartão entra **em pé** (medido
pelos 53,98 mm do padrão ID-1) quando os 85,6 mm não cabem na tela.

✅ **Simulador de largura em ilustração de traço (14/08):** o desenho passou por
quatro versões descartadas (faixa sobre retângulo, dedo sozinho, três dedos com
pele em degradê, três dedos em traço soltos no ar) antes de fechar em `Dedo.tsx`
como está: **mão** em linha editorial, com contorno fino, preenchimento chapado
e sombra chapada, no espírito de ilustração de anúncio. O contorno é a UNIÃO das
peças, feita com o truque das duas passadas (tudo com traço grosso da cor da
linha, depois tudo de novo só com o preenchimento), porque SVG não tem operação
booleana: sem isso a borda da mão atravessava os dedos. A única coisa renderizada
como material é a aliança, e ela é **reta**, porque a curvatura de anel visto de
cima atrapalhava a única coisa que a ferramenta precisa entregar, que é comparar
largura. Continuam valendo os três dedos (só o do meio carrega a medida) e a
silhueta gerada por perfil de meia largura.
Tem **escolha de metal** (ouro amarelo, ouro rosé, ouro branco e prata 925), e
cada metal é uma sequência de paradas de cor em `MATERIAIS`, não uma cor só: o
que faz o olho ler metal polido é a alternância dura entre borda escura, estouro
de luz quase branco e meio-tom, mais um corte seco no meio da altura, que é o
céu refletido em cima e o chão embaixo. As mesmas paradas alimentam o desenho, a
bolinha do seletor e a barra da comparação, via `gradienteDoMaterial()`.
Atalho `/medidor-de-aliancas?calibrar=1` abre o medidor direto na escolha do
objeto, e o simulador linka para ele. O parâmetro é lido de `window.location`,
não de `useSearchParams`, para a página não virar dinâmica.

✅ **Revisão de linguagem e de nomes (14/08):** varredura em todo texto visível,
com as regras novas na seção 1 do `REGRAS.md`. Saíram os dois duplos sentidos
("Prove no dedo" e "O tamanho certo, resolvido na tela"), a frase que ninguém
fala ("Tudo sobre alianças, respondido direto") e o nome que ninguém busca
("Guias de alianças"). A home abre em "Tudo sobre alianças de casamento e
namoro", a lista virou "Últimos posts", o índice virou "Dicas sobre alianças"
(a URL era `/guia` e hoje é `/dicas`, ver a seção de produção), a ferramenta
virou **Medidor de aliança** em todo lugar,
e "portal" virou "site" na tela. Os padrões de fábrica em `blocos/tipos.ts` são
o que a home serve hoje, porque **não existe layout gravado** em
`site_settings` (chave `pagina:home` ausente); no dia em que alguém salvar pelo
`/admin/home`, o texto gravado passa a mandar. A página do medidor ainda
descrevia o **anel** dourado antigo, de duas bordas, e foi reescrita para o
disco. E o 404 da RAIZ, que é o que responde a link velho de fora, entrava sem
cabeçalho, sem rodapé e sem saídas: as duas portas de 404 agora renderizam
`components/erro/Pagina404.tsx`.

✅ **Aliança em 3D no comparador de materiais (14/08):** visor WebGL
(`AliancaEm3D.tsx`) no topo de `/ferramentas/materiais-de-alianca`, com a peça
girando por arraste, teclado e inércia. **Sem arquivo `.obj`.** A malha nasce de
`src/lib/aliancas/perfis.ts`: aliança lisa é sólido de revolução, então o
contorno em milímetros vira `LatheGeometry`, e o MESMO contorno vira o desenho
do corte em SVG (`CorteDaAlianca.tsx`), que nunca discorda do 3D. Malha pronta
congelaria largura, espessura e aro dentro do arquivo.
São **dois eixos independentes**, como a JK vende: **modelo** é a face de fora
(abaulada, chanfrada, polida, fosca) e **formato** é o lado do dedo (reta,
anatômica). Existe abaulada anatômica, chanfrada reta e assim por diante. Uma
lista única de quatro nomes escondia isso. O catálogo confirma: "abaulada",
"chanfrada" e "reta" aparecem no nome dos produtos e "anatômica" aparece em 49
descrições, sempre ao lado da largura, nunca como formato concorrente.
Materiais saem da MESMA view do banco que alimenta a tabela (`aliancas_por_material`),
e só a aparência mora em código (`src/lib/aliancas/metais.ts`). Prata com ouro
renderiza em dois tons, com um filete lateado por cima da face de fora.
**Polida e fosca têm a mesma geometria**: o que muda é o acabamento, que é mapa
de aspereza e mapa de relevo gerados em canvas, com risco fino no sentido da
volta da peça. Sem o risco, fosco vira cinza chapado com cara de plástico.
O three.js entra por `import()` só quando o bloco chega na tela, então
`/ferramentas/[slug]` continua em 123 kB de First Load JS e a tabela segue
servida pelo servidor, sem depender de JavaScript.
⚠️ **Palco claro, nunca escuro.** A primeira versão era carvão e foi rejeitada:
"ficou MUITO escuro". O fundo é marfim quente com halo dourado, e o contraste
que o metal precisa mora DENTRO do mapa de ambiente (faixa escura no chão do
reflexo), não no fundo da página.
⚠️ **Metal com `metalness: 1` e sem `scene.environment` renderiza PRETO.** O
ambiente é desenhado num canvas (céu claro, corte seco no horizonte, dois
painéis de luz, rebote quente embaixo) e passa por `PMREMGenerator`, sem baixar
HDR de terceiro.
O volume de metal na tela é geometria exata, por Pappus (`volumeDeMetal`), não
estimativa: é a resposta de "essa é mais grossa" sem inventar peso nem preço.

✅ **Mobile do comparador e vitrine que responde (17/08):** o visor 3D em
`/ferramentas/materiais-de-alianca` ganhou **tela cheia** (portal, `touch-action:
none`, pinça, faixas de controle que rolam de lado) e arbitragem de gesto no
palco embutido, que era o defeito: tentar girar rolava a página. O palco embutido
no celular passou de 19 rem fixos para quase quadrado
(`min-h-[min(86vw,26rem)]`), e a folga de enquadramento caiu de 1,42 para 1,18,
então a peça é bem maior sem risco de corte. A vitrine do **simulador de
largura** deixou de ficar presa em 4 mm e acompanha o mm escolhido, meio segundo
depois do último clique. E `/guia` virou **"Dicas de alianças e joias"** (título
da aba com semijoia), porque o escopo da página é material, joia, semijoia, uso e
cuidado, e o título antigo prometia menos do que a página entrega. A URL era
`/guia` na época e hoje é `/dicas`.

✅ **Resposta da loja no comentário (17/08):** o fio de conversa tem UM nível,
comentário do visitante e resposta da casa embaixo, e responder é só de admin,
com a trava no banco (`comments_admin_reply`) e não só na tela. A resposta é
assinada como **JK Alianças** para quem lê e pelo `author_profile_id` para quem
presta contas dentro de casa, e sai com selo próprio (`Balao` em
`components/comentarios/Comentarios.tsx`). Responder um comentário que ainda
estava na fila **publica ele junto**, senão a resposta ficaria pendurada numa
pergunta que o site não mostra. Resposta cujo pai saiu do ar não sobe para a
lista de cima: `comentariosAprovados` monta o fio e descarta órfã. Quem escreveu
uma resposta errada apaga por `apagarResposta`, que só encosta em linha com
perfil, ou seja, nunca em comentário de visitante.

✅ **Resposta ao clique (18/08):** o painel não dava sinal nenhum entre clicar
e a página aparecer, o que fazia rota de 300 ms parecer site travado e levava a
pessoa a clicar duas vezes. São três camadas, e cada uma cobre um pedaço da
espera. **Barra de progresso** no topo (`components/ui/BarraDeRota.tsx`, montada
no layout raiz), que vale para o site e para o admin, aparece só depois de 90 ms
(navegação instantânea não pisca barra) e nunca enche sozinha, porque barra que
chega ao fim antes da página promete o que não pode cumprir. **Giro no item do
menu** do admin, por `useLinkStatus` dentro do próprio Link, que responde em
zero e diz QUAL item foi clicado. **Esqueleto por rota**, em
`admin/(painel)/loading.tsx`, em `admin/(painel)/conteudos/[id]/loading.tsx` (o
editor, que é a rota mais pesada) e em `(site)/busca/loading.tsx` (a única
rota pública que consulta o banco a cada visita). O botão "Sair" do cabeçalho
do painel era o último sem estado de espera e ganhou `useFormStatus`.

✅ **Search Console automático (24/09):** conta de serviço do Google (`GSC_SERVICE_ACCOUNT_JSON`, sem OAuth e sem biblioteca do Google), importação toda segunda pelo `pg_cron` (0038) e botão "Importar agora" em Métricas. Grava no mesmo formato da planilha, e as leituras de `analytics_snapshots` passaram a ser paginadas (`lib/data/snapshots.ts`): o Supabase entrega no máximo 1.000 linhas por pedido e cada consulta ocupa quatro. **Ligado em 24/09:** projeto `jk-portal-509621` no Google Cloud (conta jkaliancasmkt), conta de serviço `portal-search-console@jk-portal-509621.iam.gserviceaccount.com` como Restrita no Search Console, primeira importação com 1.000 consultas e 1.000 páginas. Se o quadro de Métricas acusar "falta a variável" logo depois de salvar na Vercel, é Redeploy feito antes de salvar (aconteceu na primeira vez).
🔲 **A construir:** conteúdo (o gargalo de resultado) e a leitura do GMB.
🚨 **A pendência mais séria hoje é o plano da Vercel.** A conta que hospeda o `jk-portal`
está em **Free (Hobby)**, confirmado em 18/09. Hobby é para uso **não comercial**, e hoje
ele serve o domínio de uma loja que vende. Não é questão de fatura, é motivo de suspensão,
e se a Vercel agir o `/guias` sai do ar inteiro. O time `Agencia Setup` já está em Pro, já
é pago, e não tem projeto com esse nome, então mover para lá não custa assinatura nova.
**Ao mover, conferir se `jk-portal.vercel.app` continua respondendo**, porque é o destino
escrito no Worker; se mudar, ajustar `infra/cloudflare/worker.js` e republicar.
✅ **Cron do agendamento resolvido em 18/09:** `site_settings.cron` está preenchido com
`https://jk-portal.vercel.app/guias`, apontando direto para a Vercel para o cabeçalho do
segredo não depender do Worker. O SQL faz `url || '/api/cron/publicar'`.
⚠️ **Pendências:** **Supabase ainda com Site URL da Vercel e SMTP de teste** (só entrega
para membro do time do projeto no Supabase), ver `docs/acesso-e-medicao.md`. O `AW-AW-16750399342` do GTM é
conhecido e **não se corrige** (Trello WM-025: contaria compra em dobro com a conversão
nativa da Tray); regras do contêiner em `infra/gtm/README.md`. **Desligar o cadastro público no painel do Supabase**
(Authentication → Sign In / Providers → "Allow new users to sign up"), que hoje
está ligado e é a única parte da falha de 0020 que não dá para fechar por
migration. Trocar a senha temporária do master e rotacionar a chave da OpenAI.
Ligar "leaked password protection" no Supabase.
O advisor acusa `pg_net` instalado no schema `public`: fica assim de propósito,
porque a extensão **não aceita `set schema`** e a única saída seria derrubar e
recriar, o que quebraria a publicação agendada por uma advertência cosmética.
As funções dela vivem em `net`, que é onde o cron as chama. Projeto sem `eslint.config.js`,
então o lint não roda. **Cadastrar o webhook da Tray** no painel da loja, apontando para
`https://www.jkaliancas.com.br/guias/api/tray/webhook?secret=SEU_SEGREDO`.
⚠️ **Sitemap da LOJA tem cerca de 156 URLs mortas** (medido em 18/09, amostra de 180 das
1.217: 12,8% redirecionam). São produtos removidos que o gerador da Tray ainda lista, e
cada um gasta dois saltos até `/sem-resultados-na-busca`, que é `noindex`. Não suja o
índice, queima orçamento de rastreamento. Decidido não mexer agora. Registrado no card
"04 — HOST, HTTPS, CANONICAL, SITEMAP E REDIRECTS", com o experimento a testar.
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
