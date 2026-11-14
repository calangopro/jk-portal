import type { Tom } from "@/lib/painel/tons";

/**
 * A Biblioteca JK: as respostas da casa para quem atende cliente.
 *
 * Arquivo PURO (sem banco, sem `server-only`): serve à tela, ao servidor e ao
 * teste (`npm run verificar:biblioteca`). A leitura e a escrita ficam em
 * `dados.ts`.
 *
 * DUAS BUSCAS DIFERENTES, DE PROPÓSITO:
 *
 * 1. `filtrarRespostas` é a busca da tela. Roda a cada letra, e por isso é
 *    literal: toda palavra digitada precisa aparecer na resposta, sem acento.
 *    Quem digita "polim" quer ver a lista afunilar, não um palpite.
 *
 * 2. `respostasProximas` é a busca do tutor. Recebe uma frase inteira ("o
 *    cliente quer saber se o polimento custa alguma coisa") e devolve as
 *    respostas mais parecidas, com pontos. Aqui palavra parecida vale
 *    ("polir" acha "polimento") e palavra rara pesa mais que palavra comum.
 */

export type Tema =
  | "estoque_prazo"
  | "preco_personalizado"
  | "troca"
  | "pos_venda"
  | "gravacao_produto"
  | "pagamento_pedido"
  | "processo";

/** Na ordem em que aparecem na tela. É a mesma lista da trava do banco (0071). */
export const TEMAS: { chave: Tema; nome: string }[] = [
  { chave: "estoque_prazo", nome: "Estoque e prazo" },
  { chave: "preco_personalizado", nome: "Preço e personalizado" },
  { chave: "troca", nome: "Troca" },
  { chave: "pos_venda", nome: "Pós-venda" },
  { chave: "gravacao_produto", nome: "Gravação e produto" },
  { chave: "pagamento_pedido", nome: "Pagamento e pedido" },
  { chave: "processo", nome: "Processo" },
];

export const NOME_DO_TEMA = Object.fromEntries(TEMAS.map((t) => [t.chave, t.nome])) as Record<Tema, string>;

export function lerTema(v: unknown): Tema | null {
  return TEMAS.some((t) => t.chave === v) ? (v as Tema) : null;
}

export type Estado = "a_confirmar" | "confirmada" | "arquivada";

export function lerEstado(v: unknown): Estado | null {
  return v === "a_confirmar" || v === "confirmada" || v === "arquivada" ? v : null;
}

export type Resposta = {
  id: string;
  tema: Tema;
  /** A pergunta do jeito que o vendedor faz. */
  pergunta: string;
  /** Para quem atende: o que vale e o que conferir antes de responder. */
  explicacao: string;
  /** O texto pronto para mandar ao cliente. Nem toda resposta tem. */
  frase: string | null;
  estado: Estado;
  origem: string | null;
  criadoPor: string | null;
  criadoPorNome: string | null;
  criadoEm: string;
  confirmadoPorNome: string | null;
  confirmadoEm: string | null;
  atualizadoEm: string;
  /** O número do chamado de que a resposta nasceu, quando nasceu de um. */
  chamado: number | null;
};

/** Minúsculas e sem acento: "Polimento é grátis" e "polimento e gratis" são a mesma busca. */
export function semAcento(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * O estado em cor, palavra e aviso. "A confirmar" é âmbar e sempre vem com o
 * aviso por extenso: é o que impede o vendedor de prometer regra que a JK
 * ainda não assinou.
 */
export function estadoEmPalavra(estado: Estado): { tom: Tom; palavra: string; aviso: string | null } {
  if (estado === "confirmada") return { tom: "bom", palavra: "Confirmada", aviso: null };
  if (estado === "arquivada") return { tom: "neutro", palavra: "Arquivada", aviso: "Esta resposta saiu de uso. Não vale mais." };
  return {
    tom: "atencao",
    palavra: "A confirmar",
    aviso: "A JK ainda não confirmou esta resposta. Antes de prometer ao cliente, confira com a diretoria.",
  };
}

/**
 * O que a pessoa pode fazer com uma resposta. É a mesma regra das funções do
 * banco (0071), repetida aqui só para a tela não oferecer botão que vai ser
 * recusado.
 */
export function oQuePode(a: { admin: boolean; souAutor: boolean; estado: Estado }): {
  editar: boolean;
  confirmar: boolean;
  arquivar: boolean;
  reabrir: boolean;
} {
  return {
    editar: a.admin || (a.souAutor && a.estado === "a_confirmar"),
    confirmar: a.admin && a.estado !== "confirmada",
    arquivar: a.admin && a.estado !== "arquivada",
    reabrir: a.admin && a.estado !== "a_confirmar",
  };
}

export type RascunhoDeResposta = { tema: string; pergunta: string; explicacao: string; frase: string; origem: string };

/** As mesmas conferências do banco, para a pessoa saber o que falta antes de enviar. */
export function conferirResposta(r: RascunhoDeResposta): string | null {
  if (!lerTema(r.tema)) return "Escolha o tema da resposta.";
  const pergunta = r.pergunta.trim();
  const explicacao = r.explicacao.trim();
  if (pergunta.length < 5) return "Escreva a pergunta, do jeito que ela chega.";
  if (pergunta.length > 300) return "A pergunta passou de 300 letras.";
  if (explicacao.length < 5) return "Escreva a explicação para quem atende.";
  if (explicacao.length > 4000) return "A explicação passou de 4.000 letras.";
  if (r.frase.trim().length > 2000) return "A frase pronta passou de 2.000 letras.";
  if (r.origem.trim().length > 300) return "O campo de onde veio passou de 300 letras.";
  if (/[—–]/.test(`${pergunta}${explicacao}${r.frase}`)) return "Tire o travessão: use vírgula, dois pontos ou ponto.";
  return null;
}

// ------------------------------------------------------------ a busca da tela

export type FiltroDaBiblioteca = {
  busca: string;
  tema: Tema | "todos";
  estado: Estado | "todos";
};

const ORDEM_DO_ESTADO: Record<Estado, number> = { confirmada: 0, a_confirmar: 1, arquivada: 2 };
const ORDEM_DO_TEMA = Object.fromEntries(TEMAS.map((t, i) => [t.chave, i])) as Record<Tema, number>;

/**
 * A lista da tela. Sem busca, vem por tema, com as confirmadas na frente. Com
 * busca, toda palavra digitada precisa aparecer (na pergunta, na explicação ou
 * na frase), e sobe primeiro quem tem a palavra na PERGUNTA.
 *
 * Resposta arquivada só entra quando o filtro de estado pede por ela.
 */
export function filtrarRespostas(respostas: readonly Resposta[], filtro: FiltroDaBiblioteca): Resposta[] {
  const termos = semAcento(filtro.busca).split(/\s+/).filter(Boolean);
  const achados: { r: Resposta; naPergunta: number }[] = [];
  for (const r of respostas) {
    if (filtro.tema !== "todos" && r.tema !== filtro.tema) continue;
    if (filtro.estado === "todos" ? r.estado === "arquivada" : r.estado !== filtro.estado) continue;
    const pergunta = semAcento(r.pergunta);
    const resto = semAcento(`${r.explicacao} ${r.frase ?? ""}`);
    if (!termos.every((t) => pergunta.includes(t) || resto.includes(t))) continue;
    achados.push({ r, naPergunta: termos.filter((t) => pergunta.includes(t)).length });
  }
  return achados
    .sort(
      (a, b) =>
        b.naPergunta - a.naPergunta ||
        ORDEM_DO_TEMA[a.r.tema] - ORDEM_DO_TEMA[b.r.tema] ||
        ORDEM_DO_ESTADO[a.r.estado] - ORDEM_DO_ESTADO[b.r.estado] ||
        a.r.pergunta.localeCompare(b.r.pergunta, "pt-BR"),
    )
    .map((x) => x.r);
}

/** Quantas respostas (fora as arquivadas) cada tema tem, para os botões de filtro. */
export function contarPorTema(respostas: readonly Resposta[]): Record<Tema | "todos", number> {
  const n = { todos: 0 } as Record<Tema | "todos", number>;
  for (const t of TEMAS) n[t.chave] = 0;
  for (const r of respostas) {
    if (r.estado === "arquivada") continue;
    n.todos++;
    n[r.tema]++;
  }
  return n;
}

// ----------------------------------------------------------- a busca do tutor

/** Palavras que aparecem em quase toda pergunta e não ajudam a separar uma resposta da outra. */
const VAZIAS = new Set(
  (
    "a o as os um uma uns umas de da do das dos e em no na nos nas ao aos para pra por com sem que se ou mas " +
    "eu ele ela eles elas voce voces meu minha seu sua isso isto esse essa este esta aquele aquela " +
    "ser e foi era sao esta estao tem ter tinha vai vou pode posso podem quer quero queria " +
    "como qual quais quando quanto quanta onde quem porque ja nao sim so mais muito tambem " +
    "cliente clientes ai la aqui me te lhe nesse nessa neste nesta dele dela"
  ).split(" "),
);

/** As palavras que contam de um texto: sem acento, sem pontuação e sem as vazias. */
export function palavrasDoTexto(s: string): string[] {
  return semAcento(s)
    .split(/[^a-z0-9]+/)
    .filter((p) => p.length >= 2 && !VAZIAS.has(p));
}

/**
 * Duas palavras da mesma família: "polir" e "polimento", "custa" e "custo",
 * "trocar" e "troca". Vale quando o começo igual tem pelo menos 4 letras e
 * cobre a menor palavra inteira, ou quase (sobra uma letra). Palavra curta
 * ("pix", "950", "mm") só casa se for idêntica: senão "prata" acharia "prazo".
 */
export function mesmaFamilia(a: string, b: string): boolean {
  if (a === b) return true;
  const menor = Math.min(a.length, b.length);
  if (menor < 4) return false;
  let igual = 0;
  while (igual < menor && a[igual] === b[igual]) igual++;
  return igual >= Math.max(4, menor - 1);
}

export type RespostaProxima = { resposta: Resposta; pontos: number };

/** Quanto vale achar a palavra em cada parte da resposta. A pergunta é o que mais diz do que ela trata. */
const PESO = { pergunta: 3, explicacao: 1, frase: 1 };

/**
 * As respostas mais próximas de um texto solto, da mais parecida para a menos.
 * É a função que o tutor de IA usa para saber o que a casa já respondeu antes
 * de falar qualquer coisa.
 *
 * A conta: cada palavra do texto vale mais quanto MENOS respostas a têm
 * ("moissanite" separa, "aliança" não), e vale mais na pergunta do que na
 * explicação. No fim, quem cobre mais palavras do texto sobe. Resposta
 * arquivada nunca entra. No empate, a confirmada vem antes da "a confirmar".
 *
 * Devolve só o que tem algum ponto: texto sem nenhuma palavra em comum com a
 * biblioteca devolve lista vazia, e é assim que o tutor sabe que a casa ainda
 * não respondeu aquilo.
 */
export function respostasProximas(texto: string, respostas: readonly Resposta[], limite = 5): RespostaProxima[] {
  const termos = [...new Set(palavrasDoTexto(texto))];
  const validas = respostas.filter((r) => r.estado !== "arquivada");
  if (termos.length === 0 || validas.length === 0) return [];

  const partes = validas.map((r) => ({
    r,
    pergunta: palavrasDoTexto(r.pergunta),
    explicacao: palavrasDoTexto(r.explicacao),
    frase: palavrasDoTexto(r.frase ?? ""),
  }));
  const tem = (lista: string[], termo: string) => lista.some((p) => mesmaFamilia(p, termo));

  // Em quantas respostas cada palavra do texto aparece: é o que diz se ela é rara.
  const raridade = new Map<string, number>();
  for (const t of termos) {
    const em = partes.filter((p) => tem(p.pergunta, t) || tem(p.explicacao, t) || tem(p.frase, t)).length;
    raridade.set(t, em === 0 ? 0 : Math.log(1 + validas.length / em));
  }

  const lista: RespostaProxima[] = [];
  for (const p of partes) {
    let pontos = 0;
    let cobertas = 0;
    for (const t of termos) {
      const peso =
        (tem(p.pergunta, t) ? PESO.pergunta : 0) + (tem(p.explicacao, t) ? PESO.explicacao : 0) + (tem(p.frase, t) ? PESO.frase : 0);
      if (peso === 0) continue;
      cobertas++;
      pontos += peso * (raridade.get(t) ?? 0);
    }
    if (pontos <= 0) continue;
    // Cobrir metade das palavras do texto vale três quartos; cobrir todas, o valor cheio.
    pontos *= 0.5 + 0.5 * (cobertas / termos.length);
    lista.push({ resposta: p.r, pontos: Math.round(pontos * 100) / 100 });
  }
  return lista
    .sort((a, b) => b.pontos - a.pontos || ORDEM_DO_ESTADO[a.resposta.estado] - ORDEM_DO_ESTADO[b.resposta.estado])
    .slice(0, Math.max(1, limite));
}
