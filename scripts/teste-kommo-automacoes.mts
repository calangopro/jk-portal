// Teste das automações que escrevem na Kommo (cartão 49, 0173): a conta pura
// (`automacoes-regra.ts`) e o caminho único de escrita (`escrever.ts`) com um
// cliente da Kommo de MENTIRA e um banco de mentira. Nada aqui fala com a Kommo
// de verdade.
//
// Um gancho de carga troca o `server-only` por um módulo vazio e completa o
// `.ts` dos imports relativos, para carregar `escrever.ts` como o Next carrega.
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import {
  AUTOMACOES,
  ETAPA_GANHO,
  ETAPA_PERDIDO,
  conferirConfig,
  contatosDoCliente,
  corpoDaTarefa,
  corpoDoMovimento,
  corpoDoNegocio,
  decidirPosVenda,
  decidirRecuperacao,
  decidirSac,
  decidirTarefa,
  estadoDoErro,
  etapaDoMarco,
  marcoDoPedido,
  meioDiaEmSaoPaulo,
  motivoParaNaoMover,
  telefoneDoPainel,
  type Acao,
  type Configuracao,
} from "../src/lib/kommo/automacoes-regra.ts";
import * as conta from "../src/lib/kommo/conta.ts";
import { SETORES } from "../src/lib/painel/setores.ts";
import { ROTINAS } from "../src/lib/painel/saude.ts";

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
    console.log(`  ERRO  ${nome}${detalhe ? `: ${detalhe}` : ""}`);
  }
}

const FUNIL = 900;
const funis = [
  { id: FUNIL, etapas: [{ id: 1, ordem: 0, tipo: "entrada" }, { id: 10, ordem: 10, tipo: "aberta" }, { id: 20, ordem: 20, tipo: "aberta" }, { id: 30, ordem: 30, tipo: "aberta" }, { id: 40, ordem: 40, tipo: "aberta" }, { id: 142, ordem: 1000, tipo: "ganho" }, { id: 143, ordem: 1001, tipo: "perdido" }] },
];
const ordem: Record<number, number> = Object.fromEntries(funis[0].etapas.map((e) => [e.id, e.ordem]));
const base = (id: Configuracao["id"], extra: Partial<Configuracao> = {}): Configuracao => ({ id, funilId: FUNIL, etapaId: 10, etapas: {}, responsavelId: null, esperaMin: 60, limitePorHora: 10, ...extra });

console.log("\nCópias de conta.ts");
{
  confere("ganho e perdido iguais aos do espelho", ETAPA_GANHO === conta.ETAPA_GANHO && ETAPA_PERDIDO === conta.ETAPA_PERDIDO);
  const amostras = ["(11) 98765-4321", "+55 11 98765-4321", "11987654321", "991914363", "011 3333-4444", "5511333344445", "", null, "21 2222-3333", "11 8765-4321"];
  confere("o telefone normaliza igual ao do espelho", amostras.every((a) => telefoneDoPainel(a) === conta.telefoneDoPainel(a)));
}

console.log("\nConfiguração");
{
  confere("recuperação sem funil não liga", conferirConfig(base("recuperacao", { funilId: null }), funis) !== null);
  confere("recuperação sem etapa não liga", conferirConfig(base("recuperacao", { etapaId: null }), funis) !== null);
  confere("recuperação não nasce em ganho", conferirConfig(base("recuperacao", { etapaId: 142 }), funis) !== null);
  confere("recuperação completa liga", conferirConfig(base("recuperacao"), funis) === null);
  confere("pós-venda sem marco não liga", conferirConfig(base("pos_venda", { etapaId: null }), funis) !== null);
  confere("pós-venda fora de ordem não liga", conferirConfig(base("pos_venda", { etapas: { pago: 30, enviado: 20 } }), funis) !== null);
  confere("pós-venda em ordem liga", conferirConfig(base("pos_venda", { etapas: { pago: 20, enviado: 30, entregue: 40 } }), funis) === null);
  confere("pós-venda com um marco só liga", conferirConfig(base("pos_venda", { etapas: { entregue: 40 } }), funis) === null);
  confere("tarefas sem funil liga (qualquer funil)", conferirConfig(base("tarefas", { funilId: null, etapaId: null }), funis) === null);
  confere("teto fora da faixa não liga", conferirConfig(base("sac", { limitePorHora: 0 }), funis) !== null);
  confere("as quatro automações estão descritas", AUTOMACOES.map((a) => a.id).join() === "recuperacao,pos_venda,sac,tarefas");
  confere("nenhum texto da tela com travessão", !AUTOMACOES.some((a) => /[—–]/.test(a.nome + a.quando + a.efeito)));
}

console.log("\nRecuperação");
{
  const c = { cliente: "5511987654321", pedido: 11735, tentativas: 2, valor: 1399.9, nome: "Ana Souza", telefone: "5511987654321", email: "ANA@x.com", aguardando: true, itens: "Par de Alianças" };
  const a = decidirRecuperacao(c, base("recuperacao"));
  confere("cria negócio com chave do pedido", a?.tipo === "criar_negocio" && a.chave === "recuperacao:pedido:11735");
  confere("leva o valor arredondado e a etapa escolhida", a?.tipo === "criar_negocio" && a.negocio.preco === 1400 && a.negocio.etapaId === 10 && a.negocio.funilId === FUNIL);
  confere("e-mail em minúscula", a?.tipo === "criar_negocio" && a.contato.email === "ana@x.com");
  confere("sem telefone nem e-mail não cria", decidirRecuperacao({ ...c, telefone: null, email: null }, base("recuperacao")) === null);
  confere("automação errada não decide", decidirRecuperacao(c, base("sac")) === null);
  confere("nome do negócio sem travessão", a?.tipo === "criar_negocio" && !/[—–]/.test(decidirRecuperacao({ ...c, itens: "A — B" }, base("recuperacao"))!.rotulo + (decidirRecuperacao({ ...c, itens: "A — B" }, base("recuperacao")) as Extract<Acao, { tipo: "criar_negocio" }>).negocio.nome));
}

console.log("\nPós-venda");
{
  confere("marco: A ENVIAR é pago", marcoDoPedido("pago", "A ENVIAR") === "pago");
  confere("marco: ENVIADO é enviado", marcoDoPedido("pago", "ENVIADO") === "enviado");
  confere("marco: FINALIZADO é entregue", marcoDoPedido("pago", "FINALIZADO") === "entregue");
  confere("marco: não pago é nada", marcoDoPedido("cancelado", "CANCELADO") === null);
  confere("marco sem etapa cai no anterior que tem", etapaDoMarco("entregue", { pago: 20, enviado: 30 })?.etapaId === 30);
  const cfg = base("pos_venda", { etapas: { pago: 20, enviado: 30, entregue: 40 } });
  const neg = { id: 77, funil_id: FUNIL, etapa_id: 10, responsavel_id: 5, ordem: 10 };
  const p = { pedido: 11800, cliente: "x", nome: "Bia", situacao: "pago", status: "ENVIADO", negocio: neg };
  const a = decidirPosVenda(p, cfg, ordem);
  confere("enviado move para a etapa do enviado", a?.tipo === "mover_negocio" && a.paraEtapaId === 30 && a.chave === "pos_venda:11800:enviado");
  confere("sem negócio não cria", decidirPosVenda({ ...p, negocio: null }, cfg, ordem) === null);
  confere("não move para trás", decidirPosVenda({ ...p, status: "A ENVIAR", negocio: { ...neg, etapa_id: 30, ordem: 30 } }, cfg, ordem) === null);
  confere("não mexe na mesma etapa", decidirPosVenda({ ...p, negocio: { ...neg, etapa_id: 30, ordem: 30 } }, cfg, ordem) === null);
  confere("não mexe em negócio fechado", decidirPosVenda({ ...p, negocio: { ...neg, etapa_id: 142 } }, cfg, ordem) === null);
  confere("não mexe em negócio de outro funil", decidirPosVenda({ ...p, negocio: { ...neg, funil_id: 1 } }, cfg, ordem) === null);
  confere("pedido não pago não move", decidirPosVenda({ ...p, situacao: "aguardando" }, cfg, ordem) === null);
  const mov = a as Extract<Acao, { tipo: "mover_negocio" }>;
  const lido = (etapaId: number, extra = {}) => ({ id: 77, funilId: FUNIL, etapaId, responsavelId: 5, fechado: etapaId === 142 || etapaId === 143, apagado: false, ...extra });
  confere("na hora de mover, a Kommo ainda atrás: move", motivoParaNaoMover(mov, lido(10)) === null);
  confere("na hora de mover, alguém já adiantou: desiste", motivoParaNaoMover(mov, lido(40)) !== null);
  confere("na hora de mover, fechado: desiste", motivoParaNaoMover(mov, lido(142)) !== null);
  confere("na hora de mover, mudou de funil: desiste", motivoParaNaoMover(mov, lido(10, { funilId: 1 })) !== null);
  confere("na hora de mover, sumiu: desiste", motivoParaNaoMover(mov, null) !== null);
  confere("o PATCH só leva funil e etapa", JSON.stringify(corpoDoMovimento(mov)) === JSON.stringify({ pipeline_id: FUNIL, status_id: 30 }));
}

console.log("\nSAC");
{
  const c = { caso: 12, assunto: "pedra", urgente: true, pedido: 11735, nome: "Caio", telefone: "11987654321", email: null, no_sac: null };
  const a = decidirSac(c, base("sac"));
  confere("cria negócio no SAC com chave do caso", a?.tipo === "criar_negocio" && a.chave === "sac:caso:12" && a.automacao === "sac");
  confere("telefone vai no formato do painel", a?.tipo === "criar_negocio" && a.contato.telefone === "5511987654321");
  confere("cliente já com negócio aberto no SAC: não cria outro", decidirSac({ ...c, no_sac: { id: 1, funil_id: FUNIL, etapa_id: 10, responsavel_id: null, ordem: 10 } }, base("sac")) === null);
  confere("sem contato não cria", decidirSac({ ...c, telefone: "991914363" }, base("sac")) === null);
  const corpo = corpoDoNegocio(a as Extract<Acao, { tipo: "criar_negocio" }>, null) as { pipeline_id: number; status_id: number; responsible_user_id?: number; _embedded: { contacts: { first_name?: string; custom_fields_values?: { values: { value: string }[] }[] }[] } }[];
  confere("contato novo leva o telefone com +55", corpo[0]._embedded.contacts[0].custom_fields_values?.[0].values[0].value === "+5511987654321");
  confere("sem responsável escolhido, o corpo não troca o responsável", corpo[0].responsible_user_id === undefined);
  const comContato = corpoDoNegocio(a as Extract<Acao, { tipo: "criar_negocio" }>, 555) as { _embedded: { contacts: unknown[] } }[];
  confere("contato que já existe vai só pelo id", JSON.stringify(comContato[0]._embedded.contacts) === JSON.stringify([{ id: 555 }]));
}

console.log("\nTarefas");
{
  const o = { ref: "p11735", tipo: "aniversario", ocorrencia: "2026-11-21", emDias: 3, motivo: "Aniversário da Ana", oferecer: "Convide para polir", cliente: "Ana Souza", telefone: "5511987654321" };
  const neg = { id: 88, funil_id: FUNIL, etapa_id: 10, responsavel_id: 7, ordem: 10 };
  const a = decidirTarefa(o, neg, base("tarefas", { funilId: null }), "2026-11-18");
  confere("vira tarefa no negócio, para o responsável dele", a?.tipo === "criar_tarefa" && a.negocioId === 88 && a.responsavelId === 7);
  confere("chave por cliente, tipo e dia", a?.chave === "tarefa:p11735:aniversario:2026-11-21");
  confere("prazo ao meio-dia de São Paulo do dia", a?.tipo === "criar_tarefa" && a.prazo === meioDiaEmSaoPaulo("2026-11-21") && new Date(a.prazo * 1000).toISOString() === "2026-11-21T15:00:00.000Z");
  confere("sem negócio, não cria", decidirTarefa(o, null, base("tarefas"), "2026-11-18") === null);
  confere("negócio fechado, não cria", decidirTarefa(o, { ...neg, etapa_id: 143 }, base("tarefas"), "2026-11-18") === null);
  confere("longe demais, ainda não", decidirTarefa({ ...o, emDias: 20 }, neg, base("tarefas"), "2026-11-18") === null);
  confere("já passou: prazo vira amanhã", decidirTarefa({ ...o, ocorrencia: "2026-11-17", emDias: -1 }, neg, base("tarefas", { funilId: null }), "2026-11-18")?.tipo === "criar_tarefa");
  confere("funil escolhido e negócio em outro: não cria", decidirTarefa(o, { ...neg, funil_id: 1 }, base("tarefas"), "2026-11-18") === null);
  const corpo = corpoDaTarefa(a as Extract<Acao, { tipo: "criar_tarefa" }>) as { entity_type: string; entity_id: number; task_type_id: number }[];
  confere("a tarefa vai no negócio, tipo contato", corpo[0].entity_type === "leads" && corpo[0].entity_id === 88 && corpo[0].task_type_id === 1);
}

console.log("\nLeitura da Kommo");
{
  const busca = { _embedded: { contacts: [
    { id: 1, custom_fields_values: [{ field_code: "PHONE", values: [{ value: "+55 (11) 98765-4321" }] }], _embedded: { leads: [{ id: 50 }] } },
    { id: 2, custom_fields_values: [{ field_code: "PHONE", values: [{ value: "11 98765-0000" }] }], _embedded: { leads: [{ id: 60 }] } },
  ] } };
  const achados = contatosDoCliente(busca, { nome: "Ana", telefone: "5511987654321", email: null });
  confere("da busca, fica só o contato com o mesmo telefone", achados.length === 1 && achados[0].id === 1 && achados[0].negocios[0] === 50);
  confere("4xx é recusa, 429 e 5xx são erro", estadoDoErro(400) === "recusada" && estadoDoErro(429) === "erro" && estadoDoErro(500) === "erro" && estadoDoErro(null) === "erro");
}

// ------------------------------------------------------------------ escrever.ts com cliente e banco de mentira

type Chamada = { caminho: string; metodo: string; corpo?: unknown };

function bancoDeMentira(opcoes: { reserva?: Record<string, unknown> } = {}) {
  const rpcs: { nome: string; args: Record<string, unknown> }[] = [];
  const db = {
    rpcs,
    rpc: async (nome: string, args: Record<string, unknown>) => {
      rpcs.push({ nome, args });
      if (nome === "kommo_escrita_reservar") return { data: opcoes.reserva ?? { ok: true, id: 1, feita_por: "autor" }, error: null };
      if (nome === "kommo_escrita_terminar") return { data: { ok: true }, error: null };
      return { data: null, error: { message: "inesperado" } };
    },
  };
  return db;
}

function kommoDeMentira(respostas: (c: Chamada) => unknown) {
  const chamadas: Chamada[] = [];
  const pedir = async <T,>(caminho: string, o: { metodo?: string; corpo?: unknown; busca?: URLSearchParams } = {}): Promise<T | null> => {
    const c = { caminho: caminho + (o.busca ? `?${o.busca}` : ""), metodo: o.metodo ?? "GET", corpo: o.corpo };
    chamadas.push(c);
    const r = respostas(c);
    if (r instanceof Error) throw r;
    return (r ?? null) as T | null;
  };
  return { pedir, chamadas };
}

class ErroHttp extends Error {
  status: number;
  constructor(status: number, m: string) {
    super(m);
    this.status = status;
  }
}

const { escreverNaKommo } = await import("../src/lib/kommo/escrever.ts");
const terminou = (db: ReturnType<typeof bancoDeMentira>) => db.rpcs.find((r) => r.nome === "kommo_escrita_terminar")?.args ?? {};

console.log("\nEscrita: mover negócio");
{
  const cfg = base("pos_venda", { etapas: { pago: 20, enviado: 30 } });
  const acao = decidirPosVenda({ pedido: 1, cliente: "x", nome: "Bia", situacao: "pago", status: "ENVIADO", negocio: { id: 77, funil_id: FUNIL, etapa_id: 10, responsavel_id: 5, ordem: 10 } }, cfg, ordem)!;
  let etapa = 10;
  const k = kommoDeMentira((c) => {
    if (c.metodo === "PATCH") {
      etapa = (c.corpo as { status_id: number }).status_id;
      return { id: 77 };
    }
    return { id: 77, pipeline_id: FUNIL, status_id: etapa, responsible_user_id: 5 };
  });
  const db = bancoDeMentira();
  const r = await escreverNaKommo(db as never, k.pedir as never, acao);
  confere("reserva antes de qualquer chamada à Kommo", db.rpcs[0].nome === "kommo_escrita_reservar" && k.chamadas.length > 0);
  confere("lê, grava e lê de novo, nesta ordem", k.chamadas.map((c) => c.metodo).join(",") === "GET,PATCH,GET");
  confere("termina como feito, com antes e depois", r.estado === "ok" && (terminou(db).p_antes as { etapaId: number }).etapaId === 10 && (terminou(db).p_depois as { etapaId: number }).etapaId === 30);

  const k2 = kommoDeMentira(() => ({ id: 77, pipeline_id: FUNIL, status_id: 40 }));
  const db2 = bancoDeMentira();
  const r2 = await escreverNaKommo(db2 as never, k2.pedir as never, acao);
  confere("alguém já adiantou na Kommo: desiste sem gravar", r2.estado === "desistiu" && !k2.chamadas.some((c) => c.metodo !== "GET"));

  const k3 = kommoDeMentira((c) => (c.metodo === "PATCH" ? new ErroHttp(400, "Kommo respondeu 400") : { id: 77, pipeline_id: FUNIL, status_id: 10 }));
  const db3 = bancoDeMentira();
  const r3 = await escreverNaKommo(db3 as never, k3.pedir as never, acao);
  confere("a Kommo recusou: registra a recusa com o código", r3.estado === "recusada" && terminou(db3).p_http === 400 && String(terminou(db3).p_erro).includes("400"));

  const k4 = kommoDeMentira((c) => (c.metodo === "PATCH" ? { id: 77 } : { id: 77, pipeline_id: FUNIL, status_id: 10 }));
  const db4 = bancoDeMentira();
  const r4 = await escreverNaKommo(db4 as never, k4.pedir as never, acao);
  confere("a Kommo disse ok e não mudou: é erro, não feito", r4.estado === "erro");
}

console.log("\nEscrita: travas da reserva");
{
  const acao = decidirSac({ caso: 9, assunto: "ajuste", urgente: false, pedido: null, nome: "Caio", telefone: "11987654321", email: null, no_sac: null }, base("sac"))!;
  for (const motivo of ["desligada", "sem_autor", "ja", "teto"]) {
    const k = kommoDeMentira(() => ({}));
    const db = bancoDeMentira({ reserva: { ok: false, motivo } });
    const r = await escreverNaKommo(db as never, k.pedir as never, acao);
    confere(`reserva recusada (${motivo}): nenhuma chamada à Kommo`, r.estado === "pulada" && k.chamadas.length === 0);
  }
  const k = kommoDeMentira(() => ({}));
  const db = bancoDeMentira({ reserva: { ok: true, id: 3 } });
  const r = await escreverNaKommo(db as never, k.pedir as never, acao);
  confere("reserva sem autor: não grava", r.estado === "pulada" && k.chamadas.length === 0);
}

console.log("\nEscrita: criar negócio");
{
  const acao = decidirSac({ caso: 9, assunto: "ajuste", urgente: false, pedido: null, nome: "Caio", telefone: "11987654321", email: null, no_sac: null }, base("sac"))!;
  const contatoExistente = { _embedded: { contacts: [{ id: 555, custom_fields_values: [{ field_code: "PHONE", values: [{ value: "11987654321" }] }], _embedded: { leads: [{ id: 70 }] } }] } };
  const k = kommoDeMentira((c) => {
    if (c.caminho.startsWith("/api/v4/contacts")) return contatoExistente;
    if (c.caminho.startsWith("/api/v4/leads?")) return { _embedded: { leads: [{ id: 70, pipeline_id: 1, status_id: 5 }] } };
    if (c.caminho === "/api/v4/leads/complex") return [{ id: 999, contact_id: 555 }];
    if (c.caminho === "/api/v4/leads/999") return { id: 999, pipeline_id: FUNIL, status_id: 10 };
    return null;
  });
  const db = bancoDeMentira();
  const r = await escreverNaKommo(db as never, k.pedir as never, acao);
  const post = k.chamadas.find((c) => c.metodo === "POST");
  confere("usa o contato que já existe na Kommo", JSON.stringify((post?.corpo as { _embedded: { contacts: unknown[] } }[])[0]._embedded.contacts) === JSON.stringify([{ id: 555 }]));
  confere("negócio aberto do cliente em OUTRO funil não impede", r.estado === "ok" && r.negocioId === 999);
  confere("busca o contato pelo número sem o 55", k.chamadas[0].caminho.includes("query=11987654321"));

  const k2 = kommoDeMentira((c) => {
    if (c.caminho.startsWith("/api/v4/contacts")) return contatoExistente;
    if (c.caminho.startsWith("/api/v4/leads?")) return { _embedded: { leads: [{ id: 70, pipeline_id: FUNIL, status_id: 20 }] } };
    return [{ id: 1 }];
  });
  const db2 = bancoDeMentira();
  const r2 = await escreverNaKommo(db2 as never, k2.pedir as never, acao);
  confere("cliente já com negócio aberto no funil: desiste, sem POST", r2.estado === "desistiu" && !k2.chamadas.some((c) => c.metodo === "POST"));

  const k3 = kommoDeMentira((c) => (c.metodo === "POST" ? new Error("timeout") : null));
  const db3 = bancoDeMentira();
  const r3 = await escreverNaKommo(db3 as never, k3.pedir as never, acao);
  confere("sem resposta da Kommo: erro, e a chave fica gasta (não repete)", r3.estado === "erro" && db3.rpcs.filter((x) => x.nome === "kommo_escrita_reservar").length === 1);
}

console.log("\nEscrita: tarefa");
{
  const acao = decidirTarefa({ ref: "p1", tipo: "um_ano", ocorrencia: "2026-11-20", emDias: 2, motivo: "Um ano da compra", oferecer: "Convide para polir", cliente: "Ana", telefone: "5511987654321" }, { id: 88, funil_id: FUNIL, etapa_id: 10, responsavel_id: 7, ordem: 10 }, base("tarefas", { funilId: null }), "2026-11-18")!;
  const k = kommoDeMentira((c) => {
    if (c.caminho === "/api/v4/leads/88") return { id: 88, pipeline_id: FUNIL, status_id: 10, responsible_user_id: 9 };
    if (c.caminho === "/api/v4/tasks") return { _embedded: { tasks: [{ id: 4321 }] } };
    if (c.caminho === "/api/v4/tasks/4321") return { id: 4321, entity_id: 88 };
    return null;
  });
  const db = bancoDeMentira();
  const r = await escreverNaKommo(db as never, k.pedir as never, acao);
  const post = k.chamadas.find((c) => c.metodo === "POST")?.corpo as { responsible_user_id: number }[];
  confere("a tarefa vai para o responsável de AGORA na Kommo", post[0].responsible_user_id === 9);
  confere("confere que a tarefa apareceu no negócio", r.estado === "ok");
  const k2 = kommoDeMentira(() => ({ id: 88, pipeline_id: FUNIL, status_id: 142 }));
  const r2 = await escreverNaKommo(bancoDeMentira() as never, k2.pedir as never, acao);
  confere("negócio fechado na Kommo: desiste", r2.estado === "desistiu" && !k2.chamadas.some((c) => c.metodo === "POST"));
}

console.log("\nTela, rotina e banco");
{
  const item = SETORES.flatMap((s) => s.itens).find((i) => i.href === "/admin/kommo/automacoes");
  confere("a tela está no Sistema, só para a diretoria", item?.area === "equipe" && SETORES.find((s) => s.id === "sistema")?.itens.includes(item!) === true);
  const pagina = readFileSync("src/app/admin/(painel)/kommo/automacoes/page.tsx", "utf8");
  confere("a página pede diretoria", pagina.includes("requireAdmin()"));
  const r = ROTINAS.find((x) => x.id === "kommo-avisos");
  confere("o passo tem pulso na Saúde", Boolean(r && r.origem === "pulso"));
  const rota = readFileSync("src/app/api/cron/kommo/route.ts", "utf8");
  confere("a rotina deixa o pulso dos avisos", rota.includes('registrarPulso(db, "kommo-avisos"'));
  const sql = readFileSync("supabase/migrations/0173_kommo_escrita.sql", "utf8");
  confere("0173 sem policy", !/create policy/i.test(sql));
  confere("as automações nascem desligadas", /ativa\s+boolean not null default false/.test(sql) && !/insert into public\.kommo_automacoes[^;]*true/.test(sql));
  confere("uma escrita por evento (chave única)", /chave\s+text not null unique/.test(sql));
  confere("escrita sem autor não existe", /feita_por\s+uuid not null/.test(sql));
  confere("salvar desliga", /ativa = false, ativada_por = null, ativada_em = null/.test(sql));
  confere("as funções da tela conferem a diretoria em coalesce", (sql.match(/coalesce\(public\.is_admin\(\), false\)/g) ?? []).length >= 4);
  confere("as da rodada são só da chave de serviço", /grant execute on function public\.kommo_avisos_candidatos\(\)[\s\S]*?to service_role;/.test(sql) && !/kommo_escrita_reservar[^;]*to authenticated/.test(sql));
  confere("nenhum texto com travessão na migration", !/[—–]/.test(sql));
}

console.log("\nSó escrever.ts escreve na Kommo");
{
  const arquivos = readdirSync("src/lib/kommo").filter((f) => f.endsWith(".ts"));
  const escritas = arquivos.flatMap((f) => [...readFileSync(`src/lib/kommo/${f}`, "utf8").matchAll(/metodo: "(POST|PATCH|DELETE)"/g)].map((m) => `${f}:${m[1]}`));
  const fora = escritas.filter((e) => !e.startsWith("escrever.ts:") && e !== "webhook.ts:POST");
  confere("POST e PATCH só em escrever.ts (e o cadastro do webhook)", fora.length === 0, fora.join(","));
  confere("escrever.ts nunca apaga nada na Kommo", !escritas.includes("escrever.ts:DELETE"));
}

if (falhas > 0) {
  console.error(`\n${falhas} ${falhas === 1 ? "conferência falhou" : "conferências falharam"}.`);
  process.exit(1);
}
console.log("\nTudo certo.");
