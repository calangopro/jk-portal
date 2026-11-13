/**
 * Mapa de gargalos: onde o dinheiro vaza, por sistema, com a gravidade.
 *
 * É a versão ao vivo do "mapa de erros por sistema" da análise de 09/11/2026.
 * Cada linha é uma REGRA sobre números que o painel já lê, e diz o número que
 * a disparou. Sem dado, a linha não aparece: gargalo inventado é pior que
 * gargalo escondido.
 *
 * A ordem é a do dinheiro: o que mais custa primeiro (`peso`, em reais quando
 * dá para estimar). Arquivo puro, para o teste rodar sem banco.
 */
import type { Etapas } from "../ga4/funil.ts";

export type Situacao = "grave" | "medio" | "atencao" | "ok";

export type Gargalo = {
  chave: string;
  sistema: string;
  situacao: Situacao;
  titulo: string;
  texto: string;
  /** Tamanho em reais, para ordenar dentro da mesma gravidade. */
  peso: number;
  link?: { href: string; rotulo: string };
};

export type Faixa = { faixa: number; pedidos: number; pagos: number; cancelados: number; valor_pago: number; valor_cancelado: number };
export type Meio = { nome: string; pedidos: number; pagos: number; cancelados: number; valor_cancelado: number };

export type EntradaDosGargalos = {
  pedidos: { pedidos: number; pagos: number; cancelados: number; valor_pago: number; valor_cancelado: number } | null;
  faixas: Faixa[];
  meios: Meio[];
  repetidos: { pedidos_a_mais: number; clientes: number } | null;
  site: Etapas | null;
  plataformas: {
    plataforma: "meta" | "google";
    nome: string;
    /** Gasto já com o imposto da fatura. */
    gasto: number;
    /** O que a plataforma diz que vendeu. */
    valorInformado: number;
    /** O que a loja recebeu, pago, com a etiqueta da plataforma. */
    valorPago: number;
    /** Fatia da verba em campanha que não tem objetivo de venda. `null` sem leitura. */
    foraDeVenda: number | null;
  }[];
  semEtiqueta: number;
  /** Quanto de venda paga cada real de anúncio precisa trazer para empatar. */
  empate: number;
};

export const NOME_DA_FAIXA: Record<number, string> = { 1: "Até R$ 300", 2: "R$ 300 a R$ 500", 3: "R$ 500 a R$ 800", 4: "R$ 800 a R$ 1.500", 5: "Acima de R$ 1.500" };

/** "Cartão Master" e "Cartão de Crédito - Appmax" são o mesmo meio para quem decide. */
export function meioDePagamento(tipo: string): string {
  const t = tipo.toLowerCase();
  if (t.includes("pix")) return "Pix";
  if (t.includes("boleto")) return "Boleto";
  if (t.includes("cart")) return "Cartão";
  return tipo.trim() ? "Outro" : "Sem informação";
}

export function juntarMeios(crus: { tipo: string; pedidos: number; pagos: number; cancelados: number; valor_cancelado: number }[]): Meio[] {
  const porNome = new Map<string, Meio>();
  for (const m of crus) {
    const nome = meioDePagamento(m.tipo);
    const a = porNome.get(nome) ?? { nome, pedidos: 0, pagos: 0, cancelados: 0, valor_cancelado: 0 };
    a.pedidos += Number(m.pedidos);
    a.pagos += Number(m.pagos);
    a.cancelados += Number(m.cancelados);
    a.valor_cancelado += Number(m.valor_cancelado);
    porNome.set(nome, a);
  }
  return [...porNome.values()].sort((a, b) => b.pedidos - a.pedidos);
}

const reais = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const reaisMil = (n: number) => (n >= 1000 ? `R$ ${(n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : reais(n));
const pct = (n: number) => `${Math.round(n * 100)}%`;
const pct1 = (n: number) => `${(n * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
const ORDEM: Record<Situacao, number> = { grave: 0, medio: 1, atencao: 2, ok: 3 };

export function mapearGargalos(e: EntradaDosGargalos): Gargalo[] {
  const g: Gargalo[] = [];

  // 1. Pagamento: pedido criado que não vira venda.
  const p = e.pedidos;
  if (p && p.pedidos >= 20) {
    const taxa = p.cancelados / p.pedidos;
    g.push({
      chave: "pagamento",
      sistema: "Pagamento",
      situacao: taxa >= 0.35 ? "grave" : taxa >= 0.2 ? "medio" : "ok",
      titulo: `${pct(taxa)} dos pedidos criados não são pagos`,
      texto: `${p.cancelados} de ${p.pedidos} pedidos foram cancelados: ${reaisMil(p.valor_cancelado)} cancelados contra ${reaisMil(p.valor_pago)} pagos.`,
      peso: p.valor_cancelado,
      link: { href: "/admin/recuperacao", rotulo: "Ver quem não pagou" },
    });
  }

  // 1b. Pedido caro que não fecha online.
  const caro = e.faixas.find((f) => f.faixa === 5);
  if (caro && caro.pedidos >= 8) {
    const taxa = caro.cancelados / caro.pedidos;
    if (taxa >= 0.5) {
      g.push({
        chave: "pedido-caro",
        sistema: "Pagamento",
        situacao: taxa >= 0.7 ? "grave" : "medio",
        titulo: `Pedido acima de R$ 1.500 quase não fecha: ${pct(taxa)} cancelados`,
        texto: `${caro.cancelados} de ${caro.pedidos} pedidos nessa faixa foram cancelados, somando ${reaisMil(caro.valor_cancelado)}. É compra que pede conversa, Pix ou dois cartões.`,
        peso: caro.valor_cancelado,
        link: { href: "/admin/recuperacao", rotulo: "Abrir a fila" },
      });
    }
  }

  // 1c. Meio de pagamento que ninguém termina.
  for (const m of e.meios) {
    if (m.pedidos < 5) continue;
    const taxa = m.cancelados / m.pedidos;
    if (m.pagos === 0) {
      g.push({
        chave: `meio-${m.nome}`,
        sistema: "Pagamento",
        situacao: "grave",
        titulo: `${m.nome}: ${m.pedidos} pedidos e nenhum pago`,
        texto: `Ninguém que escolhe esse meio termina a compra. São ${reaisMil(m.valor_cancelado)} em pedidos que ocupam o lugar de um Pix.`,
        peso: m.valor_cancelado,
      });
    } else if (m.nome === "Cartão" && taxa >= 0.3) {
      g.push({
        chave: "meio-cartao",
        sistema: "Pagamento",
        situacao: taxa >= 0.4 ? "grave" : "medio",
        titulo: `O cartão não aprova ${pct(taxa)} dos pedidos`,
        texto: `${m.cancelados} de ${m.pedidos} pedidos no cartão foram cancelados (${reaisMil(m.valor_cancelado)}). Vale pedir à Appmax o motivo das recusas.`,
        peso: m.valor_cancelado,
      });
    }
  }

  // 2. Sinal dos anúncios: a plataforma diz uma coisa, a loja recebe outra.
  for (const pl of e.plataformas) {
    if (pl.valorInformado >= 1000 && pl.gasto > 0) {
      const razao = pl.valorPago / pl.valorInformado;
      if (razao < 0.7) {
        g.push({
          chave: `sinal-${pl.plataforma}`,
          sistema: `Sinal do ${pl.nome}`,
          situacao: razao < 0.4 ? "grave" : "medio",
          titulo: `O ${pl.nome} mostra ${(1 / Math.max(razao, 0.01)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} vezes a venda que a loja recebeu`,
          texto: `Ele informa ${reaisMil(pl.valorInformado)} em vendas. A loja recebeu ${reaisMil(pl.valorPago)} pagos com a etiqueta dele. A plataforma conta pedido criado e venda de quem só viu o anúncio, e é com esse número que ela escolhe para quem mostrar.`,
          peso: pl.valorInformado - pl.valorPago,
          link: { href: `/admin/trafego/campanhas?plataforma=${pl.plataforma}`, rotulo: "Ver as campanhas" },
        });
      }
    }

    // 3. Retorno contra o empate.
    if (pl.gasto >= 300) {
      const volta = pl.valorPago / pl.gasto;
      const texto = `Gastou ${reaisMil(pl.gasto)}${pl.plataforma === "meta" ? ", já com o imposto da fatura," : ""} e a loja recebeu ${reaisMil(pl.valorPago)} pagos com a etiqueta dele. Para empatar precisa de ${reais(e.empate)} por real. A conta só enxerga pedido com etiqueta, então o número real é um pouco maior.`;
      if (volta < e.empate) {
        g.push({
          chave: `retorno-${pl.plataforma}`,
          sistema: `Verba do ${pl.nome}`,
          situacao: volta < 1 ? "grave" : "medio",
          titulo: `${pl.nome}: cada R$ 1 voltou ${reais(volta)} em venda paga`,
          texto,
          peso: pl.gasto - pl.valorPago * (1 / e.empate),
          link: { href: "/admin/trafego", rotulo: "Abrir o tráfego" },
        });
      } else {
        g.push({ chave: `retorno-${pl.plataforma}`, sistema: `Verba do ${pl.nome}`, situacao: "ok", titulo: `${pl.nome}: cada R$ 1 voltou ${reais(volta)} em venda paga`, texto, peso: 0 });
      }
    }

    // 4. Verba em objetivo que não mede venda.
    if (pl.foraDeVenda !== null && pl.gasto >= 300 && pl.foraDeVenda >= 0.3) {
      g.push({
        chave: `objetivo-${pl.plataforma}`,
        sistema: `Verba do ${pl.nome}`,
        situacao: pl.foraDeVenda >= 0.5 ? "grave" : "medio",
        titulo: `${pct(pl.foraDeVenda)} da verba do ${pl.nome} vai para campanha que não é de venda`,
        texto: "Visita ao perfil, live, conversa e tráfego. O painel sabe quanto custou o clique ou a conversa, mas não o que virou venda depois.",
        peso: pl.gasto * pl.foraDeVenda,
        link: { href: `/admin/trafego/campanhas?plataforma=${pl.plataforma}`, rotulo: "Ver para onde vai a verba" },
      });
    }
  }

  // 5. Site: quem vê produto e não põe no carrinho.
  const s = e.site;
  if (s && s.viramProduto >= 200) {
    const taxa = s.carrinho / s.viramProduto;
    g.push({
      chave: "pagina-de-produto",
      sistema: "Página de produto",
      situacao: taxa < 0.02 ? "grave" : taxa < 0.05 ? "medio" : "ok",
      titulo: `De cada 100 pessoas que veem um produto, ${Math.round(taxa * 100) || "menos de 1"} ${Math.round(taxa * 100) === 1 ? "põe" : "põem"} no carrinho`,
      texto: `${s.viramProduto.toLocaleString("pt-BR")} pessoas viram produto e ${s.carrinho.toLocaleString("pt-BR")} puseram no carrinho (${pct1(taxa)}). Qualquer melhora aqui barateia todo anúncio, de todas as plataformas.`,
      peso: 0,
    });
    if (s.pagamento >= 30 && s.pedido / s.pagamento < 0.6) {
      g.push({
        chave: "checkout",
        sistema: "Checkout",
        situacao: "medio",
        titulo: `${pct(1 - s.pedido / s.pagamento)} de quem começa o pagamento não fecha o pedido`,
        texto: `${s.pagamento.toLocaleString("pt-BR")} pessoas começaram a pagar e ${s.pedido.toLocaleString("pt-BR")} fecharam pedido. Parte é cartão recusado na hora, que faz a pessoa tentar de novo ou desistir.`,
        peso: 0,
      });
    }
  }

  // 6. A mesma pessoa tentando de novo.
  if (p && e.repetidos && e.repetidos.pedidos_a_mais >= 5 && e.repetidos.pedidos_a_mais / p.pedidos >= 0.05) {
    g.push({
      chave: "tentativa-repetida",
      sistema: "Sinal dos anúncios",
      situacao: "atencao",
      titulo: `${e.repetidos.pedidos_a_mais} pedidos são a mesma pessoa tentando de novo`,
      texto: `${e.repetidos.clientes} clientes fizeram outro pedido em menos de 72 horas, quase sempre depois de o pagamento falhar. Cada tentativa conta como compra nova para o anúncio.`,
      peso: 0,
    });
  }

  // 7. Venda sem origem.
  if (p && p.valor_pago > 0 && e.semEtiqueta / p.valor_pago >= 0.35) {
    g.push({
      chave: "sem-etiqueta",
      sistema: "Origem da venda",
      situacao: "atencao",
      titulo: `${pct(e.semEtiqueta / p.valor_pago)} da venda paga chega sem origem`,
      texto: `${reaisMil(e.semEtiqueta)} vieram de busca, acesso direto ou link sem etiqueta. A Tray só guarda a origem, e a mesma etiqueta "ig" serve para anúncio e para o link da bio.`,
      peso: 0,
      link: { href: "/admin/vendas", rotulo: "Ver a origem das vendas" },
    });
  }

  return g.sort((a, b) => ORDEM[a.situacao] - ORDEM[b.situacao] || b.peso - a.peso);
}
