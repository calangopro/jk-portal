/**
 * Confere as contas da Biblioteca JK e do chat do time. Roda sem banco e sem
 * navegador:
 *   node --experimental-strip-types scripts/teste-biblioteca.mts
 *
 * As respostas e as conversas daqui são INVENTADAS, só com a forma das de
 * verdade. Nenhuma regra da casa, nenhum valor e nenhum cliente mora neste
 * arquivo: o conteúdo da biblioteca fica no banco.
 */
import {
  TEMAS, conferirResposta, contarPorTema, estadoEmPalavra, filtrarRespostas, lerEstado, lerTema, mesmaFamilia, oQuePode,
  palavrasDoTexto, respostasProximas, semAcento, type Resposta,
} from "../src/lib/time/biblioteca.ts";
import {
  DIAS_DE_NAO_LIDA, ENDERECO_DO_CHAT, FOLGA_DA_SINCRONIA_MS, LIMITES_DO_PEDIDO, SALAS,
  avisosDoMenu, caminhoDaImagem, conferirImagem, daSala, desdeQuandoSincronizar, diaDe, duracaoEmPalavra, esperaDoPedido, esperandoPorMim,
  estaEsperando, horaCurta, iniciais, juntarMensagens, lerAbertura, lerMensagem, lerPresenca, lerResumo, lerSala, limitesPorExtenso, minhasSalas,
  montarLinhas, naoLidasPorSala, partesDoTexto, pedidosEsperando, pessoasComPresenca, primeiraNaoLida, rascunhoDaResposta, rotuloDoDia,
  textoSobreProduto, tituloComAviso, trechoDe,
  type Mensagem,
} from "../src/lib/time/chat.ts";
import { abasDaBarra, ondeEstou, setoresDe, SETORES } from "../src/lib/painel/setores.ts";

let falhas = 0;
function confere(nome: string, ok: boolean, detalhe = "") {
  if (ok) console.log(`  ok  ${nome}`);
  else {
    falhas++;
    console.error(`  ERRO ${nome}${detalhe ? `\n       ${detalhe}` : ""}`);
  }
}

function resposta(id: string, a: Partial<Resposta>): Resposta {
  return {
    id,
    tema: "pos_venda",
    pergunta: "Pergunta de exemplo?",
    explicacao: "Explicação de exemplo.",
    frase: null,
    estado: "a_confirmar",
    origem: null,
    criadoPor: null,
    criadoPorNome: null,
    criadoEm: "2026-11-14T12:00:00Z",
    confirmadoPorNome: null,
    confirmadoEm: null,
    atualizadoEm: "2026-11-14T12:00:00Z",
    conversa: null,
    ...a,
  };
}

const BIBLIOTECA: Resposta[] = [
  resposta("polir", {
    tema: "pos_venda",
    pergunta: "O polimento custa alguma coisa?",
    explicacao: "Polir e limpar é serviço da casa, sem custo. Só a reposição de pedra é cobrada.",
    frase: "O polimento é por nossa conta, quantas vezes você precisar.",
    estado: "confirmada",
  }),
  resposta("escureceu", {
    tema: "pos_venda",
    pergunta: "A aliança de prata escureceu. Tem garantia?",
    explicacao: "Prata oxida, é normal. A garantia cobre limpeza e polimento.",
    frase: "A prata escurece com o uso, e a limpeza é por nossa conta.",
  }),
  resposta("troca", {
    tema: "troca",
    pergunta: "Se o número não servir, pode trocar?",
    explicacao: "Pode. A primeira troca de numeração não tem custo.",
    frase: "Se não servir, a primeira troca é por nossa conta.",
    estado: "confirmada",
  }),
  resposta("pix", {
    tema: "pagamento_pedido",
    pergunta: "O QR code deu erro. Tem chave Pix?",
    explicacao: "Tem. O comprovante vai para a diretoria conferir.",
  }),
  resposta("gravar", {
    tema: "gravacao_produto",
    pergunta: "Cabe gravação nesta aliança?",
    explicacao: "Depende da espessura. Em aliança fina cabe o nome e a data.",
  }),
  resposta("malote", {
    tema: "estoque_prazo",
    pergunta: "Como funciona o malote?",
    explicacao: "A fábrica manda as peças para as lojas em dias fixos da semana.",
  }),
  resposta("velha", {
    tema: "pos_venda",
    pergunta: "O polimento tem taxa depois de um ano?",
    explicacao: "Regra antiga de polimento, que saiu de uso.",
    estado: "arquivada",
  }),
];

console.log("Texto e temas");
{
  confere("sem acento e em minúsculas", semAcento("Polimento É GRÁTIS, não é?") === "polimento e gratis, nao e?");
  confere("os sete temas da trava do banco", TEMAS.map((t) => t.chave).join() === "estoque_prazo,preco_personalizado,troca,pos_venda,gravacao_produto,pagamento_pedido,processo");
  confere("tema e estado desconhecidos não passam", lerTema("troca") === "troca" && lerTema("desconto") === null && lerEstado("confirmada") === "confirmada" && lerEstado("publicada") === null);
  confere("palavras vazias saem, e pontuação também", palavrasDoTexto("O cliente quer saber se o polimento custa!").join() === "saber,polimento,custa");
  confere("número e medida ficam", palavrasDoTexto("Prata 950 de 3 mm").join() === "prata,950,mm");
}

console.log("\nA busca da tela");
{
  const todas = { busca: "", tema: "todos", estado: "todos" } as const;
  const lista = filtrarRespostas(BIBLIOTECA, todas);
  confere("sem busca, vem tudo menos a arquivada", lista.length === 6 && !lista.some((r) => r.id === "velha"));
  confere("sem busca, a ordem é a dos temas", lista[0].tema === "estoque_prazo" && lista[lista.length - 1].tema === "pagamento_pedido");
  confere("dentro do tema, a confirmada vem antes da a confirmar", filtrarRespostas(BIBLIOTECA, { ...todas, tema: "pos_venda" }).map((r) => r.id).join() === "polir,escureceu");
  confere("acha sem acento e pelo meio da palavra", filtrarRespostas(BIBLIOTECA, { ...todas, busca: "gravacao" }).map((r) => r.id).join() === "gravar" && filtrarRespostas(BIBLIOTECA, { ...todas, busca: "POLIM" }).length === 2);
  confere("com duas palavras, as duas precisam aparecer", filtrarRespostas(BIBLIOTECA, { ...todas, busca: "prata garantia" }).map((r) => r.id).join() === "escureceu" && filtrarRespostas(BIBLIOTECA, { ...todas, busca: "prata pix" }).length === 0);
  confere("a palavra na pergunta sobe antes da palavra só na explicação", filtrarRespostas(BIBLIOTECA, { ...todas, busca: "polimento" })[0].id === "polir");
  confere("acha pela frase pronta", filtrarRespostas(BIBLIOTECA, { ...todas, busca: "quantas vezes" }).map((r) => r.id).join() === "polir");
  confere("filtro de estado: só a confirmar", filtrarRespostas(BIBLIOTECA, { ...todas, estado: "a_confirmar" }).every((r) => r.estado === "a_confirmar") && filtrarRespostas(BIBLIOTECA, { ...todas, estado: "a_confirmar" }).length === 4);
  confere("a arquivada só aparece quando o filtro pede", filtrarRespostas(BIBLIOTECA, { ...todas, estado: "arquivada" }).map((r) => r.id).join() === "velha");
  const n = contarPorTema(BIBLIOTECA);
  confere("a contagem por tema não soma a arquivada", n.todos === 6 && n.pos_venda === 2 && n.preco_personalizado === 0 && n.processo === 0);
}

console.log("\nA busca do tutor");
{
  confere("mesma família: polir e polimento, custa e custo, trocar e troca", mesmaFamilia("polir", "polimento") && mesmaFamilia("custa", "custo") && mesmaFamilia("trocar", "troca") && mesmaFamilia("gravar", "gravacao"));
  confere("palavra parecida só no começo não casa: prata e prazo, pedra e pedido", !mesmaFamilia("prata", "prazo") && !mesmaFamilia("pedra", "pedido"));
  confere("palavra curta só casa idêntica", mesmaFamilia("pix", "pix") && !mesmaFamilia("pix", "pia") && !mesmaFamilia("950", "925"));

  const polir = respostasProximas("o cliente quer saber se polir a aliança tem custo", BIBLIOTECA);
  confere("frase solta acha a resposta do polimento primeiro", polir[0]?.resposta.id === "polir", JSON.stringify(polir.map((p) => [p.resposta.id, p.pontos])));
  confere("os pontos vêm em ordem, do maior para o menor", polir.every((p, i) => i === 0 || polir[i - 1].pontos >= p.pontos));
  confere("resposta arquivada nunca entra", !respostasProximas("polimento tem taxa depois de um ano", BIBLIOTECA).some((p) => p.resposta.id === "velha"));
  confere("cada resposta diz o estado, para o tutor avisar quando a JK não confirmou", respostasProximas("o qr code deu erro, tem pix?", BIBLIOTECA)[0]?.resposta.estado === "a_confirmar");
  confere("pergunta sobre troca de número acha a troca", respostasProximas("a aliança ficou apertada, ela pode trocar o número?", BIBLIOTECA)[0]?.resposta.id === "troca");
  confere("texto sem nada em comum devolve lista vazia", respostasProximas("qual o horário do shopping no feriado", BIBLIOTECA).length === 0);
  confere("texto só com palavra vazia devolve lista vazia", respostasProximas("o que é isso?", BIBLIOTECA).length === 0 && respostasProximas("", BIBLIOTECA).length === 0);
  confere("o limite corta a lista", respostasProximas("aliança prata polimento gravação troca", BIBLIOTECA, 2).length === 2);
  const empate = respostasProximas("malote", [resposta("a", { pergunta: "Malote?", estado: "a_confirmar" }), resposta("b", { pergunta: "Malote?", estado: "confirmada" })]);
  confere("no empate, a confirmada vem antes", empate.map((p) => p.resposta.id).join() === "b,a");
}

console.log("\nEstado e o que cada nível pode");
{
  const aConfirmar = estadoEmPalavra("a_confirmar");
  confere("a confirmar é âmbar, com palavra e com aviso", aConfirmar.tom === "atencao" && aConfirmar.palavra === "A confirmar" && /ainda não confirmou/.test(aConfirmar.aviso ?? ""));
  confere("confirmada é verde e sem aviso", estadoEmPalavra("confirmada").tom === "bom" && estadoEmPalavra("confirmada").aviso === null);
  confere("arquivada não tem cor de estado", estadoEmPalavra("arquivada").tom === "neutro");

  const vendedor = oQuePode({ admin: false, souAutor: false, estado: "a_confirmar" });
  confere("quem não é da diretoria só lê a resposta dos outros", !vendedor.editar && !vendedor.confirmar && !vendedor.arquivar && !vendedor.reabrir);
  const autor = oQuePode({ admin: false, souAutor: true, estado: "a_confirmar" });
  confere("quem sugeriu edita a própria, e não confirma", autor.editar && !autor.confirmar && !autor.arquivar);
  confere("depois de confirmada, quem sugeriu não edita mais", !oQuePode({ admin: false, souAutor: true, estado: "confirmada" }).editar);
  const admin = oQuePode({ admin: true, souAutor: false, estado: "a_confirmar" });
  confere("administrador, dono e GM confirmam, editam e arquivam", admin.editar && admin.confirmar && admin.arquivar && !admin.reabrir);
  confere("o que já está confirmado não oferece confirmar de novo, e pode voltar para a confirmar", !oQuePode({ admin: true, souAutor: false, estado: "confirmada" }).confirmar && oQuePode({ admin: true, souAutor: false, estado: "confirmada" }).reabrir);
  confere("arquivada pode voltar, e não oferece arquivar de novo", !oQuePode({ admin: true, souAutor: false, estado: "arquivada" }).arquivar && oQuePode({ admin: true, souAutor: false, estado: "arquivada" }).reabrir);

  const ok = { tema: "troca", pergunta: "Pode trocar?", explicacao: "Pode, sim.", frase: "", origem: "" };
  confere("resposta completa passa", conferirResposta(ok) === null);
  confere("sem tema, sem pergunta e sem explicação não passa", conferirResposta({ ...ok, tema: "" }) !== null && conferirResposta({ ...ok, pergunta: "oi" }) !== null && conferirResposta({ ...ok, explicacao: " " }) !== null);
  confere("travessão é recusado", conferirResposta({ ...ok, frase: "Pode — sim" }) !== null && conferirResposta({ ...ok, explicacao: "Pode – sim" }) !== null);
}

// ---------------------------------------------------------------------- chat

const AGORA = Date.parse("2026-11-14T15:00:00-03:00");
const ha = (minutos: number) => new Date(AGORA - minutos * 60_000).toISOString();
const ANA = "11111111-1111-4111-8111-111111111111";
const BIA = "22222222-2222-4222-8222-222222222222";
const CAIO = "33333333-3333-4333-8333-333333333333";

function mensagem(id: number, a: Partial<Mensagem>): Mensagem {
  return {
    id,
    sala: "fabrica",
    autor: ANA,
    autorNome: "Ana",
    autorPapel: "vendas",
    texto: "Mensagem de exemplo",
    apagada: false,
    respondeA: null,
    pede: false,
    esperandoDesde: null,
    atendidaEm: null,
    atendidaPorNome: null,
    respostas: 0,
    naBiblioteca: null,
    em: ha(10),
    mudou: ha(10),
    anexos: [],
    ...a,
  };
}

console.log("\nAs salas do chat");
{
  confere("são seis salas: a geral e uma por setor, sem travessão em nenhum texto", SALAS.map((s) => s.chave).join() === "geral,vendas,fabrica,loja,trafego,diretoria" && SALAS.every((s) => !/[—–]/.test(s.nome + s.resolve)));
  confere("sala que não existe é recusada", lerSala("fabrica") === "fabrica" && lerSala("financeiro") === null && lerSala(null) === null && lerSala(3) === null);
  confere("as minhas salas: a geral e as do setor a que respondo", minhasSalas(["loja"]).join() === "geral,loja" && minhasSalas([]).join() === "geral" && minhasSalas(["diretoria", "vendas"]).join() === "geral,vendas,diretoria");
}

console.log("\nLer o que o banco devolve");
{
  const crua = {
    id: 12, sala: "loja", autor: ANA, autor_nome: "Ana", autor_papel: "vendas", texto: "Tem em Guarulhos?", apagada: false,
    responde_a: { id: 9, autor: BIA, autor_nome: "Bia", trecho: "Qual numeração?", apagada: false, imagens: 0 },
    pede: true, esperando_desde: ha(5), atendida_em: null, atendida_por_nome: null, respostas: 2, na_biblioteca: null, em: ha(5), mudou: ha(4),
    anexos: ["a1", 7, null, "a2"],
  };
  const m = lerMensagem(crua);
  confere("a mensagem do banco vira mensagem da tela", m !== null && m.id === 12 && m.sala === "loja" && m.pede && m.respostas === 2 && m.respondeA?.id === 9 && m.respondeA.autorNome === "Bia");
  confere("anexo que não é texto fica de fora", m?.anexos.join() === "a1,a2");
  confere("mensagem sem número, sem sala ou sem data não entra", lerMensagem({ ...crua, id: 0 }) === null && lerMensagem({ ...crua, sala: "x" }) === null && lerMensagem({ ...crua, em: null }) === null && lerMensagem(null) === null && lerMensagem("oi") === null);
  const a = lerAbertura({ agora: ha(0), setores: ["loja", "inventado"], lidas: { loja: 9, geral: "3", x: 5 }, pessoas: [{ id: ANA, nome: "Ana", papel: "vendas" }, { nome: "sem id" }], janelas: { fabrica: 41 }, mensagens: [crua, { id: 1 }] });
  confere("a abertura lê setores, leituras, pessoas, janelas e mensagens, e descarta o que veio torto", a !== null && a.setores.join() === "loja" && a.lidas.loja === 9 && a.lidas.geral === 3 && Object.keys(a.lidas).length === 2
    && a.pessoas.length === 1 && a.janelas.fabrica === 41 && a.mensagens.length === 1);
  confere("sem acesso o banco devolve nada, e a abertura é nula", lerAbertura(null) === null && lerAbertura({}) === null);
  const r = lerResumo({ novas: 3, pedidos: 1, pedidos_do_setor: 2, desde: ha(40) });
  confere("o resumo do menu: o que não li mais o pedido lido que o meu setor ainda deve", esperandoPorMim(r) === 4 && r.pedidosDoSetor === 2 && esperandoPorMim(lerResumo(null)) === 0 && esperandoPorMim(lerResumo({ novas: -5, pedidos: "x" })) === 0);
  confere("o número do menu vai no endereço do chat", avisosDoMenu(r)[ENDERECO_DO_CHAT] === 4 && ENDERECO_DO_CHAT === "/admin/chat");
}

console.log("\nJuntar e sincronizar");
{
  const base = [mensagem(1, { mudou: ha(30) }), mensagem(2, { mudou: ha(20) })];
  const juntas = juntarMensagens(base, [mensagem(3, { mudou: ha(1) }), mensagem(2, { mudou: ha(5), texto: "Editada" })]);
  confere("mensagem nova entra e a que mudou troca a antiga, em ordem de número", juntas.map((m) => m.id).join() === "1,2,3" && juntas[1].texto === "Editada");
  confere("versão mais velha da mesma mensagem não desfaz a mais nova", juntarMensagens(juntas, [mensagem(2, { mudou: ha(25), texto: "Antiga" })])[1].texto === "Editada");
  confere("sem novidade, a lista é a MESMA (a tela não redesenha)", juntarMensagens(base, []) === base && juntarMensagens(juntas, [mensagem(2, { mudou: ha(25) })]) === juntas);
  confere("a sincronia pede a partir da última mudança vista, menos a folga", Date.parse(desdeQuandoSincronizar(juntas, ha(60))) === Date.parse(ha(1)) - FOLGA_DA_SINCRONIA_MS);
  confere("sem mensagem, pede a partir da hora em que a tela abriu", Date.parse(desdeQuandoSincronizar([], ha(60))) === Date.parse(ha(60)) - FOLGA_DA_SINCRONIA_MS);
  const duas = [mensagem(1, { sala: "geral" }), mensagem(2, {}), mensagem(40, {}), mensagem(41, {})];
  confere("a conversa da sala: só as dela, e a partir da janela quando a sala tem mais", daSala(duas, "fabrica").map((m) => m.id).join() === "2,40,41" && daSala(duas, "fabrica", 40).map((m) => m.id).join() === "40,41" && daSala(duas, "loja").length === 0);
}

console.log("\nO que não li");
{
  const lista = [
    mensagem(1, { sala: "geral", autor: BIA }),
    mensagem(2, { sala: "geral", autor: ANA }),
    mensagem(3, { sala: "geral", autor: BIA, apagada: true }),
    mensagem(4, { sala: "fabrica", autor: BIA }),
    mensagem(5, { sala: "fabrica", autor: CAIO }),
    mensagem(6, { sala: "loja", autor: BIA, em: ha((DIAS_DE_NAO_LIDA + 1) * 1440) }),
  ];
  const n = naoLidasPorSala(lista, { fabrica: 4 }, ANA, AGORA);
  confere("não lida: depois de onde li, de outra pessoa, não apagada", n.geral === 1 && n.fabrica === 1 && n.vendas === 0);
  confere("mensagem velha demais não conta como não lida", n.loja === 0);
  confere("a linha de novas entra na primeira que não li", primeiraNaoLida(daSala(lista, "fabrica"), 4, ANA, AGORA) === 5 && primeiraNaoLida(daSala(lista, "fabrica"), 5, ANA, AGORA) === null && primeiraNaoLida(daSala(lista, "geral"), 0, ANA, AGORA) === 1);
  confere("a minha própria mensagem nunca é nova para mim", naoLidasPorSala([mensagem(9, { autor: ANA })], {}, ANA, AGORA).fabrica === 0);
}

console.log("\nO pedido e a espera");
{
  const pedido = (a: Partial<Mensagem>) => mensagem(1, { pede: true, esperandoDesde: ha(5), ...a });
  confere("mensagem comum não tem espera", esperaDoPedido(mensagem(1, {}), AGORA) === null && !estaEsperando(mensagem(1, {})));
  const novo = esperaDoPedido(pedido({}), AGORA);
  confere("pedido novo: sem cor, com o tempo", novo?.tom === "neutro" && novo.palavra === "Esperando há 5 min" && esperaDoPedido(pedido({ esperandoDesde: ha(0) }), AGORA)?.palavra === "Esperando resposta");
  const parado = esperaDoPedido(pedido({ esperandoDesde: ha(LIMITES_DO_PEDIDO.atencao) }), AGORA);
  confere("no limite de atenção fica âmbar", parado?.tom === "atencao" && parado.palavra === "Parado há 30 min");
  const atrasado = esperaDoPedido(pedido({ esperandoDesde: ha(LIMITES_DO_PEDIDO.atraso + 60) }), AGORA);
  confere("no limite de atraso fica vermelho", atrasado?.tom === "ruim" && atrasado.palavra === "3 h sem resposta");
  const atendido = esperaDoPedido(pedido({ esperandoDesde: ha(9999), atendidaEm: ha(1), atendidaPorNome: "Bia", respostas: 1 }), AGORA);
  confere("atendido é verde e diz por quem, por mais velho que seja", atendido?.tom === "bom" && atendido.palavra === "Respondido por Bia" && esperaDoPedido(pedido({ atendidaEm: ha(1), respostas: 2 }), AGORA)?.palavra === "Respondido");
  confere("marcado como resolvido sem resposta diz resolvido, e não respondido", esperaDoPedido(pedido({ atendidaEm: ha(1), atendidaPorNome: "Bia" }), AGORA)?.palavra === "Resolvido por Bia" && esperaDoPedido(pedido({ atendidaEm: ha(1) }), AGORA)?.palavra === "Resolvido");
  confere("pedido apagado não espera nada", esperaDoPedido(pedido({ apagada: true }), AGORA) === null && !estaEsperando(pedido({ apagada: true })));
  confere("sem a hora do pedido, a espera conta da hora da mensagem", esperaDoPedido(pedido({ esperandoDesde: null, em: ha(45) }), AGORA)?.tom === "atencao");
  const fila = pedidosEsperando([
    mensagem(1, { pede: true, esperandoDesde: ha(5) }),
    mensagem(2, { pede: true, esperandoDesde: ha(200), sala: "loja" }),
    mensagem(3, { pede: true, esperandoDesde: ha(90), atendidaEm: ha(1) }),
    mensagem(4, { pede: true, esperandoDesde: ha(60) }),
    mensagem(5, {}),
  ]);
  confere("os que esperam, do mais antigo para o mais novo, sem os atendidos", fila.map((m) => m.id).join() === "2,4,1" && pedidosEsperando(fila, "fabrica").map((m) => m.id).join() === "4,1");
  confere("duração em palavra", duracaoEmPalavra(0) === "agora" && duracaoEmPalavra(12) === "12 min" && duracaoEmPalavra(60) === "1 h" && duracaoEmPalavra(47 * 60) === "47 h" && duracaoEmPalavra(49 * 60) === "2 dias");
  confere("a frase dos limites diz que é premissa, sem travessão", limitesPorExtenso().includes("premissa") && limitesPorExtenso().includes("30 min") && limitesPorExtenso().includes("2 h") && !/[—–]/.test(limitesPorExtenso()));
}

console.log("\nQuem está online");
{
  const canal = {
    [ANA]: [{ id: ANA, v: false }, { id: ANA, v: true }],
    [BIA]: [{ id: BIA.toUpperCase(), v: false }],
    intruso: [{ id: "não é um id", v: true }, { nome: "sem id" }, "texto solto"],
    torto: "não é lista",
  };
  const presenca = lerPresenca(canal);
  confere("uma aba à vista basta para estar online; só aba escondida é ausente", presenca.get(ANA) === "online" && presenca.get(BIA) === "ausente");
  confere("registro sem id de verdade não vira presença", presenca.size === 2 && lerPresenca(null).size === 0 && lerPresenca("x").size === 0);
  const lista = pessoasComPresenca([{ id: CAIO, nome: "Caio", papel: "fabrica" }, { id: BIA, nome: "Bia", papel: "gerente" }, { id: ANA, nome: "Ana", papel: "vendas" }, { id: "x", nome: "Zé", papel: "gm" }], presenca);
  confere("a lista: online, depois em outra aba, depois quem está fora, por nome", lista.map((p) => `${p.nome}:${p.presenca}`).join() === "Ana:online,Bia:ausente,Caio:fora,Zé:fora");
  confere("o nome nunca vem do canal: quem não está na lista do banco não aparece", pessoasComPresenca([], presenca).length === 0);
  confere("as iniciais", iniciais("Ana Paula Souza") === "AS" && iniciais("bia") === "BI" && iniciais("") === "?" && iniciais(null) === "?");
}

console.log("\nA conversa em linhas");
{
  const ontem = AGORA - 86_400_000;
  const lista = [
    mensagem(1, { em: new Date(ontem).toISOString(), autor: BIA }),
    mensagem(2, { em: ha(40), autor: BIA }),
    mensagem(3, { em: ha(38), autor: BIA }),
    mensagem(4, { em: ha(20), autor: BIA }),
    mensagem(5, { em: ha(19), autor: ANA }),
    mensagem(6, { em: ha(18), autor: ANA }),
  ];
  const linhas = montarLinhas(lista, 6);
  confere("um separador por dia e a linha de novas antes da primeira não lida", linhas.map((l) => l.tipo).join() === "dia,fala,dia,fala,fala,fala,fala,novas,fala");
  const cabecas = linhas.filter((l) => l.tipo === "fala").map((l) => (l.tipo === "fala" && l.cabeca ? "c" : "-")).join("");
  confere("o nome aparece uma vez por sequência: muda com o dia, com a pessoa, com a pausa e com a linha de novas", cabecas === "cc-cc" + "c");
  confere("os dias no relógio de São Paulo", diaDe("2026-11-15T02:30:00Z") === "2026-11-14" && diaDe("2026-11-15T03:30:00Z") === "2026-11-15" && diaDe("torto") === "");
  confere("hoje, ontem e o dia da semana", rotuloDoDia(diaDe(AGORA), AGORA) === "Hoje" && rotuloDoDia(diaDe(ontem), AGORA) === "Ontem" && /10\/11/.test(rotuloDoDia("2026-11-10", AGORA)) && /ter/i.test(rotuloDoDia("2026-11-10", AGORA)));
  confere("a hora curta é a de São Paulo", horaCurta("2026-11-14T18:05:00Z") === "15:05");

  const partes = partesDoTexto("Veja em https://exemplo.test/par?x=1. E também http://exemplo.test/a), certo?");
  confere("o endereço vira link e a pontuação do fim fica de fora", partes.map((p) => `${p.tipo}:${p.valor}`).join("|") === "texto:Veja em |link:https://exemplo.test/par?x=1|texto:. E também |link:http://exemplo.test/a|texto:), certo?");
  confere("texto sem endereço é uma parte só, e script não vira link", partesDoTexto("Bom dia").length === 1 && partesDoTexto("javascript:alert(1)").every((p) => p.tipo === "texto"));
  confere("o trecho de uma linha: texto cortado, imagem, ou apagada", trechoDe(mensagem(1, { texto: "a\n b   c" })) === "a b c" && trechoDe(mensagem(1, { texto: "", anexos: ["x"] })) === "Imagem" && trechoDe(mensagem(1, { texto: "", anexos: ["x", "y"] })) === "2 imagens"
    && trechoDe(mensagem(1, { apagada: true, texto: "segredo" })) === "Mensagem apagada" && trechoDe(mensagem(1, { texto: "x".repeat(200) }), 20).length === 20);
  confere("o título da aba ganha e perde o número, sem acumular", tituloComAviso("Chat do time", 3) === "(3) Chat do time" && tituloComAviso("(3) Chat do time", 5) === "(5) Chat do time" && tituloComAviso("(5) Chat do time", 0) === "Chat do time" && tituloComAviso("Vendas", 120) === "(99+) Vendas");
}

console.log("\nTextos e imagem");
{
  const texto = textoSobreProduto({ nome: "Par de alianças de exemplo 4 mm", codigo: "9001", url: "https://exemplo.test/par" });
  confere("a pergunta que nasce na consulta já cita a peça, o código e o link", texto.startsWith("Sobre a peça: Par de alianças de exemplo 4 mm (cód. 9001)\nhttps://exemplo.test/par\n") && texto.endsWith("Loja, numeração e para quando: "));
  confere("sem código e sem link, só o nome", textoSobreProduto({ nome: "Anel de exemplo" }).startsWith("Sobre a peça: Anel de exemplo\n"));

  const pergunta = mensagem(10, { texto: "Tem  esse modelo\nna loja de exemplo?", autor: ANA });
  const cita = { id: 10, autor: ANA, autorNome: "Ana", trecho: "", apagada: false, imagens: 0 };
  const rascunho = rascunhoDaResposta(pergunta, [
    pergunta,
    mensagem(11, { autor: BIA, texto: "Tem sim.", respondeA: cita }),
    mensagem(12, { autor: ANA, texto: "Obrigada!", respondeA: cita }),
    mensagem(13, { autor: BIA, texto: "  Chega no próximo malote. ", respondeA: cita }),
    mensagem(14, { autor: BIA, texto: "", respondeA: cita }),
    mensagem(15, { autor: BIA, texto: "Resposta apagada", respondeA: cita, apagada: true }),
    mensagem(16, { autor: CAIO, texto: "Mensagem solta, sem responder a ela" }),
  ]);
  confere("o rascunho da biblioteca: a pergunta é a mensagem, numa linha só", rascunho.pergunta === "Tem esse modelo na loja de exemplo?");
  confere("a explicação junta só o que os OUTROS responderam A ELA, em ordem", rascunho.explicacao === "Tem sim.\nChega no próximo malote.");

  confere("imagem: só os quatro tipos, até 5 MB", conferirImagem({ tipo: "image/png", tamanho: 1000 }) === null && conferirImagem({ tipo: "application/pdf", tamanho: 1000 }) !== null
    && conferirImagem({ tipo: "image/jpeg", tamanho: 5 * 1024 * 1024 + 1 }) !== null && conferirImagem({ tipo: "image/webp", tamanho: 0 }) !== null);
  confere("o caminho da imagem: pasta de quem envia, nome sorteado, sem o nome do arquivo", caminhoDaImagem("u-123", "ab12-cd34", "image/png") === "u-123/ab12-cd34.png" && caminhoDaImagem("u-123", "../x y", "image/jpeg") === "u-123/xy.jpg");
}

console.log("\nO setor Time no menu");
{
  const time = SETORES.find((s) => s.id === "time");
  confere("o setor existe, com o tutor, a biblioteca e o chat", time?.itens.map((i) => i.href).join() === "/admin/tutor,/admin/biblioteca,/admin/chat" && time.itens.every((i) => i.area === "time"));
  confere("a cor do setor não é verde, âmbar nem vermelho de estado", time !== undefined && !["#046c4e", "#9a4a07", "#b01919"].includes(time.cor) && new Set(SETORES.map((s) => s.cor)).size === SETORES.length);

  const vendedor = setoresDe(["consulta", "lancar_venda", "recuperacao", "time"]);
  confere("o vendedor vê três salas: início, vendas e time", vendedor.map((s) => s.id).join() === "diretoria,vendas,time");
  confere("com três salas, a barra de baixo do vendedor é por setor", abasDaBarra(vendedor).map((a) => a.label).join() === "Início,Vendas,Time" && abasDaBarra(vendedor)[2].href === "/admin/tutor");
  const fabrica = setoresDe(["consulta", "fabrica", "time"]);
  confere("a fábrica vê quatro salas, e todas cabem na barra", abasDaBarra(fabrica).map((a) => a.label).join() === "Início,Vendas,Time,Fábrica");
  const tudo = setoresDe(["conteudo", "site", "catalogo", "campanhas", "vendas", "recuperacao", "metricas", "anuncios", "margem", "custos", "equipe", "lancar_venda", "trafego", "loja", "fabrica", "consulta", "time"]);
  confere("para quem vê tudo, o Time fica entre os quatro da barra", abasDaBarra(tudo).map((a) => a.label).join() === "Início,Vendas,Time,Tráfego");
  confere("o chat acende o item dele no setor Time", ondeEstou(tudo, "/admin/chat").item?.href === "/admin/chat" && ondeEstou(tudo, "/admin/biblioteca").setor?.id === "time");
  const frases = time ? [time.nome, time.frase, ...time.itens.flatMap((i) => [i.label, i.desc, i.curto ?? ""])] : [];
  confere("nenhum nome do setor com travessão", frases.every((f) => !/[—–]/.test(f)));
}

if (falhas > 0) {
  console.error(`\n${falhas} ${falhas === 1 ? "conferência falhou" : "conferências falharam"}.`);
  process.exit(1);
}
console.log("\nTudo certo.");
