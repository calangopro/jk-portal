/**
 * Confere o balcão da loja física (cartão 71): a conta do dinheiro, a situação
 * do pedido, o que falta no rascunho, os textos para o WhatsApp do cliente, o
 * menu e o conector. Roda sem banco e sem navegador:
 *   node --experimental-strip-types scripts/teste-balcao.mts
 *
 * As regras de quem vê qual loja, do pagamento repetido e da entrega com saldo
 * moram no banco (0198 a 0200) e foram conferidas lá, em ensaios desfeitos, com
 * JWT falso de loja, outra loja, GM, tráfego e anônimo.
 */
import {
  agrupar, atrasado, avisoDeChegada, dataCurta, dinheiro, dinheiroRedondo, emPortugues, faltaNoRascunho, lerValor, linkDoWhatsapp, numeroDoPedido, pagamento,
  pecaEmTexto, resumoParaOCliente, sinalSugerido, situacao, somarDias, telefoneNaTela, telefoneParaLink,
  type PedidoDoBalcao, type RascunhoDoBalcao,
} from "../src/lib/balcao/regras.ts";
import { SETORES } from "../src/lib/painel/setores.ts";
import { FORA_DO_CONTEUDO, NIVEIS } from "../src/lib/auth/acessos.ts";
import { podeUsarConector } from "../src/lib/conector/quem-usa.ts";

let falhas = 0;
function confere(nome: string, ok: boolean, detalhe = "") {
  if (ok) console.log(`  ok  ${nome}`);
  else {
    falhas++;
    console.log(`  FALHOU  ${nome}${detalhe ? `: ${detalhe}` : ""}`);
  }
}

const HOJE = "2026-11-20";

const pedido = (m: Partial<PedidoDoBalcao> = {}): PedidoDoBalcao => ({
  id: "aaaaaaaa-0000-4000-8000-000000000001", numero: 12, loja: "JK Granja", vendedor: "v1", vendedor_nome: "Maria",
  cliente_nome: "Ana Paula Souza", cliente_telefone: "5511988887777", cliente_email: null, motivo: "casamento", data_especial: null,
  pecas: [{ nome: "Par de Alianças Ouro 18k 5mm", quantidade: 1, info: "Numeração - Aro 01: 18<br />Numeração - Aro 02: 22<br />Modelo de Gravação: Gravação Laser<br />Gravação - Aro 01: Ana &amp; Beto<br />Detalhes: caixinha de coração<br />", produto_tray_id: "123" }],
  formulario: null, entrega: "retirada", entrega_texto: "Retire na loja do JK Granja", endereco: null, cidade: null, uf: null,
  prazo: "2026-11-30", total: "1500.00", pago: "500.00", observacao: null, numero_papel: null, fotos: [], transcricao: null,
  fabrica_em: null, recebido_em: null, entregue_em: null, cancelado_em: null, cancelado_motivo: null,
  criado_em: "2026-11-20T15:00:00Z", atualizado_em: "2026-11-20T15:00:00Z", criado_por_nome: "JK", os: null, etapa: null, etapa_nome: null,
  etapa_papel: null, etapa_em: null, rastreio: null, ref: null, pagamentos: [], anexos: [], ...m,
});

console.log("\nDinheiro como a loja digita");
{
  confere("1.500,00 vira 1500", lerValor("1.500,00") === 1500);
  confere("1500 e 1500,5 e R$ 1.299,90", lerValor("1500") === 1500 && lerValor("1500,5") === 1500.5 && lerValor("R$ 1.299,90") === 1299.9);
  confere("1.500 (milhar sem centavos) vira 1500", lerValor("1.500") === 1500);
  confere("1500.50 (ponto decimal) vira 1500,50", lerValor("1500.50") === 1500.5);
  confere("texto, vazio e três casas não são valor", lerValor("abc") === null && lerValor("") === null && lerValor("10,555") === null);
  confere("dinheiro sai em real, sem espaço especial", dinheiro(1500) === "R$ 1.500,00", dinheiro(1500));
  confere("o resumo sai sem centavos, para caber no cartão", dinheiroRedondo(3100.5) === "R$ 3.101" && dinheiroRedondo(0) === "R$ 0", dinheiroRedondo(3100.5));
  confere("sinal sugerido é metade, para baixo", sinalSugerido(1599) === 799 && sinalSugerido(null) === null && sinalSugerido(0) === null);
}

console.log("\nQuanto falta receber");
{
  const g = pagamento(pedido());
  confere("com sinal: pago 500, falta 1000", g.chave === "sinal" && g.pago === 500 && g.falta === 1000);
  confere("nada pago é vermelho", pagamento(pedido({ pago: 0 })).chave === "nada" && pagamento(pedido({ pago: 0 })).tom === "ruim");
  confere("tudo pago é verde", pagamento(pedido({ pago: "1500" })).chave === "pago" && pagamento(pedido({ pago: "1500" })).tom === "bom");
  confere("pago a mais é aviso, não verde", pagamento(pedido({ pago: "1600" })).chave === "a_mais");
  confere("centavo não sobra por conta de ponto flutuante", pagamento(pedido({ total: "0.3", pago: "0.1" })).falta === 0.2);
}

console.log("\nEm que pé está o pedido");
{
  confere("anotado e não mandado é atenção", situacao(pedido()).chave === "anotado" && situacao(pedido()).tom === "atencao");
  confere("na fábrica mostra a etapa", situacao(pedido({ fabrica_em: "x", etapa_nome: "Gravação", etapa_papel: "meio" })).nome === "Fábrica: Gravação");
  confere("saiu da fábrica para retirar: a caminho da loja", situacao(pedido({ fabrica_em: "x", etapa_papel: "final" })).nome === "A caminho da loja");
  confere("saiu da fábrica pelos Correios: enviado, com rastreio", situacao(pedido({ fabrica_em: "x", etapa_papel: "final", entrega: "correios", rastreio: "AB123BR" })).frase.includes("AB123BR"));
  confere("chegou na loja vence a etapa da fábrica", situacao(pedido({ fabrica_em: "x", etapa_papel: "final", recebido_em: "y" })).chave === "na_loja");
  confere("entregue vence chegou", situacao(pedido({ recebido_em: "y", entregue_em: "z" })).chave === "entregue");
  confere("cancelado vence tudo", situacao(pedido({ entregue_em: "z", cancelado_em: "w" })).chave === "cancelado");
  confere("atrasado: prazo passou e não entregou", atrasado(pedido({ prazo: "2026-11-19" }), HOJE) && !atrasado(pedido({ prazo: "2026-11-20" }), HOJE));
  confere("entregue ou cancelado não fica atrasado", !atrasado(pedido({ prazo: "2026-11-01", entregue_em: "z" }), HOJE) && !atrasado(pedido({ prazo: "2026-11-01", cancelado_em: "z" }), HOJE));
  const grupos = agrupar([pedido({ id: "1" }), pedido({ id: "2", recebido_em: "y" }), pedido({ id: "3", entregue_em: "z" }), pedido({ id: "4", fabrica_em: "x" })]);
  confere("a lista começa pelo que precisa de ação", grupos.map((x) => x.chave).join(",") === "na_loja,anotado,na_fabrica,entregue", grupos.map((x) => x.chave).join(","));
}

console.log("\nTextos para o cliente");
{
  const resumo = resumoParaOCliente(pedido(), HOJE);
  confere("resumo abre pelo primeiro nome e diz a loja", resumo.startsWith("Olá, Ana! Aqui é da JK Alianças, JK Granja."));
  confere("resumo traz número, total, pago, falta e previsão", ["PL-12", "Total: R$ 1.500,00", "Pago: R$ 500,00", "Falta: R$ 1.000,00", "Previsão para retirar: 30/11"].every((t) => resumo.includes(t)), resumo);
  confere("resumo mostra numeração e gravação, sem HTML e sem os detalhes internos", resumo.includes("Aro 01: 18") && resumo.includes("Ana & Beto") && !resumo.includes("<br") && !resumo.includes("caixinha"), resumo);
  confere("nenhum texto tem travessão", !/[—–]/.test(resumo + avisoDeChegada(pedido())));
  confere("pago inteiro não fala em falta", !resumoParaOCliente(pedido({ pago: "1500" }), HOJE).includes("Falta"));
  confere("aviso de chegada lembra o saldo", avisoDeChegada(pedido()).includes("falta pagar R$ 1.000,00"));
  confere("aviso de chegada sem saldo não cobra", !avisoDeChegada(pedido({ pago: "1500" })).includes("falta"));
  confere("peça com quantidade", pecaEmTexto({ nome: "Anel", quantidade: 2, info: null }) === "2x Anel");
  confere("link do WhatsApp com o texto", (linkDoWhatsapp("(11) 98888-7777", "oi") ?? "") === "https://wa.me/5511988887777?text=oi");
  confere("telefone sem DDD não vira link", linkDoWhatsapp("98888-7777", "oi") === null && telefoneParaLink("12345") === null);
  confere("telefone na tela", telefoneNaTela("5511988887777") === "(11) 98888-7777" && telefoneNaTela("1133334444") === "(11) 3333-4444");
}

console.log("\nO que falta no rascunho");
{
  const base: RascunhoDoBalcao = {
    id: "x", loja: "JK Granja", vendedor: "v1", cliente_nome: "Ana", cliente_telefone: "11988887777", cliente_email: "", motivo: "", data_especial: "",
    producao: { pecas: [{ nome: "Par", codigo: null, quantidade: 1, aro1: "", aro2: "", anel: "", gravacao: "sem", gravar1: "", gravar2: "", detalhes: "" }], entrega: "retirada", loja: "JK Granja", endereco: "", cidade: "", uf: "" },
    prazo: "", total: "1500", observacao: "", numero_papel: "", fotos: [], transcricao: "", pagamento: null, anexos: [], mexido_em: "",
  };
  confere("rascunho completo pode salvar", faltaNoRascunho(base, false).length === 0, faltaNoRascunho(base, false).join(", "));
  confere("sem vendedor, telefone e total: diz os três", emPortugues(faltaNoRascunho({ ...base, vendedor: "", cliente_telefone: "", total: "" }, false)) === "quem atendeu, o WhatsApp do cliente e o valor total");
  confere("gerência sem loja escolhida", faltaNoRascunho({ ...base, loja: "" }, true).includes("a loja"));
  confere("Correios sem endereço", faltaNoRascunho({ ...base, producao: { ...base.producao, entrega: "correios" } }, false).includes("o endereço de entrega"));
  confere("pago agora maior que o total", faltaNoRascunho({ ...base, pagamento: { chave: "c", valor: "2000", forma: "pix", parcelas: 1, comprovante: null } }, false).some((x) => x.includes("não passe do total")));
  confere("pago agora vazio", faltaNoRascunho({ ...base, pagamento: { chave: "c", valor: "", forma: "pix", parcelas: 1, comprovante: null } }, false).includes("o valor pago agora"));
}

console.log("\nDatas, menu, nível e conector");
{
  confere("data deste ano sem o ano, de outro com", dataCurta("2026-11-30", HOJE) === "30/11" && dataCurta("2027-01-05", HOJE) === "05/01/2027");
  confere("somar dias vira o mês", somarDias("2026-11-20", 15) === "2026-12-05");
  confere("número do pedido", numeroDoPedido(12) === "PL-12" && numeroDoPedido(null) === "Pedido novo");
  const item = SETORES.flatMap((s) => s.itens).find((i) => i.href === "/admin/balcao");
  confere("o Balcão está no menu, com a área balcao", item?.area === "balcao");
  confere("o nível Loja existe para quem convida", NIVEIS.some((n) => n.papel === "loja"));
  confere("o nível Loja fica fora do conteúdo do site e do conector", FORA_DO_CONTEUDO.includes("loja") && !podeUsarConector("loja"));
}

if (falhas) {
  console.log(`\n${falhas} falha(s).`);
  process.exit(1);
}
console.log("\nTudo certo.");
