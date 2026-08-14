# REGRAS.md, padrões inegociáveis do Portal JK Alianças

> Leitura obrigatória antes de escrever qualquer linha de conteúdo ou de código.
> Visão e escopo estão em [`PROJETO.md`](PROJETO.md). Operação está em [`CLAUDE.md`](CLAUDE.md).
> Este arquivo existe para eliminar retrabalho. Se algo aqui for violado, corrija antes de seguir.

---

## 1. Como escrever (voz da marca)

Regras absolutas para todo texto visível: conteúdo do portal, títulos, meta descriptions,
microcópia de botão, mensagens de erro, e-mails, rótulos do admin.

**Proibido:**

* **Travessão. Nunca.** Não usar o travessão longo nem o traço médio em nenhum texto. Use vírgula, dois pontos, ponto final ou parênteses.
* Linguagem de robô. Nada de "otimize sua experiência", "solução completa", "não perca tempo".
* Cara de texto gerado por IA. Sem "vamos mergulhar", "neste artigo você vai descobrir", "em resumo", "é importante ressaltar", "no mundo de hoje".
* Afirmação genérica forçada. Se a frase serve para qualquer joalheria do Brasil, ela não serve para a JK.
* Adjetivo sem prova. "A melhor aliança" só entra se houver fonte aprovada pela JK.
* Emoji em conteúdo editorial. Permitido só na interface do admin quando ajudar a escanear a tela.
* Palavra empilhada para SEO. Repetir "aliança de namoro" sete vezes derruba a leitura e não sobe posição.

**Obrigatório:**

* Clareza e objetividade. Frase curta. Uma ideia por parágrafo.
* Resposta primeiro. O primeiro parágrafo responde a dúvida principal, sem enrolação.
* Português do Brasil, tom de quem entende de joia e explica sem arrogância.
* Dado concreto no lugar de promessa vaga. "Prata 950 tem 95% de prata pura" vale mais que "qualidade superior".
* Voz ativa. "Meça o dedo no fim do dia" no lugar de "recomenda-se que a medição seja feita".
* Toda afirmação factual precisa de fonte registrada na tabela `sources`.

**Teste rápido antes de publicar:** leia em voz alta. Se soar como folheto ou como robô, reescreva.

### Vocabulário do site (decidido em 14/08/2026)

Somos gente normal escrevendo para gente normal. Nem formal, nem gíria forçada.
Palavra simples, e de preferência a palavra que a pessoa **digita no Google**.

* **Nada de duplo sentido.** Aliança se experimenta, se prova na loja, se mede.
  Frase que provoca risada no grupo do WhatsApp está errada, por mais elegante
  que pareça na tela. Foram cortadas por isso: "Prove no dedo" (virou
  "Experimente antes de comprar" e "Experimente na loja mais perto de você") e
  "O tamanho certo, resolvido na tela" (virou "Descubra o tamanho e a largura da
  sua aliança").
* **Nada de frase que ninguém fala.** "Tudo sobre alianças, respondido direto"
  não é jeito de escrever nem de ler; o H1 da home virou "Tudo sobre alianças de
  casamento e namoro", que é como a pessoa pergunta.
* **Nome de seção é o nome que as pessoas conhecem.** A lista de conteúdo é
  "Últimos posts" na home e "Dicas sobre alianças" no índice, não "Guias de
  alianças", que ninguém busca. A URL continua `/guia`, porque endereço com
  histórico de busca não se mexe.
* **A ferramenta se chama pelo produto, não pela medida interna.** É "Medidor de
  aliança", não "Medidor de aro". "Aro" continua valendo dentro do texto, porque
  é o termo do mercado e da busca, mas não é o nome da porta.
* **"Portal" é palavra nossa, não da pessoa.** Na tela se escreve "site".


---

## 2. SEO e GEO em tudo, sem exceção

O objetivo é rankear no Google e ser citado por IA (ChatGPT, Gemini, Perplexity, Claude).
Nada entra no ar sem passar por esta lista.

### Toda página precisa de

| Item | Regra |
|---|---|
| Título (H1) | Único na página, com a consulta principal, até 60 caracteres no `<title>` |
| Meta description | 140 a 160 caracteres, escrita para o clique, sem repetir o título |
| URL (slug) | Curto, com a palavra-alvo, sem data, sem stopword inútil |
| Canonical | Absoluto e único |
| Bloco de resposta rápida | Primeiro elemento do conteúdo, 2 a 4 frases, autossuficiente |
| Hierarquia de headings | H1 único, H2 por seção, H3 dentro da seção, sem pular nível |
| FAQ | Perguntas reais, com resposta objetiva, visíveis na página. O `FAQPage` continua sendo emitido, mas **não existe mais rich result de FAQ no Google** (encerrado em 07/05/2026). A FAQ vale por leitor e por citação em IA, não por aparecer diferente na busca |
| Links internos | No mínimo 2 de entrada e 2 de saída, âncora descritiva, nunca "clique aqui" |
| Schema JSON-LD | `Article`, `BreadcrumbList`, `FAQPage`, `Organization`, `LocalBusiness` conforme o caso |
| Intenção de busca | Registrada no campo `search_intent`, para evitar canibalização |
| Data | `publishedAt` e `updatedAt` visíveis e no schema |
| Autor e revisor | Pessoa **cadastrada em Autores**, com página própria em `/autor/[slug]`. A assinatura no guia leva até ela e o `Article` sai com `author.url`. Nome em texto livre é sobra, não o padrão |
| Preview | `max-image-preview:large` em toda página indexável. Sem isso a miniatura na busca sai pequena e a página fica **inelegível para o Google Discover** |

### Regras específicas de GEO (respostas de IA)

* Nomear a entidade completa, "JK Alianças", pelo menos uma vez nos primeiros parágrafos.
* Escrever trechos citáveis: frases que fazem sentido sozinhas, fora do contexto do parágrafo.
* Preferir dado verificável e específico, que é o que a IA consegue citar com segurança.
* Tabela comparativa sempre que houver comparação, porque IA extrai tabela muito bem.
* Manter `llms.txt` atualizado com os conteúdos publicados. Atenção: **o Google confirmou em 15/06/2026 que não usa o arquivo**, e que ele nem ajuda nem atrapalha o ranqueamento. Ele fica no ar para os outros sistemas que leem esse formato, e não conta como item de GEO no Google.
* `robots.txt` liberado para os crawlers de IA.
* Nunca fabricar `AggregateRating`, preço, estoque ou avaliação.

### Imagem, regra própria

Nenhuma imagem entra sem:

* `alt` descritivo e útil, escrito para quem não enxerga a foto, com a palavra-alvo só quando fizer sentido natural.
* Legenda quando agrega contexto.
* Crédito ou fonte quando aplicável.
* Nome de arquivo em slug legível, `alianca-prata-950-3mm.webp`, nunca `IMG_4821.jpg`.
* **Conversão automática para WebP no envio** (feita no navegador, antes do upload), com redimensionamento acima de 2000px de largura. WebP porque entrega o mesmo visual com arquivo bem menor, é suportado em todo lugar e velocidade conta como fator de ranqueamento. AVIF comprime mais, porém codifica devagar no navegador, então fica fora. SVG e GIF animado não são convertidos.
* Dimensão declarada na origem (evita salto de layout), `loading="lazy"` fora da dobra.
* `next/image` sempre, para evitar CLS.
* Schema `ImageObject` no conteúdo e imagem incluída no sitemap de imagens.
* Legenda e crédito viram `caption`, `creditText` e `copyrightNotice` no `ImageObject`, e a imagem entra no corpo como `<figure>` com `<figcaption>`. Campo preenchido na biblioteca que não chega à página é campo perdido.
* **Capa com no mínimo 1200px de largura e proporção perto de 1,78:1.** É o requisito publicado do Discover. O editor avisa quando a capa está fora.

### Produto vindo da Tray

* `Product` schema só com produto real e dado sincronizado.
* Preço, estoque e disponibilidade são espelho da Tray, nunca editados aqui.
* Link para o produto na Tray com UTM de origem.

### Loja (SEO local)

* NAP idêntico ao do Google Meu Negócio, sem variação de abreviação.
* `LocalBusiness` ou `JewelryStore` com endereço, telefone, horário, geo.
* Link de rota e telefone clicável, com evento de clique medido.

---

## 3. Como construir (facilidade e utilidade acima de tudo)

Quem usa o admin é editor de conteúdo, não desenvolvedor. Se precisa de explicação, está mal feito.

**Princípios:**

* **Editor em blocos, estilo Notion, melhor que Word.** Botão `+` sempre disponível abaixo do bloco atual, abrindo: Texto, Título (H2, H3), Imagem, Lista, Tabela, Citação, Divisor, FAQ, Produto, Chamada para ação, Bloco de resposta rápida.
* **Barra de comando com `/`.** Digitar `/` abre o mesmo menu, sem tirar a mão do teclado.
* **Preview fiel.** O editor renderiza com a mesma tipografia, cor e largura do site publicado. O que se vê é o que vai ao ar.
* **Preview de resultado.** Mostrar como o conteúdo aparece na busca do Google e no compartilhamento (card de link), em tempo real.
* **Arrastar para reordenar** blocos, com alça visível ao passar o mouse.
* **Salvamento automático** com indicação clara de "salvo" e histórico de versões.
* **Nada de campo obrigatório escondido.** Se falta `alt` na imagem, o aviso aparece no bloco, não no fim do formulário.
* **Atalhos:** `Ctrl/Cmd + S` salva, `Ctrl/Cmd + K` insere link, `Ctrl/Cmd + Enter` publica.
* **Toda ação destrutiva pede confirmação** e é reversível.

**Estados do conteúdo, todos com um clique:**

`Rascunho` → `Em revisão` → `Pronto para publicar` → `Publicado` → `Arquivado`

* **Duplicar:** cria cópia em rascunho, com slug novo, sem tocar no original.
* **Apagar:** é sempre soft delete (desativa e preserva histórico). Remoção definitiva só por admin, com confirmação por escrito.
* **Agendar publicação:** data e hora, com fuso de São Paulo.
* **Restaurar versão anterior** a partir do histórico.

---

## 4. Seletor de cores

Sempre o melhor disponível, nunca um `<input type="color">` cru.

* Campo com **HEX de 6 e 8 dígitos** (`#BE9B60`, `#BE9B60CC`), aceitando colar valor.
* Suporte a **RGB, HSL e alpha**, com controle de opacidade em barra própria e valor numérico.
* Amostra com fundo xadrez para transparência.
* **Paleta da marca fixada** no topo (dourado `#BE9B60`, dourado claro `#D8B877`, dourado nav `#9B7846`, bordô `#7A2230`, carvão `#1A1815`, marfim `#F7F3EC`).
* **Aviso de contraste WCAG** ao vivo: mostra a razão de contraste e se passa AA para texto normal e grande. Reprovou, avisa antes de salvar.
* Cores usadas recentemente ficam acessíveis.
* Biblioteca escolhida: `react-colorful` (MIT, leve, acessível, sem dependência).

---

## 5. Ferramentas, sempre a melhor opção gratuita

Escolha justificada, com licença verificada. Antes de trocar qualquer item, verifique a licença de novo.

| Necessidade | Escolha | Licença | Por quê |
|---|---|---|---|
| Editor de conteúdo | **TipTap v3 core** (ProseMirror) | MIT | Controle total do HTML gerado, que é o que decide o SEO. UI própria no estilo Notion. Sem pegadinha de licença. |
| Alternativa avaliada | BlockNote | MPL-2.0 no core, **GPL-3.0 nos pacotes XL** | UX pronta, porém os pacotes XL são GPL e contaminariam o projeto comercial. **Não usar XL.** |
| Seletor de cor | react-colorful | MIT | 3 KB, acessível, suporta alpha |
| 3D no navegador | **three.js** | MIT | Padrão de fato do WebGL, mantido há anos e sem pegadinha de licença. Entra por `import()` dentro do componente, então só baixa quando o visor da aliança aparece na tela. **Regra: nada de arquivo `.obj` ou `.gltf` de terceiro no projeto.** Aliança lisa é sólido de revolução, e a malha nasce do contorno em `src/lib/aliancas/perfis.ts`: assim toda combinação de modelo, formato, largura, espessura e aro sai da mesma matemática, sem download, sem licença de modelo e sem malha que discorde do desenho do corte. |
| Ícones | lucide-react | ISC | Consistente, leve, cobre o admin inteiro |
| Formulários e validação | react-hook-form + zod | MIT | Validação no cliente e no servidor com o mesmo schema |
| Upload e imagem | Supabase Storage + `next/image` | Apache 2.0 / MIT | Já faz parte da stack, com RLS |
| Tabelas do admin | TanStack Table | MIT | Ordenação, filtro e paginação sem travar |
| Datas | date-fns | MIT | Leve, com locale pt-BR |
| Análise de SEO/GEO | OpenAI API + regras próprias | comercial (chave do cliente) | Ver seção 7 |
| Métricas | Search Console API, GA4, GTM | gratuito | Já previsto no Trello |

**Regra:** nada de biblioteca abandonada. Antes de adotar, confira commit recente, issues abertas e licença.

---

## 6. Personalização

* Toda escolha visual do editor sai dos tokens da marca definidos em `globals.css`, nunca de valor solto no meio do código.
* O que o editor oferece precisa existir no site publicado, com a mesma aparência.
* Sem opção que quebre acessibilidade. Se a combinação reprova no contraste, o editor avisa e sugere a mais próxima que passa.

---

## 7. Inteligência artificial no fluxo (OpenAI)

A chave da API é fornecida pela JK e fica **somente no servidor**, em `OPENAI_API_KEY`, nunca com prefixo `NEXT_PUBLIC_`.

**O analisador roda em duas camadas:**

1. **Camada determinística (sem IA, instantânea).** Roda enquanto digita: tamanho de título e meta, presença da palavra-alvo, densidade da consulta alvo, título e meta repetidos entre páginas, hierarquia de headings, `alt` faltando, `alt` repetido, imagem sem dimensão, tabela sem cabeçalho, vídeo sem título, página órfã, densidade de link interno, legibilidade, presença do bloco de resposta rápida, schema completo. Resultado em verde, amarelo ou vermelho, com o que corrigir.

   **Parte destes erros BARRA a publicação**, no servidor, pelas duas portas (editor e lista): travessão, imagem sem `alt`, `<h1>` dentro do corpo, marcador "Escreva aqui" pendente, título ou meta vazios e slug inválido. O resto continua sendo conselho. A mensagem lista exatamente o que corrigir.

2. **Camada com IA (OpenAI, sob demanda).** Botão "Analisar com IA" entrega:
   * Nota de SEO e nota de GEO, com justificativa curta.
   * O texto responde de fato a intenção de busca declarada.
   * Trechos citáveis por IA, e sugestão de reescrita dos que não são.
   * Perguntas que o leitor faria e o texto não responde, viram sugestão de FAQ.
   * Sugestão de título e meta description alternativos.
   * Risco de canibalização com conteúdo já publicado.
   * Verificação de voz da marca, aplicando a seção 1 deste documento, inclusive apontando travessão e frase de robô.

**Limites:** a IA sugere, o humano decide. Nada é publicado automaticamente. Toda sugestão aceita fica registrada em `revisions`. A IA nunca inventa dado institucional, preço ou avaliação.

---

## 8. Padrão de entrega

* Nada de solução amadora ou "depois a gente melhora".
* Antes de dar por pronto: funciona, tem estado de erro, estado vazio e carregamento, é responsivo, passa em contraste, funciona por teclado.
* Verificar no navegador de verdade, com dado real, e não só supor que funciona.
* Código em pt-BR nos textos e nos comentários, seguindo o padrão do repositório.
* Sem chave secreta no cliente. Sem `console.log` esquecido. Sem `any` gratuito no TypeScript.

---

## 9. Checklist de publicação

Não publique sem marcar todos:

- [ ] Responde a dúvida principal no primeiro bloco
- [ ] Sem travessão, sem linguagem de robô, sem frase genérica
- [ ] Título, meta description, slug e canonical revisados
- [ ] Palavra-alvo e intenção de busca definidas, sem canibalizar conteúdo existente
- [ ] Hierarquia de headings correta
- [ ] Toda imagem com `alt`, legenda quando útil, formato moderno e nome de arquivo legível
- [ ] Links internos de entrada e de saída
- [ ] FAQ real, espelhada no schema
- [ ] JSON-LD validado
- [ ] Fonte registrada para cada afirmação factual
- [ ] Autor e revisor preenchidos, com pessoa cadastrada em Autores sempre que possível
- [ ] Capa dentro do padrão do Discover (1200px, perto de 16:9)
- [ ] Produtos relacionados vinculados, quando fizer sentido
- [ ] Chamada para ação clara
- [ ] Preview de Google e de compartilhamento conferidos
- [ ] Analisador de SEO e GEO no verde
- [ ] Revisão humana feita

---

_Atualizado em 12/08/2026. Mudou a regra? Atualize aqui primeiro, depois o código._
