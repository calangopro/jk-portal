/**
 * Confere as contas da ficha do cliente e das oportunidades de venda. Roda sem
 * banco e sem navegador:
 *   node --experimental-strip-types scripts/teste-clientes.mts
 *
 * Os textos de gravação daqui têm a FORMA dos que a loja recebe (medida em
 * 14/11/2026: "nome 18/07/26", "nome 03.12.18", "12.06", "1 Cor 13:4-7"), com
 * nomes inventados. Nenhum cliente de verdade mora neste arquivo.
 */
import {
  chaveDoCliente, interpretarBusca, lerRef, nomeArrumado, normalizarTelefone, primeiroNome, refDoPedido,
} from "../src/lib/clientes/identidade.ts";
import {
  CARENCIA_DA_GRAVACAO, DIAS_DEPOIS, MARCOS_EM_MESES, TIPOS,
  dataPorExtenso, datasNaGravacao, diasEntre, interpretarDataDigitada, lerDataParcial, lojaParaConvidar,
  ocorrenciaNoAno, oportunidadesDoCliente, prazoEmPalavra, somarMeses, sugestoesDaGravacao, tipoDaPeca, tomDoPrazo,
  type ClienteParaConta, type CompraParaConta, type FichaParaConta,
} from "../src/lib/clientes/oportunidades.ts";

let falhas = 0;
function confere(nome: string, ok: boolean, detalhe = "") {
  if (ok) console.log(`  ok  ${nome}`);
  else {
    falhas++;
    console.error(`  ERRO ${nome}${detalhe ? `\n       ${detalhe}` : ""}`);
  }
}
const igual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

console.log("Quem é o cliente");
{
  confere("telefone com máscara vira 55 mais DDD e número", normalizarTelefone("(11) 98888-7777") === "5511988887777");
  confere("telefone que já veio com +55 não ganha outro 55", normalizarTelefone("+55 11 98888-7777") === "5511988887777");
  confere("fixo de dez dígitos vale", normalizarTelefone("11 3333-4444") === "551133334444");
  confere("número curto ou vazio não é telefone", normalizarTelefone("98888-7777") === null && normalizarTelefone("") === null && normalizarTelefone(null) === null);
  confere("a chave é o telefone, depois o e-mail, depois o código", chaveDoCliente({ telefone: "5511988887777", email: "a@b.com", codigo: "123" }) === "5511988887777"
    && chaveDoCliente({ telefone: null, email: "a@b.com", codigo: "123" }) === "a@b.com"
    && chaveDoCliente({ codigo: "123" }) === "123" && chaveDoCliente({}) === null);

  confere("referência de pedido", igual(lerRef("p48213"), { tipo: "pedido", pedido: 48213 }) && refDoPedido(48213) === "p48213");
  confere("referência de venda por fora e de cadastro no grupo", lerRef("v0f8fad5b-d9cb-469f-a165-70867728950e")?.tipo === "venda" && lerRef("l0f8fad5b-d9cb-469f-a165-70867728950e")?.tipo === "lead");
  confere("telefone, e-mail e lixo não são referência", lerRef("5511988887777") === null && lerRef("a@b.com") === null && lerRef("p0") === null && lerRef("pabc") === null && lerRef("vnao-e-uuid") === null && lerRef(undefined) === null);

  confere("busca vazia ou de uma letra não busca nada", interpretarBusca("") === null && interpretarBusca(" a ") === null);
  confere("número curto é pedido e também pedaço de telefone", igual(interpretarBusca("48213"), { nome: null, telefone: "48213", email: null, pedido: 48213 }));
  confere("três dígitos é só pedido", igual(interpretarBusca("482"), { nome: null, telefone: null, email: null, pedido: 482 }));
  confere("telefone digitado com máscara e +55 perde o país", interpretarBusca("+55 (11) 98888-7777")?.telefone === "11988887777" && interpretarBusca("+55 (11) 98888-7777")?.pedido === null);
  confere("telefone sem DDD também busca", interpretarBusca("98888-7777")?.telefone === "988887777");
  confere("com arroba é e-mail, em minúsculas", interpretarBusca("Ana.Souza@Gmail.com")?.email === "ana.souza@gmail.com");
  confere("nome vira palavras sem acento", igual(interpretarBusca("  João   da Conceição ")?.nome, ["joao", "da", "conceicao"]));
  confere("curinga digitado no nome não chega ao banco", igual(interpretarBusca("ma%ria_")?.nome, ["ma", "ria"]));

  confere("nome em maiúsculas é arrumado, com as partículas em minúscula", nomeArrumado("MARIA APARECIDA DA SILVA") === "Maria Aparecida da Silva");
  confere("nome em minúsculas é arrumado", nomeArrumado("joão e maria dos santos") === "João e Maria dos Santos");
  confere("nome já misto fica como está", nomeArrumado("Ana McDonald") === "Ana McDonald");
  confere("primeiro nome", primeiroNome("CARLOS EDUARDO") === "Carlos" && primeiroNome("  ana  paula souza") === "Ana");
  confere("nome vazio é null", nomeArrumado("  ") === null && primeiroNome(null) === null);
}

console.log("\nDatas");
{
  confere("data com ano e sem ano", igual(lerDataParcial("2024-06-12"), { ano: 2024, mes: 6, dia: 12 }) && igual(lerDataParcial("06-12"), { ano: null, mes: 6, dia: 12 }));
  confere("dia que não existe é recusado", lerDataParcial("02-30") === null && lerDataParcial("2025-02-29") === null && lerDataParcial("04-31") === null && lerDataParcial("13-01") === null);
  confere("29 de fevereiro vale sem ano e em ano bissexto", lerDataParcial("02-29") !== null && lerDataParcial("2024-02-29") !== null);
  confere("por extenso", dataPorExtenso("2024-06-12") === "12/06/2024" && dataPorExtenso("06-12") === "12/06" && dataPorExtenso("lixo") === "");

  confere("digitado: dia e mês", interpretarDataDigitada("12/06", 2026) === "06-12" && interpretarDataDigitada("5.3", 2026) === "03-05");
  confere("digitado: com ano de quatro e de dois dígitos", interpretarDataDigitada("12/06/2024", 2026) === "2024-06-12" && interpretarDataDigitada("12-06-24", 2026) === "2024-06-12");
  confere("digitado: ano de dois dígitos do século passado", interpretarDataDigitada("03/09/88", 2026) === "1988-09-03");
  confere("digitado: vazio apaga, torto pede correção", interpretarDataDigitada("  ", 2026) === null && interpretarDataDigitada("31/02", 2026) === undefined && interpretarDataDigitada("amanhã", 2026) === undefined && interpretarDataDigitada("12/06/1820", 2026) === undefined);

  confere("somar meses não estoura o mês", somarMeses("2026-04-30", 10) === "2027-02-28" && somarMeses("2027-04-30", 10) === "2028-02-29" && somarMeses("2026-05-12", 12) === "2027-05-12" && somarMeses("2026-11-30", 3) === "2027-02-28");
  confere("dias entre datas", diasEntre("2026-11-14", "2026-11-21") === 7 && diasEntre("2026-11-14", "2026-11-10") === -4 && diasEntre("2026-12-30", "2027-01-02") === 3);
  confere("29 de fevereiro cai em 28 no ano comum", ocorrenciaNoAno("02-29", 2027) === "2027-02-28" && ocorrenciaNoAno("02-29", 2028) === "2028-02-29");
}

console.log("\nData na gravação");
{
  const d = (t: string, ano = 2026) => datasNaGravacao(t, ano);
  confere("nome e data com barra e ano de dois dígitos", igual(d("Ana 18/07/26"), ["2026-07-18"]));
  confere("data com ponto e ano antigo", igual(d("Leo 03.12.18"), ["2018-12-03"]));
  confere("data com ano de quatro dígitos", igual(d("Bia 24/10/2026"), ["2026-10-24"]) && igual(d("10/05/2008"), ["2008-05-10"]));
  confere("só dia e mês", igual(d("André 12.06"), ["06-12"]) && igual(d("31/10"), ["10-31"]) && igual(d("Rui 27-03"), ["03-27"]));
  confere("data antes do nome e com enfeite", igual(d("14.02.2026 - Lia &#9825; Gil"), ["2026-02-14"]) && igual(d("08/06/26 &#9825;Nei&#9825;"), ["2026-06-08"]));
  confere("um dígito no dia e no mês", igual(d("Eva | 8.5"), ["05-08"]));
  confere("data no futuro próximo do pedido continua neste século", igual(d("Ivo 02.01.2027"), ["2027-01-02"]) && igual(d("Ivo 02.01.27"), ["2027-01-02"]));
  confere("versículo não é data", igual(d("1 Cor 13:4-7"), []) && igual(d("Rute 1:16-17"), []) && igual(d("Ct 8:7 &#9825;"), []) && igual(d("Ec 4:12"), []));
  confere("mês que não existe não é data", igual(d("Edu.&#10084; 12.26"), []) && igual(d("45/60"), []));
  confere("só nome não tem data", igual(d("Paulo Victor"), []) && igual(d(""), []) && igual(d(null), []));
  confere("ano absurdo cai fora e fica o dia e o mês", igual(d("12/06/1820"), ["06-12"]));
  confere("a mesma data duas vezes conta uma", igual(d("12.06 e 12/06"), ["06-12"]));
  confere("duas datas no mesmo texto", igual(d("12/06/2020 e 20/11/2026"), ["2020-06-12", "2026-11-20"]));
}

console.log("\nO que a peça é");
{
  confere("par de namoro com solitário de brinde é namoro, não noivado", tipoDaPeca("Par de Alianças de Namoro Elegance em Prata 950 2mm + Anel Solitário Brinde (Ref. JK9015A)") === "namoro");
  confere("namoro e compromisso é namoro", tipoDaPeca("Par de Alianças de Prata Elegance + Anel Solitário Brinde para Namoro e Compromisso 2mm") === "namoro");
  confere("casamento", tipoDaPeca("Par de Alianças de Casamento Banhada a Ouro 18k Tradicional 3mm + Anel Brinde") === "casamento");
  confere("noivado", tipoDaPeca("Anel de Noivado em Ouro 18k") === "noivado");
  confere("aliança que o nome não diz para quê", tipoDaPeca("Par de Alianças de Moeda Antiga Banhada a Ouro 18k 4mm + Anel Solitário Brinde") === "alianca");
  confere("anel solto", tipoDaPeca("Anel Solitário de Prata - Modelo Diamond") === "anel" && tipoDaPeca("Anel de Formatura em Prata Pedra Oval") === "anel");
  confere("o resto", tipoDaPeca("Caixinha para Alianças e Anel - Formato de Rosa") === "outra" && tipoDaPeca("Brinco Semijoia Banhado a Ouro 18k") === "outra" && tipoDaPeca("Gargantilha Charm") === "outra" && tipoDaPeca(null) === "outra");
}

console.log("\nOportunidades");
{
  const HOJE = "2026-11-14";
  const LOJAS = [
    { nome: "Osasco Plaza Shopping", cidade: "Osasco" },
    { nome: "Shopping União de Osasco", cidade: "Osasco" },
    { nome: "Grand Plaza Shopping", cidade: "Santo André" },
  ];
  const ficha = (f: Partial<FichaParaConta> = {}): FichaParaConta => ({
    fase: "nao_sei", parNome: null, aniversario: null, aniversarioPar: null, dataNamoro: null, dataCasamento: null, datasRecusadas: [], ...f,
  });
  const compra = (dia: string, nome: string, gravacoes: string[] = [], extra: Partial<CompraParaConta> = {}): CompraParaConta => ({
    pedido: 1000, dia, frete: "CORREIOS SEDEX", cidade: "Curitiba", uf: "PR", pecas: [{ nome, gravacoes }], ...extra,
  });
  const cliente = (c: Partial<ClienteParaConta> = {}): ClienteParaConta => ({ nome: "Ana", ficha: null, compras: [], marcadas: [], ...c });
  const NAMORO = "Par de Alianças de Namoro em Prata 950 3mm + Anel Solitário Brinde";
  const CASAMENTO = "Par de Alianças de Casamento Banhada a Ouro 18k 4mm + Anel Brinde";
  const conta = (c: ClienteParaConta, dias = 30, hoje = HOJE) => oportunidadesDoCliente(c, hoje, dias, LOJAS);
  const tipos = (c: ClienteParaConta, dias = 30, hoje = HOJE) => conta(c, dias, hoje).map((o) => `${o.tipo}@${o.ocorrencia}`);

  confere("cliente sem ficha e sem compra não gera nada", conta(cliente()).length === 0);

  // Aniversários
  const comAniversario = cliente({ ficha: ficha({ aniversario: "11-20", aniversarioPar: "1995-12-01", parNome: "Leo" }) });
  confere("aniversário do cliente e do par dentro da janela", igual(tipos(comAniversario), ["aniversario_cliente@2026-11-20", "aniversario_par@2026-12-01"]));
  confere("fora da janela não aparece", igual(tipos(comAniversario, 5), []));
  confere("os dias até a data", conta(comAniversario)[0].emDias === 6 && conta(comAniversario)[0].origem === "ficha");
  confere("o texto usa o nome do par", conta(comAniversario)[1].motivo === "Aniversário de Leo, par de Ana." && conta(comAniversario)[1].oferecer.startsWith("Presente para Leo"));
  confere("aniversário que passou há pouco continua, marcado como atrasado", igual(tipos(cliente({ ficha: ficha({ aniversario: "11-10" }) })), ["aniversario_cliente@2026-11-10"]) && conta(cliente({ ficha: ficha({ aniversario: "11-10" }) }))[0].emDias === -4);
  confere("aniversário que passou há mais de uma semana some", igual(tipos(cliente({ ficha: ficha({ aniversario: "11-01" }) })), []));
  confere("a janela atravessa o ano", igual(tipos(cliente({ ficha: ficha({ aniversario: "01-05" }) }), 90), ["aniversario_cliente@2027-01-05"]));
  confere("aniversário em 29 de fevereiro cai em 28 no ano comum", igual(tipos(cliente({ ficha: ficha({ aniversario: "02-29" }) }), 30, "2027-02-10"), ["aniversario_cliente@2027-02-28"]));

  // Marcar
  const marcado = { ...comAniversario, marcadas: [{ tipo: "aniversario_cliente" as const, ocorrencia: "2026-11-20", decisao: "falei" as const }] };
  confere("o que foi marcado como já falei não volta", igual(tipos(marcado), ["aniversario_par@2026-12-01"]));
  confere("a do ano seguinte volta", igual(tipos(marcado, 30, "2027-11-01"), ["aniversario_cliente@2027-11-20", "aniversario_par@2027-12-01"]));
  confere("não vale também tira", igual(tipos({ ...comAniversario, marcadas: [{ tipo: "aniversario_par", ocorrencia: "2026-12-01", decisao: "nao_vale" }] }), ["aniversario_cliente@2026-11-20"]));
  confere("marca reaberta volta para a lista", tipos({ ...comAniversario, marcadas: [{ tipo: "aniversario_cliente", ocorrencia: "2026-11-20", decisao: "reaberta" }] }).length === 2);

  // Namoro pela ficha
  const namoraHaTres = cliente({ ficha: ficha({ fase: "namoro", dataNamoro: "2023-11-25" }) });
  confere("aniversário de namoro com os anos", igual(tipos(namoraHaTres), ["aniversario_namoro@2026-11-25"]) && conta(namoraHaTres)[0].motivo === "3 anos de namoro.");
  confere("com dois anos ou mais, a sugestão fala de noivado", conta(namoraHaTres)[0].oferecer.includes("noivado"));
  confere("com um ano, a sugestão não fala de noivado", !conta(cliente({ ficha: ficha({ fase: "namoro", dataNamoro: "2025-11-25" }) }))[0].oferecer.includes("noivado") && conta(cliente({ ficha: ficha({ dataNamoro: "2025-11-25" }) }))[0].motivo === "1 ano de namoro.");
  confere("namoro sem ano não diz quantos anos", conta(cliente({ ficha: ficha({ dataNamoro: "11-25" }) }))[0].motivo === "Aniversário de namoro.");
  confere("a própria data do namoro, no ano em que começou, não é aniversário", igual(tipos(cliente({ ficha: ficha({ dataNamoro: "2026-11-25" }) })), []));

  // Namoro pela gravação
  const gravou = cliente({ compras: [compra("2026-06-01", NAMORO, ["Ana 25/11/2023", "Leo 25/11/2023"])] });
  confere("data gravada vira oportunidade sugerida", igual(tipos(gravou), ["aniversario_namoro@2026-11-25"]) && conta(gravou)[0].origem === "gravacao");
  confere("o texto da sugestão diz que é palpite", conta(gravou)[0].motivo === "A aliança foi gravada com 25/11/2023. Pode ser o aniversário de namoro, de 3 anos.");
  confere("a mesma data nos dois aros conta uma vez", sugestoesDaGravacao(gravou).length === 1 && sugestoesDaGravacao(gravou)[0].campo === "data_namoro");
  confere("com a data confirmada na ficha, vale a ficha e a sugestão some", conta({ ...gravou, ficha: ficha({ dataNamoro: "2023-11-25" }) })[0].origem === "ficha" && sugestoesDaGravacao({ ...gravou, ficha: ficha({ dataNamoro: "2023-11-25" }) }).length === 0);
  confere("data recusada não é sugerida nem vira oportunidade", sugestoesDaGravacao({ ...gravou, ficha: ficha({ datasRecusadas: ["2023-11-25"] }) }).length === 0 && tipos({ ...gravou, ficha: ficha({ datasRecusadas: ["2023-11-25"] }) }).length === 0);
  const acabouDeComprar = cliente({ compras: [compra("2026-11-05", NAMORO, ["Ana 20/11"])] });
  confere(`data gravada a menos de ${CARENCIA_DA_GRAVACAO} dias da compra não gera oportunidade`, tipos(acabouDeComprar).length === 0 && sugestoesDaGravacao(acabouDeComprar).length === 1);
  confere("a mesma gravação gera oportunidade no ano seguinte", tipos(acabouDeComprar, 30, "2027-11-01").includes("aniversario_namoro@2027-11-20"));
  confere("versículo gravado não gera nada", tipos(cliente({ compras: [compra("2026-06-01", NAMORO, ["1 Cor 13:4-7"])] })).length === 0);

  // Casamento
  const vaiCasar = cliente({ ficha: ficha({ fase: "casamento_marcado", dataCasamento: "2026-12-05" }), compras: [compra("2026-10-20", NAMORO)] });
  confere("casamento chegando para quem não comprou aliança de casamento", igual(tipos(vaiCasar), ["casamento_chegando@2026-12-05"]) && conta(vaiCasar)[0].motivo.includes("05/12/2026"));
  confere("quem já comprou a de casamento não entra", tipos({ ...vaiCasar, compras: [compra("2026-10-20", CASAMENTO)] }).length === 0);
  confere("casamento que já passou não é mais casamento chegando", tipos(cliente({ ficha: ficha({ fase: "casamento_marcado", dataCasamento: "2026-11-10" }) })).length === 0);
  confere("casamento sem ano e fase diferente de casado é casamento chegando", igual(tipos(cliente({ ficha: ficha({ fase: "noivado", dataCasamento: "12-05" }) })), ["casamento_chegando@2026-12-05"]));
  confere("casamento sem ano e fase casado é aniversário", igual(tipos(cliente({ ficha: ficha({ fase: "casado", dataCasamento: "12-05" }) })), ["aniversario_casamento@2026-12-05"]));
  const casadoHaCinco = cliente({ ficha: ficha({ fase: "casado", dataCasamento: "2021-11-30" }) });
  confere("aniversário de casamento com os anos", igual(tipos(casadoHaCinco), ["aniversario_casamento@2026-11-30"]) && conta(casadoHaCinco)[0].motivo === "5 anos de casamento.");
  const gravouCasamento = cliente({ compras: [compra("2025-03-01", CASAMENTO, ["Ana e Leo 22/11/2025"])] });
  confere("data gravada na aliança de casamento sugere aniversário de casamento", igual(tipos(gravouCasamento), ["aniversario_casamento@2026-11-22"]) && sugestoesDaGravacao(gravouCasamento)[0].campo === "data_casamento");
  confere("no ano do próprio casamento gravado, não há aniversário", tipos(gravouCasamento, 30, "2025-11-01").length === 0);

  // Namoro sem noivado
  const namoroAntigo = cliente({ compras: [compra("2026-01-20", NAMORO)] });
  confere("dez meses da aliança de namoro, sem noivado nem casamento", igual(tipos(namoroAntigo), ["namoro_sem_noivado@2026-11-20"]) && conta(namoroAntigo)[0].motivo.startsWith("Comprou aliança de namoro há 10 meses"));
  confere("antes de dez meses não aparece", tipos(cliente({ compras: [compra("2026-03-20", NAMORO)] })).length === 0);
  confere("quem comprou de casamento depois não entra", tipos({ ...namoroAntigo, compras: [...namoroAntigo.compras, compra("2026-09-01", CASAMENTO)] }).every((t) => !t.startsWith("namoro_sem_noivado")));
  confere("aliança sem finalidade no nome também tira da lista", tipos({ ...namoroAntigo, compras: [...namoroAntigo.compras, compra("2026-09-01", "Par de Alianças de Moeda Antiga Banhada a Ouro 18k")] }).every((t) => !t.startsWith("namoro_sem_noivado")));
  confere("ficha dizendo casado tira da lista", tipos({ ...namoroAntigo, ficha: ficha({ fase: "casado" }) }).length === 0);
  confere("vale a compra de namoro mais recente", tipos({ ...namoroAntigo, compras: [...namoroAntigo.compras, compra("2026-08-01", NAMORO)] }).length === 0);
  confere(`o marco de dez meses espera ${DIAS_DEPOIS.namoro_sem_noivado} dias e some`, tipos(namoroAntigo, 30, "2027-01-04").includes("namoro_sem_noivado@2026-11-20") && tipos(namoroAntigo, 30, "2027-01-05").every((t) => !t.startsWith("namoro_sem_noivado")));
  confere("o marco volta um ano depois, aos 22 meses", tipos(namoroAntigo, 30, "2027-11-01").includes("namoro_sem_noivado@2027-11-20") && conta(namoroAntigo, 30, "2027-11-01").some((o) => o.motivo.includes("há 22 meses")));

  // Um ano da compra
  const umAno = cliente({ compras: [compra("2025-11-28", NAMORO, [], { pedido: 4321 })] });
  const polir = conta(umAno).find((o) => o.tipo === "um_ano_da_compra");
  confere("um ano da compra", polir?.ocorrencia === "2026-11-28" && polir.motivo === "Um ano da compra (pedido 4321).");
  confere("cliente de cidade sem loja não é convidado para a loja", polir?.oferecer.startsWith("Cliente de Curitiba (PR), sem loja da JK na cidade") === true);
  const retirou = cliente({ compras: [compra("2025-11-28", NAMORO, [], { frete: "Retire na loja do Shopping Plaza - Osasco", cidade: "São Paulo", uf: "SP" })] });
  confere("quem retirou na loja é convidado para a mesma loja", conta(retirou).find((o) => o.tipo === "um_ano_da_compra")?.oferecer.includes("na loja do Shopping Plaza, Osasco, onde retirou o pedido") === true);
  const deOsasco = cliente({ compras: [compra("2025-11-28", NAMORO, [], { cidade: "OSASCO", uf: "SP" })] });
  confere("cidade com mais de uma loja lista as lojas", conta(deOsasco).find((o) => o.tipo === "um_ano_da_compra")?.oferecer.includes("em uma das lojas de OSASCO: Osasco Plaza Shopping, Shopping União de Osasco") === true);
  const deSantoAndre = cliente({ compras: [compra("2025-11-28", NAMORO, [], { cidade: "santo andre", uf: "SP" })] });
  confere("cidade com uma loja, mesmo escrita sem acento", conta(deSantoAndre).find((o) => o.tipo === "um_ano_da_compra")?.oferecer.includes("na loja Grand Plaza Shopping") === true);
  confere("nenhum convite promete serviço grátis nem prazo", conta(retirou).every((o) => !/gr[aá]tis|gratuit|desconto|%/i.test(o.oferecer)));
  confere("brinco e caixinha sozinhos não pedem polimento", tipos(cliente({ compras: [compra("2025-11-28", "Brinco Semijoia Banhado a Ouro 18k")] })).length === 0);
  const semItens = cliente({ compras: [{ pedido: 77, dia: "2025-11-28", frete: null, cidade: null, uf: null, pecas: null }] });
  confere("pedido sem os itens no painel entra no um ano da compra, com aviso", conta(semItens).length === 1 && conta(semItens)[0].tipo === "um_ano_da_compra" && conta(semItens)[0].oferecer.includes("não estão no painel"));
  confere("pedido sem os itens não conta como namoro", tipos(cliente({ compras: [{ pedido: 77, dia: "2026-01-20", frete: null, cidade: null, uf: null, pecas: null }] })).length === 0);
  confere("dois anos da compra", conta(umAno, 30, "2027-11-10").some((o) => o.tipo === "um_ano_da_compra" && o.motivo.startsWith("2 anos da compra")));
  confere("a loja de retirada é lida do frete", igual(lojaParaConvidar(retirou.compras[0], LOJAS), { retirada: "Shopping Plaza, Osasco", daCidade: [] }));

  // Geral
  const tudo = cliente({
    ficha: ficha({ aniversario: "11-16", dataNamoro: "2024-11-15" }),
    compras: [compra("2026-01-20", NAMORO)],
  });
  confere("a lista sai por ordem de data", igual(tipos(tudo), ["aniversario_namoro@2026-11-15", "aniversario_cliente@2026-11-16", "namoro_sem_noivado@2026-11-20"]));
  const frases = conta(tudo).flatMap((o) => [o.motivo, o.oferecer]).concat(conta(vaiCasar).flatMap((o) => [o.motivo, o.oferecer]), conta(retirou).flatMap((o) => [o.motivo, o.oferecer]), TIPOS.map((t) => t.nome));
  confere("nenhum texto com travessão", frases.every((f) => !/[—–]/.test(f)));
  confere("os marcos que o banco usa para separar candidatos são os da conta", igual(MARCOS_EM_MESES, [10, 12]));

  confere("prazo em palavra", prazoEmPalavra(0) === "hoje" && prazoEmPalavra(1) === "amanhã" && prazoEmPalavra(12) === "em 12 dias" && prazoEmPalavra(-1) === "ontem" && prazoEmPalavra(-3) === "há 3 dias");
  confere("a cor do prazo", tomDoPrazo(-2) === "ruim" && tomDoPrazo(0) === "atencao" && tomDoPrazo(1) === "atencao" && tomDoPrazo(5) === "neutro");
}

if (falhas > 0) {
  console.error(`\n${falhas} ${falhas === 1 ? "conferência falhou" : "conferências falharam"}.`);
  process.exit(1);
}
console.log("\nTudo certo.");
