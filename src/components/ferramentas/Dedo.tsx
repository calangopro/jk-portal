"use client";

import { useId } from "react";

/**
 * Mão com aliança, em ilustração de traço, no tamanho real da tela.
 *
 * Quatro versões foram descartadas antes desta, e vale registrar por quê:
 *
 *   1. retângulo arredondado com uma faixa atravessada. Parecia diagrama.
 *   2. um dedo sozinho, de frente, cortado embaixo. Dedo sozinho não lê como
 *      dedo, e a silhueta cortada lia como outra coisa.
 *   3. três dedos com pele em degradê, tentando realismo. Vetor tem teto para
 *      pele, e quase-real fica pior que assumidamente desenhado.
 *   4. os mesmos três dedos em traço, mas soltos no ar, sem a mão embaixo.
 *
 * O que faltava no quarto era a MÃO. Dedo que não chega em lugar nenhum
 * continua sendo dedo solto, mesmo bem desenhado. Aqui os dedos entram na
 * dobra, o contorno da mão passa por cima das bases e o desenho termina no
 * dorso, que se dissolve embaixo.
 *
 * Como é construído:
 *
 *  1. A MEDIDA MANDA. A largura do dedo do meio na linha da aliança é exatamente
 *     o diâmetro do aro, em milímetros reais vezes a escala da tela. Todo o
 *     resto da mão é proporção desse raio, então trocar o aro redesenha a cena
 *     inteira, e não muda a escala do desenho.
 *  2. SILHUETA POR PERFIL. Uma função devolve a meia largura do dedo em cada
 *     altura: afina para a ponta, engrossa nas juntas, termina em calota.
 *  3. A MÃO COBRE AS BASES. Os dedos são desenhados primeiro e o dorso vem por
 *     cima, com a borda de cima recortada em ondas que passam pelos vãos. É o
 *     que faz os dedos nascerem da mão em vez de encostarem nela.
 *  4. SOMBRA CHAPADA, não degradê. Cada peça ganha uma cópia de si mesma
 *     deslocada e recortada, preenchida com um segundo tom. É a técnica de
 *     desenho animado, e é o que mantém o traço limpo.
 *  5. A ALIANÇA É RETA. Já foi curvada, imitando anel visto de cima, e a curva
 *     atrapalhava exatamente o que a ferramenta existe para fazer: comparar
 *     larguras. Reta, a altura da faixa na tela É a largura em milímetros.
 */

export type TipoDeDedo = "feminino" | "masculino";
export type TomDePele = "clara" | "media" | "escura";

/**
 * Dois tons chapados por pele, mais a cor do traço.
 *
 * O traço é sempre o tom mais escuro e dessaturado da própria pele: linha preta
 * endurece o desenho, e linha que acompanha o preenchimento some.
 */
const PELE: Record<
  TomDePele,
  { base: string; sombra: string; traco: string; unha: string }
> = {
  clara: { base: "#fbe3d2", sombra: "#f2cdb6", traco: "#9a6a4d", unha: "#fbeee6" },
  media: { base: "#eec39c", sombra: "#dda87c", traco: "#895c37", unha: "#f6ddc4" },
  escura: { base: "#c68f61", sombra: "#ac7549", traco: "#5f3a22", unha: "#dfb992" },
};

export const TONS: { id: TomDePele; nome: string; amostra: string }[] = [
  { id: "clara", nome: "Pele clara", amostra: PELE.clara.base },
  { id: "media", nome: "Pele média", amostra: PELE.media.base },
  { id: "escura", nome: "Pele escura", amostra: PELE.escura.base },
];

/**
 * Os metais que a JK trabalha, cada um como uma sequência de paradas de cor.
 *
 * Metal não é uma cor, é um PADRÃO DE REFLEXO: escuro na borda, um estouro de
 * luz quase branco logo depois, um meio-tom, uma segunda luz mais fraca do
 * outro lado e escuro de novo. É essa alternância dura, com as paradas bem
 * próximas, que faz o olho ler ouro polido em vez de amarelo chapado. Gradiente
 * suave de três paradas, que era o que estava aqui antes, lê como mostarda.
 *
 * As mesmas paradas alimentam o desenho, a bolinha do seletor e a barra da
 * comparação, então nunca ficam três dourados diferentes na mesma tela.
 */
export type MaterialDaPeca = "ouro" | "ouro-rose" | "ouro-branco" | "prata";

export const MATERIAIS: {
  id: MaterialDaPeca;
  nome: string;
  paradas: [number, string][];
}[] = [
  {
    id: "ouro",
    nome: "Ouro amarelo",
    paradas: [
      [0, "#6b4a17"],
      [7, "#a87c2c"],
      [16, "#f6e7b4"],
      [23, "#fffbe9"],
      [32, "#e3c273"],
      [46, "#b88a2f"],
      [60, "#8a6520"],
      [72, "#e9d091"],
      [84, "#fff6d6"],
      [93, "#a97f30"],
      [100, "#5c3f14"],
    ],
  },
  {
    id: "ouro-rose",
    nome: "Ouro rosé",
    paradas: [
      [0, "#7a4632"],
      [7, "#b87a5f"],
      [16, "#f6d5c2"],
      [23, "#fff1e8"],
      [32, "#e7b295"],
      [46, "#c98363"],
      [60, "#9c5f45"],
      [72, "#eab89c"],
      [84, "#ffe6d8"],
      [93, "#a96c50"],
      [100, "#6d4030"],
    ],
  },
  {
    id: "ouro-branco",
    nome: "Ouro branco",
    paradas: [
      [0, "#75736f"],
      [7, "#a5a29c"],
      [16, "#f2f0ea"],
      [23, "#ffffff"],
      [32, "#dcd8d0"],
      [46, "#aba79f"],
      [60, "#87847e"],
      [72, "#e4e1da"],
      [84, "#fbfaf6"],
      [93, "#9a968f"],
      [100, "#6b6863"],
    ],
  },
  {
    id: "prata",
    nome: "Prata 925",
    paradas: [
      [0, "#5f6469"],
      [7, "#909699"],
      [16, "#eef2f5"],
      [23, "#ffffff"],
      [32, "#c9d0d6"],
      [46, "#959ca2"],
      [60, "#767d83"],
      [72, "#dbe1e6"],
      [84, "#fdfeff"],
      [93, "#8b9298"],
      [100, "#5a5f64"],
    ],
  },
];

/** O mesmo metal em CSS, para o seletor e para as barras de comparação. */
export function gradienteDoMaterial(id: MaterialDaPeca) {
  const m = MATERIAIS.find((x) => x.id === id) ?? MATERIAIS[0];
  return `linear-gradient(90deg, ${m.paradas.map(([o, c]) => `${c} ${o}%`).join(", ")})`;
}

/** Esmalte da unha feita: rosa chapado, do jeito que ilustração faz. */
const ESMALTE = "#eda3ac";
const ESMALTE_SOMBRA = "#dd8894";

type Perfil = {
  calota: number;
  pontaW: number;
  distalW: number;
  meioW: number;
  proximalW: number;
  baseW: number;
  unhaW: number;
  unhaH: number;
  esmalte: boolean;
};

/** Proporções do dedo, em múltiplos do raio na linha da aliança. */
const PERFIS: Record<TipoDeDedo, Perfil> = {
  feminino: {
    calota: 1.12,
    pontaW: 0.76,
    distalW: 0.85,
    meioW: 0.82,
    proximalW: 0.93,
    baseW: 1.04,
    unhaW: 0.52,
    unhaH: 1.15,
    esmalte: true,
  },
  masculino: {
    calota: 0.95,
    pontaW: 0.86,
    distalW: 0.94,
    meioW: 0.9,
    proximalW: 1,
    baseW: 1.08,
    unhaW: 0.6,
    unhaH: 0.95,
    esmalte: false,
  },
};

const Y_DISTAL = 2.05;
const Y_MEIO = 2.95;
const Y_PROXIMAL = 3.85;
const Y_ANEL = 4.65;
const Y_BASE = 5.65;
/** Respiro acima da ponta do dedo mais alto. */
const Y_TOPO = 0.9;
/** Onde a mão começa: a linha dos vãos entre os dedos. */
const Y_VAO = 6.5;
/** Onde o desenho termina, já dentro do dorso da mão. */
const Y_FIM = 8.6;

/**
 * Os três dedos da cena, em múltiplos do diâmetro (x) e do raio (y).
 *
 * O médio é mais comprido que o anelar e o mínimo é bem mais curto: é essa
 * diferença que faz a mão parecer mão. O afastamento deixa um vão entre as
 * silhuetas, e é dentro dele que a aliança termina.
 */
const DEDOS = [
  { chave: "medio", dx: -1.1, dy: -0.6, fator: 1.05, giro: -3 },
  { chave: "minimo", dx: 1.08, dy: 1.85, fator: 0.82, giro: 5 },
  { chave: "anelar", dx: 0, dy: 0, fator: 1, giro: 0 },
] as const;

/** Interpolação suave (smoothstep) entre duas âncoras do perfil. */
function suave(t: number) {
  return t * t * (3 - 2 * t);
}

function entre(y: number, y0: number, y1: number, w0: number, w1: number) {
  return w0 + (w1 - w0) * suave((y - y0) / (y1 - y0));
}

/** Meia largura do dedo, em múltiplos do raio, na altura `y` (também em raios). */
function meiaLargura(y: number, p: Perfil) {
  if (y <= 0) return 0;
  // Calota elíptica: a ponta do dedo é arredondada, não cortada.
  if (y < p.calota) {
    const t = 1 - y / p.calota;
    return p.pontaW * Math.sqrt(Math.max(0, 1 - t * t));
  }
  if (y < Y_DISTAL) return entre(y, p.calota, Y_DISTAL, p.pontaW, p.distalW);
  if (y < Y_MEIO) return entre(y, Y_DISTAL, Y_MEIO, p.distalW, p.meioW);
  if (y < Y_PROXIMAL) return entre(y, Y_MEIO, Y_PROXIMAL, p.meioW, p.proximalW);
  if (y < Y_ANEL) return entre(y, Y_PROXIMAL, Y_ANEL, p.proximalW, 1);
  return entre(Math.min(y, Y_BASE), Y_ANEL, Y_BASE, 1, p.baseW);
}

/** Curva suave passando por todos os pontos (Catmull-Rom virando Bézier). */
function curvaSuave(pts: [number, number][]) {
  if (pts.length < 2) return "";
  let d = `M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i - 1] ?? pts[i];
    const b = pts[i];
    const c = pts[i + 1];
    const e = pts[i + 2] ?? c;
    const c1 = [b[0] + (c[0] - a[0]) / 6, b[1] + (c[1] - a[1]) / 6];
    const c2 = [c[0] - (e[0] - b[0]) / 6, c[1] - (e[1] - b[1]) / 6];
    d += ` C ${c1[0].toFixed(2)} ${c1[1].toFixed(2)} ${c2[0].toFixed(2)} ${c2[1].toFixed(2)} ${c[0].toFixed(2)} ${c[1].toFixed(2)}`;
  }
  return d;
}

const alturaDaMaoMm = (diametroMm: number) => ((Y_TOPO + Y_FIM) * diametroMm) / 2;
const larguraDaMaoMm = (diametroMm: number) => diametroMm * 2.35;

export function DedoComAlianca({
  diametroMm,
  larguraMm,
  escala,
  tipo = "feminino",
  tom = "clara",
  material = "ouro",
  rotulo,
  className = "",
}: {
  /** Diâmetro interno do aro: é a largura do dedo do meio na linha da aliança. */
  diametroMm: number;
  /** Largura da aliança, em milímetros. */
  larguraMm: number;
  /** Pixels por milímetro da tela, vindos da calibração do medidor. */
  escala: number;
  tipo?: TipoDeDedo;
  tom?: TomDePele;
  material?: MaterialDaPeca;
  rotulo: string;
  className?: string;
}) {
  // Ids únicos: a mesma ferramenta pode aparecer duas vezes na mesma página
  // (dentro do artigo e no rodapé dele), e gradiente com id repetido faz um
  // desenho roubar o preenchimento do outro.
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const p = PERFIS[tipo];
  const cor = PELE[tom];

  const R = (diametroMm * escala) / 2;
  const D = diametroMm * escala;
  const L = larguraMm * escala;

  const largura = larguraDaMaoMm(diametroMm) * escala;
  const altura = alturaDaMaoMm(diametroMm) * escala;
  const cx = largura / 2;
  const yTopo = Y_TOPO * R;

  /** Espessura do traço. Uma só para a cena inteira, como em nanquim. */
  const traco = Math.max(1.1, R * 0.06);
  /** Deslocamento da sombra chapada. */
  const desloca = R * 0.34;

  /* ------------------------------------------------------- silhuetas */

  const AMOSTRAS = 56;

  /** Contorno de um dedo, já deslocado, descendo até o fim do desenho. */
  function contornoDe(dx: number, dy: number, fator: number) {
    const centro = cx + dx * D;
    const base = yTopo + dy * R;
    const esquerda: string[] = [];
    const direita: string[] = [];

    for (let i = 0; i <= AMOSTRAS; i++) {
      const yr = (i / AMOSTRAS) * Y_BASE;
      const w = meiaLargura(yr, p) * R * fator;
      const y = base + yr * R;
      esquerda.push(`${(centro - w).toFixed(2)} ${y.toFixed(2)}`);
      direita.push(`${(centro + w).toFixed(2)} ${y.toFixed(2)}`);
    }

    // A última largura desce reta até o fim: dali para baixo quem manda é a mão.
    const wBase = p.baseW * R * fator;
    esquerda.push(`${(centro - wBase).toFixed(2)} ${altura.toFixed(2)}`);
    direita.push(`${(centro + wBase).toFixed(2)} ${altura.toFixed(2)}`);

    return `M ${esquerda.join(" L ")} L ${direita.reverse().join(" L ")} Z`;
  }

  /** Contorno da unha: quadrada de canto arredondado, como unha feita. */
  function unhaDe(dx: number, dy: number, fator: number) {
    const centro = cx + dx * D;
    const base = yTopo + dy * R;
    const hw = p.unhaW * R * fator;
    const alt = p.unhaH * R;
    const topo = base + R * (p.calota * 0.38);
    const pe = topo + alt;
    const canto = hw * 0.62;

    return {
      d: [
        `M ${centro - hw} ${pe - alt * 0.16}`,
        `L ${centro - hw} ${topo + canto}`,
        `Q ${centro - hw} ${topo} ${centro - hw + canto} ${topo}`,
        `L ${centro + hw - canto} ${topo}`,
        `Q ${centro + hw} ${topo} ${centro + hw} ${topo + canto}`,
        `L ${centro + hw} ${pe - alt * 0.16}`,
        `Q ${centro} ${pe + alt * 0.16} ${centro - hw} ${pe - alt * 0.16}`,
        "Z",
      ].join(" "),
      centro,
      hw,
      alt,
      topo,
      pe,
    };
  }

  const anelar = DEDOS.find((d) => d.chave === "anelar")!;
  const contornoAnelar = contornoDe(anelar.dx, anelar.dy, anelar.fator);
  const unhaAnelar = unhaDe(anelar.dx, anelar.dy, anelar.fator);

  /* ----------------------------------------------------------- a mão */

  /**
   * O dorso da mão, com a borda de cima em ondas.
   *
   * Os picos ficam nos vãos entre os dedos e os vales no meio de cada dedo, um
   * pouco abaixo. É esse recorte que faz o dedo nascer da mão: o desenho do
   * dedo continua para baixo, e a mão passa por cima escondendo a base dele.
   */
  const yVao = yTopo + Y_VAO * R;
  const vale = R * 0.36;

  const pontosDaMao: [number, number][] = [
    [-R * 0.6, yVao + vale * 0.15],
    [cx + DEDOS[0].dx * D, yVao + vale],
    [cx + (DEDOS[0].dx + DEDOS[2].dx) * 0.5 * D, yVao - vale * 0.55],
    [cx, yVao + vale],
    [cx + (DEDOS[2].dx + DEDOS[1].dx) * 0.5 * D, yVao - vale * 0.35],
    [cx + DEDOS[1].dx * D, yVao + vale * 1.2],
    [largura + R * 0.6, yVao + vale * 0.9],
  ];

  const mao = `${curvaSuave(pontosDaMao)} L ${largura + R} ${altura} L ${-R} ${altura} Z`;

  /**
   * A sombra que os dedos jogam na mão: uma faixa acompanhando a borda de cima,
   * e não a mão inteira escurecida. É o que dá a entender que os dedos estão na
   * frente do dorso.
   */
  const sombraDaMao = `${curvaSuave(pontosDaMao)} ${curvaSuave(
    [...pontosDaMao].reverse().map(([x, y]) => [x, y + R * 0.8] as [number, number]),
  ).replace("M", "L")} Z`;

  /* ------------------------------------------------------- aliança */

  // Espessura do metal que passa da silhueta do dedo. É pouco, e cabe dentro do
  // vão entre os dedos: aliança de verdade some ali, não invade o vizinho.
  const transborda = Math.max(1, R * 0.07);
  const hwAnel = R + transborda;
  const yAnel = yTopo + Y_ANEL * R;
  // Reta de propósito: a altura da faixa na tela é a largura em milímetros, e
  // curva atrapalharia a única coisa que esta ferramenta precisa entregar.
  const topoAnel = yAnel - L / 2;

  /**
   * Todas as peças de carne da cena, na ordem de trás para a frente.
   *
   * Elas são pintadas DUAS vezes: a primeira com traço grosso da cor da linha,
   * que junta tudo num borrão só, e a segunda só com o preenchimento, que come
   * o miolo desse borrão. O que sobra é o contorno da UNIÃO das peças, sem
   * nenhuma linha atravessando por dentro. É o jeito de conseguir contorno de
   * silhueta em SVG, que não tem operação booleana.
   */
  const Silhueta = () => (
    <>
      <path d={mao} />
      {DEDOS.map((d) => (
        <g
          key={d.chave}
          transform={`rotate(${d.giro} ${(cx + d.dx * D).toFixed(2)} ${altura.toFixed(2)})`}
        >
          <path d={contornoDe(d.dx, d.dy, d.fator)} />
        </g>
      ))}
    </>
  );

  return (
    <svg
      width={largura}
      height={altura}
      viewBox={`0 0 ${largura} ${altura}`}
      role="img"
      aria-label={rotulo}
      className={`block ${className}`}
    >
      <defs>
        {/* O único material da cena, vindo do catálogo de metais. */}
        <linearGradient id={`${id}-metal`} x1="0" y1="0" x2="1" y2="0">
          {(MATERIAIS.find((m) => m.id === material) ?? MATERIAIS[0]).paradas.map(
            ([offset, cor]) => (
              <stop key={offset} offset={`${offset}%`} stopColor={cor} />
            ),
          )}
        </linearGradient>

        {/* Verniz vertical: luz na aresta de cima, sombra na de baixo. É o que
            arredonda a peça sem curvar a geometria, que precisa ficar reta para
            a largura poder ser medida na tela. */}
        {/* O corte é seco no meio de propósito: metal polido reflete o céu na
            metade de cima e o chão na de baixo, e é essa quebra dura que o olho
            lê como brilho. Degradê suave de cima a baixo lê como plástico. */}
        <linearGradient id={`${id}-verniz`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.6" />
          <stop offset="14%" stopColor="#fff" stopOpacity="0.16" />
          <stop offset="43%" stopColor="#fff" stopOpacity="0.02" />
          <stop offset="46%" stopColor="#241703" stopOpacity="0.1" />
          <stop offset="56%" stopColor="#241703" stopOpacity="0.26" />
          <stop offset="74%" stopColor="#241703" stopOpacity="0.12" />
          <stop offset="93%" stopColor="#241703" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0.22" />
        </linearGradient>

        <clipPath id={`${id}-clip-anelar`}>
          <path d={contornoAnelar} />
        </clipPath>
        {/* Filhos de clipPath se somam, então este recorta a UNIÃO das peças. */}
        <clipPath id={`${id}-silhueta`}>
          <path d={mao} />
          {DEDOS.map((d) => (
            <g
              key={d.chave}
              transform={`rotate(${d.giro} ${(cx + d.dx * D).toFixed(2)} ${altura.toFixed(2)})`}
            >
              <path d={contornoDe(d.dx, d.dy, d.fator)} />
            </g>
          ))}
        </clipPath>
        <clipPath id={`${id}-clip-unha`}>
          <path d={unhaAnelar.d} />
        </clipPath>

        {/* O desenho não termina: ele se dissolve no fundo. */}
        <linearGradient id={`${id}-desvanecer`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="82%" stopColor="#fff" />
          <stop offset="100%" stopColor="#000" />
        </linearGradient>
        <mask
          id={`${id}-esvai`}
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width={largura}
          height={altura}
        >
          <rect width={largura} height={altura} fill={`url(#${id}-desvanecer)`} />
        </mask>
      </defs>

      <g mask={`url(#${id}-esvai)`} strokeLinecap="round" strokeLinejoin="round">
        {/* 1. o borrão de tinta: tudo junto, com traço grosso */}
        <g
          fill={cor.traco}
          stroke={cor.traco}
          strokeWidth={traco * 2}
          strokeLinejoin="round"
        >
          <Silhueta />
        </g>

        {/* 2. a carne por cima, que come o miolo e deixa só o contorno da união */}
        <g fill={cor.base}>
          <Silhueta />
        </g>

        {/* 3. sombra chapada, presa na silhueta inteira.
               No dedo é uma cópia dele mesmo empurrada quase a largura toda para
               a direita, então sobra só a fatia da direita, que é onde a luz não
               bate. Na mão é uma faixa acompanhando a borda de cima, que é a
               sombra que os dedos jogam no dorso. */}
        <g clipPath={`url(#${id}-silhueta)`} fill={cor.sombra}>
          {DEDOS.map((d) => (
            <g
              key={d.chave}
              transform={`rotate(${d.giro} ${(cx + d.dx * D).toFixed(2)} ${altura.toFixed(2)})`}
            >
              <path
                d={contornoDe(d.dx, d.dy, d.fator)}
                transform={`translate(${R * 0.72} 0)`}
              />
            </g>
          ))}
          <path d={sombraDaMao} opacity="0.85" />
        </g>

        {/* 4. a prega entre os dedos: um risco curto descendo de cada vão. É o
               que faz a mão ter dedos, e não uma luva. */}
        <g fill="none" stroke={cor.traco} strokeOpacity="0.55" strokeWidth={traco * 0.8}>
          {[1, 3].map((i) => {
            const [x, y] = pontosDaMao[i === 1 ? 2 : 4];
            return (
              <path
                key={i}
                d={`M ${x} ${y} q ${R * 0.06} ${R * 0.5} ${-R * 0.05} ${R * 0.9}`}
              />
            );
          })}
        </g>

        {/* 5. vincos das juntas do dedo do meio */}
        <g
          clipPath={`url(#${id}-clip-anelar)`}
          fill="none"
          stroke={cor.traco}
          strokeOpacity="0.45"
          strokeWidth={traco * 0.7}
        >
          {[0, 1].map((i) => {
            const yv = yTopo + (Y_DISTAL + 0.2 * (i - 0.5)) * R;
            const w = meiaLargura((yv - yTopo) / R, p) * R * 0.58;
            return (
              <path key={`d${i}`} d={`M ${cx - w} ${yv} Q ${cx} ${yv + R * 0.16} ${cx + w} ${yv}`} />
            );
          })}
          {[0, 1].map((i) => {
            const yv = yTopo + (Y_PROXIMAL + 0.22 * (i - 0.5)) * R;
            const w = meiaLargura((yv - yTopo) / R, p) * R * 0.52;
            return (
              <path
                key={`p${i}`}
                d={`M ${cx - w} ${yv} Q ${cx} ${yv + R * 0.18} ${cx + w} ${yv}`}
                strokeOpacity="0.3"
              />
            );
          })}
        </g>

        {/* 6. unhas */}
        {DEDOS.map((d) => {
          const unha = unhaDe(d.dx, d.dy, d.fator);
          const ehAnelar = d.chave === "anelar";
          return (
            <g
              key={d.chave}
              transform={`rotate(${d.giro} ${(cx + d.dx * D).toFixed(2)} ${altura.toFixed(2)})`}
            >
              <path
                d={unha.d}
                fill={p.esmalte ? ESMALTE : cor.unha}
                stroke={cor.traco}
                strokeWidth={traco * (ehAnelar ? 0.85 : 0.75)}
              />
              {ehAnelar ? (
                <g clipPath={`url(#${id}-clip-unha)`}>
                  <path
                    d={unha.d}
                    fill={p.esmalte ? ESMALTE_SOMBRA : cor.sombra}
                    transform={`translate(${desloca * 0.7} 0)`}
                    opacity={p.esmalte ? 1 : 0.5}
                  />
                  {p.esmalte ? (
                    // Meia-lua de luz: é como ilustração diz "esmaltada".
                    <path
                      d={`M ${unha.centro - unha.hw * 0.55} ${unha.topo + unha.alt * 0.62} Q ${unha.centro - unha.hw * 0.6} ${unha.topo + unha.alt * 0.22} ${unha.centro - unha.hw * 0.14} ${unha.topo + unha.alt * 0.12}`}
                      fill="none"
                      stroke="#fff"
                      strokeOpacity="0.7"
                      strokeWidth={traco * 0.9}
                    />
                  ) : (
                    // Borda livre da unha natural.
                    <path
                      d={`M ${unha.centro - unha.hw} ${unha.topo + unha.alt * 0.22} Q ${unha.centro} ${unha.topo + unha.alt * 0.06} ${unha.centro + unha.hw} ${unha.topo + unha.alt * 0.22}`}
                      fill="none"
                      stroke={cor.traco}
                      strokeOpacity="0.45"
                      strokeWidth={traco * 0.7}
                    />
                  )}
                </g>
              ) : null}
            </g>
          );
        })}

        {/* 7. a aliança, único material da cena */}
        <g>
          <rect
            x={cx - hwAnel}
            y={topoAnel}
            width={hwAnel * 2}
            height={L}
            fill={`url(#${id}-metal)`}
          />
          <rect
            x={cx - hwAnel}
            y={topoAnel}
            width={hwAnel * 2}
            height={L}
            fill={`url(#${id}-verniz)`}
          />
          {/* Fio de luz na aresta de cima: é o que faz a peça brilhar de longe.
              Fica DENTRO da faixa, para não somar altura à medida. */}
          <rect
            x={cx - hwAnel}
            y={topoAnel + traco * 0.35}
            width={hwAnel * 2}
            height={Math.max(0.7, L * 0.055)}
            fill="#fff"
            opacity="0.72"
          />
          <rect
            x={cx - hwAnel}
            y={topoAnel}
            width={hwAnel * 2}
            height={L}
            fill="none"
            stroke={cor.traco}
            strokeWidth={traco * 0.9}
          />
        </g>
      </g>
    </svg>
  );
}
