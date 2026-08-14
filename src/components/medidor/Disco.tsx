/**
 * O disco de medição.
 *
 * Antes aqui havia um ANEL desenhado como joia, com aro dourado e furo no meio.
 * Era bonito e era confuso: um anel tem duas bordas, e ninguém sabia qual delas
 * encostar na aliança, a de dentro ou a de fora. Medida com duas bordas é
 * medida com duas respostas.
 *
 * Agora é um DISCO CHEIO, com uma borda só. O diâmetro do disco é exatamente o
 * diâmetro interno que está sendo medido, então o gesto vira um só, e ele é
 * verificável a olho: crescer até a sombra escura em volta do dourado sumir.
 * No instante em que o escuro some, o disco tem o tamanho do furo da aliança.
 *
 * Por isso a borda é o elemento mais trabalhado do desenho: um fio claro por
 * dentro e um fio escuro por fora, para o olho achar o limite exato mesmo com o
 * metal da peça encostado ali.
 */
export function Disco({ furoPx }: { furoPx: number }) {
  const r = furoPx / 2;
  // Folga para o halo e para a sombra caberem sem cortar.
  const folga = Math.max(24, r * 0.35);
  const lado = furoPx + folga * 2;
  const c = lado / 2;

  return (
    <svg
      width={lado}
      height={lado}
      viewBox={`0 0 ${lado} ${lado}`}
      aria-hidden
      className="pointer-events-none block select-none overflow-visible"
    >
      {/*
        Os tons daqui NÃO saem dos tokens de tema, e é de propósito. Este
        gradiente desenha ouro. Se alguém trocar o dourado da marca por azul no
        admin, a peça na tela precisa continuar de ouro, senão a ferramenta
        passa a mentir sobre o produto.
      */}
      <defs>
        <linearGradient id="jk-disco" x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0%" stopColor="#f6e6c2" />
          <stop offset="28%" stopColor="#dcbc80" />
          <stop offset="55%" stopColor="#bd9455" />
          <stop offset="78%" stopColor="#e2c894" />
          <stop offset="100%" stopColor="#9a7538" />
        </linearGradient>

        <radialGradient id="jk-disco-halo">
          <stop offset="60%" stopColor="rgb(190 155 96 / 0.3)" />
          <stop offset="100%" stopColor="rgb(190 155 96 / 0)" />
        </radialGradient>
      </defs>

      {/* Brilho atmosférico atrás da peça. */}
      <circle cx={c} cy={c} r={r + folga * 0.8} fill="url(#jk-disco-halo)" />

      <circle cx={c} cy={c} r={r} fill="url(#jk-disco)" />

      {/* Lambida de luz, como em metal polido. Fica bem dentro da borda para
          nunca disputar atenção com o limite do disco. */}
      <ellipse
        cx={c - r * 0.3}
        cy={c - r * 0.42}
        rx={r * 0.42}
        ry={r * 0.18}
        fill="#fff"
        opacity="0.42"
        transform={`rotate(-38 ${c - r * 0.3} ${c - r * 0.42})`}
      />

      {/* A borda, que é a medida. Fio claro por dentro, fio escuro por fora. */}
      <circle cx={c} cy={c} r={r - 1} fill="none" stroke="rgb(255 249 232 / 0.75)" strokeWidth="1.5" />
      <circle cx={c} cy={c} r={r} fill="none" stroke="rgb(20 18 15 / 0.55)" strokeWidth="1" />

      {/* Cruz de centralização, discreta. */}
      <g stroke="rgb(60 44 20 / 0.45)" strokeWidth="1">
        <line x1={c - 7} y1={c} x2={c + 7} y2={c} />
        <line x1={c} y1={c - 7} x2={c} y2={c + 7} />
      </g>
    </svg>
  );
}
