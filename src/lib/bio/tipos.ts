import { z } from "zod";

/**
 * O link da bio, como dado.
 *
 * Segue o desenho do layout da home (`lib/blocos/tipos.ts`): a página é UM
 * objeto JSON, com os blocos num array cuja posição é a ordem. Salvar é
 * atômico, o histórico é uma cópia do objeto, e o painel só precisa editar este
 * formato. Nada de tabela com uma linha por link.
 *
 * A bio tem VERSÕES INTEIRAS, uma por campanha, e não blocos soltos com data.
 * A primeira versão desenhava cada bloco com início e fim numa lista só, e a
 * lista virou uma mistura de Esquenta, Black e dia a dia que ninguém conseguia
 * ler. Agora é como a pessoa pensa: a bio Normal, a bio do Esquenta, a bio da
 * Black, cada uma completa, com os próprios blocos e links, e a campanha entra e
 * sai do ar sozinha pela data. Campanha nova (aniversário, Natal, ano novo) é
 * uma versão a mais, sem código.
 *
 * A campanha pode ser montada com semanas de antecedência, o que importa porque
 * o congelamento de 20/11 proíbe mexer no ar durante a semana que mais vende.
 */

const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Paleta de cores. Mais de uma campanha pode usar a mesma. */
export const TEMAS_DA_BIO = ["padrao", "esquenta", "black", "aniversario", "natal", "anonovo"] as const;
export type TemaDaBio = (typeof TEMAS_DA_BIO)[number];

export const NOMES_DOS_TEMAS: Record<TemaDaBio, string> = {
  padrao: "Claro (off white)",
  esquenta: "Carvão e dourado",
  black: "Carvão e dourado forte",
  aniversario: "Aniversário (vinho, com confete)",
  natal: "Natal (areia, vinho e verde)",
  anonovo: "Ano novo (branco, areia e dourado)",
};

const botao = z.object({ rotulo: z.string().min(1), href: z.string().min(1) });

/** O que todo bloco tem, além do conteúdo próprio. */
const base = {
  id: z.string().min(1),
  /** Ocultar sem apagar, para voltar depois com um clique. */
  visivel: z.boolean().default(true),
};

const blocoCampanha = z.object({
  ...base,
  tipo: z.literal("campanha"),
  eyebrow: z.string().default(""),
  titulo: z.string().min(1),
  texto: z.string().default(""),
  contador: z.boolean().default(true),
  /**
   * Dia em que o contador zera, contando até 23h59 de São Paulo. Nulo é o fim
   * da campanha, que é o caso comum: mudar a data da campanha já muda o
   * contador junto.
   */
  contadorAte: dia.nullable().default(null),
  /** Frase que acompanha o contador, ex.: "O preço do Esquenta acaba em". */
  rotuloContador: z.string().default(""),
  botao: botao.nullable().default(null),
});

const blocoCaptura = z.object({
  ...base,
  tipo: z.literal("captura"),
  rotulo: z.string().min(1),
  detalhe: z.string().default(""),
  eyebrow: z.string().default(""),
  titulo: z.string().min(1),
  descricao: z.string().default(""),
  aceite: z.string().min(1),
  botaoEnviar: z.string().min(1),
  nota: z.string().default(""),
  sucessoTitulo: z.string().min(1),
  sucessoTexto: z.string().default(""),
  /** Convite do grupo no WhatsApp. Vazio, o sucesso não mostra botão. */
  grupoLink: z.string().default(""),
  grupoRotulo: z.string().default("Entrar no grupo do WhatsApp"),
  /** "nao" esconde, "opcional" pede sem obrigar, "obrigatorio" exige. */
  email: z.enum(["nao", "opcional", "obrigatorio"]).default("opcional"),
  /** Pergunta o momento do casal (namoro, noivado, casamento, presente). */
  momento: z.boolean().default(true),
});

/**
 * De onde a vitrine tira os produtos. Tudo vem da busca pública da loja, com
 * preço ao vivo, e nunca de preço digitado aqui.
 */
export const esquemaDaFonte = z.discriminatedUnion("tipo", [
  /** Uma categoria da loja, pelo slug da URL (ex.: `esquenta`, `black`). */
  z.object({ tipo: z.literal("categoria"), slug: z.string().min(1) }),
  /** Produtos escolhidos à mão, pelo id da Tray, na ordem da lista. */
  z.object({ tipo: z.literal("manual"), ids: z.array(z.string().min(1)).default([]) }),
  /** Os mais vendidos, pela contagem de vendas que a Tray informa. */
  z.object({ tipo: z.literal("mais-vendidos") }),
  /** Os marcados como destaque no painel da Tray. */
  z.object({ tipo: z.literal("destaques") }),
  /** Os lançamentos, pela data de lançamento na Tray. */
  z.object({ tipo: z.literal("lancamentos") }),
]);

export type FonteDaVitrine = z.infer<typeof esquemaDaFonte>;

/**
 * O produto como a vitrine da bio desenha. Mora aqui, e não em `produtos.ts`,
 * porque a prévia do painel desenha a bio no navegador, e `produtos.ts` é só
 * de servidor.
 */
export type ProdutoDaBio = {
  /** Id da Tray, o mesmo `item_id` que a loja manda ao GA4. */
  id: string;
  nome: string;
  imagem: string;
  href: string;
  categoria: string | null;
  atual: number;
  anterior: number | null;
  desconto: number | null;
};

const blocoVitrine = z.object({
  ...base,
  tipo: z.literal("vitrine"),
  titulo: z.string().min(1),
  fonte: esquemaDaFonte,
  limite: z.number().int().min(2).max(16).default(8),
  /** Rótulo do botão dentro do cartão. */
  rotuloComprar: z.string().default("Comprar"),
  verTudo: botao.nullable().default(null),
});

export const ICONES_DE_LINK = [
  "medidor",
  "alianca",
  "loja",
  "dicas",
  "presente",
  "whatsapp",
  "oferta",
  "link",
] as const;

const itemDeLink = z.object({
  id: z.string().min(1),
  rotulo: z.string().min(1),
  detalhe: z.string().default(""),
  href: z.string().min(1),
  icone: z.enum(ICONES_DE_LINK).default("link"),
  /** Destaque pinta o link com a cor de ação. Um por página, de preferência. */
  destaque: z.boolean().default(false),
});

export type ItemDeLink = z.infer<typeof itemDeLink>;

const blocoLinks = z.object({
  ...base,
  tipo: z.literal("links"),
  titulo: z.string().default(""),
  itens: z.array(itemDeLink).default([]),
});

const blocoLojas = z.object({
  ...base,
  tipo: z.literal("lojas"),
  titulo: z.string().min(1),
  detalhe: z.string().default(""),
  /**
   * Mensagem pronta do WhatsApp. `{loja}` vira o nome da unidade. Começa dizendo
   * de onde a pessoa veio para o atendimento poder marcar a conversa.
   */
  mensagem: z.string().default("Olá! Vim pelo Instagram e queria falar sobre alianças na loja {loja}."),
});

export const esquemaDoBlocoDaBio = z.discriminatedUnion("tipo", [
  blocoCampanha,
  blocoCaptura,
  blocoVitrine,
  blocoLinks,
  blocoLojas,
]);

export type BlocoDaBio = z.infer<typeof esquemaDoBlocoDaBio>;
export type BlocoDe<T extends BlocoDaBio["tipo"]> = Extract<BlocoDaBio, { tipo: T }>;

/**
 * Uma campanha: a bio inteira para um período.
 *
 * O `id` é o código que vai nos eventos de captura (`jk_campanha`), e por isso
 * o Esquenta é `esq` e a Black é `black`, os MESMOS códigos que o tema da loja
 * manda. Relatório que junta loja e bio precisa do mesmo valor dos dois lados.
 */
const esquemaDaCampanha = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,40}$/),
  nome: z.string().min(1).max(40),
  tema: z.enum(TEMAS_DA_BIO),
  inicio: dia,
  fim: dia,
  /** Desligada, a campanha não entra no ar nem na data. Rascunho de campanha. */
  ativa: z.boolean().default(true),
  blocos: z.array(esquemaDoBlocoDaBio).default([]),
});

export type CampanhaDaBio = z.infer<typeof esquemaDaCampanha>;

export const esquemaDaBio = z.object({
  versao: z.literal(2),
  cabecalho: z.object({
    nome: z.string().min(1),
    frase: z.string().default(""),
  }),
  /** A bio de todo dia, que vale quando nenhuma campanha está no ar. */
  normal: z.object({ blocos: z.array(esquemaDoBlocoDaBio).default([]) }),
  campanhas: z.array(esquemaDaCampanha).default([]),
});

export type Bio = z.infer<typeof esquemaDaBio>;

/** A versão que a página desenha: tema, blocos e o que o contador precisa. */
export type VersaoDaBio = {
  tema: TemaDaBio;
  blocos: BlocoDaBio[];
  /** Último dia da campanha, para o contador sem data própria. Nulo na Normal. */
  fim: string | null;
  /** Código da campanha nos eventos, vazio na Normal. */
  codigo: string;
};

// ---------------------------------------------------------------------------
// Conteúdo de fábrica
// ---------------------------------------------------------------------------

function captura(): BlocoDe<"captura"> {
  return {
    id: "captura",
    tipo: "captura",
    visivel: true,
    rotulo: "Receber as ofertas no WhatsApp",
    detalhe: "Preço exclusivo e cupom com prazo, no grupo da JK",
    eyebrow: "Grupo de ofertas JK",
    titulo: "A oferta do dia chega primeiro no seu WhatsApp",
    descricao: "No grupo, cada oferta vem com preço exclusivo e cupom com prazo para usar.",
    aceite: "Aceito receber ofertas e novidades da JK Alianças pelo WhatsApp.",
    botaoEnviar: "Quero receber as ofertas",
    nota: "Para sair, é só responder SAIR. Seu contato fica só com a JK Alianças.",
    sucessoTitulo: "Pronto! Falta um toque.",
    sucessoTexto: "Entre no grupo para receber a primeira oferta.",
    grupoLink: "",
    grupoRotulo: "Entrar no grupo do WhatsApp",
    email: "opcional",
    momento: true,
  };
}

function maisVendidas(): BlocoDe<"vitrine"> {
  return {
    id: "vitrine-mais-vendidas",
    tipo: "vitrine",
    visivel: true,
    titulo: "As mais vendidas",
    fonte: { tipo: "mais-vendidos" },
    limite: 8,
    rotuloComprar: "Comprar",
    verTudo: { rotulo: "Ver todas", href: "https://www.jkaliancas.com.br/namoro-e-compromisso" },
  };
}

function links(): BlocoDe<"links"> {
  return {
    id: "links",
    tipo: "links",
    visivel: true,
    titulo: "",
    itens: [
      {
        id: "medidor",
        rotulo: "Descubra o tamanho da sua aliança",
        detalhe: "Medidor grátis, direto no celular",
        href: "/medidor-de-aliancas",
        icone: "medidor",
        destaque: false,
      },
      {
        id: "namoro",
        rotulo: "Alianças de namoro",
        detalhe: "",
        href: "https://www.jkaliancas.com.br/namoro-e-compromisso",
        icone: "alianca",
        destaque: false,
      },
      {
        id: "casamento",
        rotulo: "Alianças de casamento",
        detalhe: "",
        href: "https://www.jkaliancas.com.br/noivado-e-casamento",
        icone: "alianca",
        destaque: false,
      },
      {
        id: "dicas",
        rotulo: "Dicas sobre alianças",
        detalhe: "Largura, material e cuidado, explicado por quem fabrica",
        href: "/dicas",
        icone: "dicas",
        destaque: false,
      },
    ],
  };
}

function lojas(): BlocoDe<"lojas"> {
  return {
    id: "lojas",
    tipo: "lojas",
    visivel: true,
    titulo: "Fale com a loja mais perto",
    detalhe: "Escolha a unidade e chame no WhatsApp",
    mensagem: "Olá! Vim pelo Instagram e queria falar sobre alianças na loja {loja}.",
  };
}

/**
 * A bio de fábrica.
 *
 * Vale enquanto o banco não tiver nada gravado, e é a rede de segurança se o
 * JSON gravado não passar na validação: bio em branco na porta do Instagram
 * seria pior que bio sem personalização.
 *
 * As ofertas são as fechadas em 23/09 (Trello, card "Ofertas fechadas em
 * 23/09", e `PLANO-ESQUENTA-BLACK.md` do tema da loja). O Esquenta NÃO fala da
 * Black: é regra da campanha não ensinar ninguém a esperar novembro.
 */
export function bioDeFabrica(): Bio {
  return {
    versao: 2,
    cabecalho: {
      nome: "JK Alianças",
      frase: "Alianças de fábrica própria e 10 lojas em São Paulo",
    },
    normal: { blocos: [captura(), maisVendidas(), links(), lojas()] },
    campanhas: [
      {
        id: "esq",
        nome: "Esquenta",
        tema: "esquenta",
        inicio: "2026-10-01",
        fim: "2026-10-31",
        ativa: true,
        blocos: [
          {
            id: "oferta",
            tipo: "campanha",
            visivel: true,
            eyebrow: "Esquenta Black JK",
            titulo: "Até 20% OFF em peças selecionadas",
            texto: "Prata com 10%, ouro com 5% e semijoias com 20%. Os 5% do Pix somam.",
            contador: true,
            contadorAte: null,
            rotuloContador: "O preço do Esquenta acaba em",
            botao: { rotulo: "Ver as peças do Esquenta", href: "https://www.jkaliancas.com.br/esquenta" },
          },
          captura(),
          {
            id: "vitrine-campanha",
            tipo: "vitrine",
            visivel: true,
            titulo: "Peças do Esquenta",
            fonte: { tipo: "categoria", slug: "esquenta" },
            limite: 10,
            rotuloComprar: "Comprar",
            verTudo: { rotulo: "Ver todas", href: "https://www.jkaliancas.com.br/esquenta" },
          },
          maisVendidas(),
          links(),
          lojas(),
        ],
      },
      {
        id: "black",
        nome: "Black",
        tema: "black",
        inicio: "2026-11-01",
        fim: "2026-11-30",
        ativa: true,
        blocos: [
          {
            id: "oferta",
            tipo: "campanha",
            visivel: true,
            eyebrow: "Black JK",
            titulo: "Até 30% OFF em peças selecionadas",
            texto:
              "Prata com 20%, ouro com 5% e semijoias com 30%. Brinco de semijoia de brinde em todo pedido com oferta.",
            contador: true,
            contadorAte: null,
            rotuloContador: "A Black acaba em",
            botao: { rotulo: "Ver as peças da Black", href: "https://www.jkaliancas.com.br/black" },
          },
          captura(),
          {
            id: "vitrine-campanha",
            tipo: "vitrine",
            visivel: true,
            titulo: "Peças da Black",
            fonte: { tipo: "categoria", slug: "black" },
            limite: 10,
            rotuloComprar: "Comprar",
            verTudo: { rotulo: "Ver todas", href: "https://www.jkaliancas.com.br/black" },
          },
          maisVendidas(),
          links(),
          lojas(),
        ],
      },
      ...campanhasDeData(),
    ],
  };
}

/**
 * As campanhas de data do fim do ano, prontas: aniversário, Natal e ano novo.
 *
 * O grupo de ofertas nasce OCULTO nas três, porque o envio do formulário ainda
 * não existe (é a próxima etapa). Quando existir, basta mostrar o bloco.
 *
 * - Aniversário, 01 a 08/11: os 23 anos da JK em 08/11 (`PLANO-BLACK.md` do
 *   tema da loja). A semana cai DENTRO da Black, e a campanha mais curta vence,
 *   então a bio do aniversário carrega as peças da Black junto: sem isso, a
 *   oferta sumiria da bio na primeira semana de novembro.
 * - Natal, 01 a 25/12: dezembro é mês de pedido de casamento (mesmo plano,
 *   seção 12), então a porta é o anel de noivado, com o aviso de prazo de
 *   entrega e a retirada na loja para quem compra em cima da hora.
 * - Ano novo, 26/12 a 06/01: quem noivou na virada compra aliança de casamento
 *   em janeiro (idem), e o contador conta até a meia-noite do dia 31.
 *
 * As categorias de campanha que ainda não existem na loja (`aniversario`)
 * deixam a vitrine escondida até serem criadas.
 */
export function campanhasDeData(): CampanhaDaBio[] {
  const capturaOculta = { ...captura(), visivel: false };
  const vitrine = (
    id: string,
    titulo: string,
    slug: string,
    limite = 8,
  ): BlocoDe<"vitrine"> => ({
    id,
    tipo: "vitrine",
    visivel: true,
    titulo,
    fonte: { tipo: "categoria", slug },
    limite,
    rotuloComprar: "Comprar",
    verTudo: { rotulo: "Ver todas", href: `https://www.jkaliancas.com.br/${slug}` },
  });

  return [
    {
      id: "aniversario",
      nome: "Aniversário JK",
      tema: "aniversario",
      inicio: "2026-11-01",
      fim: "2026-11-08",
      ativa: true,
      blocos: [
        {
          id: "oferta",
          tipo: "campanha",
          visivel: true,
          eyebrow: "Aniversário JK",
          titulo: "23 anos de JK Alianças",
          texto:
            "Para comemorar, a Black já está no ar: até 30% OFF em peças selecionadas e brinco de semijoia de brinde em todo pedido com oferta.",
          contador: true,
          contadorAte: null,
          rotuloContador: "A semana do aniversário acaba em",
          botao: { rotulo: "Ver as peças da Black", href: "https://www.jkaliancas.com.br/black" },
        },
        capturaOculta,
        vitrine("vitrine-aniversario", "Modelos do aniversário", "aniversario", 6),
        vitrine("vitrine-black", "Peças da Black", "black", 10),
        maisVendidas(),
        links(),
        lojas(),
      ],
    },
    {
      id: "natal",
      nome: "Natal",
      tema: "natal",
      inicio: "2026-12-01",
      fim: "2026-12-25",
      ativa: true,
      blocos: [
        {
          id: "oferta",
          tipo: "campanha",
          visivel: true,
          eyebrow: "Natal JK",
          titulo: "Anel de noivado para o pedido de Natal",
          texto: "Confira o prazo de entrega de cada peça. Se não der tempo de chegar, retire na loja mais perto.",
          contador: true,
          contadorAte: "2026-12-24",
          rotuloContador: "Faltam para o Natal",
          botao: { rotulo: "Ver anéis de noivado", href: "https://www.jkaliancas.com.br/aneis-de-noivado" },
        },
        capturaOculta,
        vitrine("vitrine-noivado", "Anéis de noivado", "aneis-de-noivado"),
        vitrine("vitrine-joias", "Joias para presentear", "joias"),
        links(),
        lojas(),
      ],
    },
    {
      id: "ano-novo",
      nome: "Ano novo",
      tema: "anonovo",
      inicio: "2026-12-26",
      fim: "2027-01-06",
      ativa: true,
      blocos: [
        {
          id: "oferta",
          tipo: "campanha",
          visivel: true,
          eyebrow: "Ano novo JK",
          titulo: "Noivou na virada do ano?",
          texto:
            "Escolha a aliança de casamento com calma: descubra o tamanho no medidor e compare modelo, largura e material.",
          contador: true,
          contadorAte: "2026-12-31",
          rotuloContador: "2027 chega em",
          botao: { rotulo: "Ver alianças de casamento", href: "https://www.jkaliancas.com.br/noivado-e-casamento" },
        },
        capturaOculta,
        vitrine("vitrine-casamento", "Alianças de casamento", "noivado-e-casamento"),
        vitrine("vitrine-noivado", "Anéis de noivado", "aneis-de-noivado"),
        links(),
        lojas(),
      ],
    },
  ];
}

/**
 * Valor do banco para uma bio válida. Inválido ou vazio devolve a de fábrica.
 * Bloco inválido sozinho não derruba os outros da mesma versão.
 */
export function normalizarBio(valor: unknown): Bio {
  const inteira = esquemaDaBio.safeParse(valor);
  if (inteira.success) return inteira.data;

  const fabrica = bioDeFabrica();
  if (!valor || typeof valor !== "object" || (valor as { versao?: unknown }).versao !== 2) return fabrica;

  const bruto = valor as Record<string, unknown>;
  const salvarBlocos = (lista: unknown): BlocoDaBio[] =>
    Array.isArray(lista)
      ? lista
          .map((b) => esquemaDoBlocoDaBio.safeParse(b))
          .filter((r) => r.success)
          .map((r) => r.data as BlocoDaBio)
      : [];

  const cabecalho = esquemaDaBio.shape.cabecalho.safeParse(bruto.cabecalho);
  const normal = bruto.normal as { blocos?: unknown } | undefined;
  const campanhas = Array.isArray(bruto.campanhas)
    ? bruto.campanhas
        .map((c) => {
          const semBlocos = esquemaDaCampanha.omit({ blocos: true }).safeParse(c);
          if (!semBlocos.success) return null;
          return { ...semBlocos.data, blocos: salvarBlocos((c as { blocos?: unknown }).blocos) };
        })
        .filter((c): c is CampanhaDaBio => c !== null)
    : fabrica.campanhas;

  return {
    versao: 2,
    cabecalho: cabecalho.success ? cabecalho.data : fabrica.cabecalho,
    normal: { blocos: normal ? salvarBlocos(normal.blocos) : fabrica.normal.blocos },
    campanhas,
  };
}

// ---------------------------------------------------------------------------
// Painel
// ---------------------------------------------------------------------------

/** Nome de cada tipo de bloco, como o painel mostra. */
export const NOMES_DOS_BLOCOS: Record<BlocoDaBio["tipo"], string> = {
  campanha: "Oferta com contador",
  captura: "Grupo de ofertas no WhatsApp",
  vitrine: "Vitrine de produtos",
  links: "Links",
  lojas: "WhatsApp das lojas",
};

/**
 * Bloco recém-criado no painel, já preenchido com texto que funciona.
 *
 * Bloco vazio aparece na prévia como um buraco, e a pessoa não entende o que
 * acabou de adicionar. Com um conteúdo de partida, ela vê o bloco no lugar e só
 * troca o texto.
 */
export function blocoNovo(tipo: BlocoDaBio["tipo"], id: string): BlocoDaBio {
  switch (tipo) {
    case "campanha":
      return {
        id,
        tipo,
        visivel: true,
        eyebrow: "Oferta JK",
        titulo: "Escreva a oferta aqui",
        texto: "",
        contador: true,
        contadorAte: null,
        rotuloContador: "A oferta acaba em",
        botao: { rotulo: "Ver as peças", href: "https://www.jkaliancas.com.br/" },
      };
    case "captura":
      return { ...captura(), id };
    case "vitrine":
      return { ...maisVendidas(), id, titulo: "Vitrine", verTudo: null };
    case "links":
      return { id, tipo, visivel: true, titulo: "", itens: [] };
    case "lojas":
      return { ...lojas(), id };
  }
}

/** Link novo dentro de um bloco de links. */
export function linkNovo(id: string): ItemDeLink {
  return {
    id,
    rotulo: "Novo link",
    detalhe: "",
    href: "https://www.jkaliancas.com.br/",
    icone: "link",
    destaque: false,
  };
}
