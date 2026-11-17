# O catálogo do Meta e do Google pelo painel

O painel publica o arquivo que alimenta o catálogo de produtos do Meta (o
"Products for JK Alianças" do Commerce Manager) e o do Google Merchant, no
lugar do arquivo que a Tray gera. Os endereços são:

- Meta: `https://www.jkaliancas.com.br/guias/api/catalogo/meta.xml`
- Google: `https://www.jkaliancas.com.br/guias/api/catalogo/google.xml`

**Nada foi trocado no Commerce Manager nem no Google.** Em 17/11/2026 o Filipe
decidiu tirar da Tray a medição do Meta, o catálogo e a loja do Facebook e do
Instagram (a integração "Facebook e Instagram" da Tray caiu em 15/11 para todas
as lojas). Tudo é montado agora e liga em 01/12, quando ele assume o tráfego.
Durante a Black nada muda nas campanhas. O passo de 01/12 está no fim deste
documento.

## A regra que não pode quebrar: o código do produto

`g:id` é o `tray_id` do produto, o mesmo `content_id` que o pixel manda. Se o
código mudar, o anúncio de catálogo perde o histórico daquele produto e a
marcação de produto do Instagram quebra. O arquivo do painel usa exatamente os
mesmos códigos da Tray, e a conferência (`npm run verificar:catalogo`) compara
os dois arquivos item a item antes da troca.

O link de cada produto leva `?parceiro=1516` no arquivo do Meta e
`?parceiro=1517` no do Google. É por esse parâmetro que a Tray e o coletor de
origem (`docs/origem-do-pedido.md`) reconhecem a venda que veio do catálogo.

## De onde vem cada campo

| Campo | De onde vem |
|---|---|
| `id` | `products.tray_id` |
| `title` | o nome como a loja escreveu (`raw.name`), sem aparar, como a Tray |
| `link` | `products.url` mais o `parceiro` |
| `price`, `sale_price`, `sale_price_effective_date` | `products`, pela MESMA conta do site (`precoVigente`), com as datas da promoção do `raw`. Promoção vencida ou que ainda não começou não entra |
| `availability` | `in stock` para todo item, porque só entra produto disponível (`products.status`), como na Tray |
| `image_link`, `additional_image_link` | as fotos na ordem da loja, pela API da Tray: a principal e no máximo mais três, como a Tray |
| `description` | a descrição completa da loja, pela API, sem as marcações HTML e cortada em 5.000 caracteres |
| `brand` | `raw.brand`; produto sem marca na loja sai sem marca, como na Tray |
| `product_type` | o caminho da categoria principal na árvore da loja |
| `mpn` | código, referência e modelo colados, como a Tray faz (`2625ANF.012JKVários Cursos`) |
| `gtin` | o EAN da loja, quando existe |
| `condition` | `new` |
| `shipping_weight`, `shipping_size` | peso e medidas da loja, pela API |

A busca pública da loja, que é de onde vem o espelho `products`, entrega uma
foto só e a descrição curta. Fotos, descrição completa, referência, modelo,
EAN, peso e medidas vêm de `GET /products/{id}`, uma rota que o aplicativo já
usa e que está homologada (`docs/tray-api-de-pedidos.md`).

### Três detalhes que parecem defeito e ficam iguais de propósito

- **O `&gt;` no tipo do produto.** A Tray escapa o separador duas vezes, e o
  Meta recebe "Anéis &gt; Anéis de Formatura &gt; Anel de Ouro 18k", com o
  `&gt;` escrito por extenso. O painel manda igual (`SEPARADOR_DO_TIPO` em
  `src/lib/catalogo/arquivo.ts`), porque conjunto de produtos do Commerce
  Manager pode filtrar pelo tipo e trocar o texto na virada tiraria produto de
  conjunto sem ninguém ver. Corrigir para " > " é uma decisão para depois de
  conferir os filtros dos conjuntos.
- **A descrição não junta espaços.** A Tray tira as marcações, troca cada
  quebra de linha por um espaço, apaga a tabulação, troca travessão por hífen
  e apara as pontas, sem juntar os espaços que sobram no meio. O painel faz o
  mesmo, para o texto sair idêntico.
- **Três fotos extras, no máximo.** Nenhum item da Tray tem mais de três
  `additional_image_link`, e 292 produtos têm mais fotos que isso na loja. O
  Meta aceita até vinte. Ficar em três deixa a troca sem mudança nas fotos;
  subir é mudar `LIMITE_DE_FOTOS_EXTRAS`.

## Quem entra no arquivo

A Tray põe 711 produtos no arquivo e o painel tinha 953 ativos e disponíveis
em 17/11/2026. **A diferença é toda de categoria principal**, sem nenhuma
exceção: todo produto disponível das categorias abaixo estava no arquivo, e
nenhum de fora delas.

- **Entram com tudo o que está embaixo:** Alianças de Namoro (7), Alianças de
  Casamento (23) e Anéis (233), menos Anéis Semijoias (229).
- **Entram sozinhas, sem as de baixo:** Joias (11), Joias de Prata (121) e
  Joias de Ouro 18k (127).
- **Ficam fora:** Semijoia (175) e as de baixo; as filhas de Joias de Prata
  (Brincos, Conjuntos, Correntes, Gargantilha, Pingentes, Pulseiras,
  Tornozeleiras); Caixinha de Joia (35); Anéis Semijoias (229); e as
  categorias de campanha (Black Friday, Aniversário JK).

Dos 242 disponíveis fora do arquivo, 123 eram de Semijoia, 28 de Correntes, 21
de Caixinha de Joia, 18 de Conjuntos, 13 de Pulseiras, 13 de Gargantilha, 9 de
Brincos, 6 de Anéis Semijoias, 6 de Tornozeleiras, 3 de Colares e Pingentes, 1
de Brinco e 1 de Aniversário JK. Produto indisponível nunca entra.

A regra mora em `RAMOS_QUE_ENTRAM`, `CATEGORIAS_QUE_ENTRAM_SOZINHAS` e
`RAMOS_QUE_FICAM_FORA`, em `src/lib/catalogo/arquivo.ts`. Pelos números é uma
escolha de categorias feita no painel da Tray; categoria nova embaixo de
Alianças ou de Anéis entra sozinha aqui. **Pôr semijoia no catálogo** é mudar
essas listas, e é decisão de tráfego, não de código.

## O que difere da Tray, de propósito

- **Produto sem foto nenhuma fica fora.** A Tray manda com `image_link` vazio,
  e o Meta recusa item sem foto. Em 17/11 eram cinco produtos "PERSONALIZADO"
  (pedidos feitos sob medida, sem foto na loja).
- **Descrição vazia vira a descrição curta**, e sem ela o nome. A Tray mandava
  vazio em três produtos, e o Meta marca item sem descrição como erro.
- **Entidade HTML vira o caractere.** A Tray deixa como texto a entidade que
  não cabe em Latin-1, e o Meta mostrava, na descrição de cinco produtos,
  "&ldquo;querido&rdquo;", "&bull;" e "&zwj;" escritos assim. Aqui viram as
  aspas, o marcador e o emoji de verdade.
- **O corte da descrição.** A Tray conta cada entidade inteira no limite de
  5.000 (um emoji vale nove caracteres), então corta antes, às vezes no meio
  de uma entidade. O painel corta em 5.000 caracteres de texto.
- **UTF-8 em vez de ISO-8859-1**, com o caractere direto em vez da entidade
  numérica. Para quem lê o arquivo, o texto é o mesmo.

## O resultado da conferência, em 17/11/2026

Arquivo da Tray gerado às 00h48, contra o do painel montado na mesma hora
(servidor local, com o banco de produção e a tabela de detalhes cheia):

| | |
|---|---|
| Itens na Tray | 711 |
| Itens no painel | 706 |
| Idênticos em todos os campos | 672 |
| Diferentes só na descrição, com causa conhecida | 34 |
| Só na Tray | 5, todos sem foto nenhuma na loja ("PERSONALIZADO") |
| Só no painel | nenhum |

Em `title`, `link`, `price`, `sale_price`, `sale_price_effective_date`,
`availability`, `image_link`, `additional_image_link`, `brand`,
`product_type`, `mpn`, `gtin`, `condition`, `shipping_weight` e
`shipping_size`, os 706 itens em comum batem um a um. As 34 descrições
diferentes: 27 pelo corte da Tray (ela para antes dos 5.000), 5 pela entidade
que a Tray deixa como texto e 2 que a Tray manda vazias. Os códigos são os
mesmos: nenhum código do painel deixa de existir na Tray.

O arquivo do painel tem 3,3 MB (o da Tray, 3,9 MB, porque escreve cada acento
como entidade).

## Os detalhes pela API

A tabela `catalogo_detalhes` (migration 0130) guarda, por produto, as fotos, a
descrição em HTML, referência, modelo, EAN, peso, medidas, estoque e a data de
alteração na loja. `catalogo_categorias` guarda a árvore de categorias da loja,
refeita a cada rodada. As duas têm RLS ligada e nenhuma policy: só a
service_role lê.

A rotina `/api/cron/catalogo-detalhes` (`src/lib/catalogo/detalhes.ts`) roda de
dez em dez minutos pelo `pg_cron` (migration 0131, minutos 8, 18, 28...). Cada
rodada lê no máximo 40 produtos, um por chamada, com meio segundo entre uma e
outra (perto de 100 chamadas por minuto: o limite da Tray é de 180 por minuto e
10 mil por dia, e a leitura de pedidos divide esse limite). Cada chamada tem 15
segundos de prazo, nenhuma chamada nova começa depois de 35 segundos, e a
rodada grava de dez em dez produtos: no primeiro enchimento, uma chamada ficou
oito minutos sem resposta, e sem isso a função da Vercel morreria no limite de
60 segundos levando junto o que já tinha lido. Ela lê, nesta ordem:

1. o produto que nunca foi lido;
2. o que tem a foto principal diferente da que o espelho mostra (alguém mexeu
   no produto na loja);
3. o que foi lido há mais de três dias, do mais velho para o mais novo.

Mudança de preço não pede leitura: preço vem do espelho, e na Black ele muda o
dia inteiro. Em regime são umas 400 chamadas por dia.

Se a foto principal mudou e a rotina ainda não releu o produto, o arquivo sai
com a foto do espelho só, sem as outras, até a próxima rodada. Produto que
ainda não tem detalhe sai com a foto do espelho, a descrição curta e o `mpn`
só com o código; o arquivo avisa quantos foram assim no cabeçalho
`X-Catalogo-Sem-Detalhe`.

A rotina aparece na Saúde como "Detalhes do catálogo". Para encher a tabela de
uma vez (produto novo em massa, por exemplo), a rota aceita `{"maximo": 200}`
no corpo, com o mesmo segredo das outras rotinas.

## Erro nunca vira arquivo vazio

Um arquivo sem itens, lido pelo Meta, apaga o catálogo inteiro, e com ele o
histórico dos anúncios de catálogo. Por isso a rota responde **503** quando o
banco falha, quando a árvore de categorias está vazia ou quando nenhum item
entrou, sem cache e com `Retry-After`. O Meta registra a falha da busca e
continua com a última versão boa. Arquivo bom fica quinze minutos na CDN da
Vercel (o Commerce Manager lê de hora em hora, e o espelho muda de quinze em
quinze).

## A conferência

```bash
npm run verificar:catalogo
```

Roda os testes das contas puras e depois baixa os dois arquivos pela internet:
o da Tray e o do painel em produção. Compara item a item e imprime:

- quantos itens cada um tem e quantos são idênticos em todos os campos;
- os códigos que só um dos dois tem, cada um com o porquê lido no banco
  (indisponível, categoria fora, mudou no espelho depois que a Tray gerou o
  arquivo, ainda sem detalhe);
- cada campo com diferença, com exemplos (na descrição, o ponto onde os dois
  textos começam a diferir).

Diferença crítica (código que falta ou sobra, preço, promoção,
disponibilidade, link ou foto principal) é explicada pelo banco. A que tem
causa conhecida não segura a troca: produto sem foto nenhuma (o Meta recusa) e
produto que mudou no espelho depois que a Tray gerou o arquivo dela. A que não
tem sai marcada com OLHAR, e o script sai com 1. Sai com 2 quando não
conseguiu baixar um dos arquivos. Na descrição, as três diferenças da Tray
descritas acima aparecem agrupadas, com a contagem de cada uma. Antes do merge, compare com a prévia ou com o servidor
local:

```bash
npm run verificar:catalogo -- --painel=http://localhost:3001/guias/api/catalogo/meta.xml
```

O build roda só os testes (`--sem-internet`). Para o Google, o arquivo da Tray
que alimenta o Merchant tem outro endereço (outra chave), que não está aqui;
com ele em mãos: `npm run verificar:catalogo -- --destino=google --tray=<endereço>`.

Diferença de preço ou de disponibilidade em poucos itens costuma ser hora: o
arquivo da Tray é refeito de hora em hora e o espelho de quinze em quinze
minutos. A conferência mostra a hora em que a Tray gerou o arquivo e, para cada
diferença crítica, se o produto mudou no espelho depois disso.

## O passo de 01/12

Antes:

1. Rodar `npm run verificar:catalogo` e ler o resultado. Diferença crítica
   que não seja de hora (ver acima) segura a troca.
2. Abrir `https://www.jkaliancas.com.br/guias/api/catalogo/meta.xml` no
   navegador e conferir que abre e que o cabeçalho `X-Catalogo-Sem-Detalhe`
   está em 0 ou perto disso.

A troca, no Commerce Manager do portfólio 198105640840402:

3. Catálogo "Products for JK Alianças" (790415284815232), **Fontes de dados**,
   a fonte 2100748130462176 (a do arquivo da Tray).
4. Nas configurações da fonte, trocar o endereço do arquivo agendado pelo do
   painel (`.../guias/api/catalogo/meta.xml`). Manter a frequência de hora em
   hora e o modo de substituir.
5. Pedir uma atualização agora e conferir, no fim da leitura, o número de
   itens (o mesmo de antes, menos os sem foto) e a aba de problemas.

Para voltar, é o mesmo caminho: devolver na fonte o endereço da Tray
(`https://www.jkaliancas.com.br/xml/xml.php?Chave=...`, o endereço inteiro está
em `URL_DA_TRAY`, em `scripts/teste-catalogo.mts`) e pedir uma atualização.
A volta só funciona enquanto a Tray continuar gerando o arquivo dela: em 17/11,
mesmo com a integração fora do ar, ele ainda era refeito de hora em hora.
Confira abrindo o endereço antes de voltar.

No Google Merchant, o caminho é o mesmo: na fonte de produtos que lê o arquivo
da Tray, trocar o endereço pelo `.../guias/api/catalogo/google.xml`.

## O que fica para decidir

- Semijoia no catálogo (ver "Quem entra").
- Produto indisponível sai do arquivo, como na Tray, e com isso sai do
  catálogo do Meta até voltar. A alternativa é mandar como `out of stock`, que
  mantém o item e o histórico e só para de anunciar. Muda a contagem de itens
  na virada, então é para depois de 01/12.
- 72 produtos saem sem marca, porque não têm marca na loja. Preencher a marca
  na Tray resolve na loja e no arquivo.
- O separador do tipo do produto (ver acima).
