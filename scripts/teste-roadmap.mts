/**
 * Confere o Roadmap do painel (0141): a leitura do que o banco devolve, os
 * filtros, o aviso de cruzamento, o nome do ramo, o menu e o conector. Roda
 * sem banco e sem navegador:
 *   node --experimental-strip-types scripts/teste-roadmap.mts
 *
 * O cruzamento de caminhos em si mora no banco (`roadmap_cruzam`) e foi
 * conferido lá, num ensaio desfeito, com JWT falso de cada nível. Os cartões
 * daqui são inventados.
 */
import { readFileSync } from "node:fs";
import {
  COLUNAS, FRASE_DA_COLUNA, MENSAGEM_DO_MOTIVO, NOME_DA_COLUNA, NOME_DA_PRIORIDADE, NOME_DO_TIPO, REGRA_DO_TRABALHO,
  filtrarCartoes, lerCaminhos, lerCartaoInteiro, lerQuadro, mensagemDoMotivo, movimentoEmPalavras, numeroDoPr, paresQueCruzam, porColuna,
  prValido, quemEstaFazendo, ramoSugerido, ramoValido, type Movimento,
} from "../src/lib/roadmap/roadmap.ts";
import { lerRoadmap } from "../src/lib/sugestoes/sugestoes.ts";
import { SETORES, setoresDe } from "../src/lib/painel/setores.ts";
import { operacaoLiberada } from "../src/lib/conector/quem-usa.ts";

let falhas = 0;
function confere(nome: string, ok: boolean, detalhe = "") {
  if (ok) console.log(`  ok  ${nome}`);
  else {
    falhas++;
    console.log(`  FALHOU  ${nome}${detalhe ? `: ${detalhe}` : ""}`);
  }
}

const ERICK = "11111111-1111-4111-8111-111111111111";
const FILIPE = "22222222-2222-4222-8222-222222222222";

const cartao = (extra: Record<string, unknown>) => ({
  id: 1, titulo: "Cartão", tipo: "melhoria", prioridade: "media", coluna: "a_fazer", caminhos: [], conflitos: [],
  criado_em: "2026-11-18T12:00:00Z", mudou_em: "2026-11-18T12:00:00Z", ...extra,
});

const conflito = (id: number, titulo: string, responsavel: string, meu: string, dele: string) => ({
  id, titulo, coluna: "fazendo", responsavel, responsavel_id: responsavel === "Erick" ? ERICK : FILIPE, via_claude: true, sessao: null, ramo: null, pr_url: null,
  cruzam: [{ meu, dele }],
});

const cru = {
  ok: true,
  eu: FILIPE,
  cartoes: [
    cartao({
      id: 1, titulo: "Conversa privada no chat", coluna: "fazendo", responsavel: "Erick", responsavel_id: ERICK, via_claude: true, sessao: "Claude do Erick",
      ramo: "erick/1-conversa-privada", caminhos: ["src/lib/time/chat.ts", "/admin/chat"], conflitos: [conflito(2, "Threads", "Filipe", "src/lib/time/chat.ts", "src/lib/time")],
    }),
    cartao({
      id: 2, titulo: "Threads", tipo: "atualizacao", prioridade: "alta", coluna: "em_revisao", responsavel: "Filipe", responsavel_id: FILIPE,
      pr_url: "https://github.com/calangopro/jk-portal/pull/150", caminhos: ["src/lib/time"], conflitos: [conflito(1, "Conversa privada no chat", "Erick", "src/lib/time", "src/lib/time/chat.ts")],
    }),
    cartao({ id: 3, titulo: "Cabeçalho de segurança", tipo: "seguranca", prioridade: "urgente", coluna: "a_fazer", conflitos: [conflito(1, "Conversa privada no chat", "Erick", "src/lib/time", "src/lib/time/chat.ts")] }),
    cartao({ id: 4, titulo: "Notinha do pedido", coluna: "fazendo", responsavel: "Filipe", responsavel_id: FILIPE, conflitos: [conflito(99, "Fora do quadro", "Erick", "x", "x")] }),
    cartao({ id: 5, titulo: "Estoque pela API", coluna: "no_ar", concluido_em: "2026-11-17T12:00:00Z" }),
    { id: 6, titulo: "", coluna: "a_fazer", criado_em: "2026-11-18T12:00:00Z" },
    cartao({ id: 7, titulo: "Coluna inventada", coluna: "arquivado" }),
  ],
  pessoas: [{ id: ERICK, nome: "Erick" }, { id: FILIPE, nome: "Filipe" }, { id: null, nome: "Sem id" }],
  sugestoes: [{ id: 9, criada_em: "2026-11-18T10:00:00Z", autor: "Thiago Lourenço", tela: "/admin/vendas", tela_nome: "Pedidos da loja", texto: "Foto na lista", prints: 2 }],
};

console.log("\nLeitura do quadro");
{
  const q = lerQuadro(cru)!;
  confere("lê os cartões válidos e descarta os sem título ou com coluna desconhecida", q.cartoes.map((c) => c.id).join() === "1,2,3,4,5");
  confere("o dono, o Claude e a sessão chegam", q.cartoes[0].responsavel === "Erick" && q.cartoes[0].viaClaude && q.cartoes[0].sessao === "Claude do Erick");
  confere("o cruzamento chega com os caminhos dos dois lados", q.cartoes[0].conflitos[0].id === 2 && q.cartoes[0].conflitos[0].cruzam[0].dele === "src/lib/time");
  confere("pessoa sem id é descartada", q.pessoas.length === 2);
  confere("a sugestão nova chega com autor e prints", q.sugestoes[0].autor === "Thiago Lourenço" && q.sugestoes[0].prints === 2);
  confere("recusa do banco vira nulo", lerQuadro({ ok: false, motivo: "sem_acesso" }) === null && lerQuadro(null) === null && lerQuadro({ ok: true }) === null);
  confere("tipo e prioridade desconhecidos caem no padrão", lerQuadro({ ...cru, cartoes: [cartao({ tipo: "bug", prioridade: "maxima" })] })!.cartoes[0].tipo === "melhoria");
}

console.log("\nFiltros e colunas");
{
  const q = lerQuadro(cru)!;
  confere("filtro por pessoa", filtrarCartoes(q.cartoes, ERICK, "todos").map((c) => c.id).join() === "1");
  confere("sem dono", filtrarCartoes(q.cartoes, "sem_dono", "todos").map((c) => c.id).join() === "3,5");
  confere("por tipo, junto com pessoa", filtrarCartoes(q.cartoes, FILIPE, "atualizacao").map((c) => c.id).join() === "2" && filtrarCartoes(q.cartoes, "todos", "seguranca").length === 1);
  const cols = porColuna(q.cartoes);
  confere("separa por coluna, toda coluna existe", COLUNAS.every((c) => Array.isArray(cols[c])) && cols.fazendo.map((c) => c.id).join() === "1,4" && cols.descartado.length === 0);
}

console.log("\nAviso de cruzamento");
{
  const q = lerQuadro(cru)!;
  const pares = paresQueCruzam(q.cartoes);
  confere("A com B e B com A viram um aviso só", pares.length === 1 && pares[0].a.id === 1 && pares[0].b.id === 2);
  confere("cartão em A fazer não entra no aviso do topo, nem cruzamento com cartão fora do quadro", !pares.some((p) => p.a.id === 3 || p.b.id === 3 || p.a.id === 4));
  const fazendo = quemEstaFazendo(q.cartoes);
  confere("quem está fazendo o quê", fazendo.length === 2 && fazendo.find((f) => f.id === FILIPE)?.fazendo === 1 && fazendo.find((f) => f.id === FILIPE)?.emRevisao === 1 && fazendo.find((f) => f.id === ERICK)?.peloClaude === 1);
}

console.log("\nCaminhos e ramo");
{
  confere("caminhos um por linha ou por vírgula, sem espaço nem repetido", lerCaminhos(" src/lib/redes \n\n/admin/vendas, src/lib/redes\n").join("|") === "src/lib/redes|/admin/vendas");
  confere("até 30 caminhos", lerCaminhos(Array.from({ length: 40 }, (_, i) => `p${i}`).join("\n")).length === 30);
  const r1 = ramoSugerido("Erick", 12, "Conversa privada no chat");
  confere("ramo: pessoa, número e título curto", r1 === "erick/12-conversa-privada-chat", r1);
  const r2 = ramoSugerido("Filipe Lourenço", 3, "Notinha do pedido: impressão da área de produção e entrega");
  confere("ramo: sem acento, sem palavra que sobra, no máximo cinco palavras", r2 === "filipe/3-notinha-pedido-impressao-area-producao", r2);
  confere("ramo sem pessoa vai como time", ramoSugerido(null, 8, "Threads").startsWith("time/8-threads"));
  confere("o ramo sugerido passa na trava do banco", [r1, r2, ramoSugerido("Ângela", 1, "!!!")].every(ramoValido) && !ramoValido("feat/com espaço") && !ramoValido(""));
  confere("pedido de revisão: só do GitHub", prValido("https://github.com/calangopro/jk-portal/pull/150") && !prValido("https://gitlab.com/x/y/pull/1") && !prValido("https://github.com/x/y/issues/2"));
  confere("o número do pedido de revisão", numeroDoPr("https://github.com/calangopro/jk-portal/pull/150") === "150" && numeroDoPr(null) === null);
}

console.log("\nHistórico");
{
  const m = (acao: string, extra: Partial<Movimento> = {}): Movimento => ({ em: "2026-11-18T12:00:00Z", por: "Filipe", peloConector: false, acao, de: null, para: null, nota: null, detalhe: {}, ...extra });
  confere("criou e moveu dizem a coluna", movimentoEmPalavras(m("criou", { para: "a_fazer" })) === "Criou em A fazer" && movimentoEmPalavras(m("moveu", { para: "no_ar" })) === "Moveu para No ar");
  confere("pegou para outra pessoa e tomou de alguém", movimentoEmPalavras(m("pegou", { detalhe: { responsavel: "Erick", tomou_de: "Filipe" } })) === "Passou para Erick (estava com Filipe)");
  confere("pegou para si", movimentoEmPalavras(m("pegou", { detalhe: { responsavel: "Filipe" } })) === "Pegou o cartão");
  confere("editou diz os campos", movimentoEmPalavras(m("editou", { detalhe: { campos: ["caminhos", "prioridade"] } })) === "Editou os caminhos, a prioridade");
  const inteiro = lerCartaoInteiro({ ok: true, cartao: cru.cartoes[0], historico: [{ em: "2026-11-18T12:00:00Z", por: "Erick", pelo_conector: true, acao: "pegou", de: "a_fazer", para: "fazendo", detalhe: {} }], sugestao: null });
  confere("o cartão inteiro chega com o histórico pelo conector", inteiro?.historico[0].peloConector === true && inteiro.historico[0].para === "fazendo" && inteiro.sugestao === null);
}

console.log("\nSugestões ligadas ao cartão");
{
  const r = lerRoadmap({ diretoria: true, itens: [{ id: 1, criada_em: "2026-11-18T10:00:00Z", texto: "Foto na lista", estado: "planejada", cartao: { id: 4, coluna: "a_fazer" } }, { id: 2, criada_em: "2026-11-18T10:00:00Z", texto: "Outra", estado: "nova" }] })!;
  confere("a sugestão diz em qual cartão está", r.itens[0].cartao?.id === 4 && r.itens[0].cartao.coluna === "a_fazer" && r.itens[1].cartao === null);
}

console.log("\nTextos");
{
  const textos = [
    ...Object.values(NOME_DA_COLUNA), ...Object.values(FRASE_DA_COLUNA), ...Object.values(NOME_DO_TIPO), ...Object.values(NOME_DA_PRIORIDADE),
    ...Object.values(MENSAGEM_DO_MOTIVO), ...REGRA_DO_TRABALHO,
  ];
  confere("nenhum texto do Roadmap com travessão", textos.every((t) => !/[—–]/.test(t)));
  confere("recusa desconhecida vira a frase de tentar de novo", mensagemDoMotivo("inventado") === "Não deu para salvar agora. Tente de novo." && mensagemDoMotivo("sem_acesso").includes("diretoria"));
  const telas = ["src/app/admin/(painel)/roadmap/Quadro.tsx", "src/app/admin/(painel)/roadmap/Gaveta.tsx", "src/app/admin/(painel)/roadmap/NovoCartao.tsx", "src/app/admin/(painel)/roadmap/pecas.tsx"];
  confere("nenhuma tela do Roadmap com travessão", telas.every((t) => !/[—–]/.test(readFileSync(t, "utf8"))));
}

console.log("\nMenu e conector");
{
  const sistema = SETORES.find((s) => s.id === "sistema");
  const item = sistema?.itens.find((i) => i.href === "/admin/roadmap");
  confere("o Roadmap está em Sistema, com a área roadmap", item?.area === "roadmap");
  confere("quem só tem a área equipe não vê o Roadmap", !setoresDe(["equipe"]).some((s) => s.itens.some((i) => i.href === "/admin/roadmap")));
  confere("quem tem a área roadmap vê, mesmo sem equipe", setoresDe(["roadmap"]).find((s) => s.id === "sistema")?.itens.map((i) => i.href).join() === "/admin/roadmap");
  confere("a página confere a área roadmap", readFileSync("src/app/admin/(painel)/roadmap/page.tsx", "utf8").includes('requireArea("roadmap")'));
  confere("toda ação da tela confere a área", (readFileSync("src/app/admin/(painel)/roadmap/actions.ts", "utf8").match(/requireArea\("roadmap"\)/g) ?? []).length === 1 && readFileSync("src/app/admin/(painel)/roadmap/actions.ts", "utf8").includes("await chamar("));

  confere("o Social media não usa o Roadmap pelo conector", !operacaoLiberada("social", "roadmap.quadro") && !operacaoLiberada("vendas", "roadmap.quadro") && operacaoLiberada("gm", "roadmap.pegar"));
  const indice = readFileSync("src/lib/conector/operacoes/index.ts", "utf8");
  confere("a área roadmap está no catálogo do conector", indice.includes('{ nome: "roadmap",') && indice.includes("...OPERACOES_ROADMAP"));
  const ops = readFileSync("src/lib/conector/operacoes/roadmap.ts", "utf8");
  const nomes = [...ops.matchAll(/nome: "(roadmap\.[a-z_]+)"/g)].map((m) => m[1]);
  confere(
    "as operações do conector: listar, ver, conferir, criar em lote, pegar, mover, ligar o pedido, concluir, editar e levar a sugestão",
    nomes.join() === "roadmap.quadro,roadmap.ver,roadmap.conflitos,roadmap.criar,roadmap.pegar,roadmap.mover,roadmap.ligar_pr,roadmap.concluir,roadmap.editar,roadmap.levar_sugestao",
    nomes.join(),
  );
  const riscos = [...ops.matchAll(/risco: "([a-z]+)"/g)].map((m) => m[1]);
  confere("três de leitura e sete de escrita, nenhuma perigosa", riscos.filter((r) => r === "leitura").length === 3 && riscos.filter((r) => r === "escrita").length === 7 && !riscos.includes("perigosa"));
  confere("toda operação passa pelo banco em nome de quem ligou o conector", ops.includes("p_quem: ctx.quem.id") && (ops.match(/await chamar\(ctx,/g) ?? []).length === nomes.length);
}

console.log("\nO banco");
{
  const sql = readFileSync("supabase/migrations/0141_roadmap.sql", "utf8");
  confere("as tabelas têm RLS ligada e nenhum acesso direto", sql.includes("alter table public.roadmap_cartoes enable row level security") && sql.includes("revoke all on public.roadmap_cartoes from anon, authenticated") && !/create policy/i.test(sql));
  confere("as peças de dentro não abrem para fora", ["roadmap_quem(uuid)", "roadmap_pode(uuid)", "roadmap_conflitos_de(text[], bigint)"].every((f) => sql.includes(`revoke execute on function public.${f} from public, anon, authenticated`)));
  confere("p_quem só vale para a chave de serviço", /when \(select auth\.uid\(\)\) is not null then \(select auth\.uid\(\)\)\s+when coalesce\(\(select auth\.role\(\)\) = 'service_role', false\) then p_quem/.test(sql));
  confere("o cruzamento compara por começo de caminho, sem LIKE (o sublinhado do nome de arquivo não vira curinga)", sql.includes("starts_with(a, b || '/')") && !/roadmap_cruzam[\s\S]{0,400}\blike\b/i.test(sql));
  confere("toda conferência de área vai dentro de coalesce", !/if not public\.roadmap_pode/.test(sql) && (sql.match(/coalesce\(public\.roadmap_pode\(v_eu\), false\)/g) ?? []).length >= 9);
}

if (falhas > 0) {
  console.error(`\n${falhas} ${falhas === 1 ? "conferência falhou" : "conferências falharam"}.`);
  process.exit(1);
}
console.log("\nTudo certo.");
