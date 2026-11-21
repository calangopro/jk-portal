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
import { register } from "node:module";
import {
  decidirLeadDoBalcao, decidirPedidoDoBalcao, diaEmSegundos, gravacaoDasPecas, metalDasPecas, numeracaoDasPecas, sugerirLigacao, tagsDoBalcao, tipoDasPecas,
  type LigacaoDaLoja, type PedidoParaKommo,
} from "../src/lib/kommo/balcao-regra.ts";
import { camposParaKommo, lerDefinicoes } from "../src/lib/kommo/automacoes-regra.ts";

// O mesmo gancho do teste das automações da Kommo: troca o `server-only` por vazio e completa o `.ts` dos imports relativos.
register(
  "data:text/javascript," +
    encodeURIComponent(`
      export async function resolve(especificador, contexto, proximo) {
        if (especificador === "server-only") return { url: "data:text/javascript,", shortCircuit: true };
        try { return await proximo(especificador, contexto); }
        catch (e) {
          if (/^\\.\\.?\\//.test(especificador) && !/\\.[cm]?[jt]s$/.test(especificador)) return proximo(especificador + ".ts", contexto);
          throw e;
        }
      }`),
);

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

console.log("\nO balcão na Kommo: o que vai em cada campo");
const LIG: LigacaoDaLoja = { loja: "JK Granja", loja_kommo: "Granja Vianna", tag: null, funil_pedido: 14110367, etapa_pedido: 108923747, funil_lead: 13518815, etapa_lead: 105986843, responsavel_id: 15075055 };
const PED: PedidoParaKommo = {
  id: "aaaaaaaa-0000-4000-8000-000000000001", numero: 12, loja: "JK Granja", vendedor: "Maria Teste", cliente_nome: "Ana Paula", cliente_telefone: "5511988887777", cliente_email: null,
  motivo: "casamento", data_especial: "2027-03-20", origem_cliente: "instagram",
  pecas: [{ nome: "Par de Alianças Ouro 18k 5mm", quantidade: 1, info: "Numeração - Aro 01: 18<br />Numeração - Aro 02: 24<br />Modelo de Gravação: Gravação Laser<br />Gravação - Aro 01: Ana &amp; Beto<br />Detalhes: caixinha<br />" }],
  total: "3000.00", entrega_texto: "Retire na loja do JK Granja", prazo: "2026-11-30", observacao: null, criado_em: "2026-11-20T23:30:00Z",
  pagamentos: [{ valor: "1500.00", forma: "pix", parcelas: 1 }],
};
{
  const a = decidirPedidoDoBalcao(PED, LIG)!;
  const c = a.negocio.campos;
  confere("pedido vai para o funil e a etapa do pedido da loja", a.negocio.funilId === 14110367 && a.negocio.etapaId === 108923747 && a.negocio.responsavelId === 15075055);
  confere("a chave é uma por pedido", a.chave === "balcao_pedido:aaaaaaaa-0000-4000-8000-000000000001" && a.automacao === "balcao_pedido" && !a.desistirSeAberto);
  confere("campos: Loja, Produto, Pix, Casamento, Instagram, Alianças, Ouro", c["Loja"] === "Granja Vianna" && c["Produto"] === "Par de Alianças Ouro 18k 5mm" && c["Método de pagamento"] === "Pix" && c["Motivo da Compra"] === "Casamento" && c["Origem do cliente"] === "Instagram" && c["Tipo de Produto"] === "Alianças" && c["Metal"] === "Ouro", JSON.stringify(c));
  confere("sinal com saldo aberto não é À vista nem Parcelamento", !("Pagamento" in c));
  confere("numeração e gravação saem do texto da fábrica", c["Numeração"] === "18 e 24" && c["Gravura"] === "Ana & Beto", `${c["Numeração"]} / ${c["Gravura"]}`);
  confere("Data da Compra é a meia-noite de São Paulo (23h30 UTC de 20/11 ainda é dia 20)", c["Data da Compra"] === diaEmSegundos("2026-11-20") && c["Data da Compra"] === Math.round(Date.parse("2026-11-20T03:00:00Z") / 1000));
  confere("tags: loja-fisica, Painel JK, a da loja e o vendedor", JSON.stringify(a.negocio.tags) === JSON.stringify(["loja-fisica", "Painel JK", "LOJA GRANJA VIANNA", "MARIA TESTE"]), JSON.stringify(a.negocio.tags));
  confere("a nota resume pedido, dinheiro e prazo, sem travessão", a.nota.includes("PL-12") && a.nota.includes("falta R$ 1.500,00") && a.nota.includes("30/11/2026") && !/[—–]/.test(a.nota), a.nota);
  confere("pago à vista inteiro vira À vista; crédito parcelado, Parcelamento", decidirPedidoDoBalcao({ ...PED, pagamentos: [{ valor: "3000", forma: "pix", parcelas: 1 }] }, LIG)!.negocio.campos["Pagamento"] === "À vista" && decidirPedidoDoBalcao({ ...PED, pagamentos: [{ valor: "3000", forma: "credito", parcelas: 6 }] }, LIG)!.negocio.campos["Pagamento"] === "Parcelamento");
  confere("formas diferentes: método fica vazio", !("Método de pagamento" in decidirPedidoDoBalcao({ ...PED, pagamentos: [{ valor: "1000", forma: "pix", parcelas: 1 }, { valor: "2000", forma: "dinheiro", parcelas: 1 }] }, LIG)!.negocio.campos));
  confere("loja sem ligação completa: nada", decidirPedidoDoBalcao(PED, { ...LIG, responsavel_id: null }) === null && decidirPedidoDoBalcao(PED, undefined) === null);
  confere("metal e tipo só com a palavra no nome", metalDasPecas([{ nome: "Anel Solitário", quantidade: 1, info: null }]) === null && tipoDasPecas([{ nome: "Anel Solitário Prata 925", quantidade: 1, info: null }]) === "Anéis" && metalDasPecas([{ nome: "Aliança prata com ouro", quantidade: 1, info: null }]) === "Prata encapada a ouro");
  confere("peças de tipos diferentes: tipo vazio", tipoDasPecas([{ nome: "Aliança", quantidade: 1, info: null }, { nome: "Brinco", quantidade: 1, info: null }]) === null);
  confere("numeração e gravação vazias sem info", numeracaoDasPecas([{ nome: "x", quantidade: 1, info: null }]) === "" && gravacaoDasPecas([{ nome: "x", quantidade: 1, info: null }]) === "");
  confere("tag sem ligação de nome usa o nome da loja", tagsDoBalcao({ ...LIG, loja_kommo: null }, "Zé").includes("LOJA GRANJA"));

  const l = decidirLeadDoBalcao({ id: "bbbbbbbb-0000-4000-8000-000000000001", loja: "JK Granja", vendedor: "Maria Teste", cliente_nome: "Beto", cliente_telefone: "5511977776666", interesse: "par de ouro 5 mm", tipo_produto: "aliancas", motivo: "noivado", data_especial: null, origem_cliente: "shopping", observacao: null, criado_em: "2026-11-20T15:00:00Z" }, LIG)!;
  confere("lead vai para o funil do lead e desiste se já houver negócio aberto", l.negocio.funilId === 13518815 && l.negocio.etapaId === 105986843 && l.desistirSeAberto && l.negocio.tags.includes("lead-balcao"));
  confere("lead leva Noivado, Shopping (passante), Alianças e o que procurava", l.negocio.campos["Motivo da Compra"] === "Noivado" && l.negocio.campos["Origem do cliente"] === "Shopping (passante)" && l.negocio.campos["Tipo de Produto"] === "Alianças" && l.negocio.campos["Produto"] === "par de ouro 5 mm");
}

console.log("\nCampos pelo nome viram id");
{
  const defs = lerDefinicoes({ _embedded: { custom_fields: [
    { id: 1, name: "Método de pagamento", type: "select", enums: [{ id: 11, value: "Pix" }, { id: 12, value: "Dinheiro" }] },
    { id: 2, name: "Produto", type: "text" },
    { id: 3, name: "Produto", type: "text" },
    { id: 4, name: "Data da Compra", type: "date" },
    { id: 5, name: "Quantidade de produtos", type: "numeric" },
  ] } });
  const r = camposParaKommo({ "Método de pagamento": "pix", Produto: "Par", "Data da Compra": 1763607600, "Quantidade de produtos": 2, Metal: "Ouro", "Método de pagamento 2": "x" }, defs);
  confere("lista vai pela opção (sem diferença de maiúscula), texto pelo valor, data em segundos, número em texto", JSON.stringify(r.valores) === JSON.stringify([{ field_id: 1, values: [{ enum_id: 11 }] }, { field_id: 2, values: [{ value: "Par" }] }, { field_id: 4, values: [{ value: 1763607600 }] }, { field_id: 5, values: [{ value: "2" }] }]), JSON.stringify(r.valores));
  confere("campo que a Kommo não tem volta em faltaram", r.faltaram.includes("Metal") && r.faltaram.includes("Método de pagamento 2"));
  confere("opção que não existe na lista volta em faltaram", camposParaKommo({ "Método de pagamento": "Cheque" }, defs).faltaram[0] === "Método de pagamento: Cheque");
}

console.log("\nSugestão de ligação pelo nome");
{
  const funis = [
    { id: 1, nome: "GRANJA VIANNA | PDV", etapas: [{ id: 11, nome: "Incoming leads", tipo: "entrada" }, { id: 12, nome: "Lançamento", tipo: "aberta" }] },
    { id: 2, nome: "GRANJA VIANNA | WHATS", etapas: [{ id: 21, nome: "Entrada", tipo: "aberta" }] },
    { id: 3, nome: "Tamboré | PÓS VENDAS", etapas: [{ id: 31, nome: "Lançamento", tipo: "aberta" }] },
    { id: 4, nome: "UNIÃO OSASCO | PDV", etapas: [{ id: 41, nome: "Lançamento", tipo: "aberta" }] },
  ];
  const s1 = sugerirLigacao("JK Granja", funis, ["Granja Vianna", "Raposo"]);
  confere("Granja: PDV/Lançamento, WHATS/Entrada e a opção Granja Vianna", s1.funil_pedido === 1 && s1.etapa_pedido === 12 && s1.funil_lead === 2 && s1.etapa_lead === 21 && s1.loja_kommo === "Granja Vianna", JSON.stringify(s1));
  confere("Tamboré acha o PÓS VENDAS", sugerirLigacao("JK Tamboré", funis, ["Tamboré"]).funil_pedido === 3);
  confere("Osasco e Plaza são ambíguas: sem sugestão", sugerirLigacao("JK Osasco", funis, ["União Osasco"]).funil_pedido == null && sugerirLigacao("JK Plaza", funis, ["Osasco Plaza"]).loja_kommo === null);
}

console.log("\nA escrita do balcão com uma Kommo de mentira");
{
  const { escreverNaKommo } = await import("../src/lib/kommo/escrever.ts");
  const rpcs: { nome: string; args: Record<string, unknown> }[] = [];
  const db = { rpc: async (nome: string, args: Record<string, unknown>) => { rpcs.push({ nome, args }); return nome === "kommo_escrita_reservar" ? { data: { ok: true, id: 1, feita_por: "autor" }, error: null } : { data: { ok: true }, error: null }; } };
  const chamadas: { caminho: string; metodo: string; corpo?: unknown }[] = [];
  const pedir = async (caminho: string, o: { metodo?: string; corpo?: unknown; busca?: URLSearchParams } = {}) => {
    chamadas.push({ caminho, metodo: o.metodo ?? "GET", corpo: o.corpo });
    if (caminho === "/api/v4/contacts") return { _embedded: { contacts: [{ id: 501, custom_fields_values: [{ field_code: "PHONE", values: [{ value: "+5511988887777" }] }], _embedded: { leads: [{ id: 9 }] } }] } };
    if (caminho === "/api/v4/leads/custom_fields") return { _embedded: { custom_fields: [{ id: 3185306, name: "Loja", type: "select", enums: [{ id: 7, value: "Granja Vianna" }] }, { id: 3173632, name: "Produto", type: "text" }] } };
    if (caminho === "/api/v4/leads/complex") return [{ id: 777, contact_id: 501 }];
    if (caminho === "/api/v4/leads/777") return { id: 777, pipeline_id: 14110367, status_id: 108923747, responsible_user_id: 15075055 };
    return {};
  };
  const r = await escreverNaKommo(db as never, pedir as never, decidirPedidoDoBalcao(PED, LIG)!);
  const criar = chamadas.find((c) => c.caminho === "/api/v4/leads/complex")?.corpo as { pipeline_id: number; custom_fields_values: unknown[]; _embedded: { contacts: unknown[]; tags: { name: string }[] } }[];
  confere("criou e conferiu: estado ok com o negócio 777", r.estado === "ok" && "negocioId" in r && r.negocioId === 777, JSON.stringify(r));
  confere("o registro grava como criar_negocio, sem negócio antes", rpcs[0].nome === "kommo_escrita_reservar" && rpcs[0].args.p_acao === "criar_negocio" && rpcs[0].args.p_negocio === null);
  confere("usou o contato que já existe, com as tags e os campos que a Kommo tem", JSON.stringify(criar[0]._embedded.contacts) === JSON.stringify([{ id: 501 }]) && criar[0]._embedded.tags.some((t) => t.name === "loja-fisica") && criar[0].custom_fields_values.length === 2);
  confere("pedido do cliente que já tem negócio aberto cria do mesmo jeito (cada compra é um negócio)", !chamadas.some((c) => c.caminho === "/api/v4/leads" && c.metodo === "GET"));
  confere("deixou a nota com o resumo no negócio criado", chamadas.some((c) => c.caminho === "/api/v4/leads/notes" && c.metodo === "POST" && JSON.stringify(c.corpo).includes("PL-12")));
  const fim = rpcs.find((x) => x.nome === "kommo_escrita_terminar")!.args;
  confere("o registro diz quais campos a Kommo não tem", typeof fim.p_erro === "string" && (fim.p_erro as string).includes("Campos que a Kommo não tem"), String(fim.p_erro));
}

if (falhas) {
  console.log(`\n${falhas} falha(s).`);
  process.exit(1);
}
console.log("\nTudo certo.");
