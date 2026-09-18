/**
 * Os quatro metais que a JK vende, e como cada um reflete a luz.
 *
 * Moravam dentro do desenho de traço do dedo. Quando a ilustração foi
 * substituída pela foto, o arquivo inteiro (mais de 600 linhas de SVG) continuou
 * sendo importado só por causa destas duas exportações, e ia junto para o pacote
 * do navegador sem nunca renderizar nada.
 *
 * Cada material é uma SEQUÊNCIA de paradas de cor, e não uma cor só. É a
 * alternância dura entre borda escura, estouro de luz quase branco e meio-tom
 * que faz o olho ler metal polido; uma cor chapada lê como plástico. As mesmas
 * paradas servem o desenho da aliança, a bolinha do seletor e a barra da
 * comparação, então trocar o tom de um metal muda os três de uma vez.
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

export function gradienteDoMaterial(id: MaterialDaPeca) {
  const m = MATERIAIS.find((x) => x.id === id) ?? MATERIAIS[0];
  return `linear-gradient(90deg, ${m.paradas.map(([o, c]) => `${c} ${o}%`).join(", ")})`;
}
