/**
 * Confere as contas do suporte pós-venda (0102). Roda sem banco e sem
 * navegador:
 *   node --experimental-strip-types scripts/teste-suporte.mts
 *
 * Os casos daqui são INVENTADOS, só com a forma dos de verdade: nenhum
 * cliente, nenhum telefone de verdade.
 */
import {
  ASSUNTOS, ENDERECO_DO_SUPORTE, LIMITES_DO_SUPORTE, MAXIMO_DE_PRINTS, avisoDoSuporte, avisosDoSuporte, conferirCaso, duracao, esperaDoCaso,
  esperandoNoSuporte, lerCaso, lerLista, lerResumoDoSuporte, lerSuporteParaAvisar, limitesDoSuportePorExtenso, linkDoWhatsapp, ordenarCasos,
  rascunhoDaBiblioteca, telefoneDoCliente, telefoneLegivel, type Caso,
} from "../src/lib/suporte/casos.ts";
import { TEMAS } from "../src/lib/time/biblioteca.ts";
import { SETORES, setoresDe } from "../src/lib/painel/setores.ts";

let falhas = 0;
function confere(nome: string, ok: boolean, detalhe = "") {
  if (ok) console.log(`  ok  ${nome}`);
  else {
    falhas++;
    console.log(`  FALHOU  ${nome}${detalhe ? `: ${detalhe}` : ""}`);
  }
}

const agora = Date.parse("2026-11-16T18:00:00Z");
const ha = (min: number) => new Date(agora - min * 60_000).toISOString();

const bruto = (extra: Record<string, unknown> = {}) => ({
  id: 7,
  assunto: "pedra",
  relato: "Caiu a pedra da aliança",
  urgente: false,
  estado: "na_fila",
  aberto_em: ha(10),
  aberto_por: "00000000-0000-4000-a000-000000000001",
  aberto_por_nome: "Pessoa Vendedora",
  assumido_por: null,
  assumido_por_nome: null,
  assumido_em: null,
  fechado_por_nome: null,
  fechado_em: null,
  nota: null,
  imagens: 2,
  na_biblioteca: null,
  visto: false,
  mudou_em: ha(10),
  cliente: { nome: "Cliente Inventado", telefone: "5511900000000", pedido: 123, ref: "p123", situacao: "pago", etapa: "a_produzir" },
  ...extra,
});

console.log("Ler o que o banco devolve");
{
  const c = lerCaso(bruto());
  confere("lê o caso inteiro", c !== null && c.id === 7 && c.assunto === "pedra" && c.imagens === 2 && c.cliente.ref === "p123" && c.cliente.pedido === 123);
  confere("assunto desconhecido não entra", lerCaso(bruto({ assunto: "brinde" })) === null);
  confere("estado desconhecido não entra", lerCaso(bruto({ estado: "pendente" })) === null);
  confere("caso sem id não entra", lerCaso(bruto({ id: 0 })) === null);
  confere("cliente sem pedido fica com pedido nulo", lerCaso(bruto({ cliente: { telefone: "5511900000000" } }))?.cliente.pedido === null);
  const l = lerLista({ agora: ha(0), atende: true, abre: true, casos: [bruto(), { lixo: 1 }, bruto({ id: 8 })] });
  confere("a lista descarta o que não tem forma de caso", l !== null && l.casos.length === 2 && l.atende && l.abre);
  confere("lista sem instante é nula", lerLista({ casos: [] }) === null);
  const r = lerResumoDoSuporte({ fila: 3, fila_desde: ha(40), comigo: 1, comigo_desde: ha(90), meus_abertos: 0, novidades: 2 });
  confere("lê o resumo", r.fila === 3 && r.comigo === 1 && r.novidades === 2 && r.filaDesde === ha(40));
  confere("resumo estranho vira zero", lerResumoDoSuporte(null).fila === 0 && lerResumoDoSuporte({ fila: -4 }).fila === 0);
}

console.log("\nO número do menu");
{
  confere("soma o caso sem dono e o caso que fechou", esperandoNoSuporte({ fila: 2, novidades: 1 }) === 3);
  confere("o caso que está com alguém não conta", esperandoNoSuporte(lerResumoDoSuporte({ comigo: 4 })) === 0);
  confere("a chave é a tela do suporte", avisosDoSuporte({ fila: 1, novidades: 0 })[ENDERECO_DO_SUPORTE] === 1 && ENDERECO_DO_SUPORTE === "/admin/suporte");
}

console.log("\nO relógio (premissas)");
{
  const fila = (min: number) => esperaDoCaso({ estado: "na_fila", abertoEm: ha(min), assumidoEm: null, assumidoPorNome: null, fechadoPorNome: null }, agora);
  confere("na fila há pouco: sem cor", fila(10).tom === "neutro" && fila(10).palavra === "Sem dono há 10 min");
  confere("na fila agora", fila(0).palavra === "Na fila agora");
  confere(`sem dono a partir de ${LIMITES_DO_SUPORTE.semDono.atencao} min: âmbar`, fila(LIMITES_DO_SUPORTE.semDono.atencao).tom === "atencao" && fila(LIMITES_DO_SUPORTE.semDono.atencao - 1).tom === "neutro");
  confere(`sem dono a partir de ${LIMITES_DO_SUPORTE.semDono.atraso} min: vermelho`, fila(LIMITES_DO_SUPORTE.semDono.atraso).tom === "ruim");
  const comDono = (min: number) => esperaDoCaso({ estado: "com_suporte", abertoEm: ha(min + 600), assumidoEm: ha(min), assumidoPorNome: "Gerente Inventado Silva", fechadoPorNome: null }, agora);
  confere("com dono conta desde que assumiu, com o primeiro nome", comDono(180).tom === "neutro" && comDono(180).palavra === "Com Gerente há 3 h");
  confere("com dono há um dia: âmbar", comDono(LIMITES_DO_SUPORTE.comDono.atencao).tom === "atencao");
  confere("com dono há três dias: vermelho", comDono(LIMITES_DO_SUPORTE.comDono.atraso).tom === "ruim" && comDono(LIMITES_DO_SUPORTE.comDono.atraso).palavra === "Com Gerente há 3 dias");
  const resolvido = esperaDoCaso({ estado: "resolvido", abertoEm: ha(100), assumidoEm: ha(50), assumidoPorNome: null, fechadoPorNome: "Gerente Inventado" }, agora);
  confere("resolvido é verde e diz quem", resolvido.tom === "bom" && resolvido.palavra === "Resolvido por Gerente");
  const devolvido = esperaDoCaso({ estado: "devolvido", abertoEm: ha(100), assumidoEm: null, assumidoPorNome: null, fechadoPorNome: "Gerente" }, agora);
  confere("devolvido é âmbar", devolvido.tom === "atencao" && devolvido.palavra === "Voltou para o vendedor");
  const frase = limitesDoSuportePorExtenso();
  confere("a frase das premissas sai dos próprios limites", frase.includes("30 minutos") && frase.includes("2 horas") && frase.includes("1 dia") && frase.includes("3 dias") && frase.includes("premissa"));
  confere("a frase não tem travessão", !/[—–]/.test(frase));
  confere("duração curta", duracao(0) === "agora" && duracao(59) === "59 min" && duracao(120) === "2 h" && duracao(3 * 1440) === "3 dias");
}

console.log("\nA ordem da fila");
{
  const mk = (id: number, extra: Partial<Caso>): Caso => ({ ...(lerCaso(bruto({ id })) as Caso), ...extra });
  const ordem = ordenarCasos([
    mk(1, { estado: "resolvido", fechadoEm: ha(5) }),
    mk(2, { abertoEm: ha(50) }),
    mk(3, { abertoEm: ha(10), urgente: true }),
    mk(4, { abertoEm: ha(90) }),
    mk(5, { estado: "devolvido", fechadoEm: ha(1) }),
  ]).map((c) => c.id);
  confere("cliente esperando na frente, depois o mais antigo, fechados no fim do mais novo para o mais velho", ordem.join(",") === "3,4,2,5,1", ordem.join(","));
}

console.log("\nO cliente");
{
  confere("telefone com DDD ganha o 55", telefoneDoCliente("(11) 98765-4321") === "5511987654321");
  confere("fixo com DDD também", telefoneDoCliente("11 3456-7890") === "551134567890");
  confere("já com 55 fica como está", telefoneDoCliente("+55 11 98765-4321") === "5511987654321");
  confere("DDD 55 (Rio Grande do Sul) sem o país ganha o 55", telefoneDoCliente("55 99876-5432") === "5555998765432");
  confere("curto demais não é telefone", telefoneDoCliente("98765-4321") === null && telefoneDoCliente("") === null);
  confere("telefone para ler", telefoneLegivel("5511987654321") === "(11) 98765-4321" && telefoneLegivel("551134567890") === "(11) 3456-7890");
  confere("o link do WhatsApp só sai com telefone completo", linkDoWhatsapp("5511987654321") === "https://wa.me/5511987654321" && linkDoWhatsapp("1198765") === null && linkDoWhatsapp(null) === null);
}

console.log("\nPassar o caso (as mesmas travas do banco)");
{
  const base = { assunto: "pedra", relato: "Caiu a pedra", ref: "p123", telefone: "", nome: "", imagens: 0 };
  confere("caso completo passa", conferirCaso(base) === null);
  confere("sem assunto não passa", conferirCaso({ ...base, assunto: "" }) === "Escolha o assunto do caso.");
  confere("sem relato não passa", conferirCaso({ ...base, relato: "  ok " }) !== null);
  confere("sem cliente não passa", conferirCaso({ ...base, ref: "" }) === "Diga quem é o cliente: o número do pedido ou o telefone.");
  confere("pelo telefone passa", conferirCaso({ ...base, ref: "", telefone: "11 98765-4321" }) === null);
  confere("telefone ruim não passa", conferirCaso({ ...base, ref: "", telefone: "123" }) !== null);
  confere(`mais de ${MAXIMO_DE_PRINTS} prints não passa`, conferirCaso({ ...base, imagens: MAXIMO_DE_PRINTS + 1 }) !== null && conferirCaso({ ...base, imagens: MAXIMO_DE_PRINTS }) === null);
}

console.log("\nA biblioteca e os assuntos");
{
  const temas = new Set(TEMAS.map((t) => t.chave));
  confere("todo assunto cai num tema que a biblioteca conhece", ASSUNTOS.every((a) => temas.has(a.tema)));
  confere("os oito assuntos da trava do banco", ASSUNTOS.map((a) => a.chave).join(",") === "pedra,ajuste,troca,defeito,atraso,gravacao,cancelamento,outro");
  const r = rascunhoDaBiblioteca({ assunto: "pedra", nota: "Trazer na loja; a fábrica repõe." });
  confere("o rascunho parte do assunto e da nota, sem o relato do cliente", r.tema === "pos_venda" && r.pergunta.startsWith("Caiu a pedra") && r.explicacao === "Trazer na loja; a fábrica repõe.");
  confere("nenhum texto da tela do suporte tem travessão", ASSUNTOS.every((a) => !/[—–]/.test(a.nome)) && !/[—–]/.test(rascunhoDaBiblioteca({ assunto: "troca", nota: null }).pergunta));
}

console.log("\nO aviso do sistema");
{
  const l = lerSuporteParaAvisar({ agora: ha(0), casos: [{ id: 9, tipo: "novo", assunto: "ajuste", urgente: true, quem: "Pessoa Vendedora" }, { id: 0, tipo: "novo" }, { id: 3, tipo: "resolvido", assunto: "troca", quem: "Gerente Inventado" }] });
  confere("lê os casos e descarta o estranho", l.casos.length === 2 && l.agora === ha(0));
  const novo = avisoDoSuporte(l.casos[0]);
  confere("caso novo: assunto no título, quem passou e a urgência no corpo", novo.titulo === "Caso de suporte: Ajuste de tamanho" && novo.corpo.startsWith("Passado por Pessoa, com o cliente esperando agora"));
  const fechado = avisoDoSuporte(l.casos[1]);
  confere("caso resolvido avisa quem passou", fechado.titulo === "Seu caso foi resolvido: Troca" && fechado.marca === "jk-suporte-3-resolvido");
  confere("o aviso não leva dado de cliente", !/Cliente Inventado|5511/.test(JSON.stringify([novo, fechado])));
}

console.log("\nO menu");
{
  const item = SETORES.flatMap((s) => s.itens).find((i) => i.href === "/admin/suporte");
  confere("a tela do suporte está no setor Vendas, com a área de quem passa caso", Boolean(item) && item?.area === "lancar_venda" && SETORES.find((s) => s.id === "vendas")?.itens.includes(item!) === true);
  confere("o vendedor vê a tela", setoresDe(["consulta", "lancar_venda", "recuperacao", "time"]).some((s) => s.itens.some((i) => i.href === "/admin/suporte")));
  confere("a fábrica não vê", !setoresDe(["consulta", "fabrica", "time"]).some((s) => s.itens.some((i) => i.href === "/admin/suporte")));
}

if (falhas > 0) {
  console.error(`\n${falhas} ${falhas === 1 ? "conferência falhou" : "conferências falharam"}.`);
  process.exit(1);
}
console.log("\nTudo certo.");
