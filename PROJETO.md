# PROJETO — Portal JK Alianças

> **Documento-norte do projeto.** Leia este arquivo no início de toda sessão de trabalho.
> É a fonte de verdade sobre **o que estamos construindo e por quê**. Detalhes operacionais
> (como rodar, versão de Node) estão no [`CLAUDE.md`](CLAUDE.md). O backlog vivo está no
> Trello **🧠 JK Alianças | ADM** → https://trello.com/b/S7IXlYDi

---

## 1. Em uma frase

Um **portal de conteúdo editorial** para a **JK Alianças** (joalheria brasileira, fábrica própria, 10 lojas físicas, +17 mil avaliações) construído para **rankear de forma dominante no Google e nas respostas de IA** — e transformar a JK na marca de alianças mais buscada e mais recomendada do Brasil.

Duas frentes num só produto:
- **Portal público** (o site que o cliente e o Google/IA veem) — bonito, sofisticado, rápido, otimizado para SEO e GEO.
- **Admin / CMS** (o painel interno) — para cadastrar usuários e editores, criar/editar/publicar conteúdo, moderar comentários, ver métricas e conectar Search Console, GA4 e GTM.

---

## 2. O objetivo de verdade (o "norte")

> Aparecer em **1º lugar** — tanto na busca orgânica do Google quanto quando alguém pergunta a uma IA (ChatGPT, Gemini, Perplexity, Claude) *"qual a melhor aliança"*, *"como escolher aliança de namoro"*, *"onde comprar aliança"*.

A oportunidade **não** é publicar volume aleatório. É **concentrar autoridade em entidades e jornadas**:

```
consulta  →  guia  →  categoria  →  produto campeão  →  loja / prova  →  conversão
```

A JK já tem os ativos (fábrica, lojas, catálogo, reputação). O problema é **fragmentação**. Este portal costura tudo isso em um ecossistema informativo forte.

**Como medimos sucesso** (não só posição): impressões, cliques orgânicos, novas buscas em que a JK passa a aparecer, páginas indexadas, posições conquistadas, cliques para WhatsApp/telefone/rota/loja e, por fim, conversão. Baseline vem do Search Console; meta é crescimento mensal consistente ("melhorar 1000%" = ordem de grandeza, medida contra o baseline).

---

## 3. Princípios inegociáveis

1. **Complementar a loja Tray, não competir com ela.** A Tray continua sendo a fonte de verdade para **preço, estoque, promoção, disponibilidade e checkout**. O portal cuida de **conteúdo, relações, histórico e conhecimento**. Nunca duplicar checkout nem editar preço/estoque aqui.
2. **Nada de afirmação institucional sem fonte aprovada pela JK.** Todo dado factual precisa de origem.
3. **Conteúdo responde a dúvida principal logo no início** (padrão "resposta rápida") — é o que rankeia em IA e ganha featured snippet.
4. **Qualidade > quantidade.** Publicar conteúdo excelente, revisado por humano, não centenas de textos genéricos.
5. **Nunca quebrar o que já funciona.** Sem migração de URL em massa, sem mudar nameserver, sempre com baseline + rollback.
6. **Tudo é da JK.** Contas, repositório e infraestrutura pertencem à JK (ownership), não a uma agência ou dev pessoal.
7. **Acessibilidade é requisito**, não enfeite: contraste, foco visível, labels, alt útil, navegação por teclado.

---

## 4. Estética & Design

**Direção:** joalheria de luxo — **sofisticado, elegante, "luxo limpo"**, com **glassmorphism** aplicado com contenção e bom gosto.

- **Glassmorphism como assinatura, não como ruído.** Superfícies de vidro fosco (blur + translucidez + borda sutil) em elementos de destaque: header/nav flutuante, cards de guia, overlays, painéis do admin, CTAs. **Sem** exagerar a ponto de prejudicar legibilidade ou contraste.
- **Paleta curta:** neutros (marfim, branco, carvão) + **uma cor de ação: dourado fosco `#be9b60`** (identidade JK). O vidro realça o dourado; não compete com ele.
- **Tipografia:** **Montserrat** (uma fonte, pesos limitados). Títulos com respiro generoso.
- **Menos é mais:** uma ação principal por bloco, poucos destaques simultâneos, cantos discretos, pouco movimento. Prova real (fábrica, lojas, avaliações, garantia, personalização) em vez de vitrine de atacado.
- **Mobile-first** e **Core Web Vitals** impecáveis — beleza não pode custar performance (o glass usa `backdrop-filter` com parcimônia e fallback).
- Referência detalhada de marca: [`docs/identidade-visual-jk.md`](docs/identidade-visual-jk.md).

> Tensão a respeitar: glassmorphism pede transparência; a marca pede **alto contraste** e acessibilidade. Regra de ouro — o texto sempre passa no contraste WCAG AA; o vidro é o *fundo*, nunca o que atrapalha a leitura.

---

## 5. Arquitetura do site público

URLs (no domínio principal — subdomínio `guia.jkaliancas.com.br` na Fase 1, depois `/guia/` via proxy/rewrite):

```
/                         Home — hero + guias em destaque + prova (lojas, avaliações)
/guia                     Índice de guias
/guia/[slug]              Guia/artigo (resposta rápida + conteúdo + FAQ + produtos + CTA)
/lojas                    Índice das lojas
/lojas/[slug]             Página local (NAP, horários, serviços, mapa, avaliações)
/robots.txt /sitemap.xml  Gerados automaticamente
/llms.txt                 Índice para crawlers de IA (GEO)
/admin/*                  Painel interno (protegido, noindex) — A CONSTRUIR
```

**Tipos de página e função:**
- **Guia pilar** → dúvida ampla e comparação.
- **Artigo** → pergunta específica.
- **Página local** → intenção geográfica ("aliança perto de mim", cidade/bairro).
- **FAQ** → apoio dentro do conteúdo, não página isolada em massa.

---

## 6. Estratégia SEO + GEO (o coração do projeto)

**SEO (Google):**
- HTML completo no primeiro carregamento (SSG/ISR), canonical absoluto e único, sitemap segmentado automático, robots por ambiente, Open Graph, imagens otimizadas, redirect map, 404 útil.
- **Schema/JSON-LD:** `Article`, `Breadcrumb`, `Organization`, `LocalBusiness`/`JewelryStore`, `FAQPage`; `Product` só onde houver produto real. **Nunca** inventar `AggregateRating`, preço ou estoque.
- Cada página tem: consulta principal, intenção, página-alvo, risco de canibalização, fontes JK, produto ligado, links internos de entrada/saída, imagens, CTA, schema e uma métrica.

**GEO (respostas de IA — o diferencial):**
- **Responder primeiro, explicar depois** (bloco "Resposta rápida" no topo).
- **Nomear a entidade completa** ("JK Alianças") e os produtos centrais de forma factual e citável.
- Linguagem objetiva, fácil de interpretar por buscadores e IA; evitar título emocional genérico e keyword stuffing.
- `llms.txt` + dados estruturados ricos + FAQ = maior chance de ser citado por IA.
- `robots.txt` libera Google, Bing, OpenAI, Claude, Perplexity e outros.
- **Comentários e compartilhamento como sinais:** UGC moderado e botões de compartilhar aumentam frescor, engajamento e alcance — reforçando SEO/GEO (ver §7).

**Primeira batalha (ordem confirmada por dados):** o cluster **alianças de namoro**, alimentando a categoria `/namoro-e-compromisso`. Palavras com alta impressão e CTR baixíssimo = maior oportunidade:

| Consulta | Impressões | Posição | CTR |
|---|---|---|---|
| aliança | 304.212 | 8,3 | 0,03% |
| aliança de casamento | 114.924 | 7,5 | 0,11% |
| anel de compromisso | 81.040 | 4,0 | 0,06% |
| aliança de namoro | 64.796 | 11,3 | 0,37% |
| como saber o tamanho da aliança | 4.428 | 6,5 | — |

Tópicos do primeiro cluster: como escolher, medir o aro, prata 925 x 950, larguras 2–5 mm, solitário, acabamento/conforto/formato, gravação/personalização, cuidados (escurecimento, polimento, troca, garantia), compra online.

Prioridades seguintes: **P2** casamento e noivado · **P3** ouro e alternativas (10k×18k, ouro branco, banhado, durabilidade) · **P4** SEO local (10 lojas, "perto de mim") · **P5** outros ativos (formatura, joias, presentes).

---

## 7. O Admin / CMS (a grande peça a construir)

Objetivo: **"É possível criar, revisar, publicar, medir e atualizar conteúdo sem precisar de um dev a cada página."** Um "canal de notícias perfeito" para conteúdo de joalheria.

### 7.1 Usuários, papéis e segurança
- **Cadastro só por convite** (sem signup público). **MFA** para admins.
- Papéis (roles): **Admin** (tudo, gerencia usuários) · **Editor** (cria/edita/publica) · **Revisor** (revisa/aprova) · **Autor** (cria/edita rascunho). Permissões via RLS no Supabase.
- Cada conteúdo registra autor, revisor, datas (criação, atualização, publicação) e histórico de revisões (audit log). **Desativar em vez de apagar** — nunca perder histórico.

### 7.2 Editor de conteúdo
- Formulário estruturado: título, dúvida principal, objetivo da página, público, intenção de busca, página-alvo, produtos relacionados, fontes, links internos, imagens (com alt e origem), CTA, canonical.
- Estrutura fixa do artigo: **Resposta direta → Explicação → Comparações/tabela → FAQ → Produtos relacionados → CTA**.
- Estados: rascunho → em revisão → pronto para publicar → publicado → atualização. Gate de publicação (só publica com texto, imagens, links e CTA revisados).
- Agendamento de publicação e data visível ("tipo canal de notícia").

### 7.3 Analisador de SEO + GEO ao vivo (enquanto escreve) ⭐
Painel lateral no editor que pontua o conteúdo **em tempo real** e sugere melhorias:
- **SEO:** presença da palavra-alvo (título, H1, primeiros parágrafos, URL), hierarquia de headings, meta title/description (tamanho e clareza), densidade sem stuffing, links internos suficientes, imagens com alt, legibilidade, completude de schema.
- **GEO:** tem "resposta rápida" no topo? nomeia a entidade "JK Alianças"? é factual/citável? tem FAQ? dados estruturados adequados para IA? responde a intenção sem obrigar o leitor a voltar ao Google?
- Saída: nota + checklist acionável (verde/amarelo/vermelho) antes de publicar.

### 7.4 Comentários & compartilhamento
- **Comentários** no conteúdo, com **moderação** (aprovar/reprovar/marcar spam) no admin — engajamento e frescor ajudam SEO; UGC precisa de anti-spam.
- **Compartilhamento** (WhatsApp, link, redes) com Open Graph caprichado para ampliar alcance e sinais sociais.

### 7.5 Métricas & integrações
- Dashboard mensal: conteúdos publicados, páginas indexadas, impressões, cliques orgânicos, novas buscas em que a JK aparece, páginas em maior crescimento, posições conquistadas, conteúdos perto da 1ª página.
- **Integrações:** Google **Search Console** (dados de busca), **GA4** (comportamento), **GTM** (tags/eventos). Rastreio de cliques para produto, WhatsApp, telefone, rota e loja; UTMs por unidade/origem; comparação com baseline.

---

## 8. Modelo de dados (Supabase — resumo)

Tabelas-chave (todas com RLS, soft-delete, histórico): `contents`, `content_links`, `content_products`, `sources`, `locations`, `reviews`, `redirects`, `products`/`product_variants`/`categories` (leitura sincronizada da Tray), `attributes`, `sales_snapshots`, `sync_logs`, `revisions`, `audit_logs`, `comments` (novo), `users`/`roles`. A Tray é sincronizada **somente leitura** via API + webhooks; nunca escrevemos preço/estoque.

---

## 9. Estado atual (o que já existe e funciona)

✅ **Portal público já roda** (Next.js 15 + Supabase, Node 22): home, `/guia`, `/guia/[slug]` (com "resposta rápida" + FAQ), `/lojas`, `/lojas/[slug]`, `robots`, `sitemap`, `llms.txt`, JSON-LD (Article/Breadcrumb/Organization/JewelryStore/FAQ), tokens de marca (dourado + Montserrat), fallback com dados de exemplo quando o banco está vazio.
✅ Migrations Supabase base: `contents`, `locations`, `sources`, `redirects`, `content_links` + RLS.

🔲 **Falta construir:** admin/CMS inteiro (§7), estética glassmorphism (§4), conteúdo real do cluster namoro (§6), integrações GSC/GA4/GTM, comentários, analisador SEO/GEO, sincronização com a Tray, deploy na Vercel.

⚠️ Pequenos ajustes pendentes: título duplicado ("| JK Alianças | JK Alianças"), imagem `/og/default.png` e favicon faltando, README desatualizado.

---

## 10. Setup de desenvolvimento (importante!)

- **Node 22 LTS obrigatório** (via nvm). Node 24 **trava** o `next dev` silenciosamente. `.nvmrc` já fixa a versão.
- Rodar: `nvm use` e `npm run dev` → http://localhost:3000
- Se travar de novo: confira `node -v` (deve ser 22) e faça `rm -rf node_modules .next && npm install`.
- Detalhes e diagnóstico completo em [`CLAUDE.md`](CLAUDE.md).

---

## 11. Roadmap sugerido (por fases)

1. **Fase 0 — Base (feito):** portal público rodando, arquitetura SEO, dados de exemplo.
2. **Fase 1 — Estética:** aplicar o design glassmorphism/luxo em todo o público; corrigir OG/favicon/título; deploy na Vercel (Pro, preview por PR, admin noindex).
3. **Fase 2 — Admin & Auth:** login por convite, papéis/RLS, CRUD de conteúdo e lojas, workflow editorial, gate de publicação.
4. **Fase 3 — Conteúdo real:** cluster **alianças de namoro** com fontes JK; conectar Supabase real; páginas locais das 10 lojas.
5. **Fase 4 — Inteligência:** analisador SEO/GEO ao vivo, comentários + moderação, compartilhamento.
6. **Fase 5 — Medição:** dashboard, integração GSC/GA4/GTM, rastreio de cliques, baseline e comparação mensal.
7. **Fase 6 — Tray:** sincronização de catálogo (somente leitura) via API + webhooks.

---

## 12. NÃO fazer

- Não migrar URLs nem publicar em escala antes de mapa de redirects + arquitetura + homologação + rollback.
- Não editar preço/estoque nem duplicar checkout (isso é da Tray).
- Não publicar afirmação sem fonte aprovada pela JK.
- Não inventar avaliações, notas, preços ou FAQ.
- Não medir sucesso só por posição.
- Não apagar o scaffold que já funciona para "recomeçar" — reaproveitar e evoluir.

---

## 13. Fontes de verdade

- **Trello** 🧠 JK Alianças | ADM — https://trello.com/b/S7IXlYDi (12 listas, 66 cards: estratégia, diagnósticos, dados de busca, modelo de dados, pautas).
- **Identidade visual** — [`docs/identidade-visual-jk.md`](docs/identidade-visual-jk.md).
- **Este documento** — visão e escopo. Atualizar quando a direção mudar.

_Última atualização: 2026-08-11._
