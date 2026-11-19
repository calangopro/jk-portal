/**
 * Confere o carrinho abandonado da Kommo ligado à sessão da Tray (0182,
 * cartão 53): a sessão tirada do "Link do carrinho", a leitura da função do
 * banco e as promessas da migration.
 *   node --experimental-strip-types scripts/teste-kommo-carrinho.mts
 *
 * Os links têm o FORMATO dos que o n8n grava na Kommo (18/11/2026); as
 * sessões são inventadas (o repositório é público).
 */
import { readFileSync } from "node:fs";
import {
  CAMPO_LINK_DO_CARRINHO, PADRAO_DA_LOJA, PADRAO_DO_LINK, comoLigouOCarrinho, lerCarrinhos, linkDoCarrinho, sessaoDoLinkDoCarrinho, tempoAtePedido,
} from "../src/lib/kommo/carrinho.ts";

let falhas = 0;
function confere(nome: string, ok: boolean, detalhe = "") {
  if (ok) console.log(`  ok  ${nome}`);
  else {
    falhas++;
    console.log(`  FALHOU  ${nome}${detalhe ? `: ${detalhe}` : ""}`);
  }
}

const S = "abcd1234efgh5678ijkl9012mn";

console.log("Sessão no link do carrinho");
{
  const s = (l: string | null) => sessaoDoLinkDoCarrinho(l);
  confere("o formato do n8n", s(`https://www.jkaliancas.com.br/checkout/cart?session_id=${S}&store_id=1305187`) === S);
  confere("store_id antes da sessão", s(`https://www.jkaliancas.com.br/checkout/cart?store_id=1305187&session_id=${S}`) === S);
  confere("sem www, http e maiúsculas no domínio", s(`http://JKALIANCAS.com.br/checkout/cart?session_id=${S}`) === S);
  confere("espaço em volta não atrapalha", s(`  https://www.jkaliancas.com.br/checkout/cart?session_id=${S}&store_id=1305187 \n`) === S);
  confere("com âncora no fim", s(`https://www.jkaliancas.com.br/checkout/cart?session_id=${S}#topo`) === S);
  confere("outra loja da Tray não vale", s(`https://www.jkaliancas.com.br/checkout/cart?session_id=${S}&store_id=999`) === null);
  confere("store_id vazio não vale", s(`https://www.jkaliancas.com.br/checkout/cart?session_id=${S}&store_id=`) === null);
  confere("outro domínio não vale", s(`https://loja.exemplo.com/checkout/cart?session_id=${S}`) === null);
  confere("domínio da JK como prefixo de outro não vale", s(`https://www.jkaliancas.com.br.exemplo.com/checkout/cart?session_id=${S}`) === null);
  confere("o link da JK dentro de outro endereço não vale", s(`https://exemplo.com/?u=https://www.jkaliancas.com.br/checkout/cart?session_id=${S}`) === null);
  confere("página de produto sem sessão", s("https://www.jkaliancas.com.br/aliancas/par-de-aliancas-2mm") === null);
  confere("sessão curta demais", s("https://www.jkaliancas.com.br/checkout/cart?session_id=abc") === null);
  confere("sessão com caractere estranho", s(`https://www.jkaliancas.com.br/checkout/cart?session_id=${S}%27or`) === null);
  confere("parâmetro parecido não confunde", s(`https://www.jkaliancas.com.br/checkout/cart?old_session_id=${S}`) === null);
  confere("vazio e nulo", s("") === null && s(null) === null);
}

console.log("Link entre os campos do negócio");
{
  confere("acha pelo id do campo", linkDoCarrinho([{ id: 1, valor: "x" }, { id: CAMPO_LINK_DO_CARRINHO, valor: " https://a " }]) === "https://a");
  confere("id como texto também", linkDoCarrinho([{ id: String(CAMPO_LINK_DO_CARRINHO), valor: "https://b" }]) === "https://b");
  confere("sem o campo", linkDoCarrinho([{ id: 1, valor: "x" }]) === null && linkDoCarrinho(null) === null);
}

console.log("Leitura da função do banco");
{
  const d = lerCarrinhos({
    lido_em: "2026-11-19T02:32:45Z", total: 10, com_sessao: 9, ligados: 4, com_origem: 2, com_anuncio: 1,
    por_canal: [
      { canal: "sem_visitante", carrinhos: 5, anuncio: 0, pedidos: 1, pagos: 1 },
      { canal: "meta", carrinhos: 1, anuncio: 1, pedidos: 1, pagos: 0 },
      { canal: "busca_google", carrinhos: 5, anuncio: 0, pedidos: null, pagos: null },
    ],
    pedidos: { viraram: 2, pagos: 1, valor_pago: 399.9, horas_mediana: 20.5 },
    lista: [
      { id: 82282496, criado_em: "2026-11-18T22:37:00Z", etapa: "ECOMM | RECUPERAÇÃO › Abandono de Carrinho", tem_sessao: true, ligado: true, canal: "meta", plataforma: "meta", campanha: "C", conjunto: null, anuncio: "A", pedido: 11801, pago: true, horas: 3.5 },
      { id: 0 },
      { id: 82282497, tem_sessao: false, ligado: false, plataforma: "tiktok", pedido: null, pago: null, horas: null },
    ],
  });
  confere("lê os totais", d?.total === 10 && d.comSessao === 9 && d.ligados === 4 && d.comOrigem === 2 && d.comAnuncio === 1);
  confere("canais do maior para o menor, empate pelo nome", d?.porCanal.map((c) => c.canal).join(",") === "busca_google,sem_visitante,meta");
  confere("sem vendas, o pedido do canal fica nulo", d?.porCanal[0].pedidos === null);
  confere("lê o bloco de pedidos", d?.pedidos?.viraram === 2 && d.pedidos.valorPago === 399.9 && d.pedidos.horasMediana === 20.5);
  confere("descarta item sem id", d?.lista.length === 2);
  confere("o link do negócio é o da Kommo", d?.lista[0].link === "https://kathleengfz.kommo.com/leads/detail/82282496");
  confere("plataforma desconhecida vira nula", d?.lista[1].plataforma === null);
  confere("o pedido, pago e horas", d?.lista[0].pedido === 11801 && d.lista[0].pago === true && d.lista[0].horas === 3.5);
  const sem = lerCarrinhos({ total: 3, pedidos: null, por_canal: [], lista: [] });
  confere("sem a área de vendas, pedidos é nulo", sem?.pedidos === null);
  confere("resposta nula vira nula", lerCarrinhos(null) === null);
}

console.log("Frases");
{
  confere("minutos", tempoAtePedido(0.25) === "em 15 min");
  confere("menos de um minuto vira um", tempoAtePedido(0) === "em 1 min");
  confere("horas", tempoAtePedido(5.4) === "em 5 h");
  confere("dias", tempoAtePedido(72) === "em 3 dias" && tempoAtePedido(36) === "em 36 h" && tempoAtePedido(50) === "em 2 dias");
  confere("até 48 h fica em horas", tempoAtePedido(47.9) === "em 48 h" && tempoAtePedido(48) === "em 2 dias");
  confere("negativo vira zero", tempoAtePedido(-0.5) === "em 1 min");
  confere("sem horas", tempoAtePedido(null) === null);
  confere("sem sessão", /sessão da loja/.test(comoLigouOCarrinho({ temSessao: false, ligado: false, canal: null })));
  confere("sessão sem visitante cita o coletor", /13\/11\/2026/.test(comoLigouOCarrinho({ temSessao: true, ligado: false, canal: null })));
  confere("ligado", /mesma regra dos pedidos/.test(comoLigouOCarrinho({ temSessao: true, ligado: true, canal: "meta" })));
}

console.log("Regras que a migration promete");
{
  const sql = readFileSync("supabase/migrations/0182_kommo_carrinho_origem.sql", "utf8");
  confere("o padrão do link é o mesmo texto no banco", sql.includes(`'${PADRAO_DO_LINK}'`));
  confere("o padrão da loja é o mesmo texto no banco", sql.includes(`'${PADRAO_DA_LOJA}'`));
  confere("o número da loja é o mesmo", sql.includes("<> '1305187'"));
  confere("o campo do link é o mesmo", sql.includes(`'${CAMPO_LINK_DO_CARRINHO}'`) && sql.includes(`[{"id": ${CAMPO_LINK_DO_CARRINHO}}]`));
  confere("a tela lê com a área de tráfego em coalesce", sql.includes("if not coalesce(public.tem_acesso('trafego'), false) then"));
  confere("a parte de pedido pede a área de vendas", sql.includes("v_vendas boolean := coalesce(public.tem_acesso('vendas'), false)") && (sql.match(/case when v_vendas then/g) ?? []).length >= 4);
  confere("a função interna não abre para quem está logado", /revoke execute on function public\.kommo_carrinhos\(date, date\) from public, anon, authenticated/.test(sql));
  confere("a migration não escreve nas tabelas da Kommo", !/(insert into|update|delete from)\s+public\.kommo_/i.test(sql));
  confere("pedidos e carrinhos usam a mesma regra de chegada", (sql.match(/public\.origem_das_chegadas\(l\.refs, l\.visitantes, l\.momentos\)/g) ?? []).length === 2);
  confere("a janela do pedido é a mesma na tela e na gaveta",
    sql.includes("p.feito_em >= g.criado_em - interval '1 hour'") && sql.includes("p.feito_em < g.criado_em + interval '30 days'")
    && sql.includes("n.criado_em > r.feito_em - interval '30 days'") && sql.includes("n.criado_em <= r.feito_em + interval '1 hour'"));
  const regra = readFileSync("supabase/migrations/0113_clique_em_anuncio_tem_precedencia.sql", "utf8");
  const trecho = regra.slice(regra.indexOf("  -- Cada nome que cada item"), regra.indexOf("  select\n    m.pedido"));
  confere("a regra da chegada saiu da 0113 sem mudar uma linha", trecho.length > 1000 && sql.includes(trecho));
  const tela = readFileSync("src/app/admin/(painel)/trafego/origem/CarrinhosDaKommo.tsx", "utf8").replace(/\/\*\*[\s\S]*?\*\//g, "");
  confere("a tela não mostra telefone nem nome do contato", !/telefone|contato|cliente_/i.test(tela));
  const puro = readFileSync("src/lib/kommo/carrinho.ts", "utf8");
  confere("o arquivo do carrinho não chama a API da Kommo", !/fetch\(|metodo:/.test(puro));
}

if (falhas > 0) {
  console.error(`\n${falhas} ${falhas === 1 ? "conferência falhou" : "conferências falharam"}.`);
  process.exit(1);
}
console.log("\nTudo certo.");
