-- As fotos novas passam a seguir a sequência que a JK já usa na loja.
--
-- POR QUE
--
-- Em 08 e 09/11/2026 a JK subiu fotos novas de 18 alianças de prata da Black,
-- feitas no claude.ai, sempre em três posições: 1 PRODUTO (o par em pé, fundo
-- branco), 2 FACE (as peças de frente, mostrando a face de fora) e 3 USO (as
-- mãos do casal; busto para colar, orelha para brinco). A 0047 tinha nascido
-- com "principal, ambientada, detalhe", que não é como a equipe fala nem a
-- ordem que ela usa. O fundo também é branco puro, e não marfim.
--
-- Cada tipo agora é uma foto só por produto (aprovar uma substitui a outra do
-- mesmo tipo), e a planilha para a Tray monta produto, face e uso nas
-- posições 1, 2 e 3, com as fotos antigas depois, como a loja já está.

alter table public.produto_fotos drop constraint produto_fotos_tipo_check;

update public.produto_fotos
   set tipo = case tipo when 'principal' then 'produto' when 'ambientada' then 'uso' else 'face' end
 where tipo not in ('produto', 'face', 'uso');

alter table public.produto_fotos alter column tipo set default 'produto';
alter table public.produto_fotos
  add constraint produto_fotos_tipo_check check (tipo in ('produto', 'face', 'uso'));

update public.foto_padroes set atualizado_em = now(), instrucoes =
'SEQUÊNCIA: sempre três fotos, nesta ordem na loja. Quadradas (1:1). Sem texto, sem logo, sem marca d''água.

1. PRODUTO: as peças em pé, em ângulo de três quartos (no par, a maior atrás à direita e a menor na frente à esquerda). Fundo branco puro, luz de estúdio difusa, sombra suave embaixo, textura nítida.
2. FACE: as peças de frente, em pé, lado a lado, mostrando a face de fora inteira (friso, pedras, acabamento). Fundo branco puro, mesmo tamanho de peça da foto 1.
3. USO: a peça em uso, em cena limpa e clara, com luz natural.
- Aliança de namoro e compromisso: mãos DIREITAS do casal. Aliança de casamento: mãos esquerdas.
- As mãos apoiadas em mármore branco de veios cinza suaves ou em linho branco. Unhas dela amendoadas, nude ou rosadas. Mangas claras (camisa branca, tricô creme).
- Kit com solitário: o solitário vai no mesmo dedo dela, junto da aliança.
- Anel: mão feminina, na mesma cena. Colar, gargantilha e corrente: busto (pescoço e colo), roupa clara e lisa, sem o rosto inteiro. Brinco: orelha de perfil, cabelo preso. Pulseira: pulso. Tornozeleira: tornozelo.

ANTES DE GERAR, LEIA A PEÇA NA FOTO DO SITE
- Abra a foto atual da loja e, se precisar, aumente luz e contraste para ver os detalhes.
- Largura: confira a medida no nome (2 mm, 2,5 mm, 3 mm, 4 mm, 5 mm) e mantenha a proporção no dedo. 2 mm é fino, 5 mm é largo. Largura errada no dedo é o erro que mais aparece.
- Pedras: conte quantas são em cada peça, onde ficam e a cor de cada uma.
- Formato: reta, abaulada, chanfrada ou anatômica; friso no meio, nas bordas ou na diagonal.
- Acabamento: liso polido, fosco (escovado ou jateado) ou diamantado (brilho picado). Cada faixa da peça pode ter um diferente.
- Metal: prata 950 é branca e fria. Ouro amarelo, rosé e branco não se trocam.

DEPOIS DE GERAR, REVISE ANTES DE ENVIAR
- Ponha a foto nova ao lado da original e confira um por um: largura, número e posição das pedras, formato, friso, acabamento e cor do metal.
- Se qualquer item estiver diferente, corrija e gere de novo. Só envie quando estiver idêntica.

RECUSE E REFAÇA SE
- a pedra mudou de tamanho, cor, quantidade ou lugar;
- a largura no dedo não bate com a medida;
- o acabamento trocou (fosco virou liso, o diamantado sumiu);
- a peça entortou, derreteu ou ganhou reflexo estranho;
- a aliança está na mão errada.

EXEMPLO PRONTO: Cherí 4 mm (código 1873) e Eternal Love 3 mm (código 217), já na loja.'
where category_id is null;
