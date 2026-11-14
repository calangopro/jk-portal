# A loja pelo painel

Em 13/11/2026 o dono do projeto decidiu: tudo o que a API da Tray permitir
passa a ser feito pelo painel. Produto, estoque, estado, pedido, envio e
rastreio. Até esse dia a regra era o contrário (o painel só lia a loja).

A Tray continua sendo a fonte de verdade. O painel não guarda um valor próprio
e torce para a loja concordar: manda a alteração, lê de volta o que ficou e só
então atualiza o espelho.

**Na loja da JK nada disto roda ainda.** Falta a Tray homologar o aplicativo e
a loja ser autorizada em Integrações (`docs/tray-api-de-pedidos.md`). Tudo foi
testado contra a loja de testes.

## As regras de quem escreve na loja

1. **Um caminho só.** Toda alteração passa por `src/lib/loja/alterar.ts`.
   Chamar a API com PUT ou POST de outro arquivo é pular o registro.
2. **Sempre contra a loja de agora.** Antes de gravar, o painel lê o produto na
   Tray. O espelho do banco pode estar atrasado.
3. **Conferir antes de gravar.** A tela mostra o antes e depois de cada campo e
   os avisos, e a gravação é um segundo clique.
4. **O "ok" da Tray não basta.** Ela responde "Saved" mesmo quando ignora um
   campo. Depois de gravar, o painel lê de novo e confere campo por campo.
5. **Tudo fica registrado** em `loja_alteracoes` (0065): quem, o que era, o
   que ficou, a resposta da Tray. Inclusive as recusadas.
6. **Não existe alteração sem autor.** Rotina e conector não escrevem na loja.
7. **Preço é mais fechado.** A área `loja` (administrador, dono, GM e gerente)
   muda nome, estoque e disponibilidade. Preço e promoção, só administrador,
   dono e GM: mexer em preço por fora passaria por cima da aprovação de
   campanha.

## Fase 1, feita: editar o produto

Na gaveta do produto, em Produtos, a seção "Editar na loja": nome, preço,
preço promocional com as duas datas, estoque e disponível para venda.

| Peça | Onde |
| --- | --- |
| Regras de cada campo (puro, testado) | `src/lib/loja/produto.ts` |
| O caminho único de escrita | `src/lib/loja/alterar.ts` |
| Tela | `src/app/admin/(painel)/produtos/EditarNaLoja.tsx` |
| Ações do servidor | `lerNaLoja`, `preverNaLoja`, `gravarNaLoja` em `produtos/actions.ts` |
| Área de acesso e registro | migration 0065 |

Conferido na loja de testes, no produto 93525: nome, preço e estoque; pôr e
tirar promoção; pôr e tirar de venda; repetir o mesmo valor não grava nada;
gerente não muda preço; preço com um zero a mais vem com aviso ("o preço sobe
1012%"). Cada gravação foi lida de volta e registrada.

O que a API cobrou, para não redescobrir:
- Tirar a promoção é mandar `promotional_price` "0.00" e as duas datas vazias.
- `POST /categories` recusa o campo `order`.
- A resposta de sucesso é `{"message":"Saved"}`, sem o produto. Por isso a
  segunda leitura.

## Fase 2, feita em parte: fotos pela API e o histórico

Na gaveta do produto, quando há foto aprovada, aparece "Levar as fotos
aprovadas para a loja". São dois passos: conferir (o painel lê as fotos que a
loja mostra agora e diz, posição por posição, qual sai e qual entra) e enviar
(manda, espera a Tray mostrar e só então dá a baixa). A planilha continua
existindo como segundo caminho.

| Peça | Onde |
| --- | --- |
| Regras das fotos (puro, testado) | `src/lib/loja/imagens.ts` |
| Envio, conferência e registro | `levarFotosParaLoja` em `src/lib/loja/alterar.ts` |
| Tela | `src/app/admin/(painel)/produtos/FotosNaLoja.tsx` |
| Ações do servidor | `preverFotosDoProduto`, `levarFotosDoProduto` em `produtos/actions.ts` |
| Histórico de alterações | `/admin/alteracoes-na-loja` (`alteracoes-na-loja/`) |

**O que a Tray faz com as fotos, medido na loja de testes em 14/11/2026.** A
documentação diz uma coisa e a API faz outra, então vale o que foi medido:

- `POST /products/:id/images` com `{"Images": {"picture_source_N": "endereço"}}`.
  O endereço precisa ser público, sem espaço nem acento, em JPG ou PNG.
- **As fotos são uma fila, sem buraco.** `picture_source_N` é a enésima foto da
  fila de agora: mandar a 2 SUBSTITUI a segunda foto que a loja mostra. Número
  além do fim acrescenta no fim. Não é gaveta fixa.
- **A resposta é sempre `Uploaded images`, mesmo quando a foto é descartada.**
  A de 2,4 MB e a de 2,7 MB sumiram sem aviso; a de 1,83 MB entrou. A
  documentação fala em 350 KB, e não é isso: o corte fica perto de 2 MB. O
  painel manda no máximo 1,5 MB e, acima disso, uma cópia mais leve do mesmo
  tamanho em pixels.
- 2000 x 2000 px entra. A Tray não recomprime: serve os mesmos bytes.
- **O nome do arquivo na Tray termina com o MD5 do conteúdo.** É a prova de que
  a foto no lugar é a que foi mandada, e é o que deixa o painel reconhecer "esta
  foto já está na loja" e não mandar de novo.
- Três fotos trocadas de uma vez apareceram em menos de 6 segundos. O painel
  espera até 32.
- Remover é mandar um espaço (`" "`) na posição: a fila encolhe.

**A regra do painel:** produto na posição 1, face na 2, uso na 3. O que estiver
nessas posições sai da loja; da 4 em diante nada muda. A planilha fazia
diferente (empurrava as antigas para trás): pela API isso exigiria mandar de
volta as fotos antigas, e a pessoa vê o que sai antes de confirmar.

**Só muda de estado a foto que o painel VIU na loja.** A que ficou pendente
continua "aprovada", para poder ser mandada de novo.

**Variações ficaram de fora, de propósito:** nenhum dos 1.169 produtos ativos
da JK usa variação na Tray.

## O que a API respondeu na loja de testes

| Recurso | Lê | Observação |
| --- | --- | --- |
| Produtos | sim | todos os campos do cadastro; escrita testada |
| Variações | sim | estoque e preço por variação, com `Sku` (tipo e valor) |
| Categorias, marcas | sim | escrita de categoria testada |
| Pedidos | sim | lista, completo, status, itens |
| Status de pedido | sim | `/orders/statuses`: cada um com `id`, nome e tipo (`open`, `closed`, `canceled`) |
| Formas de envio | sim | `/shippings` |
| Clientes, pagamentos, carrinhos | sim | |
| Imagens do produto | sim | vêm em `ProductImage`, dentro do produto; a escrita foi testada (ver acima) |
| Estoque por centro de distribuição | não | os endereços de multi-CD responderam 500 ou 404 |
| Notas fiscais, cupons | não | 404 e 405 |

Escrita em pedido (`PUT /orders/:id` com `status_id`, `sending_code`,
`tracking_url`, `store_note`; cancelar em `PUT /orders/cancel/:id`) está na
documentação e **não foi testada**: criar um pedido de teste exige cliente com
CPF.

## As próximas fases

**Fase 2, o que falta.** Descrição, categoria, marca, peso e medidas, e
cadastrar produto novo. As fotos e o histórico já estão feitos.

**Fase 3, pedido, fábrica e envio.** A fila da fábrica está feita
(`/admin/fabrica`, migration 0067): quatro etapas, do pedido pago ao envio, com
a numeração e a gravação de cada peça em destaque. Ela não depende da API:
lê os pedidos que o painel já importa. **Falta** a volta para a loja: mudar o
status na Tray, mandar o código e o link de rastreio e cancelar. Isso depende
de a API estar ligada na loja da JK, e a escrita em pedido ainda não foi
testada.

**Fase 4, onde tem estoque.** A Tray guarda um número de estoque por produto ou
variação. O estoque por local não respondeu na API da loja de testes. Antes de
desenhar, é preciso saber o que a JK quer ver: estoque por loja física, ou só
o do site.

**Em todas:** cada alteração nova aparece em `/admin/alteracoes-na-loja`. Ao
criar um recurso novo (pedido, por exemplo), a tela precisa aprender a
desenhá-lo: ela já mostra os campos do produto por extenso e as fotos lado a
lado.
