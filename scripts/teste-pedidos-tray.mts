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
import { dividirPorDia, retornoPorPlataforma, tomDaFaixaDeVolta } from "../src/lib/trafego/retorno.ts";
import { COR_DO_TOM, tomDoCancelamento, tomDoMeioDePagamento } from "../src/lib/painel/tons.ts";
import { contaDoMes } from "../src/lib/custos/conta.ts";
import { completarDias, lerInsightsDoMeta, lerLotesDoGoogle } from "../src/lib/trafego/leitura.ts";
import { lerItensDoGoogle, lerItensDoMeta, tipoDoGoogle, tipoDoMeta } from "../src/lib/trafego/leitura-itens.ts";
import { diagnosticar, objetivoDe, type Item } from "../src/lib/trafego/diagnostico.ts";
import { juntarMeios, mapearGargalos, meioDePagamento } from "../src/lib/painel/gargalos.ts";
import { voltaParaEmpatar } from "../src/lib/painel/premissas.ts";
import { compararComOBanco, pedidoDaApi, ultimaAlteracao } from "../src/lib/vendas/tray-api.ts";
import { ehRobo, lerChegada, pedidoValido, repeteAAnterior, sessaoValida } from "../src/lib/origem/chegada.ts";
import { itensQueVenderam, passosDoColetor, vendasPorItem, type Cobertura, type SaudeDoColetor } from "../src/lib/origem/anotado.ts";
import { diaOuNulo, lerEstado, naoPegaram, prepararEdicao } from "../src/lib/loja/produto.ts";
import { TETO_DE_BYTES, codigoDaImagem, corpoDasFotos, enderecoAceito, fotosQueNaoEntraram, lerImagens, prepararFotos, type FotoNova } from "../src/lib/loja/imagens.ts";
import { achatar, ordenar, somar, tomContraAMedia, tomDaVoltaDaLoja, tomDaVoltaDaPlataforma, tomDoVeredito } from "../src/lib/trafego/linhas.ts";
import { abasDaBarra, nomeDoSetor, ondeEstou, setoresDe } from "../src/lib/painel/setores.ts";

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

console.log("\nMapa de gargalos");

{
  confere("meio de pagamento: bandeira e intermediador viram um nome só", meioDePagamento("Cartão Master") === "Cartão" && meioDePagamento("Cartão de Crédito - Appmax") === "Cartão" && meioDePagamento("Pix - Appmax") === "Pix" && meioDePagamento("Boleto - Appmax") === "Boleto" && meioDePagamento("") === "Sem informação");
  const meios = juntarMeios([
    { tipo: "Cartão Master", pedidos: 182, pagos: 113, cancelados: 69, valor_cancelado: 40000 },
    { tipo: "Cartão de Crédito - Appmax", pedidos: 214, pagos: 116, cancelados: 98, valor_cancelado: 90000 },
    { tipo: "Pix - Appmax", pedidos: 310, pagos: 227, cancelados: 83, valor_cancelado: 30000 },
    { tipo: "Boleto - Appmax", pedidos: 30, pagos: 0, cancelados: 30, valor_cancelado: 12000 },
  ]);
  confere("os cartões somam num meio só", meios.find((m) => m.nome === "Cartão")?.pedidos === 396 && meios.find((m) => m.nome === "Cartão")?.cancelados === 167 && meios[0].nome === "Cartão");
  confere("empate com margem de 30% é 3,33 por real", Math.round(voltaParaEmpatar(0.3) * 100) === 333);

  const g = mapearGargalos({
    pedidos: { pedidos: 841, pagos: 511, cancelados: 330, valor_pago: 225000, valor_cancelado: 302000 },
    faixas: [
      { faixa: 1, pedidos: 225, pagos: 148, cancelados: 77, valor_pago: 30000, valor_cancelado: 15000 },
      { faixa: 5, pedidos: 65, pagos: 9, cancelados: 56, valor_pago: 20000, valor_cancelado: 179000 },
    ],
    meios,
    repetidos: { pedidos_a_mais: 121, clientes: 93 },
    site: { entraram: 115638, viramProduto: 70148, carrinho: 1907, pagamento: 1056, pedido: 579 },
    plataformas: [
      { plataforma: "meta", nome: "Meta", gasto: 21000, valorInformado: 65000, valorPago: 11700, foraDeVenda: 0.49 },
      { plataforma: "google", nome: "Google Ads", gasto: 2400, valorInformado: 20000, valorPago: 19000, foraDeVenda: 0 },
    ],
    semEtiqueta: 110000,
    empate: voltaParaEmpatar(0.3),
  });
  const de = (chave: string) => g.find((x) => x.chave === chave);
  confere("39% de pedido não pago é grave, com os dois valores", de("pagamento")?.situacao === "grave" && /330 de 841/.test(de("pagamento")!.texto) && /39%/.test(de("pagamento")!.titulo));
  confere("pedido acima de R$ 1.500 com 86% cancelado é grave", de("pedido-caro")?.situacao === "grave" && /86%/.test(de("pedido-caro")!.titulo));
  confere("boleto sem nenhum pago é grave", de("meio-Boleto")?.situacao === "grave" && /30 pedidos e nenhum pago/.test(de("meio-Boleto")!.titulo));
  confere("cartão com 42% de recusa é grave", de("meio-cartao")?.situacao === "grave" && /42%/.test(de("meio-cartao")!.titulo));
  confere("Meta informando 5,6 vezes a venda paga é sinal grave", de("sinal-meta")?.situacao === "grave" && /5,6 vezes/.test(de("sinal-meta")!.titulo), de("sinal-meta")?.titulo);
  confere("Google batendo com a loja não vira gargalo de sinal", !de("sinal-google"));
  confere("Meta voltando 0,56 por real é grave", de("retorno-meta")?.situacao === "grave" && /R\$\s0,56/.test(de("retorno-meta")!.titulo));
  confere("Google voltando 7,92 por real aparece como indo bem", de("retorno-google")?.situacao === "ok");
  confere("49% da verba fora de venda é médio, 50% seria grave", de("objetivo-meta")?.situacao === "medio" && !de("objetivo-google"));
  confere("2,7% do produto para o carrinho é médio", de("pagina-de-produto")?.situacao === "medio" && /2,7%/.test(de("pagina-de-produto")!.texto));
  confere("45% desistindo no pagamento é médio", de("checkout")?.situacao === "medio" && /45%/.test(de("checkout")!.titulo));
  confere("tentativa repetida e venda sem origem são atenção", de("tentativa-repetida")?.situacao === "atencao" && de("sem-etiqueta")?.situacao === "atencao");
  confere("a ordem é grave, médio, atenção e depois o que vai bem", g.map((x) => x.situacao).join().replace(/(\w+)(,\1)+/g, "$1") === "grave,medio,atencao,ok");
  confere("dentro do grave, o que mais custa vem primeiro", g[0].chave === "pagamento");
  confere("nenhuma frase do mapa com travessão", !g.some((x) => /[–—]/.test(x.titulo + x.texto)));
  const vazio = mapearGargalos({ pedidos: null, faixas: [], meios: [], repetidos: null, site: null, plataformas: [], semEtiqueta: 0, empate: 3.33 });
  confere("sem dado nenhum, o mapa não inventa gargalo", vazio.length === 0);
}

if (falhas > 0) {
  console.error(`\n${falhas} falha(s).`);
  process.exit(1);
}
console.log("\nPedido lido pela API da Tray");
{
  // O formato é o do pedido completo da loja de testes, lido em 13/11/2026. Os dados são inventados.
  const cru = {
    id: "5012", date: "2026-11-12", hour: "16:20:50", modified: "2026-11-12 16:33:40", status: "A ENVIAR",
    customer_id: "77", partial_total: "1499.90", discount: "100.00", total: "1419.90", shipment: "Sedex", shipment_value: "20.00",
    shipment_date: "0000-00-00", sending_code: "", discount_coupon: "bemvindo10/100.00", payment_method: "Pix", payment_date: "2026-11-12",
    point_sale: "LOJA VIRTUAL", partner_id: "0", session_id: "abc",
    OrderStatus: { id: "3", type: "open", status: "A ENVIAR" },
    Customer: { id: "77", name: "  Maria de Teste ", email: "MARIA@EXEMPLO.COM", cpf: "00000000000", phone: "1133334444", cellphone: "(11) 98888-7777", city: "São Paulo", state: "sp" },
    Payment: [{ Payment: { method: "Pix", value: "1419.90", date: "2026-11-12" } }],
    ProductsSold: [
      { ProductsSold: { product_id: "901", name: "Aliança de teste 4 mm", reference: "AL-4", quantity: "2", price: "749.95", cost_price: "0.00", additional_information: "Aro 18 e 22" } },
    ],
  };
  const p = pedidoDaApi(cru, situacaoDoStatus);
  confere("converte número, dia e hora de São Paulo", p?.pedido === 5012 && p.dia === "2026-11-12" && p.feito_em === "2026-11-12T16:20:50-03:00");
  confere("status pago pela mesma regra do CSV", p?.status === "A ENVIAR" && p.situacao === "pago");
  confere("cliente sem CPF, com celular no formato do portal", p?.cliente_telefone === "5511988887777" && p.cliente_email === "maria@exemplo.com" && !JSON.stringify(p).includes("00000000000"));
  confere("cupom só com o código, em maiúscula", p?.cupom === "BEMVINDO10");
  confere("parceiro zero vira nulo e data zerada vira nula", p?.parceiro === null && p.envio_em === null && p.pagamento_em === "2026-11-12");
  confere("valores em número", p?.total === 1419.9 && p.subtotal === 1499.9 && p.desconto === 100 && p.frete_valor === 20 && p.valor_pago === 1419.9);
  confere("itens com o código do produto", p?.itens.length === 1 && p.itens[0].produto_tray_id === "901" && p.itens[0].quantidade === 2 && p.itens[0].preco === 749.95);
  confere("a API não traz a origem, e ela fica nula", p?.utm_source === null);
  confere("cidade e estado do cliente", p?.cidade === "São Paulo" && p.uf === "SP");
  confere("sessão da Tray só quando tem o formato dela", p?.sessao === null && pedidoDaApi({ ...cru, session_id: "2cs8g43iinqh5c5bmp7ln9nbhn" }, situacaoDoStatus)?.sessao === "2cs8g43iinqh5c5bmp7ln9nbhn");

  const cancelado = pedidoDaApi({ ...cru, id: "5013", status: "DEVOLVIDO", OrderStatus: { type: "canceled", status: "DEVOLVIDO" } }, situacaoDoStatus);
  confere("tipo cancelado vale mesmo com outro nome de status", cancelado?.situacao === "cancelado");
  const esperando = pedidoDaApi({ ...cru, id: "5014", OrderStatus: { type: "open", status: "AGUARDANDO PAGAMENTO" }, Payment: [] }, situacaoDoStatus);
  confere("aguardando pagamento continua aguardando", esperando?.situacao === "aguardando" && esperando.valor_pago === null);
  confere("pedido sem número ou sem data é recusado", pedidoDaApi({ ...cru, id: "" }, situacaoDoStatus) === null && pedidoDaApi({ ...cru, date: "0000-00-00" }, situacaoDoStatus) === null);
  confere("hora ausente não derruba o pedido", pedidoDaApi({ ...cru, hour: undefined }, situacaoDoStatus)?.feito_em === "2026-11-12T00:00:00-03:00");

  confere(
    "a última alteração é a maior da lista",
    ultimaAlteracao([{ modified: "2026-11-12 16:33:40" }, { modified: "2026-11-13 03:18:10" }, { modified: "0000-00-00 00:00:00" }, {}]) === "2026-11-13 03:18:10" && ultimaAlteracao([]) === null,
  );

  const c = compararComOBanco(
    [p!, cancelado!, esperando!, { ...p!, pedido: 5015, status: "A enviar" }],
    [
      { pedido: 5012, status: "A ENVIAR", situacao: "pago", total: 1419.9, utm_source: "google" },
      { pedido: 5013, status: "DEVOLVIDO", situacao: "pago", total: 1419.9, utm_source: null },
      { pedido: 5015, status: "A ENVIAR", situacao: "pago", total: 1400, utm_source: null },
    ],
  );
  confere("comparação: igual, só na API e diferenças por campo", c.iguais === 1 && c.soNaApi.join() === "5014" && c.diferencas.length === 3);
  confere(
    "comparação: separa o status que só muda na escrita",
    c.soDiferemNaEscrita === 1 && c.diferencas.some((d) => d.pedido === 5013 && d.campo === "situacao" && d.api === "cancelado") && c.diferencas.some((d) => d.pedido === 5015 && d.campo === "total"),
  );
}

console.log("\nChegada anotada pelo coletor");
{
  const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
  const instagram = `${iphone} Instagram 350.0.0.25.108`;
  const mac = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
  const daCasa = (h: string) => h === "jkaliancas.com.br";
  const ler = (url: string, referencia: string | null = null, agente = mac) => lerChegada({ url, referencia, agente, daCasa, canalDaEtiqueta: canalDaOrigem });
  const loja = "https://www.jkaliancas.com.br";

  const meta = ler(`${loja}/aliancas?utm_source=ig_Instagram_Reels&utm_medium=paid&utm_campaign=120214455667788990&utm_term=120214455667788991&utm_content=120214455667788992&fbclid=IwAR0abc`, "https://l.instagram.com/", instagram);
  confere("anúncio do Meta com os três códigos", meta?.canal === "meta" && meta.ids.join() === "120214455667788990,120214455667788992,120214455667788991" && meta.clique === "fbclid" && meta.nova);
  confere("página de entrada sem os parâmetros, no celular", meta?.entrada === "/aliancas" && meta.aparelho === "celular" && meta.referencia === "l.instagram.com");

  const nomeComCodigo = ler(`${loja}/?utm_source=FB&utm_campaign=Black%20alian%C3%A7as%7C120214455667788990&utm_content=Video%2003%7C120214455667788992`);
  confere("código junto do nome, separado por barra", nomeComCodigo?.ids.join() === "120214455667788990,120214455667788992" && nomeComCodigo.canal === "meta");

  const google = ler(`${loja}/alianca-ouro?gad_source=1&gad_campaignid=21987654321&gclid=Cj0KCQabc`);
  confere("Google Ads sem etiqueta nenhuma: vale o gclid e o código da campanha", google?.canal === "google_ads" && google.ids.join() === "21987654321" && google.clique === "gclid" && google.source === null);
  confere("o gclid não vira código de anúncio", ler(`${loja}/?gclid=123456789012345`)?.ids.length === 0);

  confere("variável que saiu sem trocar não é etiqueta", ler(`${loja}/?utm_source=ig&utm_campaign=%7B%7Bcampaign.id%7D%7D`)?.campaign === null);
  confere("busca do Google pelo site anterior", ler(`${loja}/guias/ouro-18k`, "https://www.google.com.br/")?.canal === "google_organico");
  confere("resposta de IA pelo site anterior", ler(`${loja}/`, "https://chatgpt.com/")?.canal === "ia");
  confere("etiqueta de IA também", ler(`${loja}/?utm_source=chatgpt.com`)?.canal === "ia");
  confere("link da bio pela etiqueta curta", ler("https://jkaliancas.com.br/bio?o=bio")?.canal === "bio");
  confere("outro site qualquer é indicação", ler(`${loja}/`, "https://blogdecasamento.com.br/post")?.canal === "indicacao");

  const doCatalogo = ler(`${loja}/loja/produto.php?loja=1305187&IdProd=901&parceiro=1516`);
  confere("link do catálogo do Instagram, sem etiqueta: vale o código de parceiro da Tray", doCatalogo?.canal === "meta" && doCatalogo.source === "catalogo_meta" && doCatalogo.nova);
  confere("Google Shopping sem clique pago é listagem gratuita", ler(`${loja}/loja/produto.php?IdProd=901&parceiro=1517`)?.canal === "google_organico");
  confere("Google Shopping com clique pago é Google Ads", ler(`${loja}/loja/produto.php?IdProd=901&parceiro=1517&gclid=Cj0abc`)?.canal === "google_ads");
  const comEtiqueta = ler(`${loja}/loja/produto.php?IdProd=901&parceiro=1516&utm_source=whatsapp`);
  confere("a etiqueta vale mais que o código de parceiro", comEtiqueta?.canal === "whatsapp" && comEtiqueta.source === "whatsapp");
  confere("parceiro desconhecido não inventa origem", ler(`${loja}/loja/produto.php?IdProd=901&parceiro=77`)?.canal === "direto");

  const interno = ler(`${loja}/carrinho`, `${loja}/alianca-ouro`);
  confere("vir de página nossa não é chegada", interno?.canal === "direto" && interno.nova === false && interno.referencia === null);
  const pagamento = ler(`${loja}/checkout/fim`, "https://www.mercadopago.com.br/checkout/v1/redirect");
  confere("voltar do pagamento não é chegada", pagamento?.canal === "direto" && pagamento.nova === false);
  const app = ler(`${loja}/`, null, instagram);
  confere("Instagram sem etiqueta e sem site anterior: reconhecido pelo aplicativo, só na primeira página", app?.canal === "meta" && app.nova === false);
  confere("endereço que não é endereço", ler("isto não é url") === null);

  confere("mesma campanha em seguida não repete", repeteAAnterior(meta!, { canal: "meta", campaign: meta!.campaign, content: meta!.content, clique_id: meta!.clique_id, haMinutos: 3 }));
  confere("outra campanha em seguida é chegada nova", !repeteAAnterior(meta!, { canal: "meta", campaign: "outra", content: null, clique_id: null, haMinutos: 3 }));
  confere("acesso direto logo depois é a mesma visita", repeteAAnterior(interno!, { canal: "meta", campaign: "x", content: null, clique_id: null, haMinutos: 10 }));
  confere("acesso direto horas depois é visita nova", !repeteAAnterior(interno!, { canal: "meta", campaign: "x", content: null, clique_id: null, haMinutos: 300 }));

  confere("robô e pedido sem navegador ficam de fora", ehRobo("Googlebot/2.1") && ehRobo("") && ehRobo("curl/8.4.0") && !ehRobo(instagram) && !ehRobo(mac));
  confere("sessão da Tray só no formato dela", sessaoValida("2cs8g43iinqh5c5bmp7ln9nbhn") !== null && sessaoValida("curta") === null && sessaoValida("tem espaço e é comprida demais") === null && sessaoValida(12) === null);
  confere("número de pedido só inteiro positivo", pedidoValido("1985") === 1985 && pedidoValido(0) === null && pedidoValido("12a") === null && pedidoValido("-3") === null);
}

console.log("\nVenda da loja por anúncio");
{
  const base = { campanha_id: null, conjunto_id: null, tipo: "vendas", ativo: true, impressoes: 1000, cliques: 50, cliques_todos: 60, visitas: 40, carrinhos: 5, checkouts: 3, compras: 2, valor: 3000, conversas: 0 };
  const arvore = diagnosticar(
    [
      { ...base, nivel: "campanha", id: "c1", nome: "Black alianças", gasto: 500 },
      { ...base, nivel: "conjunto", id: "j1", nome: "Noivos SP", campanha_id: "c1", gasto: 500 },
      { ...base, nivel: "anuncio", id: "a1", nome: "Vídeo 03", campanha_id: "c1", conjunto_id: "j1", gasto: 300 },
      { ...base, nivel: "anuncio", id: "a2", nome: "Carrossel 01", campanha_id: "c1", conjunto_id: "j1", gasto: 200, ativo: false },
    ] as Item[],
    "meta",
  );
  const vendas = vendasPorItem(
    [
      { plataforma: "meta", nivel: "anuncio", id: "a1", criados: 3, pagos: 2, valor: 1800 },
      { plataforma: "meta", nivel: "anuncio", id: "a2", criados: 2, pagos: 0, valor: 0 },
      { plataforma: "meta", nivel: "anuncio", id: "a9", criados: 1, pagos: 1, valor: 400 },
      { plataforma: "meta", nivel: "campanha", id: "c1", criados: 5, pagos: 2, valor: 1800 },
      { plataforma: "google", nivel: "campanha", id: "g1", criados: 4, pagos: 4, valor: 9000 },
    ],
    "meta",
  );
  confere("só entram os itens da plataforma pedida", Object.keys(vendas).length === 4 && !("campanha:g1" in vendas));
  const an = itensQueVenderam(arvore.campanhas, vendas, "anuncio");
  confere("ordem pelo valor pago, com o nome e o caminho", an.map((x) => x.id).join() === "a1,a9,a2" && an[0].nome === "Vídeo 03" && an[0].dentroDe === "Black alianças, Noivos SP");
  confere("volta é a venda paga da loja sobre o gasto do anúncio", an[0].volta === 6 && an[0].gasto === 300);
  confere("anúncio que vendeu sem gastar no período fica com o código", an[1].nome === "Código a9" && an[1].gasto === null && an[1].volta === null);
  confere("anúncio com pedido criado e nenhum pago aparece no fim", an[2].pagos === 0 && an[2].ativo === false);
  confere("campanha tem a própria lista", itensQueVenderam(arvore.campanhas, vendas, "campanha").map((x) => x.nome).join() === "Black alianças");

  const saudeVazia: SaudeDoColetor = { ultima_chegada: null, ultima_sessao: null, chegadas_24h: 0, chegadas_7d: 0, visitantes_7d: 0, com_codigo_de_anuncio_7d: 0, sessoes_7d: 0, pedidos_vistos_7d: 0, por_canal_7d: [] };
  const semNada = passosDoColetor(saudeVazia, null);
  confere("sem dado, nenhum passo aparece como feito", semNada.length === 4 && semNada.every((p) => !p.feito));
  const cobertura: Cobertura = { criados: 20, com_sessao: 0, ligados: 0, com_origem: 0, pagos: 12, pagos_com_origem: 0, pagos_com_anuncio: 0, valor_pago: 9000, valor_pago_com_origem: 0, valor_pago_com_anuncio: 0 };
  const soPortal = passosDoColetor({ ...saudeVazia, chegadas_7d: 340, visitantes_7d: 300 }, cobertura);
  confere("só o portal anotando: primeiro passo feito, e o último diz que depende do script na loja", soPortal[0].feito && !soPortal[1].feito && !soPortal[3].feito && soPortal[3].texto.includes("script na loja"));
  const naLoja = passosDoColetor({ ...saudeVazia, chegadas_7d: 340, visitantes_7d: 300, sessoes_7d: 15 }, cobertura);
  confere("script na loja e nenhum pedido ainda: explica os dois caminhos", !naLoja[3].feito && naLoja[3].texto.includes("página de compra") && naLoja[3].texto.includes("API de pedidos"));
  const visto = passosDoColetor({ ...saudeVazia, chegadas_7d: 340, visitantes_7d: 300, sessoes_7d: 15, pedidos_vistos_7d: 1 }, cobertura);
  confere("pedido visto na compra e ainda não importado: diz que liga na próxima importação", !visto[3].feito && visto[3].texto.startsWith("1 pedido foi visto") && visto[3].texto.includes("próxima importação"));
  const tudo = passosDoColetor({ ...saudeVazia, chegadas_7d: 900, visitantes_7d: 700, sessoes_7d: 650, com_codigo_de_anuncio_7d: 120 }, { ...cobertura, com_sessao: 18, ligados: 11 });
  confere("tudo ligado: os quatro passos feitos", tudo.every((p) => p.feito));
  confere("nenhuma frase dos passos com travessão", [...semNada, ...soPortal, ...naLoja, ...visto, ...tudo].every((p) => !/[—–]/.test(p.titulo + p.texto)));
}

console.log("\nEditar produto da loja pelo painel");
{
  // O formato é o de GET /products/:id na loja de testes, lido em 13/11/2026.
  const cru = { id: "93525", name: "Par de alianças de teste", price: "1499.90", promotional_price: "0.00", start_promotion: "0000-00-00", end_promotion: "0000-00-00", stock: "8", available: "1" };
  const atual = lerEstado(cru)!;
  confere("lê o produto da Tray no formato do painel", atual.preco === 1499.9 && atual.promocional === null && atual.promocaoDe === null && atual.estoque === 8 && atual.disponivel);
  confere("produto sem preço ou sem nome não é lido", lerEstado({ ...cru, price: "" }) === null && lerEstado({ ...cru, name: " " }) === null && lerEstado(null) === null);
  confere("data zerada e data impossível viram nulo", diaOuNulo("0000-00-00") === null && diaOuNulo("2026-02-30") === null && diaOuNulo("2026-11-27") === "2026-11-27");

  const semMudar = prepararEdicao(atual, { nome: atual.nome, estoque: 8 }, { podePreco: false });
  confere("o que não muda não vai para a Tray", semMudar.ok && semMudar.mudancas.length === 0 && Object.keys(semMudar.corpo).length === 0);

  const estoque = prepararEdicao(atual, { estoque: 3, nome: "  Par de alianças   de teste 4 mm " }, { podePreco: false });
  confere("gerente muda nome e estoque", estoque.ok && estoque.corpo.stock === 3 && estoque.corpo.name === "Par de alianças de teste 4 mm" && estoque.mudancas.length === 2);
  confere("gerente não muda preço", !prepararEdicao(atual, { preco: 1399.9 }, { podePreco: false }).ok);
  confere("gerente não cria promoção", !prepararEdicao(atual, { promocional: 999, promocaoDe: "2026-11-20", promocaoAte: "2026-11-30" }, { podePreco: false }).ok);

  const preco = prepararEdicao(atual, { preco: "1399,90" as unknown as number }, { podePreco: true });
  confere("administrador muda preço, com vírgula e duas casas", preco.ok && preco.corpo.price === "1399.90" && preco.mudancas[0].antes.includes("1.499,90") && preco.avisos.length === 0);
  const zeroAMais = prepararEdicao(atual, { preco: 14999 }, { podePreco: true });
  confere("mudança grande de preço vem com aviso", zeroAMais.ok && zeroAMais.avisos.some((a) => a.includes("sobe") && a.includes("zero")));
  confere("preço zero ou negativo é recusado", !prepararEdicao(atual, { preco: 0 }, { podePreco: true }).ok && !prepararEdicao(atual, { preco: -5 }, { podePreco: true }).ok);

  const promo = prepararEdicao(atual, { promocional: 1049.93, promocaoDe: "2026-11-20", promocaoAte: "2026-11-30" }, { podePreco: true });
  confere("promoção com as duas datas", promo.ok && promo.corpo.promotional_price === "1049.93" && promo.corpo.start_promotion === "2026-11-20" && promo.mudancas.length === 3);
  confere("promoção sem data é recusada", !prepararEdicao(atual, { promocional: 999 }, { podePreco: true }).ok);
  confere("promoção maior ou igual ao preço é recusada", !prepararEdicao(atual, { promocional: 1499.9, promocaoDe: "2026-11-20", promocaoAte: "2026-11-30" }, { podePreco: true }).ok);
  confere("promoção que termina antes de começar é recusada", !prepararEdicao(atual, { promocional: 999, promocaoDe: "2026-11-30", promocaoAte: "2026-11-20" }, { podePreco: true }).ok);
  const metade = prepararEdicao(atual, { promocional: 700, promocaoDe: "2026-11-20", promocaoAte: "2026-11-30" }, { podePreco: true });
  confere("desconto de metade ou mais vem com aviso", metade.ok && metade.avisos.some((a) => a.includes("53%")));

  const comPromo = lerEstado({ ...cru, promotional_price: "999.00", start_promotion: "2026-11-01", end_promotion: "2026-11-30" })!;
  const tirar = prepararEdicao(comPromo, { promocional: null }, { podePreco: true });
  confere("tirar a promoção leva as datas junto", tirar.ok && tirar.final.promocaoDe === null && tirar.corpo.promotional_price === "0.00" && tirar.corpo.start_promotion === "" && tirar.mudancas.length === 3);
  confere("baixar o preço abaixo da promoção é recusado", !prepararEdicao(comPromo, { preco: 900 }, { podePreco: true }).ok);

  const sair = prepararEdicao(atual, { disponivel: false }, { podePreco: false });
  confere("tirar da venda avisa que sai da vitrine", sair.ok && sair.corpo.available === 0 && sair.avisos.some((a) => a.includes("vitrine")));
  const zerado = prepararEdicao(atual, { estoque: 0 }, { podePreco: false });
  confere("disponível com estoque zero vem com aviso", zerado.ok && zerado.avisos.some((a) => a.includes("estoque zero")));
  confere("estoque quebrado ou negativo é recusado", !prepararEdicao(atual, { estoque: 2.5 }, { podePreco: false }).ok && !prepararEdicao(atual, { estoque: -1 }, { podePreco: false }).ok);
  confere("nome curto demais é recusado", !prepararEdicao(atual, { nome: "ab" }, { podePreco: false }).ok);

  confere("confere o que a Tray gravou de verdade", preco.ok && naoPegaram(preco.final, { ...preco.final, preco: 1499.9 }, ["preco"]).join() === "preco" && naoPegaram(preco.final, preco.final, ["preco"]).length === 0);
  const frases = [estoque, preco, zeroAMais, promo, metade, tirar, sair, zerado].flatMap((r) => (r.ok ? [...r.avisos, ...r.mudancas.map((m) => m.antes + m.depois)] : [r.erro]));
  confere("nenhuma frase com travessão", frases.every((f) => !/[—–]/.test(f)));
}

console.log("\nFotos do produto na loja");
{
  const tray = (posicao: number, md5: string) => `https://images.tcdn.com.br/img/img_prod/1501140/produto_de_teste_93525_${posicao}_${md5}.jpg`;
  const A = "a".repeat(32), B = "b".repeat(32), C = "c".repeat(32), N1 = "1".repeat(32), N2 = "2".repeat(32), N3 = "3".repeat(32);
  const cru = { ProductImage: [A, B, C, "d".repeat(32)].map((m, i) => ({ http: tray(i + 1, m).replace("https:", "http:"), https: tray(i + 1, m), thumbs: { "90": { https: `${tray(i + 1, m)}?90` }, "180": { https: `${tray(i + 1, m)}?180` } } })) };
  const atuais = lerImagens(cru);
  confere("lê as fotos da loja na ordem, com a miniatura de 180", atuais.length === 4 && atuais[0].url === tray(1, A) && atuais[0].miniatura.endsWith("?180"));
  confere("produto sem foto e resposta sem a lista viram fila vazia", lerImagens({}).length === 0 && lerImagens(null).length === 0 && lerImagens({ ProductImage: [{}] }).length === 0);
  confere("o código no fim do nome é o MD5 do arquivo", codigoDaImagem(tray(1, A)) === A && codigoDaImagem("https://x.supabase.co/foto.jpg") === null && codigoDaImagem(null) === null);

  const base = "https://jtteytvzxplnpqgzmqdq.supabase.co/storage/v1/object/public/media/produtos/1637/";
  const foto = (tipo: FotoNova["tipo"], md5: string | null, bytes: number | null = 400_000): FotoNova => ({ id: `f-${tipo}`, tipo, url: `${base}alianca-${tipo}-1.jpg`, caminho: `produtos/1637/alianca-${tipo}-1.jpg`, bytes, largura: 2000, altura: 2000, md5 });

  const tres = prepararFotos(atuais, [foto("uso", N3), foto("produto", N1), foto("face", N2)]);
  confere("três fotos novas entram nas posições 1, 2 e 3, nessa ordem", tres.ok && tres.trocas.map((t) => `${t.tipo}:${t.ficaEm}`).join() === "produto:1,face:2,uso:3");
  confere("cada troca diz a foto que sai da loja", tres.ok && tres.trocas[0].antes?.url === tray(1, A) && tres.trocas[2].antes?.url === tray(3, C));
  confere("o aviso conta quantas fotos saem", tres.ok && tres.avisos.some((a) => a.startsWith("As 3 fotos")));
  confere("o corpo usa a posição pedida", tres.ok && Object.keys(corpoDasFotos(tres.trocas)).join() === "picture_source_1,picture_source_2,picture_source_3");

  const semFoto = prepararFotos([], [foto("uso", N3), foto("face", N2)]);
  confere("produto sem foto: as novas entram na fila pela ordem, e não na posição pedida", semFoto.ok && semFoto.trocas.map((t) => `${t.tipo}:${t.ficaEm}`).join() === "face:1,uso:2" && semFoto.trocas.every((t) => t.antes === null));
  confere("avisa quando a foto que não é de produto vira a principal", semFoto.ok && semFoto.avisos.some((a) => a.includes("face vira a foto principal")));
  const umaSo = prepararFotos(atuais.slice(0, 1), [foto("produto", N1), foto("uso", N3)]);
  confere("produto com uma foto: produto troca a 1 e uso entra na 2", umaSo.ok && umaSo.trocas.map((t) => `${t.tipo}:${t.ficaEm}:${t.antes ? "troca" : "acrescenta"}`).join() === "produto:1:troca,uso:2:acrescenta" && umaSo.avisos.some((a) => a.includes("entra na posição 2, e não na 3")));

  const repetida = prepararFotos(atuais, [foto("produto", A), foto("face", N2)]);
  confere("foto que a loja já mostra naquele lugar não vai de novo", repetida.ok && repetida.trocas[0].jaEsta && !repetida.trocas[1].jaEsta && Object.keys(corpoDasFotos(repetida.trocas)).join() === "picture_source_2");
  confere("a foto que já está não conta como foto que sai", repetida.ok && repetida.avisos.some((a) => a.startsWith("A foto que a loja mostra hoje nessa posição sai")) && repetida.avisos.some((a) => a.includes("só recebe a baixa")));

  const grande = prepararFotos(atuais, [foto("face", N2, TETO_DE_BYTES + 1), foto("uso", N3, TETO_DE_BYTES)]);
  confere("foto acima do teto vai em cópia leve, e a pessoa é avisada", grande.ok && grande.trocas[0].reduzir && !grande.trocas[1].reduzir && grande.avisos.some((a) => a.includes("cópia mais leve")));
  confere("sem saber o tamanho, o servidor confere antes de mandar", (() => { const r = prepararFotos(atuais, [foto("uso", N3, null)]); return r.ok && r.trocas[0].reduzir; })());
  confere("duas do mesmo tipo: vale a primeira, que é a mais nova", (() => { const r = prepararFotos(atuais, [foto("face", N2), { ...foto("face", N3), id: "velha" }]); return r.ok && r.trocas.length === 1 && r.trocas[0].fotoId === "f-face"; })());
  confere("sem foto aprovada não há o que levar", !prepararFotos(atuais, []).ok);
  confere("foto maior que 2000 px é recusada antes de ir", !prepararFotos(atuais, [{ ...foto("uso", N3), largura: 2400 }]).ok);
  confere("endereço com espaço, acento ou sem extensão de imagem é recusado", enderecoAceito(`${base}alianca-uso-1.jpg`) && !enderecoAceito(`${base}aliança uso.jpg`) && !enderecoAceito(`${base}foto.webp`) && !enderecoAceito("http://x.com/a.jpg") && !prepararFotos(atuais, [{ ...foto("uso", N3), url: `${base}aliança.jpg` }]).ok);

  if (tres.ok) {
    const depoisCerto = lerImagens({ ProductImage: [N1, N2, N3, "d".repeat(32)].map((m, i) => ({ https: tray(i + 1, m) })) });
    confere("entrou quando o arquivo no lugar tem o MD5 da foto", fotosQueNaoEntraram(atuais, depoisCerto, tres.trocas).length === 0);
    const faltaUma = lerImagens({ ProductImage: [N1, B, N3, "d".repeat(32)].map((m, i) => ({ https: tray(i + 1, m) })) });
    confere("a foto que a Tray descartou em silêncio aparece como pendente", fotosQueNaoEntraram(atuais, faltaUma, tres.trocas).map((t) => t.tipo).join() === "face");
    const outraNoLugar = lerImagens({ ProductImage: ["e".repeat(32), N2, N3].map((m, i) => ({ https: tray(i + 1, m) })) });
    confere("endereço que mudou para OUTRA foto não conta como entrada", fotosQueNaoEntraram(atuais, outraNoLugar, tres.trocas).map((t) => t.tipo).join() === "produto");
    confere("fila que encolheu deixa a foto do fim como pendente", fotosQueNaoEntraram(atuais, depoisCerto.slice(0, 2), tres.trocas).map((t) => t.tipo).join() === "uso");
  }
  const semMd5 = prepararFotos(atuais, [foto("produto", null)]);
  if (semMd5.ok) {
    confere("sem MD5 vale a prova mais fraca: o endereço do lugar mudou", fotosQueNaoEntraram(atuais, atuais, semMd5.trocas).length === 1 && fotosQueNaoEntraram(atuais, lerImagens({ ProductImage: [{ https: tray(1, N1) }] }), semMd5.trocas).length === 0);
  }
  const frases = [tres, semFoto, umaSo, repetida, grande, prepararFotos(atuais, [])].flatMap((r) => (r.ok ? r.avisos : [r.erro]));
  confere("nenhuma frase das fotos com travessão", frases.every((f) => !/[—–]/.test(f)));
}

console.log("\nTabela de campanhas e anúncios");
{
  const base = { campanha_id: null, conjunto_id: null, tipo: "vendas", ativo: true, cliques_todos: null, conversas: null } as const;
  const itens: Item[] = [
    { ...base, nivel: "campanha", id: "c1", nome: "Prata", gasto: 1000, impressoes: 50000, cliques: 1000, visitas: 800, carrinhos: 120, checkouts: 50, compras: 20, valor: 6000 },
    { ...base, nivel: "campanha", id: "c2", nome: "Ouro", gasto: 1000, impressoes: 40000, cliques: 600, visitas: 500, carrinhos: 30, checkouts: 10, compras: 2, valor: 900 },
    { ...base, nivel: "conjunto", id: "s1", nome: "Mulheres", campanha_id: "c1", gasto: 1000, impressoes: 50000, cliques: 1000, visitas: 800, carrinhos: 120, checkouts: 50, compras: 20, valor: 6000 },
    { ...base, nivel: "anuncio", id: "a1", nome: "Carrossel", campanha_id: "c1", conjunto_id: "s1", gasto: 700, impressoes: 30000, cliques: 700, visitas: 560, carrinhos: 90, checkouts: 40, compras: 16, valor: 4800 },
    { ...base, nivel: "anuncio", id: "a2", nome: "Vídeo", campanha_id: "c1", conjunto_id: "s1", ativo: false, gasto: 300, impressoes: 20000, cliques: 300, visitas: 240, carrinhos: 30, checkouts: 10, compras: 4, valor: 1200 },
  ];
  const d = diagnosticar(itens, "meta");
  const linhas = achatar(d.campanhas, { "campanha:c1": { criados: 10, pagos: 8, valor: 4000 }, "anuncio:a1": { criados: 6, pagos: 5, valor: 2800 } });

  confere("a árvore vira uma linha por item, nos três níveis", linhas.length === 5 && linhas.filter((l) => l.nivel === "anuncio").length === 2);
  const a1 = linhas.find((l) => l.id === "a1")!;
  confere("o anúncio sabe em que campanha e conjunto está", a1.campanha === "Prata" && a1.conjunto === "Mulheres" && a1.campanhaId === "c1" && a1.conjuntoId === "s1");
  confere("a venda paga da loja entra na linha, com a volta por real", a1.loja?.pagos === 5 && a1.voltaDaLoja === 4);
  confere("item sem pedido ligado fica sem volta da loja, não com zero", linhas.find((l) => l.id === "a2")!.voltaDaLoja === null);
  confere("a campanha conta os conjuntos que tem", linhas.find((l) => l.id === "c1")!.filhos === 1 && a1.filhos === 0);

  const empate = voltaParaEmpatar();
  confere("volta da loja: verde do empate para cima", tomDaVoltaDaLoja(empate, empate) === "bom" && tomDaVoltaDaLoja(5, empate) === "bom");
  confere("volta da loja: vermelha abaixo de 1", tomDaVoltaDaLoja(0.99, empate) === "ruim" && tomDaVoltaDaLoja(0, empate) === "ruim");
  confere("volta da loja: âmbar entre 1 e o empate", tomDaVoltaDaLoja(1, empate) === "atencao" && tomDaVoltaDaLoja(3.2, empate) === "atencao");
  confere("volta da loja: sem dado não ganha cor", tomDaVoltaDaLoja(null, empate) === "neutro");
  confere("volta da plataforma: compara com a média da conta", tomContraAMedia(6, 4, 0.2) === "bom" && tomContraAMedia(2, 4, 0.2) === "ruim" && tomContraAMedia(4.5, 4, 0.2) === "neutro");
  confere("volta da plataforma: item pequeno demais fica sem cor", tomContraAMedia(9, 4, 0.001) === "neutro" && tomContraAMedia(9, null, 0.2) === "neutro");
  confere("volta da plataforma: só campanha de venda ganha cor", tomDaVoltaDaPlataforma({ objetivo: "venda", retorno: 1, gasto: 500 }, 4, 1000) === "ruim" && tomDaVoltaDaPlataforma({ objetivo: "clique", retorno: 0.15, gasto: 500 }, 4, 1000) === "neutro" && tomDaVoltaDaPlataforma({ objetivo: "conversa", retorno: 9, gasto: 500 }, 4, 1000) === "neutro");
  confere("veredito sem opinião não pinta", tomDoVeredito("na_media") === "neutro" && tomDoVeredito("sem_dado") === "neutro" && tomDoVeredito("ruim") === "ruim");

  const anuncios = linhas.filter((l) => l.nivel === "anuncio");
  confere("ordena pelo gasto, maior primeiro", ordenar(anuncios, "gasto", "desc")[0].id === "a1" && ordenar(anuncios, "gasto", "asc")[0].id === "a2");
  confere("linha sem valor na coluna vai para o fim nos dois sentidos", ordenar(anuncios, "voltaDaLoja", "desc")[1].id === "a2" && ordenar(anuncios, "voltaDaLoja", "asc")[1].id === "a2");
  confere("ordenar não mexe na lista original", anuncios[0].id === "a1" && ordenar(anuncios, "nome", "desc")[0].id === "a2" && anuncios[0].id === "a1");
  const t = somar(linhas.filter((l) => l.nivel === "campanha"));
  confere("o total soma gasto, compras e a venda da loja", t.itens === 2 && t.gasto === 2000 && t.compras === 22 && t.valor === 6900 && t.lojaValor === 4000 && t.lojaPagos === 8);
}

console.log("\nCores de estado do painel");
{
  confere("cancelamento do período: de 30% para cima é ruim, como nos sinais", tomDoCancelamento(30, 100) === "ruim" && tomDoCancelamento(57, 167) === "ruim");
  confere("cancelamento do período: entre 20% e 30% é atenção", tomDoCancelamento(22, 100) === "atencao");
  confere("cancelamento do período: abaixo de 20% não ganha cor", tomDoCancelamento(19, 100) === "neutro" && tomDoCancelamento(0, 50) === "neutro");
  confere("cancelamento do período: com menos de 20 pedidos não há cor", tomDoCancelamento(10, 19) === "neutro" && tomDoCancelamento(10, 20) === "ruim");
  confere("meio de pagamento: de 80% para cima é ruim (boleto 7 de 7)", tomDoMeioDePagamento(7, 7) === "ruim" && tomDoMeioDePagamento(8, 10) === "ruim");
  confere("meio de pagamento: de 30% para cima é atenção (cartão 34 de 93)", tomDoMeioDePagamento(34, 93) === "atencao" && tomDoMeioDePagamento(3, 10) === "atencao");
  confere("meio de pagamento: Pix com 22% não ganha cor", tomDoMeioDePagamento(15, 67) === "neutro");
  confere("meio de pagamento: 1 de 1 cancelado não quer dizer nada", tomDoMeioDePagamento(1, 1) === "neutro" && tomDoMeioDePagamento(4, 4) === "neutro");

  const empate = voltaParaEmpatar();
  const real = tomDaFaixaDeVolta(1.58, 4.04, empate);
  confere("faixa de volta: verdade no meio da faixa não ganha cor", real.minimo === "neutro" && real.maximo === "neutro");
  confere("faixa de volta: até o mínimo passa do empate, verde", tomDaFaixaDeVolta(3.5, 6, empate).minimo === "bom" && tomDaFaixaDeVolta(empate, 6, empate).minimo === "bom");
  confere("faixa de volta: nem o máximo chega a 1, vermelho", tomDaFaixaDeVolta(0.2, 0.9, empate).maximo === "ruim" && tomDaFaixaDeVolta(0.2, 0.9, empate).minimo === "neutro");
  confere("faixa de volta: nem o máximo chega ao empate, âmbar", tomDaFaixaDeVolta(0.7, 2.5, empate).maximo === "atencao");
  confere("faixa de volta: sem gasto não há cor", tomDaFaixaDeVolta(null, null, empate).minimo === "neutro" && tomDaFaixaDeVolta(null, null, empate).maximo === "neutro");
  confere("cada tom tem texto e fundo, e o neutro é branco", ["bom", "atencao", "ruim"].every((t) => /^#[0-9a-f]{6}$/.test(COR_DO_TOM[t as "bom"].texto) && /^#[0-9a-f]{6}$/.test(COR_DO_TOM[t as "bom"].fundo)) && COR_DO_TOM.neutro.fundo === "#fff");
}

console.log("\nSetores do painel");
{
  const tudo = setoresDe(["conteudo", "site", "catalogo", "campanhas", "vendas", "recuperacao", "metricas", "anuncios", "margem", "custos", "equipe", "lancar_venda", "trafego", "loja"]);
  confere("quem tem tudo vê os sete setores", tudo.length === 7 && tudo[0].id === "diretoria");
  const emCampanhas = ondeEstou(tudo, "/admin/trafego/campanhas");
  confere("vale o endereço mais comprido: campanhas não acende o resumo do tráfego", emCampanhas.setor?.id === "trafego" && emCampanhas.item?.href === "/admin/trafego/campanhas");
  confere("tela de dentro acende a tela mãe", ondeEstou(tudo, "/admin/conteudos/abc-123").item?.href === "/admin/conteudos" && ondeEstou(tudo, "/admin/qrcode/novo").setor?.id === "site");
  confere("a visão geral só acende no endereço exato", ondeEstou(tudo, "/admin").item?.href === "/admin" && ondeEstou(tudo, "/admin/senha").item === null);
  confere("endereço parecido não casa por engano", ondeEstou(tudo, "/admin/vendasx").item === null);
  confere("com três setores ou mais, a barra de baixo é por setor", abasDaBarra(tudo).length === 4 && abasDaBarra(tudo)[0].label === "Início" && abasDaBarra(tudo)[1].href === "/admin/vendas");

  const vendedor = setoresDe(["lancar_venda", "recuperacao"]);
  confere("o vendedor só vê o início e as vendas, e a primeira sala se chama Início", vendedor.length === 2 && nomeDoSetor(vendedor[0]) === "Início" && vendedor[1].itens.length === 2);
  confere("com menos de três setores, a barra de baixo é por tela", abasDaBarra(vendedor).map((a) => a.href).join() === "/admin,/admin/registrar-venda,/admin/recuperacao");
  confere("a primeira tela de vendas do vendedor é registrar", vendedor[1].itens[0].href === "/admin/registrar-venda");
  confere("setor sem nenhuma tela some", setoresDe([]).length === 1 && setoresDe(["equipe"]).some((s) => s.id === "sistema") && !setoresDe(["equipe"]).some((s) => s.id === "loja"));
  const frases = tudo.flatMap((s) => [s.nome, s.frase, ...s.itens.flatMap((i) => [i.label, i.desc, i.curto ?? ""])]);
  confere("nenhum nome de setor ou tela com travessão", frases.every((f) => !/[—–]/.test(f)));
}

console.log("\nTudo certo.");
