/**
 * Confere as contas da Biblioteca JK e dos chamados entre setores. Roda sem
 * banco e sem navegador:
 *   node --experimental-strip-types scripts/teste-biblioteca.mts
 *
 * As respostas e os chamados daqui são INVENTADOS, só com a forma dos de
 * verdade. Nenhuma regra da casa, nenhum valor e nenhum cliente mora neste
 * arquivo: o conteúdo da biblioteca fica no banco.
 */
import {
  TEMAS, conferirResposta, contarPorTema, estadoEmPalavra, filtrarRespostas, lerEstado, lerTema, mesmaFamilia, oQuePode,
  palavrasDoTexto, respostasProximas, semAcento, type Resposta,
} from "../src/lib/time/biblioteca.ts";
import {
  AVISO_ANTES_DO_PRAZO, LIMITES_DA_ESPERA, SEM_FILTRO, SETORES_DO_CHAMADO, TIPOS,
  avisosDoMenu, caminhoDaImagem, conferirImagem, duracaoEmPalavra, ehParaMim, esperaDoChamado, filtrarChamados, lerPrecisoAte, lerSetor, lerTipo,
  limitesPorExtenso, oQueEsperaPorMim, ordenarChamados, paraQuem, piorEspera, podeResolver, rascunhoDaResposta, textoSobreProduto,
  type Chamado,
} from "../src/lib/time/chamados.ts";
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
    chamado: null,
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

// ------------------------------------------------------------------ chamados

const AGORA = Date.parse("2026-11-14T15:00:00-03:00");
const ha = (minutos: number) => new Date(AGORA - minutos * 60_000).toISOString();

function chamado(numero: number, a: Partial<Chamado>): Chamado {
  return {
    id: `c${numero}`,
    numero,
    tipo: "duvida",
    texto: "Pedido de exemplo",
    paraSetor: "fabrica",
    paraPessoa: null,
    paraPessoaNome: null,
    abertoPor: "ana",
    abertoPorNome: "Ana",
    estado: "aberto",
    precisoAte: null,
    produto: null,
    aguardandoDesde: ha(5),
    criadoEm: ha(5),
    atualizadoEm: ha(5),
    mensagens: 0,
    anexos: 0,
    ultima: null,
    naBiblioteca: false,
    ...a,
  };
}

console.log("\nA espera do chamado");
{
  confere("os quatro tipos e os cinco setores da trava do banco", TIPOS.map((t) => t.chave).join() === "duvida,orcamento,estoque_prazo,outro" && SETORES_DO_CHAMADO.map((s) => s.chave).join() === "vendas,fabrica,loja,trafego,diretoria");
  confere("tipo e setor desconhecidos não passam", lerTipo("orcamento") === "orcamento" && lerTipo("reclamacao") === null && lerSetor("loja") === "loja" && lerSetor("rh") === null);
  confere("duração curta: agora, minutos, horas e dias", duracaoEmPalavra(0) === "agora" && duracaoEmPalavra(45) === "45 min" && duracaoEmPalavra(60) === "1 h" && duracaoEmPalavra(26 * 60) === "26 h" && duracaoEmPalavra(3 * 1440) === "3 dias");

  const novo = esperaDoChamado(chamado(1, { aguardandoDesde: ha(5) }), AGORA);
  confere("dúvida aberta há pouco não tem cor", novo.tom === "neutro" && novo.palavra === "Aberto há 5 min");
  const parado = esperaDoChamado(chamado(1, { aguardandoDesde: ha(LIMITES_DA_ESPERA.duvida.atencao) }), AGORA);
  confere("dúvida no limite de atenção fica âmbar, com a palavra", parado.tom === "atencao" && parado.palavra === "Parado há 30 min");
  const atrasado = esperaDoChamado(chamado(1, { aguardandoDesde: ha(LIMITES_DA_ESPERA.duvida.atraso + 60) }), AGORA);
  confere("dúvida além do limite de atraso fica vermelha", atrasado.tom === "ruim" && atrasado.palavra === "Atrasado, 3 h sem resposta");
  confere("orçamento espera mais antes de mudar de cor", esperaDoChamado(chamado(1, { tipo: "orcamento", aguardandoDesde: ha(180) }), AGORA).tom === "neutro"
    && esperaDoChamado(chamado(1, { tipo: "orcamento", aguardandoDesde: ha(300) }), AGORA).tom === "atencao");
  confere("orçamento parado há 26 horas é vermelho", esperaDoChamado(chamado(1, { tipo: "orcamento", aguardandoDesde: ha(26 * 60) }), AGORA).tom === "ruim");
  confere("respondido é verde e resolvido não tem cor, por mais velhos que sejam", esperaDoChamado(chamado(1, { estado: "respondido", aguardandoDesde: ha(9999) }), AGORA).tom === "bom"
    && esperaDoChamado(chamado(1, { estado: "resolvido", aguardandoDesde: ha(9999) }), AGORA).tom === "neutro");

  const vencido = esperaDoChamado(chamado(1, { aguardandoDesde: ha(5), precisoAte: ha(10) }), AGORA);
  confere("prazo pedido vencido deixa vermelho mesmo recém-aberto", vencido.tom === "ruim" && vencido.palavra === "Passou do prazo há 10 min");
  const perto = esperaDoChamado(chamado(1, { aguardandoDesde: ha(5), precisoAte: new Date(AGORA + 40 * 60_000).toISOString() }), AGORA);
  confere("prazo pedido chegando deixa âmbar", perto.tom === "atencao" && perto.palavra === "Faltam 40 min para o prazo");
  confere("prazo pedido longe não muda a cor", esperaDoChamado(chamado(1, { aguardandoDesde: ha(5), precisoAte: new Date(AGORA + (AVISO_ANTES_DO_PRAZO + 30) * 60_000).toISOString() }), AGORA).tom === "neutro");
  confere("vale o pior dos dois: atrasado continua atrasado com prazo longe", esperaDoChamado(chamado(1, { aguardandoDesde: ha(500), precisoAte: new Date(AGORA + 9999 * 60_000).toISOString() }), AGORA).tom === "ruim");
  const duas = [chamado(1, { aguardandoDesde: ha(300) }), chamado(2, { tipo: "orcamento", aguardandoDesde: ha(900) }), chamado(3, { estado: "respondido" })];
  confere("a pior espera é a cor mais grave, não a mais longa", piorEspera(duas, AGORA)?.tom === "ruim" && piorEspera(duas, AGORA)?.minutos === 300);
  confere("sem chamado aberto não há pior espera", piorEspera([chamado(1, { estado: "respondido" })], AGORA) === null && piorEspera([], AGORA) === null);
  confere("a frase dos limites sai dos próprios limites", limitesPorExtenso().includes("âmbar depois de 30 min e vermelho depois de 2 h") && limitesPorExtenso().includes("âmbar depois de 4 h e vermelho depois de 24 h"));
}

console.log("\nPara quem é e o que espera por mim");
{
  const daFabrica = { id: "bia", setores: ["fabrica"] };
  const daVenda = { id: "ana", setores: ["vendas"] };
  const semSetor = { id: "edu", setores: [] as string[] };
  const paraAFabrica = chamado(1, {});
  const paraOEdu = chamado(2, { paraSetor: null, paraPessoa: "edu", paraPessoaNome: "Edu" });

  confere("para quem: o setor ou o nome da pessoa", paraQuem(paraAFabrica) === "Fábrica" && paraQuem(paraOEdu) === "Edu");
  confere("chamado do setor é de quem responde por ele", ehParaMim(paraAFabrica, daFabrica) && !ehParaMim(paraAFabrica, daVenda) && !ehParaMim(paraAFabrica, semSetor));
  confere("chamado no nome é só da pessoa", ehParaMim(paraOEdu, semSetor) && !ehParaMim(paraOEdu, daFabrica));
  confere("resolve quem abriu, quem recebeu e a diretoria", podeResolver(paraAFabrica, daVenda, false) && podeResolver(paraAFabrica, daFabrica, false) && !podeResolver(paraAFabrica, semSetor, false) && podeResolver(paraAFabrica, semSetor, true));

  const lista = [
    paraAFabrica,
    paraOEdu,
    chamado(3, { estado: "respondido" }),
    chamado(4, { abertoPor: "bia", abertoPorNome: "Bia", paraSetor: "fabrica" }),
    chamado(5, { estado: "resolvido" }),
  ];
  const meuDaFabrica = oQueEsperaPorMim(lista, daFabrica);
  confere("a fábrica tem um para responder: o que ela mesma abriu não conta", meuDaFabrica.paraResponder.map((c) => c.numero).join() === "1" && meuDaFabrica.respondidos.length === 0);
  const meuDaVenda = oQueEsperaPorMim(lista, daVenda);
  confere("quem abriu vê a resposta que chegou", meuDaVenda.paraResponder.length === 0 && meuDaVenda.respondidos.map((c) => c.numero).join() === "3");

  confere("o número do menu soma o que espera a pessoa e as respostas que chegaram", avisosDoMenu({ paraResponder: 2, respondidos: 1 })["/admin/chamados"] === 3 && avisosDoMenu({ paraResponder: 0, respondidos: 0 })["/admin/chamados"] === 0);
  confere("sem filtro, a lista é o que está em andamento", filtrarChamados(lista, SEM_FILTRO, daVenda).map((c) => c.numero).join() === "1,2,3,4");
  confere("filtro para o meu setor", filtrarChamados(lista, { ...SEM_FILTRO, quem: "para_mim" }, daFabrica).map((c) => c.numero).join() === "1,3,4");
  confere("filtro abertos por mim", filtrarChamados(lista, { ...SEM_FILTRO, quem: "meus" }, daFabrica).map((c) => c.numero).join() === "4");
  confere("filtro por tipo", filtrarChamados([chamado(1, {}), chamado(2, { tipo: "orcamento" })], { ...SEM_FILTRO, tipo: "orcamento" }, daVenda).map((c) => c.numero).join() === "2");
  confere("os resolvidos ficam numa lista à parte", filtrarChamados(lista, { ...SEM_FILTRO, resolvidos: true }, daVenda).map((c) => c.numero).join() === "5");

  const ordem = ordenarChamados([
    chamado(1, { aguardandoDesde: ha(5) }),
    chamado(2, { aguardandoDesde: ha(200) }),
    chamado(3, { aguardandoDesde: ha(45) }),
    chamado(4, { estado: "respondido", atualizadoEm: ha(1) }),
    chamado(5, { estado: "resolvido", atualizadoEm: ha(0) }),
    chamado(6, { aguardandoDesde: ha(400) }),
  ], AGORA);
  confere("a ordem: vermelho mais antigo, vermelho, âmbar, sem cor, respondido, resolvido", ordem.map((c) => c.numero).join() === "6,2,3,1,4,5");
}

console.log("\nTextos, prazo e imagem");
{
  const texto = textoSobreProduto({ nome: "Par de alianças de exemplo 4 mm", codigo: "9001", url: "https://exemplo.test/par" });
  confere("o chamado da consulta já cita a peça, o código e o link", texto.startsWith("Sobre a peça: Par de alianças de exemplo 4 mm (cód. 9001)\nhttps://exemplo.test/par\n") && texto.endsWith("Loja, numeração e para quando: "));
  confere("sem código e sem link, só o nome", textoSobreProduto({ nome: "Anel de exemplo" }).startsWith("Sobre a peça: Anel de exemplo\n"));

  const rascunho = rascunhoDaResposta({
    texto: "Tem  esse modelo\nna loja de exemplo?",
    abertoPor: "ana",
    mensagens: [
      { id: 1, autor: "bia", autorNome: "Bia", autorPapel: "fabrica", texto: "Tem sim.", em: ha(3), imagens: [] },
      { id: 2, autor: "ana", autorNome: "Ana", autorPapel: "vendas", texto: "Obrigada!", em: ha(2), imagens: [] },
      { id: 3, autor: "bia", autorNome: "Bia", autorPapel: "fabrica", texto: "  Chega no próximo malote. ", em: ha(1), imagens: [] },
      { id: 4, autor: "bia", autorNome: "Bia", autorPapel: "fabrica", texto: "", em: ha(1), imagens: [] },
    ],
  });
  confere("o rascunho da biblioteca: a pergunta é o pedido, numa linha só", rascunho.pergunta === "Tem esse modelo na loja de exemplo?");
  confere("a explicação junta só o que os OUTROS responderam, em ordem", rascunho.explicacao === "Tem sim.\nChega no próximo malote.");

  confere("preciso até: 18h digitado no Brasil é 18h no Brasil", lerPrecisoAte("2026-11-14T18:00") === "2026-11-14T18:00:00-03:00" && Date.parse(lerPrecisoAte("2026-11-14T18:00")!) === Date.parse("2026-11-14T21:00:00Z"));
  confere("preciso até: vazio ou torto vira nada", lerPrecisoAte("") === null && lerPrecisoAte(null) === null && lerPrecisoAte("amanhã cedo") === null && lerPrecisoAte("2026-13-45T99:99") === null);

  confere("imagem: só os quatro tipos, até 5 MB", conferirImagem({ tipo: "image/png", tamanho: 1000 }) === null && conferirImagem({ tipo: "application/pdf", tamanho: 1000 }) !== null
    && conferirImagem({ tipo: "image/jpeg", tamanho: 5 * 1024 * 1024 + 1 }) !== null && conferirImagem({ tipo: "image/webp", tamanho: 0 }) !== null);
  confere("o caminho do print: pasta de quem envia, nome sorteado, sem o nome do arquivo", caminhoDaImagem("u-123", "ab12-cd34", "image/png") === "u-123/ab12-cd34.png" && caminhoDaImagem("u-123", "../x y", "image/jpeg") === "u-123/xy.jpg");
}

console.log("\nO setor Time no menu");
{
  const time = SETORES.find((s) => s.id === "time");
  confere("o setor existe, com a biblioteca e os chamados", time?.itens.map((i) => i.href).join() === "/admin/biblioteca,/admin/chamados" && time.itens.every((i) => i.area === "time"));
  confere("a cor do setor não é verde, âmbar nem vermelho de estado", time !== undefined && !["#046c4e", "#9a4a07", "#b01919"].includes(time.cor) && new Set(SETORES.map((s) => s.cor)).size === SETORES.length);

  const vendedor = setoresDe(["consulta", "lancar_venda", "recuperacao", "time"]);
  confere("o vendedor vê três salas: início, vendas e time", vendedor.map((s) => s.id).join() === "diretoria,vendas,time");
  confere("com três salas, a barra de baixo do vendedor é por setor", abasDaBarra(vendedor).map((a) => a.label).join() === "Início,Vendas,Time" && abasDaBarra(vendedor)[2].href === "/admin/biblioteca");
  const fabrica = setoresDe(["consulta", "fabrica", "time"]);
  confere("a fábrica vê quatro salas, e todas cabem na barra", abasDaBarra(fabrica).map((a) => a.label).join() === "Início,Vendas,Time,Fábrica");
  const tudo = setoresDe(["conteudo", "site", "catalogo", "campanhas", "vendas", "recuperacao", "metricas", "anuncios", "margem", "custos", "equipe", "lancar_venda", "trafego", "loja", "fabrica", "consulta", "time"]);
  confere("para quem vê tudo, o Time fica entre os quatro da barra", abasDaBarra(tudo).map((a) => a.label).join() === "Início,Vendas,Time,Tráfego");
  confere("o chamado aberto acende a tela de chamados", ondeEstou(tudo, "/admin/chamados/12").item?.href === "/admin/chamados" && ondeEstou(tudo, "/admin/biblioteca").setor?.id === "time");
  const frases = time ? [time.nome, time.frase, ...time.itens.flatMap((i) => [i.label, i.desc, i.curto ?? ""])] : [];
  confere("nenhum nome do setor com travessão", frases.every((f) => !/[—–]/.test(f)));
}

if (falhas > 0) {
  console.error(`\n${falhas} ${falhas === 1 ? "conferência falhou" : "conferências falharam"}.`);
  process.exit(1);
}
console.log("\nTudo certo.");
