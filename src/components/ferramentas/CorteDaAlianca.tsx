import {
  perfilDaAlianca,
  type FormatoDeAlianca,
  type ModeloDeAlianca,
  type PontoDoPerfil,
} from "@/lib/aliancas/perfis";
import { diametroDoAro } from "@/lib/medidor/aros";

/**
 * O corte da aliança, desenhado.
 *
 * O objeto 3D mostra o metal e a luz, que é o que faz a peça parecer real. Mas
 * a FORMA, num anel polido, some dentro do reflexo: em foto de catálogo, uma
 * abaulada reta e uma abaulada anatômica parecem a mesma peça. O que separa as
 * duas é o corte, e o corte é um desenho, não um render.
 *
 * Os pontos são os mesmos que geram a malha 3D, então este desenho nunca
 * discorda do objeto ao lado. Aqui o eixo do furo fica embaixo: para cima é o
 * lado de fora da peça, para baixo é o dedo, que é como joalheiro desenha.
 */

type Props = {
  modelo: ModeloDeAlianca;
  formato: FormatoDeAlianca;
  larguraMm: number;
  espessuraMm: number;
  aro: number;
  /** Cor de base do metal, para o preenchimento combinar com o 3D. */
  cor?: string;
  /** Acabamento fosco: o desenho perde o estouro de luz e fica chapado. */
  fosco?: boolean;
  /** Versão de ícone: sem régua e sem rótulo. */
  compacto?: boolean;
  /**
   * Mostra a linha do dedo mesmo no ícone. É o que separa reta de anatômica a
   * olho: na reta a peça encosta na linha de ponta a ponta, na anatômica só no
   * meio. Sem a linha, os dois ícones parecem o mesmo desenho.
   */
  linhaDoDedo?: boolean;
  className?: string;
};

function caminho(pontos: PontoDoPerfil[], rBase: number): string {
  // x = posição na largura, y = altura da parede. O sinal do y inverte porque
  // em SVG o eixo cresce para baixo, e aqui para cima é o lado de fora.
  const d = pontos
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.y.toFixed(3)} ${(rBase - p.r).toFixed(3)}`)
    .join(" ");
  return `${d} Z`;
}

export function CorteDaAlianca({
  modelo,
  formato,
  larguraMm,
  espessuraMm,
  aro,
  cor = "#e7c063",
  fosco = false,
  compacto = false,
  linhaDoDedo = false,
  className = "",
}: Props) {
  const pontos = perfilDaAlianca(modelo, formato, { larguraMm, espessuraMm, aro });
  const ri = diametroDoAro(aro) / 2;
  const ro = ri + espessuraMm;

  const folga = compacto ? (linhaDoDedo ? 0.3 : 0.18) : 0.55;
  const largura = larguraMm + folga * 2;
  const altura = espessuraMm + folga * 2;
  const idGrad = `corte-${modelo}-${formato}-${Math.round(larguraMm * 10)}${compacto ? "-i" : ""}`;
  const idCorte = `${idGrad}-limite`;
  const contorno = caminho(pontos, ro);

  return (
    <svg
      viewBox={`${-largura / 2} ${-folga} ${largura} ${altura}`}
      className={className}
      role="img"
      aria-label={`Corte da aliança ${modelo} ${formato}, ${larguraMm.toLocaleString("pt-BR")} milímetros de largura`}
    >
      <defs>
        {/* O metal do corte é a mesma cor do 3D, com a luz vindo de cima, que é
            de onde ela vem no palco ao lado. No fosco o estouro de luz some, e
            o desenho fica chapado de propósito: é o que o acabamento faz. */}
        <linearGradient id={idGrad} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={cor} stopOpacity={fosco ? 0.72 : 0.95} />
          <stop offset="45%" stopColor={cor} stopOpacity={fosco ? 0.66 : 0.62} />
          <stop offset="100%" stopColor={cor} stopOpacity={fosco ? 0.6 : 0.9} />
        </linearGradient>
        {fosco ? (
          <clipPath id={idCorte}>
            <path d={contorno} />
          </clipPath>
        ) : null}
      </defs>

      {!compacto || linhaDoDedo ? (
        /* Onde o dedo encosta. Na anatômica, só o meio toca esta linha, e é
           exatamente isso que a pessoa precisa enxergar. */
        <line
          x1={-largura / 2}
          y1={ro - ri}
          x2={largura / 2}
          y2={ro - ri}
          stroke="currentColor"
          strokeOpacity={compacto ? 0.5 : 0.35}
          strokeWidth={compacto ? 0.07 : 0.05}
          strokeDasharray="0.22 0.18"
        />
      ) : null}

      {!compacto ? (
        <>
          <text
            x={largura / 2 - 0.1}
            y={ro - ri + 0.42}
            textAnchor="end"
            fontSize="0.32"
            fill="currentColor"
            fillOpacity="0.5"
          >
            dedo
          </text>
        </>
      ) : null}

      {/* Duas passadas na mesma forma. A de baixo dá corpo, porque metal claro
          sobre painel claro some: prata desenhada só com a cor da prata vira um
          vazio branco. A de cima traz o metal e o contorno, que é o que faz o
          olho ler peça e não mancha. */}
      <path d={contorno} fill="currentColor" fillOpacity="0.14" />
      <path
        d={contorno}
        fill={`url(#${idGrad})`}
        stroke="currentColor"
        strokeOpacity="0.55"
        strokeWidth={compacto ? 0.07 : 0.05}
        strokeLinejoin="round"
      />

      {/* O risco do acetinado. Polida e fosca têm o MESMO corte, então sem isto
          os dois botões desenham a mesma figura e a pessoa não vê o que está
          escolhendo. O risco é o acabamento, que é a única diferença real. */}
      {fosco ? (
        <g clipPath={`url(#${idCorte})`}>
          {[0.28, 0.46, 0.64, 0.82].map((f) => (
            <line
              key={f}
              x1={-largura / 2}
              y1={espessuraMm * f}
              x2={largura / 2}
              y2={espessuraMm * f}
              stroke="currentColor"
              strokeOpacity="0.42"
              strokeWidth="0.035"
              strokeDasharray="0.11 0.09"
            />
          ))}
        </g>
      ) : null}
    </svg>
  );
}
