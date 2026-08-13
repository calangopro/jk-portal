import { z } from "zod";

/**
 * Layout de página em blocos.
 *
 * O layout é um ARRAY em JSON, e não uma tabela com uma linha por seção. Assim
 * o salvamento é atômico (nada de meia reordenação gravada), o histórico é uma
 * cópia do array, e exportar ou importar uma página é copiar um texto. Ordem é
 * a posição no array, o que elimina a classe inteira de bug de "position"
 * duplicada ou furada.
 */

export const TIPOS_DE_BLOCO = [
  "hero-busca",
  "ultimos-conteudos",
  "vitrine",
  "trilhas",
  "medidor",
  "lojas",
  "prova",
  "cta",
] as const;

export type TipoDeBloco = (typeof TIPOS_DE_BLOCO)[number];

export const esquemaDoBloco = z.object({
  /** Identidade estável, para o editor saber o que arrastou. */
  id: z.string().min(1),
  tipo: z.enum(TIPOS_DE_BLOCO),
  /** Ocultar sem apagar: o conteúdo continua lá para voltar depois. */
  visivel: z.boolean().default(true),
  /** Bloco travado só o admin remove. Protege a busca de sumir sem querer. */
  travado: z.boolean().default(false),
  props: z.record(z.string(), z.unknown()).default({}),
});

export const esquemaDoLayout = z.object({
  versao: z.number().int().positive().default(1),
  blocos: z.array(esquemaDoBloco).default([]),
});

export type Bloco = z.infer<typeof esquemaDoBloco>;
export type Layout = z.infer<typeof esquemaDoLayout>;

/**
 * Layout de fábrica da home.
 *
 * Vale quando o banco ainda não tem nada, e é a rede de segurança para o caso
 * de o JSON gravado não passar na validação. Home em branco por erro de
 * configuração seria pior que home sem personalização.
 */
export function layoutPadraoDaHome(): Layout {
  return {
    versao: 1,
    blocos: [
      {
        id: "hero",
        tipo: "hero-busca",
        visivel: true,
        travado: true,
        props: {
          eyebrow: "Guia JK Alianças",
          titulo: "Tudo sobre alianças, respondido direto",
          lede: "Pergunte com suas palavras. A busca entende a dúvida, não só a palavra exata.",
          placeholder: "O que você quer saber?",
          sugestoes: [
            "como medir meu aro",
            "prata 950 ou 925",
            "qual largura escolher",
            "loja perto de mim",
          ],
        },
      },
      {
        id: "ultimos",
        tipo: "ultimos-conteudos",
        visivel: true,
        travado: false,
        props: { titulo: "Publicados agora", quantidade: 5, verTodos: "Ver todos os guias" },
      },
      {
        id: "vitrine",
        tipo: "vitrine",
        visivel: true,
        travado: false,
        props: {
          titulo: "Da nossa fábrica",
          subtitulo: "Uma amostra do catálogo. A compra acontece na loja oficial da JK.",
          quantidade: 10,
          botao: "Ver produto",
        },
      },
      {
        id: "trilhas",
        tipo: "trilhas",
        visivel: true,
        travado: false,
        props: { titulo: "Por onde começar", subtitulo: "Escolha o momento e vá direto ao ponto." },
      },
      {
        id: "medidor",
        tipo: "medidor",
        visivel: true,
        travado: false,
        props: {
          titulo: "Descubra seu aro pela tela, em dois minutos",
          texto:
            "Calibre com uma moeda de R$ 1, apoie a aliança que já serve e arraste o anel até encaixar. A medida sai em milímetros de verdade.",
          botao: "Medir meu aro",
        },
      },
      {
        id: "lojas",
        tipo: "lojas",
        visivel: true,
        travado: false,
        props: { titulo: "Prove no dedo", subtitulo: "Atendimento presencial, aro de prova e ajuste na hora." },
      },
      {
        id: "prova",
        tipo: "prova",
        visivel: true,
        travado: false,
        props: { titulo: "Por que a JK" },
      },
      {
        id: "cta",
        tipo: "cta",
        visivel: true,
        travado: false,
        props: {
          eyebrow: "Onde comprar",
          titulo: "Prove no dedo, na loja mais perto de você",
          texto: "Atendimento presencial nas unidades JK Alianças, com fábrica própria e personalização.",
          botao: "Ver as lojas",
        },
      },
    ],
  };
}

/** Nunca lança: JSON inválido cai no layout de fábrica. */
export function normalizarLayout(bruto: unknown, padrao: Layout): Layout {
  const lido = esquemaDoLayout.safeParse(bruto);
  if (!lido.success || lido.data.blocos.length === 0) return padrao;
  return lido.data;
}

/** Lê uma prop com tipo, caindo no padrão quando o valor não serve. */
export function texto(props: Record<string, unknown>, chave: string, padrao: string): string {
  const v = props[chave];
  return typeof v === "string" && v.trim() ? v : padrao;
}

export function numero(props: Record<string, unknown>, chave: string, padrao: number): number {
  const v = props[chave];
  return typeof v === "number" && Number.isFinite(v) ? v : padrao;
}

export function listaDeTexto(props: Record<string, unknown>, chave: string, padrao: string[]): string[] {
  const v = props[chave];
  if (!Array.isArray(v)) return padrao;
  const limpa = v.filter((i): i is string => typeof i === "string" && i.trim().length > 0);
  return limpa.length ? limpa : padrao;
}
