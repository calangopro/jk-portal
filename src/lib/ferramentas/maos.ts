/**
 * As mãos fotográficas do simulador de largura, e as medidas que fazem a
 * aliança cair no dedo certo.
 *
 * A ilustração de traço (`components/ferramentas/Dedo.tsx`) já tinha queimado
 * quatro tentativas de realismo, e o arquivo dela registra a conclusão: vetor
 * tem teto para pele, e quase-real fica pior que assumidamente desenhado. A
 * saída foi parar de desenhar e usar foto.
 *
 * ## O eixo, que não muda
 *
 * A regra que a ilustração já obedecia continua valendo aqui, e é ela que
 * mantém a ferramenta honesta:
 *
 *   **a largura do dedo na linha da aliança é o diâmetro do aro.**
 *
 * Disso sai tudo. A foto é escalada por
 *
 *   escala = (diametroDoAro(aro) * pxPorMm) / larguraDoDedo
 *
 * então o dedo na tela tem o tamanho real daquele aro, e a aliança desenhada
 * por cima tem altura `larguraMm * pxPorMm`, também real. Trocar o aro
 * redimensiona a mão inteira; trocar a largura mexe só na faixa.
 *
 * ## Como estas medidas foram tiradas
 *
 * Lendo o canal alpha do próprio arquivo, linha por linha, e não no olho. Para
 * cada altura `y` o script separa as faixas opacas, que são os dedos, e pega a
 * que contém o anelar. Reproduzir para uma mão nova:
 *
 *   1. **Identificar o anelar.** Numa mão esquerda de costas, com o polegar à
 *      direita, a ordem da esquerda para a direita é mindinho, ANELAR, médio,
 *      indicador, polegar. Confere pela ordem em que as pontas aparecem de cima
 *      para baixo: o médio é o mais alto, o mindinho o mais baixo.
 *   2. **Achar onde os dedos se fundem** (`fundeY`): a primeira altura, descendo,
 *      em que a faixa do anelar quase dobra de largura. Ali é a base do dedo.
 *   3. **Escolher a linha de repouso** (`repousoY`), que é onde fica a borda de
 *      BAIXO da aliança, alguns pixels acima de `fundeY`. Conferir depois o PIOR
 *      CASO com `topoNoPiorCaso()`: a faixa mais alta que a ferramenta consegue
 *      pedir é 8 mm num aro 7, o dedo mais fino da tabela, o que dá 53,5% da
 *      largura do dedo. O topo dela tem de continuar abaixo das dobras da junta,
 *      senão a aliança mais larga sobe por cima do nó do dedo.
 *   4. **Medir largura, centro e vão** na linha de repouso. O vão é a distância
 *      até o dedo vizinho, e serve para conferir que a sobra da peça cabe nele:
 *      a aliança é mais larga que o dedo, porque tem espessura.
 *
 * O recorte sai da mesma medida: 2,9 larguras de dedo, centrado no anelar, com a
 * aliança por volta de 60% da altura. Eram 3,3, e com a calibração real de um
 * celular a moldura passava dos 300 px disponíveis e a área começava a rolar de
 * lado, o que é péssimo justamente no aparelho em que a ferramenta mais é usada.
 * Em 2,9 o anelar aparece inteiro e sobra cerca de 0,95 de dedo de cada lado,
 * que é o bastante para o olho entender que aquilo é uma mão. É o enquadramento que a ilustração usava, e
 * o que faz o anelar aparecer inteiro com um vizinho de cada lado.
 */

export type TipoDeMao = "feminino" | "masculino";

export type Mao = {
  tipo: TipoDeMao;
  /** Servido de `public/`. WebP porque o MESMO arquivo é foto e máscara. */
  src: string;
  /** Tamanho natural do arquivo, em pixel. */
  largura: number;
  altura: number;
  /** Texto do `alt`. */
  alt: string;

  alianca: {
    /**
     * Altura, em pixel da imagem, da borda de BAIXO da aliança.
     *
     * É a borda de baixo, e não o centro, porque é assim que anel se comporta:
     * ele desce até encostar na base do dedo e para ali. Uma aliança mais larga
     * não afunda no vão entre os dedos, ela avança para CIMA.
     *
     * Ancorar pelo centro tinha dois defeitos. Uma faixa fina ficava boiando
     * alto demais, longe da base, porque o centro havia sido escolhido pensando
     * na faixa mais larga. E ao comparar 3 mm com 4 mm as duas cresciam para os
     * dois lados, então nenhuma borda servia de referência. Com a base fixa, as
     * larguras partem todas da mesma linha e a diferença aparece em cima.
     */
    repousoY: number;
    /** Largura do anelar NA LINHA DE REPOUSO. É ela que vira o diâmetro do aro. */
    larguraDoDedo: number;
    /** Centro do anelar na mesma linha. A peça é centrada aqui. */
    centroX: number;
    /**
     * Menor vão até o dedo vizinho, na linha de repouso.
     *
     * A aliança é MAIS LARGA que o dedo, porque tem espessura, e sobra para os
     * dois lados. Este número existe para conferir que a sobra cabe no vão: no
     * aro mais fino da tabela ela chega a 10 px de imagem de cada lado.
     */
    menorVao: number;
  };

  /** Janela mostrada na tela, em pixel da imagem. */
  corte: { x: number; y: number; largura: number; altura: number };

  /**
   * Onde os dedos se fundem. Não é usado para desenhar: fica registrado para a
   * conferência do pior caso continuar possível quando alguém mexer na linha da
   * aliança.
   */
  fundeY: number;
};

export const MAOS: Record<TipoDeMao, Mao> = {
  feminino: {
    tipo: "feminino",
    src: "/mao-feminina.webp",
    largura: 1000,
    altura: 1573,
    alt: "Mão feminina com aliança no dedo anelar",
    alianca: { repousoY: 692, larguraDoDedo: 119, centroX: 340, menorVao: 12 },
    corte: { x: 168, y: 129, largura: 345, altura: 909 },
    fundeY: 700,
  },
  masculino: {
    tipo: "masculino",
    src: "/mao-masculina.webp",
    largura: 1000,
    altura: 1573,
    alt: "Mão masculina com aliança no dedo anelar",
    alianca: { repousoY: 654, larguraDoDedo: 128, centroX: 335.5, menorVao: 14 },
    corte: { x: 150, y: 131, largura: 371, altura: 843 },
    fundeY: 662,
  },
};

/**
 * A maior fração da largura do dedo que uma aliança pode ocupar.
 *
 * 8 mm é a faixa mais larga da tabela e o aro 7 é o dedo mais fino, então esta
 * é a combinação que mais estica a faixa. Serve para conferir, uma vez, que a
 * linha escolhida aguenta o pior caso; não entra em conta de renderização.
 */
export const PIOR_FRACAO_DA_FAIXA = 8 / (47 / Math.PI);

/**
 * Sobra, em pixel da imagem, entre onde a aliança descansa e a base do dedo.
 *
 * Com a âncora na borda de baixo, a faixa nunca desce, então este número não
 * depende mais da largura escolhida: é só a distância da linha de repouso até o
 * vão entre os dedos. Negativo significa que a linha ficou baixa demais.
 */
export function folgaAteABase(mao: Mao): number {
  return mao.fundeY - mao.alianca.repousoY;
}

/**
 * Altura da faixa mais larga que a ferramenta consegue pedir, em pixel da
 * imagem, e onde ela terminaria subindo. Serve para conferir, ao trocar de mão,
 * que nem o pior caso passa por cima da junta.
 */
export function topoNoPiorCaso(mao: Mao): number {
  return mao.alianca.repousoY - mao.alianca.larguraDoDedo * PIOR_FRACAO_DA_FAIXA;
}

/**
 * Espessura da aliança, em milímetros, de parede a parede.
 *
 * Existe porque anel não é adesivo: ele envolve o dedo, então o diâmetro EXTERNO
 * é o do dedo mais duas paredes, e a peça sobra para os dois lados. Sem essa
 * sobra a faixa lê como listra pintada na pele, que foi exatamente o que
 * apareceu na primeira versão.
 *
 * 1,3 mm é aliança lisa comum. O número também é o teto do que cabe: no aro 7,
 * o dedo mais fino da tabela, a sobra dá cerca de 10 px de imagem de cada lado,
 * contra um vão de 12 px para o dedo vizinho na mão feminina.
 */
export const ESPESSURA_MM = 1.3;
