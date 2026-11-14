/**
 * As linhas da tabela de campanhas, conjuntos e anúncios, e as regras de cor.
 *
 * A árvore do diagnóstico (campanha, com os conjuntos dentro, com os anúncios
 * dentro) é boa para julgar e ruim para comparar: para ordenar todos os
 * anúncios da conta pelo custo, eles precisam estar numa lista só. Aqui a
 * árvore vira três listas planas, cada linha com o nome de onde ela está e com
 * a venda PAGA da loja ligada a ela pelo coletor de origem.
 *
 * AS CORES SÃO CONTA, não gosto. Verde, âmbar e vermelho saem de três regras,
 * todas aqui, e a tela só pinta o que elas devolvem:
 *   - o veredito do item, que compara o custo dele com a média da conta;
 *   - a volta da LOJA contra o empate (a premissa de margem);
 *   - a volta que a PLATAFORMA informa contra a média da própria conta, porque
 *     o número absoluto dela é inflado e só a comparação entre itens vale.
 *
 * Arquivo puro, para o teste rodar sem banco.
 */
import type { Avaliado, Nivel, Objetivo, Veredito } from "./diagnostico.ts";
import type { VendaDoItem } from "../origem/anotado.ts";

export type Tom = "bom" | "atencao" | "ruim" | "neutro";

export type Linha = {
  nivel: Nivel;
  id: string;
  nome: string;
  campanhaId: string | null;
  conjuntoId: string | null;
  /** Nome da campanha em que o item está. `null` na própria campanha. */
  campanha: string | null;
  /** Nome do conjunto em que o anúncio está. */
  conjunto: string | null;
  tipo: string | null;
  ativo: boolean | null;
  objetivo: Objetivo;
  veredito: Veredito;
  motivo: string;
  /** A etapa do funil em que o item perde mais que a conta, por extenso. */
  ondePerde: string | null;
  gasto: number;
  impressoes: number;
  cliques: number;
  visitas: number | null;
  carrinhos: number | null;
  checkouts: number | null;
  /** Compras, conversas ou cliques, conforme o objetivo. */
  resultados: number;
  custo: number | null;
  /** Venda que a PLATAFORMA atribui ao item. */
  valor: number | null;
  /** Volta por real segundo a plataforma. */
  retorno: number | null;
  /** Pedidos da loja ligados ao item pelo coletor. `null` quando não há nenhum. */
  loja: VendaDoItem | null;
  /** Volta por real pela venda PAGA da loja. `null` sem pedido ligado ou sem gasto. */
  voltaDaLoja: number | null;
  /** Quantos conjuntos (na campanha) ou anúncios (no conjunto) há por baixo. */
  filhos: number;
};

const chave = (nivel: Nivel, id: string) => `${nivel}:${id}`;
const duasCasas = (n: number) => Math.round(n * 100) / 100;

/** A árvore do diagnóstico em lista plana, com a venda da loja em cada linha. */
export function achatar(campanhas: Avaliado[], vendas: Record<string, VendaDoItem>): Linha[] {
  const linhas: Linha[] = [];
  const descer = (i: Avaliado, campanha: Avaliado | null, conjunto: Avaliado | null) => {
    const loja = vendas[chave(i.nivel, i.id)] ?? null;
    linhas.push({
      nivel: i.nivel,
      id: i.id,
      nome: i.nome || "Sem nome",
      campanhaId: i.nivel === "campanha" ? i.id : (campanha?.id ?? i.campanha_id),
      conjuntoId: i.nivel === "conjunto" ? i.id : (conjunto?.id ?? i.conjunto_id),
      campanha: campanha ? campanha.nome || "Sem nome" : null,
      conjunto: conjunto ? conjunto.nome || "Sem nome" : null,
      tipo: i.tipo ?? campanha?.tipo ?? null,
      ativo: i.ativo,
      objetivo: i.objetivo,
      veredito: i.veredito,
      motivo: i.motivo,
      ondePerde: i.gargalo?.texto ?? null,
      gasto: i.gasto,
      impressoes: i.impressoes,
      // O Google e as campanhas de engajamento não separam o clique no link.
      cliques: i.cliques > 0 ? i.cliques : (i.cliques_todos ?? 0),
      visitas: i.visitas,
      carrinhos: i.carrinhos,
      checkouts: i.checkouts,
      resultados: i.resultados,
      custo: i.custo,
      valor: i.valor,
      retorno: i.retorno,
      loja,
      voltaDaLoja: loja && i.gasto > 0 ? duasCasas(loja.valor / i.gasto) : null,
      filhos: i.filhos.length,
    });
    for (const f of i.filhos) {
      if (i.nivel === "campanha") descer(f, i, null);
      else descer(f, campanha, i);
    }
  };
  for (const c of campanhas) descer(c, null, null);
  return linhas;
}

export function tomDoVeredito(v: Veredito): Tom {
  if (v === "bom") return "bom";
  if (v === "ruim") return "ruim";
  if (v === "atencao") return "atencao";
  return "neutro";
}

/**
 * A volta da LOJA (venda paga por real de anúncio) contra o empate.
 *
 * Do empate para cima a venda cobre o anúncio e a margem de referência: verde.
 * Abaixo de 1 o anúncio custou mais do que a loja recebeu: vermelho. No meio a
 * loja recebeu mais do que gastou, mas não o bastante para sobrar: âmbar.
 */
export function tomDaVoltaDaLoja(volta: number | null, empate: number): Tom {
  if (volta === null) return "neutro";
  if (volta >= empate) return "bom";
  if (volta < 1) return "ruim";
  return "atencao";
}

/** Abaixo desta fatia da verba o item não junta dado para ganhar cor. */
export const FATIA_MINIMA = 0.005;

/**
 * A volta que a PLATAFORMA informa, contra a média da conta.
 *
 * Não se compara com o empate: o número da plataforma conta pedido criado e
 * venda de quem só viu o anúncio, então ficaria quase tudo verde. Contra a
 * média o exagero pega todos por igual. Item pequeno demais fica sem cor.
 */
export function tomContraAMedia(valor: number | null, media: number | null, fatiaDaVerba: number): Tom {
  if (valor === null || media === null || media <= 0 || fatiaDaVerba < FATIA_MINIMA) return "neutro";
  if (valor >= media * 1.3) return "bom";
  if (valor <= media * 0.6) return "ruim";
  return "neutro";
}

export type TotaisDaLista = {
  itens: number;
  gasto: number;
  impressoes: number;
  cliques: number;
  checkouts: number;
  /** Só das linhas cujo objetivo é venda. */
  compras: number;
  valor: number;
  lojaPagos: number;
  lojaValor: number;
};

/** A linha de total da lista filtrada. */
export function somar(linhas: Linha[]): TotaisDaLista {
  const t: TotaisDaLista = { itens: linhas.length, gasto: 0, impressoes: 0, cliques: 0, checkouts: 0, compras: 0, valor: 0, lojaPagos: 0, lojaValor: 0 };
  for (const l of linhas) {
    t.gasto += l.gasto;
    t.impressoes += l.impressoes;
    t.cliques += l.cliques;
    t.checkouts += l.checkouts ?? 0;
    if (l.objetivo === "venda") t.compras += l.resultados;
    t.valor += l.valor ?? 0;
    t.lojaPagos += l.loja?.pagos ?? 0;
    t.lojaValor += l.loja?.valor ?? 0;
  }
  t.gasto = duasCasas(t.gasto);
  t.valor = duasCasas(t.valor);
  t.lojaValor = duasCasas(t.lojaValor);
  return t;
}

export type Coluna =
  | "nome" | "gasto" | "resultados" | "custo" | "valor" | "retorno" | "lojaValor" | "voltaDaLoja"
  | "checkouts" | "cliques" | "ctr" | "cpc" | "cpm";

const taxa = (a: number, b: number) => (b > 0 ? a / b : null);

/** O número de uma linha numa coluna. `null` é "não há": vai para o fim em qualquer ordem. */
export function valorDaColuna(l: Linha, c: Coluna): number | string | null {
  switch (c) {
    case "nome": return l.nome.toLocaleLowerCase("pt-BR");
    case "gasto": return l.gasto;
    case "resultados": return l.resultados;
    case "custo": return l.custo;
    case "valor": return l.valor;
    case "retorno": return l.retorno;
    case "lojaValor": return l.loja ? l.loja.valor : null;
    case "voltaDaLoja": return l.voltaDaLoja;
    case "checkouts": return l.checkouts;
    case "cliques": return l.cliques;
    case "ctr": return taxa(l.cliques, l.impressoes);
    case "cpc": return taxa(l.gasto, l.cliques);
    case "cpm": return l.impressoes > 0 ? (l.gasto / l.impressoes) * 1000 : null;
  }
}

/** Ordena sem mexer na lista original. Vazio fica sempre no fim. */
export function ordenar(linhas: Linha[], coluna: Coluna, sentido: "desc" | "asc"): Linha[] {
  const fator = sentido === "desc" ? -1 : 1;
  return [...linhas].sort((a, b) => {
    const x = valorDaColuna(a, coluna);
    const y = valorDaColuna(b, coluna);
    if (x === null && y === null) return b.gasto - a.gasto;
    if (x === null) return 1;
    if (y === null) return -1;
    if (typeof x === "string" || typeof y === "string") return String(x).localeCompare(String(y), "pt-BR") * fator;
    return (x - y) * fator || b.gasto - a.gasto;
  });
}
