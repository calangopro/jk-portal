"use client";

import { useId } from "react";
import { ESPESSURA_MM, MAOS, type TipoDeMao } from "@/lib/ferramentas/maos";
import { comBasePath } from "@/lib/seo/base-path";
import { gradienteDoMaterial, type MaterialDaPeca } from "@/lib/ferramentas/materiais";

/**
 * Mão fotográfica com a aliança no anelar, em tamanho real de tela.
 *
 * Substitui a ilustração de traço de `Dedo.tsx`, que já tinha queimado quatro
 * tentativas de realismo e cujo arquivo conclui que vetor tem teto para pele.
 * A foto resolve a pele de graça; o trabalho passou a ser fazer a ALIANÇA
 * pertencer à foto, e cair no dedo certo em qualquer aro e qualquer largura.
 *
 * ## As três coisas que fazem a medida ser honesta
 *
 * 1. **A foto se ajusta ao aro, não o contrário.** A escala sai de
 *    `(diametroMm * escala) / larguraDoDedo`, então o anelar na tela mede
 *    exatamente o diâmetro do aro. É a mesma regra que a ilustração seguia.
 * 2. **A faixa tem a altura da largura em milímetros**, e nada mais. Sem curva
 *    nas bordas: já foi tentado no desenho e atrapalhava justamente a
 *    comparação que a ferramenta existe para fazer. O realismo vem do
 *    acabamento, não de deformar a medida.
 * 3. **A faixa é RECORTADA PELO ALPHA DA PRÓPRIA FOTO.** É isto que responde
 *    "e se aumentar o tamanho?". A faixa é desenhada com a maior extensão que o
 *    dedo tem em toda a altura que ela pode ocupar, e a máscara apara o que
 *    sobra. O dedo afina de baixo para cima; sem a máscara, uma aliança de 8 mm
 *    escaparia para fora da pele em cima e deixaria vão embaixo. Com ela, a
 *    faixa acompanha a silhueta em qualquer largura, sem uma constante a mais.
 *
 * A máscara e a foto são o MESMO arquivo, posicionado do mesmo jeito. É por isso
 * que o webp precisa de `alphaQuality: 100` ao ser gerado: alpha borrado vira
 * borda suja de metal em cima da pele.
 *
 * ## O que vende o realismo
 *
 * Nada disso muda a medida, tudo acontece dentro da faixa ou abaixo dela:
 * o degradê de metal do próprio site (as paradas de `MATERIAIS`, que já
 * desenham a volta do cilindro), um escurecimento nas duas bordas onde o metal
 * encontra a pele, e uma sombra projetada logo abaixo, também recortada pelo
 * dedo. Sombra é o que mais convence: sem ela a faixa parece adesivo.
 */
export function MaoComAlianca({
  diametroMm,
  larguraMm,
  escala,
  tipo = "feminino",
  material = "ouro",
  rotulo,
  className = "",
}: {
  /** Diâmetro interno do aro: é a largura do anelar na linha da aliança. */
  diametroMm: number;
  /** Largura da aliança, em milímetros. */
  larguraMm: number;
  /** Pixels por milímetro da tela, vindos da calibração do medidor. */
  escala: number;
  tipo?: TipoDeMao;
  material?: MaterialDaPeca;
  rotulo: string;
  className?: string;
}) {
  const id = useId();
  const mao = MAOS[tipo];

  /**
   * O prefixo `/guias` entra AQUI, à mão, e não é descuido de quem escreveu.
   *
   * O `basePath` do Next prefixa `next/image`, `next/link` e companhia, mas não
   * encosta em `<img src>` escrito por extenso nem em `url()` de CSS. Os dois
   * aparecem neste componente: a foto é `img` cru (ver o comentário no JSX) e a
   * máscara é `url()`. Sem isto, o arquivo é procurado na raiz do domínio, que
   * em produção é a loja da Tray, e volta 404: a mão some e sobra um retângulo
   * do tamanho certo, vazio.
   */
  const arquivo = comBasePath(mao.src);

  /* ----------------------------------------------------------- escala */

  // A foto inteira é redimensionada até o anelar medir o diâmetro do aro.
  const k = (diametroMm * escala) / mao.alianca.larguraDoDedo;

  const fotoLargura = mao.largura * k;
  const fotoAltura = mao.altura * k;

  // Deslocamento da foto dentro da janela: leva o canto do recorte à origem.
  const fotoEsq = -mao.corte.x * k;
  const fotoTopo = -mao.corte.y * k;

  const janelaLargura = mao.corte.largura * k;
  const janelaAltura = mao.corte.altura * k;

  /* ------------------------------------------------------------ faixa */

  // A ÚNICA medida que a pessoa compara. Não arredonda, não encolhe.
  const alturaDaFaixa = larguraMm * escala;

  /**
   * A peça é MAIS LARGA que o dedo, e reta.
   *
   * A primeira versão recortava a faixa pela silhueta da foto, e estava errada
   * por dois motivos que só aparecem quando se olha um anel de verdade:
   *
   *   1. **Anel é rígido.** O dedo afina de baixo para cima, o anel não. Preso à
   *      silhueta, o metal encolhia junto com a pele e lia como listra pintada.
   *   2. **Anel tem parede.** O diâmetro externo é o do dedo mais duas
   *      espessuras, então a peça sobra para os dois lados, por cima do vão até
   *      o dedo vizinho. É essa sobra que faz o olho entender que a coisa
   *      envolve o dedo em vez de estar desenhada nele.
   *
   * A largura sai da mesma conta que tudo aqui, então ela acompanha o aro
   * sozinha, e a sobra cabe no vão medido em `menorVao` até no aro mais fino.
   */
  const larguraExterna = (diametroMm + 2 * ESPESSURA_MM) * escala;
  const faixaEsq = (mao.alianca.centroX - mao.corte.x) * k - larguraExterna / 2;

  // A base fica parada e a faixa CRESCE PARA CIMA. É como anel se comporta: ele
  // desce até a base do dedo e para. Ancorar pelo centro fazia a faixa fina
  // boiar alto e a larga descer para o vão entre os dedos.
  const faixaBase = (mao.alianca.repousoY - mao.corte.y) * k;
  const faixaTopo = faixaBase - alturaDaFaixa;

  // Canto arredondado pelo perfil da peça, nunca maior que metade da altura,
  // senão uma aliança de 2 mm vira cápsula.
  const raio = Math.min(alturaDaFaixa / 2, ESPESSURA_MM * escala * 0.9);

  /**
   * A sombra que a peça joga na pele, logo abaixo dela.
   *
   * Esta sim é recortada pelo alpha da foto: sombra cai SOBRE o dedo, então ela
   * tem de morrer na borda da pele. Sem ela a aliança flutua.
   */
  const sombraAltura = Math.max(5, alturaDaFaixa * 0.5);
  const sombraTopo = faixaBase;
  const sombraEsq = (mao.alianca.centroX - mao.corte.x) * k - (mao.alianca.larguraDoDedo * k) / 2;
  const sombraLargura = mao.alianca.larguraDoDedo * k;

  const mascaraDaSombra = {
    maskImage: `url(${arquivo})`,
    WebkitMaskImage: `url(${arquivo})`,
    maskSize: `${fotoLargura}px ${fotoAltura}px`,
    WebkitMaskSize: `${fotoLargura}px ${fotoAltura}px`,
    maskPosition: `${fotoEsq - sombraEsq}px ${fotoTopo - sombraTopo}px`,
    WebkitMaskPosition: `${fotoEsq - sombraEsq}px ${fotoTopo - sombraTopo}px`,
    maskRepeat: "no-repeat",
    WebkitMaskRepeat: "no-repeat",
  } as const;

  return (
    <figure className={`m-0 ${className}`}>
      <div
        className="relative overflow-hidden rounded-lg"
        style={{ width: janelaLargura, height: janelaAltura }}
        role="img"
        aria-label={`${mao.alt}. ${rotulo}`}
      >
        {/* A foto. `img` cru e não `next/image`: o mesmo arquivo serve de
            máscara para a sombra, e o otimizador entregaria outro endereço e
            outro tamanho, o que desalinharia o recorte. O webp já é leve. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={arquivo}
          alt=""
          aria-hidden
          draggable={false}
          className="pointer-events-none absolute max-w-none select-none"
          style={{ left: fotoEsq, top: fotoTopo, width: fotoLargura, height: fotoAltura }}
        />

        {/* Sombra na pele. Recortada pelo dedo, senão ela apareceria no vão. */}
        <div
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            left: sombraEsq,
            top: sombraTopo,
            width: sombraLargura,
            height: sombraAltura,
            background:
              "linear-gradient(to bottom, rgb(72 38 14 / 0.38), rgb(72 38 14 / 0.12) 45%, rgb(72 38 14 / 0))",
            ...mascaraDaSombra,
          }}
        />

        {/* A aliança. */}
        <div
          aria-hidden
          className="pointer-events-none absolute overflow-hidden"
          style={{
            left: faixaEsq,
            top: faixaTopo,
            width: larguraExterna,
            height: alturaDaFaixa,
            borderRadius: raio,
            background: gradienteDoMaterial(material),
            boxShadow: "0 1px 2px rgb(50 26 8 / 0.45)",
          }}
        >
          {/* O que faz o olho ler METAL POLIDO, e não plástico amarelo.
              A lição está registrada no visor 3D do comparador de materiais e
              vale igual aqui: o que convence é a alternância DURA entre borda
              escura, estouro de luz e meio-tom, mais um CORTE SECO no meio da
              altura. Aquele corte é o horizonte: acima a peça reflete o céu,
              abaixo reflete o chão, e num objeto polido a passagem entre os dois
              não tem transição. A primeira versão degradava suave no meio, e era
              exatamente isso que deixava a aliança com cara de adesivo.
              As paradas de `MATERIAIS` continuam desenhando a volta do cilindro
              de um lado ao outro; esta camada é a altura. */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to bottom," +
                " rgb(26 13 2 / 0.66) 0%," +
                " rgb(255 250 232 / 0.34) 5%," +
                " rgb(255 255 255 / 0.16) 17%," +
                " rgb(255 255 255 / 0.05) 49.4%," +
                " rgb(26 14 3 / 0.34) 50%," +
                " rgb(26 14 3 / 0.20) 80%," +
                " rgb(255 243 212 / 0.26) 95%," +
                " rgb(18 8 0 / 0.7) 100%)",
            }}
          />
        </div>

        <span hidden id={id} />
      </div>

      <figcaption className="sr-only">{rotulo}</figcaption>
    </figure>
  );
}
