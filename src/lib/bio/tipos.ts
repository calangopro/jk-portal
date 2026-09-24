import { z } from "zod";

/**
 * O link da bio, como dado.
 *
 * Segue o desenho do layout da home (`lib/blocos/tipos.ts`): a página é UM
 * objeto JSON, com os blocos num array cuja posição é a ordem. Salvar é
 * atômico, o histórico é uma cópia do objeto, e o painel só precisa editar este
 * formato. Nada de tabela com uma linha por link.
 *
 * Diferente da home, aqui quase tudo tem DATA. A bio é a porta do Instagram, e
 * o Instagram vive de campanha: o Esquenta entra em 01/10, a Black em 01/11, e o
 * congelamento de 20/11 proíbe mexer no ar durante a semana que mais vende. Por
 * isso cada bloco aceita início e fim, e o tema troca sozinho pela data. A
 * campanha inteira pode ser montada com semanas de antecedência e entra no ar
 * sem ninguém encostar em nada.
 */

/** Dia no formato AAAA-MM-DD, sempre no fuso de São Paulo. */
const dia = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable()
  .default(null);

export const TEMAS_DA_BIO = ["padrao", "esquenta", "black"] as const;
export type TemaDaBio = (typeof TEMAS_DA_BIO)[number];

/** Janela em que um tema de campanha vale, quando o tema está no automático. */
const esquemaCampanha = z.object({
  tema: z.enum(["esquenta", "black"]),
  inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const botao = z.object({ rotulo: z.string().min(1), href: z.string().min(1) });

/** O que todo bloco tem, além do conteúdo próprio. */
const base = {
  id: z.string().min(1),
  /** Ocultar sem apagar, para voltar depois com um clique. */
  visivel: z.boolean().default(true),
  /** Primeiro dia em que o bloco aparece. Nulo é "desde sempre". */
  inicio: dia,
  /** Último dia em que o bloco aparece, inteiro. Nulo é "sem fim". */
  fim: dia,
};

const blocoCampanha = z.object({
  ...base,
  tipo: z.literal("campanha"),
  eyebrow: z.string().default(""),
  titulo: z.string().min(1),
  texto: z.string().default(""),
  /** Dia em que o contador zera, contando até 23h59 de São Paulo. */
  contadorAte: dia,
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
const fonteDaVitrine = z.discriminatedUnion("tipo", [
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

export type FonteDaVitrine = z.infer<typeof fonteDaVitrine>;

const blocoVitrine = z.object({
  ...base,
  tipo: z.literal("vitrine"),
  titulo: z.string().min(1),
  fonte: fonteDaVitrine,
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
  inicio: dia,
  fim: dia,
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

export const esquemaDaBio = z.object({
  versao: z.literal(1).default(1),
  /** "automatico" segue `campanhas`; os outros fixam o tema. */
  tema: z.enum(["automatico", ...TEMAS_DA_BIO]).default("automatico"),
  campanhas: z.array(esquemaCampanha).default([]),
  cabecalho: z.object({
    nome: z.string().min(1),
    frase: z.string().default(""),
  }),
  blocos: z.array(esquemaDoBlocoDaBio).default([]),
});

export type Bio = z.infer<typeof esquemaDaBio>;

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
    versao: 1,
    tema: "automatico",
    campanhas: [
      { tema: "esquenta", inicio: "2026-10-01", fim: "2026-10-31" },
      { tema: "black", inicio: "2026-11-01", fim: "2026-11-30" },
    ],
    cabecalho: {
      nome: "JK Alianças",
      frase: "Alianças de fábrica própria e 10 lojas em São Paulo",
    },
    blocos: [
      {
        id: "campanha-esquenta",
        tipo: "campanha",
        visivel: true,
        inicio: "2026-10-01",
        fim: "2026-10-31",
        eyebrow: "Esquenta Black JK",
        titulo: "Até 20% OFF em peças selecionadas",
        texto: "Prata com 10%, ouro com 5% e semijoias com 20%. Os 5% do Pix somam.",
        contadorAte: "2026-10-31",
        rotuloContador: "O preço do Esquenta acaba em",
        botao: { rotulo: "Ver as peças do Esquenta", href: "https://www.jkaliancas.com.br/esquenta" },
      },
      {
        id: "campanha-black",
        tipo: "campanha",
        visivel: true,
        inicio: "2026-11-01",
        fim: "2026-11-30",
        eyebrow: "Black JK",
        titulo: "Até 30% OFF em peças selecionadas",
        texto:
          "Prata com 20%, ouro com 5% e semijoias com 30%. Brinco de semijoia de brinde em todo pedido com oferta.",
        contadorAte: "2026-11-30",
        rotuloContador: "A Black acaba em",
        botao: { rotulo: "Ver as peças da Black", href: "https://www.jkaliancas.com.br/black" },
      },
      {
        id: "captura",
        tipo: "captura",
        visivel: true,
        inicio: null,
        fim: null,
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
      },
      {
        id: "vitrine-esquenta",
        tipo: "vitrine",
        visivel: true,
        inicio: "2026-10-01",
        fim: "2026-10-31",
        titulo: "Peças do Esquenta",
        fonte: { tipo: "categoria", slug: "esquenta" },
        limite: 10,
        rotuloComprar: "Comprar",
        verTudo: { rotulo: "Ver todas", href: "https://www.jkaliancas.com.br/esquenta" },
      },
      {
        id: "vitrine-black",
        tipo: "vitrine",
        visivel: true,
        inicio: "2026-11-01",
        fim: "2026-11-30",
        titulo: "Peças da Black",
        fonte: { tipo: "categoria", slug: "black" },
        limite: 10,
        rotuloComprar: "Comprar",
        verTudo: { rotulo: "Ver todas", href: "https://www.jkaliancas.com.br/black" },
      },
      {
        id: "vitrine-mais-vendidas",
        tipo: "vitrine",
        visivel: true,
        inicio: null,
        fim: null,
        titulo: "As mais vendidas",
        fonte: { tipo: "mais-vendidos" },
        limite: 8,
        rotuloComprar: "Comprar",
        verTudo: { rotulo: "Ver todas", href: "https://www.jkaliancas.com.br/namoro-e-compromisso" },
      },
      {
        id: "links",
        tipo: "links",
        visivel: true,
        inicio: null,
        fim: null,
        titulo: "",
        itens: [
          {
            id: "medidor",
            rotulo: "Descubra o tamanho da sua aliança",
            detalhe: "Medidor grátis, direto no celular",
            href: "/medidor-de-aliancas",
            icone: "medidor",
            destaque: false,
            inicio: null,
            fim: null,
          },
          {
            id: "namoro",
            rotulo: "Alianças de namoro",
            detalhe: "",
            href: "https://www.jkaliancas.com.br/namoro-e-compromisso",
            icone: "alianca",
            destaque: false,
            inicio: null,
            fim: null,
          },
          {
            id: "casamento",
            rotulo: "Alianças de casamento",
            detalhe: "",
            href: "https://www.jkaliancas.com.br/noivado-e-casamento",
            icone: "alianca",
            destaque: false,
            inicio: null,
            fim: null,
          },
          {
            id: "dicas",
            rotulo: "Dicas sobre alianças",
            detalhe: "Largura, material e cuidado, explicado por quem fabrica",
            href: "/dicas",
            icone: "dicas",
            destaque: false,
            inicio: null,
            fim: null,
          },
        ],
      },
      {
        id: "lojas",
        tipo: "lojas",
        visivel: true,
        inicio: null,
        fim: null,
        titulo: "Fale com a loja mais perto",
        detalhe: "Escolha a unidade e chame no WhatsApp",
        mensagem: "Olá! Vim pelo Instagram e queria falar sobre alianças na loja {loja}.",
      },
    ],
  };
}

/**
 * Valor do banco para uma bio válida. Inválido ou vazio devolve a de fábrica,
 * e bloco inválido sozinho não derruba os outros.
 */
export function normalizarBio(valor: unknown): Bio {
  const inteira = esquemaDaBio.safeParse(valor);
  if (inteira.success) return inteira.data;

  const fabrica = bioDeFabrica();
  if (!valor || typeof valor !== "object") return fabrica;

  // Salva o que der: um bloco quebrado não pode levar a página inteira junto.
  const bruto = valor as Record<string, unknown>;
  const blocos = Array.isArray(bruto.blocos)
    ? bruto.blocos
        .map((b) => esquemaDoBlocoDaBio.safeParse(b))
        .filter((r) => r.success)
        .map((r) => r.data as BlocoDaBio)
    : fabrica.blocos;

  const resto = esquemaDaBio.omit({ blocos: true }).safeParse(bruto);
  return resto.success ? { ...resto.data, blocos } : { ...fabrica, blocos };
}
