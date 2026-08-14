import { diametroDoAro } from "@/lib/medidor/aros";

/**
 * O corte da aliança, em milímetros.
 *
 * DOIS EIXOS, NÃO UMA LISTA
 *
 * Aliança lisa não tem "quatro tipos". Tem duas decisões independentes, e é
 * assim que a JK vende:
 *
 *   MODELO   é a face de FORA, a que se vê. Abaulada, chanfrada, polida ou
 *            fosca. Polida e fosca têm a mesma face plana e mudam no
 *            acabamento, que é o quanto o metal espelha.
 *   FORMATO  é o lado de DENTRO, o que encosta no dedo. Reta ou anatômica.
 *
 * Uma lista única de quatro nomes esconderia isso e obrigaria a escolher entre
 * ver a face de fora ou ver o interior. Separando, existe abaulada reta e
 * abaulada anatômica, chanfrada reta e chanfrada anatômica, e assim por diante,
 * que é o catálogo de verdade.
 *
 * POR QUE ISTO EXISTE, E POR QUE NÃO É UM ARQUIVO .OBJ
 *
 * Aliança lisa é um sólido de revolução: um contorno de dois eixos girado 360°
 * em torno do furo. Quem desenha em programa 3D desenha exatamente isso, e o
 * .obj que sairia dali seria uma malha já cozida, com a largura, a espessura e
 * o aro CONGELADOS dentro dela. Com dois eixos e seis larguras, seriam 48
 * arquivos para a mesma peça.
 *
 * Guardando o contorno como matemática, toda combinação sai do mesmo lugar, em
 * qualquer aro, pesando zero byte de download. E ganha uma coisa que malha
 * pronta não dá: o mesmo contorno que vira o objeto 3D vira também o desenho do
 * corte na tela, então o desenho nunca discorda do 3D.
 *
 * Tudo aqui é MILÍMETRO, como no resto do medidor. Duas coordenadas:
 *
 *   r  distância até o eixo do furo (para fora é maior)
 *   y  posição ao longo da largura da peça, de -largura/2 a +largura/2
 *
 * A ordem dos pontos importa. O contorno sai pela face de FORA no sentido de y
 * crescente, atravessa para dentro, e volta pela face de DENTRO no sentido de y
 * decrescente. É essa volta que faz a normal da superfície apontar para fora na
 * face externa e para o dedo na interna, que é o que o 3D precisa para a luz
 * bater do lado certo.
 */

export type PontoDoPerfil = {
  r: number;
  y: number;
  /** Raio do arredondamento neste canto, em mm. Sem isso, o canto sai vivo. */
  raio?: number;
};

/** A face de fora. */
export const MODELOS = ["abaulada", "chanfrada", "polida", "fosca"] as const;
export type ModeloDeAlianca = (typeof MODELOS)[number];

/** O lado de dentro, o que encosta no dedo. */
export const FORMATOS = ["reta", "anatomica"] as const;
export type FormatoDeAlianca = (typeof FORMATOS)[number];

export type Modelo = {
  id: ModeloDeAlianca;
  nome: string;
  /** Uma linha, só sobre a peça. Conforto e durabilidade são afirmação da JK. */
  descricao: string;
  /** Fosca espalha o reflexo em vez de devolver a imagem do ambiente. */
  fosco?: boolean;
};

export const MODELOS_INFO: Modelo[] = [
  {
    id: "abaulada",
    nome: "Abaulada",
    descricao:
      "A face de fora é curva, mais alta no meio do que nas bordas. É a que muita gente chama de clássica, a curvadinha.",
  },
  {
    id: "chanfrada",
    nome: "Chanfrada",
    descricao:
      "A face de fora é plana e as duas bordas são cortadas em 45°. O chanfro acende duas linhas de brilho ao longo da peça.",
  },
  {
    id: "polida",
    nome: "Polida",
    descricao:
      "Face de fora plana, com acabamento espelhado. É a que devolve o ambiente inteiro, e a que mais muda de aparência conforme a luz do lugar.",
  },
  {
    id: "fosca",
    nome: "Fosca",
    descricao:
      "A mesma face plana da polida, com acabamento acetinado. O reflexo se espalha em vez de formar imagem, e o metal fica com brilho de cetim.",
    fosco: true,
  },
];

export type Formato = {
  id: FormatoDeAlianca;
  nome: string;
  descricao: string;
};

export const FORMATOS_INFO: Formato[] = [
  {
    id: "reta",
    nome: "Reta",
    descricao:
      "O lado de dentro é plano, então a aliança encosta no dedo com toda a largura dela.",
  },
  {
    id: "anatomica",
    nome: "Anatômica",
    descricao:
      "O lado de dentro é curvo, então só a faixa central encosta no dedo. Por fora a peça continua igual, e a diferença aparece ao girar.",
  },
];

export function acharModelo(id: string): Modelo | undefined {
  return MODELOS_INFO.find((m) => m.id === id);
}

export function acharFormato(id: string): Formato | undefined {
  return FORMATOS_INFO.find((f) => f.id === id);
}

/** Medidas da peça. Tudo em milímetros. */
export type MedidasDaAlianca = {
  larguraMm: number;
  /** Parede, do furo até a face de fora. */
  espessuraMm: number;
  aro: number;
};

/** Espessura padrão de aliança lisa, quando ninguém informou outra. */
export const ESPESSURA_PADRAO = 1.5;

/**
 * Arredonda um canto do contorno.
 *
 * SVG e malha 3D não têm operação de "filete", então a conta é na mão: no
 * vértice B, entre A e C, anda uma distância t para cada lado e liga os dois
 * pontos por um arco tangente às duas retas. Sem isso, canto vivo em metal
 * polido fica com cara de plástico: o que o olho lê como joia é justamente a
 * risca de luz que nasce no arredondamento da borda.
 *
 * O raio pedido é reduzido quando não cabe no segmento, em vez de estourar o
 * contorno. Vértice sem `raio` passa direto, que é o caso dos pontos de arco.
 */
function arredondarCantos(pontos: PontoDoPerfil[], segmentos = 5): PontoDoPerfil[] {
  const n = pontos.length;
  const saida: PontoDoPerfil[] = [];

  for (let i = 0; i < n; i++) {
    const b = pontos[i];
    const raio = b.raio ?? 0;
    if (raio <= 0) {
      saida.push({ r: b.r, y: b.y });
      continue;
    }

    const a = pontos[(i - 1 + n) % n];
    const c = pontos[(i + 1) % n];

    const v1 = { r: a.r - b.r, y: a.y - b.y };
    const v2 = { r: c.r - b.r, y: c.y - b.y };
    const l1 = Math.hypot(v1.r, v1.y);
    const l2 = Math.hypot(v2.r, v2.y);
    if (l1 < 1e-6 || l2 < 1e-6) {
      saida.push({ r: b.r, y: b.y });
      continue;
    }

    const u1 = { r: v1.r / l1, y: v1.y / l1 };
    const u2 = { r: v2.r / l2, y: v2.y / l2 };
    const cos = Math.max(-1, Math.min(1, u1.r * u2.r + u1.y * u2.y));
    const angulo = Math.acos(cos);
    // Quase reto ou quase dobrado sobre si mesmo: não há canto para arredondar.
    if (angulo < 0.05 || angulo > Math.PI - 0.05) {
      saida.push({ r: b.r, y: b.y });
      continue;
    }

    const meia = angulo / 2;
    let t = raio / Math.tan(meia);
    t = Math.min(t, l1 * 0.48, l2 * 0.48);
    const raioReal = t * Math.tan(meia);

    const p1 = { r: b.r + u1.r * t, y: b.y + u1.y * t };
    const p2 = { r: b.r + u2.r * t, y: b.y + u2.y * t };

    const bis = { r: u1.r + u2.r, y: u1.y + u2.y };
    const lb = Math.hypot(bis.r, bis.y);
    if (lb < 1e-6) {
      saida.push({ r: b.r, y: b.y });
      continue;
    }
    const dist = raioReal / Math.sin(meia);
    const centro = { r: b.r + (bis.r / lb) * dist, y: b.y + (bis.y / lb) * dist };

    const a1 = Math.atan2(p1.y - centro.y, p1.r - centro.r);
    const a2 = Math.atan2(p2.y - centro.y, p2.r - centro.r);
    let delta = a2 - a1;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;

    for (let s = 0; s <= segmentos; s++) {
      const ang = a1 + (delta * s) / segmentos;
      saida.push({
        r: centro.r + Math.cos(ang) * raioReal,
        y: centro.y + Math.sin(ang) * raioReal,
      });
    }
  }

  return saida;
}

/**
 * Arco de face curva.
 *
 * Passa por `rNoCentro` no meio e se afasta `flecha` nas duas pontas. A conta é
 * a do raio de um arco pela flecha: R = (f² + (l/2)²) / 2f. `sentido` 1 põe a
 * barriga para fora, e -1 põe para dentro, que é o caso do lado do dedo.
 */
function arco(
  meiaLargura: number,
  flecha: number,
  rNoCentro: number,
  amostras: number,
  sentido: 1 | -1,
): PontoDoPerfil[] {
  const raio = (flecha * flecha + meiaLargura * meiaLargura) / (2 * flecha);
  const pontos: PontoDoPerfil[] = [];
  for (let i = 0; i <= amostras; i++) {
    const y = -meiaLargura + (2 * meiaLargura * i) / amostras;
    const altura = Math.sqrt(Math.max(0, raio * raio - y * y)) - (raio - flecha);
    pontos.push({ r: rNoCentro + sentido * (altura - flecha), y });
  }
  return pontos;
}

/** Quanto a face abaulada sobe no meio. */
function flechaDoAbaulamento(espessuraMm: number, larguraMm: number) {
  // Cresce com a parede, mas nunca vira meia-cana numa peça estreita: numa de
  // 2 mm, o teto é o que a própria largura comporta.
  return Math.min(0.45 * espessuraMm, 0.22 * larguraMm);
}

/** Quanto o lado de dentro se afasta do dedo nas bordas, na anatômica. */
function recuoDaAnatomica(espessuraMm: number, larguraMm: number) {
  return Math.min(0.32 * espessuraMm, 0.16 * larguraMm);
}

/** A face de fora, de y = -h até y = +h. */
function faceExterna(
  modelo: ModeloDeAlianca,
  h: number,
  ro: number,
  t: number,
  amostras: number,
): PontoDoPerfil[] {
  if (modelo === "abaulada") {
    const pontos = arco(h, flechaDoAbaulamento(t, h * 2), ro, amostras, 1);
    pontos[0] = { ...pontos[0], raio: 0.12 };
    pontos[pontos.length - 1] = { ...pontos[pontos.length - 1], raio: 0.12 };
    return pontos;
  }

  if (modelo === "chanfrada") {
    const chanfro = Math.min(0.26 * h * 2, 0.55 * t);
    return [
      { r: ro - chanfro, y: -h, raio: 0.1 },
      { r: ro, y: -h + chanfro, raio: 0.08 },
      { r: ro, y: h - chanfro, raio: 0.08 },
      { r: ro - chanfro, y: h, raio: 0.1 },
    ];
  }

  // Polida e fosca têm a MESMA face: plana. O que separa as duas é o
  // acabamento, que é luz e não geometria, e por isso mora no material.
  return [
    { r: ro, y: -h, raio: 0.16 },
    { r: ro, y: h, raio: 0.16 },
  ];
}

/** O lado de dentro, de y = +h de volta até y = -h. */
function faceInterna(
  formato: FormatoDeAlianca,
  h: number,
  ri: number,
  t: number,
  amostras: number,
): PontoDoPerfil[] {
  if (formato === "anatomica") {
    // `sentido -1` inverte a barriga: o meio fica em `ri`, que é o que toca o
    // dedo, e as bordas se afastam para `ri + recuo`.
    const pontos = arco(h, recuoDaAnatomica(t, h * 2), ri, amostras, -1).reverse();
    pontos[0] = { ...pontos[0], raio: 0.14 };
    pontos[pontos.length - 1] = { ...pontos[pontos.length - 1], raio: 0.14 };
    return pontos;
  }

  return [
    { r: ri, y: h, raio: 0.1 },
    { r: ri, y: -h, raio: 0.1 },
  ];
}

/**
 * O contorno fechado da peça, pronto para virar objeto 3D ou desenho de corte.
 *
 * Sai com os cantos já arredondados. O primeiro ponto não se repete no fim:
 * quem consome fecha o contorno (o `LatheGeometry` fecha sozinho quando os
 * pontos dão a volta).
 */
export function perfilDaAlianca(
  modelo: ModeloDeAlianca,
  formato: FormatoDeAlianca,
  { larguraMm, espessuraMm, aro }: MedidasDaAlianca,
): PontoDoPerfil[] {
  const h = larguraMm / 2;
  const ri = diametroDoAro(aro) / 2;
  const ro = ri + espessuraMm;

  // Poucas amostras deixam a curva facetada, e o facetado aparece justamente no
  // reflexo, que é o que se veio ver aqui.
  const amostras = 28;

  return arredondarCantos([
    ...faceExterna(modelo, h, ro, espessuraMm, amostras),
    ...faceInterna(formato, h, ri, espessuraMm, amostras),
  ]);
}

/** Espessura de parede que a tela deixa escolher, em milímetros. */
export const ESPESSURA_MINIMA = 1;
export const ESPESSURA_MAXIMA = 2.6;

/**
 * Quanto metal existe na peça, em milímetros cúbicos.
 *
 * É a pergunta por trás de "essa é mais grossa": aliança mais larga ou de
 * parede mais alta tem mais ouro dentro, e o preço acompanha isso. A conta é
 * exata, não é estimativa, porque a peça é um sólido de revolução e vale o
 * teorema de Pappus: o volume é a área do corte vezes o caminho que o centro
 * de massa dele percorre ao dar a volta.
 *
 * A área e o centro saem da fórmula do cadarço sobre o próprio contorno, o
 * mesmo que desenha a peça. Nada aqui é afirmação sobre produto: é geometria
 * da forma que está na tela.
 */
export function volumeDeMetal(pontos: PontoDoPerfil[]): number {
  let areaDobrada = 0;
  let momento = 0;
  for (let i = 0; i < pontos.length; i++) {
    const a = pontos[i];
    const b = pontos[(i + 1) % pontos.length];
    const cruzado = a.y * b.r - b.y * a.r;
    areaDobrada += cruzado;
    momento += (a.r + b.r) * cruzado;
  }
  const area = areaDobrada / 2;
  if (Math.abs(area) < 1e-9) return 0;
  const raioDoCentro = momento / (6 * area);
  return Math.abs(2 * Math.PI * raioDoCentro * area);
}

/** Raio máximo do contorno, para enquadrar câmera e desenho. */
export function raioExterno({ espessuraMm, aro }: MedidasDaAlianca): number {
  return diametroDoAro(aro) / 2 + espessuraMm;
}
