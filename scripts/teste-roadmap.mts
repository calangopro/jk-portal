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
import { generateKeyPairSync, sign } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  COLUNAS, FRASE_DA_COLUNA, MENSAGEM_DO_MOTIVO, NOME_DA_COLUNA, NOME_DA_PRIORIDADE, NOME_DO_TIPO, REGRA_DO_TRABALHO,
  filtrarCartoes, lerCaminhos, lerCartaoInteiro, lerQuadro, mensagemDoMotivo, movimentoEmPalavras, numeroDoPr, paresQueCruzam, porColuna,
  prValido, quemEstaFazendo, ramoSugerido, ramoValido, type Movimento,
} from "../src/lib/roadmap/roadmap.ts";
import { lerRoadmap } from "../src/lib/sugestoes/sugestoes.ts";
import { SETORES, setoresDe } from "../src/lib/painel/setores.ts";
import { operacaoLiberada } from "../src/lib/conector/quem-usa.ts";
import { conferirClaims, verificarToken, PUBLICO_DO_ROADMAP, REPOSITORIO, WORKFLOW_DO_ROADMAP, type ClaimsDoGitHub } from "../src/lib/roadmap/oidc.ts";
import { MARCA_DO_COMENTARIO, NOME_DA_COLUNA_NO_COMENTARIO, comentarioDoPr, eventoDoGitHub, lerEventoDoGitHub, type RespostaDoGitHub } from "../src/lib/roadmap/github.ts";
import { cruzamentosDeVerdade, haQuanto } from "../src/lib/roadmap/roadmap.ts";

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

console.log("\nGitHub: o token que o próprio GitHub assina");
{
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = { ...(publicKey.export({ format: "jwk" }) as object), kid: "chave-1", alg: "RS256", use: "sig" };
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const agora = 1_800_000_000;
  const claims: ClaimsDoGitHub = {
    iss: "https://token.actions.githubusercontent.com", aud: PUBLICO_DO_ROADMAP, exp: agora + 300, nbf: agora - 5, repository: REPOSITORIO, repository_owner: "calangopro",
    event_name: "pull_request", ref: "refs/pull/150/merge", head_ref: "erick/12-notinha", actor: "ErickOlih", sha: "abcdef1234567", workflow_ref: `${WORKFLOW_DO_ROADMAP}refs/pull/150/merge`,
  };
  const assinar = (c: unknown, kid = "chave-1") => {
    const corpo = `${b64({ alg: "RS256", typ: "JWT", kid })}.${b64(c)}`;
    return `${corpo}.${sign("RSA-SHA256", Buffer.from(corpo), privateKey).toString("base64url")}`;
  };
  const token = assinar(claims);
  confere("token assinado pela chave do GitHub é aceito", verificarToken(token, [jwk])?.head_ref === "erick/12-notinha");
  const [c0, , a0] = token.split(".");
  confere("token mexido (outro repositório no meio) é recusado", verificarToken(`${c0}.${b64({ ...claims, repository: "outro/repo" })}.${a0}`, [jwk]) === null);
  confere("chave de outro kid, ou nenhuma chave, recusa", verificarToken(assinar(claims, "chave-2"), [jwk]) === null && verificarToken(token, []) === null && verificarToken("lixo", [jwk]) === null);
  confere("as informações certas passam", conferirClaims(claims, agora).ok);
  const motivo = (extra: Partial<ClaimsDoGitHub>) => { const r = conferirClaims({ ...claims, ...extra }, agora); return r.ok ? "ok" : r.motivo; };
  confere(
    "outro repositório, outro workflow, outro público, vencido e evento que não é ramo nem pedido: recusados",
    motivo({ repository: "fork/jk-portal" }) === "repositorio" && motivo({ workflow_ref: `${REPOSITORIO}/.github/workflows/outro.yml@refs/heads/x` }) === "workflow"
      && motivo({ aud: "sts.amazonaws.com" }) === "publico" && motivo({ exp: agora - 120 }) === "vencido" && motivo({ event_name: "issues" }) === "evento" && motivo({ iss: "https://outro" }) === "emissor",
  );
}

console.log("\nGitHub: o evento e o comentário");
{
  const doPr: ClaimsDoGitHub = { event_name: "pull_request", ref: "refs/pull/150/merge", head_ref: "erick/12-notinha", actor: "ErickOlih", repository: REPOSITORIO, sha: "abcdef1234567" };
  const e = eventoDoGitHub(doPr, { acao: "opened", titulo: "Notinha", arquivos: ["a.ts", "a.ts", " b.ts ", 3], atras_do_main: 2, rascunho: false, ramo: "mentira/9-outro" })!;
  confere("pedido: ramo, login e número saem do token, não do corpo", e.ramo === "erick/12-notinha" && e.login === "ErickOlih" && e.pr_numero === 150 && e.evento === "pull_request");
  confere("arquivos sem repetição e sem espaço; commits atrás do main", e.arquivos?.join() === "a.ts,b.ts" && e.atras_do_main === 2);
  const envio = eventoDoGitHub({ event_name: "push", ref: "refs/heads/filipe/3-x", actor: "agenciasetup", repository: REPOSITORIO }, { atras_do_main: -1 })!;
  confere("envio de ramo: o ramo vem do ref, sem pedido; atraso inválido vira nulo", envio.ramo === "filipe/3-x" && envio.pr_numero === null && envio.atras_do_main === null && envio.arquivos === undefined);
  const semRefNoToken = eventoDoGitHub({ ...doPr, ref: "refs/heads/claude/x", head_ref: undefined }, { pr_numero: 145, ramo: "claude/roadmap-kanban-83cd0e" });
  confere("sem o número e o ramo no token, valem os do corpo que o mesmo workflow mandou", semRefNoToken?.pr_numero === 145 && semRefNoToken.ramo === "claude/roadmap-kanban-83cd0e");
  confere("com os dois, vale o do token", eventoDoGitHub(doPr, { pr_numero: 999, ramo: "outro/ramo" })?.pr_numero === 150 && eventoDoGitHub(doPr, { ramo: "outro/ramo" })?.ramo === "erick/12-notinha");
  confere("o motivo de não acompanhar vem por escrito", (() => { const r = lerEventoDoGitHub({ ...doPr, ref: "x", head_ref: undefined }, {}); return !r.ok && r.motivo === "pedido_sem_numero"; })());
  confere("tag e pedido sem número não são acompanhados", eventoDoGitHub({ event_name: "push", ref: "refs/tags/v1", repository: REPOSITORIO }, {}) === null && eventoDoGitHub({ ...doPr, ref: "refs/heads/x" }, {}) === null && eventoDoGitHub({ ...doPr, ref: "refs/heads/x" }, { pr_numero: "abc" }) === null);

  const quadro = "https://www.jkaliancas.com.br/guias/admin/roadmap";
  const semCartao = comentarioDoPr({ ok: true, fora_do_quadro: true, cartao: null, conflitos: [] }, e, quadro);
  confere("pedido aberto sem cartão: falha, e o comentário diz como ligar", semCartao.falhar && semCartao.markdown!.startsWith(MARCA_DO_COMENTARIO) && semCartao.markdown!.includes("roadmap.pegar") && semCartao.markdown!.includes("Cartão N"));
  const comCartao: RespostaDoGitHub = {
    ok: true, moveu: true, de: "fazendo",
    cartao: { id: 12, titulo: "Notinha do pedido", coluna: "em_revisao", responsavel: "Erick", atras_do_main: 2, aviso_main: null },
    conflitos: [
      { id: 15, titulo: "Conversa privada", coluna: "fazendo", responsavel: "Filipe", so_comum: false, cruzam: [{ meu: "src/lib/fabrica/x.ts", dele: "src/lib/fabrica", comum: false }, { meu: "CLAUDE.md", dele: "CLAUDE.md", comum: true }] },
      { id: 40, titulo: "Roadmap", coluna: "em_revisao", responsavel: "Filipe", so_comum: true, cruzam: [{ meu: "CLAUDE.md", dele: "CLAUDE.md", comum: true }] },
    ],
  };
  const ok = comentarioDoPr(comCartao, e, quadro);
  confere("com cartão: não falha, diz o cartão, o movimento e o link", !ok.falhar && ok.markdown!.includes("**Cartão 12: Notinha do pedido** (Em revisão, com Erick)") && ok.markdown!.includes("de Fazendo para Em revisão") && ok.markdown!.includes(`${quadro}?cartao=12`));
  confere("cruzamento de verdade em destaque, sem o arquivo de todos na linha dele", ok.markdown!.includes("Cartão 15, Conversa privada") && ok.markdown!.includes("`src/lib/fabrica/x.ts` com `src/lib/fabrica`") && !/Cartão 15[^\n]*CLAUDE\.md/.test(ok.markdown!));
  confere("arquivo de todos vai numa linha leve, e o atraso do main aparece", ok.markdown!.includes("Só arquivo de todos em comum com o cartão 40") && ok.markdown!.includes("**2 commits atrás do main**"));
  const fechado = comentarioDoPr(comCartao, { ...e, acao: "closed" }, quadro);
  confere("pedido fechado e envio de ramo não comentam nem falham", fechado.markdown === null && !fechado.falhar && comentarioDoPr({ ok: true, fora_do_quadro: true, cartao: null }, envio, quadro).falhar === false);
  confere("recusa do painel não falha a checagem", !comentarioDoPr({ ok: false, motivo: "formato" }, e, quadro).falhar);
  confere("o nome das colunas no comentário é o mesmo do quadro", JSON.stringify(NOME_DA_COLUNA_NO_COMENTARIO) === JSON.stringify(NOME_DA_COLUNA));
  confere("nenhum texto do comentário com travessão", ![semCartao.markdown, ok.markdown].some((t) => /[—–]/.test(t ?? "")));
}

console.log("\nGitHub: o quadro");
{
  const q = lerQuadro({
    ...cru,
    cartoes: [cartao({ id: 1, coluna: "fazendo", responsavel: "Erick", responsavel_id: ERICK, pr_numero: 150, pr_estado: "aberto", arquivos: ["src/a.ts"], atras_do_main: 3, aviso_main: "Traga o main", github_em: "2026-11-18T12:00:00Z",
      conflitos: [{ ...conflito(2, "Threads", "Filipe", "CLAUDE.md", "CLAUDE.md"), so_comum: true, cruzam: [{ meu: "CLAUDE.md", dele: "CLAUDE.md", comum: true }] }] })],
    ramos: [{ ramo: "filipe/solto", pessoa: "Filipe", github_login: "agenciasetup", arquivos: 4, visto_em: "2026-11-18T12:00:00Z", cruza_com: ["1"] }, { ramo: "" }],
    github_em: "2026-11-18T12:00:00Z",
  })!;
  const c = q.cartoes[0];
  confere("o cartão traz o estado do pedido, os arquivos, o atraso e o aviso", c.prEstado === "aberto" && c.arquivos.length === 1 && c.atrasDoMain === 3 && c.avisoMain === "Traga o main");
  confere("cruzamento só de arquivo de todos não conta como de verdade", c.conflitos[0].soComum && c.conflitos[0].cruzam[0].comum && cruzamentosDeVerdade(c).length === 0);
  confere("o trabalho fora do quadro chega, e ramo sem nome é descartado", q.ramos.length === 1 && q.ramos[0].cruzaCom.join() === "1" && q.githubEm === "2026-11-18T12:00:00Z");
  const agora = Date.parse("2026-11-18T12:00:00Z");
  confere("há quanto tempo, em palavras", haQuanto("2026-11-18T11:55:00Z", agora) === "há 5 min" && haQuanto("2026-11-18T09:00:00Z", agora) === "há 3 h" && haQuanto("2026-11-16T12:00:00Z", agora) === "há 2 dias" && haQuanto(null) === null);
}

console.log("\nGitHub: workflows e a regra do main");
{
  const roadmap = readFileSync(".github/workflows/roadmap.yml", "utf8");
  const verificar = readFileSync(".github/workflows/verificar.yml", "utf8");
  const avisar = readFileSync(".github/roadmap/avisar.mjs", "utf8");
  const regra = JSON.parse(readFileSync("infra/github/ruleset-main.json", "utf8"));
  const pacote = JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> };
  confere("o workflow do Roadmap pede o token OIDC, e não usa segredo", roadmap.includes("id-token: write") && !roadmap.includes("secrets."));
  confere("o público pedido no workflow é o que o painel confere", avisar.includes(`audience=${PUBLICO_DO_ROADMAP}`));
  confere("ações de terceiros fixadas pelo commit, não pela etiqueta", ![roadmap, verificar].some((w) => /uses: [^\n]+@v\d/.test(w)) && [roadmap, verificar].every((w) => /uses: actions\/checkout@[0-9a-f]{40}/.test(w)));
  confere("a checagem do pedido se chama roadmap, e a do envio de ramo tem outro nome", roadmap.includes("'roadmap' || 'roadmap (ramo)'"));
  const exigidas = regra.rules.find((r: { type: string }) => r.type === "required_status_checks").parameters;
  confere("a regra do main exige verificar, roadmap e Vercel, com o ramo em dia", exigidas.strict_required_status_checks_policy === true && exigidas.required_status_checks.map((c: { context: string }) => c.context).join() === "verificar,roadmap,Vercel");
  confere("a regra do main bloqueia envio direto, histórico reescrito e apagar o main", ["pull_request", "non_fast_forward", "deletion"].every((t) => regra.rules.some((r: { type: string }) => r.type === t)) && regra.bypass_actors.length === 0);
  const doBuild = [...pacote.scripts["build:seguro"].matchAll(/verificar:([a-z]+)/g)].map((m) => m[1]).filter((n) => n !== "tokens");
  const doTudo = [...pacote.scripts["verificar:tudo"].matchAll(/verificar:([a-z]+)/g)].map((m) => m[1]);
  confere("a verificação do GitHub roda todos os testes do build (menos o de tokens, que pede o build)", doBuild.join() === doTudo.join() && verificar.includes("npm run verificar:tudo") && verificar.includes("tsc --noEmit"), `${doBuild} / ${doTudo}`);
  confere("nenhum texto dos workflows com travessão", ![roadmap, verificar, avisar].some((t) => /[—–]/.test(t)));
  const sql = readFileSync("supabase/migrations/0143_roadmap_github.sql", "utf8");
  confere("o evento do GitHub só a chave de serviço chama", sql.includes("revoke execute on function public.roadmap_github(jsonb) from public, anon, authenticated") && sql.includes("if not coalesce((select auth.role()) = 'service_role', false)"));
}

if (falhas > 0) {
  console.error(`\n${falhas} ${falhas === 1 ? "conferência falhou" : "conferências falharam"}.`);
  process.exit(1);
}
console.log("\nTudo certo.");
