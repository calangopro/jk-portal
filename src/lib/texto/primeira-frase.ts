/**
 * Separa a primeira frase do resto do parágrafo.
 *
 * Existe para ORGANIZAR sem cortar. A abertura das ferramentas é a "resposta
 * primeiro", e ela não é só texto de tela: o mesmo campo alimenta o `llms.txt` e
 * a `descricao` do schema `HowTo`. Encurtar para caber melhor tiraria conteúdo
 * de dois lugares que existem justamente para serem lidos por máquina.
 *
 * A saída é a mesma palavra por palavra e na mesma ordem. O que muda é o ritmo:
 * a primeira frase entra como linha de apoio, em corpo maior, e o resto vem
 * abaixo em texto normal. Um bloco de oito linhas vira uma abertura e um
 * parágrafo, sem que uma letra saia da página.
 *
 * Sobre o ponto: o corte só acontece em ponto SEGUIDO DE ESPAÇO, e é isso que
 * salva os números. "R$ 9.900" e "1.110" têm dígito depois do ponto, então não
 * são confundidos com fim de frase. Decimal em português usa vírgula
 * ("18,46 mm", "2,5535 mm"), então esse caso nem aparece.
 */
export function separarPrimeiraFrase(texto: string): [string, string] {
  const limpo = texto.trim();
  // `[\s\S]` no lugar de `.` com a flag `s`: o alvo do TypeScript neste
  // projeto é anterior ao es2018, onde aquela flag ainda não existe.
  const corte = limpo.match(/^([\s\S]+?[.!?])\s+(\S[\s\S]*)$/);
  if (!corte) return [limpo, ""];
  return [corte[1], corte[2]];
}
