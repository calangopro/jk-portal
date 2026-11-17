/**
 * Confere a conta das conversões do Google Ads (0135): quais pedidos entram,
 * o corpo de cada chamada, as datas e a leitura das respostas. Roda sem banco
 * e sem rede:
 *   npm run verificar:google
 *
 * Os pedidos daqui são INVENTADOS, só com a forma dos de verdade. As respostas
 * do Google seguem a forma da documentação (Google Ads API v26 e Data Manager
 * API v1), não foram copiadas de resposta real.
 */
import {
  CONFIG_PADRAO, PRAZOS, classificarCompraPaga, classificarErroGeral, classificarRetirada, cliqueValido, corpoDaCompraPaga,
  corpoDaRetirada, dataHoraDoGoogleAds, dataHoraRfc3339, decidirCompraPaga, decidirRetirada, emailNormalizado, erroGeral,
  eventoDaCompraPaga, falhasDaRetirada, frase, gravacaoDaResposta, identificadoresDoCliente, lerCandidato, lerConfig,
  lerLinhaDaFila, momentoDoPagamento, montarPrevia, proximaTentativa, semDadosDoCliente, sha256, situacaoDoDataManager,
  situacaoDoStatusDaTray, telefoneE164, valorDoPedido, violacoesDoDataManager, type Candidato, type Config,
} from "../src/lib/google-ads/conversoes.ts";
import { situacaoDoStatus } from "../src/lib/vendas/tray-csv.ts";
import { ROTINAS } from "../src/lib/painel/saude.ts";

let falhas = 0;
function confere(nome: string, ok: boolean, detalhe = "") {
  if (ok) console.log(`  ok  ${nome}`);
  else {
    falhas++;
    console.log(`  FALHOU  ${nome}${detalhe ? `: ${detalhe}` : ""}`);
  }
}

const HORA = 3_600_000;
const DIA = 24 * HORA;
const agora = new Date("2026-12-01T13:00:00Z"); // 10h de São Paulo, o dia de ligar
const ha = (ms: number) => new Date(agora.getTime() - ms).toISOString();
const ligado: Config = { ...CONFIG_PADRAO, ligado: true, validar: false, acaoCompraPaga: "1234567890" };

const pedido = (extra: Partial<Candidato> = {}): Candidato => ({
  pedido: 12001,
  feitoEm: ha(3 * DIA),
  dia: ha(3 * DIA).slice(0, 10),
  situacao: "cancelado",
  status: "CANCELADO AUT",
  statusAnterior: null,
  statusMudouEm: null,
  total: 899.9,
  valorPago: null,
  pagamentoEm: null,
  email: null,
  telefone: null,
  clique: null,
  cliqueId: null,
  cliqueEm: null,
  ...extra,
});

const GCLID = "Cj0KCQiA_inventado-123456";

console.log("O interruptor");
{
  const c = lerConfig(undefined);
  confere("sem valor gravado: desligado e em validação", !c.ligado && c.validar && !c.dadosDoCliente);
  confere("a ação da etiqueta é a do GTM", c.acaoDaEtiqueta === "7575406236");
  confere("a ação da compra paga começa vazia", c.acaoCompraPaga === null);
  confere('"sim" não liga, só true', !lerConfig({ ligado: "sim" }).ligado && lerConfig({ ligado: true }).ligado);
  confere("validação só desliga com false por extenso", lerConfig({ validar: 0 }).validar && !lerConfig({ validar: false }).validar);
  confere("número da ação aceita texto e número", lerConfig({ acao_compra_paga: 987654321 }).acaoCompraPaga === "987654321" && lerConfig({ acao_compra_paga: " 987654321 " }).acaoCompraPaga === "987654321");
  confere("ação com letra é recusada", lerConfig({ acao_compra_paga: "AW-123" }).acaoCompraPaga === null);
  confere("dia de corte mal escrito volta ao padrão", lerConfig({ retirar_desde: "26/09/2026" }).retirarDesde === "2026-09-26");
  confere("pedido sem clique só vale com dados do cliente", !lerConfig({ pedidos_sem_clique: true }).pedidosSemClique && lerConfig({ pedidos_sem_clique: true, dados_do_cliente: true }).pedidosSemClique);
}

console.log("A situação do status, igual à da importação");
{
  const status = ["A ENVIAR", "FINALIZADO", "CANCELADO", "CANCELADO AUT", "Cancelado pelo cliente", "AGUARDANDO PAGAMENTO", "Aguardando pagamento ", "ENVIADO", "PROBLEMAS NA ENTREGA", "Pagamento Aprovado"];
  const diferentes = status.filter((s) => situacaoDoStatusDaTray(s) !== situacaoDoStatus(s));
  confere("as duas regras dizem o mesmo", diferentes.length === 0, diferentes.join(", "));
}

console.log("Ler o que o banco devolve");
{
  const c = lerCandidato({ pedido: "11735", feito_em: "2026-11-16T14:00:00+00:00", situacao: "pago", total: "254.90", valor_pago: "254.9", clique: "gclid", clique_id: GCLID, clique_em: "2026-11-16T12:00:00+00:00", pagamento_em: "2026-11-16" });
  confere("lê o pedido", c !== null && c.pedido === 11735 && c.total === 254.9 && c.clique === "gclid" && c.pagamentoEm === "2026-11-16");
  confere("clique do Meta não vira clique do Google", lerCandidato({ pedido: 1, feito_em: "2026-11-16T14:00:00Z", situacao: "pago", clique: "fbclid" })?.clique === null);
  confere("pedido sem número não entra", lerCandidato({ feito_em: "2026-11-16T14:00:00Z", situacao: "pago" }) === null);
  const l = lerLinhaDaFila({ id: 3, pedido: 11735, tipo: "compra_paga", pedido_em: "2026-11-16T14:00:00Z", momento: "2026-11-16T14:05:00Z", valor: "254.90", clique: "gbraid", clique_id: GCLID, com_cliente: true, tentativas: 2 });
  confere("lê a linha da fila", l !== null && l.valor === 254.9 && l.clique === "gbraid" && l.com_cliente && l.tentativas === 2);
  confere("linha de tipo desconhecido não entra", lerLinhaDaFila({ id: 3, pedido: 1, tipo: "compra", pedido_em: "2026-11-16T14:00:00Z", momento: "2026-11-16T14:00:00Z" }) === null);
}

console.log("Retirada: quais pedidos entram");
{
  const d = decidirRetirada(pedido(), ligado, agora);
  confere("cancelado de 3 dias entra e sai agora", d.entra && Date.parse(d.linha.proxima_em) <= agora.getTime(), JSON.stringify(d));
  confere("a retirada não leva valor nem clique", d.entra && d.linha.valor === null && d.linha.clique === null);

  const novo = decidirRetirada(pedido({ feitoEm: ha(3 * HORA) }), ligado, agora);
  confere("cancelado de 3 horas espera 25 horas desde o pedido", novo.entra && novo.linha.proxima_em === new Date(agora.getTime() - 3 * HORA + 25 * HORA).toISOString());

  const recem = decidirRetirada(pedido({ feitoEm: ha(5 * DIA), statusAnterior: "AGUARDANDO PAGAMENTO", statusMudouEm: ha(2 * HORA) }), ligado, agora);
  confere("cancelado há 2 horas espera 6 horas desde o cancelamento", recem.entra && recem.linha.proxima_em === new Date(agora.getTime() + 4 * HORA).toISOString());
  confere("o ajuste leva o instante do cancelamento", recem.entra && recem.linha.momento === ha(2 * HORA));

  const sem = decidirRetirada(pedido({ feitoEm: ha(5 * DIA) }), ligado, agora);
  confere("sem o instante do cancelamento, o ajuste leva o de agora", sem.entra && sem.linha.momento === agora.toISOString());

  const torto = decidirRetirada(pedido({ feitoEm: ha(5 * DIA), statusAnterior: "AGUARDANDO PAGAMENTO", statusMudouEm: ha(6 * DIA) }), ligado, agora);
  confere("cancelamento anotado antes do pedido não põe o ajuste antes da compra", torto.entra && Date.parse(torto.linha.momento) >= Date.parse(ha(5 * DIA)) + 60_000);

  const estorno = decidirRetirada(pedido({ status: "CANCELADO", pagamentoEm: "2026-11-20", valorPago: 899.9 }), ligado, agora);
  confere("pago e depois cancelado (estorno) não se retira", !estorno.entra && estorno.motivo === "teve_pagamento");
  const soValor = decidirRetirada(pedido({ valorPago: 10 }), ligado, agora);
  confere("qualquer valor pago também barra", !soValor.entra && soValor.motivo === "teve_pagamento");
  const pago = decidirRetirada(pedido({ situacao: "pago", status: "A ENVIAR" }), ligado, agora);
  confere("pedido pago não se retira", !pago.entra && pago.motivo === "nao_cancelado");
  const aguardando = decidirRetirada(pedido({ situacao: "aguardando", status: "AGUARDANDO PAGAMENTO" }), ligado, agora);
  confere("aguardando pagamento ainda não se retira", !aguardando.entra);

  const velho = decidirRetirada(pedido({ feitoEm: ha(54 * DIA) }), ligado, agora);
  confere("com mais de 53 dias fica fora do prazo", !velho.entra && velho.motivo === "fora_do_prazo");
  const limite = decidirRetirada(pedido({ feitoEm: ha(53 * DIA - HORA) }), ligado, agora);
  confere("com 53 dias ainda entra", limite.entra);
  const antes = decidirRetirada(pedido({ feitoEm: "2026-09-26T02:59:00Z" }), { ...ligado }, new Date("2026-10-20T12:00:00Z"));
  confere("o dia de corte é o de São Paulo (25/09 às 23h59 fica de fora)", !antes.entra && antes.motivo === "antes_do_corte");
  const noCorte = decidirRetirada(pedido({ feitoEm: "2026-09-26T03:00:00Z" }), { ...ligado }, new Date("2026-10-20T12:00:00Z"));
  confere("26/09 à meia-noite de São Paulo entra", noCorte.entra);
  confere("peça desligada não entra", !decidirRetirada(pedido(), { ...ligado, retirada: false }, agora).entra);

  // A trava, por força bruta: nenhuma combinação com sinal de pagamento passa.
  let passou = 0;
  for (const situacao of ["pago", "cancelado", "aguardando"])
    for (const pagamentoEm of [null, "2026-11-28"])
      for (const valorPago of [null, 0, 0.01, 500])
        for (const status of ["A ENVIAR", "CANCELADO", "CANCELADO AUT", "FINALIZADO"]) {
          const d2 = decidirRetirada(pedido({ situacao, pagamentoEm, valorPago, status }), ligado, agora);
          if (d2.entra && (situacao !== "cancelado" || pagamentoEm !== null || (valorPago ?? 0) > 0)) passou++;
        }
  confere("nenhum pedido com sinal de pagamento entra na retirada (96 combinações)", passou === 0, `${passou} passaram`);
}

console.log("Compra paga: quais pedidos entram");
{
  const base = { situacao: "pago", status: "A ENVIAR", feitoEm: ha(2 * DIA), pagamentoEm: ha(2 * DIA).slice(0, 10), valorPago: 899.9, clique: "gclid" as const, cliqueId: GCLID, cliqueEm: ha(2 * DIA + HORA) };
  const d = decidirCompraPaga(pedido(base), ligado, agora);
  confere("pago com gclid de 2 dias entra e sai agora", d.entra && Date.parse(d.linha.proxima_em) <= agora.getTime() && d.linha.clique_id === GCLID);
  confere("leva o valor pago, BRL", d.entra && d.linha.valor === 899.9 && d.linha.moeda === "BRL");
  confere("a hora da compra é a do pedido (cartão aprovado na hora)", d.entra && d.linha.momento === ha(2 * DIA));

  const recente = decidirCompraPaga(pedido({ ...base, feitoEm: ha(2 * HORA), cliqueEm: ha(3 * HORA) }), ligado, agora);
  confere("clique de 3 horas espera 7 horas desde o clique", recente.entra && recente.linha.proxima_em === new Date(agora.getTime() + 4 * HORA).toISOString());

  const depois = decidirCompraPaga(pedido({ ...base, cliqueEm: ha(2 * DIA - 10 * 60_000) }), ligado, agora);
  confere("clique anotado depois do pedido põe a compra um minuto depois do clique", depois.entra && depois.linha.momento === new Date(Date.parse(ha(2 * DIA - 10 * 60_000)) + 60_000).toISOString());

  const pix = pedido({ ...base, statusAnterior: "AGUARDANDO PAGAMENTO", statusMudouEm: ha(DIA) });
  confere("Pix pago depois: vale o instante da troca de status", momentoDoPagamento(pix) === Date.parse(ha(DIA)));
  const enviado = pedido({ ...base, statusAnterior: "A ENVIAR", status: "ENVIADO", statusMudouEm: ha(HORA) });
  confere("troca de A ENVIAR para ENVIADO não é pagamento", momentoDoPagamento(enviado) === Date.parse(ha(2 * DIA)));
  const outroDia = pedido({ ...base, feitoEm: "2026-11-28T23:00:00Z", pagamentoEm: "2026-11-30" });
  confere("pago em outro dia, sem a troca anotada: meio-dia do dia do pagamento", momentoDoPagamento(outroDia) === Date.parse("2026-11-30T15:00:00Z"));

  confere("sem valor pago, vale o total", valorDoPedido(pedido({ total: 479.8, valorPago: 0 })) === 479.8);
  const semClique = decidirCompraPaga(pedido({ ...base, clique: null, cliqueId: null, cliqueEm: null }), ligado, agora);
  confere("pago sem clique do Google fica de fora", !semClique.entra && semClique.motivo === "sem_clique_do_google");
  const comDados = { ...ligado, dadosDoCliente: true, pedidosSemClique: true };
  const otimizada = decidirCompraPaga(pedido({ ...base, clique: null, cliqueId: null, cliqueEm: null, email: "a@b.com.br" }), comDados, agora);
  confere("com dados do cliente ligados, o pago sem clique entra com e-mail", otimizada.entra && otimizada.linha.com_cliente && otimizada.linha.clique === null);
  const semEmail = decidirCompraPaga(pedido({ ...base, clique: null, cliqueId: null, cliqueEm: null }), comDados, agora);
  confere("sem clique e sem e-mail nem telefone continua de fora", !semEmail.entra);

  confere("gclid com espaço é recusado", !cliqueValido("abc def ghi jkl"));
  const invalido = decidirCompraPaga(pedido({ ...base, cliqueId: "curto" }), ligado, agora);
  confere("clique com forma errada fica de fora", !invalido.entra && invalido.motivo === "clique_invalido");
  const velho = decidirCompraPaga(pedido({ ...base, cliqueEm: ha(91 * DIA) }), ligado, agora);
  confere("clique de 91 dias fica de fora", !velho.entra && velho.motivo === "clique_velho");
  const antes = decidirCompraPaga(pedido({ ...base, feitoEm: "2026-11-12T15:00:00Z", pagamentoEm: "2026-11-12", cliqueEm: "2026-11-12T14:00:00Z" }), ligado, agora);
  confere("pago antes de 13/11 (o coletor não existia) fica de fora", !antes.entra && antes.motivo === "antes_do_corte");
  confere("cancelado não entra na compra paga", !decidirCompraPaga(pedido({ ...base, situacao: "cancelado" }), ligado, agora).entra);
}

console.log("Datas no formato de cada API");
{
  confere("Google Ads: AAAA-MM-DD HH:MM:SS-03:00", dataHoraDoGoogleAds("2026-11-16T17:03:09Z") === "2026-11-16 14:03:09-03:00");
  confere("Data Manager: RFC 3339", dataHoraRfc3339("2026-11-16T17:03:09.512Z") === "2026-11-16T14:03:09-03:00");
  confere("passa da meia-noite para o dia de São Paulo", dataHoraDoGoogleAds("2026-11-17T01:30:00Z") === "2026-11-16 22:30:00-03:00");
}

console.log("Dados do cliente, como o Google pede");
{
  confere("gmail sem pontos e sem o +", emailNormalizado(" Jane.Doe+Loja@Gmail.com ") === "janedoe@gmail.com");
  confere("googlemail também", emailNormalizado("a.b+c@googlemail.com") === "ab@googlemail.com");
  confere("outro domínio fica com ponto e +", emailNormalizado("User.Name+NYC@Example.com") === "user.name+nyc@example.com");
  confere("e-mail sem @ não vale", emailNormalizado("semarroba.com") === null);
  confere("telefone do pedido vira E.164", telefoneE164("5511987654321") === "+5511987654321");
  confere("telefone sem o 55 ganha o 55", telefoneE164("(11) 98765-4321") === "+5511987654321");
  confere("telefone curto não vale", telefoneE164("98765-4321") === null);
  confere("SHA-256 em hexadecimal", sha256("abc") === "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  const ids = identificadoresDoCliente("Jane.Doe@gmail.com", "5511987654321");
  confere("vão os dois resumos, nunca o texto", ids.length === 2 && JSON.stringify(ids).includes(sha256("janedoe@gmail.com")) && !JSON.stringify(ids).includes("gmail"));
}

console.log("O corpo da retirada");
{
  const c = corpoDaRetirada([{ pedido: 11735, momento: "2026-11-20T15:00:00Z" }], "7575406236", true);
  const a = c.conversionAdjustments[0];
  confere("a ação é o recurso inteiro", a.conversionAction === "customers/1355887754/conversionActions/7575406236");
  confere("RETRACTION pelo número do pedido, em texto", a.adjustmentType === "RETRACTION" && a.orderId === "11735");
  confere("sem gclid junto (o Google recusa os dois)", !("gclidDateTimePair" in a));
  confere("partialFailure sempre ligado", c.partialFailure === true);
  confere("validateOnly segue o interruptor", c.validateOnly === true && corpoDaRetirada([], "1", false).validateOnly === false);
}

console.log("O corpo da compra paga");
{
  const linha = { pedido: 11735, momento: "2026-11-16T17:05:00Z", valor: 254.9, moeda: "BRL", clique: "gclid" as const, clique_id: GCLID };
  const e = eventoDaCompraPaga(linha);
  confere("o pedido é o transactionId", e.transactionId === "11735");
  confere("valor, moeda e origem", e.conversionValue === 254.9 && e.currency === "BRL" && e.eventSource === "WEB");
  confere("o clique vai pelo nome dele", JSON.stringify(e.adIdentifiers) === JSON.stringify({ gclid: GCLID }));
  confere("sem dados do cliente, sem userData", !("userData" in e));
  const gb = eventoDaCompraPaga({ ...linha, clique: "gbraid" });
  confere("gbraid vai como gbraid", JSON.stringify(gb.adIdentifiers) === JSON.stringify({ gbraid: GCLID }));
  const corpo = corpoDaCompraPaga([e], "1234567890", true);
  const destino = (corpo.destinations as { operatingAccount: { accountType: string; accountId: string }; productDestinationId: string }[])[0];
  confere("a conta que opera é a dona da ação", destino.operatingAccount.accountType === "GOOGLE_ADS" && destino.operatingAccount.accountId === "1355887754");
  confere("a ação vai em productDestinationId", destino.productDestinationId === "1234567890");
  confere("sem userData não precisa de encoding", !("encoding" in corpo) && corpo.validateOnly === true);
  const comCliente = eventoDaCompraPaga(linha, { email: "a@b.com", telefone: "5511987654321" });
  confere("com dados do cliente, encoding HEX", corpoDaCompraPaga([comCliente], "1", false).encoding === "HEX");
  confere("o que fica guardado na fila não leva os resumos", !JSON.stringify(semDadosDoCliente(comCliente)).includes(sha256("a@b.com")));
}

console.log("Ler a resposta da retirada");
{
  const resposta = {
    partialFailureError: {
      code: 3,
      message: "Multiple errors in 'details'.",
      details: [
        {
          "@type": "type.googleapis.com/google.ads.googleads.v26.errors.GoogleAdsFailure",
          errors: [
            { errorCode: { conversionAdjustmentUploadError: "CONVERSION_NOT_FOUND" }, message: "not found", location: { fieldPathElements: [{ fieldName: "conversion_adjustments", index: 1 }] } },
            { errorCode: { conversionAdjustmentUploadError: "CONVERSION_ALREADY_RETRACTED" }, message: "x", location: { fieldPathElements: [{ fieldName: "conversion_adjustments", index: 2 }, { fieldName: "order_id" }] } },
          ],
        },
      ],
    },
    results: [{ orderId: "1" }, {}, {}],
  };
  const f = falhasDaRetirada(resposta);
  confere("acha a falha pela posição", f.get(1)?.codigo === "CONVERSION_NOT_FOUND" && f.get(2)?.codigo === "CONVERSION_ALREADY_RETRACTED");
  confere("quem não aparece deu certo", !f.has(0));
  confere("resposta sem falha: mapa vazio", falhasDaRetirada({ results: [{}] }).size === 0);

  const negado = erroGeral({ error: { code: 403, status: "PERMISSION_DENIED", message: "denied", details: [{ "@type": "x.GoogleAdsFailure", errors: [{ errorCode: { authorizationError: "USER_PERMISSION_DENIED" }, message: "User doesn't have permission" }] }] } }, 403);
  confere("erro geral do Google Ads traz o código de dentro", negado.codigo === "USER_PERMISSION_DENIED");
  confere("conta Somente leitura vira frase de configuração", frase(negado).includes("Somente leitura"));
  const desativada = erroGeral({ error: { code: 403, status: "PERMISSION_DENIED", message: "API not enabled", details: [{ "@type": "type.googleapis.com/google.rpc.ErrorInfo", reason: "SERVICE_DISABLED" }] } }, 403);
  confere("API desativada: o motivo do ErrorInfo", desativada.codigo === "SERVICE_DISABLED");
  confere("erro sem corpo vira o status", erroGeral(null, 502).codigo === "HTTP_502");
}

console.log("Ler a resposta da compra paga");
{
  const v = violacoesDoDataManager({ error: { code: 400, status: "INVALID_ARGUMENT", details: [{ "@type": "type.googleapis.com/google.rpc.BadRequest", fieldViolations: [{ field: "events[2].adIdentifiers.gclid", description: "bad", reason: "INVALID_GCLID" }] }] } });
  confere("violação de campo pela posição do evento", v.get(2)?.codigo === "INVALID_GCLID" && v.size === 1);
  confere("processando: todos esperam", situacaoDoDataManager({ requestStatusPerDestination: [{ requestStatus: "PROCESSING" }] }, 3).every((s) => s.estado === "processando"));
  confere("sucesso: todos ok", situacaoDoDataManager({ requestStatusPerDestination: [{ requestStatus: "SUCCESS" }] }, 2).every((s) => s.estado === "ok"));
  const parcial = situacaoDoDataManager({ requestStatusPerDestination: [{ requestStatus: "PARTIAL_SUCCESS", errorInfo: { errorCounts: [{ reason: "PROCESSING_ERROR_REASON_CLICK_NOT_FOUND", recordCount: "1", recordIndices: ["1"] }] } }] }, 3);
  confere("sucesso em parte: só o da posição falha", parcial[0].estado === "ok" && parcial[1].estado === "falhou" && parcial[2].estado === "ok");
  const tudo = situacaoDoDataManager({ requestStatusPerDestination: [{ requestStatus: "FAILED", errorInfo: { errorCounts: [{ reason: "PROCESSING_ERROR_REASON_DESTINATION_ACCOUNT_ENHANCED_CONVERSIONS_TERMS_NOT_SIGNED", recordCount: 2 }] } }] }, 2);
  confere("falhou inteiro sem posição: todos falham", tudo.every((s) => s.estado === "falhou"));
  confere("sem resposta: processando", situacaoDoDataManager({}, 1)[0].estado === "processando");
}

console.log("O que fazer com cada resposta");
{
  confere("retirada sem erro: feita", classificarRetirada(null).tipo === "feito");
  confere("já retirada conta como feita", classificarRetirada("CONVERSION_ALREADY_RETRACTED").tipo === "feito");
  confere("não achada: o Google não tinha contado", classificarRetirada("CONVERSION_NOT_FOUND").tipo === "nao_contado");
  confere("compra recente: espera 6 horas", JSON.stringify(classificarRetirada("TOO_RECENT_CONVERSION")) === JSON.stringify({ tipo: "esperar", horas: 6 }));
  confere("ação inexistente: configuração", classificarRetirada("NO_CONVERSION_ACTION_FOUND").tipo === "configuracao");
  confere("compra repetida conta como feita", classificarCompraPaga("PROCESSING_ERROR_REASON_DUPLICATE_TRANSACTION_ID").tipo === "feito");
  confere("clique vencido: fora do prazo", classificarCompraPaga("PROCESSING_ERROR_REASON_EXPIRED_CLICK").tipo === "fora_do_prazo");
  confere("termos não aceitos: configuração", classificarCompraPaga("PROCESSING_ERROR_REASON_DESTINATION_ACCOUNT_ENHANCED_CONVERSIONS_TERMS_NOT_SIGNED").tipo === "configuracao");
  confere("gclid inválido: recusado", classificarCompraPaga("INVALID_GCLID").tipo === "recusado");
  confere("429 e 5xx são passageiros", classificarErroGeral(429, "RESOURCE_EXHAUSTED").tipo === "passageiro" && classificarErroGeral(503, "x").tipo === "passageiro" && classificarErroGeral(0, "rede").tipo === "passageiro");
  confere("403 é configuração", classificarErroGeral(403, "USER_PERMISSION_DENIED").tipo === "configuracao");

  const linhaR = { id: 1, tipo: "retirada" as const, tentativas: 0 };
  const linhaC = { id: 2, tipo: "compra_paga" as const, tentativas: 0 };
  const nada = null;
  const naoAchou = { codigo: "CONVERSION_NOT_FOUND", mensagem: "" };
  confere("em validação, sucesso vira validado", gravacaoDaResposta(linhaR, { tipo: "feito" }, nada, true, agora).estado === "validado");
  const valNao = gravacaoDaResposta(linhaR, { tipo: "nao_contado" }, naoAchou, true, agora);
  confere("em validação, nada é final: recusa vira validado com o código", valNao.estado === "validado" && valNao.codigo === "CONVERSION_NOT_FOUND");
  confere("retirada aceita é final", gravacaoDaResposta(linhaR, { tipo: "feito" }, nada, false, agora).estado === "confirmado");
  confere("compra paga aceita espera a confirmação", gravacaoDaResposta(linhaC, { tipo: "feito" }, nada, false, agora).estado === "enviado");
  confere("não achada fica registrada como não contada", gravacaoDaResposta(linhaR, { tipo: "nao_contado" }, naoAchou, false, agora).estado === "nao_contado");
  const conf = gravacaoDaResposta({ ...linhaR, tentativas: 3 }, { tipo: "configuracao" }, { codigo: "USER_PERMISSION_DENIED", mensagem: "" }, false, agora);
  confere("falta de configuração não gasta tentativa", conf.estado === "pendente" && conf.tentativas === 3);
  const pass = gravacaoDaResposta(linhaR, { tipo: "passageiro" }, { codigo: "HTTP_503", mensagem: "" }, false, agora);
  confere("soluço: tenta de novo em 15 minutos", pass.estado === "pendente" && pass.tentativas === 1 && pass.proxima_em === new Date(agora.getTime() + 15 * 60_000).toISOString());
  const desiste = gravacaoDaResposta({ ...linhaR, tentativas: PRAZOS.tentativasMaximas - 1 }, { tipo: "passageiro" }, { codigo: "HTTP_503", mensagem: "" }, false, agora);
  confere("na oitava falha, desiste", desiste.estado === "recusado" && desiste.erro?.startsWith("Desistiu depois de 8"));
  confere("a espera cresce", proximaTentativa(2, agora)!.getTime() - agora.getTime() === HORA && proximaTentativa(8, agora) === null);
}

console.log("A prévia");
{
  const candidatos = [
    pedido({ pedido: 1 }),
    pedido({ pedido: 3, feitoEm: ha(5 * HORA) }),
    pedido({ pedido: 5, feitoEm: ha(60 * DIA) }),
    pedido({ pedido: 7, status: "CANCELADO", pagamentoEm: "2026-11-28", valorPago: 100 }),
    pedido({ pedido: 9, situacao: "pago", status: "A ENVIAR", valorPago: 254.9, clique: "gclid", cliqueId: GCLID, cliqueEm: ha(3 * DIA + HORA) }),
    pedido({ pedido: 11, situacao: "pago", status: "A ENVIAR", valorPago: 300 }),
  ];
  const p = montarPrevia(candidatos, CONFIG_PADRAO, agora);
  confere("retirada: um sai agora, um depois", p.retirada.agora.map((i) => i.pedido).join() === "1" && p.retirada.depois.map((i) => i.pedido).join() === "3");
  confere("retirada: fora do prazo e estorno listados", p.retirada.fora.fora_do_prazo?.[0]?.pedido === 5 && p.retirada.fora.teve_pagamento?.[0]?.pedido === 7);
  confere("compra paga: o do gclid sai agora", p.compraPaga.agora.map((i) => i.pedido).join() === "9" && p.compraPaga.agora[0].valor === 254.9);
  confere("compra paga: o sem clique aparece de fora", p.compraPaga.fora.sem_clique_do_google?.map((i) => i.pedido).join() === "11");
  confere("a prévia lista mesmo com tudo desligado", !CONFIG_PADRAO.ligado && p.retirada.agora.length === 1);
}

console.log("A rotina na tela de saúde");
{
  const r = ROTINAS.find((x) => x.id === "google-conversoes");
  confere("tem linha em ROTINAS, com pulso", r !== undefined && r.origem === "pulso");
}

console.log(falhas === 0 ? "\nTudo certo." : `\n${falhas} conferência(s) falharam.`);
process.exit(falhas === 0 ? 0 : 1);
