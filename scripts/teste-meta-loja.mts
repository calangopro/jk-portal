/**
 * Confere a compra da loja montada para a API de Conversões do Meta
 * (src/lib/meta/compra.ts). Roda sem banco e sem rede:
 *   node --experimental-strip-types scripts/teste-meta-loja.mts
 *
 * Os pedidos daqui são INVENTADOS: nenhum cliente, telefone ou e-mail de verdade.
 */
import {
  ESPERA_DA_COMPRA_MS, MAXIMO_DE_TENTATIVAS, PRAZO_DO_META_MS, dadosDaCompra, dadosDoCliente, decidir, fbcDoClique, idDoEvento,
  normalizarCidade, normalizarEmail, normalizarNome, normalizarTelefone, normalizarUf, quandoFoiPago, sha256, trayMandandoAoMeta,
  type PedidoParaMeta,
} from "../src/lib/meta/compra.ts";

let falhas = 0;
function confere(nome: string, ok: boolean, detalhe = "") {
  if (ok) console.log(`  ok  ${nome}`);
  else {
    falhas++;
    console.log(`  FALHOU  ${nome}${detalhe ? `: ${detalhe}` : ""}`);
  }
}

const agora = Date.parse("2026-12-01T15:00:00-03:00");
const ha = (min: number) => new Date(agora - min * 60_000).toISOString();

const pedido = (extra: Partial<PedidoParaMeta> = {}): PedidoParaMeta => ({
  pedido: 12001,
  feito_em: ha(60),
  situacao: "pendente",
  total: "399.90",
  valor_pago: null,
  cliente_codigo: "777",
  cliente_nome: "Maria  da Conceição Exemplo",
  cliente_email: "  Maria.Exemplo@Exemplo.com ",
  cliente_telefone: "(11) 91234-5678",
  cidade: "São Paulo",
  uf: "SP",
  itens: [
    { produto_tray_id: 217, quantidade: 1, preco: 399.9 },
    { produto_tray_id: "15", quantidade: 2, preco: "19.90" },
  ],
  ...extra,
});

const sinais = { fbp: "fb.1.1790000000000.123", fbc: null, navegador: "Mozilla/5.0 (iPhone)", ip: "200.200.200.200" };

console.log("Normalização");
confere("telefone com DDD ganha o 55", normalizarTelefone("(11) 91234-5678") === "5511912345678");
confere("telefone que já tem 55 fica", normalizarTelefone("+55 11 91234-5678") === "5511912345678");
confere("telefone fixo com DDD", normalizarTelefone("11 3333-4444") === "551133334444");
confere("telefone curto não serve", normalizarTelefone("91234-5678") === null);
confere("e-mail em minúsculas e sem espaço", normalizarEmail("  Maria.Exemplo@Exemplo.com ") === "maria.exemplo@exemplo.com");
confere("e-mail sem arroba não serve", normalizarEmail("maria.exemplo.com") === null);
confere("nome sem acento", normalizarNome("Conceição") === "conceicao");
confere("cidade sem espaço nem acento", normalizarCidade("São Paulo") === "saopaulo");
confere("cidade com hífen", normalizarCidade("Embu-Guaçu") === "embuguacu");
confere("estado em minúsculas", normalizarUf("SP") === "sp");
confere("estado errado não serve", normalizarUf("São Paulo") === null);
confere("sha256 em hexadecimal de 64", /^[0-9a-f]{64}$/.test(sha256("br")));

console.log("Números de evento");
confere("compra criada", idDoEvento("Purchase", 12001) === "pedido-12001");
confere("compra paga", idDoEvento("CompraPaga", 12001) === "pago-12001");
confere("fbc montado do clique", fbcDoClique({ fbclid: "AbC", em: "2026-11-30T10:00:00Z" }) === `fb.1.${Date.parse("2026-11-30T10:00:00Z")}.AbC`);
confere("sem clique, sem fbc", fbcDoClique(null) === null);

console.log("Dados de quem comprou");
const u = dadosDoCliente(pedido(), sinais, { fbclid: "XyZ", em: ha(600) });
confere("e-mail em SHA-256", (u.em as string[])[0] === sha256("maria.exemplo@exemplo.com"));
confere("telefone em SHA-256 com 55", (u.ph as string[])[0] === sha256("5511912345678"));
confere("primeiro e último nome", (u.fn as string[])[0] === sha256("maria") && (u.ln as string[])[0] === sha256("exemplo"));
confere("cidade e estado", (u.ct as string[])[0] === sha256("saopaulo") && (u.st as string[])[0] === sha256("sp"));
confere("código do cliente da Tray como id externo", (u.external_id as string[])[0] === sha256("tray:777"));
confere("fbc do clique quando o cookie não veio", typeof u.fbc === "string" && (u.fbc as string).endsWith(".XyZ"));
confere("fbp, navegador e IP abertos", u.fbp === sinais.fbp && u.client_user_agent === sinais.navegador && u.client_ip_address === sinais.ip);
confere("nenhum dado aberto do cliente", !JSON.stringify(u).includes("Maria") && !JSON.stringify(u).includes("91234"));
const semCodigo = dadosDoCliente(pedido({ cliente_codigo: null }), null, null);
confere("sem código, o telefone vira id externo", (semCodigo.external_id as string[])[0] === sha256("5511912345678"));
confere("sem sinais, sem navegador nem fbc", !("client_user_agent" in semCodigo) && !("fbc" in semCodigo));

console.log("O que foi comprado");
const c = dadosDaCompra(pedido(), "Purchase");
confere("valor e moeda", c.value === 399.9 && c.currency === "BRL");
confere("número do pedido", c.order_id === "12001");
confere("produtos pelo código da Tray", JSON.stringify(c.content_ids) === JSON.stringify(["217", "15"]));
confere("quantidade somada", c.num_items === 3);
confere("custo nunca sai", !JSON.stringify(c).includes("custo"));
const paga = dadosDaCompra(pedido({ situacao: "pago", valor_pago: "379.90" }), "CompraPaga");
confere("compra paga usa o valor pago", paga.value === 379.9);
const pagaSemValor = dadosDaCompra(pedido({ situacao: "pago", valor_pago: "" }), "CompraPaga");
confere("valor pago vazio cai no total", pagaSemValor.value === 399.9);

console.log("Decisão");
const base = { agora, desde: null, modo: "ligado" as const, sinais, clique: null, jaFeitos: [] };
const d1 = decidir(pedido(), base);
confere("pedido criado com navegador manda Purchase", d1.length === 1 && d1[0].mandar && d1[0].evento === "Purchase");
confere("Purchase vai como evento de site", d1[0].mandar && d1[0].corpo.action_source === "website");
confere("hora do evento é a do pedido", d1[0].mandar && d1[0].corpo.event_time === Math.floor(Date.parse(ha(60)) / 1000));

const d2 = decidir(pedido({ situacao: "pago", status_mudou_em: ha(20) }), base);
confere("pedido pago manda os dois", d2.filter((d) => d.mandar).length === 2);
const cp = d2.find((d) => d.evento === "CompraPaga");
confere("CompraPaga com a hora do pagamento", Boolean(cp?.mandar) && cp!.mandar && cp.corpo.event_time === Math.floor(Date.parse(ha(20)) / 1000));

const d3 = decidir(pedido({ feito_em: ha(10) }), { ...base, sinais: null });
confere("sem navegador, espera o recado da confirmação", d3.length === 0);
const d4 = decidir(pedido({ feito_em: new Date(agora - ESPERA_DA_COMPRA_MS - 60_000).toISOString() }), { ...base, sinais: null });
confere("sem navegador depois da espera, deixa a Purchase para o pixel", d4.length === 1 && !d4[0].mandar && d4[0].definitivo);
const d5 = decidir(pedido({ situacao: "pago", status_mudou_em: ha(5) }), { ...base, sinais: null });
const cp5 = d5.find((d) => d.evento === "CompraPaga");
confere("CompraPaga sem navegador vai como do sistema", Boolean(cp5?.mandar) && cp5!.mandar && cp5.corpo.action_source === "system_generated" && !cp5.corpo.event_source_url);

const velho = pedido({ feito_em: new Date(agora - PRAZO_DO_META_MS - 60_000).toISOString() });
const d6 = decidir(velho, base);
confere("pedido com mais de 7 dias não vai", d6.length === 1 && !d6[0].mandar && d6[0].definitivo);
const d7 = decidir(pedido(), { ...base, desde: agora - 10 * 60_000 });
confere("pedido de antes do corte não entra", d7.length === 0);

const jaEnviado = decidir(pedido({ situacao: "pago", status_mudou_em: ha(5) }), {
  ...base,
  jaFeitos: [{ pedido: 12001, evento: "Purchase", estado: "enviado", tentativas: 1 }],
});
confere("o que já foi não repete", jaEnviado.length === 1 && jaEnviado[0].evento === "CompraPaga");
const emTeste = { pedido: 12001, evento: "Purchase" as const, estado: "teste" as const, tentativas: 1 };
confere("mandado em teste não repete em teste", decidir(pedido(), { ...base, modo: "teste", jaFeitos: [emTeste] }).length === 0);
confere("mandado em teste vai de novo ao ligar", decidir(pedido(), { ...base, jaFeitos: [emTeste] }).length === 1);
const errou = { pedido: 12001, evento: "Purchase" as const, estado: "erro" as const, tentativas: MAXIMO_DE_TENTATIVAS };
confere("erro que esgotou as tentativas para", decidir(pedido(), { ...base, jaFeitos: [errou] }).length === 0);
confere("erro com tentativa sobrando tenta de novo", decidir(pedido(), { ...base, jaFeitos: [{ ...errou, tentativas: 1 }] }).length === 1);

console.log("Hora do pagamento");
confere("dia sem hora vira meio-dia de São Paulo", quandoFoiPago(pedido({ status_mudou_em: null, pagamento_em: "2026-11-30" })) === Date.parse("2026-11-30T12:00:00-03:00"));
const futuro = decidir(pedido({ situacao: "pago", status_mudou_em: new Date(agora + 3_600_000).toISOString() }), base).find((d) => d.evento === "CompraPaga");
confere("pagamento no futuro sai com a hora de agora", Boolean(futuro?.mandar) && futuro!.mandar && futuro.corpo.event_time === Math.floor(agora / 1000));

console.log("A Tray voltou?");
confere("com erro de aplicativo, não", !trayMandandoAoMeta({ pixel: "364357034958645", authentication_error: "Error validating application. Application has been deleted." }));
confere("sem erro e com pixel, sim", trayMandandoAoMeta({ pixel: "364357034958645", authentication_error: "" }));
confere("resposta estranha, não", !trayMandandoAoMeta("html de erro"));

console.log("");
if (falhas) {
  console.log(`${falhas} conferência(s) falharam.`);
  process.exit(1);
}
console.log("Tudo certo.");
