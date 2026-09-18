import type { ReactNode } from "react";

/**
 * A palavra serifada do título.
 *
 * Desde 18/09/2026 o portal escreve título em Montserrat, a mesma fonte da loja,
 * porque a Cormorant em todo H1, H2 e H3 fazia as duas pontas da mesma marca
 * parecerem sites diferentes. O charme não sumiu, ficou concentrado: UMA palavra
 * por título, em itálico serifado.
 *
 * Duas regras que valem para quem for escolher a palavra:
 *
 *   1. **Uma por título.** Duas já viram enfeite e a página perde o ponto de
 *      descanso do olho.
 *   2. **A palavra que carrega o sentido**, não a primeira nem a mais bonita.
 *      Em "Descubra o tamanho da sua aliança pela tela" o destaque é *tamanho*,
 *      porque é o que a pessoa foi procurar. Destacar *Descubra* enfeitaria o
 *      verbo e deixaria o substantivo apagado.
 *
 * O desenho da letra mora em `.serifada`, no globals.css.
 */
export function Destaque({ children }: { children: ReactNode }) {
  return <span className="serifada">{children}</span>;
}

/**
 * A mesma coisa, para título que chega como STRING (registro de ferramenta,
 * campo do banco, texto de fábrica dos blocos).
 *
 * Se a palavra não estiver no texto, devolve o texto intacto em vez de quebrar:
 * título é conteúdo, e conteúdo muda sem ninguém lembrar de conferir o destaque.
 * A busca ignora acento e caixa, senão "aliança" nunca casaria com o que o
 * editor digitou sem cedilha.
 *
 * Casa a palavra INTEIRA, entre limites de palavra. Sem isso, destacar "aro"
 * pintaria o começo de "arredondado".
 */
export function comDestaque(texto: string, palavra?: string): ReactNode {
  if (!palavra) return texto;

  const semAcento = (s: string) =>
    s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  const alvo = semAcento(palavra);
  const achatado = semAcento(texto);

  // Procura casando posição a posição no texto achatado, que tem o MESMO
  // comprimento do original porque `NFD` mais remoção de diacrítico devolve a
  // string sem os combinantes. É isso que deixa recortar o texto original pelo
  // índice encontrado no achatado.
  if (achatado.length !== texto.length) return texto;

  const limite = (c: string | undefined) => c === undefined || !/[\p{L}\p{N}]/u.test(c);

  let i = achatado.indexOf(alvo);
  while (i !== -1) {
    if (limite(achatado[i - 1]) && limite(achatado[i + alvo.length])) {
      return (
        <>
          {texto.slice(0, i)}
          <Destaque>{texto.slice(i, i + alvo.length)}</Destaque>
          {texto.slice(i + alvo.length)}
        </>
      );
    }
    i = achatado.indexOf(alvo, i + 1);
  }

  return texto;
}
