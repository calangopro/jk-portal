# ESTADO.md, onde o Portal JK está e para onde vai

> Documento de situação, atualizado em 19/08/2026.
> Para as regras de escrita e de construção, leia [`REGRAS.md`](REGRAS.md).
> Para a visão e a estratégia, leia [`PROJETO.md`](PROJETO.md).
> Para operar o projeto no dia a dia, leia [`CLAUDE.md`](CLAUDE.md).

## Em uma frase

O portal está **no ar**, em domínio temporário da Vercel: https://jk-portal.vercel.app/guias

O site público funciona e parece publicação, não landing page. O admin é uma fábrica de
conteúdo com trava de qualidade na publicação. As 10 lojas reais estão no ar, e quatro
ferramentas próprias respondem as perguntas que levam alguém a comprar aliança.

O que falta não é software. É **conteúdo**, que tem um guia publicado, são os
**materiais da JK**, e é a **virada para o domínio da loja**, que está parada esperando
o acesso ao Registro.br.

---

## 1. O que existe hoje

### Site público

| Rota | O que faz |
|---|---|
| `/` | Home com um guia em destaque, prova da marca, vitrine de produtos e chamada do medidor. Seções e textos editáveis pelo admin |
| `/dicas` | Índice agrupado por assunto, com capa, data e tempo de leitura |
| `/[slug]` | Artigo com cabeçalho editorial, capa, índice que acompanha a rolagem, FAQ em acordeão, comentários com resposta da casa e compartilhamento no fim |
| `/lojas` | As 10 unidades agrupadas por cidade, com rota e WhatsApp no próprio card |
| `/lojas/[slug]` | Página completa da unidade: galeria, mapa, horário dia a dia, serviços, história, avaliações e FAQ |
| `/medidor-de-aliancas` | Página clara e indexável, com o modo de medição em tela cheia |
| `/ferramentas` | Índice das ferramentas, em painel escuro com cara de aplicativo |
| `/ferramentas/[slug]` | Conversor de tamanhos, simulador de largura e comparador de materiais, com aliança em 3D |
| `/autor/[slug]` | Página por autor, com `ProfilePage`, ligada à assinatura do artigo |
| `/busca` | Busca no site por palavra e por significado, com sugestão enquanto digita |
| `/preview/[token]` | Preview de rascunho, com noindex |
| 404 e 410 | Com cabeçalho, rodapé e saídas. Endereço quebrado vira fila de redirect no admin |
| `robots.txt`, `sitemap.xml`, `llms.txt` | Descoberta por buscador e por IA |
| `/og` e `/[slug]/og` | Imagem de compartilhamento, própria por guia, escrita pelo metadata |

Dados estruturados emitidos: `Organization`, `WebSite`, `Article`, `BreadcrumbList`,
`FAQPage`, `JewelryStore`, `HowTo`, `ItemList`, `ProfilePage`, `WebPage` e `Product`. O
`Product` só sai com produto real sincronizado da Tray. O `AggregateRating` da loja
existe no código, mas só aparece com nota real e origem registrada, e há constraint no
banco que recusa nota sem fonte.

### Onde ele vive

O aplicativo roda sob `basePath: "/guias"`, porque `www.jkaliancas.com.br` continua
sendo da loja Tray. Nada é pedido na raiz do domínio: rota, `/_next/*`, `/api/*` e
arquivos de `public/` já nascem dentro do prefixo. Hoje isso responde no endereço
temporário da Vercel, e a virada para o domínio da JK é configuração de Cloudflare, não
é mexer no portal. O detalhe está em [`DEPLOY.md`](DEPLOY.md) e na seção de produção do
[`CLAUDE.md`](CLAUDE.md).

### Admin

| Rota | O que faz |
|---|---|
| `/admin` | Contadores reais |
| `/admin/pautas` | Fila de pautas lendo o Search Console, ordenada por impressão alta com CTR baixo |
| `/admin/conteudos` | Lista agrupada por assunto, com rascunho, publicado, duplicar, arquivar e relatório de páginas órfãs |
| `/admin/conteudos/[id]` | O editor, com histórico de versões e restaurar |
| `/admin/calendario` | Quando cada coisa sai |
| `/admin/fatos` | Base de fatos com fonte, que é o que destrava a publicação |
| `/admin/midia` | Biblioteca de imagens com alt obrigatório e contagem de uso |
| `/admin/comentarios` | Fila de moderação e resposta da casa |
| `/admin/autores` | Quem assina, ligado à página pública de autor |
| `/admin/produtos` | Sincronização com a Tray e histórico |
| `/admin/lojas` | NAP, horário e trava de publicação sem endereço |
| `/admin/metricas` | Search Console por importação de CSV |
| `/admin/integracoes` | GTM, GA4, GSC e GMB |
| `/admin/redirects` | Redirects e a fila dos endereços quebrados que alguém abriu |
| `/admin/home` | Seções da página inicial |
| `/admin/aparencia` | Cores e cantos do site |
| `/admin/usuarios` | Convite, papéis, ativar e desativar |

### Banco

36 migrations, todas em arquivo e todas aplicadas, sem deriva. 22 tabelas com RLS,
bucket `media`, 1.110 produtos sincronizados da Tray pela busca pública sem credencial
de integração, e as 10 lojas físicas publicadas com coordenada e link de rota.

Duas falhas de permissão foram encontradas e fechadas no caminho. A primeira: as
policies de escrita originais usavam `to authenticated using (true)`, e com o cadastro
público do Supabase ligado qualquer pessoa criava conta com a chave anônima, que vai no
HTML, e ganhava escrita, inclusive em `redirects`, que o middleware serve em toda
requisição. A segunda: `comments.parent_id` existia desde a 0006 e a policy pública de
inserção nunca olhou para ela, então dava para pendurar texto como resposta, que é
justamente onde o site fala em nome da JK.

---

## 2. Rodada de fundação, agosto de 2026

> Daqui até a seção 2c é registro histórico, em ordem. Serve para entender por que as
> coisas são do jeito que são, não para saber o estado de hoje: isso está na seção 1.

O plano de melhoria tinha sete fases. Nesta rodada fecharam as fases 1, 3 e 4. A fase 2,
que é domínio e deploy, foi adiada na época para manter o foco na estrutura, e acabou
saindo depois: o portal está publicado, e o que sobrou dela está na seção 4.5.

### Fase 1, parar o sangramento

O projeto estava publicando dado falso e quebraria num deploy limpo.

**Migrations reconciliadas.** Seis migrations existiam só no banco. Um deploy do zero
teria quebrado, porque o código usava colunas que nenhum arquivo criava.

**Fallback de exemplo removido.** Quando a consulta de lojas falhava, o site servia
"Endereço a confirmar, PLACEHOLDER" dentro do `JewelryStore`. Ou seja, envenenava com
dado inventado exatamente o sinal em que o SEO local de 10 lojas se apoia. Agora vazio é
estado vazio, erro é erro, e conteúdo de exemplo só roda fora de produção.

**Contraste corrigido.** O dourado dos links do corpo dava 3,68:1, abaixo do mínimo
legível. Trocado para `#84663c`, que dá 4,81:1 e passa em AA.

**Travessão eliminado da cópia pública.** O analisador marcava travessão como erro e o
próprio site usava em sete lugares, incluindo o subtítulo da home. Regra que o produto
descumpre não é regra.

**Tabela `redirects` sendo servida.** Existia desde a primeira migration e nunca tinha
sido lida. Agora o middleware responde 301, 302 e 410. É rede de segurança obrigatória
em qualquer troca de endereço.

**Tela de lojas.** Antes o NAP só dava para editar por SQL.

### Fase 3, velocidade e compartilhamento

**Fontes auto-hospedadas** com `next/font`, sem nenhuma chamada ao Google. O
`<link rel=stylesheet>` do CDN bloqueava a renderização.

**Animação removida do h1 da home**, que é o elemento LCP e começava invisível.

**Imagens com `width` e `height` reais**, vindos da tabela `media`, inclusive em
conteúdo antigo. Mais `fetchpriority` na primeira e `lazy` nas demais. Isso acaba com o
salto de layout em todo artigo com imagem.

**Imagem de compartilhamento própria por guia**, com o título e a resposta rápida. Antes
o site inteiro compartilhava a mesma arte, então um link de guia no WhatsApp parecia
igual ao da home.

**Ordem no celular corrigida.** Índice, medidor, relacionados e chamada das lojas caíam
depois dos comentários. Todo o aparato de conversão ficava invisível justamente onde
está a maior parte do tráfego.

**Entidade consolidada.** `Organization` com `@id`, logo como `ImageObject`,
`contactPoint` e quatro perfis reais em `sameAs`. `Article` com `@id`, `isPartOf`,
`inLanguage` e imagem como `ImageObject`. `JewelryStore` com `parentOrganization`.
O grafo agora é conectado: `Article` aponta para `WebSite`, que aponta para
`Organization`, que aponta para os perfis oficiais. É assim que um modelo de linguagem
decide que a JK é autoridade em aliança, em vez de ler páginas soltas.

### Fase 4, o editor como fábrica

**Salvamento automático** cinco segundos depois de parar de digitar, aviso ao fechar a
aba com alteração pendente, e detecção de conflito por `updated_at`. Se outra aba salvou
por cima, o editor para e deixa escolher entre recarregar e sobrescrever. Antes, fechar
a aba perdia tudo em silêncio.

**Canibalização determinística.** Roda no navegador a cada tecla, sem IA. Consulta alvo
igual é erro, assunto com 70% de palavras em comum é alerta. A checagem antiga dependia
da IA olhar uma lista de títulos, o que custava dinheiro, demorava e não dava o mesmo
resultado duas vezes.

**Fontes com trava real na publicação.** A regra fundadora diz que toda afirmação
factual precisa de fonte registrada, e regra que ninguém verifica não existe. Agora
publicar sem nenhuma fonte é recusado. A trava vale também para o botão Publicar da
lista, porque duas portas para a mesma coisa com regras diferentes é como a regra morre.

**Quatro modelos de conteúdo**: pilar, artigo de dúvida, comparativo e página de cidade.
Cada trecho a preencher começa com "Escreva aqui", e o analisador marca isso como erro,
então nenhum esqueleto vai ao ar por descuido.

**Biblioteca de mídia dentro do editor**, gravando `content_media`. Antes só dava para
subir arquivo novo, e a mesma foto acabava no bucket três vezes, cada cópia com um alt
diferente. Imagem sem alt aparece marcada e não entra no conteúdo.

**Seletor de link interno** com busca real, mostrando slug e consulta alvo. Antes era um
prompt pedindo para digitar o caminho de cabeça, que errava calado quando a página
não existia. O link entra também no grafo `content_links`, e é dele que saem os
relacionados no fim do artigo e o relatório de páginas órfãs.

**Cluster e pilar.** Campo de assunto com sugestão dos assuntos já usados, campo de guia
pilar, lista de conteúdos agrupada por assunto, e relacionados caindo para o mesmo
cluster quando o grafo de links ainda não basta.

**Preview de rascunho** por URL assinada com HMAC, com noindex e barrado no
`robots.txt`. O token não virou coluna de propósito: não ocupa linha, não vaza numa
leitura de tabela e some todo de uma vez se o segredo for trocado.

**Revalidação na publicação.** Home, sitemap e `llms.txt` saem na hora. Antes o sitemap
levava até uma hora para incluir conteúdo novo, e é justamente nas primeiras horas que
interessa o Google descobrir a página. Mais IndexNow quando houver chave.

---

## 2b. Rodada de UX, UI e lojas, 12/08/2026

Você olhou o portal e disse que estava "amador e básico", que a resposta rápida
atrapalhava a leitura, que faltava banner abaixo do título e que a página do medidor
estava feia. Depois pediu as 10 lojas físicas, com mapa, rota e galeria.

### O partido: capa de revista na entrada, corpo de jornal na leitura

A régua adotada foi simples: quem chega pelo Google precisa bater o olho e pensar
"isso é fonte séria de joalheria", não "isso é uma landing page".

### Base do sistema visual

**Escala tipográfica fluida em `clamp()`** declarada nos tokens, no lugar dos
`text-4xl sm:text-5xl` soltos, que faziam cada página inventar a própria hierarquia.
Coluna de leitura medida em `ch`, não em `max-w-2xl` repetido.

**Vidro em três níveis.** Existia uma classe `.glass` só, usada com a mesma força num
FAQ, numa sidebar e num painel de resultado, o que achatava a hierarquia. Agora
`.glass-sutil` para blocos dentro do texto, `.glass` para painéis e `.glass-escuro`
sobre carvão, que é o único lugar onde o dourado da marca consegue brilhar.

**Raios unificados.** Havia oito valores arbitrários disputando o mesmo papel, de
`rounded-[10px]` a `rounded-[28px]`, enquanto os tokens `--radius-*` existiam e eram
ignorados.

**Componentes que faltavam.** O `Button` só sabia virar link, e por isso quatro arquivos
reescreviam as classes de botão na mão, cada um divergindo um pouco. Agora ele aceita
`onClick`, tamanho, ícone e estado de carregando. Mais `Card`, `Pill`, `Acordeao`,
`Trilha`, `Figura` e `FaqLista`, que eliminaram as cópias de card, breadcrumb e FAQ
espalhadas por três páginas.

**Header com menu no celular.** Antes os três links ficavam sempre visíveis, o que só
funcionava por sorte com três itens curtos. Gaveta com foco preso, Esc e rota ativa.

### Página de guia

**A resposta rápida saiu da caixa.** Era um bloco de vidro plantado entre o título e o
texto: servia à IA e atrapalhava a pessoa. Virou linha de apoio editorial, no formato
de standfirst de jornal. Continua sendo o primeiro texto do artigo, então a regra de
resposta primeiro do `REGRAS.md` e a extração por IA seguem intactas. Mudou só o peso
visual.

**Assinatura subiu.** Autor, revisor, data de publicação, atualização e tempo de leitura
agora abrem o artigo. O "Por {autor}" ficava no fim, depois dos comentários, onde não
serve de sinal de E-E-A-T para ninguém.

**Capa por conteúdo.** A infraestrutura estava pronta e parada desde a migration 0004:
`content_media` com papel `hero` e a tabela `media` com alt, crédito, dimensão, ponto
focal e LQIP. Faltava alguém ler e faltava campo no admin, do mesmo jeito que o
`og_image_url` era inalcançável pela redação. Agora existem os dois, com trava de
servidor que recusa capa sem alt ou sem dimensão. O recorte é 16/9 só em imagem larga,
4/3 no resto, senão foto de joia quadrada sai decapitada.

**Corpo do artigo** com filete dourado acima de cada H2, tabela com zebra e rolagem
própria no celular, e citação com aspa dourada. A classe `.conteudo-rico` é a mesma do
editor, então o preview continua fiel.

**Índice que acompanha a leitura**, e no celular ele virou barra recolhível logo abaixo
do cabeçalho. Antes só existia na coluna lateral, que no celular cai depois de todo o
texto: índice no fim do artigo não navega nada.

**Compartilhar saiu do topo**, onde pedia que a pessoa compartilhasse algo que ainda não
tinha lido.

### Medidor de aliança

Eram seis cards de vidro brancos empilhados, com um círculo de `border-radius` movido
por slider, e três blocos de texto antes de a pessoa chegar na ferramenta. O `HowTo` do
schema prometia "ajuste o círculo até encostar na aliança", uma manipulação direta que a
interface nunca entregou.

**Modo de medição em tela cheia** sobre carvão, com Esc, foco preso e transição entre
etapas. A página continua clara e indexável, então `HowTo`, `FAQPage` e o conteúdo de
SEO não mudaram de lugar.

**O anel virou joia**: SVG com gradiente de metal, brilho especular e sombra projetada.

**Manipulação direta, enfim.** Arrastar a borda, pinçar com dois dedos, roda do mouse e
setas do teclado. Medido na verificação: 4 px de arrasto deram exatamente os 2,11 mm
esperados, e 10 px de pinça deram os 2,63 mm. O controle deslizante continua, como
garantia de precisão e de acessibilidade.

**Objetos de calibração desenhados**, moeda de 1 real bimetálica e cartão com chip, no
lugar dos ícones genéricos de linha. E o desenho do cartão parou de estourar a tela:
a 3,8 px/mm ele nascia com 325 px e não cabia em 375 px de viewport.

**Acessibilidade que faltava** e estava listada na 4.7: `aria-valuetext` nos controles
("Aro 26, 21,09 milímetros de diâmetro") e `aria-live` no resultado. Antes quem usa
leitor de tela nunca ficava sabendo o aro.

**A tabela de aros conversa com o resultado.** Ao fechar a medição, a linha do aro
medido fica destacada. Antes estavam na mesma tela e não se falavam.

**A calibração salva ganhou contexto.** O campo `largura` era gravado e nunca lido, e um
comentário no código prometia um aviso de recalibrar que não existia. Agora a página
mostra com que objeto foi calibrado e avisa quando a tela mudou de tamanho.

### As 10 lojas físicas

**Dados reais, com procedência.** Endereço, telefone e WhatsApp saem de
`jkaliancas.com.br/lojas-fisicas`. As coordenadas e os place ids vieram de resolver os
próprios links `maps.app.goo.gl` e ler a URL final, então são as coordenadas exatas das
fichas do Google. Nove lojas têm coordenada; Tamboré não tinha link e cai no link por
endereço. O institucional saiu de `sobre-nos`: fundada em 8 de novembro de 2003, fábrica
própria, garantia vitalícia do teor.

**Cada unidade tem página completa**: galeria, mapa, horário dia a dia com os sete dias
na tela, serviços, história, avaliações, FAQ e `JewelryStore` com `containedInPlace` do
shopping. Três botões de rota: Google Maps pelo link curto oficial, Waze pela coordenada
e WhatsApp com mensagem pronta.

**Os quatro eventos de clique que estavam declarados e nunca disparavam** agora
disparam: `clique_rota`, `clique_waze`, `clique_whatsapp` e `clique_telefone`.

**Mapa sem chave de API.** O embed do Google passou a exigir chave, e chave de mapa no
cliente é chave exposta. Usamos OpenStreetMap em iframe, carregado só depois do clique,
porque é conteúdo de terceiro com rastreio próprio e a maioria quer o botão de rota.

**Galeria pronta antes das fotos.** Tabela `location_media` espelhando `content_media`,
visor em tela cheia com setas e Esc, e gestão no admin com reordenar e definir capa.
Sem foto, o card do índice mostra o nome do shopping em vez de um retângulo cinza.

**Três coisas ficaram em branco de propósito**, porque preenchê-las seria inventar:

- **Horário** só está publicado onde existe fonte, ou seja Santana Parque, União de
  Osasco e Internacional Guarulhos. Nas outras sete a página diz que o horário não foi
  confirmado e manda conferir no Google. Cada horário guarda de onde veio, e sem
  `hours_source` ele não vai ao ar.
- **Avaliações**: nenhuma nota preenchida. O bloco e o `aggregateRating` existem, mas
  só com número real e origem. A constraint `locations_rating_com_fonte` foi testada
  contra uma tentativa de gravar 4,9 sem origem, e barrou.
- **História e data de inauguração por unidade**: campos prontos no admin, vazios até a
  JK confirmar.

### O que a verificação encontrou e foi corrigido

- Três pares de cor reprovavam em AA: dois textos de apoio no palco escuro e o crédito
  de foto. Calculei os 15 pares principais, todos passam agora.
- Oito das dez lojas só têm WhatsApp, e o `JewelryStore` só emitia `telephone` a partir
  do campo `phone`. Iriam para o Google sem número nenhum.
- A gaveta do celular nascia translúcida demais e o h1 vazava por trás.
- `setPointerCapture` derrubava o arrasto inteiro quando falhava.
- Centralizar dentro de um container que rola deixava a metade esquerda do desenho de
  calibração inalcançável.

---

## 2c. Rodadas de 13/08 a 18/08/2026

### 13/08, o motor de produção

O admin deixou de ser um editor e virou linha de produção.

**Base de fatos.** O fato é escrito uma vez, com a fonte, e o gesto de citar dentro do
editor cria a linha de `sources` que destrava a publicação. Antes a trava existia mas o
caminho para satisfazê-la era manual.

**Fila de pautas** lendo `analytics_snapshots` e ordenando por impressão alta com CTR
baixo, que é onde tem demanda esperando resposta. Recusa pauta que canibaliza página
existente, e "virar rascunho" já preenche consulta alvo, modelo e produtos.

**Histórico de versões com restaurar**, que só reescreve os campos presentes no retrato.
Retrato antigo não tem `authorId`, e escrever null apagaria a autoria de hoje.

**Agendamento** por `scheduled_at`, disparado pelo `pg_cron` no endpoint
`/api/cron/publicar`, passando pelas MESMAS travas da publicação manual. Foi por isso
que publicar virou `src/lib/publicacao/publicar.ts`: são três portas para o mesmo ato, e
a terceira não tem ninguém logado.

**Calendário** e **redirects** com a fila de `not_found_hits` e palpite de destino por
semelhança de slug.

**Quatro blocos novos no editor**: resumo em destaque, passo a passo, FAQ no corpo e
chamada para ação com evento.

**Vitrine de produtos** de um a quatro produtos, em três formatos. O preço exibido sai
de `products` na hora de servir a página, e existe teste (`npm run verificar:precos`,
que roda junto do build) garantindo que a troca continua funcionando.

### 13/08, as ferramentas

Registro em `src/lib/ferramentas/registro.ts`: a ferramenta se declara uma vez, e dela
saem a página, a entrada no sitemap e no `llms.txt`, o item no menu do editor e o bloco
embutido no artigo.

- **Conversor de tamanhos**, com a matemática conferida contra a tabela americana.
- **Simulador de largura**, que desenha de 2 a 8 mm em tamanho real reaproveitando a
  calibração do medidor e fecha com peças reais daquela largura.
- **Comparador de materiais**, que separa por ORIGEM: teor sai de definição
  metrológica, faixa de preço sai da view `aliancas_por_material` sobre o catálogo, e
  durabilidade e garantia só aparecem quando a JK aprovar o fato.

A **pré-visualização de gravação** não foi construída de propósito: é a única das quatro
sem nenhum dado próprio, e as perguntas para a JK viraram fatos em `validar`.

### 14/08, o 3D e a linguagem

**Aliança em 3D** no comparador, sem arquivo `.obj`. A peça nasce do contorno em
milímetros em `src/lib/aliancas/perfis.ts`, e o MESMO contorno vira o desenho do corte
em SVG, então os dois nunca discordam. Malha pronta congelaria largura, espessura e aro
dentro do arquivo.

São dois eixos independentes, como a JK vende: **modelo** é a face de fora e **formato**
é o lado do dedo. O catálogo confirma. O volume de metal é geometria exata, por Pappus,
não estimativa.

**Simulador de largura em ilustração de traço**, depois de quatro desenhos descartados.
Os dois primeiros erravam a composição, o terceiro errava a linguagem: vetor tem teto
para realismo de pele, e quase-real fica pior que assumidamente desenhado.

**Revisão de linguagem** em todo texto visível, com as regras novas na seção 1 do
`REGRAS.md`. Saíram dois duplos sentidos, a frase que ninguém fala e o nome que ninguém
busca. A ferramenta virou "Medidor de aliança" em todo lugar, e "portal" virou "site" na
tela.

### 17/08, o celular e a resposta no comentário

**Celular do comparador.** O defeito era grave e silencioso: tentar girar a peça rolava
a página, e ela parecia travada. Agora o primeiro movimento decide o gesto. Entrou tela
cheia com pinça, e o palco embutido passou de altura fixa para quase quadrado, porque
num aparelho de 390 px a aliança tinha o tamanho de uma moeda.

**Vitrine do simulador** deixou de ficar presa em 4 mm. A troca acontece pelo navegador,
sem tornar a página dinâmica, e largura e produtos moram no mesmo estado, porque
separados um erro de rede deixa o título de 8 mm em cima do preço de 4 mm.

**Resposta da loja no comentário**, com um nível de conversa, trava no banco e não só na
tela, assinada como JK Alianças para quem lê e por `author_profile_id` para quem presta
contas.

### 18/08, a resposta ao clique

O painel não dava sinal nenhum entre clicar e a página aparecer, o que fazia rota de
300 ms parecer site travado e levava a pessoa a clicar duas vezes.

São três camadas: **barra de progresso** no layout raiz, que vale para o site e para o
admin; **giro no item do menu** por `useLinkStatus`, que responde em zero e diz qual
item foi clicado; e **esqueleto por rota**, no painel, no editor e na busca.

---

## 3. Armadilhas que já custaram tempo

Estas estão em [`CLAUDE.md`](CLAUDE.md) para serem lidas no começo de toda sessão. Repito
aqui as que mais doeram.

**Node 24 trava o `next dev` em silêncio.** Processo vivo, sem banner, porta nunca abre.
Use Node 22, que está fixado no `.nvmrc`.

**`middleware.ts` na raiz é ignorado sem erro** quando existe a pasta `src/`. Ficou meses
sem rodar assim, e a proteção do admin vinha de outro lugar sem ninguém perceber.

**Nunca rodar `npm run build` com o `next dev` ligado.** Os dois escrevem em `.next` e
corrompem o cache. Use `npm run build:seguro`.

**Toda migration aplicada precisa virar arquivo.** Já aconteceu de seis existirem só no
banco.

**Existem dois servidores Supabase no MCP e só um funciona.** As ferramentas
`mcp__supabase__*` funcionam. As do outro servidor recusam tudo, inclusive leitura, com
mensagem de permissão. Se DDL falhar por permissão, troque de ferramenta antes de
concluir que a sessão perdeu autorização.

**Depois de DDL, o erro que aparece costuma ser cache, não falha.** O PostgREST guarda
o schema e o Next segura a rota por ISR. Logo após aplicar a 0017, o console acusava
`column locations.sort_order does not exist` com a coluna já existindo no banco. Resolve
com `notify pgrst, 'reload schema'` e um toque em qualquer arquivo da rota. Para provar
que a página passou a ler o banco, arquive uma linha por SQL e veja se ela some.

**RLS: `for all to authenticated` inclui leitura.** Quem está logado no admin lê tudo,
inclusive linhas que a política pública esconderia. Isso gerou um bug real no relatório
de páginas órfãs, onde link vindo de rascunho contava como citação válida e escondia a
órfã de verdade. Onde a origem importa, filtre no código.

**`metadataBase` com caminho duplica o `og:image`.** Com `basePath`, o Next monta o
caminho da imagem de convenção já com o prefixo e depois junta com o `pathname` do
`metadataBase`. Com `/guias` nos dois lados, o build emitiu `.../guias/guias/...`. Por
isso `metadataBase` é a origem pura.

**Cache que guarda o PADRÃO do código não deixa o código mudar mais nada.** `lerLayout`
montava o layout de fábrica dentro do `unstable_cache` e gravava a cópia com
`revalidate: false`. Reescrever o título da home no código não aparecia na tela, nem
recompilando, e parecia que a edição não tinha sido feita. Regra geral: dentro do cache
vai o que veio do banco, nunca o que veio do código.

**Barra de progresso da rota tem que escutar o clique na CAPTURA.** O `next/link` chama
`preventDefault()` no próprio clique, então um ouvinte na fase de bolha recebe todo link
interno já cancelado e desiste. A primeira versão era assim e nunca desenhou barra
nenhuma, sem erro no console: só não aparecia.

**`loading.tsx` em rota dinâmica não é enfeite, é o que liga o prefetch.** Sem esse
arquivo, o `next/link` não busca nada antes do clique, e a tela fica congelada na página
anterior até o servidor responder.

**CSS fora de `@layer` vence utilitário do Tailwind.** A classe `.eyebrow` estava solta
com `color`, e os oito pontos do site que escrevem `eyebrow text-brand-light` sobre
fundo escuro renderizavam em 3,33:1, reprovado em AA, sem ninguém perceber. Classe nova
em `globals.css` que defina cor ou tamanho vai dentro de um layer.

**`shrink-0` em título abre barra de rolagem horizontal no celular.** Quem não encolhe
também não quebra linha, então o título travava na largura de conteúdo máximo e a home
ficava com 467 px num aparelho de 375. A checagem é comparar `scrollWidth` com
`clientWidth` a 320 px e a 375 px.

---

## 4. O que fazer a seguir, em ordem

### 4.1 Antes de qualquer código: a forense do Search Console

Continua sendo o item de maior retorno e ninguém fez ainda.

"anel de compromisso" aparece na posição 4 com 0,06% de cliques. Na posição 4, o
esperado é algo perto de 7%. É 117 vezes abaixo, e nenhum título bem escrito fecha um
buraco desse tamanho. As explicações prováveis são outras: a posição média escondendo a
distribuição real, impressões vindas de Google Imagens e de listagens de produto, e a
ambiguidade da palavra "aliança", que também é Aliança Francesa, aliança política e o
município de Aliança.

Separe por tipo de busca, olhe a distribuição em vez da média, e pegue o CTR isolado de
"como saber o tamanho da aliança", que é a única consulta com intenção limpa e com
ferramenta pronta no site. Se o CTR dela for normal, o problema é posição. Se também
estiver perto de zero, existe algo sistêmico a descobrir antes de investir três meses na
direção errada.

### 4.2 Conteúdo, que é o que está faltando de verdade

O portal tem um guia publicado. Software não resolve isso.

Comece pelo **conteúdo de cronograma**, que é a aposta mais barata e a que ninguém pode
copiar da JK. Todo mundo escreve "ouro 18k contra ouro branco". Ninguém escreve o
calendário: quantos meses antes encomendar, prazo de gravação, tempo do ajuste de aro, o
que fazer se a data mudou. É o que se pergunta a um modelo de linguagem em conversa, é
numérico, é citável, e usa a vantagem real da fábrica própria, que revendedor nenhum
pode afirmar.

O editor agora avisa quando duas páginas disputam a mesma busca, então dá para escrever
rápido sem criar canibalização.

### 4.3 Página de loja que converte, feita em 12/08/2026

As 10 unidades estão publicadas, com mapa, rota por Maps e por Waze, WhatsApp com
mensagem pronta, serviços e os quatro eventos de clique disparando.

O que falta nesta frente **depende da JK, não de código**: foto real de cada unidade,
horário confirmado das sete lojas que estão sem fonte, e a história de cada loja. Os
campos existem no admin e a página monta o bloco sozinha assim que houver dado.

Com 10 lojas e fábrica própria, a JK pode ganhar o pacote local, que é o único lugar do
resultado de busca onde aparecer e ser clicado é verdade.

### 4.4 Avaliações reais

O maior ativo de confiança numa compra emocional de ticket alto, e o que a IA cita
quando perguntam se a JK é boa. Depende de acesso ao Google Meu Negócio, que é pedido de
terceiro. Schema `Review` com autor e data reais, nunca `AggregateRating` fabricado.

### 4.5 Domínio: decidido, publicado e travado num acesso

A decisão foi tomada e é **subpasta**, não subdomínio: `www.jkaliancas.com.br/guias`,
servido por Worker do Cloudflare, com o portal rodando em `basePath`. Subpasta concentra
autoridade no mesmo domínio, que é a razão de existir do projeto. O passo a passo está
em [`DEPLOY.md`](DEPLOY.md).

**Feito:** o portal está publicado na Vercel e responde em
https://jk-portal.vercel.app/guias

**Travado:** a troca dos nameservers para a Cloudflare depende do acesso ao Registro.br,
que a Kathleen ainda vai passar. Enquanto isso, **nenhum registro de DNS foi alterado e
nenhum Worker foi criado**. Não é bloqueio de trabalho: dá para escrever, revisar e
publicar no endereço temporário desde já.

Quando o acesso chegar, a ordem segura é: espelhar o DNS, trocar os nameservers, validar
e-mail e serviços com o `www` ainda em DNS Only, ligar a nuvem laranja só no `www`, e só
então pendurar o Worker na rota `/guias*`. Desligar a rota do Worker devolve tudo para a
Tray na hora, e esse é o rollback.

Uma parte pode ser adiantada sem risco nenhum: criar o Worker e testar num endereço
`workers.dev`. Isso não encosta no domínio da loja.

O passo mais importante da fase continua não sendo técnico: é colocar links da loja para
o portal na home e nas categorias de maior tráfego, pelo tema da Tray. É o mecanismo
mais forte disponível para transferir autoridade e é totalmente suportado.

Duas coisas que só valem depois da virada: pedir para a loja incluir no `robots.txt`
dela o `Disallow` de `/guias/admin`, `/guias/api`, `/guias/preview` e `/guias/busca`,
mais a linha do `Sitemap`, porque o robots do portal não governa a raiz do host; e criar
a propriedade de PREFIXO no Search Console, enviando o sitemap na mão.

### 4.6 Search Console por OAuth

Aposentar a importação manual de CSV, e só então construir baseline e série temporal.
Montar painel comparativo em cima de CSV colado à mão é fabricar dado velho pela metade.

### 4.7 O que já saiu desta lista, e o que sobrou

Busca interna, resposta em comentário, página de autor e tela de restaurar revisão
estavam previstos para "depois de umas 40 páginas" e acabaram entrando antes, porque
cada um deles destravou outra coisa.

Sobrou: **ponto focal editável** na biblioteca de mídia, que hoje é gravado mas nunca
ajustado e faz diferença no recorte da capa e da foto de loja; **OAuth do Search Console
e do Google Meu Negócio**; e a **pré-visualização de gravação**, que espera fato
aprovado pela JK.

---

## 5. O que não fazer, e por quê

**Não perseguir a palavra "aliança".** São 304 mil impressões ambíguas, com o resultado
dominado por anúncios, imagens e produtos. O teto de cliques é estrutural. Persiga
"quanto tempo antes comprar aliança de casamento" e "prata 950 escurece", onde o
primeiro lugar rende perto de 30% e a pessoa tem intenção de compra.

**Não implementar `speakable` nem `VideoObject` sem vídeo.** Schema para conteúdo que
não existe é a regra de não inventar violada de dentro para fora.

**Não construir papéis diferenciados agora.** Você escreve sozinho. Passa a valer quando
entrar redator externo.

**O redesenho já foi feito, então a regra agora é outra: não mexer mais no visual antes
do conteúdo.** Beleza é multiplicador, e multiplicador de zero é zero. A rodada de UX de
12/08 valeu porque quase tudo nela também era funcional: hierarquia de leitura, capa,
ordem no celular, contraste, acessibilidade do medidor e páginas de loja que convertem.
Daqui para frente, ajuste visual só quando resolver um problema medido.

**Não escrever `audit_logs` agora.** Com poucos usuários nomeados e `revisions` já
gravando quem editou, é registro que ninguém vai ler.

---

## 6. Pendências que dependem de gente

### Suas, e urgentes

- [ ] **Desligar o cadastro público no Supabase** (Authentication > Sign In / Providers,
      "Allow new users to sign up"). É a única parte da falha de permissão de 0020 que
      não fecha por migration, e continua ligada.
- [ ] **Rotacionar a chave da OpenAI.** Foi compartilhada no chat.
- [ ] **Trocar a senha temporária do usuário master.**
- [ ] Ligar "leaked password protection" no painel do Supabase.
- [ ] **Preencher `site_settings.cron` com o endereço do portal, COM o `/guias`.** O SQL
      faz `url || '/api/cron/publicar'`. Sem isso o job roda de 5 em 5 minutos sem fazer
      nada, e a publicação agendada fica só na tela.
- [ ] **Cadastrar o webhook da Tray** apontando para
      `https://SEU-DOMINIO/guias/api/tray/webhook?secret=SEU_SEGREDO`.
- [ ] Gerar `PREVIEW_SECRET` e `INDEXNOW_KEY` no `.env.local`.
- [ ] Proteção de acesso nos ambientes de Preview da Vercel.
- [ ] O projeto não tem `eslint.config.js`, então `npm run lint` não roda.
- [x] ~~README desatualizado.~~ Reescrito em 19/08.

### Da JK, e travam a virada de domínio

- [ ] **Acesso ao Registro.br**, com a Kathleen. É o único item que impede trocar os
      nameservers para a Cloudflare, e sem isso o Worker que serve `/guias` não pode ser
      ligado.
- [x] ~~Acesso ao Search Console.~~ Liberado.
- [ ] **Acesso ao Google Analytics 4 e ao Tag Manager.** Sem eles os eventos de clique,
      que já estão prontos no código, não viram número.

### Da JK, e travam a Fase 5

- [x] ~~**NAP real das 10 unidades.**~~ Endereço, telefone e WhatsApp tirados do site
      oficial, com coordenada e place id de cada ficha do Google.
- [ ] **Horário de sete unidades.** Só Santana Parque, União de Osasco e Internacional
      Guarulhos têm fonte. As outras sete estão no ar avisando que o horário não foi
      confirmado, o que é honesto mas custa clique.
- [ ] **Razão social e CNPJ.** Não estão publicados em nenhuma página da loja, e inventar
      quebraria a regra de não afirmar sem fonte. Sem isso o `legalName` do schema fica
      com o nome de exibição.
- [ ] **Fotos reais das lojas.** A galeria está pronta e vazia: assim que as fotos
      entrarem em Mídia com alt, elas aparecem na página e no card do índice.
- [ ] **História e data de inauguração de cada unidade.** Campos prontos no admin.
- [ ] **Acesso ao Google Meu Negócio**, que é o que destrava as avaliações reais.
- [ ] **Fatos sobre gravação** (métodos, prazo, limite de caracteres, o que pode e o que
      não pode). É o que falta para a quarta ferramenta existir. As perguntas já estão
      registradas em `facts` com status `validar`.
- [x] Decisão sobre subpasta: RESOLVIDO. O portal roda em `/guias` por
      `basePath`, com o Cloudflare na frente. Ver a seção de produção no CLAUDE.md.

---

## 7. Variáveis de ambiente

| Variável | Situação | Para que serve |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | configurada | Banco |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | configurada | Leitura pública, com RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | configurada | Só no servidor, nunca com prefixo público |
| `OPENAI_API_KEY` | configurada, rotacionar | Analisador e assistente |
| `PREVIEW_SECRET` | a gerar | Assina o link de preview. Trocar revoga todos de uma vez |
| `INDEXNOW_KEY` | a gerar | Aviso a Bing, Yandex e Seznam. Só tem efeito em produção |
| `NEXT_PUBLIC_SITE_URL` | configurada na Vercel | **Só a ORIGEM, sem `/guias` e sem barra no fim.** Quem soma o prefixo é `absoluteUrl()`. Com o prefixo aqui, `new URL("/x", base)` descartaria o caminho e todo canonical apontaria para a loja |
| `TRAY_API_URL` | opcional | Endereço da API da loja. A sincronização funciona sem, pela busca pública |
| `TRAY_CONSUMER_KEY`, `TRAY_CONSUMER_SECRET`, `TRAY_CODE` | a obter | Só no servidor. Destravam variação, estoque e imagem pela API oficial |
| `TRAY_WEBHOOK_SECRET` | a gerar | Sem ela o webhook fica desligado |

Para gerar as duas que faltam:

```bash
printf 'PREVIEW_SECRET=%s\nINDEXNOW_KEY=%s\n' "$(openssl rand -hex 32)" "$(openssl rand -hex 16)" >> .env.local
```

Em localhost o `robots.txt` responde `Disallow: /` de propósito, porque
`NEXT_PUBLIC_SITE_URL` está vazia. É proteção para nunca indexar ambiente de
desenvolvimento.

---

## 8. Como conferir que continua tudo de pé

```bash
nvm use && npm run dev
```

Depois, com o servidor no ar:

```bash
npm run build:seguro
```

O build usa pasta separada, então não derruba o dev nem corrompe o cache.

Confira à mão, na ordem em que quebra mais:

1. Um guia abre em `/[slug]` com linha de apoio, índice e FAQ.
2. O editor salva sozinho e mostra "Salvo às".
3. Publicar sem fonte é recusado com mensagem clara.
4. `/preview/<token adulterado>` responde 404.
5. `sitemap.xml`, `robots.txt` e `llms.txt` respondem.
6. `list_migrations` do Supabase bate com `ls supabase/migrations/`.
7. `/lojas` mostra as 10 unidades agrupadas por cidade, e uma delas abre com mapa,
   rota e horário.
8. O medidor abre em tela cheia, o **disco** responde ao arrasto e o aro aparece na
   tabela destacado ao fechar. É disco, de uma borda só, não anel.
9. As quatro ferramentas abrem por `/ferramentas`, e a aliança em 3D do comparador gira
   ao arrastar, inclusive no celular, sem a página rolar junto.
10. O simulador de largura troca a vitrine ao mudar o mm, e o título nunca fica com uma
    largura e o preço com outra.
11. Clicar num item do menu do admin acende o giro no próprio item e a barra no topo.
12. Vitrine de produto no artigo mostra o preço da tabela, não o gravado no texto. O
    `npm run verificar:precos` roda junto do build e cobre isso.
