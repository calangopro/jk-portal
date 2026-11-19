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

if (falhas > 0) {
  console.error(`\n${falhas} ${falhas === 1 ? "conferência falhou" : "conferências falharam"}.`);
  process.exit(1);
}
console.log("\nTudo certo.");
