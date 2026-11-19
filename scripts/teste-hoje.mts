/**
 * Confere a conta da tela Hoje (cartão 52). Roda sem banco e sem navegador:
 *   node --experimental-strip-types scripts/teste-hoje.mts
 *
 * As entradas são INVENTADAS, só com a forma das de verdade: nenhum cliente,
 * nenhum negócio de verdade.
 */
import { esperaEmPalavra, montarHoje, oQueOlharDepois, ordenar, piorTom, semRepetidos, type EntradaDoHoje, type Tarefa } from "../src/lib/painel/hoje.ts";
import { SETORES, abasDaBarra, nomeDoSetor, setoresDe } from "../src/lib/painel/setores.ts";

let falhas = 0;
function confere(nome: string, ok: boolean) {
  console.log(`${ok ? "ok  " : "ERRO"} ${nome}`);
  if (!ok) falhas++;
}

const VAZIA: EntradaDoHoje = {
  kommoMeus: null,
  kommoTime: null,
  vendasDaKommo: null,
  pedidosSemVendedor: null,
  oportunidades: null,
  suporte: null,
  chat: null,
  fabrica: null,
  recuperacao: null,
  saude: null,
};
const com = (x: Partial<EntradaDoHoje>): EntradaDoHoje => ({ ...VAZIA, ...x });
const LIDO = "2026-11-18T22:00:00Z";
const todosOsTextos = (h: ReturnType<typeof montarHoje>) =>
  [...h.tarefas, ...h.convites].flatMap((t) => [t.titulo, t.motivo, t.espera ?? "", t.botao.rotulo, ...t.itens.flatMap((i) => [i.texto, i.apoio ?? ""])]).concat(h.avisoDaKommo ?? "");

console.log("Palavras");
confere("espera curta", esperaEmPalavra(0) === "agora" && esperaEmPalavra(12) === "há 12 min" && esperaEmPalavra(180) === "há 3 h" && esperaEmPalavra(3 * 1440) === "há 3 dias");
confere("sem relógio não inventa espera", esperaEmPalavra(null) === null && esperaEmPalavra(Number.NaN) === null);
confere("o pior tom", piorTom(["neutro", "atencao", "ruim"]) === "ruim" && piorTom(["neutro", "atencao"]) === "atencao" && piorTom([]) === "neutro");

console.log("\nLista vazia");
{
  const h = montarHoje(VAZIA);
  confere("sem fonte, nada a fazer e nenhum convite", h.tarefas.length === 0 && h.convites.length === 0 && h.avisoDaKommo === null);
  const zeros = montarHoje(com({
    pedidosSemVendedor: 0,
    suporte: { fila: 0, esperaDaFila: null, comigo: 0, esperaComigo: null, novidades: 0 },
    chat: { novas: 0, pedidosDoSetor: 0, esperaDoPedido: null },
    fabrica: { atrasados: [] },
    recuperacao: { clientes: 0 },
    saude: [],
    oportunidades: { daSemana: [], atrasadas: 0, tomAtrasadas: "ruim" },
  }));
  confere("zero em cada fonte não vira item", zeros.tarefas.length === 0 && zeros.convites.length === 0);
}

console.log("\nKommo");
{
  const negocio = (id: number, motivo: "sem_resposta" | "esperando_vendedor", minutos: number, tom: "neutro" | "atencao" | "ruim") => ({
    id, nome: `Negócio ${id}`, cliente: `Cliente ${id}`, motivo, link: `https://exemplo.invalid/leads/detail/${id}`, minutos, tom,
  });
  const semMapa = montarHoje(com({ kommoMeus: { lidoEm: LIDO, mapeado: false, totais: { sem_resposta: 0, esperando_vendedor: 0 }, negocios: [] } }));
  confere("sem mapa: aviso discreto e nenhum negócio", semMapa.tarefas.length === 0 && /Quem é quem na Kommo/.test(semMapa.avisoDaKommo ?? ""));
  const nuncaLido = montarHoje(com({ kommoMeus: { lidoEm: null, mapeado: true, totais: { sem_resposta: 1, esperando_vendedor: 0 }, negocios: [negocio(1, "sem_resposta", 300, "ruim")] } }));
  confere("espelho nunca lido não vira tarefa", nuncaLido.tarefas.length === 0 && nuncaLido.avisoDaKommo === null);

  const h = montarHoje(com({
    kommoMeus: {
      lidoEm: LIDO,
      mapeado: true,
      totais: { sem_resposta: 2, esperando_vendedor: 190 },
      negocios: [
        negocio(10, "esperando_vendedor", 20000, "ruim"),
        negocio(11, "esperando_vendedor", 15000, "ruim"),
        negocio(12, "esperando_vendedor", 9000, "ruim"),
        negocio(13, "esperando_vendedor", 8000, "ruim"),
        negocio(20, "sem_resposta", 45, "atencao"),
        negocio(21, "sem_resposta", 35, "atencao"),
      ],
    },
  }));
  const parados = h.tarefas.find((t) => t.chave === "kommo-meus-esperando_vendedor");
  const semResp = h.tarefas.find((t) => t.chave === "kommo-meus-sem_resposta");
  confere("o total de cada motivo vem do banco, não do que coube na lista", parados?.titulo === "190 negócios seus parados em esperando vendedor" && semResp?.titulo === "2 clientes seus sem resposta na Kommo");
  confere("até três exemplos por tarefa, com o link da Kommo", parados?.itens.length === 3 && parados.itens.every((i) => i.externo && i.href?.startsWith("https://")));
  confere("o botão abre o mais antigo na Kommo, em outra aba", parados?.botao.href.endsWith("/10") === true && parados.botao.externo === true);
  confere("a cor é a pior da lista, e a espera é a do mais antigo", parados?.tom === "ruim" && parados.minutos === 20000 && semResp?.tom === "atencao" && semResp.minutos === 45);
  confere("o atrasado vem antes do que pede atenção", h.tarefas[0].chave === "kommo-meus-esperando_vendedor");

  const time = montarHoje(com({
    kommoTime: { lidoEm: LIDO, esperando: { atencao: 5, ruim: 2, tom: "ruim", minutos: 400 }, semResposta: { atencao: 0, ruim: 0, tom: "atencao", minutos: null } },
  }));
  confere("o alerta do time só entra com negócio passado do prazo", time.tarefas.length === 1 && time.tarefas[0].botao.href === "/admin/funil?alerta=esperando" && /2 passaram/.test(time.tarefas[0].motivo));
}

console.log("\nVendas da Kommo");
{
  const fila = [
    { negocioId: 1, quem: "Cliente A", vendedorId: "eu", motivo: "Ganho sem valor na Kommo", link: "https://exemplo.invalid/1", minutos: 3000 },
    { negocioId: 2, quem: "Cliente B", vendedorId: "outro", motivo: "Parece a mesma venda", link: "https://exemplo.invalid/2", minutos: 1000 },
  ];
  const gerencia = montarHoje(com({ vendasDaKommo: { eu: "eu", resolve: true, fila } }));
  confere("quem resolve vê a fila inteira numa tarefa só, sem repetir a parte dele", gerencia.tarefas.length === 1 && gerencia.tarefas[0].titulo === "2 vendas da Kommo para conferir");
  const vendedor = montarHoje(com({ vendasDaKommo: { eu: "eu", resolve: false, fila } }));
  confere("o vendedor vê só as dele", vendedor.tarefas.length === 1 && vendedor.tarefas[0].titulo === "1 venda sua da Kommo esperando conferência" && vendedor.tarefas[0].itens.length === 1);
  const outro = montarHoje(com({ vendasDaKommo: { eu: "ninguem", resolve: false, fila } }));
  confere("venda de outra pessoa não aparece para o vendedor", outro.tarefas.length === 0);
}

console.log("\nConvites e oportunidades");
{
  const so = montarHoje(com({ pedidosSemVendedor: 4, recuperacao: { clientes: 3 } }));
  confere("pedido sem vendedor e recuperação são convite, não tarefa", so.tarefas.length === 0 && so.convites.length === 2 && so.convites.some((c) => c.titulo === "4 pedidos do site sem vendedor") && so.convites.some((c) => c.titulo === "3 clientes criaram pedido e não pagaram"));
  const semana = montarHoje(com({ oportunidades: { daSemana: [{ cliente: "Ana", tipo: "Aniversário", quando: "em 3 dias", tom: "neutro", minutos: null }], atrasadas: 0, tomAtrasadas: "ruim" } }));
  confere("oportunidade da semana sem pressa é convite", semana.convites.length === 1 && semana.tarefas.length === 0 && semana.convites[0].titulo === "1 cliente vale uma mensagem nesta semana");
  const atrasada = montarHoje(com({ oportunidades: { daSemana: [{ cliente: "Ana", tipo: "Aniversário", quando: "amanhã", tom: "atencao", minutos: null }], atrasadas: 2, tomAtrasadas: "ruim" } }));
  confere("oportunidade que passou da data vira tarefa vermelha", atrasada.tarefas.length === 1 && atrasada.tarefas[0].tom === "ruim" && /2 passaram/.test(atrasada.tarefas[0].motivo));
}

console.log("\nSuporte, chat, fábrica e saúde");
{
  const h = montarHoje(com({
    suporte: { fila: 2, esperaDaFila: { tom: "ruim", minutos: 200 }, comigo: 1, esperaComigo: { tom: "neutro", minutos: 60 }, novidades: 1 },
    chat: { novas: 3, pedidosDoSetor: 1, esperaDoPedido: { tom: "atencao", minutos: 50 } },
    fabrica: { atrasados: [
      { ref: "11389", cliente: "Bruno", etapa: "A produzir", tom: "ruim", minutos: 8 * 1440 },
      { ref: "v12", cliente: null, etapa: "Em produção", tom: "atencao", minutos: 5 * 1440 },
    ] },
    saude: [{ chave: "saude-rd", tom: "ruim", titulo: "RD Station está recusando os contatos", texto: "Recusou 3.", href: "/admin/saude", rotulo: "Ver a saúde" }],
  }));
  const chaves = h.tarefas.map((t) => t.chave);
  confere("cada fonte vira o seu item", ["suporte-fila", "suporte-comigo", "suporte-voltou", "chat-pedidos", "chat-novas", "fabrica-atrasados", "saude-rd"].every((c) => chaves.includes(c)));
  confere("vermelho primeiro, e entre os vermelhos quem espera há mais tempo", chaves[0] === "fabrica-atrasados" && chaves[1] === "suporte-fila" && chaves[2] === "saude-rd");
  confere("âmbar depois do vermelho, sem cor por último", chaves.indexOf("chat-pedidos") === 3 && h.tarefas.slice(4).every((t) => t.tom === "neutro"));
  const fab = h.tarefas.find((t) => t.chave === "fabrica-atrasados")!;
  confere("a fábrica diz o atrasado e o que chega perto, e leva à busca do pedido", fab.titulo === "1 pedido atrasado na fábrica" && /1 outro chega perto/.test(fab.motivo) && fab.itens[0].href === "/admin/fabrica?busca=11389" && fab.itens[1].texto === "Venda 12");
}

console.log("\nOrdem e repetidos");
{
  const t = (chave: string, tom: Tarefa["tom"], minutos: number | null): Tarefa => ({ chave, tipo: "tarefa", fonte: "chat", tom, titulo: chave, motivo: "", espera: null, minutos, botao: { href: "/admin", rotulo: "x" }, itens: [] });
  const o = ordenar([t("a", "neutro", 999), t("b", "ruim", 10), t("c", "atencao", null), t("d", "ruim", 500), t("e", "neutro", null)]);
  confere("cor, depois espera, e sem relógio no fim do grupo", o.map((x) => x.chave).join() === "d,b,c,a,e");
  const r = semRepetidos([t("x", "neutro", 10), t("x", "ruim", 5), t("y", "atencao", 1)]);
  confere("o repetido sai, e fica o mais urgente", r.length === 2 && r.find((x) => x.chave === "x")?.tom === "ruim");
}

console.log("\nTexto");
{
  const tudo = montarHoje(com({
    kommoMeus: { lidoEm: LIDO, mapeado: false, totais: { sem_resposta: 0, esperando_vendedor: 0 }, negocios: [] },
    pedidosSemVendedor: 1,
    recuperacao: { clientes: 1 },
    suporte: { fila: 1, esperaDaFila: null, comigo: 1, esperaComigo: null, novidades: 2 },
    chat: { novas: 1, pedidosDoSetor: 2, esperaDoPedido: null },
    oportunidades: { daSemana: [], atrasadas: 1, tomAtrasadas: "ruim" },
  }));
  confere("nenhum texto com travessão", todosOsTextos(tudo).every((s) => !/[—–]/.test(s)));
  confere("singular e plural certos", tudo.convites.some((c) => c.titulo === "1 pedido do site sem vendedor") && tudo.tarefas.some((c) => c.titulo === "2 casos que você passou foram fechados"));
}

console.log("\nO que olhar depois e o menu");
{
  confere("o que olhar depois segue as áreas", oQueOlharDepois(["fabrica", "time"]).map((b) => b.href).join() === "/admin/fabrica,/admin/biblioteca" && oQueOlharDepois([]).length === 0);
  const hoje = SETORES[0].itens[0];
  confere("Hoje é a primeira tela do Início e pede a área que todo nível tem", hoje.href === "/admin/hoje" && hoje.area === "time");
  const vendedor = setoresDe(["lancar_venda", "recuperacao", "consulta", "time"]);
  confere("para o vendedor a primeira sala continua se chamando Início", nomeDoSetor(vendedor[0]) === "Início" && vendedor[0].itens.map((i) => i.href).join() === "/admin/hoje,/admin");
  confere("a aba Início da barra de baixo abre o Hoje", abasDaBarra(vendedor)[0].href === "/admin/hoje" && abasDaBarra(vendedor)[0].label === "Início");
  const diretor = setoresDe(["vendas", "custos", "margem", "time"]);
  confere("quem tem telas da diretoria vê a sala com o nome dela", nomeDoSetor(diretor[0]) === "Diretoria");
}

if (falhas > 0) {
  console.log(`\n${falhas} ${falhas === 1 ? "conferência falhou" : "conferências falharam"}.`);
  process.exit(1);
}
console.log("\nTudo certo.");
