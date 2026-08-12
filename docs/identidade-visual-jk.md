# Identidade visual — JK Alianças

> Guia de referência para reproduzir a identidade digital atual da JK Alianças em outros projetos.
>
> Base analisada em 11 de agosto de 2026: home, configurações do tema, logotipo, cabeçalho, categorias, vitrines, newsletter, rodapé e comportamento responsivo. O guia normaliza a identidade; banners e campanhas sazonais não devem ser tratados como regras permanentes da marca.

## 1. Essência da marca

A JK Alianças combina **luxo acessível**, **romantismo contemporâneo** e **confiança de fábrica própria**. A interface deve transmitir valor e cuidado sem parecer ostensiva, fria ou excessivamente minimalista.

Palavras-chave:

- elegante;
- acolhedora;
- romântica;
- luminosa;
- confiável;
- delicada;
- comercial, sem perder sofisticação.

### Princípios visuais

1. **O produto é o protagonista.** Muito espaço claro, fotografia ampla e poucos elementos competindo com a joia.
2. **O dourado é assinatura, não preenchimento indiscriminado.** Usar em detalhes, ícones, divisores, bordas, estados ativos e CTAs selecionados.
3. **Sofisticação vem da contenção.** Sombras leves, bordas finas, animações curtas e gradientes tonais.
4. **O romance aparece na imagem e no texto.** A interface estrutural permanece limpa e funcional.
5. **Confiança precisa ser visível.** Frete, fábrica própria, pagamento seguro, lojas físicas, avaliações e atendimento devem ter presença clara.

## 2. Logotipo

O arquivo oficial atual é `img/settings/JK_logo.svg`, com proporção **3:1** (`300 × 100`) e preenchimento `#BE9B61`.

O símbolo/wordmark tem desenho serifado próprio. Não tentar reconstruí-lo com Montserrat, Georgia ou outra fonte. Em outro projeto, reutilizar o SVG original.

### Regras de uso

- Preferir o logotipo dourado sobre branco, marfim ou carvão.
- Preservar a proporção; nunca esticar apenas em um eixo.
- Altura digital sugerida: `36–54px` no desktop e `28–36px` no mobile.
- Área de respiro mínima: aproximadamente a altura da letra `J` ao redor da marca.
- Em fundos fotográficos, usar uma área sólida ou degradê de proteção; não aplicar sombra pesada no logo.
- Não recolorir para amarelo vivo, verde, azul ou degradê metálico.
- Para favicon, usar o monograma `JK` do arquivo `img/settings/JK_favicon.svg`.

## 3. Paleta de cores

### 3.1 Dourados e tons de assinatura

| Token sugerido | Cor | Uso principal |
|---|---:|---|
| `--jk-gold-500` | `#BE9B60` | Dourado principal da interface: ícones, destaques, barra promocional, controles e CTAs |
| `--jk-gold-logo` | `#BE9B61` | Cor original do SVG do logotipo; preservar no asset |
| `--jk-gold-400` | `#CFA55E` | Dourado luminoso do rodapé, foco e pequenos destaques |
| `--jk-gold-soft` | `#C9A470` | Tags, estados suaves e elementos promocionais secundários |
| `--jk-gold-600` | `#B9965A` | Acento editorial de vitrines e linhas finas |
| `--jk-gold-700` | `#9B7846` | Navegação, ícones ou texto dourado de maior contraste |
| `--jk-gold-800` | `#76582B` | Texto dourado escuro, badges e fundos que precisam receber texto branco |
| `--jk-bronze` | `#AB6D3A` | Apoio quente; usar pouco para não deslocar a marca para o cobre |

O dourado JK é **quente, levemente fosco e amarronzado**. Não é amarelo ouro puro. Em áreas digitais, prefira cor sólida ou variação tonal sutil em vez de efeitos cromados.

### 3.2 Neutros principais

| Token sugerido | Cor | Uso principal |
|---|---:|---|
| `--jk-ink` | `#171512` | Títulos editoriais e texto sobre dourado |
| `--jk-ink-strong` | `#141414` | Texto principal da interface |
| `--jk-charcoal` | `#212121` | Rodapé escuro, painéis de autoridade e títulos |
| `--jk-product-ink` | `#292622` | Nome de produto |
| `--jk-copy` | `#625D56` | Texto editorial secundário |
| `--jk-footer-copy` | `#494949` | Texto de apoio no rodapé |
| `--jk-white` | `#FFFFFF` | Fundo dominante, cartões e texto invertido |
| `--jk-header` | `#F9F9F9` | Fundo do cabeçalho |
| `--jk-surface` | `#F8F8F8` | Rodapé, menu e superfícies neutras |
| `--jk-surface-alt` | `#FBFAF8` | Alternância discreta entre vitrines |
| `--jk-media` | `#F8F7F4` | Fundo de fotografia de produto |
| `--jk-sand` | `#F7F3ED` | Fundo da seção de categorias |
| `--jk-cream` | `#F7F0E4` | Fundo de badge/oferta |
| `--jk-glow` | `#FFFDF9` | Brilho radial e áreas luminosas |
| `--jk-page` | `#FFF6E6` | Canvas marfim para páginas especiais |
| `--jk-border` | `#E8E2D8` | Bordas quentes e discretas |

### 3.3 Cor funcional

O verde aparece como linguagem de canal/ação, sobretudo WhatsApp:

- WhatsApp oficial: `#128C7E` no tema atual ou a cor oficial vigente do canal.
- Não transformar o verde em cor de marca; restringir a ações claramente relacionadas ao WhatsApp, disponibilidade ou sucesso.
- Erro, alerta e sucesso devem usar cores funcionais próprias, sem substituir o dourado institucional.

### 3.4 Combinações preferidas

- Branco `#FFFFFF` + carvão `#171512` + dourado `#BE9B60`.
- Areia `#F7F3ED` + carvão `#241D18` + dourado `#C5A46D`.
- Carvão `#212121` + branco `#FFFFFF` + dourado `#CFA55E`.
- Fundo de vitrine `#FBFAF8` + mídia `#F8F7F4` + borda `#E8E2D8`.

### 3.5 Contraste e acessibilidade

O uso atual de texto branco sobre `#BE9B60` tem contraste aproximado de **2,61:1** e não atende WCAG AA. Para novos projetos:

- em botão dourado, preferir texto `#171512` — contraste aproximado de **6,98:1**;
- quando o texto precisar ser branco, usar fundo `#76582B` — contraste aproximado de **6,56:1**;
- não usar `#BE9B60`, `#CFA55E` ou `#C9A470` como texto pequeno sobre branco;
- para texto dourado sobre fundo claro, preferir `#76582B`;
- manter foco visível com contorno dourado e halo translúcido.

## 4. Tipografia

### Família principal

**Montserrat** é a fonte de interface atual.

```css
font-family: "Montserrat", Arial, sans-serif;
```

Pesos usados: `300`, `400`, `500` e `600`. O sistema evita `700–900` em grandes áreas para manter leveza.

### Hierarquia recomendada

| Papel | Tamanho desktop | Tamanho mobile | Peso | Entrelinha | Tracking |
|---|---:|---:|---:|---:|---:|
| Display/hero | `48–84px` | `36–56px` | `400–500` | `0.98–1.08` | `-0.03em` a `-0.05em` |
| Título editorial de vitrine | `30–44px` | `26–34px` | `400` | `1.06` | `-0.025em` |
| Título de seção/categorias | `26–36px` | `24px` | `600` | `1.12–1.16` | `-0.025em` |
| Subtítulo | `14–18px` | `13–15px` | `400–500` | `1.55–1.65` | `0–0.025em` |
| Corpo | `16px` | `15–16px` | `400` | `1.55–1.75` | normal |
| Nome de produto | `13–14px` | `12px` | `500` | `1.45–1.50` | `0.015em` |
| Preço | `15–18px` | `13–15px` | `600` | `1.3–1.35` | normal |
| Eyebrow/kicker | `10–12px` | `10px` | `600` | `1.2–1.3` | `0.16–0.22em` |
| Botão | `11–14px` | `10–13px` | `600` | `1` | `0.04–0.12em` |

### Regras tipográficas

- Usar caixa normal em títulos emocionais: “Encontre alianças e joias para cada momento”.
- Usar caixa alta apenas em eyebrows, pequenos CTAs editoriais e etiquetas.
- Evitar títulos inteiros em negrito pesado.
- Títulos grandes podem usar `text-wrap: balance`.
- Texto corrido deve permanecer alinhado à esquerda; centralizar apenas introduções curtas de seção.
- Fontes serifadas e manuscritas podem aparecer **dentro de campanhas/banners**, nunca como fonte estrutural da aplicação.

## 5. Espaçamento, grid e ritmo

### Escala base

Usar múltiplos de `4px`, priorizando:

`4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 72, 80, 96px`.

### Containers

- Container geral: até `1400px`.
- Cabeçalho amplo: até `1440px`.
- Conteúdo concentrado de categorias: até `1240px`.
- Textos introdutórios: `680–780px`.
- Gutter desktop: `20–24px`.
- Gutter mobile: `14–20px`.

### Espaçamento vertical

- Seção compacta: `44px`.
- Seção padrão: `72px`.
- Seção ampla/editorial: `96px`.
- Mobile: normalmente `40–48px`.
- Distância título → descrição: `12–16px`.
- Distância cabeçalho da seção → conteúdo: `28–44px`.

### Breakpoints observados

- `575px`: ajustes finos para celular.
- `767px`: mudança principal entre mobile e desktop.
- `860–1100px`: colapso de grids editoriais e newsletter.
- `1200–1500px`: compactação de navegação e containers.

O projeto novo pode reorganizar os breakpoints, mas deve preservar o comportamento: desktop arejado, tablet sem esmagar a navegação e mobile com dois produtos por linha quando houver espaço.

## 6. Bordas, raios e formas

O raio-base atual é `10px`.

| Elemento | Raio recomendado |
|---|---:|
| Campo, botão comum, dropdown | `10px` |
| Mídia de produto | `14px` |
| Cartão editorial | `18–24px` |
| Newsletter/painel de destaque | `20–32px` |
| Badge e CTA editorial | `999px` |
| Ícone circular | `50%` |
| Categoria | `32–50%`, de acordo com a direção escolhida |

Misturar raios é aceitável quando existe hierarquia. Não usar todos os elementos como cápsulas e não aplicar cantos excessivamente arredondados em banners de largura total.

## 7. Efeitos visuais

### Bordas

- Preferir `1px` e tons quentes/translúcidos.
- Produto: `#E8E2D8` ou mistura do dourado com transparência.
- Separador: degradê linear `transparent → dourado → transparent`, com opacidade baixa.

### Sombras

Sombras devem ser difusas e discretas:

```css
--jk-shadow-soft: 0 12px 30px rgb(0 0 0 / 9%);
--jk-shadow-warm: 0 24px 64px rgb(75 53 23 / 8%);
--jk-shadow-focus: 0 0 0 3px rgb(190 155 96 / 18%);
--jk-inset-light: inset 0 1px 0 rgb(255 255 255 / 78%);
```

Evitar sombras pretas duras, grandes elevações em todos os cartões e glow dourado saturado.

### Gradientes e brilho

- Fundo de categorias: areia com brilho radial branco/marfim no topo.
- Newsletter: carvão com variação tonal dourada muito discreta.
- Cartão de produto: fundo liso com borda em degradê quase imperceptível.
- Seção sazonal: degradê tonal do próprio dourado, sem simular metal 3D.
- Órbitas, círculos e linhas finas podem aparecer em painéis institucionais com `10–38%` de opacidade.

### Movimento

- Microinteração: `180–260ms ease`.
- Elevação/hover de cartão: `350–450ms cubic-bezier(.2, .75, .25, 1)`.
- Zoom de imagem: `550–650ms`, escala máxima `1.025–1.04`.
- Entrada de conteúdo: `560–620ms cubic-bezier(.22, 1, .36, 1)`.
- Deslocamento máximo em hover: `2–4px`.
- Implementar `prefers-reduced-motion: reduce` e remover transformações não essenciais.

## 8. Componentes da home

### 8.1 Barra promocional

- Fundo dourado `#BE9B60`.
- Texto curto, centralizado ou em movimento horizontal.
- Altura visual compacta; não competir com o hero.
- Usar para uma mensagem por vez: desconto, frete ou campanha.
- No novo projeto, usar texto carvão sobre dourado para contraste; se a direção exigir branco, escurecer o fundo.

### 8.2 Cabeçalho

- Fundo `#F9F9F9` ou branco quente.
- Logo dourado à esquerda.
- Busca ampla com `44px` de altura, borda dourada translúcida e raio `10px`.
- Ícones lineares dourados, aproximadamente `23–24px`, com traço leve (`1.4–1.6px`).
- Áreas clicáveis de pelo menos `42–44px`.
- Navegação principal em Montserrat `14px`, peso `500–600`.
- Comportamento sticky; ao rolar, compactar sem saltos bruscos.
- Sugestões de busca em superfície branca, raio `10px` e sombra suave.

### 8.3 Hero/banner

- Largura total, fotografia luminosa e composição horizontal no desktop.
- Criar arte mobile própria; não apenas cortar a imagem desktop.
- Produto e pessoas podem coexistir, mas a joia deve continuar legível.
- Paleta da campanha pode trazer vinho, rosé ou tons de pele; dourado e neutros conectam a peça à marca.
- Texto embutido na arte pode usar serifada/manuscrita para emoção, desde que a UI ao redor permaneça Montserrat.
- Controles do carrossel em dourado, pequenos e discretos.

### 8.4 Faixa de benefícios

Apresentar de quatro a seis benefícios com ícone pequeno e texto direto, por exemplo:

- frete grátis;
- desconto no Pix;
- parcelamento;
- direto da fábrica;
- compra segura;
- retire na loja.

Usar fundo branco, divisores finos e ícones dourados. No mobile, manter legibilidade mesmo que a faixa se torne carrossel.

### 8.5 Categorias

- Fundo canônico: `#F7F3ED`.
- Brilho: `radial-gradient(circle, #FFFDF9 0%, transparent 68%)`.
- Título: `#241D18`, peso `600`.
- Descrição: `#6C625B`.
- Mídia: fundo branco, borda `#FFFFFF → #C5A46D`.
- Nome: `#302820`, `15px`, peso `600`.
- Navegação: `#9B7846`.
- A imagem começa levemente dessaturada (`72%`) e ganha saturação no hover (`112%`).
- Hover: subir `4px` e escalar até `1.04`.

### 8.6 Vitrines editoriais

- Alternar `#FFFFFF` e `#FBFAF8` entre blocos longos.
- Usar kicker dourado em caixa alta e tracking amplo.
- Título com peso `400`, grande e compacto.
- Divisor dourado de `36px × 1px`.
- Cabeçalho pode ficar lateral no desktop e centralizado em telas menores.
- CTA secundário em outline, formato cápsula e caixa alta.

### 8.7 Cartão de produto

- Fundo do cartão transparente; o quadro da foto cria a superfície.
- Área da foto quadrada (`1:1`) com fundo `#F8F7F4`.
- Raio da mídia: `14px`.
- Borda: `#E8E2D8`, com leve variação dourada.
- Nome: `#292622`, `13px`, peso `500`, máximo de duas linhas.
- Preço atual: `#171512`, peso `600`.
- Preço anterior: menor, opacidade aproximada de `72%` e tachado.
- Badge: fundo `#F7F0E4`, texto `#76582B`, cápsula, `10px`, peso `600`.
- Hover: elevação de `2px`, zoom de imagem de `1.025` e pequeno aumento de saturação.
- Evitar sombra de cartão permanente; borda, fundo e imagem devem fazer o trabalho.

### 8.8 Botões

**Primário acessível**

- fundo `#BE9B60`;
- texto `#171512`;
- altura `44–52px`;
- peso `600`;
- raio `10px` ou cápsula conforme o contexto.

**Primário escuro**

- fundo `#76582B` ou `#212121`;
- texto branco;
- detalhe/foco dourado.

**Secundário editorial**

- fundo transparente;
- borda `#171512`;
- texto `#171512`;
- hover invertido.

**WhatsApp**

- usar verde apenas em ações do canal;
- ícone e texto devem deixar claro que a ação abre atendimento.

### 8.9 Avaliações e prova social

- Fundo branco.
- Borda quente muito clara: `#F4F0E8`.
- Nome: `#333333`, peso `600`.
- Depoimento: `#555555`, entrelinha confortável.
- Fotos reais e linguagem acolhedora aumentam a percepção de confiança.
- Não exagerar em estrelas, selos ou números simultâneos.

### 8.10 Newsletter

- Seção externa `#F8F8F8`.
- Painel interno carvão `#212121` com acento `#BE9B60`.
- Título grande, peso `400`, branco.
- Eyebrow dourado, uppercase e tracking `0.2em`.
- Painel com raio `20–32px` e linhas orbitais muito sutis.
- Campos claros, `53px` de altura, raio aproximado de `14px`.
- Foco dourado com halo de `3px`.
- Copy emocional, curta e exclusiva: “Histórias especiais merecem escolhas especiais.”

### 8.11 Rodapé

- Base `#F8F8F8`, detalhes brancos e texto `#212121`/`#494949`.
- Dourado de apoio `#CFA55E`.
- Painel de autoridade em `#212121`, texto branco e números dourados.
- Usar eyebrows, estatísticas, lojas físicas, segurança e pagamento para construir confiança.
- Bordas de `1px`, cartões internos entre `12–20px` de raio e pouco contraste de elevação.

### 8.12 Ações flutuantes

- WhatsApp pode permanecer fixo no canto inferior direito.
- Tamanho mínimo `48px`.
- Manter distância segura de banners de cookie, navegação mobile e botão “voltar ao topo”.
- Evitar mais de duas ações flutuantes simultâneas.

## 9. Fotografia e direção de arte

### Produto

- Fundo branco, areia, bege ou cinza muito claro.
- Luz difusa, reflexos controlados e metal nítido.
- Recorte limpo para catálogo; enquadramento editorial para campanhas.
- Não usar filtros frios azulados como padrão.

### Lifestyle

- Casais, pedidos, celebrações e presentes.
- Tons de pele naturais, luz quente e sensação de proximidade.
- Figurino neutro ou em vinho/rosé quando a campanha pedir contraste.
- Gestos e mãos devem valorizar a joia, sem pose artificial excessiva.

### Composição

- Reservar área negativa para título e CTA.
- No desktop, equilibrar pessoa/texto/produto.
- No mobile, reenquadrar e reduzir a quantidade de texto.
- Não sobrepor texto fino diretamente sobre áreas muito detalhadas.

## 10. Iconografia

- Estilo linear, simples e reconhecível.
- Traço entre `1.4px` e `1.7px`.
- Cor padrão dourada; carvão para estados neutros.
- Tamanhos comuns: `18px`, `23–24px` e `32px`.
- Preferir SVG a fontes de ícones.
- Ícones de categoria podem ser ilustrativos, mas devem manter fundo claro e tratamento cromático suave.
- Não misturar ícones preenchidos pesados com o conjunto linear do cabeçalho.

## 11. Tom de voz aplicado à interface

O texto deve ser humano, direto e emocional, sem parecer rebuscado.

### Preferir

- “Encontre alianças e joias para cada momento.”
- “Com você nos momentos mais especiais.”
- “Direto da fábrica.”
- “Uma história feita para durar.”
- “Receba inspirações e condições selecionadas.”

### Evitar

- excesso de superlativos (“a melhor joia do universo”);
- linguagem fria de sistema em áreas emocionais;
- urgência artificial em todas as seções;
- vários CTAs competindo com a mesma intensidade;
- caixa alta em parágrafos ou títulos longos.

## 12. Tokens CSS prontos para reutilização

```css
:root {
  /* Marca */
  --jk-gold-logo: #be9b61;
  --jk-gold-400: #cfa55e;
  --jk-gold-500: #be9b60;
  --jk-gold-soft: #c9a470;
  --jk-gold-600: #b9965a;
  --jk-gold-700: #9b7846;
  --jk-gold-800: #76582b;
  --jk-bronze: #ab6d3a;

  /* Texto */
  --jk-ink: #171512;
  --jk-ink-strong: #141414;
  --jk-charcoal: #212121;
  --jk-product-ink: #292622;
  --jk-copy: #625d56;
  --jk-copy-muted: #6c625b;
  --jk-footer-copy: #494949;

  /* Superfícies */
  --jk-white: #ffffff;
  --jk-header: #f9f9f9;
  --jk-surface: #f8f8f8;
  --jk-surface-alt: #fbfaf8;
  --jk-media: #f8f7f4;
  --jk-sand: #f7f3ed;
  --jk-cream: #f7f0e4;
  --jk-glow: #fffdf9;
  --jk-page: #fff6e6;
  --jk-border: #e8e2d8;

  /* Tipografia */
  --jk-font: "Montserrat", Arial, sans-serif;

  /* Raio */
  --jk-radius-sm: 10px;
  --jk-radius-md: 14px;
  --jk-radius-lg: 20px;
  --jk-radius-xl: 32px;
  --jk-radius-pill: 999px;

  /* Espaçamento */
  --jk-space-1: 4px;
  --jk-space-2: 8px;
  --jk-space-3: 12px;
  --jk-space-4: 16px;
  --jk-space-5: 20px;
  --jk-space-6: 24px;
  --jk-space-8: 32px;
  --jk-space-12: 48px;
  --jk-space-16: 64px;
  --jk-space-18: 72px;
  --jk-space-24: 96px;

  /* Elevação */
  --jk-shadow-soft: 0 12px 30px rgb(0 0 0 / 9%);
  --jk-shadow-warm: 0 24px 64px rgb(75 53 23 / 8%);
  --jk-shadow-focus: 0 0 0 3px rgb(190 155 96 / 18%);

  /* Movimento */
  --jk-ease-ui: 220ms ease;
  --jk-ease-lift: 380ms cubic-bezier(.2, .75, .25, 1);
  --jk-ease-enter: 580ms cubic-bezier(.22, 1, .36, 1);
}

body {
  margin: 0;
  background: var(--jk-white);
  color: var(--jk-ink-strong);
  font-family: var(--jk-font);
  font-size: 16px;
  line-height: 1.6;
}

:focus-visible {
  outline: 2px solid var(--jk-gold-500);
  outline-offset: 3px;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    scroll-behavior: auto !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

## 13. Padrões rápidos de implementação

### Botão primário

```css
.jk-button-primary {
  display: inline-flex;
  min-height: 48px;
  align-items: center;
  justify-content: center;
  padding: 0 24px;
  border: 1px solid transparent;
  border-radius: var(--jk-radius-sm);
  background: var(--jk-gold-500);
  color: var(--jk-ink);
  font: 600 13px/1 var(--jk-font);
  transition: filter var(--jk-ease-ui), transform var(--jk-ease-ui);
}

.jk-button-primary:hover {
  filter: brightness(1.04);
  transform: translateY(-1px);
}
```

### Cartão de produto

```css
.jk-product-card__media {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--jk-border);
  border-radius: var(--jk-radius-md);
  background: var(--jk-media);
  aspect-ratio: 1;
}

.jk-product-card__media img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  transition: transform 650ms cubic-bezier(.2, .75, .25, 1),
              filter 350ms ease;
}

.jk-product-card:hover .jk-product-card__media img {
  filter: saturate(1.08) contrast(1.015);
  transform: scale(1.025);
}
```

### Fundo editorial de categorias

```css
.jk-categories {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  background: var(--jk-sand);
}

.jk-categories::before {
  position: absolute;
  z-index: -1;
  top: -18rem;
  left: 50%;
  width: min(90vw, 72rem);
  height: 32rem;
  border-radius: 50%;
  background: radial-gradient(circle, var(--jk-glow) 0%, transparent 68%);
  content: "";
  transform: translateX(-50%);
}
```

## 14. Checklist para um novo projeto

- [ ] Usar o SVG oficial do logotipo sem reconstruí-lo.
- [ ] Configurar Montserrat como fonte principal.
- [ ] Usar `#BE9B60` como dourado principal e `#171512` como tinta editorial.
- [ ] Manter branco/marfim como superfícies dominantes.
- [ ] Garantir contraste AA em botões, textos e foco.
- [ ] Trabalhar com fotografia clara, quente e centrada na joia.
- [ ] Usar raio-base de `10px` e mídia de produto em `14px`.
- [ ] Manter sombras suaves e bordas de `1px`.
- [ ] Limitar hover a pequenos deslocamentos e zoom discreto.
- [ ] Criar arte de hero específica para mobile.
- [ ] Separar cor de marca de cores funcionais, como WhatsApp.
- [ ] Exibir sinais de confiança sem poluir a interface.
- [ ] Respeitar `prefers-reduced-motion`.
- [ ] Validar desktop, tablet e mobile antes de publicar.

## 15. Fonte de verdade no tema atual

Os principais pontos usados nesta consolidação estão em:

- `configs/settings.json` — cores e configurações ativas;
- `img/settings/JK_logo.svg` — wordmark e dourado oficial do asset;
- `elements/css-variables.html` — tokens globais;
- `elements/header-horizontal.html` — cabeçalho e responsividade;
- `elements/snippets/categorias.html` — categorias;
- `elements/showcase.html` e `css/devrocket.css` — vitrines editoriais e cartões;
- `elements/snippets/newsletter.html` — newsletter;
- `elements/footer.html` — rodapé, autoridade e confiança;
- `pages/home.html` — ordem e hierarquia dos blocos da home.

Se houver divergência futura entre este documento e o tema publicado, considerar primeiro o logotipo oficial, depois os tokens salvos no tema e, por fim, as regras editoriais deste guia.
