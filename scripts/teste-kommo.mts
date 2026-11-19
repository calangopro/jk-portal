/**
 * Confere o espelho da Kommo (0160, cartão 45): a conversão do que a API v4 e
 * o webhook devolvem nas linhas do banco, os cursores da leitura e as regras
 * que a migration promete. Roda sem banco, sem rede e sem a chave:
 *   node --experimental-strip-types scripts/teste-kommo.mts
 *
 * Os exemplos têm o FORMATO lido da conta de verdade em 18/11/2026, com nomes,
 * telefones e ids inventados (o repositório é público).
 */
import { readFileSync } from "node:fs";
import {
  EVENTOS_DO_WEBHOOK, TIPOS_DE_EVENTO, dataDaKommo, emLotes, janelaDeEventos, lerWebhook, linhaDoContato, linhaDoEvento, linhaDoNegocio,
  linhasDosFunis, linhasDosUsuarios, proximoCursor, segundos, telefoneDoPainel, type NegocioDaKommo,
} from "../src/lib/kommo/conta.ts";
import { ROTINAS } from "../src/lib/painel/saude.ts";
import { SETORES } from "../src/lib/painel/setores.ts";

let falhas = 0;
function confere(nome: string, ok: boolean, detalhe = "") {
  if (ok) console.log(`  ok  ${nome}`);
  else {
    falhas++;
    console.log(`  FALHOU  ${nome}${detalhe ? `: ${detalhe}` : ""}`);
  }
}
const AGORA = "2026-11-18T21:30:00.000Z";

console.log("Datas e telefone");
{
  confere("segundos da Kommo viram ISO", dataDaKommo(1779480309) === "2026-05-22T20:05:09.000Z", String(dataDaKommo(1779480309)));
  confere("zero e vazio não são data", dataDaKommo(0) === null && dataDaKommo(null) === null && dataDaKommo(undefined) === null);
  confere("ISO volta para segundos", segundos("2026-05-22T20:05:09.000Z") === 1779480309);
  confere("celular com DDD ganha 55", telefoneDoPainel("(11) 98765-4321") === "5511987654321");
  confere("já com +55 fica igual", telefoneDoPainel("+55 11 98765-4321") === "5511987654321");
  confere("fixo com DDD vale", telefoneDoPainel("1133334444") === "551133334444");
  confere("sem DDD não vira número inventado", telefoneDoPainel("987654321") === null);
  confere("zero na frente do DDD sai", telefoneDoPainel("011987654321") === "5511987654321");
  confere("celular de 11 dígitos sem o 9 é recusado", telefoneDoPainel("11887654321") === null);
  confere("DDD que não existe é recusado", telefoneDoPainel("0587654321") === null);
  confere("vazio é nulo", telefoneDoPainel("") === null && telefoneDoPainel(null) === null);
}

console.log("\nNegócio");
{
  const n: NegocioDaKommo = {
    id: 1001,
    name: "Cliente teste",
    price: 1549.9,
    responsible_user_id: 501,
    status_id: 142,
    pipeline_id: 9001,
    loss_reason_id: null,
    created_at: 1779480309,
    updated_at: 1779482180,
    closed_at: 1779482180,
    is_deleted: false,
    custom_fields_values: [
      { field_id: 1, field_name: "Pedido Tray", field_code: null, field_type: "text", values: [{ value: " 11771 " }] },
      { field_id: 2, field_name: "Motivo da Compra", field_code: null, field_type: "select", values: [{ value: "Casamento", enum_id: 7 }] },
      { field_id: 3, field_name: "utm_source", field_code: "UTM_SOURCE", field_type: "tracking_data", values: [{ value: "ig" }] },
      { field_id: 4, field_name: "Meta Ads ID do anúncio", field_code: "META_AD_ID", field_type: "tracking_data", values: [{ value: "120200000000001" }] },
      { field_id: 5, field_name: "Meta Ads ID do conjunto de anúncios", field_code: "META_ADSET_ID", field_type: "tracking_data", values: [{ value: "120200000000002" }] },
      { field_id: 6, field_name: "Meta Ads ID da campanha", field_code: "META_CAMPAIGN_ID", field_type: "tracking_data", values: [{ value: "120200000000003" }] },
      { field_id: 7, field_name: "Arquivo", field_code: null, field_type: "file", values: [{ value: { file_uuid: "x" } }] },
      { field_id: 8, field_name: "Origem do cliente", field_code: null, field_type: "select", values: [{ value: "Instagram" }] },
      { field_id: 9, field_name: "Gravura", field_code: null, field_type: "text", values: [{ value: "" }] },
    ],
    _embedded: {
      tags: [{ id: 1, name: "grupo-whatsapp" }, { id: 2, name: " " }],
      contacts: [{ id: 77, is_main: false }, { id: 78, is_main: true }],
    },
  };
  const l = linhaDoNegocio(n, AGORA);
  confere("funil, etapa, responsável e valor", l.funil_id === 9001 && l.etapa_id === 142 && l.responsavel_id === 501 && l.valor === 1549.9);
  confere("datas convertidas", l.criado_em === "2026-05-22T20:05:09.000Z" && l.fechado_em === dataDaKommo(1779482180));
  confere("o contato principal é o is_main, não o primeiro", l.contato_id === 78 && l.contatos.join(",") === "77,78");
  confere("Pedido Tray sai pelo nome, sem espaço", l.pedido_tray === "11771");
  confere("Motivo da Compra e Origem do cliente pelo nome", l.motivo_compra === "Casamento" && l.origem_cliente === "Instagram");
  confere("UTM pelo código", l.utm_source === "ig");
  confere("anúncio, conjunto e campanha do Meta pelo código", l.meta_ad_id === "120200000000001" && l.meta_adset_id === "120200000000002" && l.meta_campaign_id === "120200000000003");
  confere("campo de arquivo não entra", !l.campos.some((c) => c.id === 7));
  confere("campo vazio não entra", !l.campos.some((c) => c.id === 9));
  confere("os campos preenchidos ficam todos em `campos`", l.campos.length === 7);
  confere("etiqueta vazia sai", l.tags.length === 1 && l.tags[0] === "grupo-whatsapp");
  confere("responsável zero vira nulo", linhaDoNegocio({ id: 2, responsible_user_id: 0 }, AGORA).responsavel_id === null);
  confere("sem contato, contato nulo", linhaDoNegocio({ id: 3 }, AGORA).contato_id === null);
  const chaves = Object.keys(linhaDoNegocio({ id: 4 }, AGORA)).sort().join(",");
  confere("todo negócio sai com as mesmas chaves (o lote do PostgREST recusa mistura)", chaves === Object.keys(l).sort().join(","));
  const acento = linhaDoNegocio({ id: 5, custom_fields_values: [{ field_id: 1, field_name: "PEDIDO  TRAY", values: [{ value: "123" }] }] }, AGORA);
  confere("nome do campo sem caixa e com espaço repetido ainda casa", acento.pedido_tray === "123");
}

console.log("\nContato");
{
  const c = linhaDoContato(
    {
      id: 78,
      name: "Cliente teste",
      responsible_user_id: 501,
      created_at: 1779480309,
      updated_at: 1779480309,
      custom_fields_values: [
        { field_id: 1, field_code: "PHONE", values: [{ value: "987654321" }, { value: "(11) 98765-4321" }, { value: "+55 11 98765-4321" }] },
        { field_id: 2, field_code: "EMAIL", values: [{ value: "nao-e-email" }, { value: "Cliente@Exemplo.com.br" }] },
        { field_id: 3, field_name: "CPF", field_code: null, values: [{ value: "000.000.000-00" }] },
        { field_id: 4, field_name: "Endereço", field_code: null, values: [{ value: "Rua Inventada, 1" }] },
      ],
    },
    AGORA,
  );
  confere("telefone sem DDD fica de fora, os iguais viram um", c.telefone === "5511987654321" && c.telefones.length === 1);
  confere("e-mail válido, em minúsculas", c.email === "cliente@exemplo.com.br");
  const texto = JSON.stringify(c);
  confere("CPF e endereço NUNCA entram", !texto.includes("000.000.000-00") && !texto.includes("Inventada") && !("cpf" in c) && !("endereco" in c));
  confere("contato sem telefone", linhaDoContato({ id: 9 }, AGORA).telefone === null);
}

console.log("\nEvento");
{
  const e = linhaDoEvento({
    id: "01abc",
    type: "lead_status_changed",
    entity_id: 1001,
    entity_type: "lead",
    created_by: 0,
    created_at: 1795047891,
    value_after: [{ lead_status: { id: 105989451, pipeline_id: 13546043, extra: "x" } }],
    value_before: [{ lead_status: { id: 104515659, pipeline_id: 13546043 } }],
  });
  confere("evento de etapa guarda só os ids", JSON.stringify(e?.depois) === JSON.stringify([{ lead_status: { id: 105989451, pipeline_id: 13546043 } }]));
  confere("autor zero (robô) vira nulo", e?.autor_id === null);
  const m = linhaDoEvento({
    id: "01def", type: "incoming_chat_message", entity_id: 1001, entity_type: "lead", created_at: 1795048030,
    value_after: [{ message: { id: "uuid", origin: "com.amocrm.amocrmwa", talk_id: 1601, text: "texto do cliente" } }],
  });
  confere("mensagem entra sem texto", !JSON.stringify(m).includes("texto do cliente") && JSON.stringify(m?.depois).includes("1601"));
  confere("evento sem data é descartado", linhaDoEvento({ id: "x", type: "lead_added", entity_id: 1, entity_type: "lead", created_at: 0 }) === null);
  confere("os tipos lidos incluem etapa, responsável e mensagens", ["lead_status_changed", "entity_responsible_changed", "incoming_chat_message", "outgoing_chat_message"].every((t) => (TIPOS_DE_EVENTO as readonly string[]).includes(t)));
}

console.log("\nFunis, etapas e usuários");
{
  const { funis, etapas } = linhasDosFunis(
    [{ id: 9001, name: "ECOMM | WHATS", sort: 1, is_main: true, _embedded: { statuses: [
      { id: 1, name: "Etapa de leads de entrada", sort: 10, type: 1 },
      { id: 2, name: "Em atendimento", sort: 20, type: 0 },
      { id: 142, name: "Venda Ganha", sort: 10000, type: 0 },
      { id: 143, name: "Venda Perdida", sort: 11000, type: 0 },
    ] } }],
    AGORA,
  );
  confere("funil principal", funis[0].principal && funis[0].nome === "ECOMM | WHATS");
  confere("tipos das etapas", etapas.map((e) => e.tipo).join(",") === "entrada,aberta,ganho,perdido");
  const u = linhasDosUsuarios([{ id: 1, name: "LOJA X", rights: { is_active: false, is_admin: false } }, { id: 2, name: "Admin", rights: { is_admin: true } }], AGORA);
  confere("usuário desativado e administrador", !u[0].ativo && u[1].ativo && u[1].administrador);
}

console.log("\nWebhook");
{
  const corpo = new URLSearchParams([
    ["leads[status][0][id]", "1001"],
    ["leads[status][0][status_id]", "142"],
    ["leads[status][0][pipeline_id]", "9001"],
    ["leads[status][1][id]", "1002"],
    ["leads[responsible][0][id]", "1001"],
    ["leads[note][0][note][element_id]", "1003"],
    ["leads[note][0][note][text]", "texto da nota"],
    ["leads[delete][0][id]", "1004"],
    ["leads[delete][1][id]", "1002"],
    ["contacts[update][0][id]", "78"],
    ["contacts[delete][0][id]", "79"],
    ["leads[update][0][custom_fields][0][id]", "999999"],
    ["account[subdomain]", "kathleengfz"],
    ["account[id]", "36309975"],
  ]).toString();
  const a = lerWebhook(new URLSearchParams(corpo).entries());
  confere("conta lida", a.conta.subdominio === "kathleengfz" && a.conta.id === "36309975");
  confere("negócios: etapa, responsável e nota, sem repetir", a.negocios.sort().join(",") === "1001,1002,1003");
  confere("id de campo personalizado não vira negócio", !a.negocios.includes(999999));
  confere("apagado e mudado no mesmo aviso vale como mudado (relê)", a.negociosApagados.join(",") === "1004");
  confere("contatos", a.contatos.join(",") === "78" && a.contatosApagados.join(",") === "79");
  confere("contagem por ação", a.acoes["leads.status"] === 2 && a.acoes["leads.note"] === 1 && a.acoes["leads.delete"] === 2);
  confere("texto da nota não sai do aviso", !JSON.stringify(a).includes("texto da nota"));
  confere("corpo vazio não quebra", lerWebhook(new URLSearchParams("").entries()).negocios.length === 0);
  confere("o webhook pede etapa, responsável, nota e apagado", ["status_lead", "responsible_lead", "note_lead", "delete_lead", "update_contact"].every((s) => (EVENTOS_DO_WEBHOOK as readonly string[]).includes(s)));
}

console.log("\nCursores");
{
  const c = "2026-11-18T10:00:00.000Z";
  const depois = "2026-11-18T10:05:00.000Z";
  const r1 = proximoCursor(c, 1, [c, depois], 250);
  confere("página curta: anda até o maior e acaba", r1.cursor === depois && r1.pagina === 1 && r1.acabou);
  const cheia = Array.from({ length: 250 }, () => c);
  const r2 = proximoCursor(c, 1, cheia, 250);
  confere("página cheia no mesmo segundo: cursor fica, página sobe", r2.cursor === c && r2.pagina === 2 && !r2.acabou);
  const r3 = proximoCursor(c, 2, [...cheia.slice(0, 249), depois], 250);
  confere("saiu do segundo preso: volta à página 1", r3.cursor === depois && r3.pagina === 1 && !r3.acabou);
  const r4 = proximoCursor(c, 1, [], 250);
  confere("nada novo: acabou, mesmo cursor", r4.acabou && r4.cursor === c);

  const j = janelaDeEventos("2026-11-18T10:00:00.000Z", "2026-11-18T21:00:00.000Z");
  confere("janela volta 2 minutos e dura uma hora", j.de === "2026-11-18T09:58:00.000Z" && j.ate === "2026-11-18T10:58:00.000Z");
  const j2 = janelaDeEventos("2026-11-18T20:50:00.000Z", "2026-11-18T21:00:00.000Z");
  confere("janela não passa de agora", j2.ate === "2026-11-18T21:00:00.000Z");
  confere("sem ponto, começa uma hora atrás", janelaDeEventos(null, "2026-11-18T21:00:00.000Z").de === "2026-11-18T20:00:00.000Z");
  confere("lotes", emLotes([1, 2, 3, 4, 5], 2).map((l) => l.length).join(",") === "2,2,1");
}

console.log("\nLigações com o resto do painel");
{
  const r = ROTINAS.find((x) => x.id === "kommo");
  confere("a rotina da Kommo está na Saúde, pelo pulso", Boolean(r && r.origem === "pulso" && r.tolerancia <= 90));
  const item = SETORES.flatMap((s) => s.itens).find((i) => i.href === "/admin/kommo");
  confere("a tela do mapa está no menu, só para a diretoria", item?.area === "equipe");
  const rota = readFileSync("src/app/api/cron/kommo/route.ts", "utf8");
  confere("a rotina deixa pulso", rota.includes('registrarPulso(db, "kommo"'));
  const sql = readFileSync("supabase/migrations/0160_kommo_espelho.sql", "utf8");
  confere("toda tabela do espelho tem RLS ligada", ["usuarios", "funis", "etapas", "contatos", "negocios", "eventos", "pendentes", "estado", "mapa"].every((t) => sql.includes(`alter table public.kommo_${t}`) && sql.includes("enable row level security")));
  confere("nenhuma policy nas tabelas do espelho", !/create policy/i.test(sql));
  confere("a área é conferida dentro de coalesce", (sql.match(/coalesce\(public\.is_admin\(\), false\)/g) ?? []).length >= 5);
  confere("contato não tem coluna de CPF nem de endereço", !/kommo_contatos[\s\S]*?\(([\s\S]*?)\);/.exec(sql)?.[1].match(/\b(cpf|endereco)\b/i));
  confere("a rotina está no relógio de 10 em 10 minutos", sql.includes("'ler-a-kommo', '2-59/10 * * * *'"));
  const cliente = readFileSync("src/lib/kommo/cliente.ts", "utf8");
  const espaco = Number(/ESPACO_MS = (\d+)/.exec(cliente)?.[1]);
  confere("o cliente não passa de 7 pedidos por segundo", espaco >= 1000 / 7, String(espaco));
  // A fase 1 só lê: o único POST do núcleo é o cadastro do webhook.
  const posts = ["espelho.ts", "conta.ts", "cliente.ts", "webhook.ts"].flatMap((f) =>
    [...readFileSync(`src/lib/kommo/${f}`, "utf8").matchAll(/metodo: "(POST|PATCH|DELETE)"/g)].map(() => f),
  );
  confere("a única escrita na Kommo é o cadastro do webhook", posts.length === 1 && posts[0] === "webhook.ts", posts.join(","));
}

if (falhas > 0) {
  console.error(`\n${falhas} ${falhas === 1 ? "conferência falhou" : "conferências falharam"}.`);
  process.exit(1);
}
console.log("\nTudo certo.");
