# Como usar: tutoriais animados do painel

O botão **Como usar** (ícone de ? na barra de topo, ao lado de Sugerir melhoria) abre o passo a passo animado da tela
em que a pessoa está, na versão do nível dela. A lista de todos os tutoriais fica em **Time, Como usar** (`/admin/ajuda`),
só com as telas que a pessoa pode abrir. Cartão 56 do Roadmap.

## Como as peças se encaixam

| Peça | Onde | O que faz |
|---|---|---|
| Registro | `src/lib/ajuda/tutoriais/<tela>.ts` + linha em `src/lib/ajuda/indice.ts` | O tutorial como dado: resumo, versões por grupo, passos |
| Tipos e grupos | `src/lib/ajuda/tipos.ts`, `grupos.ts` | `grupoDoPapel` diz em que grupo cada nível cai |
| Player | `src/components/ajuda/Player.tsx` | Cursor, anel, zoom, legenda, pausa, teclado. Sem biblioteca |
| Janela e botão | `src/app/admin/(painel)/ajuda/` (`ComoUsar`, `Janela`, `Tela`) | `<dialog>` com `showModal()`, baixa só no primeiro clique |
| Telas de exemplo | `src/app/ajuda-demo/telas/<tela>.tsx` | A tela de verdade com dados inventados. Só local: em produção responde 404 |
| Prints | `scripts/ajuda/prints/<tela>.mts` + `scripts/ajuda/prints.mts` | Tira o print de cada passo e salva em `public/ajuda/` |
| Teste | `scripts/teste-ajuda.mts` (`npm run verificar:ajuda`, roda no build) | Confere tela, grupos, texto, região e prints |

Grupos de nível: `diretoria` (administrador, dono, GM), `gerente`, `vendas`, `fabrica`, `trafego`, `social_media`,
`conteudo` (editor, revisor, autor). A versão `todos` é obrigatória e serve a quem não tem versão própria. **Só crie versão
de grupo quando a tela muda para ele** (o vendedor não vê o valor dos outros, o gerente marca venda para outra pessoa,
só a diretoria confirma resposta da Biblioteca). Para ver como cada nível vê, a diretoria tem o seletor "Ver como" na janela.

## Fazer um tutorial novo, passo a passo

1. **Pegue o cartão no Roadmap** e abra o ramo `<pessoa>/<número>-<título>`.
2. **Ligue o servidor de desenvolvimento** (`nvm use && npm run dev`, um por pasta, nunca com `build` ao lado).
3. **Crie a tela de exemplo** em `src/app/ajuda-demo/telas/<chave>.tsx`. A chave é o nome dos prints. O arquivo exporta
   `default` um `Demo` (`{ caminho, desenho }`, tipo em `src/app/ajuda-demo/tipos.ts`):
   - `caminho` é o endereço do painel que acende no menu (ex.: `/admin/registrar-venda`).
   - `desenho(nivel)` devolve a tela de verdade com dados inventados. Quase toda tela tem o desenho separado da leitura
     (`Tela.tsx`); passe a ela os mesmos props que o `page.tsx` passa, com dados de exemplo. Dica: o `npx tsc --noEmit`
     diz qual campo do dado ainda falta.
   - **Dados**: nomes claramente de exemplo ("Cliente Exemplo Um", "Vendedor Exemplo"), valores redondos (1.200, 3.000),
     telefone e e-mail fictícios. O repositório é público: nada real, nunca.
   - Função como prop (ação de servidor): escreva `async () => { "use server"; return { ok: true as const } }` dentro da demo.
     Se a tela pede um objeto `api` (chat), faça um componente de cliente ao lado (veja `chat-cliente.tsx`).
   - `nivel` é o papel em código (`vendas`, `gerente`, `gm`). A URL aceita `?nivel=vendas|gerente|diretoria`.
   - Confira no navegador: `http://localhost:3000/guias/ajuda-demo/<chave>?nivel=vendas`.
4. **Escreva o manifesto dos prints** em `scripts/ajuda/prints/<chave>.mts`: uma lista de `{ arquivo, demo, nivel?, celular?, antes?, alvos? }`.
   - `arquivo`: `<chave>-<n>`, vira `public/ajuda/<chave>-<n>.webp`. 1280 x 800, ou 390 x 844 com `celular: true`.
   - `antes(page)`: clicar, digitar, rolar, abrir uma gaveta antes do print.
   - `alvos`: seletores do que você quer destacar. O script escreve a **região em porcentagem** pronta para colar.
5. **Tire os prints**: `npm run ajuda:prints -- <chave>` (sem argumento, refaz todos). Vale `AJUDA_URL=http://localhost:3100/guias`
   se o servidor estiver em outra porta. Use `CHROME_PATH` se não achar o Chromium (o script procura o `chrome-headless-shell`
   do cache do Playwright). Cada print sai com até uns 120 KB.
6. **Olhe os prints.** Se algo aparecer que não é exemplo, corrija a demo e refaça.
7. **Escreva o tutorial** em `src/lib/ajuda/tutoriais/<tela-com-hifen>.ts`, exportando um `Tutorial`:
   `href` (o da tela em `setores.ts`), `resumo` (uma frase) e `versoes: { todos: [...], gerente?: [...] }`.
   Cada passo: `titulo` (curto, no imperativo, até 60), `texto` (1 ou 2 frases, até 240), `print`, `regiao: { x, y, l, a }` em %,
   `celular?`, `alt` (o que o print mostra). De 3 a 6 passos por versão. Veja `hoje.ts` e `registrar-venda.ts`.
8. **Registre** em `src/lib/ajuda/indice.ts` (um import e um item da lista `TUTORIAIS`).
9. **Rode** `npm run verificar:ajuda`, `npx tsc --noEmit` e abra o botão Como usar na tela de exemplo para ver animar.
   Confira em 375 px de largura. Depois `npm run verificar:tudo` e `npm run build:seguro`.

## Como escrever os passos

- Frase curta, no imperativo: "Toque em Fui eu que vendi". Fale como um colega explicando, sem jargão técnico.
- Nunca travessão, nada de "vamos mergulhar" ou "em resumo" (o teste barra).
- Diga o que a pessoa **faz** e o que acontece. Não descreva a tela inteira.
- Região pequena e específica: o anel escurece o resto, então região do tamanho da tela inteira não ajuda.
- O mesmo print pode servir a vários passos com regiões diferentes.

## Regras duras

- **Nenhum dado real** nos prints (cliente, telefone, valor, nome de gente da equipe). O repositório é público.
- Os prints são arquivos de `public/`: o tutorial não faz rede nenhuma em produção.
- A janela é um `<dialog>` com `showModal()`: passa por cima do chat flutuante sem briga de camada.
- Com `prefers-reduced-motion` o player não anima: só a moldura de destaque.
- Se mudar uma tela, refaça os prints dela e releia o tutorial: print velho mente.

## Telas que já têm tutorial

Hoje, Registrar venda, Pedidos do site, Vendas da Kommo, Clientes (ficha e linha do tempo), Oportunidades, Consulta, Suporte pós-venda,
Tutor, Biblioteca JK e Chat do time. Cartão 57: Funil da Kommo, Pedidos da loja, Vendedores, Recuperação, Sugestões, Fábrica, as cinco telas da Loja (Produtos, Campanhas, Alterações na loja, Lojas físicas, Avaliações) e as oito do Social Media. O resto aparece como "Em breve" na lista.
