/**
 * Traz da API da Tray os pedidos antigos que a rotina não alcança.
 *
 *   npm run vendas:historico -- --simular            só conta, não grava
 *   npm run vendas:historico                         grava
 *   npm run vendas:historico -- --desde=2026-05-01   de que dia em diante (o padrão)
 *   npm run vendas:historico -- --maximo=50          para depois de tantos pedidos pedidos à loja
 *
 * POR QUE EXISTE. A rotina (`/api/cron/pedidos-da-tray`) anda pelo que foi
 * ALTERADO, a partir da lista de pedidos. Duas coisas ficam fora do alcance
 * dela (medido em 16/11/2026, `docs/tray-api-de-pedidos.md`):
 *   1. a lista não mostra pedido fechado há mais de uns três meses, então o
 *      pedido antigo que o painel tem sem os itens nunca volta por ela;
 *   2. as exportações nunca cobriram maio a outubro por inteiro, e o painel
 *      não tinha 602 pedidos que a loja tem.
 * O número do pedido é sequencial (só ímpares), e a loja responde qualquer
 * pedido pedido pelo número. Então este script percorre os números, do
 * primeiro pedido do dia `--desde` até o maior que o painel conhece.
 *
 * O QUE ELE PEDE À LOJA: o número que o painel não tem, e o que tem mas nunca
 * foi lido pela API (sem a sessão da Tray, que só a API traz). Pedido já lido
 * pela API fica de fora.
 *
 * COMO GRAVA: pelo MESMO conversor da rotina (`pedidoDaApi`) e pela MESMA
 * função do banco (`importar_pedidos_tray`), que nunca troca por vazio a
 * origem que a exportação leu. É a única loja que ele aceita: a da JK.
 *
 * Roda quantas vezes quiser: na segunda vez não sobra quase nada para pedir.
 * Anda devagar de propósito (perto de 100 chamadas por minuto), porque o
 * limite da Tray é de 180 por minuto e a rotina divide esse limite.
 *
 * Lê `.env.local` da pasta do projeto e grava com a chave de serviço. Não
 * imprime token nem dado de cliente: só contagens.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { pedidoDaApi } from "../src/lib/vendas/tray-api.ts";
import { situacaoDoStatus } from "../src/lib/vendas/tray-csv.ts";

const LOJA = "1305187";
const PROVEDOR = "tray_loja";
const DOMINIOS_DA_TRAY = [".commercesuite.com.br", ".corpsuite.com.br"];
const PAUSA_MS = 400;
const LOTE = 100;
/** Quantos números seguidos sem pedido (ou de antes do dia de corte) encerram a descida. */
const VAZIOS_PARA_PARAR = 8;

type Cru = Record<string, unknown>;
type Convertido = NonNullable<ReturnType<typeof pedidoDaApi>>;

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

function lerEnv(): Record<string, string> {
  const caminho = resolve(process.cwd(), ".env.local");
  if (!existsSync(caminho)) return {};
  const env: Record<string, string> = {};
  for (const linha of readFileSync(caminho, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(linha);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

const opcao = (nome: string) => process.argv.find((a) => a.startsWith(`--${nome}=`))?.split("=")[1];
const simular = process.argv.includes("--simular");
const desde = opcao("desde") ?? "2026-05-01";
const maximo = Number(opcao("maximo")) || Infinity;
if (!/^\d{4}-\d{2}-\d{2}$/.test(desde)) {
  console.error("O dia de corte precisa ser AAAA-MM-DD.");
  process.exit(1);
}

const env = { ...lerEnv(), ...process.env } as Record<string, string | undefined>;
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const chave = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !chave) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.");
  process.exit(1);
}
const db = createClient(url, chave, { auth: { persistSession: false } });

/** O endereço da API e o token da loja da JK, lidos do banco. A rotina renova o token; aqui só se relê. */
async function credencial(): Promise<{ api: string; token: string }> {
  const { data, error } = await db.from("integration_tokens").select("access_token, meta").eq("provider", PROVEDOR).maybeSingle();
  if (error) throw new Error(error.message);
  const meta = (data?.meta ?? {}) as { api_address?: string; store?: string };
  const api = (meta.api_address ?? "").replace(/\/+$/, "");
  let host = "";
  try {
    host = new URL(api).host.toLowerCase();
  } catch {
    /* cai na recusa abaixo */
  }
  if (meta.store !== LOJA || !DOMINIOS_DA_TRAY.some((d) => host.endsWith(d)) || !data?.access_token) {
    throw new Error("A loja da JK não está autorizada, ou a autorização gravada não é a dela.");
  }
  return { api, token: data.access_token as string };
}

let cred = await credencial();
let chamadas = 0;
const respostas = new Map<number, number>();

/** O pedido completo, `null` quando a loja diz que o número não existe, `"erro"` quando não deu para saber. */
async function pedir(id: number): Promise<Cru | null | "erro"> {
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    await esperar(PAUSA_MS);
    chamadas++;
    let r: Response;
    try {
      r = await fetch(`${cred.api}/orders/${id}/complete?access_token=${cred.token}`);
    } catch {
      await esperar(5_000);
      continue;
    }
    respostas.set(r.status, (respostas.get(r.status) ?? 0) + 1);
    if (r.status === 200) {
      const j = (await r.json().catch(() => null)) as { Order?: Cru } | null;
      return j ? (j.Order ?? (j as Cru)) : "erro";
    }
    if (r.status === 404) return null;
    if (r.status === 401) {
      // O token venceu ou a rotina renovou: relê do banco. Se ainda for o mesmo, a próxima rodada da rotina renova.
      if (tentativa > 0) await esperar(60_000);
      cred = await credencial();
      continue;
    }
    // 429 é o limite por minuto; o resto costuma ser soluço da loja.
    await esperar(r.status === 429 ? 45_000 : 5_000);
  }
  return "erro";
}

// O que o painel já tem, e quais já foram lidos pela API.
const noBanco = new Map<number, boolean>();
for (let de = 0; ; de += 1000) {
  const { data, error } = await db.from("tray_pedidos").select("pedido, sessao").order("pedido").range(de, de + 999);
  if (error) throw new Error(error.message);
  for (const l of data ?? []) noBanco.set(Number(l.pedido), l.sessao != null);
  if ((data ?? []).length < 1000) break;
}
if (noBanco.size === 0) {
  console.error("O painel não tem pedido nenhum. Este script completa o que existe; a primeira leitura é da rotina.");
  process.exit(1);
}
const menor = Math.min(...noBanco.keys());
const maior = Math.max(...noBanco.keys());
console.log(`${simular ? "SIMULAÇÃO, nada é gravado. " : ""}O painel tem ${noBanco.size} pedidos, do ${menor} ao ${maior}. Dia de corte: ${desde}.`);

const porMes = new Map<string, { novos: number; completados: number }>();
const contar = (dia: string, campo: "novos" | "completados") => {
  const m = porMes.get(dia.slice(0, 7)) ?? { novos: 0, completados: 0 };
  m[campo]++;
  porMes.set(dia.slice(0, 7), m);
};

const totais = { pedidos: 0, novos: 0, completados: 0, naoExistem: 0, semFormato: 0, antesDoCorte: 0, erros: [] as number[], gravados: 0, mudaramDeStatus: 0 };
let lote: Convertido[] = [];

async function gravar() {
  if (lote.length === 0 || simular) {
    lote = [];
    return;
  }
  const { data, error } = await db.rpc("importar_pedidos_tray", { p_pedidos: lote });
  if (error) throw new Error(`A gravação falhou: ${error.message}`);
  const r = data as { lidos: number; novos: number; mudaram: number };
  totais.gravados += r.lidos;
  totais.mudaramDeStatus += r.mudaram;
  lote = [];
}

/** Devolve o dia do pedido quando ele foi aceito, `null` quando ficou de fora. */
async function tratar(id: number): Promise<string | null> {
  const cru = await pedir(id);
  totais.pedidos++;
  if (cru === "erro") {
    totais.erros.push(id);
    return null;
  }
  if (cru === null) {
    totais.naoExistem++;
    return null;
  }
  const p = pedidoDaApi(cru, situacaoDoStatus);
  if (!p) {
    totais.semFormato++;
    return null;
  }
  if (p.dia < desde) {
    totais.antesDoCorte++;
    return null;
  }
  const novo = !noBanco.has(id);
  totais[novo ? "novos" : "completados"]++;
  contar(p.dia, novo ? "novos" : "completados");
  lote.push(p);
  if (lote.length >= LOTE) await gravar();
  return p.dia;
}

const inicio = Date.now();
const cabe = () => totais.pedidos < maximo;

// 1. Do menor número do painel até o maior: o que falta e o que nunca foi lido pela API.
for (let id = menor; id <= maior && cabe(); id += 2) {
  if (noBanco.get(id) === true) continue;
  await tratar(id);
  if (totais.pedidos % 200 === 0) console.log(`  ${totais.pedidos} pedidos pedidos à loja, no número ${id}: ${totais.novos} novos, ${totais.completados} completados, ${totais.naoExistem} que não existem`);
}

// 2. Para trás do menor número, até passar do dia de corte.
let vazios = 0;
for (let id = menor - 2; id > 0 && vazios < VAZIOS_PARA_PARAR && cabe(); id -= 2) {
  vazios = (await tratar(id)) ? 0 : vazios + 1;
}
await gravar();

const minutos = ((Date.now() - inicio) / 60_000).toFixed(1);
console.log(`\n${totais.pedidos} pedidos pedidos à loja em ${minutos} minutos (${chamadas} chamadas; respostas: ${[...respostas].map(([s, n]) => `${s} x${n}`).join(", ")}).`);
console.log(`Novos no painel: ${totais.novos}. Completados (já existiam, sem os itens ou sem a sessão): ${totais.completados}.`);
console.log(`Números sem pedido: ${totais.naoExistem}. De antes de ${desde}: ${totais.antesDoCorte}. Em formato que não deu para ler: ${totais.semFormato}.`);
if (!simular) console.log(`Gravados: ${totais.gravados}. Com status diferente do que o painel tinha: ${totais.mudaramDeStatus}.`);
console.log("\nPor mês do pedido:");
for (const [mes, m] of [...porMes].sort()) console.log(`  ${mes}: ${m.novos} novos, ${m.completados} completados`);
if (totais.erros.length) console.log(`\nNão deu para ler ${totais.erros.length} pedidos (rode de novo): ${totais.erros.slice(0, 30).join(", ")}${totais.erros.length > 30 ? "..." : ""}`);

if (!simular && totais.gravados > 0) {
  await db.from("sync_logs").insert({
    // Fonte própria: o cartão de Integrações olha a última linha de `tray_pedidos_api`, e a busca do histórico não é rodada da rotina.
    source: "tray_pedidos_historico",
    operation: "trazer_historico",
    status: totais.erros.length ? "error" : "success",
    attempted: totais.pedidos,
    succeeded: totais.gravados,
    failed: totais.erros.length,
    payload: { desde, novos: totais.novos, completados: totais.completados, nao_existem: totais.naoExistem, mudaram_de_status: totais.mudaramDeStatus },
    started_at: new Date(inicio).toISOString(),
    finished_at: new Date().toISOString(),
  });
}
process.exit(totais.erros.length ? 1 : 0);
