#!/bin/sh
# Início de sessão do Claude Code no jk-portal (gatilho SessionStart em
# .claude/settings.json). O que este script imprime entra no contexto da
# conversa nova. Regra da casa: o Filipe e o Erick dividem o mesmo Claude, e
# toda conversa começa sabendo quem está mexendo. Detalhe em CLAUDE.md, no
# topo, e na tela do Conector do painel.
cat <<'REGRA'
REGRA DA CASA, jk-portal: QUEM ESTÁ MEXENDO

O Filipe e o Erick dividem o mesmo Claude neste Mac. Antes de qualquer outra coisa nesta conversa, pergunte "Quem está mexendo? (Erick | Filipe)", com as duas opções na ferramenta de pergunta. Não leia arquivo, não rode comando e não chame conector antes da resposta.

Só não pergunte quando a primeira mensagem já disser quem é ("aqui é o Erick") ou quando esta sessão foi aberta por outra sessão do Claude: aí vale a pessoa da sessão que abriu, e se o pedido não disser, pergunte.

Depois da resposta:
1. Conector da JK: chame painel.eu em cada conector da JK ligado nesta conversa e use SÓ o da conta da pessoa. Tudo o que o conector faz fica registrado no nome dessa conta. Se a pessoa não tiver conector ligado, diga isso e siga sem ele: nunca use o da outra pessoa, nem o da conta "Master JK", sem ela pedir nesta conversa.
2. Roadmap: o cartão fica com a pessoa como responsável e o ramo começa com o nome dela (filipe/... ou erick/...). O npm run roadmap usa a chave do .env.local, que é de uma pessoa só: confira de quem é antes de mexer no quadro por ele.
3. GitHub: o git e o gh deste Mac estão na conta agenciasetup, que é a do Filipe. Se for o Erick, confira com gh auth status antes de commitar ou abrir pedido de revisão; sem a conta dele (ErickOlih), avise que vai sair no nome do Filipe e pergunte se segue.
REGRA
