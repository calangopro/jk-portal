/**
 * As regras do tutor do vendedor: o que ele recebe, o que ele pode dizer e
 * como a saída do modelo de linguagem é conferida antes de chegar à tela.
 *
 * O PRINCÍPIO: o tutor não sabe nada sozinho. Ele só repete, com as palavras
 * certas para o caso, o que a casa já escreveu na Biblioteca JK e o que o
 * catálogo diz de um produto. Dúvida que a biblioteca não cobre recebe "ainda
 * não tem resposta", e vira pergunta no chat do time. Modelo de linguagem que completa regra de
 * joalheria por conta própria (preço, prazo, garantia) é pior que nenhum.
 *
 * Por isso a saída passa por `conferirSaida`: resposta que diz ter respondido
 * sem citar nenhuma fonte é rebaixada para "não respondeu", e fonte que o
 * modelo inventou é descartada.
 *
 * Arquivo puro, para o teste rodar sem banco e sem modelo.
 */

/** Quantas perguntas uma pessoa faz por dia. Cada uma são até duas chamadas ao modelo. */
export const TETO_POR_DIA = 80;

/** O tamanho máximo do print, já reduzido pelo navegador, em caracteres de base64. */
export const TETO_DA_IMAGEM = 900_000;

export type FonteDoTutor = { id: string; pergunta: string; explicacao: string; frase: string | null; confirmada: boolean };
export type ProdutoDoTutor = {
  codigo: string;
  nome: string;
  preco: number | null;
  url: string | null;
  diasUteis: number | null;
  /** O que a conta de prazo do painel dá para este produto, fechando hoje. `null` quando a loja não declara o prazo. */
  prazo: { retirada: string; correios: string } | null;
};

export type LeituraDoPrint = {
  /** A imagem é uma conversa? Quando não é (foto de aliança, comprovante), a leitura diz o que ela mostra. */
  eConversa: boolean;
  pergunta: string;
  produto: string | null;
  detalhes: string | null;
};

export type SaidaDoModelo = { responde: boolean; para_o_vendedor: string; frase_para_o_cliente: string; usou: string[] };

export type RespostaDoTutor = {
  respondeu: boolean;
  paraOVendedor: string;
  fraseParaOCliente: string | null;
  /** As respostas da biblioteca em que ele se apoiou. */
  fontes: FonteDoTutor[];
  /** Alguma fonte ainda não foi confirmada pela JK. */
  temFonteAConfirmar: boolean;
};

export const ESQUEMA_DA_LEITURA = {
  type: "object",
  additionalProperties: false,
  required: ["e_conversa", "pergunta_do_cliente", "produto", "detalhes"],
  properties: {
    e_conversa: { type: "boolean" },
    pergunta_do_cliente: { type: "string" },
    produto: { type: "string" },
    detalhes: { type: "string" },
  },
} as const;

export const ESQUEMA_DA_RESPOSTA = {
  type: "object",
  additionalProperties: false,
  required: ["responde", "para_o_vendedor", "frase_para_o_cliente", "usou"],
  properties: {
    responde: { type: "boolean" },
    para_o_vendedor: { type: "string" },
    frase_para_o_cliente: { type: "string" },
    usou: { type: "array", items: { type: "string" } },
  },
} as const;

export const INSTRUCAO_DA_LEITURA = [
  "Você lê o print de uma conversa de WhatsApp entre um vendedor de uma joalheria e um cliente.",
  "Responda em português do Brasil, sem travessão.",
  "Em pergunta_do_cliente, escreva em uma frase a pergunta ou o pedido do cliente que ainda está sem resposta.",
  "Em produto, escreva o produto citado ou mostrado, se houver (nome ou descrição curta, como \"aliança de prata 3 mm com anel solitário\"). Sem produto, deixe vazio.",
  "Em detalhes, escreva em uma linha o que muda a resposta: cidade, loja, numeração, data em que o cliente quer receber, forma de pagamento. Sem nada disso, deixe vazio.",
  "NUNCA copie nome, telefone, e-mail, CPF nem endereço de ninguém.",
  "Se a imagem não for uma conversa, marque e_conversa como falso e descreva em pergunta_do_cliente, em uma frase, o que ela mostra.",
].join("\n");

export const INSTRUCAO_DA_RESPOSTA = [
  "Você é o tutor de um vendedor novo da JK Alianças, uma joalheria. Ele traz a dúvida dele ou a de um cliente.",
  "Responda SÓ com o que está nas RESPOSTAS DA CASA e nos PRODUTOS que vêm na mensagem. Regras:",
  "1. Se as respostas da casa não cobrem a dúvida, responde = false. Em para_o_vendedor, diga em uma frase o que falta saber. Deixe frase_para_o_cliente vazia. Nunca complete com o que você acha: preço, prazo, desconto, garantia e política só valem se estiverem escritos na mensagem.",
  "2. Se cobrem, responde = true. Em para_o_vendedor, explique em até quatro frases curtas o que vale e o que ele precisa conferir antes de responder. Em frase_para_o_cliente, escreva a mensagem pronta para colar no WhatsApp, no jeito de uma pessoa da loja: simples, cordial, sem promessa que a resposta da casa não faz.",
  "3. Em usou, liste o id de cada resposta da casa em que você se apoiou. Só ids que estão na mensagem.",
  "4. Resposta marcada A CONFIRMAR ainda não foi confirmada pela JK. Pode usar, mas diga em para_o_vendedor que falta a JK confirmar.",
  "5. Se duas respostas da casa se contradizem, não escolha: diga ao vendedor que existem duas versões e que ele precisa perguntar ao time.",
  "6. Dado de PRODUTO (nome, preço de hoje, link e a data que a conta do painel dá) pode ir na frase para o cliente, escrito em linguagem natural. Nunca copie a linha do produto com as barras. Se houver mais de um produto possível, diga ao vendedor que ele precisa confirmar qual é, e não despeje a lista para o cliente.",
  "7. Não ofereça ação que as respostas da casa não oferecem: reservar, separar a peça, dar desconto, antecipar a produção. Se a data que o cliente quer não bate com a conta do painel, diga isso ao vendedor e sugira perguntar no chat do time, na sala da fábrica.",
  "8. Português do Brasil. Nunca use travessão. Não invente nome de cliente nem de pessoa da loja.",
].join("\n");

const reais = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** A mensagem que vai para o modelo: a dúvida, o que o print mostra, as fontes e os produtos. */
export function montarPergunta(a: { duvida: string; leitura: LeituraDoPrint | null; fontes: FonteDoTutor[]; produtos: ProdutoDoTutor[] }): string {
  const partes: string[] = [];
  if (a.duvida.trim()) partes.push(`DÚVIDA DO VENDEDOR: ${a.duvida.trim()}`);
  if (a.leitura) {
    partes.push(`O QUE O PRINT MOSTRA: ${a.leitura.pergunta}`);
    if (a.leitura.produto) partes.push(`PRODUTO CITADO NO PRINT: ${a.leitura.produto}`);
    if (a.leitura.detalhes) partes.push(`DETALHES DO PRINT: ${a.leitura.detalhes}`);
  }
  partes.push(
    "",
    "RESPOSTAS DA CASA:",
    ...(a.fontes.length
      ? a.fontes.map((f) => `[${f.id}] (${f.confirmada ? "CONFIRMADA" : "A CONFIRMAR"}) Pergunta: ${f.pergunta} | Explicação: ${f.explicacao}${f.frase ? ` | Frase pronta: ${f.frase}` : ""}`)
      : ["(nenhuma resposta da casa trata disso)"]),
  );
  if (a.produtos.length) {
    partes.push(
      "",
      "PRODUTOS:",
      ...a.produtos.map((p) => `- ${p.nome} | ${p.preco !== null ? `preço de hoje ${reais(p.preco)}` : "sem preço"}${p.diasUteis !== null ? ` | a loja declara ${p.diasUteis} dias úteis de produção` : ""}${p.prazo ? ` | fechando hoje, a conta do painel dá, para retirar em loja: ${p.prazo.retirada} Para os Correios: ${p.prazo.correios}` : ""}${p.url ? ` | ${p.url}` : ""}`),
    );
  }
  return partes.join("\n");
}

/** Troca o travessão, que a casa não usa, e apara o texto. */
function limpar(s: unknown, max: number): string {
  return String(s ?? "")
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/[ \t]+\n/g, "\n")
    .trim()
    .slice(0, max);
}

/**
 * Confere o que o modelo devolveu contra o que foi dado a ele.
 *
 * - Fonte que não estava na mensagem é descartada.
 * - "Respondi" sem nenhuma fonte e sem produto vira "não respondi": é o sinal de
 *   que o modelo respondeu de cabeça.
 * - Sem resposta, a frase para o cliente some, mesmo que o modelo tenha escrito uma.
 */
export function conferirSaida(saida: SaidaDoModelo, fontes: FonteDoTutor[], temProduto: boolean): RespostaDoTutor {
  const porId = new Map(fontes.map((f) => [f.id, f]));
  const usadas = [...new Set(Array.isArray(saida.usou) ? saida.usou : [])].map((id) => porId.get(String(id))).filter((f): f is FonteDoTutor => Boolean(f));
  const respondeu = saida.responde === true && (usadas.length > 0 || temProduto);
  const paraOVendedor = limpar(saida.para_o_vendedor, 900);
  const frase = limpar(saida.frase_para_o_cliente, 900);
  return {
    respondeu,
    paraOVendedor: respondeu ? paraOVendedor : paraOVendedor || "A Biblioteca JK ainda não tem resposta para isso.",
    fraseParaOCliente: respondeu && frase ? frase : null,
    fontes: respondeu ? usadas : [],
    temFonteAConfirmar: respondeu && usadas.some((f) => !f.confirmada),
  };
}

/** A resposta fixa para quando nada na biblioteca nem no catálogo trata da dúvida. Não gasta chamada ao modelo. */
export const SEM_RESPOSTA: RespostaDoTutor = {
  respondeu: false,
  paraOVendedor: "A Biblioteca JK ainda não tem resposta para isso. Pergunte no chat do time: a resposta pode virar item da biblioteca, e a próxima pessoa já encontra.",
  fraseParaOCliente: null,
  fontes: [],
  temFonteAConfirmar: false,
};

const SOLTAS = new Set(["de", "da", "do", "das", "dos", "em", "com", "para", "por", "uma", "um", "que", "the", "par", "mm"]);
/**
 * Palavras que estão em metade do catálogo. Contam para escolher o melhor
 * entre os candidatos, mas sozinhas não fazem um produto ser candidato: "aliança
 * de prata" não aponta peça nenhuma, "Eternal Love" aponta.
 */
const GENERICAS = new Set([
  "alianca", "aliancas", "anel", "aneis", "prata", "ouro", "namoro", "casamento", "noivado", "compromisso", "solitario", "brinde", "banhada", "banhado",
  "semijoia", "joia", "pedra", "pedras", "zirconia", "zirconias", "masculina", "feminina", "tradicional", "reta", "abaulada", "anatomica", "polida", "fosca",
]);
const ehGenerica = (w: string) => GENERICAS.has(w) || /^\d+(?:mm|k)$/.test(w) || /^\d+$/.test(w);
const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Os produtos do catálogo que batem com um texto solto ("eternal love 3mm").
 * Entra quem tem todas as palavras; sem ninguém assim, quem tem pelo menos
 * duas. Uma palavra só em comum não basta: "aliança" bate com o catálogo inteiro.
 */
export function produtosDoTexto<T extends { nome: string; codigo: string; vendidos: number }>(texto: string, catalogo: readonly T[], limite = 3): T[] {
  const palavras = [...new Set(semAcento(texto).replace(/(\d)\s*mm\b/g, "$1mm").split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !SOLTAS.has(w)))].slice(0, 8);
  if (palavras.length === 0) return [];
  const pontuados = catalogo
    .map((p) => {
      const nome = semAcento(`${p.nome} ${p.codigo}`).replace(/(\d)\s*mm\b/g, "$1mm");
      const batem = palavras.filter((w) => nome.includes(w));
      // Só é candidato quem bate em pelo menos uma palavra que separa.
      return { p, n: batem.some((w) => !ehGenerica(w)) ? batem.length : 0 };
    })
    .filter((x) => x.n >= 1);
  if (pontuados.length === 0) return [];
  const melhor = Math.max(...pontuados.map((x) => x.n));
  const melhores = pontuados.filter((x) => x.n === melhor);
  // Uma palavra só vale quando ela separa (o nome de um modelo). "Aliança" casa com centenas, e aí não há o que mostrar.
  if (melhor < 2 && melhores.length > 12) return [];
  // Só os que mais batem, e dentro deles os mais vendidos.
  return melhores.sort((a, b) => b.p.vendidos - a.p.vendidos).slice(0, limite).map((x) => x.p);
}
