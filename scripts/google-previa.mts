/**
 * A lista do que o painel mandaria ao Google Ads, sem mandar nada.
 *
 *   npm run google:previa                         agora e no dia de ligar (01/12 às 10h)
 *   npm run google:previa -- --em=2026-12-01T10:00:00-03:00
 *   npm run google:previa -- --lista              com os números dos pedidos
 *
 * Lê os pedidos pela MESMA função da rotina (`google_conversoes_candidatos`,
 * 0135) e decide pela MESMA conta (`montarPrevia`), com a chave de serviço do
 * `.env.local`. Não chama o Google e não grava nada. Imprime número de pedido,
 * dia e valor: nenhum nome, e-mail, telefone ou código de clique.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { lerCandidato, lerConfig, montarPrevia, MOTIVOS, type Candidato, type MotivoDeFora, type PreviaDeUmTipo } from "../src/lib/google-ads/conversoes.ts";

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

const env = { ...lerEnv(), ...process.env } as Record<string, string | undefined>;
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const chave = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !chave) {
  console.error("Falta NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no .env.local.");
  process.exit(1);
}
const opcao = (nome: string) => process.argv.find((a) => a.startsWith(`--${nome}=`))?.slice(nome.length + 3);
const comLista = process.argv.includes("--lista");

async function rest(caminho: string, corpo?: unknown): Promise<unknown> {
  const r = await fetch(`${url}/rest/v1/${caminho}`, {
    method: corpo === undefined ? "GET" : "POST",
    headers: { apikey: chave as string, Authorization: `Bearer ${chave}`, "content-type": "application/json" },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  if (!r.ok) throw new Error(`${caminho}: ${r.status} ${await r.text()}`);
  return r.json();
}

const [linhaDaConfig] = (await rest("site_settings?key=eq.google:conversoes&select=value")) as { value: unknown }[];
const config = lerConfig(linhaDaConfig?.value);
const candidatos = ((await rest("rpc/google_conversoes_candidatos", {
  p_retirada_desde: config.retirarDesde,
  p_compra_desde: config.compraPagaDesde,
  p_com_cliente: false,
})) as Record<string, unknown>[])
  .map(lerCandidato)
  .filter((c): c is Candidato => c !== null);

const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const soma = (l: { valor: number }[]) => reais(l.reduce((s, i) => s + i.valor, 0));
const numeros = (l: { pedido: number }[]) => (comLista && l.length ? `\n      ${l.map((i) => i.pedido).join(", ")}` : "");

function imprimir(titulo: string, p: PreviaDeUmTipo) {
  console.log(`  ${titulo}`);
  console.log(`    sairiam agora: ${p.agora.length} (${soma(p.agora)})${numeros(p.agora)}`);
  console.log(`    entram e saem depois (prazo mínimo do Google): ${p.depois.length}${numeros(p.depois)}`);
  for (const [motivo, itens] of Object.entries(p.fora) as [MotivoDeFora, { pedido: number; valor: number }[]][]) {
    console.log(`    de fora, ${MOTIVOS[motivo]}: ${itens.length} (${soma(itens)})${numeros(itens)}`);
  }
}

console.log(`Interruptor: ${config.ligado ? "LIGADO" : "desligado"}, ${config.validar ? "em validação" : "valendo"}.`);
console.log(`Ação da etiqueta: ${config.acaoDaEtiqueta}. Ação "Compra paga": ${config.acaoCompraPaga ?? "ainda não existe"}.`);
console.log(`Pedidos lidos: ${candidatos.length} (feitos desde ${config.retirarDesde}, mais os pagos desde ${config.compraPagaDesde}).`);

const momentos = opcao("em") ? [opcao("em") as string] : [new Date().toISOString(), "2026-12-01T10:00:00-03:00"];
for (const m of momentos) {
  const agora = new Date(m);
  const previa = montarPrevia(candidatos, config, agora);
  console.log(`\nSe rodasse em ${agora.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}:`);
  imprimir("Retirada (pedido cancelado, na ação da etiqueta)", previa.retirada);
  imprimir("Compra paga (pedido pago com clique do Google)", previa.compraPaga);
}
