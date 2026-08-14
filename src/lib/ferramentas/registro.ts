/**
 * Registro de ferramentas do portal.
 *
 * O melhor conteúdo que a JK tem hoje não é um texto, é uma ferramenta: a
 * página de medir o aro, com 1.159 cliques e 61.906 impressões, rende mais que
 * qualquer artigo do site. Ferramenta rankeia, é linkada de fora, é
 * compartilhada e segura a pessoa na tela. Texto sozinho não faz nada disso.
 *
 * Este arquivo existe para a segunda ferramenta custar uma fração da primeira.
 * Cada uma se declara aqui uma vez, e disso saem três coisas de graça:
 *
 *   1. a página `/ferramentas/[slug]`, indexável, com resposta primeiro,
 *      `HowTo` e `FAQPage`;
 *   2. o bloco do editor, para embutir a ferramenta dentro de qualquer guia;
 *   3. o rótulo dos eventos de uso, no mesmo canal de `data-evento`.
 *
 * É o mesmo espírito de `src/lib/blocos/tipos.ts`: declaração de dado em vez de
 * código espalhado. Sem componente aqui dentro de propósito, porque este
 * arquivo é lido pelo servidor e pelo cliente, e importar componente puxaria a
 * árvore inteira do React para dentro do sitemap.
 */

export const FERRAMENTAS_ATIVAS = [
  "conversor-de-aros",
  "largura-da-alianca",
  "materiais-de-alianca",
] as const;
export type SlugDeFerramenta = (typeof FERRAMENTAS_ATIVAS)[number];

export type Ferramenta = {
  slug: SlugDeFerramenta;
  /** Nome curto, para menu e para o bloco do editor. */
  nome: string;
  /** H1 da página. */
  titulo: string;
  /** Título da aba e da busca, até 60 caracteres. */
  metaTitle: string;
  metaDescription: string;
  /**
   * A resposta da dúvida principal, em 2 a 4 frases, autossuficiente.
   * É o primeiro texto da página e o trecho que a IA cita.
   */
  resposta: string;
  /** Uma linha para o card e para o bloco dentro do artigo. */
  chamada: string;
  /** Vira `HowTo` quando existe. */
  passos?: { nome: string; texto: string }[];
  faqs: { question: string; answer: string }[];
  /** Assunto ligado, para o bloco sugerir a ferramenta certa no artigo certo. */
  termos: string;
};

export const FERRAMENTAS: Ferramenta[] = [
  {
    slug: "conversor-de-aros",
    nome: "Conversor de tamanhos",
    titulo: "Conversor de tamanho de anel: aro brasileiro, americano e europeu",
    metaTitle: "Conversor de tamanho de anel e aliança",
    metaDescription:
      "Converta o tamanho do anel entre o aro brasileiro, o número americano, o padrão europeu, a circunferência e o diâmetro. Tabela completa do aro 7 ao 35.",
    resposta:
      "No Brasil, o número do aro é a circunferência interna do anel em milímetros menos 40, então o aro 18 tem 58 mm de circunferência e 18,46 mm de diâmetro. O padrão europeu ISO 8653 usa a própria circunferência como número, e a escala americana é diferente das duas: cada número vale 2,5535 mm, começando em 36,537 mm. O aro 18 brasileiro corresponde ao 8,5 americano e ao 58 europeu.",
    chamada: "Converta o tamanho entre o padrão brasileiro, o americano e o europeu.",
    passos: [
      {
        nome: "Escolha a medida que você já tem",
        texto:
          "Pode ser o aro brasileiro, o número americano, o europeu, a circunferência em milímetros ou o diâmetro do furo.",
      },
      {
        nome: "Digite o número",
        texto: "O conversor aceita medida com vírgula, como 18,46 mm de diâmetro.",
      },
      {
        nome: "Leia todas as equivalências de uma vez",
        texto:
          "A resposta mostra o mesmo tamanho em todas as escalas, e destaca a linha correspondente na tabela completa.",
      },
    ],
    faqs: [
      {
        question: "Como se calcula o aro brasileiro?",
        answer:
          "O aro é a circunferência interna do anel em milímetros menos 40. Um anel com 58 mm de circunferência por dentro é aro 18.",
      },
      {
        question: "O tamanho americano é o mesmo que o brasileiro?",
        answer:
          "Não. São escalas diferentes. O aro 18 brasileiro equivale ao tamanho 8,5 americano, e o aro 12 equivale ao tamanho 6. Como as duas escalas têm passos diferentes, a correspondência quase nunca cai num número redondo.",
      },
      {
        question: "O que é o padrão europeu ISO 8653?",
        answer:
          "É a norma em que o número do anel é a própria circunferência interna em milímetros. Um anel ISO 58 tem 58 mm de circunferência, o mesmo que o aro 18 no Brasil.",
      },
      {
        question: "Meu número ficou entre dois tamanhos, qual escolher?",
        answer:
          "Escolha o maior. A aliança precisa passar pela articulação do dedo, que é mais larga que a base, e um anel apertado demais não entra nem sai.",
      },
    ],
    termos: "tamanho aro numero medida americano europeu conversao converter",
  },
  {
    slug: "largura-da-alianca",
    nome: "Simulador de largura",
    titulo: "Simulador de largura de aliança: veja 2, 3, 4, 5, 6 e 8 mm no tamanho real",
    metaTitle: "Simulador de largura de aliança",
    metaDescription:
      "Veja a largura da aliança em tamanho real na sua tela, de 2 a 8 mm, sobre um dedo do tamanho do seu aro. Compare todas lado a lado antes de escolher.",
    resposta:
      "A largura da aliança é medida em milímetros, na face que encosta no dedo, e a JK Alianças fabrica de 1,5 mm a 10 mm. O que muda entre uma largura e outra é quanto do dedo a peça ocupa: num aro 16, a de 3 mm cobre cerca de 17% da largura visível do dedo, e a de 6 mm cobre o dobro disso. Ver em tamanho real resolve a escolha melhor que qualquer descrição, porque a diferença entre 3 mm e 4 mm é quase invisível no papel e evidente no dedo.",
    chamada: "Veja como cada largura fica no dedo, em tamanho real.",
    passos: [
      {
        nome: "Calibre a tela uma vez",
        texto:
          "Se você já usou o medidor de aliança, a calibração está salva e o desenho já sai em tamanho real. Se não, calibre no medidor com uma moeda de R$ 1.",
      },
      {
        nome: "Ajuste para o seu aro",
        texto:
          "O dedo desenhado acompanha o diâmetro do aro escolhido, então a comparação vale para a sua mão, e não para uma mão genérica.",
      },
      {
        nome: "Troque entre as larguras",
        texto:
          "Compare 2, 3, 4, 5, 6 e 8 mm no mesmo desenho, e veja todas lado a lado com a porcentagem que cada uma ocupa.",
      },
    ],
    faqs: [
      {
        question: "O que é a largura da aliança?",
        answer:
          "É a medida da peça no sentido do comprimento do dedo, em milímetros. Uma aliança de 4 mm ocupa 4 mm do dedo, do lado da mão para a ponta do dedo.",
      },
      {
        question: "Qual a diferença entre 3 mm e 4 mm?",
        answer:
          "Um milímetro, que parece pouco escrito e é bem visível no dedo. Num aro 16, a de 3 mm cobre cerca de 17% da largura visível do dedo e a de 4 mm cobre cerca de 22%.",
      },
      {
        question: "As duas alianças do casal precisam ter a mesma largura?",
        answer:
          "Não precisam. É comum o par ter larguras diferentes, mantendo o mesmo desenho e o mesmo acabamento.",
      },
      {
        question: "O desenho na tela está no tamanho certo?",
        answer:
          "Fica no tamanho real depois que você calibra a tela no medidor de aliança, usando uma moeda de R$ 1 ou um cartão. Sem calibrar, o desenho serve para comparar as larguras entre si, e a página avisa isso.",
      },
    ],
    termos: "largura milimetros mm fina larga grossa espessura tamanho",
  },
  {
    slug: "materiais-de-alianca",
    nome: "Comparador de materiais",
    titulo: "Materiais de aliança comparados: prata 925, prata 950, ouro 10k e ouro 18k",
    metaTitle: "Materiais de aliança: prata e ouro comparados",
    metaDescription:
      "Teor real e faixa de preço praticada em cada material de aliança da JK Alianças: prata 925, prata 950, prata banhada, prata com ouro, ouro 10k e ouro 18k.",
    resposta:
      "A escolha do material define teor, preço e manutenção da aliança. Prata 925 tem 92,5% de prata e prata 950 tem 95%; ouro 10k tem cerca de 41,7% de ouro e ouro 18k tem 75%. Na loja da JK Alianças, a mediana vai de cerca de R$ 450 na prata 950 a cerca de R$ 9.900 no ouro 18k, com prata banhada e ouro 10k entre as duas pontas.",
    chamada: "Prata e ouro comparados por teor e por preço.",
    faqs: [
      {
        question: "Qual a diferença entre prata 925 e prata 950?",
        answer:
          "O teor. A prata 925 tem 92,5% de prata pura e a prata 950 tem 95%. O restante são outros metais, que dão firmeza à peça.",
      },
      {
        question: "Ouro 10k ou ouro 18k, qual escolher?",
        answer:
          "O ouro 18k tem 75% de ouro puro e o 10k tem cerca de 41,7%. O 18k tem cor mais intensa e preço mais alto; o 10k tem mais liga e custa menos.",
      },
      {
        question: "Prata banhada a ouro é a mesma coisa que prata com ouro?",
        answer:
          "Não. Na banhada, a peça é de prata e recebe uma camada de ouro por cima. Na prata com ouro, as duas ligas fazem parte da estrutura da peça, cada uma em uma parte dela.",
      },
      {
        question: "Os preços desta página são atuais?",
        answer:
          "São lidos do catálogo da loja oficial da JK Alianças quando a página é gerada. O valor em destaque é a mediana de cada material, e a compra acontece sempre na loja.",
      },
    ],
    termos: "material prata ouro teor 925 950 18k 10k banhada comparar comparacao",
  },
];

/**
 * O medidor de aliança, que nasceu antes deste registro.
 *
 * Ele continua em `/medidor-de-aliancas`, endereço com histórico de busca, e
 * por isso não vira uma entrada de `FERRAMENTAS` (isso mudaria a URL). Mas para
 * o menu, o rodapé e a home das ferramentas ele é uma ferramenta como as
 * outras, e precisa aparecer no meio delas. Este objeto existe só para isso.
 */
export const MEDIDOR = {
  href: "/medidor-de-aliancas",
  nome: "Medidor de aliança",
  chamada: "Descubra seu aro pela tela, com uma moeda de R$ 1.",
} as const;

export type ItemDeFerramenta = {
  href: string;
  nome: string;
  chamada: string;
  /** Chave do desenho e do ícone. O medidor não tem slug de rota. */
  chave: string;
};

/**
 * Todas as ferramentas em uma lista só, medidor incluído.
 *
 * Menu, rodapé e a home de `/ferramentas` leem daqui. Ferramenta nova aparece
 * nos três lugares sem ninguém precisar lembrar de cada um.
 */
export function itensDeFerramenta(): ItemDeFerramenta[] {
  return [
    { href: MEDIDOR.href, nome: MEDIDOR.nome, chamada: MEDIDOR.chamada, chave: "medidor" },
    ...FERRAMENTAS.map((f) => ({
      href: `/ferramentas/${f.slug}`,
      nome: f.nome,
      chamada: f.chamada,
      chave: f.slug as string,
    })),
  ];
}

export function acharFerramenta(slug: string): Ferramenta | null {
  return FERRAMENTAS.find((f) => f.slug === slug) ?? null;
}

export function ehFerramenta(slug: string): slug is SlugDeFerramenta {
  return (FERRAMENTAS_ATIVAS as readonly string[]).includes(slug);
}
