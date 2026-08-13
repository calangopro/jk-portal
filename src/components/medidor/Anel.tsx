/**
 * O anel de medição, desenhado como joia.
 *
 * O que importa aqui é o FURO: o círculo interno precisa bater exatamente com
 * a parte interna da aliança apoiada na tela. Tudo o mais (aro dourado,
 * brilho, sombra) existe só para a pessoa entender que aquilo representa uma
 * aliança, e nunca invade o furo.
 */
export function Anel({ furoPx }: { furoPx: number }) {
  // Espessura do aro: cresce um pouco com o furo, mas nunca vira um pneu.
  const banda = Math.min(18, Math.max(10, furoPx * 0.14));
  // Folga para caber o vizinho maior, a sombra e o brilho.
  const folga = banda + 30;
  const lado = furoPx + folga * 2;
  const c = lado / 2;
  const rFuro = furoPx / 2;
  const rExterno = rFuro + banda;

  return (
    <svg
      width={lado}
      height={lado}
      viewBox={`0 0 ${lado} ${lado}`}
      aria-hidden
      className="pointer-events-none block select-none overflow-visible"
    >
      {/*
        Os tons daqui NÃO saem dos tokens de tema, e é de propósito.
        Este gradiente desenha o metal de uma aliança de ouro: são cinco paradas
        que imitam reflexo, sombra e brilho da peça. Se alguém trocar o dourado
        da marca por azul no admin, a aliança na tela precisa continuar de ouro,
        senão a ferramenta passa a mentir sobre o produto.
      */}
      <defs>
        <linearGradient id="jk-metal" x1="0" y1="0" x2="0.85" y2="1">
          <stop offset="0%" stopColor="#f0dcb4" />
          <stop offset="22%" stopColor="#d8b877" />
          <stop offset="48%" stopColor="#a8823f" />
          <stop offset="68%" stopColor="#e6cd9c" />
          <stop offset="100%" stopColor="#8d6a33" />
        </linearGradient>

        <radialGradient id="jk-halo">
          <stop offset="55%" stopColor="rgb(190 155 96 / 0.35)" />
          <stop offset="100%" stopColor="rgb(190 155 96 / 0)" />
        </radialGradient>

        <filter id="jk-sombra" x="-60%" y="-60%" width="220%" height="220%">
          <feDropShadow
            dx="0"
            dy={banda * 0.5}
            stdDeviation={banda * 0.65}
            floodColor="#000"
            floodOpacity="0.55"
          />
        </filter>

        {/* O furo é recortado de verdade, para nada do metal invadir a medida. */}
        <mask id="jk-mascara-aro">
          <rect width={lado} height={lado} fill="black" />
          <circle cx={c} cy={c} r={rExterno} fill="white" />
          <circle cx={c} cy={c} r={rFuro} fill="black" />
        </mask>
      </defs>

      {/* Brilho atmosférico atrás da peça. */}
      <circle cx={c} cy={c} r={rExterno + 30} fill="url(#jk-halo)" />

      <g filter="url(#jk-sombra)">
        <g mask="url(#jk-mascara-aro)">
          <circle cx={c} cy={c} r={rExterno} fill="url(#jk-metal)" />
          {/* Brilho especular: duas lambidas de luz, como em metal polido. */}
          <ellipse
            cx={c - rExterno * 0.34}
            cy={c - rExterno * 0.52}
            rx={rExterno * 0.32}
            ry={rExterno * 0.14}
            fill="#fff"
            opacity="0.55"
            transform={`rotate(-38 ${c - rExterno * 0.34} ${c - rExterno * 0.52})`}
          />
          <ellipse
            cx={c + rExterno * 0.44}
            cy={c + rExterno * 0.42}
            rx={rExterno * 0.2}
            ry={rExterno * 0.08}
            fill="#fff"
            opacity="0.3"
            transform={`rotate(-38 ${c + rExterno * 0.44} ${c + rExterno * 0.42})`}
          />
        </g>
      </g>

      {/* Arestas: uma clara por fora, uma escura no furo. É o que dá a leitura
          de peça sólida em vez de círculo chapado. */}
      <circle
        cx={c}
        cy={c}
        r={rExterno}
        fill="none"
        stroke="rgb(255 255 255 / 0.45)"
        strokeWidth="1"
      />
      <circle
        cx={c}
        cy={c}
        r={rFuro}
        fill="none"
        stroke="rgb(20 18 15 / 0.75)"
        strokeWidth="1.5"
      />

      {/* Cruz de centralização, discreta, dentro do furo. */}
      <g stroke="rgb(243 236 225 / 0.4)" strokeWidth="1">
        <line x1={c - 6} y1={c} x2={c + 6} y2={c} />
        <line x1={c} y1={c - 6} x2={c} y2={c + 6} />
      </g>
    </svg>
  );
}
