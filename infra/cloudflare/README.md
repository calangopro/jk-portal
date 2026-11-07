# Worker `jk-guias`, o proxy que serve o portal no domínio da JK

`worker.js` é a fonte do Worker que está no ar. Ele mora aqui porque já se
perdeu uma vez: o desvio de 404 que existia durante os testes sumiu quando o
Worker passou a ser publicado de fora, e ninguém tinha como comparar o que
rodava com o que se pretendia.

## O que ele faz

O domínio não é do portal. `www.jkaliancas.com.br` responde pela loja na Tray, e
cinco rotas passam por este Worker:

| Onde | Quem responde |
|---|---|
| `www.jkaliancas.com.br/` e o resto | Tray, sem passar por aqui |
| `www.jkaliancas.com.br/guias*` | este Worker, que busca em `jk-portal.vercel.app` |
| `www.jkaliancas.com.br/bio*` | este Worker, que busca `/guias/bio` e mantém `/bio` na barra |
| `www.jkaliancas.com.br/grupo*` | este Worker, que busca `/guias/grupo` e mantém `/grupo` na barra (01/10) |
| `www.jkaliancas.com.br/qrcode*` | este Worker, que busca `/guias/qrcode` e `/guias/qrcode/<slug>`, um 302 para o destino de cada QR impresso (20/10) |
| `www.jkaliancas.com.br/descubra-o-tamanho*` | este Worker, que responde sozinho um 301 para `/guias/medidor-de-aliancas` (novembro de 2026) |

**As rotas são essas cinco e só.** Nenhuma edição neste arquivo alcança a loja.

O Worker também manda o IP de quem está no navegador em `x-jk-ip-cliente`
(lido de `cf-connecting-ip`). A Vercel só enxerga o IP da Cloudflare, e o
formulário do grupo precisa do IP real para a API de Conversões do Meta.

A da bio precisa terminar em asterisco. Rota sem asterisco no fim casa com o
caminho exato e **não casa com parâmetro**: com `www.jkaliancas.com.br/bio`,
o endereço `/bio?utm_source=instagram` ia direto para a Tray e caía em "sem
resultados", e o Instagram põe `?fbclid=...` em todo clique que sai do app.
Aconteceu em 24/09, logo depois de publicar. O preço de `/bio*` é casar também
com caminho da loja que comece com "bio" (nenhum, no sitemap da loja), e o
Worker devolve esses para a Tray sem mexer. Para conferir antes de mexer:

```bash
curl -s "https://api.cloudflare.com/client/v4/zones/$ZONE/workers/routes" -H "Authorization: Bearer $CF_TOKEN"
```

## A máscara do link da bio

A bio mora no portal em `/guias/bio`, mas o endereço divulgado é
`jkaliancas.com.br/bio`. O Worker pede `/guias/bio` para a Vercel e devolve a
resposta no endereço `/bio`, sem redirecionar. `/bio/` volta para `/bio` com um
301, para existir um endereço só.

A máscara mora aqui porque o Next não aceita reescrever para dentro do
`basePath` um caminho que está fora dele: o `next dev` recusa a configuração no
boot com "Invalid rewrite found". Foi testado com um proxy local imitando este
Worker: a página hidrata sem erro, os arquivos dela já saem em `/guias/...`
(que este Worker serve), e a navegação da bio para o medidor e de volta
funciona com `/bio` na barra.

## As três coisas que ele resolve

**1. HTTP vira HTTPS dentro de `/guias`.** O "Always Use HTTPS" da Cloudflare
está desligado de propósito: aquele botão vale para a zona inteira, e a zona
inteira é a loja. Um callback de pagamento ainda apontado para `http://`
perderia o corpo da requisição num 301. Aqui o desvio alcança só o portal, com
301 em GET e HEAD e 308 no resto, que preserva método e corpo.

A loja não precisa disso: a própria Tray já desvia `http` para `https` na
origem, e ainda manda HSTS.

**2. HSTS não vaza do portal para o domínio.** HSTS é política de host, não de
pasta, então o portal não pode decidir pelo domínio todo. O Worker apaga o
cabeçalho na saída.

**3. Só o que passa por aqui é indexável.** O portal manda `X-Robots-Tag:
noindex` em toda resposta e este Worker apaga. Está explicado por extenso no
`next.config.ts` e no próprio `worker.js`. O resumo: a Vercel recebe `Host:
jk-portal.vercel.app` mesmo no tráfego real, então a aplicação não tem como
saber por qual endereço está sendo servida, e a decisão passa a ser do proxy.

## Página da loja que virou página do portal

`/descubra-o-tamanho-da-sua-alianca` era a página institucional da loja que
ensinava a medir o aro. Em outubro de 2026 ela tinha 26 mil impressões e 340 a
510 cliques por mês no Google, posição 5,5, e disputava as mesmas buscas com o
medidor do portal (958 impressões, posição 6,4). O 301 junta as duas no
medidor, que antes ganhou um resumo dos dois métodos da página antiga (fita ou
barbante, e régua num anel que já serve). O resumo leva ao post
`/como-medir-o-dedo-para-alianca`, que é o dono da busca "como medir o dedo
para aliança" no cluster e não pode ganhar concorrente dentro de casa.

O desvio é a lista `MUDARAM` no `worker.js`. A chave é o começo do caminho, e
por isso cobre as variações com erro de digitação que o Search Console
registrou. Ele responde sem consultar ninguém: nem a Vercel nem a Tray recebem
esses pedidos.

**A ordem importa**, e é esta:

1. Publicar o `worker.js` (comando abaixo).
2. Criar a rota `www.jkaliancas.com.br/descubra-o-tamanho*` apontando para o
   Worker `jk-guias`, com o asterisco, senão `?gclid=` cai na Tray:
   ```bash
   curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE/workers/routes" \
     -H "Authorization: Bearer $CF_TOKEN" -H "Content-Type: application/json" \
     --data '{"pattern":"www.jkaliancas.com.br/descubra-o-tamanho*","script":"jk-guias"}'
   ```
3. Conferir que o endereço antigo responde 301 (linha no fim de "Conferir").
4. Só então desativar a página no painel da Tray. Ela sai do sitemap da loja e
   do rodapé, que a Tray monta pela lista de páginas institucionais. Desativar
   antes do passo 2 deixaria quem chega pelo Google num erro.
5. No Search Console, inspecionar o endereço antigo (deve mostrar o
   redirecionamento) e pedir a indexação de `/guias/medidor-de-aliancas`.

O 301 fica para sempre. Tirar a rota devolve o endereço para a Tray, que já
não tem a página.

## Publicar

O Worker foi publicado por `wrangler` e depois pela API. Para publicar este
arquivo:

```bash
curl -X PUT "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT/workers/scripts/jk-guias" \
  -H "Authorization: Bearer $CF_TOKEN" \
  -F 'metadata={"main_module":"worker.js","compatibility_date":"2026-09-17","observability":{"enabled":true,"head_sampling_rate":1}};type=application/json' \
  -F "worker.js=@infra/cloudflare/worker.js;type=application/javascript+module"
```

Baixar o que está no ar, para comparar com este arquivo antes de publicar por
cima:

```bash
curl -s "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT/workers/scripts/jk-guias" \
  -H "Authorization: Bearer $CF_TOKEN"
```

## Conferir depois de publicar

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://www.jkaliancas.com.br/          # loja, 200
curl -s -o /dev/null -w "%{http_code}\n" https://www.jkaliancas.com.br/guias     # portal, 200
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://www.jkaliancas.com.br/guias  # 301 https
curl -sI https://www.jkaliancas.com.br/guias | grep -i x-robots                  # vazio
curl -sI https://jk-portal.vercel.app/guias  | grep -i x-robots                  # noindex
curl -s -o /dev/null -w "%{http_code} %{url_effective}\n" "https://www.jkaliancas.com.br/bio?fbclid=x"   # 200, sem sair de /bio
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" https://www.jkaliancas.com.br/bio/   # 301 /bio
curl -s -o /dev/null -w "%{http_code} %{url_effective}\n" "https://www.jkaliancas.com.br/grupo?fbclid=x" # 200, sem sair de /grupo
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" https://www.jkaliancas.com.br/grupo/entrar     # 302 para o convite
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" https://www.jkaliancas.com.br/qrcode           # 302 para o WhatsApp
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" "https://www.jkaliancas.com.br/descubra-o-tamanho-da-sua-alianca?gclid=x"  # 301 /guias/medidor-de-aliancas?gclid=x
```

A quarta linha é a que importa. Se ela devolver `noindex`, o site está saindo do
índice do Google e o motivo é o `headers.delete("X-Robots-Tag")` ter saído daqui.

## Decisão registrada: página inexistente NÃO volta para a home

Durante os testes o Worker desviava `/guias/qualquer-coisa` de volta para
`/guias`. Isso não foi recolocado, de propósito.

Mandar um 404 para a home é soft 404, que o Google desaconselha por escrito, e o
portal já tem página de erro própria, com marca, cabeçalho, rodapé, saídas e
`noindex, follow` (`components/erro/Pagina404.tsx`). Desviar para a home jogaria
fora justamente o que foi construído, e ainda esconderia link quebrado do
registro de `not_found_hits`, que é a fila usada para criar redirect de verdade
em `/admin/redirects`.

## Os QRs dos impressos

`/qrcode` é o endereço que está dentro do QR dos adesivos do Shopping Tamboré
(18 espelhos e 18 portas, outubro de 2026), escrito por extenso:
`https://www.jkaliancas.com.br/qrcode`. **Esse caminho não pode mudar**, nem
ganhar barra no fim, nem passar a exigir parâmetro: está impresso.

Os outros lugares ganham QR próprio em `/admin/qrcode`, no endereço
`/qrcode/<slug>`. A rota `www.jkaliancas.com.br/qrcode*` já cobre esses
caminhos e o Worker já manda `/qrcode/...` para `/guias/qrcode/...`, então QR
novo **não pede nada na Cloudflare**. O destino de cada um (WhatsApp ou outro
link) se troca no painel, e o portal conta cada leitura em `qrcode_leituras`.
