/**
 * Confere a origem do negócio da Kommo até o anúncio (0170, cartão 48): a
 * regra de ligação pelo número, a origem em uma palavra, a leitura das duas
 * funções do banco e as colunas do WhatsApp na tabela de Campanhas.
 *   node --experimental-strip-types scripts/teste-kommo-origem.mts
 *
 * Os números de anúncio têm o FORMATO dos que a Kommo recebeu do Meta em
 * 18/11/2026; os ids são inventados (o repositório é público).
 */
import { readFileSync } from "node:fs";
import {
  anuncioDoNegocio, comoLigouONegocio, custoPor, lerNegociosPorOrigem, lerWhatsDasCampanhas, origemDoNegocio, type ItemDoCatalogo,
} from "../src/lib/kommo/origem.ts";
import { achatar, ordenar, somar } from "../src/lib/trafego/linhas.ts";
import type { Avaliado } from "../src/lib/trafego/diagnostico.ts";

let falhas = 0;
function confere(nome: string, ok: boolean, detalhe = "") {
  if (ok) console.log(`  ok  ${nome}`);
  else {
    falhas++;
    console.log(`  FALHOU  ${nome}${detalhe ? `: ${detalhe}` : ""}`);
  }
}

const CAMP = "120200000000000165";
const CONJ = "120200000000100165";
const AN = "120200000000200165";
const CATALOGO: ItemDoCatalogo[] = [
  { plataforma: "meta", nivel: "campanha", id: CAMP, campanha_id: null, conjunto_id: null },
  { plataforma: "meta", nivel: "conjunto", id: CONJ, campanha_id: CAMP, conjunto_id: null },
  { plataforma: "meta", nivel: "anuncio", id: AN, campanha_id: CAMP, conjunto_id: CONJ },
  // O mesmo número em duas plataformas no mesmo nível: ambíguo.
  { plataforma: "meta", nivel: "campanha", id: "555555555", campanha_id: null, conjunto_id: null },
  { plataforma: "google", nivel: "campanha", id: "555555555", campanha_id: null, conjunto_id: null },
];

console.log("Ligação pelo número");
{
  const a = anuncioDoNegocio({ meta_ad_id: AN, meta_adset_id: CONJ, meta_campaign_id: CAMP }, CATALOGO);
  confere("anúncio exato liga com a campanha e o conjunto dele", a?.ligadoPor === "anuncio" && a.anuncioId === AN && a.conjuntoId === CONJ && a.campanhaId === CAMP, JSON.stringify(a));
  const b = anuncioDoNegocio({ meta_ad_id: AN, meta_campaign_id: "999999999" }, CATALOGO);
  confere("a campanha é a do anúncio, não a do campo", b?.campanhaId === CAMP);
  const c = anuncioDoNegocio({ meta_ad_id: "999", meta_adset_id: CONJ }, CATALOGO);
  confere("anúncio desconhecido cai no conjunto", c?.ligadoPor === "conjunto" && c.anuncioId === null && c.campanhaId === CAMP);
  const d = anuncioDoNegocio({ meta_campaign_id: CAMP }, CATALOGO);
  confere("só a campanha liga só a campanha", d?.ligadoPor === "campanha" && d.conjuntoId === null);
  confere("ad_id serve quando não há meta_ad_id", anuncioDoNegocio({ ad_id: AN }, CATALOGO)?.anuncioId === AN);
  confere("número com espaço é limpo", anuncioDoNegocio({ meta_ad_id: ` ${AN} ` }, CATALOGO)?.anuncioId === AN);
  confere("utm_campaign com número liga a campanha", anuncioDoNegocio({ utm_campaign: CAMP }, CATALOGO)?.campanhaId === CAMP);
  confere("utm_campaign com texto não liga por nome", anuncioDoNegocio({ utm_campaign: "Black Friday" }, CATALOGO) === null);
  confere("número que não está no catálogo não liga", anuncioDoNegocio({ meta_ad_id: "111111111" }, CATALOGO) === null);
  confere("número em duas plataformas é ambíguo", anuncioDoNegocio({ meta_campaign_id: "555555555" }, CATALOGO) === null);
  confere("sem nada, sem ligação", anuncioDoNegocio({}, CATALOGO) === null);
}

console.log("Origem em uma palavra");
{
  const liga = anuncioDoNegocio({ meta_ad_id: AN }, CATALOGO);
  confere("ligado é anúncio", origemDoNegocio({ meta_ad_id: AN }, liga) === "anuncio");
  confere("número que não casou", origemDoNegocio({ meta_ad_id: "111" }, null) === "id_sem_casar");
  confere("UTM sem número", origemDoNegocio({ utm_source: "google" }, null) === "utm");
  confere("gclid conta como UTM", origemDoNegocio({ gclid: "abc" }, null) === "utm");
  confere("vazio é sem origem", origemDoNegocio({ utm_source: "  " }, null) === "sem_origem");
  const frase = comoLigouONegocio({ origem: "id_sem_casar", ligadoPor: null, idMeta: "111", utm: null });
  confere("a frase do número que não casou cita o número", frase.includes("111") && !frase.includes("  "), frase);
}

console.log("Leitura das funções do banco");
{
  const w = lerWhatsDasCampanhas({
    lido_em: "2026-11-18T22:00:00Z",
    cobertura: { conversas: 7, conversas_com_id: 5, conversas_ligadas: 4, conversas_ligadas_ao_anuncio: 3, vendas: 2, vendas_ligadas: 1, valor_ligado: "1000.00", vendas_na_loja: 1 },
    por_item: [
      { nivel: "anuncio", id: AN, conversas: 2, vendas: 1, valor: "1000.00", vendas_na_loja: 1 },
      { nivel: "campanha", id: CAMP, conversas: 4, vendas: 1, valor: "1000.00", vendas_na_loja: 1 },
    ],
  });
  confere("lê a cobertura com número", w?.cobertura.valorLigado === 1000 && w.cobertura.vendasNaLoja === 1);
  confere("lê por nivel:id", w?.itens[`anuncio:${AN}`]?.vendas === 1 && w.itens[`campanha:${CAMP}`]?.conversas === 4);
  confere("sem acesso (nulo) vira nulo", lerWhatsDasCampanhas(null) === null);

  const o = lerNegociosPorOrigem({
    lido_em: null,
    por_origem: { anuncio: { negocios: 4, ganhos: 2, valor: "1500.00" }, utm: { negocios: 1, ganhos: 0, valor: 0 } },
    lista: [{ id: 990001, origem: "anuncio", ligado_por: "anuncio", ganho: false, valor: "0", link: "https://exemplo/leads/detail/990001" },
            { id: 990009, origem: "inventada", ligado_por: "x" }],
  });
  confere("contagem de origem ausente vira zero", o?.porOrigem.sem_origem.negocios === 0 && o.porOrigem.codigo.negocios === 0);
  confere("o total soma as origens", o?.total === 5);
  confere("origem desconhecida vira sem origem", o?.lista[1].origem === "sem_origem" && o.lista[1].ligadoPor === null);
}

console.log("Colunas do WhatsApp em Campanhas");
{
  const item = (nivel: Avaliado["nivel"], id: string, gasto: number, filhos: Avaliado[] = []) =>
    ({
      nivel, id, nome: id, campanha_id: null, conjunto_id: null, tipo: "engajamento", ativo: true, gasto, impressoes: 1000, cliques: 10,
      cliques_todos: 10, visitas: null, carrinhos: null, checkouts: null, compras: null, valor: null, conversas: 10,
      objetivo: "engajamento", veredito: "sem_dado", motivo: "", resultados: 0, custo: null, retorno: null, gargalo: null, filhos,
    }) as unknown as Avaliado;
  const arvore = [item("campanha", CAMP, 100, [item("conjunto", CONJ, 100, [item("anuncio", AN, 60)])])];
  const linhas = achatar(arvore, {}, {
    [`anuncio:${AN}`]: { conversas: 3, vendas: 2, valor: 900, vendasNaLoja: 1 },
    [`campanha:${CAMP}`]: { conversas: 4, vendas: 0, valor: 0, vendasNaLoja: 0 },
  });
  const an = linhas.find((l) => l.nivel === "anuncio");
  const cp = linhas.find((l) => l.nivel === "campanha");
  confere("custo por conversa", an?.custoConversa === 20, String(an?.custoConversa));
  confere("custo por venda do WhatsApp", an?.custoVendaWhats === 30, String(an?.custoVendaWhats));
  confere("sem venda, sem custo por venda", cp?.custoVendaWhats === null && cp.custoConversa === 25);
  confere("item sem conversa fica sem WhatsApp", linhas.find((l) => l.nivel === "conjunto")?.whats === null);
  confere("sem o terceiro argumento, nada de WhatsApp", achatar(arvore, {}).every((l) => l.whats === null));
  const t = somar(linhas.filter((l) => l.nivel === "anuncio"));
  confere("o total soma conversas, vendas e valor", t.whatsConversas === 3 && t.whatsVendas === 2 && t.whatsValor === 900);
  const ordem = ordenar(linhas, "custoVendaWhats", "asc");
  confere("vazio vai para o fim na ordem do custo", ordem[0].nivel === "anuncio" && ordem.at(-1)?.custoVendaWhats === null);
  confere("custoPor sem quantidade é nulo", custoPor(100, 0) === null && custoPor(0, 3) === null && custoPor(100, 3) === 33.33);
}

console.log("Regras que a migration promete");
{
  const sql = readFileSync("supabase/migrations/0170_kommo_origem_do_negocio.sql", "utf8");
  confere("as telas leem por função com a área de tráfego em coalesce", (sql.match(/coalesce\(public\.tem_acesso\('trafego'\), false\)/g) ?? []).length === 2);
  confere("a função interna não abre para quem está logado", /revoke execute on function public\.kommo_anuncio_dos_negocios\(date, date\) from public, anon, authenticated/.test(sql));
  confere("a migration não escreve nas tabelas da Kommo", !/(insert into|update|delete from)\s+public\.kommo_/i.test(sql));
  confere("venda ganha é a fase ganho do painel", sql.includes("x.fase = 'ganho'"));
  confere("a ligação com a fase 3 é guardada por to_regclass", sql.includes("to_regclass('public.kommo_vendas')"));
  const origem = readFileSync("src/lib/kommo/origem.ts", "utf8");
  confere("o arquivo da origem não chama a API da Kommo", !/fetch\(|metodo:/.test(origem));
  const lista = readFileSync("src/app/admin/(painel)/trafego/origem/ConversasDaKommo.tsx", "utf8");
  confere("a tela de origem não mostra telefone nem nome do contato", !/telefone|contato/i.test(lista.replace(/\/\*\*[\s\S]*?\*\//g, "")));
}

if (falhas > 0) {
  console.error(`\n${falhas} ${falhas === 1 ? "conferência falhou" : "conferências falharam"}.`);
  process.exit(1);
}
console.log("\nTudo certo.");
