/**
 * Confere a conta pura dos avisos por push (cartão 59). Roda sem banco, sem
 * navegador e sem rede:
 *   node --experimental-strip-types scripts/teste-avisos.mts
 *
 * As entradas são INVENTADAS, só com a forma das de verdade.
 */
import {
  TETO_POR_MINUTO,
  aparelhoDoNavegador,
  aplicarTeto,
  avisoDaKommo,
  cargaDoPush,
  chaveDaKommo,
  chaveDoChat,
  chaveDoSuporte,
  destinoDoToque,
  estadoDoPush,
  inscricaoMorreu,
  lerCategorias,
  lerInscricao,
  lerNegocios,
  paraOAparelho,
  urlDoChat,
  type Aviso,
} from "../src/lib/avisos/push.ts";
import { avisosDoSistema, lerParaAvisar } from "../src/lib/time/chat.ts";
import { avisoDoSuporte } from "../src/lib/suporte/casos.ts";

let falhas = 0;
function confere(nome: string, ok: boolean, detalhe = "") {
  console.log(`${ok ? "ok  " : "ERRO"} ${nome}${!ok && detalhe ? ` (${detalhe})` : ""}`);
  if (!ok) falhas++;
}
const TRAVESSAO = /[–—]/;

console.log("Chaves");
confere("chat por mensagem", chaveDoChat(42) === "chat:42");
confere("suporte por caso e estado", chaveDoSuporte(7, "novo") !== chaveDoSuporte(7, "resolvido"));
const k1 = { id: 9, motivo: "sem_resposta" as const, desde: "2026-11-19T12:00:00Z", funil: "Vendas", etapa: "Atendimento" };
confere("Kommo: o mesmo negócio esperando de novo é outro evento", chaveDaKommo(k1) !== chaveDaKommo({ ...k1, desde: "2026-11-20T12:00:00Z" }));
confere("Kommo: motivo diferente é outro evento", chaveDaKommo(k1) !== chaveDaKommo({ ...k1, motivo: "esperando_vendedor" }));

console.log("\nKommo");
const lidos = lerNegocios([k1, { id: "x" }, { id: 3, motivo: "outro", desde: "2026-11-19T12:00:00Z" }, null, { id: 4, motivo: "esperando_vendedor", desde: "2026-11-19T10:00:00Z", funil: "", etapa: null }]);
confere("lê só negócio com id, motivo e data", lidos.length === 2 && lidos[1].funil === null);
const agora = Date.parse("2026-11-19T12:45:00Z");
const a1 = avisoDaKommo(k1, agora);
confere("sem resposta diz o tempo", a1.titulo === "Cliente sem resposta na Kommo" && a1.corpo.includes("45 min") && a1.corpo.includes("Vendas, Atendimento"));
const a2 = avisoDaKommo({ ...k1, motivo: "esperando_vendedor", desde: "2026-11-19T09:45:00Z", funil: null, etapa: null }, agora);
confere("esperando vendedor em horas, sem funil", a2.titulo === "Cliente esperando na Kommo" && a2.corpo === "Esperando vendedor há 3 horas.");
confere("o toque leva ao negócio na Kommo", a1.url.endsWith("/leads/detail/9"));
confere("aviso da Kommo não leva nome do negócio nem do cliente", !JSON.stringify(a1).includes("cliente\":"));

console.log("\nChat e suporte pela mesma régua de antes");
const chat = lerParaAvisar({
  agora: "2026-11-19T12:00:00Z",
  mensagens: [
    { id: 10, sala: "geral", autor_nome: "Ana", trecho: "Bom dia", imagens: 0, pede: false, para_mim: false, marcou: null, em: "x" },
    { id: 11, sala: "vendas", autor_nome: "Caio", trecho: "Alguém vê o pedido?", imagens: 0, pede: true, para_mim: false, marcou: "voce", em: "x" },
  ],
});
const doChat = avisosDoSistema(chat.mensagens);
confere("chat: título de quem marcou vem do mesmo texto do aviso do computador", doChat[1].titulo === "Caio marcou você em Vendas");
confere("chat: endereço do toque abre a sala e a mensagem", urlDoChat("vendas", 11) === "/admin/chat?sala=vendas&m=11");
const sup = avisoDoSuporte({ id: 5, tipo: "novo", assunto: "pedra", urgente: true, quem: "Thiago Souza" });
confere("suporte: sem dado de cliente, com o caso", sup.corpo.includes("Caso 5") && !/\d{8,}/.test(sup.corpo));

console.log("\nTeto por minuto");
const av = (n: number, categoria: Aviso["categoria"] = "chat"): Aviso => ({ categoria, marca: `m${n}`, titulo: `t${n}`, corpo: "c", url: "/admin/chat" });
const seis = [1, 2, 3, 4, 5, 6].map((n) => av(n));
confere("cabem todos, vão todos", aplicarTeto(seis.slice(0, 3), 0).length === 3);
const cortado = aplicarTeto(seis, 0);
confere(`passou do teto: ${TETO_POR_MINUTO} avisos, o último resume`, cortado.length === TETO_POR_MINUTO && cortado[TETO_POR_MINUTO - 1].marca === "jk-resumo");
confere("o resumo conta o que ficou de fora", cortado[TETO_POR_MINUTO - 1].titulo === `Mais ${6 - (TETO_POR_MINUTO - 1)} avisos no painel`);
confere("teto já gasto no minuto: nada sai", aplicarTeto(seis, TETO_POR_MINUTO).length === 0);
confere("uma vaga só: vira o resumo", aplicarTeto(seis, TETO_POR_MINUTO - 1).length === 1 && aplicarTeto(seis, TETO_POR_MINUTO - 1)[0].marca === "jk-resumo");
const misto = aplicarTeto([av(1), av(2), av(3), av(4, "kommo"), av(5, "suporte")], 0);
confere("resumo de duas categorias leva à tela Hoje", misto[misto.length - 1].url === "/admin/hoje");

console.log("\nO que cada aparelho recebe");
const tres = [av(1, "chat"), av(2, "suporte"), av(3, "kommo")];
confere("só o que escolheu", paraOAparelho(tres, ["chat", "kommo"]).map((a) => a.categoria).join() === "chat,kommo");
confere("nada escolhido, nada recebe", paraOAparelho(tres, []).length === 0);
confere("categorias desconhecidas caem fora", lerCategorias(["chat", "spam"]).join() === "chat");
confere("sem lista, todas", lerCategorias(null).length === 3);

console.log("\nCarga para o service worker");
const carga = cargaDoPush({ ...av(1), corpo: "x".repeat(500), url: "/admin/chat?sala=geral&m=1" }, "/guias");
confere("endereço do painel ganha o prefixo", carga.url === "/guias/admin/chat?sala=geral&m=1" && carga.icone === "/guias/painel-icone-192.png");
confere("endereço de fora fica como está", cargaDoPush(a1, "/guias").url.startsWith("https://"));
confere("corpo cortado para caber no push", carga.corpo.length === 240 && JSON.stringify(carga).length < 3000);

console.log("\nO toque no aviso");
const d1 = destinoDoToque("/admin/chat?sala=geral&m=12");
confere("chat abre na mensagem", d1.tipo === "chat" && d1.sala === "geral" && d1.mensagem === 12);
confere("suporte abre o suporte", destinoDoToque("/admin/suporte?caso=4").tipo === "suporte");
confere("Kommo abre fora", destinoDoToque("https://kathleengfz.kommo.com/leads/detail/1").tipo === "fora");
const d4 = destinoDoToque("/fora-do-painel");
confere("caminho fora do painel cai no início do painel", d4.tipo === "caminho" && d4.caminho === "/admin");

console.log("\nInscrição");
const boa = { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: { p256dh: "B".repeat(87), auth: "a".repeat(22) } };
confere("aceita a inscrição do navegador", lerInscricao(boa)?.auth === "a".repeat(22));
confere("recusa endereço sem https", lerInscricao({ ...boa, endpoint: "http://x" }) === null);
confere("recusa chave com caractere estranho", lerInscricao({ ...boa, keys: { ...boa.keys, auth: "<script>" } }) === null);
confere("recusa lixo", lerInscricao("x") === null && lerInscricao(null) === null);
confere("404 e 410 apagam, o resto não", inscricaoMorreu(404) && inscricaoMorreu(410) && !inscricaoMorreu(500) && !inscricaoMorreu(429));
confere("iPhone é celular", aparelhoDoNavegador("Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Version/17.4 Mobile Safari/604.1").navegador === "Safari no iPhone");
confere("Mac com Chrome é computador", aparelhoDoNavegador("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0 Safari/537.36").tipo === "computador");

console.log("\nA tela de ligar, pela capacidade");
const base = { temPush: true, temServiceWorker: true, safariDoIphone: false, instalado: false, permissao: "default" as const, inscrito: false };
confere("navegador com push: dá para ligar", estadoDoPush(base) === "desligado");
confere("iPhone no Safari, fora do app: ensina a instalar", estadoDoPush({ ...base, temPush: false, safariDoIphone: true, permissao: null }) === "instalar");
confere("iPhone instalado com push: dá para ligar", estadoDoPush({ ...base, safariDoIphone: true, instalado: true }) === "desligado");
confere("navegador sem push e sem ser iPhone: sem suporte", estadoDoPush({ ...base, temPush: false }) === "sem_suporte");
confere("negado: bloqueado", estadoDoPush({ ...base, permissao: "denied" }) === "bloqueado");
confere("inscrito e permitido: ligado", estadoDoPush({ ...base, permissao: "granted", inscrito: true }) === "ligado");
confere("inscrito sem a permissão: desligado", estadoDoPush({ ...base, permissao: "default", inscrito: true }) === "desligado");

console.log("\nTexto");
const textos = [a1, a2, ...cortado, ...doChat].flatMap((a) => [a.titulo, a.corpo]);
confere("nenhum travessão nos avisos", !textos.some((t) => TRAVESSAO.test(t)));

if (falhas > 0) {
  console.log(`\n${falhas} falha(s).`);
  process.exit(1);
}
console.log("\nTudo certo.");
