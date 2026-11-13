/**
 * Confere a leitura das exportações de pedidos da Tray. Roda sem banco:
 *   node --experimental-strip-types scripts/teste-pedidos-tray.mts
 *
 * Os arquivos são montados aqui mesmo, em Windows-1252 como a Tray entrega,
 * com os casos chatos: acento no cabeçalho, ponto de milhar, campo entre aspas
 * com ponto e vírgula e quebra de linha, data zerada, linha repetida e linha
 * sem número. Os nomes e contatos são inventados.
 */
import {
  ArquivoDaTrayInvalido,
  lerCsv,
  lerPedidos,
  lerProdutosVendidos,
  resumirPorDia,
  situacaoDoStatus,
} from "../src/lib/vendas/tray-csv.ts";
import { agruparPorCanal, canalDaOrigem, nomeLimpo } from "../src/lib/vendas/origem.ts";
import { diasEntre, hojeEmSaoPaulo, intervaloDoPeriodo, lerPeriodo, somarDias } from "../src/lib/vendas/periodo.ts";
import { calcularSinais, porDiaDaSemana, taxaDeCancelamento, variacao } from "../src/lib/painel/sinais.ts";
import { ehAdmin, ehEquipeDeConteudo, NIVEIS, ROLE_LABEL } from "../src/lib/auth/acessos.ts";
import { andamentoDaMeta } from "../src/lib/painel/meta.ts";
import { dividirPorDia, retornoPorPlataforma } from "../src/lib/trafego/retorno.ts";
import { contaDoMes } from "../src/lib/custos/conta.ts";
import { completarDias, lerInsightsDoMeta, lerLotesDoGoogle } from "../src/lib/trafego/leitura.ts";
import { lerItensDoGoogle, lerItensDoMeta, tipoDoGoogle, tipoDoMeta } from "../src/lib/trafego/leitura-itens.ts";
import { diagnosticar, objetivoDe, type Item } from "../src/lib/trafego/diagnostico.ts";

let falhas = 0;
function confere(nome: string, ok: boolean, detalhe = "") {
  if (ok) console.log(`  ok  ${nome}`);
  else {
    falhas++;
    console.error(`  ERRO ${nome}${detalhe ? `\n       ${detalhe}` : ""}`);
  }
}

const latin1 = (texto: string) => new Uint8Array(Buffer.from(texto, "latin1"));

const CABECALHO =
  "Pedido;Data;Hora;Nome do Cliente;CPF;Email;Telefone;Celular;Subtotal produtos;Frete tipo;Frete valor;" +
  "Pagamento tipo;Pagamento data;Obs. cliente;Status pedido;Parceiro;Cupom desconto;Desconto;Cidade;Estado;" +
  "Total;Valor pagamento;Forma pagamento paga;Código cliente;Canal de venda;UTM Source";

const PEDIDOS = [
  CABECALHO,
  // pago, com milhar, cupom com valor e parceiro do catálogo
  "101;11/11/2026;09:15:02;Maria Conceição;111.111.111-11;MARIA@EXEMPLO.COM;;(11) 98888-7777;1.000,00;Sedex;0,00;" +
    "Cartão de Crédito - Appmax;11/11/2026;;A ENVIAR;1516;BEMVINDO10/38.99;38,99;São Paulo;sp;1.000,00;1.000,00;Cartão de Crédito - Appmax;501;LOJA VIRTUAL;1-Google Ads",
  // cancelado sozinho, com observação entre aspas (ponto e vírgula e quebra de linha)
  '102;11/11/2026;10:00:00;João Souza;;joao@exemplo.com;1133334444;;189,90;Frete Grátis;0,00;' +
    'Pix - Appmax;00/00/0000;"gravar ""J e M""; entregar\nna portaria";CANCELADO AUT;0;;0,00;Osasco;SP;189,90;;;502;LOJA VIRTUAL;',
  // aguardando pagamento, no dia seguinte
  "103;12/11/2026;18:25:00;Ana Lima;;ana@exemplo.com;;5511977776666;488,40;Motoboy;38,50;" +
    "Cartão de Crédito - Appmax;;;AGUARDANDO PAGAMENTO;;;0,00;Barueri;SP;488,40;;;503;LOJA VIRTUAL;ig",
  // o mesmo 101 de novo: vale a última linha
  "101;11/11/2026;09:15:02;Maria Conceição;111.111.111-11;maria@exemplo.com;;(11) 98888-7777;1.000,00;Sedex;0,00;" +
    "Cartão de Crédito - Appmax;11/11/2026;;ENVIADO;1516;BEMVINDO10/38.99;38,99;São Paulo;SP;1.000,00;1.000,00;Cartão de Crédito - Appmax;501;LOJA VIRTUAL;1-Google Ads",
  // linha sem número de pedido: fica de fora
  ";12/11/2026;10:00:00;Sem Pedido;;;;;10,00;;;;;;A ENVIAR;;;;;;10,00;;;;;",
  "104;12/11/2026;22:21:44;Rui Paz;;rui@exemplo.com;;11966665555;303,90;Frete Grátis;0,00;Pix - Appmax;12/11/2026;;FINALIZADO;;;0,00;Santos;SP;303,90;303,90;Pix - Appmax;504;LOJA VIRTUAL;whatsapp",
].join("\r\n");

console.log("Pedidos da Tray");

{
  const linhas = lerCsv('a;"b;c";"d\ne";"f ""g"""\r\n1;2;3;4\n');
  confere("csv: campo com ponto e vírgula, quebra de linha e aspas", linhas[0].join("|") === 'a|b;c|d\ne|f "g"', linhas[0].join("|"));
  confere("csv: duas linhas", linhas.length === 2 && linhas[1].length === 4);
}

{
  confere("situação: a enviar, enviado e finalizado são pagos", ["A ENVIAR", "ENVIADO", "FINALIZADO", "A RETIRAR", "PROBLEMAS NA ENTREGA"].every((s) => situacaoDoStatus(s) === "pago"));
  confere("situação: cancelado e cancelado aut", situacaoDoStatus("CANCELADO") === "cancelado" && situacaoDoStatus("Cancelado aut") === "cancelado");
  confere("situação: aguardando pagamento", situacaoDoStatus("AGUARDANDO PAGAMENTO") === "aguardando");
}

const pedidos = lerPedidos(latin1(PEDIDOS));
const p101 = pedidos.find((p) => p.pedido === 101)!;
const p102 = pedidos.find((p) => p.pedido === 102)!;
const p103 = pedidos.find((p) => p.pedido === 103)!;

{
  confere("quatro pedidos: repetido conta uma vez, sem número fica de fora", pedidos.length === 4, String(pedidos.length));
  confere("pedido repetido: vale a última linha", p101.status === "ENVIADO" && p101.situacao === "pago");
  confere("ponto de milhar: 1.000,00 é mil", p101.total === 1000 && p101.subtotal === 1000, String(p101.total));
  confere("data e hora com o fuso de São Paulo", p101.feito_em === "2026-11-11T09:15:02-03:00" && p101.dia === "2026-11-11", p101.feito_em);
  confere("acento do arquivo lido certo", p101.cliente_nome === "Maria Conceição" && p101.cidade === "São Paulo", `${p101.cliente_nome} / ${p101.cidade}`);
  confere("coluna com acento no nome (Código cliente)", p101.cliente_codigo === "501");
  confere("e-mail em minúsculas", p101.cliente_email === "maria@exemplo.com");
  confere("celular com máscara vira 55 + DDD + número", p101.cliente_telefone === "5511988887777", String(p101.cliente_telefone));
  confere("sem celular, vale o telefone fixo", p102.cliente_telefone === "551133334444", String(p102.cliente_telefone));
  confere("número que já vem com 55", p103.cliente_telefone === "5511977776666", String(p103.cliente_telefone));
  confere("cupom sem o valor depois da barra", p101.cupom === "BEMVINDO10" && p101.desconto === 38.99, String(p101.cupom));
  confere("parceiro do catálogo fica, parceiro 0 vira vazio", p101.parceiro === "1516" && p102.parceiro === null);
  confere("UF em maiúsculas", p101.uf === "SP");
  confere("data de pagamento zerada vira vazio", p102.pagamento_em === null && p101.pagamento_em === "2026-11-11");
  confere("cancelado aut é cancelado", p102.situacao === "cancelado");
  confere("observação com quebra de linha não parte o pedido", p102.total === 189.9 && p102.cidade === "Osasco");
  confere("CPF não sai do arquivo", !JSON.stringify(pedidos).includes("111.111"));
}

{
  const dias = resumirPorDia(pedidos);
  const d11 = dias.find((d) => d.dia === "2026-11-11")!;
  const d12 = dias.find((d) => d.dia === "2026-11-12")!;
  confere("dia mais recente primeiro", dias[0].dia === "2026-11-12");
  confere("11/11: um pago de 1.000 e um cancelado de 189,90", d11.pagos === 1 && d11.valorPago === 1000 && d11.cancelados === 1 && d11.valorCancelado === 189.9);
  confere("12/11: pago 303,90, aguardando 488,40 fora do faturamento", d12.pagos === 1 && d12.valorPago === 303.9 && d12.aguardando === 1 && d12.valorAguardando === 488.4);
}

{
  const itens = lerProdutosVendidos(
    latin1(
      [
        "Código produto;EAN;Código loja;Código pedido;Nome produto;Preço venda;Quantidade;Referência;Preço custo;Informação adicional",
        "2139;;1305187;101;Par de Alianças de Namoro em Prata 950 5mm;399,90;1;PAR-5MM;0,00;aro 18 e 22",
        "777;;1305187;101;Anel Solitário Brinde;0,00;1;BRINDE;0,00;",
        "2140;;1305187;104;Corrente Prata 3x1 - 60cm;303,90;2;COR-60;120,50;",
        ";;1305187;;Linha sem pedido;1,00;1;;;",
      ].join("\r\n"),
    ),
  );
  confere("itens agrupados por pedido", itens.get(101)?.length === 2 && itens.get(104)?.length === 1 && itens.size === 2);
  const par = itens.get(101)![0];
  confere("item: código do produto, preço e informação", par.produto_tray_id === "2139" && par.preco === 399.9 && par.info === "aro 18 e 22");
  confere("item: brinde com preço zero continua na lista", itens.get(101)![1].preco === 0);
  confere("item: quantidade e custo", itens.get(104)![0].quantidade === 2 && itens.get(104)![0].custo === 120.5);
}

{
  let recusou = false;
  try {
    lerPedidos(latin1("Código produto;Nome produto\r\n1;x"));
  } catch (e) {
    recusou = e instanceof ArquivoDaTrayInvalido && e.message.includes('"Pedido"');
  }
  confere("arquivo trocado é recusado com o nome da coluna que falta", recusou);
}

console.log("\nOrigem e período da tela de vendas");

{
  const canais = (lista: string[]) => lista.map((v) => canalDaOrigem(v)).join(",");
  confere("Google Ads com número na frente", canais(["1-Google Ads", "4-Google Ads"]) === "google_ads,google_ads");
  confere(
    "Instagram, Facebook, meta e variável que o anúncio não trocou são Meta",
    canais(["ig", "ig_Instagram_Stories", "fb_Facebook_Mobile_Feed", "meta", "meta_trafego_site", "{{site_source_name}}_{{placement}}"]) ===
      "meta,meta,meta,meta,meta,meta",
  );
  confere("link da bio vem antes do RD Station", canalDaOrigem("Link+da+Bio+do+RD+Station") === "bio");
  confere("ChatGPT é resposta de IA", canalDaOrigem("chatgpt.com") === "ia");
  confere("WhatsApp e Pinterest", canais(["whatsapp", "Pinterest"]) === "whatsapp,pinterest");
  confere("vazio e undefined são sem etiqueta", canais(["", "undefined"]) === "sem_etiqueta,sem_etiqueta");
  confere("etiqueta com % solto não quebra", canalDaOrigem("promo 100%") === "outro");

  const agrupado = agruparPorCanal([
    { origem: "ig", pagos: 2, valor: 500.1, criados: 4 },
    { origem: "fb", pagos: 1, valor: 200.2, criados: 1 },
    { origem: "", pagos: 5, valor: 900, criados: 9 },
  ]);
  confere("canais somados e ordenados por faturamento", agrupado[0].canal === "sem_etiqueta" && agrupado[1].canal === "meta" && agrupado[1].valor === 700.3 && agrupado[1].criados === 5);
  confere("nome do produto sem referência nem disponibilidade", nomeLimpo("Par Eternal Love 3mm (Ref. JK9001A) (Disponibilidade: Disponível em 2 dias úteis)") === "Par Eternal Love 3mm");
  confere("referência com parêntese dentro", nomeLimpo("Brinco Semijoia (Ref. DUPLO-18-DO (INFANTIL)) (Disponibilidade: 1 dia)") === "Brinco Semijoia");
}

{
  // 01:30 UTC do dia 13 ainda é 22:30 do dia 12 em São Paulo.
  confere("hoje é o dia de São Paulo, não o do servidor", hojeEmSaoPaulo(new Date("2026-11-13T01:30:00Z")) === "2026-11-12");
  confere("somar dias atravessa o mês", somarDias("2026-11-01", -1) === "2026-10-31" && somarDias("2026-12-31", 1) === "2027-01-01");
  confere("dias entre as pontas, inclusive", diasEntre("2026-10-30", "2026-11-02").join() === "2026-10-30,2026-10-31,2026-11-01,2026-11-02");

  const mes = intervaloDoPeriodo("mes", "2026-11-12");
  confere("este mês: do dia 1 até hoje", mes.de === "2026-11-01" && mes.ate === "2026-11-12");
  confere("este mês compara com os mesmos dias do mês passado", mes.anteriorDe === "2026-10-01" && mes.anteriorAte === "2026-10-12" && mes.comparacao.includes("outubro"));
  const fimDeMarco = intervaloDoPeriodo("mes", "2026-03-31");
  confere("31 de março compara com fevereiro inteiro, sem dia 31", fimDeMarco.anteriorDe === "2026-02-01" && fimDeMarco.anteriorAte === "2026-02-28");
  const sete = intervaloDoPeriodo("7d", "2026-11-12");
  confere("7 dias: hoje e os seis anteriores", sete.de === "2026-11-06" && sete.ate === "2026-11-12" && sete.anteriorDe === "2026-10-30" && sete.anteriorAte === "2026-11-05");
  const passado = intervaloDoPeriodo("mes-passado", "2026-11-12");
  confere("mês passado inteiro contra o anterior", passado.de === "2026-10-01" && passado.ate === "2026-10-31" && passado.anteriorDe === "2026-09-01" && passado.anteriorAte === "2026-09-30");
  const janeiro = intervaloDoPeriodo("mes-passado", "2027-01-05");
  confere("mês passado na virada do ano", janeiro.de === "2026-12-01" && janeiro.ate === "2026-12-31");
  confere("período desconhecido cai em este mês", lerPeriodo("xyz") === "mes" && lerPeriodo("30d") === "30d");
}

console.log("\nSinais do painel e níveis de acesso");

{
  const periodo = (valor: number, pagos: number, cancelados: number, canais: [string, number][]) => ({
    totais: { pagos, valor_pago: valor, aguardando: 0, valor_aguardando: 0, cancelados, valor_cancelado: cancelados * 500 },
    por_dia: [
      { dia: "2026-11-09", pagos: 1, valor_pago: 100 },
      { dia: "2026-11-10", pagos: 5, valor_pago: 900 },
      { dia: "2026-11-11", pagos: 2, valor_pago: 300 },
      { dia: "2026-11-12", pagos: 2, valor_pago: 300 },
      { dia: "2026-11-13", pagos: 2, valor_pago: 300 },
    ],
    por_hora: [{ hora: 13, pagos: 8, valor: 1500 }, { hora: 20, pagos: 2, valor: 300 }],
    canais: agruparPorCanal(canais.map(([origem, v]) => ({ origem, pagos: 1, valor: v, criados: 2 }))),
    por_pagamento: [
      { tipo: "Boleto - Appmax", pagos: 0, valor: 0, criados: 6, cancelados: 6 },
      { tipo: "Cartão de Crédito - Appmax", pagos: 30, valor: 9000, criados: 50, cancelados: 20 },
      { tipo: "Pix - Appmax", pagos: 20, valor: 5000, criados: 22, cancelados: 2 },
    ],
  });
  const sinais = calcularSinais({
    atual: periodo(8000, 50, 28, [["", 5000], ["chatgpt.com", 2000], ["1-Google Ads", 1000]]),
    anterior: periodo(10000, 55, 20, [["", 6000], ["chatgpt.com", 500], ["1-Google Ads", 3500]]),
    dias: 30,
    recuperar: { clientes: 12, valor: 15000 },
    custos: { custoAteHoje: 9000, faturamento: 10000 },
    horasDesdeALeitura: 20,
  });
  const chaves = sinais.map((s) => s.chave);
  confere("leitura atrasada vem primeiro", sinais[0].chave === "leitura-atrasada" && sinais[0].gravidade === "problema");
  confere("queda de 20% no faturamento é problema", chaves.includes("faturamento-caiu"));
  confere("custos em 90% do faturamento é problema", chaves.includes("custos-altos"));
  confere("36% de cancelamento é problema", chaves.includes("cancelamento-alto"), String(taxaDeCancelamento(periodo(0, 50, 28, []).totais)));
  confere("boleto com 6 de 6 cancelados é problema", sinais.some((s) => s.chave === "pagamento-Boleto" && s.gravidade === "problema"));
  confere("cartão com 40% de cancelamento é atenção", sinais.some((s) => s.chave.startsWith("pagamento-Cart") && s.gravidade === "atencao"));
  confere("Pix com 9% de cancelamento não vira sinal", !chaves.some((c) => c.startsWith("pagamento-Pix")));
  confere("62% sem etiqueta é atenção", chaves.includes("sem-etiqueta"));
  confere("IA crescendo 300% é oportunidade", chaves.includes("canal-subiu-ia"));
  confere("Google Ads caindo 71% é atenção", chaves.includes("canal-caiu-google_ads"));
  confere("fila de recuperação é oportunidade com o valor", sinais.some((s) => s.chave === "fila-de-recuperacao" && s.peso === 15000));
  confere("problemas antes de atenção, atenção antes de oportunidade", sinais.map((s) => s.gravidade).join().replace(/(\w+)(,\1)+/g, "$1") === "problema,atencao,oportunidade");
  confere("todo sinal tem título e texto", sinais.every((s) => s.titulo.length > 5 && s.texto.length > 10));
  confere("nenhum sinal com travessão", !sinais.some((s) => /[\u2013\u2014]/.test(s.titulo + s.texto)));

  const calmo = calcularSinais({ atual: { ...periodo(10000, 50, 2, [["1-Google Ads", 10000]]), por_pagamento: [], por_hora: [] }, anterior: null, dias: 30, horasDesdeALeitura: 1 });
  confere("período sem nada errado não inventa sinal", calmo.length === 0, calmo.map((s) => s.chave).join());

  const semana = porDiaDaSemana([{ dia: "2026-11-09", valor_pago: 100 }, { dia: "2026-11-10", valor_pago: 900 }, { dia: "2026-11-16", valor_pago: 300 }]);
  confere("dia da semana: média, do melhor para o pior", semana[0].nome === "terça" && semana[0].media === 900 && semana[1].nome === "segunda" && semana[1].media === 200);
  confere("variação sem base é nula", variacao(10, 0) === null && variacao(110, 100) === 0.1);
}

{
  confere("dono e GM valem como administrador", ehAdmin("dono") && ehAdmin("gm") && ehAdmin("admin"));
  confere("gerente, tráfego e vendas não são administradores", !ehAdmin("gerente") && !ehAdmin("trafego") && !ehAdmin("vendas") && !ehAdmin(null));
  confere("vendas e fábrica ficam fora da equipe de conteúdo", !ehEquipeDeConteudo("vendas") && !ehEquipeDeConteudo("fabrica") && ehEquipeDeConteudo("gerente") && ehEquipeDeConteudo("trafego"));
  confere("os seis níveis novos têm nome", ["dono", "gm", "gerente", "trafego", "vendas", "fabrica"].every((p) => NIVEIS.some((n) => n.papel === p)) && ROLE_LABEL.gm === "GM" && ROLE_LABEL.trafego === "Tráfego");
}

console.log("\nMeta do mês");

{
  const a = andamentoDaMeta(90000, 38000, "2026-11-13");
  confere("13 de 30 dias com 38 mil de 90 mil: atrás", a.situacao === "atras" && a.dia === 13 && a.diasNoMes === 30 && a.diasQueFaltam === 17);
  confere("ritmo de 2.923,08 por dia fecha o mês em 87.692,31", a.ritmo === 2923.08 && a.projecao === 87692.31, `${a.ritmo} / ${a.projecao}`);
  confere("falta 52 mil, 3.058,82 por dia nos 17 dias", a.falta === 52000 && a.precisaPorDia === 3058.82, String(a.precisaPorDia));
  confere("barra em 42%, e o esperado para hoje em 43%", Math.round(a.fracao * 100) === 42 && Math.round(a.esperado * 100) === 43);
  const limite = andamentoDaMeta(90000, 39000, "2026-11-13");
  confere("projeção igual à meta conta como no ritmo", limite.projecao === 90000 && limite.situacao === "no_ritmo");
  const b = andamentoDaMeta(90000, 45000, "2026-11-13");
  confere("45 mil no dia 13 fecha em 103,8 mil: no ritmo", b.situacao === "no_ritmo" && Math.round(b.projecao) === 103846, String(b.projecao));
  const c = andamentoDaMeta(50000, 52000, "2026-11-20");
  confere("passou da meta: batida, barra cheia e nada faltando", c.situacao === "batida" && c.fracao === 1 && c.falta === 0 && c.precisaPorDia === 0);
  const d = andamentoDaMeta(50000, 49000, "2026-11-30");
  confere("último dia: o que falta é para hoje", d.diasQueFaltam === 0 && d.precisaPorDia === 1000);
  confere("fevereiro tem 28 dias", andamentoDaMeta(1000, 100, "2026-02-10").diasNoMes === 28);
  const sinal = calcularSinais({
    atual: { totais: { pagos: 1, valor_pago: 1, aguardando: 0, valor_aguardando: 0, cancelados: 0, valor_cancelado: 0 }, por_dia: [], por_hora: [], canais: [], por_pagamento: [] },
    anterior: null, dias: 30, horasDesdeALeitura: 1, meta: andamentoDaMeta(90000, 30000, "2026-11-13"),
  });
  confere("meta fora do ritmo vira sinal de problema", sinal.length === 1 && sinal[0].chave === "meta-atrasada" && sinal[0].gravidade === "problema");
}

console.log("\nTráfego");

{
  const canais = agruparPorCanal([
    { origem: "1-Google Ads", pagos: 10, valor: 6000, criados: 14 },
    { origem: "ig_Instagram_Stories", pagos: 2, valor: 400, criados: 9 },
    { origem: "", pagos: 30, valor: 20000, criados: 50 },
    { origem: "tiktok", pagos: 1, valor: 250, criados: 1 },
  ]);
  const linhas = retornoPorPlataforma(
    [{ plataforma: "meta", gasto: 1000 }, { plataforma: "google", gasto: 1500 }, { plataforma: "pinterest", gasto: 300 }],
    canais,
  );
  const de = (p: string) => linhas.find((l) => l.plataforma === p)!;
  confere("Google: 6 mil de venda sobre 1,5 mil de gasto volta 4 por real", de("google").retorno === 4 && de("google").custoPorPedido === 150 && de("google").situacao === "positivo");
  confere("Meta: 400 de venda sobre mil de gasto fica abaixo de 1", de("meta").retorno === 0.4 && de("meta").situacao === "prejuizo" && de("meta").custoPorPedido === 500);
  confere("Pinterest com gasto e sem venda etiquetada", de("pinterest").situacao === "sem_venda" && de("pinterest").retorno === 0 && de("pinterest").custoPorPedido === null);
  confere("TikTok com venda e sem gasto lançado não ganha retorno inventado", de("tiktok").situacao === "sem_gasto" && de("tiktok").retorno === null);
  confere("venda sem etiqueta não entra em plataforma nenhuma", linhas.reduce((s, l) => s + l.faturamento, 0) === 6650);
  confere("plataforma sem gasto e sem venda fica de fora", !linhas.some((l) => l.plataforma === "outro") && linhas.length === 4);
  confere("ordem: quem mais gastou primeiro", linhas.map((l) => l.plataforma).join() === "google,meta,pinterest,tiktok");

  const fatias = dividirPorDia(100, "2026-11-01", "2026-11-03");
  confere("100 em três dias: 33,33 + 33,33 + 33,34", fatias.map((f) => f.gasto).join() === "33.33,33.33,33.34" && fatias[2].dia === "2026-11-03");
  confere("a soma das fatias bate com o total digitado", Math.round(dividirPorDia(4321.07, "2026-10-01", "2026-10-31").reduce((s, f) => s + f.gasto, 0) * 100) === 432107);
  confere("um dia só leva o valor inteiro", dividirPorDia(250.5, "2026-11-13", "2026-11-13").length === 1 && dividirPorDia(250.5, "2026-11-13", "2026-11-13")[0].gasto === 250.5);
  confere("intervalo invertido não gera dia", dividirPorDia(10, "2026-11-13", "2026-11-12").length === 0);
  confere("virada de mês conta os dias certos", dividirPorDia(90, "2026-02-27", "2026-03-01").map((f) => f.dia).join() === "2026-02-27,2026-02-28,2026-03-01");

  const base = {
    atual: { totais: { pagos: 43, valor_pago: 26650, aguardando: 0, valor_aguardando: 0, cancelados: 0, valor_cancelado: 0 }, por_dia: [], por_hora: [], canais: [], por_pagamento: [] },
    anterior: null, dias: 30, horasDesdeALeitura: 1,
  };
  const comAnuncio = calcularSinais({ ...base, anuncios: { gasto: 2800, linhas } });
  const chavesDeAnuncio = comAnuncio.map((s) => s.chave);
  confere("plataforma abaixo de 1 vira problema", comAnuncio.some((s) => s.chave === "anuncio-abaixo-de-1-meta" && s.gravidade === "problema" && s.peso === 600));
  confere("gasto sem venda etiquetada vira problema", chavesDeAnuncio.includes("anuncio-sem-venda-pinterest"));
  confere("quem volta o dobro da segunda vira oportunidade", chavesDeAnuncio.includes("anuncio-rende-mais-google"));
  confere("com gasto lançado não pede para lançar", !chavesDeAnuncio.includes("sem-gasto-lancado"));
  const semGasto = calcularSinais({ ...base, anuncios: { gasto: 0, linhas: [] } });
  confere("sem gasto nenhum, o único sinal é o de lançar", semGasto.length === 1 && semGasto[0].chave === "sem-gasto-lancado" && semGasto[0].gravidade === "atencao");
  confere("quem não tem a área de tráfego não recebe sinal de anúncio", calcularSinais(base).length === 0);
  const pequeno = calcularSinais({ ...base, anuncios: { gasto: 80, linhas: retornoPorPlataforma([{ plataforma: "meta", gasto: 80 }], []) } });
  confere("gasto abaixo de 100 não vira sinal", pequeno.length === 0, pequeno.map((s) => s.chave).join());
  confere("nenhum sinal de anúncio com travessão", !comAnuncio.some((s) => /[\u2013\u2014]/.test(s.titulo + s.texto)));
}

console.log("\nConta de custos do mês");

{
  const despesas = [
    { tipo: "mensal" as const, categoria: "pessoal", valor: 30000, ativo: true },
    { tipo: "mensal" as const, categoria: "anuncios", valor: 15000, ativo: true },
    { tipo: "mensal" as const, categoria: "estrutura", valor: 9000, ativo: false },
    { tipo: "por_pedido" as const, categoria: "embalagem", valor: 7, ativo: true },
  ];
  const base = { despesas, hoje: "2026-11-13", diasNoMes: 30, pedidosPagos: 100 };
  const sem = contaDoMes(base);
  confere("sem gasto lançado, vale a estimativa: 13 de 30 dias de 15 mil", sem.anuncioAteHoje === 6500 && sem.anuncioReal === 0 && sem.diasSoNaEstimativa === 13);
  confere("fixo sem o anúncio e sem custo desativado", sem.fixoAteHoje === 13000 && sem.porPedidoAteHoje === 700 && sem.total === 20200);
  const com = contaDoMes({ ...base, anuncioReal: { gasto: 8000, dias: 12 } });
  confere("com gasto lançado, a estimativa não é somada junto", com.anuncioAteHoje === 8500 && com.anuncioReal === 8000 && com.anuncioEstimado === 6500);
  confere("o dia que falta entra pela estimativa por dia", com.diasComGastoReal === 12 && com.diasSoNaEstimativa === 1 && com.total === 13000 + 700 + 8500);
  const cheio = contaDoMes({ ...base, anuncioReal: { gasto: 9100, dias: 13 } });
  confere("todos os dias lançados: só o gasto de verdade", cheio.anuncioAteHoje === 9100 && cheio.diasSoNaEstimativa === 0);
  confere("leitura com zero dia não derruba a estimativa", contaDoMes({ ...base, anuncioReal: { gasto: 0, dias: 0 } }).anuncioAteHoje === 6500);
  confere("sem linha de anúncio na lista, o gasto de verdade entra sozinho", contaDoMes({ ...base, despesas: despesas.filter((d) => d.categoria !== "anuncios"), anuncioReal: { gasto: 500, dias: 12 } }).anuncioAteHoje === 500);
}

console.log("\nLeitura das APIs de anúncio");

{
  const meta = lerInsightsDoMeta([
    { date_start: "2026-11-12", date_stop: "2026-11-12", spend: "553.71", impressions: "32431", clicks: "812" },
    { date_start: "2026-11-11", date_stop: "2026-11-11", spend: "571.55", impressions: "30110" },
    { date_start: "2026-11-10", spend: "abc" },
    { spend: "10" },
    null,
  ]);
  confere("Meta: gasto em texto vira número, em ordem de dia", meta.length === 2 && meta[0].dia === "2026-11-11" && meta[0].gasto === 571.55 && meta[1].gasto === 553.71);
  confere("Meta: clique que não veio fica nulo, não zero", meta[0].cliques === null && meta[1].cliques === 812 && meta[1].impressoes === 32431);
  confere("Meta: linha sem data ou com gasto inválido é descartada", !meta.some((d) => d.dia === "2026-11-10"));

  const google = lerLotesDoGoogle([
    { results: [
      { segments: { date: "2026-11-12" }, metrics: { costMicros: "44470000", clicks: "250", impressions: "11386" } },
      { segments: { date: "2026-11-11" }, metrics: { costMicros: "62320000", clicks: "320", impressions: "12976" } },
    ] },
    { results: [{ segments: { date: "2026-11-12" }, metrics: { costMicros: "1000000", clicks: "1", impressions: "10" } }] },
    { fieldMask: "segments.date" },
  ]);
  confere("Google: micros viram reais", google.find((d) => d.dia === "2026-11-11")?.gasto === 62.32);
  confere("Google: o mesmo dia em dois lotes é somado", google.find((d) => d.dia === "2026-11-12")?.gasto === 45.47 && google.find((d) => d.dia === "2026-11-12")?.cliques === 251);
  confere("Google: lote sem resultado não quebra", google.length === 2 && lerLotesDoGoogle([]).length === 0 && lerLotesDoGoogle({}).length === 0);

  const cheio = completarDias(meta, "2026-11-09", "2026-11-13", "2026-11-13");
  confere("dia fechado sem linha vira zero", cheio.map((d) => `${d.dia.slice(8)}=${d.gasto}`).join() === "09=0,10=0,11=571.55,12=553.71");
  confere("hoje sem linha não é gravado como zero", !cheio.some((d) => d.dia === "2026-11-13"));
  const comHoje = completarDias([{ dia: "2026-11-13", gasto: 34.35, impressoes: 100, cliques: 2 }], "2026-11-13", "2026-11-13", "2026-11-13");
  confere("hoje com linha entra com o parcial", comHoje.length === 1 && comHoje[0].gasto === 34.35);
}

console.log("\nCampanha, conjunto e anúncio");

{
  const linha = (ad: string, conjunto: string, campanha: string, gasto: string, extra: Record<string, unknown> = {}) => ({
    date_start: "2026-11-12", campaign_id: campanha, campaign_name: `Campanha ${campanha}`, adset_id: conjunto, adset_name: `Conjunto ${conjunto}`,
    ad_id: ad, ad_name: `Anúncio ${ad}`, objective: "OUTCOME_SALES", spend: gasto, impressions: "1000", clicks: "30", inline_link_clicks: "20", ...extra,
  });
  const meta = lerItensDoMeta(
    [
      linha("a1", "s1", "c1", "100.50", {
        actions: [
          { action_type: "landing_page_view", value: "15" },
          { action_type: "add_to_cart", value: "4" },
          { action_type: "initiate_checkout", value: "3" },
          { action_type: "purchase", value: "2" },
          { action_type: "omni_purchase", value: "2" },
          { action_type: "offsite_conversion.fb_pixel_purchase", value: "2" },
          { action_type: "onsite_conversion.messaging_conversation_started_7d", value: "5" },
        ],
        action_values: [{ action_type: "purchase", value: "900.00" }, { action_type: "omni_purchase", value: "900.00" }],
      }),
      linha("a2", "s1", "c1", "50.25"),
      linha("a3", "s2", "c1", "10"),
      linha("a4", "s9", "c9", "0", { impressions: "0" }),
      { date_start: "2026-11-12", spend: "5" },
    ],
    new Map([["a1", "ACTIVE"], ["a2", "ADSET_PAUSED"], ["a3", "PAUSED"]]),
  );
  const achar = (nivel: string, id: string) => meta.find((l) => l.nivel === nivel && l.item_id === id)!;
  confere("Meta: a mesma compra com três nomes conta uma vez", achar("anuncio", "a1").compras === 2 && achar("anuncio", "a1").valor === 900);
  confere("Meta: funil do anúncio lido das ações", achar("anuncio", "a1").visitas === 15 && achar("anuncio", "a1").carrinhos === 4 && achar("anuncio", "a1").checkouts === 3 && achar("anuncio", "a1").conversas === 5);
  confere("Meta: conjunto é a soma dos anúncios dele", achar("conjunto", "s1").gasto === 150.75 && achar("conjunto", "s1").impressoes === 2000 && achar("conjunto", "s1").compras === 2);
  confere("Meta: campanha é a soma de tudo", achar("campanha", "c1").gasto === 160.75 && achar("campanha", "c1").cliques === 60 && achar("campanha", "c1").campanha_id === null);
  confere("Meta: só ACTIVE está veiculando, e o pai liga se um filho liga", achar("anuncio", "a1").ativo === true && achar("anuncio", "a2").ativo === false && achar("conjunto", "s1").ativo === true && achar("conjunto", "s2").ativo === false);
  confere("Meta: linha sem impressão e sem gasto fica de fora, e linha sem anúncio também", !meta.some((l) => l.item_id === "a4" || l.item_id === "c9") && meta.length === 6);
  confere("Meta: sem a lista de situação, ativo fica nulo", lerItensDoMeta([linha("a1", "s1", "c1", "1")], null).every((l) => l.ativo === null));
  confere("objetivo do Meta em palavra nossa", tipoDoMeta("OUTCOME_SALES") === "vendas" && tipoDoMeta("OUTCOME_TRAFFIC") === "trafego" && tipoDoMeta("OUTCOME_ENGAGEMENT") === "engajamento" && tipoDoMeta("MESSAGES") === "mensagens" && tipoDoMeta(undefined) === "outro");

  const m = (custo: string, conv = "0", valor = "0") => ({ costMicros: custo, impressions: "500", clicks: "40", conversions: conv, conversionsValue: valor });
  const google = lerItensDoGoogle({
    campanhas: [{ results: [
      { campaign: { id: "10", name: "Pesquisa", status: "ENABLED", advertisingChannelType: "SEARCH" }, segments: { date: "2026-11-12" }, metrics: m("30000000", "1.5", "600") },
      { campaign: { id: "20", name: "PMax", status: "PAUSED", advertisingChannelType: "PERFORMANCE_MAX" }, segments: { date: "2026-11-12" }, metrics: m("20000000") },
      { campaign: { id: "30", name: "Parada", status: "ENABLED", advertisingChannelType: "SHOPPING" }, segments: { date: "2026-11-12" }, metrics: { costMicros: "0", impressions: "0", clicks: "0" } },
    ] }],
    grupos: [{ results: [{ adGroup: { id: "11", name: "Grupo", status: "ENABLED" }, campaign: { id: "10", status: "ENABLED" }, segments: { date: "2026-11-12" }, metrics: m("30000000", "1.5", "600") }] }],
    recursos: [{ results: [{ assetGroup: { id: "21", name: "Recursos", status: "ENABLED" }, campaign: { id: "20", status: "PAUSED" }, segments: { date: "2026-11-12" }, metrics: m("20000000") }] }],
    anuncios: [{ results: [
      { adGroupAd: { status: "ENABLED", ad: { id: "111", type: "RESPONSIVE_SEARCH_AD", responsiveSearchAd: { headlines: [{ text: "Alianças de Ouro" }, { text: "JK Alianças" }, { text: "Frete Grátis" }] } } }, adGroup: { id: "11", status: "ENABLED" }, campaign: { id: "10", status: "ENABLED" }, segments: { date: "2026-11-12" }, metrics: m("30000000", "1.5", "600") },
    ] }],
  });
  const g = (nivel: string, id: string) => google.find((l) => l.nivel === nivel && l.item_id === id)!;
  confere("Google: micros viram reais e a conversão fracionada é mantida", g("campanha", "10").gasto === 30 && g("campanha", "10").compras === 1.5 && g("campanha", "10").valor === 600);
  confere("Google: tipo de canal desce da campanha para conjunto e anúncio", g("conjunto", "11").tipo === "pesquisa" && g("anuncio", "111").tipo === "pesquisa" && tipoDoGoogle("PERFORMANCE_MAX") === "pmax");
  confere("Google: grupo de recursos do Performance Max entra como conjunto", g("conjunto", "21").campanha_id === "20" && g("conjunto", "21").tipo === "pmax");
  confere("Google: conjunto de campanha pausada não está veiculando", g("conjunto", "21").ativo === false && g("campanha", "20").ativo === false && g("anuncio", "111").ativo === true);
  confere("Google: anúncio sem nome usa os dois primeiros títulos", g("anuncio", "111").nome === "Alianças de Ouro | JK Alianças");
  confere("Google: campanha sem impressão e sem gasto fica de fora", !google.some((l) => l.item_id === "30"));
  confere("Google: nível que falhou vem vazio e não derruba os outros", lerItensDoGoogle({ campanhas: [], anuncios: undefined }).length === 0);

  const item = (nivel: Item["nivel"], id: string, tipo: string, n: Partial<Item>): Item => ({
    nivel, id, nome: id, campanha_id: null, conjunto_id: null, tipo, ativo: true, gasto: 0, impressoes: 0, cliques: 0, cliques_todos: 0,
    visitas: 0, carrinhos: 0, checkouts: 0, compras: 0, valor: 0, conversas: 0, ...n,
  });
  confere("objetivo: venda, conversa, clique e engajamento pelo que a campanha declara",
    objetivoDe({ tipo: "vendas", compras: 3, conversas: 50 }) === "venda" && objetivoDe({ tipo: "vendas", compras: 0, conversas: 74 }) === "conversa" &&
    objetivoDe({ tipo: "trafego", compras: 2, conversas: 267 }) === "clique" && objetivoDe({ tipo: "engajamento", compras: 0, conversas: 138 }) === "conversa" &&
    objetivoDe({ tipo: "engajamento", compras: 0, conversas: 3 }) === "engajamento" && objetivoDe({ tipo: "pmax", compras: 0, conversas: 0 }) === "venda");

  const base = { impressoes: 100000, cliques: 1000, visitas: 800, carrinhos: 40, checkouts: 30, compras: 20, valor: 8000 };
  const d = diagnosticar(
    [
      item("campanha", "boa", "vendas", { ...base, gasto: 1000 }),
      item("campanha", "cara", "vendas", { ...base, gasto: 1800, compras: 10, valor: 4000 }),
      item("campanha", "live", "engajamento", { gasto: 500, impressoes: 90000, cliques_todos: 300 }),
      item("campanha", "perfil", "trafego", { gasto: 400, impressoes: 50000, cliques: 2000 }),
      item("conjunto", "s-bom", "vendas", { ...base, campanha_id: "cara", gasto: 300, compras: 8, valor: 3000 }),
      item("conjunto", "s-ruim", "vendas", { ...base, campanha_id: "cara", gasto: 1500, compras: 2, valor: 1000 }),
      item("anuncio", "a-zero", "vendas", { campanha_id: "cara", conjunto_id: "s-ruim", gasto: 400, impressoes: 30000, cliques: 300, visitas: 250, carrinhos: 0 }),
      item("anuncio", "a-pausado", "vendas", { campanha_id: "boa", conjunto_id: "nao-existe", gasto: 500, impressoes: 30000, cliques: 300, ativo: false }),
    ],
    "meta",
  );
  const c = (id: string) => d.campanhas.find((x) => x.id === id)!;
  // Régua de venda: 2.800 de gasto em 30 compras = 93,33 por compra.
  confere("régua da conta: custo médio por compra das campanhas de venda", Math.round(c("boa").custo! * 100) === 5000 && c("boa").veredito === "bom" && /46% abaixo/.test(c("boa").motivo), c("boa").motivo);
  confere("campanha 93% acima da média é ruim, com o número na frase", c("cara").veredito === "ruim" && /R\$\s180,00/.test(c("cara").motivo) && /93% acima/.test(c("cara").motivo), c("cara").motivo);
  confere("campanha de engajamento não ganha veredito", c("live").veredito === "sem_dado" && c("live").objetivo === "engajamento" && /não mede/.test(c("live").motivo));
  confere("campanha de tráfego é julgada pelo clique", c("perfil").objetivo === "clique" && c("perfil").resultados === 2000 && c("perfil").custo === 0.2);
  confere("a árvore monta campanha, conjunto e anúncio, do que mais gastou para o que menos", c("cara").filhos.map((f) => f.id).join() === "s-ruim,s-bom" && c("cara").filhos[0].filhos[0].id === "a-zero");
  confere("conjunto herda o objetivo e a régua da campanha", c("cara").filhos[1].veredito === "bom" && c("cara").filhos[0].veredito === "ruim");
  confere("anúncio que gastou o dobro da média sem compra é ruim", c("cara").filhos[0].filhos[0].veredito === "ruim" && /não trouxe nenhuma compra/.test(c("cara").filhos[0].filhos[0].motivo));
  confere("gargalo: chega na página e não põe no carrinho", c("cara").filhos[0].filhos[0].gargalo?.etapa === "carrinho", JSON.stringify(c("cara").filhos[0].filhos[0].gargalo));
  const rever = d.achados.filter((a) => a.tipo === "rever").map((a) => a.nome);
  const crescer = d.achados.filter((a) => a.tipo === "crescer").map((a) => a.nome);
  confere("achados: campanha ruim não repete o conjunto e o anúncio ruins dela", rever.join() === "cara", rever.join());
  confere("achados: o conjunto bom dentro da campanha ruim aparece para crescer", crescer.includes("s-bom") && crescer.includes("boa"));
  confere("achados: item pausado não vira tarefa", !d.achados.some((a) => a.nome === "a-pausado"));
  confere("funil só com campanha de venda", d.funil[0].quantidade === 200000 && d.funil.find((f) => f.etapa === "compra")?.quantidade === 30);
  confere("funil: a taxa é sobre a etapa anterior", d.funil.find((f) => f.etapa === "visita")?.taxa === 0.8 && d.funil.find((f) => f.etapa === "carrinho")?.taxa === 0.05);
  confere("a maior perda do site é dita em frase", /chegar na página e pôr no carrinho/.test(d.maiorPerda ?? "") && /5 passam/.test(d.maiorPerda ?? ""), d.maiorPerda ?? "");
  confere("verba por objetivo soma 100% e separa o que não mede venda", Math.round(d.verba.reduce((s, v) => s + v.fatia, 0) * 100) === 100 && d.verba.find((v) => v.objetivo === "engajamento")?.gasto === 500 && d.verba.find((v) => v.objetivo === "venda")?.itens === 2);
  const textos = [...d.achados.map((a) => a.texto), ...d.campanhas.map((x) => x.motivo), d.maiorPerda ?? ""].join(" ");
  confere("nenhuma frase do diagnóstico com travessão", !/[–—]/.test(textos));
  const gg = diagnosticar([item("campanha", "g1", "pesquisa", { gasto: 100, impressoes: 5000, cliques: 200, compras: 4, valor: 900 })], "google");
  confere("Google: funil de três etapas e a palavra conversão", gg.funil.length === 3 && /conversão/.test(gg.campanhas[0].motivo) && gg.maiorPerda === null);
  confere("conta sem nada não quebra", diagnosticar([], "meta").campanhas.length === 0 && diagnosticar([], "meta").achados.length === 0);
}

if (falhas > 0) {
  console.error(`\n${falhas} falha(s).`);
  process.exit(1);
}
console.log("\nTudo certo.");
