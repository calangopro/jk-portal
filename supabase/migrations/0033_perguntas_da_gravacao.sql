-- As perguntas que faltam para a pré-visualização de gravação existir.
--
-- POR QUE ENTRAM COMO FATO, E NÃO COMO ANOTAÇÃO EM ALGUM LUGAR
--
-- A ferramenta de gravação é a única das quatro planejadas que não tem NENHUM
-- dado de apoio próprio. O conversor tem convenção de numeração, o simulador
-- tem geometria, o comparador tem definição metrológica e o catálogo real. A
-- gravação é inteira uma regra de produto da JK: quais fontes existem, quantos
-- caracteres cabem, se é laser ou diamante, se muda preço e prazo.
--
-- Construir com número inventado seria prometer o que a fábrica não faz. E
-- guardar as perguntas num documento à parte é como elas somem.
--
-- Ficam aqui, em `validar`, na mesma tela que a equipe já usa para aprovar
-- fato. Quando a JK responder, alguém edita a afirmação, aprova, e a ferramenta
-- passa a ter de onde nascer.

insert into public.facts (claim, detail, module, subject, attribute, captured_at, responsible, status) values
  ('ESCREVER: quais fontes a JK oferece na gravação.', 'A pré-visualização de gravação não pode ser construída sem isto: desenhar uma fonte que a fábrica não usa seria prometer o que não existe. Pedir a lista e, se possível, o arquivo de cada uma.', 'produtos', 'gravacao', 'fontes', null, 'a confirmar com a JK', 'validar'),
  ('ESCREVER: quantos caracteres cabem por largura de aliança.', 'O limite muda com a largura e com o diâmetro interno. Pedir a tabela: quantos caracteres em 2, 3, 4, 5, 6 e 8 mm.', 'produtos', 'gravacao', 'limite', null, 'a confirmar com a JK', 'validar'),
  ('ESCREVER: a gravação é a laser ou a diamante, e qual a diferença para o cliente.', 'Muda profundidade, durabilidade e o que dá para gravar. Pedir também se as duas existem e se o cliente escolhe.', 'produtos', 'gravacao', 'tecnica', null, 'a confirmar com a JK', 'validar'),
  ('ESCREVER: a gravação altera o preço ou o prazo de entrega.', 'Se altera, quanto e em que casos. Sem isto a ferramenta não pode dizer nada sobre custo.', 'produtos', 'gravacao', 'preco_prazo', null, 'a confirmar com a JK', 'validar'),
  ('ESCREVER: o que pode e o que não pode ser gravado.', 'Símbolo, emoji, impressão digital, coordenada, batimento cardíaco, alfabeto não latino. Pedir a política.', 'produtos', 'gravacao', 'permitido', null, 'a confirmar com a JK', 'validar'),
  ('ESCREVER: peça gravada pode ser trocada.', 'Personalização costuma mudar a regra de troca. Pedir a política escrita, porque isto entra na página de produto e na FAQ.', 'garantias', 'gravacao', 'troca', null, 'a confirmar com a JK', 'validar');
