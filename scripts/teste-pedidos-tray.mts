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

if (falhas > 0) {
  console.error(`\n${falhas} falha(s).`);
  process.exit(1);
}
console.log("\nTudo certo.");
