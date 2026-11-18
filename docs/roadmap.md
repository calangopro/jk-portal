# Roadmap do código

O quadro de trabalho de quem mexe no código do painel. Existe para o Filipe, o
Erick e o Claude de cada um não mexerem no mesmo lugar ao mesmo tempo.

- **Onde:** `https://www.jkaliancas.com.br/guias/admin/roadmap` (setor Sistema).
- **Quem vê:** a área `roadmap` (administrador, dono e GM). Mudar quem vê é
  mudar uma linha em `acessos_por_papel`.
- **Onde mora a regra:** no banco, `supabase/migrations/0141_roadmap.sql`. A
  tela, o conector e o `npm run roadmap` chamam as mesmas funções.

## As colunas

| Coluna | Quer dizer |
|---|---|
| Ideias | Vale pensar, sem compromisso. |
| A fazer | Decidido, esperando alguém pegar. |
| Fazendo | Alguém está mexendo agora. Tem dono, ramo e caminhos. |
| Em revisão | O pedido de revisão está aberto, esperando juntar ao `main`. |
| No ar | Juntado e publicado. Fica no quadro por 60 dias. |
| Descartados | Não vai entrar, com o motivo escrito. |

## O passo a passo

1. **Consultar.** `roadmap.quadro` pelo conector ou `npm run roadmap` no
   terminal. O que importa: quem está em Fazendo e Em revisão, e onde.
2. **Achar ou criar o cartão.** Trabalho sem cartão não começa.
   `roadmap.criar` ou o botão "Novo cartão" na tela.
3. **Pegar.** `roadmap.pegar` com:
   - os **caminhos** que vai mexer, um por item: pasta (`src/lib/redes`),
     arquivo (`supabase/migrations/0150_x.sql`) ou tela do painel
     (`/admin/vendas`, que vale como `src/app/admin/(painel)/vendas`);
   - o **ramo** (sem ramo, a resposta traz o sugerido: `erick/12-conversa-privada-chat`);
   - a **sessão** do Claude, para achar depois de onde veio o trabalho.

   A resposta traz `cruza_com`. Se vier alguma coisa, **pare e avise a pessoa**:
   outro trabalho em andamento mexe no mesmo lugar. O quadro avisa, não
   impede: as duas pessoas combinam quem junta primeiro, e quem junta depois
   atualiza o ramo com o `main` antes.
4. **Trabalhar no ramo próprio**, nunca no `main`. Sessão que já nasceu num
   worktree do app (ramo `claude/...`) registra esse ramo no cartão.
5. **Abrir o pedido de revisão** e ligar ao cartão: `roadmap.ligar_pr`. O
   cartão vai para Em revisão.
6. **Juntar e publicar**, e então `roadmap.concluir`: vai para No ar, com uma
   nota do que entrou.

## O cruzamento de caminhos

Dois caminhos cruzam quando são o mesmo ou quando um está dentro do outro:

| Meu | Do outro | Cruza? |
|---|---|---|
| `src/lib/time` | `src/lib/time/chat.ts` | sim |
| `/admin/chat` | `src/app/admin/(painel)/chat/Tela.tsx` | sim (tela vale como pasta) |
| `./SRC/LIB/TIME/chat.ts` | `src/lib/time/chat.ts` | sim (maiúscula e `./` não escondem) |
| `src/lib/timeline` | `src/lib/time` | não |
| `supabase/migrations/0150Xx.sql` | `supabase/migrations/0150_x.sql` | não (o `_` não é curinga) |

A comparação vale contra os cartões em Fazendo e Em revisão. Arquivo que
todo mundo toca (`CLAUDE.md`, `src/lib/painel/setores.ts`, `package.json`)
vai aparecer como cruzamento quando os dois declararem: é verdade, e o aviso
serve para combinar quem junta primeiro.

## Sugestões do time viram cartões

As sugestões novas (o botão "Sugerir melhoria" de toda tela) aparecem no topo
do quadro. "Levar para o roadmap" cria o cartão ligado a ela, e daí em diante o
estado da sugestão anda sozinho com o cartão, por um gatilho no banco:

| Cartão em | Quem sugeriu vê |
|---|---|
| Ideias ou A fazer | Planejada |
| Fazendo ou Em revisão | Em andamento |
| No ar | Feita |
| Descartados | Não vai entrar |

A **nota** do movimento é a resposta que quem sugeriu lê em Time, Sugestões
(sem nota, vai uma frase pronta). Na tela de Sugestões, a sugestão ligada a
cartão não muda mais de estado; só a resposta.

## Criar em lote (auditoria)

`roadmap.criar` aceita até 100 cartões numa chamada. Cada item pode ter uma
`referencia` única (por exemplo `auditoria-2026-11-18:A3`): rodar o mesmo lote
de novo pula o que já existe. Com `origem: "auditoria"` o cartão fica marcado
como achado de auditoria. Item com problema é recusado sozinho, o resto entra,
e a resposta diz qual e por quê.

Exemplo, pelo modo código do conector:

```js
return await jk.roadmap.criar({
  origem: "auditoria",
  cartoes: [
    { referencia: "auditoria-2026-11-18:A1", titulo: "Rota X aceita pedido sem conferir a origem", tipo: "seguranca", prioridade: "alta", caminhos: ["src/app/api/x"] },
  ],
});
```

## Ligar o conector no Claude Code

Para o Erick, ou qualquer pessoa da diretoria, no computador dela:

1. Entrar em `https://www.jkaliancas.com.br/guias/admin/conector` e criar uma
   **Nova chave**, com escopo completo. A chave aparece uma vez só.
2. No terminal:
   ```bash
   claude mcp add --transport http jk https://www.jkaliancas.com.br/guias/api/mcp --header "Authorization: Bearer jk_..."
   ```
3. Para o `npm run roadmap` funcionar no mesmo computador, uma linha no
   `.env.local` do projeto:
   ```bash
   JK_CONECTOR_CHAVE=jk_...
   ```

A chave é pessoal. O quadro grava cada mudança no nome do dono da chave,
marcada como "pelo Claude". Chave perdida se revoga na mesma tela.

## Sem o conector

Se a sessão não tem o conector, ela não escreve no quadro. Antes de começar,
peça à pessoa para pegar o cartão na tela (com o ramo e os caminhos), e ao
abrir o pedido de revisão, para colar o link no cartão. O `npm run roadmap`
continua servindo para ler.

## `npm run roadmap`

Só lê. Três formas:

```bash
npm run roadmap
```

```bash
npm run roadmap -- conferir src/lib/redes /admin/vendas
```

```bash
npm run roadmap -- ver 12
```

O `conferir` sai com código 3 quando há cruzamento, para servir num gancho de
git no futuro.
