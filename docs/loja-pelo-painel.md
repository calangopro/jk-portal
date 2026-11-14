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
| Imagens do produto | não confirmado | a leitura respondeu 404; a documentação fala em `POST /products/:id/images` |
| Estoque por centro de distribuição | não | os endereços de multi-CD responderam 500 ou 404 |
| Notas fiscais, cupons | não | 404 e 405 |

Escrita em pedido (`PUT /orders/:id` com `status_id`, `sending_code`,
`tracking_url`, `store_note`; cancelar em `PUT /orders/cancel/:id`) está na
documentação e **não foi testada**: criar um pedido de teste exige cliente com
CPF.

## As próximas fases

**Fase 2, o resto do produto.** Descrição, categoria, marca, peso e medidas;
fotos (o que tira a planilha do caminho das fotos novas); estoque e preço por
variação; cadastrar produto novo.

**Fase 3, pedido, fábrica e envio.** Fila da fábrica com o pedido pago e o que
produzir (o item traz a informação adicional, como aro e gravação), mudar o
status, pôr código e link de rastreio, cancelar. Depende de a API estar ligada
na loja da JK, e de a JK dizer por quais etapas um pedido passa na fábrica.

**Fase 4, onde tem estoque.** A Tray guarda um número de estoque por produto ou
variação. O estoque por local não respondeu na API da loja de testes. Antes de
desenhar, é preciso saber o que a JK quer ver: estoque por loja física, ou só
o do site.

**Em todas:** uma tela com o histórico de alterações, que hoje só existe no
banco.
