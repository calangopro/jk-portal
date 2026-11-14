/**
 * "Dá para entregar?": quando a peça fica pronta e quando chega ao cliente.
 *
 * DE ONDE VEM CADA NÚMERO, porque nenhum é inventado aqui:
 *
 * - **Dias de produção**: é o que a própria loja declara em cada produto, no
 *   campo de disponibilidade ("Disponível em 2 dias úteis"). Em 14/11/2026, 572
 *   peças diziam 2 dias, 201 diziam 3, e o resto ia de 1 a 10.
 * - **Malote**: a fábrica manda para as lojas na quarta e na sexta, e as peças
 *   chegam em geral depois das 20h. Foi dito pela dona no grupo do time de
 *   vendas em novembro de 2026. Fica em `REGRAS_DE_PARTIDA`, pode ser trocado
 *   pelo painel, e a tela avisa enquanto a JK não confirmar.
 *
 * O QUE A CONTA NÃO SABE, e a tela diz: feriado, o prazo dos Correios depois
 * da postagem (depende do CEP, o site calcula) e urgência combinada com a
 * fábrica, que costuma conseguir antes.
 *
 * A conta devolve os PASSOS além da resposta. Quem vai prometer uma data para o
 * cliente precisa conseguir conferir de onde ela saiu.
 *
 * Arquivo puro, para o teste rodar sem banco.
 */

export type RegrasDeEntrega = {
  /** Dias da semana em que o malote sai da fábrica para as lojas. 0 é domingo. */
  diasDoMalote: number[];
  /** A partir de que hora a peça costuma estar na loja no dia do malote. */
  horaDoMalote: number;
  /** A JK confirmou estas regras? Enquanto não, a tela avisa. */
  confirmadas: boolean;
};

export const REGRAS_DE_PARTIDA: RegrasDeEntrega = { diasDoMalote: [3, 5], horaDoMalote: 20, confirmadas: false };

/** O que veio gravado, conferido. Qualquer coisa fora do esperado volta para a regra de partida. */
export function lerRegras(v: unknown): RegrasDeEntrega {
  if (!v || typeof v !== "object") return REGRAS_DE_PARTIDA;
  const o = v as Record<string, unknown>;
  const dias = Array.isArray(o.diasDoMalote)
    ? [...new Set(o.diasDoMalote.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort((a, b) => a - b)
    : [];
  const hora = Number(o.horaDoMalote);
  if (dias.length === 0 || !Number.isInteger(hora) || hora < 0 || hora > 23) return REGRAS_DE_PARTIDA;
  return { diasDoMalote: dias, horaDoMalote: hora, confirmadas: o.confirmadas === true };
}

/**
 * Os dias úteis de produção, lidos do texto de disponibilidade da loja.
 * "Disponível em 2 dias úteis" dá 2, "Disponível em 1 dia útil" dá 1, pronta
 * entrega e imediato dão 0. Texto que não diz prazo devolve `null`: a conta
 * não chuta.
 */
export function diasDeProducao(texto: string | null | undefined): number | null {
  if (!texto) return null;
  const m = /(\d{1,2})\s*dias?\s*[uú]te?i?s?/i.exec(texto);
  if (m) return Number(m[1]);
  if (/imediat|pronta\s+entrega/i.test(texto)) return 0;
  return null;
}

const NOME_DO_DIA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

const paraData = (dia: string) => new Date(`${dia}T12:00:00Z`);
const paraDia = (d: Date) => d.toISOString().slice(0, 10);

export function diaDaSemana(dia: string): number {
  return paraData(dia).getUTCDay();
}

/** Segunda a sexta. Feriado não entra: a conta não tem calendário de feriados. */
export function ehDiaUtil(dia: string): boolean {
  const d = diaDaSemana(dia);
  return d >= 1 && d <= 5;
}

function maisUmDia(dia: string): string {
  const d = paraData(dia);
  d.setUTCDate(d.getUTCDate() + 1);
  return paraDia(d);
}

/**
 * Soma dias úteis. O dia do pedido não conta: pedido na quarta com 2 dias úteis
 * fica pronto na sexta, que é como a JK explica ("comprando na quarta, a
 * postagem sai até sexta"). Com zero dias, vale o próprio dia se for útil, e o
 * próximo dia útil se não for.
 */
export function somarDiasUteis(dia: string, n: number): string {
  let d = dia;
  if (n <= 0) {
    while (!ehDiaUtil(d)) d = maisUmDia(d);
    return d;
  }
  let faltam = n;
  while (faltam > 0) {
    d = maisUmDia(d);
    if (ehDiaUtil(d)) faltam--;
  }
  return d;
}

/** "sexta, 20/11". */
export function diaPorExtenso(dia: string): string {
  return `${NOME_DO_DIA[diaDaSemana(dia)]}, ${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
}

/** O primeiro dia de malote a partir de `dia`, ele incluído. */
export function proximoMalote(dia: string, regras: RegrasDeEntrega): string {
  let d = dia;
  for (let i = 0; i < 14; i++) {
    if (regras.diasDoMalote.includes(diaDaSemana(d))) return d;
    d = maisUmDia(d);
  }
  return d;
}

export type Caminho = "retirada" | "correios" | "moto";

export const NOME_DO_CAMINHO: Record<Caminho, string> = {
  retirada: "Retirar em loja",
  correios: "Correios",
  moto: "Moto",
};

export type RespostaDePrazo = {
  /** O dia em que a peça fica pronta na fábrica. */
  pronta: string;
  /** Retirada: o dia em que chega na loja. Correios: o dia da postagem. Moto: o dia em que sai. */
  chegada: string;
  /** O que dá para dizer ao cliente, em uma linha. */
  frase: string;
  /** Os passos da conta, na ordem, para a pessoa conferir. */
  conta: string[];
};

const dias = (n: number) => (n === 1 ? "1 dia útil" : `${n} dias úteis`);

/**
 * A resposta para "se fechar hoje, quando chega?".
 *
 * `diasUteis` é a produção que a loja declara para a peça. `hoje` é o dia em
 * que o pedido é fechado, no relógio de São Paulo.
 */
export function quandoFica(a: { hoje: string; diasUteis: number; caminho: Caminho; regras: RegrasDeEntrega }): RespostaDePrazo {
  const pronta = somarDiasUteis(a.hoje, a.diasUteis);
  const conta = [
    a.diasUteis <= 0
      ? `A peça não pede produção: sai em ${diaPorExtenso(pronta)}.`
      : `Fechando em ${diaPorExtenso(a.hoje)}, com ${dias(a.diasUteis)} de produção, fica pronta em ${diaPorExtenso(pronta)}.`,
  ];

  if (a.caminho === "retirada") {
    const malote = proximoMalote(pronta, a.regras);
    const nomes = a.regras.diasDoMalote.map((d) => NOME_DO_DIA[d]).join(" e ");
    conta.push(`O malote da fábrica para as lojas sai de ${nomes}. O primeiro depois de pronta é o de ${diaPorExtenso(malote)}.`);
    conta.push(`As peças costumam chegar na loja depois das ${a.regras.horaDoMalote}h. Para não arriscar, combine a retirada a partir de ${diaPorExtenso(maisUmDia(malote))}.`);
    return { pronta, chegada: malote, frase: `Chega na loja em ${diaPorExtenso(malote)}, depois das ${a.regras.horaDoMalote}h.`, conta };
  }

  if (a.caminho === "correios") {
    conta.push("Depois da postagem vale o prazo dos Correios para o CEP do cliente. O site calcula no carrinho.");
    return { pronta, chegada: pronta, frase: `Postada nos Correios em ${diaPorExtenso(pronta)}. Daí em diante é o prazo dos Correios para o CEP.`, conta };
  }

  conta.push("A moto sai da fábrica no dia em que a peça fica pronta, e a corrida é paga pelo cliente.");
  return { pronta, chegada: pronta, frase: `Sai de moto em ${diaPorExtenso(pronta)}. O cliente paga a corrida.`, conta };
}

/** Há quantos dias a informação foi dada. Serve para a tela dizer quando ela está velha. */
export function diasDesde(quando: string, hoje: string): number {
  const dia = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(quando));
  return Math.round((paraData(hoje).getTime() - paraData(dia).getTime()) / 86_400_000);
}

/** A partir de quantos dias a informação de pronta entrega é tratada como velha. */
export const DIAS_PARA_ENVELHECER = 7;
