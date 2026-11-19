/**
 * Confere a venda ganha na Kommo (0165, cartão 47): a decisão de cada negócio,
 * a leitura do Pedido Tray, a forma e o canal, e as regras que a migration
 * promete. Roda sem banco, sem rede e sem a chave:
 *   node --experimental-strip-types scripts/teste-kommo-vendas.mts
 *
 * Os negócios têm o FORMATO do espelho (0160), com nomes e ids inventados (o
 * repositório é público). Funis com os nomes reais da conta em 18/11/2026.
 */
import { readFileSync } from "node:fs";
import {
  FUNIL_DE_POS_VENDA, FUNIL_DE_VENDA, MOTIVOS, acoesDoMotivo, campoPeloNome, canalDoFunil, decidir, esperaOuConfere, formaDoMetodo,
  funilDeVenda, lerListaDaKommo, normalizarPedido, pareceServico, saiuDoGanho, type Candidato,
} from "../src/lib/kommo/vendas.ts";
import { SETORES } from "../src/lib/painel/setores.ts";
import { familiaDaPeca, lerFaltasNaFabrica, lerNumeracao, lerProducaoDaKommo } from "../src/lib/kommo/fabrica.ts";
import { ENTREGA_A_COMBINAR, lerProducao } from "../src/lib/vendas/producao.ts";
import { lerEspecificacoes, lerEntrega } from "../src/lib/fabrica/etapas.ts";

let falhas = 0;
function confere(nome: string, ok: boolean, detalhe = "") {
  if (ok) console.log(`  ok  ${nome}`);
  else {
    falhas++;
    console.log(`  FALHOU  ${nome}${detalhe ? `: ${detalhe}` : ""}`);
  }
}
const AGORA = "2026-11-18T21:30:00.000Z";
const V = "2fb0af90-0000-4000-8000-000000000001";

function negocio(m: Partial<Candidato> = {}): Candidato {
  return {
    negocio_id: 900001, nome: "Lead inventado", valor: 1299.9, funil: "ECOMM | WHATS", etapa_id: 142, apagado: false, existe: true,
    fechado_em: AGORA, pedido_tray: null, motivo_compra: null,
    campos: [{ id: 3104016, nome: "Método de pagamento", codigo: null, valor: "Pix" }, { id: 3173632, nome: "Produto", codigo: null, valor: "Par de alianças 4 mm" }],
    responsavel_id: 16073687, papel: "vendedor", profile_id: V, pode_vender: true, estado: null, motivo: null, ganho_em: null,
    ...m,
  };
}

console.log("Pedido Tray");
{
  confere("número puro", JSON.stringify(normalizarPedido("11779")) === '{"numero":11779}');
  confere("com cerquilha e texto", JSON.stringify(normalizarPedido("Pedido #11779")) === '{"numero":11779}');
  confere("com ponto de milhar", JSON.stringify(normalizarPedido("11.779")) === '{"numero":11779}');
  confere("com espaço no meio", JSON.stringify(normalizarPedido("11 779")) === '{"numero":11779}');
  confere("o mesmo número duas vezes não é ambíguo", JSON.stringify(normalizarPedido("11779 / 11779")) === '{"numero":11779}');
  confere("dois números diferentes é ambíguo", JSON.stringify(normalizarPedido("11779 e 11781")) === '{"ambiguo":true}');
  confere("vazio e só letras são nulos", normalizarPedido("") === null && normalizarPedido(null) === null && normalizarPedido("site") === null);
  confere("número curto demais não vira pedido", normalizarPedido("12") === null);
}

console.log("Funil, forma, canal");
{
  confere("WHATS é funil de venda", funilDeVenda("ECOMM | WHATS") && funilDeVenda("GRAND PLAZA | WHATS") && funilDeVenda("Tamboré | WHATS"));
  confere("RECUPERAÇÃO é funil de venda", funilDeVenda("ECOMM | RECUPERAÇÃO"));
  confere("PDV, PÓS VENDAS e SAC não são", !funilDeVenda("GRAND PLAZA | PDV") && !funilDeVenda("ECOMM | PÓS VENDAS") && !funilDeVenda("ECOMM | SAC") && !funilDeVenda("[V4] - PDV") && !funilDeVenda("Tamboré | PÓS VENDAS"));
  confere("funil sem nome não é", !funilDeVenda(null));
  confere("Pix", formaDoMetodo("Pix") === "pix");
  confere("Pagamento com cartão", formaDoMetodo("Pagamento com cartão") === "cartao");
  confere("Dinheiro", formaDoMetodo("Dinheiro") === "dinheiro");
  confere("Fatura e vazio viram outro", formaDoMetodo("Fatura") === "outro" && formaDoMetodo(null) === "outro");
  confere("canal pelo funil", canalDoFunil("ECOMM | WHATS") === "whatsapp" && canalDoFunil("ECOMM | RECUPERAÇÃO") === "recuperacao");
  confere("troca no método é serviço", pareceServico("TROCA", null));
  confere("conserto e ajuste no motivo são serviço", pareceServico(null, "Conserto") && pareceServico("Pix", "Ajuste"));
  confere("casamento não é serviço", !pareceServico("Pix", "Casamento"));
  confere("campo pelo nome sem acento", campoPeloNome([{ id: 1, nome: "Método de pagamento", codigo: null, valor: " Pix " }], "metodo de pagamento") === "Pix");
  confere("o primeiro Produto preenchido vale", campoPeloNome([{ id: 1, nome: "Produto", codigo: null, valor: "" }, { id: 2, nome: "Produto", codigo: null, valor: "Anel" }], "Produto") === "Anel");
}

console.log("Decisão");
{
  const a = decidir(negocio({ pedido_tray: "11779" }), AGORA);
  confere("ganho com Pedido Tray marca o pedido", a.tipo === "marcar" && a.pedido === 11779 && a.vendedor === V, JSON.stringify(a));
  const b = decidir(negocio(), AGORA);
  confere("ganho sem pedido registra venda por fora", b.tipo === "registrar" && b.vendedor === V, JSON.stringify(b));
  confere("com forma, canal e produto", b.tipo === "registrar" && b.dados.forma === "pix" && b.dados.canal === "whatsapp" && b.dados.produto === "Par de alianças 4 mm");
  const c = decidir(negocio({ papel: "loja", profile_id: null }), AGORA);
  confere("usuário de loja vai para a fila sem vendedor", c.tipo === "conferir" && c.motivo === "sem_vendedor");
  const c2 = decidir(negocio({ papel: null, profile_id: null }), AGORA);
  confere("usuário sem mapa vai para a fila sem vendedor", c2.tipo === "conferir" && c2.motivo === "sem_vendedor");
  const c3 = decidir(negocio({ papel: "loja", profile_id: V }), AGORA);
  confere("papel loja com pessoa ligada também não é palpite", c3.tipo === "conferir" && c3.motivo === "sem_vendedor");
  const d = decidir(negocio({ pode_vender: false }), AGORA);
  confere("pessoa que não lança venda vai para a fila", d.tipo === "conferir" && d.motivo === "vendedor_sem_acesso");
  const e = decidir(negocio({ valor: null }), AGORA);
  confere("ganho sem valor vai para a fila", e.tipo === "conferir" && e.motivo === "sem_valor");
  confere("valor zero também", (() => { const x = decidir(negocio({ valor: 0 }), AGORA); return x.tipo === "conferir" && x.motivo === "sem_valor"; })());
  const f = decidir(negocio({ valor: null, pedido_tray: "11779" }), AGORA);
  confere("sem valor mas com pedido marca (o valor é o do pedido)", f.tipo === "marcar");
  const g = decidir(negocio({ pedido_tray: "11779 e 11781" }), AGORA);
  confere("pedido ambíguo vai para a fila", g.tipo === "conferir" && g.motivo === "pedido_ambiguo");
  const h = decidir(negocio({ motivo_compra: "Conserto" }), AGORA);
  confere("conserto sem pedido vai para a fila", h.tipo === "conferir" && h.motivo === "servico");
  confere("ganho num funil de pós-venda não vira venda", decidir(negocio({ funil: "GRAND PLAZA | PDV" }), AGORA).tipo === "nada");
  confere("ganho no SAC (Resolvido) não vira venda", decidir(negocio({ funil: "ECOMM | SAC" }), AGORA).tipo === "nada");
  confere("negócio aberto nunca visto não faz nada", decidir(negocio({ etapa_id: 107260463 }), AGORA).tipo === "nada");
}

console.log("Uma vez só");
{
  confere("já marcada não marca de novo", decidir(negocio({ pedido_tray: "11779", estado: "marcada" }), AGORA).tipo === "nada");
  confere("já registrada não registra de novo", decidir(negocio({ estado: "registrada" }), AGORA).tipo === "nada");
  confere("tirada da fila não volta", decidir(negocio({ estado: "ignorada" }), AGORA).tipo === "nada");
  confere("repetida espera a gerência", decidir(negocio({ estado: "conferir", motivo: "repetida" }), AGORA).tipo === "nada");
  confere("já na loja espera a gerência", decidir(negocio({ estado: "conferir", motivo: "ja_na_loja" }), AGORA).tipo === "nada");
  confere("pedido de outro espera a gerência", decidir(negocio({ pedido_tray: "11779", estado: "conferir", motivo: "pedido_de_outro" }), AGORA).tipo === "nada");
  confere("sem vendedor anda sozinho quando o mapa é preenchido", decidir(negocio({ estado: "conferir", motivo: "sem_vendedor" }), AGORA).tipo === "registrar");
  confere("sem valor anda sozinho quando a Kommo ganha o valor", decidir(negocio({ estado: "conferir", motivo: "sem_valor" }), AGORA).tipo === "registrar");
  confere("esperando o pedido tenta de novo", decidir(negocio({ pedido_tray: "11779", estado: "aguardando_pedido" }), AGORA).tipo === "marcar");
  confere("desfeita e ganha de novo volta a contar", decidir(negocio({ estado: "desfeita" }), AGORA).tipo === "registrar");
  confere("espera o pedido três dias", esperaOuConfere("2026-11-17T21:30:00.000Z", AGORA) === "esperar" && esperaOuConfere("2026-11-15T21:00:00.000Z", AGORA) === "conferir");
}

console.log("Sair do ganho");
{
  confere("voltar para etapa aberta do funil de venda desfaz", saiuDoGanho(negocio({ etapa_id: 107260463 })));
  confere("ir para perdido desfaz", saiuDoGanho(negocio({ etapa_id: 143 })));
  confere("apagado desfaz", saiuDoGanho(negocio({ apagado: true })));
  confere("sumir do espelho desfaz", saiuDoGanho(negocio({ existe: false })));
  confere("ir para o pós-venda NÃO desfaz", !saiuDoGanho(negocio({ funil: "GRAND PLAZA | PDV", etapa_id: 108923731 })));
  confere("FINALIZADO (143) no PDV NÃO desfaz", !saiuDoGanho(negocio({ funil: "GRAND PLAZA | PDV", etapa_id: 143 })));
  confere("registrada que saiu do ganho é desfeita", decidir(negocio({ etapa_id: 143, estado: "registrada" }), AGORA).tipo === "desfazer");
  confere("marcada que saiu do ganho é desfeita", decidir(negocio({ etapa_id: 143, estado: "marcada" }), AGORA).tipo === "desfazer");
  confere("esperando o pedido que saiu do ganho fecha", decidir(negocio({ etapa_id: 143, estado: "aguardando_pedido" }), AGORA).tipo === "desfazer");
  confere("nunca visto que saiu não faz nada", decidir(negocio({ etapa_id: 143 }), AGORA).tipo === "nada");
  confere("já na fila por desfazer não repete", decidir(negocio({ etapa_id: 143, estado: "conferir", motivo: "desfeito_estorno" }), AGORA).tipo === "nada");
  confere("registrada que foi para o pós-venda continua", decidir(negocio({ funil: "ECOMM | PÓS VENDAS", etapa_id: 108804423, estado: "registrada" }), AGORA).tipo === "nada");
}

console.log("Tela");
{
  const l = lerListaDaKommo({
    pode: { resolver: false, ver_valor: false },
    vendas: [{ negocio_id: 900001, estado: "registrada", valor: null, dia: "2026-11-18" }],
    fila: [{ negocio_id: 900002, motivo: "sem_vendedor", valor: "500.00" }],
    resumo: { marcadas: 1, registradas: "2", na_fila: 1, valor: null },
    vendedores: [],
  });
  confere("lê a lista", l !== null && l.vendas.length === 1 && l.fila.length === 1 && l.resumo.registradas === 2);
  confere("valor escondido continua nulo, não zero", l?.vendas[0].valor === null && l?.resumo.valor === null);
  confere("o link é o do negócio na Kommo", l?.fila[0].link === "https://kathleengfz.kommo.com/leads/detail/900002");
  confere("resposta vazia é nula", lerListaDaKommo(null) === null);
  confere("todo motivo tem texto e ações", (Object.keys(MOTIVOS) as (keyof typeof MOTIVOS)[]).every((m) => MOTIVOS[m] && acoesDoMotivo(m).length > 0));
  confere("desfeito com estorno oferece estornar", acoesDoMotivo("desfeito_estorno")[0] === "estornar");
  const textos = [...Object.values(MOTIVOS), readFileSync("src/app/admin/(painel)/vendas-da-kommo/Tela.tsx", "utf8")].join("\n");
  confere("nenhum travessão no texto", !/[—–]/.test(textos));
  const item = SETORES.flatMap((s) => s.itens).find((i) => i.href === "/admin/vendas-da-kommo");
  confere("a tela está no menu com a área de Pedidos do site", item?.area === "lancar_venda");
  const pagina = readFileSync("src/app/admin/(painel)/vendas-da-kommo/page.tsx", "utf8");
  confere("a página pede a mesma área", pagina.includes('requireArea("lancar_venda")'));
}

console.log("Migration 0165");
{
  const sql = readFileSync("supabase/migrations/0165_kommo_vendas.sql", "utf8");
  confere("a expressão do funil de venda é a mesma do código", sql.includes(`'${FUNIL_DE_VENDA.source}'`) && sql.includes(`'${FUNIL_DE_POS_VENDA.source}'`));
  confere("os motivos do banco são os do código", (Object.keys(MOTIVOS) as string[]).every((m) => sql.includes(`'${m}'`)));
  confere("tabelas com RLS ligada e sem policy", ["kommo_vendas", "kommo_vendas_movimentos", "kommo_vendas_config"].every((t) => sql.includes(`alter table public.${t} enable row level security`)) && !/create policy/i.test(sql));
  confere("as portas de sempre", sql.includes("public.pedido_marcar_vendedor(") && sql.includes("public.registrar_venda_avulsa(") && sql.includes("public.estornar_venda_avulsa("));
  confere("a rodada nunca força a trava de duplicidade", /p_forcar => false/.test(sql.split("create or replace function public.kommo_vendas_lista")[0]));
  confere("nada grava nas tabelas da Kommo", !/(insert into|update|delete from)\s+public\.kommo_(negocios|contatos|eventos|usuarios|funis|etapas|mapa|pendentes|estado)\b/i.test(sql));
  confere("a área é conferida dentro de coalesce", (sql.match(/coalesce\(public\.tem_acesso\(/g) ?? []).length >= 3);
  confere("entrar em nome de outra pessoa não abre para ninguém", /revoke execute on function public\.kommo_vendas_entrar_como\(uuid\), public\.kommo_vendas_sair\(jsonb\) from public, anon, authenticated, service_role/.test(sql));
  confere("a rodada é só da chave de serviço", /revoke execute on function public\.kommo_vendas_candidatos\(int\), public\.kommo_venda_aplicar\(bigint, jsonb\) from public, anon, authenticated/.test(sql));
  confere("espera o pedido os mesmos três dias", sql.includes("interval '3 days'"));
  const rodada = readFileSync("src/lib/kommo/vendas-rodada.ts", "utf8");
  confere("a rodada não escreve na Kommo", !/metodo: "(POST|PATCH|DELETE)"|clienteDaKommo/.test(rodada));
  const rota = readFileSync("src/app/api/cron/kommo/route.ts", "utf8");
  confere("a rotina chama o passo da venda depois do espelho", rota.indexOf("rodarLeituraDaKommo(") < rota.indexOf("processarVendasDaKommo("));
}

console.log("Fábrica: a produção lida da Kommo (cartão 51)");
{
  // Os campos no formato do espelho, com valores como os vendedores escrevem (18/11/2026).
  const c = (pares: Record<string, string>) => Object.entries(pares).map(([nome, valor], i) => ({ id: 3170000 + i, nome, codigo: null, valor }));
  const par = { "Tipo de Produto": "Alianças", Metal: "Prata", "Tipo de Joia": "zircônia", "Modelo Aliança": "Anatomico", "Milimetros/tamanho": "4mm" };

  confere("numeração com e", JSON.stringify(lerNumeracao("17 e 23")) === '["17","23"]');
  confere("numeração com E maiúsculo", JSON.stringify(lerNumeracao("18 E 19")) === '["18","19"]');
  confere("numeração com barra", JSON.stringify(lerNumeracao("17/16")) === '["17","16"]');
  confere("numeração com vírgula é dois aros", JSON.stringify(lerNumeracao("12,25")) === '["12","25"]');
  confere("meio número fica inteiro", JSON.stringify(lerNumeracao("17,5 e 20")) === '["17,5","20"]');
  confere("milímetro no campo é ambíguo", lerNumeracao("4mm") === null);
  confere("número fora de aro é ambíguo", lerNumeracao("120") === null && lerNumeracao("21.04") === null);
  confere("vazio não é ambíguo", JSON.stringify(lerNumeracao("")) === "[]");
  confere("família pelo tipo", familiaDaPeca("Alianças", null) === "aliancas" && familiaDaPeca("Anéis", null) === "anel" && familiaDaPeca("Relógios", null) === "sem_numeracao");
  confere("família pelo produto, sem tipo", familiaDaPeca(null, "par jk 827a") === "aliancas" && familiaDaPeca(null, "an912254jk, jkelegan") === "desconhecida");

  const completa = lerProducaoDaKommo(c({ ...par, Numeração: "17 e 23", Gravura: "Isaac/Ana Clara 21.04.26", Loja: "Tamboré" }));
  confere("par completo vai para a fábrica", completa.tipo === "fabrica");
  const p0 = completa.formulario.pecas[0];
  confere("a peça sai do tipo com o metal", p0.nome === "Alianças de Prata");
  confere("os dois aros", p0.aro1 === "17" && p0.aro2 === "23" && p0.anel === "");
  confere("gravação como foi escrita, sem palpite de laser ou manual", p0.gravar1 === "Isaac/Ana Clara 21.04.26" && p0.gravacao === "a_confirmar");
  confere("loja física é retirada", completa.formulario.entrega === "retirada" && completa.formulario.loja === "Tamboré");
  const banco = lerProducao(completa.formulario);
  confere("passa pela MESMA conferência do formulário", banco.ok);
  if (banco.ok) {
    const esp = lerEspecificacoes(banco.producao.pecas[0].info);
    const aros = esp.filter((e) => e.tipo === "aro").map((e) => e.valor);
    const gravar = esp.filter((e) => e.tipo === "gravar").map((e) => e.valor);
    confere("a fábrica lê os dois aros", JSON.stringify(aros) === '["17","23"]', JSON.stringify(esp));
    confere("a fábrica lê a gravação igual", JSON.stringify(gravar) === '["Isaac/Ana Clara 21.04.26"]', JSON.stringify(esp));
    confere("a gravação não vira Aro 01 por palpite", !/Gravação - Aro 01/.test(banco.producao.pecas[0].info ?? ""));
    confere("o metal e o modelo vão nos detalhes", esp.some((e) => e.rotulo === "Detalhes" && /Anatomico/.test(e.valor) && /4mm/.test(e.valor)));
    confere("a fábrica lê a retirada", lerEntrega(banco.producao.entrega)?.tipo === "retirada");
  }
  const comSinais = lerProducao(lerProducaoDaKommo(c({ ...par, Numeração: "17 e 23", Gravura: "Te amo <3 & sempre" })).formulario);
  confere("gravação com sinais volta igual", comSinais.ok && lerEspecificacoes(comSinais.producao.pecas[0].info).some((e) => e.tipo === "gravar" && e.valor === "Te amo <3 & sempre"));

  const semLoja = lerProducaoDaKommo(c({ ...par, Numeração: "17 e 23" }));
  const semLojaBanco = lerProducao(semLoja.formulario);
  confere("sem loja, entrega a combinar", semLoja.tipo === "fabrica" && semLojaBanco.ok && semLojaBanco.producao.entrega === ENTREGA_A_COMBINAR);
  confere("e-commerce não é retirada", lerProducaoDaKommo(c({ ...par, Numeração: "17 e 23", Loja: "E-commerce" })).formulario.entrega === "a_combinar");

  const motivos = (pares: Record<string, string>) => {
    const l = lerProducaoDaKommo(c(pares));
    return l.tipo === "fabrica" ? [] : l.motivos;
  };
  confere("um aro só: falta o segundo", motivos({ ...par, Numeração: "17" })[0] === "Falta a numeração do segundo aro");
  const umAro = lerProducaoDaKommo(c({ ...par, Numeração: "17" }));
  confere("o aro que veio já fica no formulário de completar", umAro.formulario.pecas[0].aro1 === "17" && umAro.formulario.pecas[0].aro2 === "");
  confere("sem numeração: faltam os dois", motivos(par)[0] === "Falta a numeração dos dois aros");
  confere("conjunto pede o anel", motivos({ ...par, Numeração: "17 e 23", "Contém conjunto?": "Sim" })[0]?.startsWith("Falta a numeração do anel do conjunto"));
  const conj = lerProducaoDaKommo(c({ ...par, Numeração: "17, 23 e 16", "Contém conjunto?": "Sim", "Quantidade de produtos": "3" }));
  confere("conjunto com três números vai, com o anel", conj.tipo === "fabrica" && conj.formulario.pecas[0].anel === "16");
  confere("quantidade que não é um par vai para conferir", motivos({ ...par, Numeração: "17 e 23", "Quantidade de produtos": "4" }).some((m) => m.includes("Quantidade de produtos 4")));
  confere("numeração ambígua não vira palpite", motivos({ ...par, Numeração: "2mm" })[0]?.startsWith("Não dá para ler a numeração"));
  confere("sem metal nem produto: não sei qual peça", motivos({ "Tipo de Produto": "Alianças", Numeração: "17 e 23" })[0]?.startsWith("Não sei qual peça"));
  confere("negócio vazio: não sei qual peça", motivos({})[0]?.startsWith("Não sei qual peça"));
  confere("produto escrito sem tipo: não sei se leva numeração", motivos({ Produto: "an912254jk, jkelegan" }).some((m) => m.startsWith("Não sei se a peça leva numeração")));
  const anel = lerProducaoDaKommo(c({ "Tipo de Produto": "Anéis", Metal: "Prata", Numeração: "15" }));
  confere("anel com um número vai", anel.tipo === "fabrica" && anel.formulario.pecas[0].aro1 === "15");
  confere("anel com dois números não vai", motivos({ "Tipo de Produto": "Anéis", Metal: "Prata", Numeração: "15 e 16" }).length > 0);
  const relogio = lerProducaoDaKommo(c({ "Tipo de Produto": "Relógios", Metal: "Ouro" }));
  confere("relógio sem gravação fica fora da fábrica", relogio.tipo === "fora");
  confere("corrente com gravação vai", lerProducaoDaKommo(c({ "Tipo de Produto": "Corrente", Metal: "Ouro", Gravura: "Maria" })).tipo === "fabrica");
  const todos = [completa, semLoja, relogio, lerProducaoDaKommo(c({}))].flatMap((l) => (l.tipo === "fabrica" ? [] : l.motivos));
  confere("nenhum travessão nos motivos", !/[—–]/.test(todos.join(" ")));

  const lista = lerFaltasNaFabrica([{ negocio_id: 900003, venda_id: V, estado: "incompleta", motivos: ["Falta a numeração do segundo aro"], pode_completar: true }]);
  confere("lê a lista da tela", lista.length === 1 && lista[0].link === "https://kathleengfz.kommo.com/leads/detail/900003" && lista[0].motivos.length === 1);
  confere("resposta vazia da lista é vazia", lerFaltasNaFabrica(null).length === 0);
}

console.log("Migration 0176");
{
  const sql = readFileSync("supabase/migrations/0176_kommo_venda_na_fabrica.sql", "utf8");
  confere("nada grava nas tabelas kommo_*", !/(insert into|update|delete from)\s+public\.kommo_/i.test(sql));
  confere("entra pela porta da venda por fora", sql.includes("public.enviar_venda_para_a_fabrica("));
  confere("em nome do vendedor, e sai", sql.includes("public.kommo_vendas_entrar_como(v_kv.vendedor)") && sql.includes("public.kommo_vendas_sair(v_antes)"));
  confere("tabelas com RLS ligada e sem policy", ["fabrica_kommo", "fabrica_kommo_config"].every((t) => sql.includes(`alter table public.${t} enable row level security`)) && !/create policy/i.test(sql));
  confere("a rodada é só da chave de serviço", /revoke execute on function public\.kommo_fabrica_candidatos\(int\), public\.kommo_fabrica_aplicar\(uuid, jsonb\) from public, anon, authenticated/.test(sql));
  confere("venda com produção não é candidata (uma vez só)", /not exists \(select 1 from public\.vendas_producao vp where vp\.venda = v\.id\)/.test(sql));
  confere("a área é conferida dentro de coalesce", (sql.match(/coalesce\(public\.tem_acesso\(/g) ?? []).length >= 3);
  confere("a fila leva a origem e o aviso de desfeito", sql.includes("'kommo', kommo") && sql.includes("'desfeito_na_kommo', desfeito"));
  confere("nenhum travessão", !/[—–]/.test(sql));
  const rodada = readFileSync("src/lib/kommo/fabrica-rodada.ts", "utf8");
  confere("a rodada da fábrica não escreve na Kommo", !/metodo: "(POST|PATCH|DELETE)"|clienteDaKommo/.test(rodada));
  confere("a rodada confere com lerProducao", rodada.includes("lerProducao(lida.formulario)"));
  confere("o passo da venda chama o da fábrica", readFileSync("src/lib/kommo/vendas-rodada.ts", "utf8").includes("processarFabricaDaKommo("));
}

if (falhas > 0) {
  console.error(`\n${falhas} ${falhas === 1 ? "conferência falhou" : "conferências falharam"}.`);
  process.exit(1);
}
console.log("\nTudo certo.");
