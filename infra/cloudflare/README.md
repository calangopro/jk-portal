# Worker `jk-guias`, o proxy que serve o portal no domínio da JK

`worker.js` é a fonte do Worker que está no ar. Ele mora aqui porque já se
perdeu uma vez: o desvio de 404 que existia durante os testes sumiu quando o
Worker passou a ser publicado de fora, e ninguém tinha como comparar o que
rodava com o que se pretendia.

## O que ele faz

O domínio não é do portal. `www.jkaliancas.com.br` responde pela loja na Tray, e
a rota `www.jkaliancas.com.br/guias*` manda só esse caminho para a Vercel.

| Onde | Quem responde |
|---|---|
| `www.jkaliancas.com.br/` e o resto | Tray, sem passar por aqui |
| `www.jkaliancas.com.br/guias*` | este Worker, que busca em `jk-portal.vercel.app` |

**A rota é `/guias*` e só.** Nenhuma edição neste arquivo alcança a loja. Para
conferir antes de mexer:

```bash
curl -s "https://api.cloudflare.com/client/v4/zones/$ZONE/workers/routes" -H "Authorization: Bearer $CF_TOKEN"
```

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
