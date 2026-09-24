# Worker `jk-guias`, o proxy que serve o portal no domínio da JK

`worker.js` é a fonte do Worker que está no ar. Ele mora aqui porque já se
perdeu uma vez: o desvio de 404 que existia durante os testes sumiu quando o
Worker passou a ser publicado de fora, e ninguém tinha como comparar o que
rodava com o que se pretendia.

## O que ele faz

O domínio não é do portal. `www.jkaliancas.com.br` responde pela loja na Tray, e
três rotas mandam só estes caminhos para a Vercel:

| Onde | Quem responde |
|---|---|
| `www.jkaliancas.com.br/` e o resto | Tray, sem passar por aqui |
| `www.jkaliancas.com.br/guias*` | este Worker, que busca em `jk-portal.vercel.app` |
| `www.jkaliancas.com.br/bio*` | este Worker, que busca `/guias/bio` e mantém `/bio` na barra |

**As rotas são essas duas e só.** Nenhuma edição neste arquivo alcança a loja.

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
