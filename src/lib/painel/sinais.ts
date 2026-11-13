/**
 * Sinais do painel: o que está errado e onde dá para crescer.
 *
 * Cada regra é uma conta sobre números que o painel já tem (vendas dos dois
 * períodos, fila de recuperação, custos), e todo sinal diz o número que o
 * disparou e aonde ir para agir. Nada aqui é opinião de modelo de linguagem:
 * se a regra não tem dado, o sinal não aparece.
 *
 * Arquivo puro, para o teste rodar sem banco. As regras são poucas de
 * propósito: sinal demais vira ruído e ninguém lê.
 */
import type { LinhaDeCanal } from "../vendas/origem.ts";

export type Gravidade = "problema" | "atencao" | "oportunidade" | "bom";

export type Sinal = {
  chave: string;
  gravidade: Gravidade;
  titulo: string;
  texto: string;
  /** Tamanho do sinal em reais, para ordenar dentro da mesma gravidade. */
  peso: number;
  link?: { href: string; rotulo: string };
};

type Totais = {
  pagos: number;
  valor_pago: number;
  aguardando: number;
  valor_aguardando: number;
  cancelados: number;
  valor_cancelado: number;
};

type Periodo = {
  totais: Totais;
  por_dia: { dia: string; pagos: number; valor_pago: number }[];
  por_hora: { hora: number; pagos: number; valor: number }[];
  /** Faturamento por canal, já agrupado por `agruparPorCanal` (quem chama agrupa: este arquivo não importa código). */
  canais: LinhaDeCanal[];
  por_pagamento: { tipo: string; pagos: number; valor: number; criados: number; cancelados: number }[];
};

export type EntradaDosSinais = {
  atual: Periodo;
  anterior: Periodo | null;
  /** Dias de cada período, para os textos ("nos últimos 30 dias"). */
  dias: number;
  /** Fila de recuperação, quando a pessoa tem a área. */
  recuperar?: { clientes: number; valor: number } | null;
  /** Custos do mês contra o faturamento pago do mês, quando a pessoa é administradora. */
  custos?: { custoAteHoje: number; faturamento: number } | null;
  /** Andamento da meta do mês, quando há meta definida. */
  meta?: { meta: number; feito: number; projecao: number; precisaPorDia: number; ritmo: number; diasQueFaltam: number; situacao: string } | null;
  /** Horas desde a última leitura da Tray; `null` se nunca houve. */
  horasDesdeALeitura?: number | null;
};

const reais = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (n: number) => `${Math.round(n * 100)}%`;
const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const ORDEM: Record<Gravidade, number> = { problema: 0, atencao: 1, oportunidade: 2, bom: 3 };

export function taxaDeCancelamento(t: Totais): number {
  const criados = t.pagos + t.aguardando + t.cancelados;
  return criados ? t.cancelados / criados : 0;
}

/** Variação de `agora` sobre `antes`, como fração. `null` quando não há base. */
export function variacao(agora: number, antes: number): number | null {
  return antes > 0 ? (agora - antes) / antes : null;
}

/** Faturamento médio por dia da semana, do melhor para o pior. */
export function porDiaDaSemana(porDia: { dia: string; valor_pago: number }[]): { dia: number; nome: string; media: number }[] {
  const soma = new Map<number, { total: number; n: number }>();
  for (const d of porDia) {
    const ds = new Date(`${d.dia}T12:00:00Z`).getUTCDay();
    const a = soma.get(ds) ?? { total: 0, n: 0 };
    a.total += Number(d.valor_pago);
    a.n += 1;
    soma.set(ds, a);
  }
  return [...soma.entries()]
    .map(([dia, a]) => ({ dia, nome: DIAS[dia], media: Math.round((a.total / a.n) * 100) / 100 }))
    .sort((a, b) => b.media - a.media);
}

export function calcularSinais(e: EntradaDosSinais): Sinal[] {
  const s: Sinal[] = [];
  const t = e.atual.totais;
  const faturamento = Number(t.valor_pago);
  const criados = t.pagos + t.aguardando + t.cancelados;

  // 1. Dado velho contamina todo o resto: vem primeiro.
  if (e.horasDesdeALeitura === null) {
    s.push({
      chave: "sem-leitura", gravidade: "problema", peso: 1e12,
      titulo: "Os pedidos da Tray ainda não foram trazidos",
      texto: "Sem a leitura da Tray o painel não tem venda para mostrar.",
    });
  } else if (typeof e.horasDesdeALeitura === "number" && e.horasDesdeALeitura > 12) {
    s.push({
      chave: "leitura-atrasada", gravidade: "problema", peso: 1e12,
      titulo: `A última leitura da Tray foi há ${Math.round(e.horasDesdeALeitura)} horas`,
      texto: "Os números abaixo podem estar atrasados. A rotina roda de hora em hora, das 8h às 23h, com o computador ligado e a Tray aberta no Chrome.",
    });
  }

  // 1b. Meta do mês fora do ritmo.
  if (e.meta && e.meta.situacao === "atras") {
    s.push({
      chave: "meta-atrasada", gravidade: "problema", peso: e.meta.meta - e.meta.projecao,
      titulo: `No ritmo atual o mês fecha em ${reais(e.meta.projecao)}, abaixo da meta de ${reais(e.meta.meta)}`,
      texto:
        e.meta.diasQueFaltam > 0
          ? `Para bater, a loja precisa de ${reais(e.meta.precisaPorDia)} por dia nos ${e.meta.diasQueFaltam} dias que faltam. Hoje vem ${reais(e.meta.ritmo)} por dia.`
          : `Faltam ${reais(e.meta.meta - e.meta.feito)} e hoje é o último dia do mês.`,
    });
  } else if (e.meta && e.meta.situacao === "batida") {
    s.push({
      chave: "meta-batida", gravidade: "bom", peso: e.meta.feito - e.meta.meta,
      titulo: `A meta do mês foi batida: ${reais(e.meta.feito)}`,
      texto: `Passou ${reais(e.meta.feito - e.meta.meta)} da meta de ${reais(e.meta.meta)}.`,
    });
  }

  // 2. Custos comendo o faturamento.
  if (e.custos && e.custos.faturamento > 0) {
    const fatia = e.custos.custoAteHoje / e.custos.faturamento;
    if (fatia >= 0.8) {
      s.push({
        chave: "custos-altos", gravidade: "problema", peso: e.custos.custoAteHoje,
        titulo: `Os custos do mês já levam ${pct(fatia)} do faturamento da loja`,
        texto: `São ${reais(e.custos.custoAteHoje)} de custo contra ${reais(e.custos.faturamento)} de venda paga, antes do custo das peças. O Pix por fora não entra nessa conta.`,
        link: { href: "/admin/custos", rotulo: "Ver os custos" },
      });
    }
  }

  // 3. Faturamento contra o período anterior.
  const dFat = e.anterior ? variacao(faturamento, Number(e.anterior.totais.valor_pago)) : null;
  if (dFat !== null && dFat <= -0.1) {
    s.push({
      chave: "faturamento-caiu", gravidade: "problema", peso: Number(e.anterior!.totais.valor_pago) - faturamento,
      titulo: `O faturamento caiu ${pct(-dFat)} sobre os ${e.dias} dias anteriores`,
      texto: `Foram ${reais(faturamento)} agora contra ${reais(Number(e.anterior!.totais.valor_pago))} antes.`,
      link: { href: "/admin/vendas?periodo=30d", rotulo: "Abrir as vendas" },
    });
  } else if (dFat !== null && dFat >= 0.1) {
    s.push({
      chave: "faturamento-subiu", gravidade: "bom", peso: faturamento - Number(e.anterior!.totais.valor_pago),
      titulo: `O faturamento subiu ${pct(dFat)} sobre os ${e.dias} dias anteriores`,
      texto: `Foram ${reais(faturamento)} agora contra ${reais(Number(e.anterior!.totais.valor_pago))} antes.`,
    });
  }

  // 4. Pedido criado que não vira venda.
  const cancel = taxaDeCancelamento(t);
  if (criados >= 20 && cancel >= 0.3) {
    s.push({
      chave: "cancelamento-alto", gravidade: "problema", peso: Number(t.valor_cancelado),
      titulo: `${Math.round(cancel * 10)} de cada 10 pedidos criados não viram venda`,
      texto: `${t.cancelados} pedidos cancelados em ${e.dias} dias, somando ${reais(Number(t.valor_cancelado))}. O cancelado vale mais que o pago quando o ticket é alto.`,
      link: { href: "/admin/recuperacao", rotulo: "Ver quem não pagou" },
    });
  }

  // 5. Dinheiro parado na fila de recuperação.
  if (e.recuperar && e.recuperar.clientes > 0) {
    s.push({
      chave: "fila-de-recuperacao", gravidade: "oportunidade", peso: e.recuperar.valor,
      titulo: `${reais(e.recuperar.valor)} em pedidos não pagos esperando uma conversa`,
      texto: `${e.recuperar.clientes} ${e.recuperar.clientes === 1 ? "cliente tentou" : "clientes tentaram"} comprar nos últimos 14 dias, não pagaram e ninguém chamou.`,
      link: { href: "/admin/recuperacao", rotulo: "Abrir a fila" },
    });
  }

  // 6. Meio de pagamento que perde venda.
  for (const f of e.atual.por_pagamento) {
    if (f.criados < 5) continue;
    const perda = f.cancelados / f.criados;
    const nome = f.tipo.replace(/\s*-\s*Appmax$/i, "");
    if (perda >= 0.8) {
      s.push({
        chave: `pagamento-${nome}`, gravidade: "problema", peso: f.cancelados * 300,
        titulo: `${nome}: ${f.cancelados} de ${f.criados} pedidos cancelados`,
        texto: "Quase ninguém que escolhe esse meio termina a compra. Vale tirar do checkout ou trocar por Pix.",
      });
    } else if (perda >= 0.3 && /cart/i.test(nome)) {
      s.push({
        chave: `pagamento-${nome}`, gravidade: "atencao", peso: f.cancelados * 300,
        titulo: `O cartão não aprova ${pct(perda)} dos pedidos`,
        texto: `${f.cancelados} de ${f.criados} pedidos no cartão foram cancelados. Em compra alta costuma resolver com Pix ou com o valor dividido em dois cartões.`,
        link: { href: "/admin/recuperacao", rotulo: "Ver quem não pagou" },
      });
    }
  }

  // 7. Venda sem origem: não dá para saber o que funciona.
  const canais = e.atual.canais;
  const semEtiqueta = canais.find((c) => c.canal === "sem_etiqueta");
  if (semEtiqueta && faturamento > 0 && semEtiqueta.valor / faturamento >= 0.35) {
    s.push({
      chave: "sem-etiqueta", gravidade: "atencao", peso: semEtiqueta.valor,
      titulo: `${pct(semEtiqueta.valor / faturamento)} do faturamento chega sem origem`,
      texto: `${reais(semEtiqueta.valor)} vieram de busca do Google, acesso direto ou link sem etiqueta, e a Tray não separa um do outro. Etiquetar os links de anúncio e de rede social mostra o que realmente vende.`,
    });
  }

  // 8. Canal crescendo ou caindo.
  if (e.anterior) {
    const antes = new Map(e.anterior.canais.map((c) => [c.canal, c]));
    for (const c of canais) {
      if (c.canal === "sem_etiqueta" || c.canal === "outro") continue;
      const d = variacao(c.valor, antes.get(c.canal)?.valor ?? 0);
      if (d === null) {
        if (c.valor >= 1000) {
          s.push({
            chave: `canal-novo-${c.canal}`, gravidade: "oportunidade", peso: c.valor,
            titulo: `${c.nome} começou a vender: ${reais(c.valor)}`,
            texto: `${c.pagos} ${c.pagos === 1 ? "pedido pago" : "pedidos pagos"} em ${e.dias} dias, e nada no período anterior.`,
          });
        }
      } else if (d >= 0.3 && c.valor >= 1000) {
        s.push({
          chave: `canal-subiu-${c.canal}`, gravidade: "oportunidade", peso: c.valor,
          titulo: `${c.nome} cresceu ${pct(d)}`,
          texto: `${reais(c.valor)} agora contra ${reais(antes.get(c.canal)!.valor)} antes. Vale entender o que mudou e repetir.`,
        });
      } else if (d <= -0.3 && antes.get(c.canal)!.valor >= 1000) {
        s.push({
          chave: `canal-caiu-${c.canal}`, gravidade: "atencao", peso: antes.get(c.canal)!.valor - c.valor,
          titulo: `${c.nome} caiu ${pct(-d)}`,
          texto: `${reais(c.valor)} agora contra ${reais(antes.get(c.canal)!.valor)} antes.`,
        });
      }
    }
  }

  // 9. Pedido esperando pagamento agora.
  if (t.aguardando > 0) {
    s.push({
      chave: "aguardando", gravidade: "oportunidade", peso: Number(t.valor_aguardando),
      titulo: `${reais(Number(t.valor_aguardando))} esperando pagamento`,
      texto: `${t.aguardando} ${t.aguardando === 1 ? "pedido ainda pode" : "pedidos ainda podem"} ser pago. Uma mensagem agora vale mais do que amanhã.`,
      link: { href: "/admin/recuperacao?dias=7", rotulo: "Ver quem está esperando" },
    });
  }

  // 10. Onde concentrar: hora e dia da semana.
  const pico = [...e.atual.por_hora].sort((a, b) => b.pagos - a.pagos)[0];
  const semana = porDiaDaSemana(e.atual.por_dia);
  if (pico && pico.pagos >= 5 && semana.length >= 5) {
    const melhor = semana[0];
    const pior = semana[semana.length - 1];
    s.push({
      chave: "pico", gravidade: "oportunidade", peso: 0,
      titulo: `A loja vende mais ${melhor.nome === "sábado" || melhor.nome === "domingo" ? "no" : "na"} ${melhor.nome}, por volta das ${pico.hora}h`,
      texto: `${melhor.nome.charAt(0).toUpperCase()}${melhor.nome.slice(1)} rende em média ${reais(melhor.media)} por dia, contra ${reais(pior.media)} ${pior.nome === "sábado" || pior.nome === "domingo" ? "no" : "na"} ${pior.nome}. É onde anúncio e atendimento rendem mais.`,
    });
  }

  return s.sort((a, b) => ORDEM[a.gravidade] - ORDEM[b.gravidade] || b.peso - a.peso);
}
