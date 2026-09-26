import { REFERENCIAS, type ReferenciaId } from "@/lib/medidor/aros";

/**
 * Desenho do objeto de calibração, no tamanho real que a tela está mostrando.
 *
 * Antes a etapa de calibração mostrava um retângulo dourado liso e um ícone
 * genérico de linha. Reconhecer o objeto na tela é justamente o que faz a
 * pessoa encostar o objeto certo, então a moeda parece uma moeda e o cartão
 * parece um cartão.
 */
export function ObjetoReferencia({
  id,
  pxPorMm,
  className = "",
}: {
  id: ReferenciaId;
  pxPorMm: number;
  className?: string;
}) {
  const r = REFERENCIAS[id];

  if (r.formato === "circulo") {
    const lado = r.medidaMm * pxPorMm;
    return (
      <svg
        width={lado}
        height={lado}
        viewBox="0 0 100 100"
        aria-hidden
        className={`block select-none ${className}`}
      >
        <defs>
          <linearGradient id="jk-moeda-borda" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#e8d3a6" />
            <stop offset="45%" stopColor="#b8935a" />
            <stop offset="100%" stopColor="#8a6a38" />
          </linearGradient>
          <linearGradient id="jk-moeda-centro" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#e9e6e0" />
            <stop offset="55%" stopColor="#c2beb6" />
            <stop offset="100%" stopColor="#9d9890" />
          </linearGradient>
        </defs>

        {/* A moeda de 1 real é bimetálica: anel dourado e miolo prateado. */}
        <circle cx="50" cy="50" r="49.5" fill="url(#jk-moeda-borda)" />
        <circle cx="50" cy="50" r="49.5" fill="none" stroke="rgb(0 0 0 / 0.35)" strokeWidth="1" />
        <circle cx="50" cy="50" r="33" fill="url(#jk-moeda-centro)" />
        <circle cx="50" cy="50" r="33" fill="none" stroke="rgb(0 0 0 / 0.25)" strokeWidth="0.8" />

        {/* Serrilha da borda. */}
        <g stroke="rgb(0 0 0 / 0.18)" strokeWidth="0.7">
          {Array.from({ length: 72 }, (_, i) => {
            const a = (i / 72) * Math.PI * 2;
            const x1 = 50 + Math.cos(a) * 41;
            const y1 = 50 + Math.sin(a) * 41;
            const x2 = 50 + Math.cos(a) * 47;
            const y2 = 50 + Math.sin(a) * 47;
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />;
          })}
        </g>

        <text
          x="50"
          y="56"
          textAnchor="middle"
          fontSize="26"
          fontWeight="700"
          fill="rgb(40 36 32 / 0.55)"
          fontFamily="serif"
        >
          1
        </text>
      </svg>
    );
  }

  const largura = r.medidaMm * pxPorMm;
  const altura = REFERENCIAS.cartao.alturaMm * pxPorMm;
  // Filete de 2 px na tela, em unidades do viewBox (856 unidades = 85,6 mm).
  const filete = 20 / pxPorMm;

  return (
    <svg
      width={largura}
      height={altura}
      viewBox="0 0 856 540"
      aria-hidden
      className={`block select-none ${className}`}
    >
      <defs>
        <linearGradient id="jk-cartao" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2c2822" />
          <stop offset="55%" stopColor="#1c1916" />
          <stop offset="100%" stopColor="#37312a" />
        </linearGradient>
        <linearGradient id="jk-chip" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e8cf9c" />
          <stop offset="100%" stopColor="#a9863f" />
        </linearGradient>
      </defs>

      <rect width="856" height="540" rx="46" fill="url(#jk-cartao)" />
      {/* A borda é a medida, então ela precisa aparecer. Era um fio branco de
          16% num cartão escuro sobre o palco escuro: com o cartão de verdade
          por cima, a sobra do desenho que passava da borda dele não se via, e
          era essa sobra que dizia "grande demais". O filete dourado fica todo
          POR DENTRO da borda, para não somar nada ao tamanho. */}
      <rect
        x={filete / 2}
        y={filete / 2}
        width={856 - filete}
        height={540 - filete}
        rx={46 - filete / 2}
        fill="none"
        stroke="#e2c894"
        strokeWidth={filete}
      />

      {/* Chip */}
      <rect x="70" y="170" width="112" height="88" rx="14" fill="url(#jk-chip)" />
      <g stroke="rgb(40 33 22 / 0.45)" strokeWidth="4">
        <line x1="70" y1="200" x2="182" y2="200" />
        <line x1="70" y1="228" x2="182" y2="228" />
        <line x1="126" y1="170" x2="126" y2="258" />
      </g>

      {/* Numeração em relevo, sem informação nenhuma de verdade. */}
      <g fill="rgb(255 255 255 / 0.5)">
        <rect x="70" y="330" width="140" height="24" rx="8" />
        <rect x="238" y="330" width="140" height="24" rx="8" />
        <rect x="406" y="330" width="140" height="24" rx="8" />
        <rect x="574" y="330" width="140" height="24" rx="8" />
      </g>
      <rect x="70" y="410" width="200" height="18" rx="7" fill="rgb(255 255 255 / 0.28)" />

      {/* Brilho diagonal. */}
      <path d="M556 0 L856 0 L856 540 L376 540 Z" fill="rgb(255 255 255 / 0.05)" />
    </svg>
  );
}
