/**
 * Como cada material do catálogo aparece no objeto 3D.
 *
 * A LISTA de materiais vem do banco, da mesma view que alimenta a tabela do
 * comparador. Aqui mora só a APARÊNCIA, que é código: cor de base, quanto o
 * polimento espalha a luz e, quando a peça é de dois tons, qual é o segundo
 * metal. Material que entrar no catálogo amanhã aparece na tabela sozinho, e
 * cai no visual padrão até alguém descrever ele aqui.
 *
 * A cor de base de um metal não é a cor que a pessoa vê: metal reflete quase
 * tudo o que chega, e o que o olho lê como ouro é a cor da luz refletida. Por
 * isso os valores abaixo são os de reflexão do metal, mais claros e mais
 * lavados do que um amarelo de tinta. Quem escurece é a cena, não a cor.
 *
 * `aspereza` é o quanto o reflexo borra. Joia polida fica entre 0,08 e 0,16.
 * Acima disso vira metal escovado, que não é o que a JK vende.
 */

export type Aparencia = {
  /** Cor de reflexão do metal, em sRGB. */
  cor: string;
  aspereza: number;
  /**
   * Segundo metal, para peça de dois tons. Vira um filete no meio da face de
   * fora, que é como a prata com ouro é montada.
   */
  filete?: { cor: string; aspereza: number; fatiaDaLargura: number };
  /** Aviso curto quando a tela mostra uma representação, e não a peça. */
  nota?: string;
};

const OURO_18K = "#e7c063";
const OURO_10K = "#dfcb96";
const PRATA = "#f0eeea";

export const APARENCIA_PADRAO: Aparencia = { cor: PRATA, aspereza: 0.12 };

export const APARENCIA: Record<string, Aparencia> = {
  "prata-925": { cor: PRATA, aspereza: 0.1 },
  "prata-950": { cor: PRATA, aspereza: 0.1 },
  // Banho de ouro 18k sobre prata: a cor que se vê é a do ouro, porque o banho
  // cobre a peça inteira. O que muda é a espessura da camada, e isso não é
  // coisa que apareça na tela.
  "prata-banhada": { cor: OURO_18K, aspereza: 0.13 },
  "ouro-10k": { cor: OURO_10K, aspereza: 0.12 },
  "ouro-18k": { cor: OURO_18K, aspereza: 0.1 },
  "prata-com-ouro": {
    cor: PRATA,
    aspereza: 0.1,
    filete: { cor: OURO_18K, aspereza: 0.1, fatiaDaLargura: 0.34 },
    nota: "O desenho mostra a prata com um filete de ouro no meio. Cada modelo distribui o ouro de um jeito, então confira a foto do produto.",
  },
};

export function aparenciaDoMaterial(slug: string): Aparencia {
  return APARENCIA[slug] ?? APARENCIA_PADRAO;
}

/**
 * O mesmo metal em CSS, para a bolinha do seletor.
 *
 * Não é a cor chapada de cima: bolinha de cor chapada promete um dourado e o 3D
 * entrega outro. O que faz o olho ler metal é a alternância entre borda escura,
 * estouro de luz e meio-tom, a mesma lição que o simulador de largura já tinha
 * aprendido em `Dedo.tsx`.
 */
export function amostraDoMaterial(slug: string): string {
  const a = aparenciaDoMaterial(slug);
  const paradas = (cor: string) =>
    `${escurecer(cor, 0.45)} 0%, ${escurecer(cor, 0.8)} 18%, ${clarear(cor, 0.75)} 34%, ${cor} 52%, ${escurecer(cor, 0.62)} 74%, ${escurecer(cor, 0.4)} 100%`;

  if (!a.filete) return `linear-gradient(135deg, ${paradas(a.cor)})`;

  // Dois tons: metade e metade, para o seletor dizer na hora que a peça mistura
  // os dois metais.
  return `linear-gradient(135deg, ${escurecer(a.cor, 0.45)} 0%, ${clarear(a.cor, 0.7)} 30%, ${a.cor} 48%, ${a.filete.cor} 52%, ${clarear(a.filete.cor, 0.6)} 70%, ${escurecer(a.filete.cor, 0.45)} 100%)`;
}

function componentes(hex: string): [number, number, number] {
  const n = hex.replace("#", "");
  return [
    parseInt(n.slice(0, 2), 16),
    parseInt(n.slice(2, 4), 16),
    parseInt(n.slice(4, 6), 16),
  ];
}

function escurecer(hex: string, fator: number): string {
  const [r, g, b] = componentes(hex);
  return `rgb(${Math.round(r * fator)} ${Math.round(g * fator)} ${Math.round(b * fator)})`;
}

function clarear(hex: string, forca: number): string {
  const [r, g, b] = componentes(hex);
  const mistura = (c: number) => Math.round(c + (255 - c) * forca);
  return `rgb(${mistura(r)} ${mistura(g)} ${mistura(b)})`;
}
