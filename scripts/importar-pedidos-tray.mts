/**
 * Sobe para o portal as exportações de pedidos do painel da Tray.
 *
 *   npm run vendas:importar
 *   npm run vendas:importar -- caminho/pedidos.csv [caminho/produtos_vendidos.csv]
 *
 * Sem caminho, pega em ~/Downloads o `pedidos_*.csv` mais novo e o
 * `produtos_vendidos_*.csv` baixado junto. O passo a passo da exportação está
 * em `docs/tray-exportar-pedidos.md`.
 *
 * Roda quantas vezes quiser: pedido que já existe é atualizado, e o que mudou
 * de status fica marcado. Lê `.env.local` da pasta do projeto e grava com a
 * chave de serviço, por isso só roda na máquina de quem tem o projeto.
 *
 * Saída: 0 deu certo, 1 erro, 2 não achou exportação recente.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  ArquivoDaTrayInvalido,
  lerPedidos,
  lerProdutosVendidos,
  resumirPorDia,
  type ItemDoPedido,
} from "../src/lib/vendas/tray-csv.ts";

const DOWNLOADS = join(homedir(), "Downloads");
const IMPORTADOS = join(DOWNLOADS, "tray-importados");
/** Exportação mais velha que isso quase sempre é download que não aconteceu. */
const VALIDADE_MS = 30 * 60_000;
/** Os dois arquivos saem do mesmo pedido de exportação, com segundos de diferença. */
const JANELA_DO_PAR_MS = 15 * 60_000;
const LOTE = 150;

const reais = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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

function maisNovo(prefixo: string): { caminho: string; mtime: number } | null {
  if (!existsSync(DOWNLOADS)) return null;
  let achado: { caminho: string; mtime: number } | null = null;
  for (const nome of readdirSync(DOWNLOADS)) {
    if (!nome.startsWith(prefixo) || !nome.endsWith(".csv")) continue;
    const caminho = join(DOWNLOADS, nome);
    const mtime = statSync(caminho).mtimeMs;
    if (!achado || mtime > achado.mtime) achado = { caminho, mtime };
  }
  return achado;
}

function escolherArquivos(): { pedidos: string; itens: string | null; automatico: boolean } {
  const caminhos = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  if (caminhos.length > 0) {
    const itens = caminhos.find((c) => basename(c).startsWith("produtos_vendidos")) ?? null;
    const pedidos = caminhos.find((c) => c !== itens);
    if (!pedidos) {
      console.error("Faltou o arquivo de pedidos. Passe o pedidos_*.csv e, se tiver, o produtos_vendidos_*.csv.");
      process.exit(1);
    }
    return { pedidos, itens, automatico: false };
  }

  const pedidos = maisNovo("pedidos_");
  if (!pedidos) {
    console.error(`Não achei nenhum pedidos_*.csv em ${DOWNLOADS}. A exportação foi baixada?`);
    process.exit(2);
  }
  const idadeMin = Math.round((Date.now() - pedidos.mtime) / 60_000);
  if (Date.now() - pedidos.mtime > VALIDADE_MS) {
    console.error(
      `O pedidos_*.csv mais novo (${basename(pedidos.caminho)}) foi baixado há ${idadeMin} minutos. ` +
        "Parece que o download de agora não aconteceu. Para importar esse arquivo mesmo assim, passe o caminho dele.",
    );
    process.exit(2);
  }
  const itens = maisNovo("produtos_vendidos_");
  const itensDoPar = itens && Math.abs(itens.mtime - pedidos.mtime) <= JANELA_DO_PAR_MS ? itens.caminho : null;
  return { pedidos: pedidos.caminho, itens: itensDoPar, automatico: true };
}

async function principal() {
  const env = { ...lerEnv(), ...process.env };
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) {
    console.error("Faltam NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local. Rode na pasta do projeto.");
    process.exit(1);
  }

  const arquivos = escolherArquivos();
  const inicio = new Date();
  console.log(`Pedidos:  ${basename(arquivos.pedidos)}`);
  console.log(`Produtos: ${arquivos.itens ? basename(arquivos.itens) : "(sem arquivo: os itens gravados ficam como estão)"}`);

  const pedidos = lerPedidos(readFileSync(arquivos.pedidos));
  const itens: Map<number, ItemDoPedido[]> | null = arquivos.itens
    ? lerProdutosVendidos(readFileSync(arquivos.itens))
    : null;
  if (pedidos.length === 0) {
    console.error("O arquivo de pedidos não tem nenhuma linha válida. Nada foi gravado.");
    process.exit(1);
  }

  const supabase = createClient(url, chave, { auth: { persistSession: false } });
  let lidos = 0;
  let novos = 0;
  let mudaram = 0;
  let erro: string | null = null;

  for (let i = 0; i < pedidos.length && !erro; i += LOTE) {
    const lote = pedidos.slice(i, i + LOTE).map((p) => ({ ...p, itens: itens?.get(p.pedido) ?? null }));
    const { data, error } = await supabase.rpc("importar_pedidos_tray", { p_pedidos: lote });
    if (error) {
      erro = error.message;
      break;
    }
    const r = data as { lidos: number; novos: number; mudaram: number };
    lidos += r.lidos;
    novos += r.novos;
    mudaram += r.mudaram;
  }

  const dias = resumirPorDia(pedidos);
  const periodo = { de: dias[dias.length - 1].dia, ate: dias[0].dia };
  const comItens = itens ? pedidos.filter((p) => itens.has(p.pedido)).length : 0;

  await supabase.from("sync_logs").insert({
    source: "tray_pedidos",
    operation: "importar_csv",
    status: erro ? (lidos > 0 ? "partial" : "error") : "success",
    attempted: pedidos.length,
    succeeded: lidos,
    failed: pedidos.length - lidos,
    error: erro,
    payload: { periodo, novos, mudaram, com_itens: comItens, automatico: arquivos.automatico },
    started_at: inicio.toISOString(),
    finished_at: new Date().toISOString(),
  });

  if (erro) {
    console.error(`\nO banco recusou a gravação: ${erro}`);
    console.error(`Gravados antes do erro: ${lidos} de ${pedidos.length}.`);
    process.exit(1);
  }

  console.log(`\nPeríodo do arquivo: ${periodo.de} a ${periodo.ate}`);
  console.log(`Pedidos lidos: ${lidos}  |  novos: ${novos}  |  mudaram de status: ${mudaram}  |  com itens: ${comItens}`);
  console.log("\nÚltimos dias (só o que está pago entra em faturamento):");
  for (const d of dias.slice(0, 7)) {
    console.log(
      `  ${d.dia}  pagos ${String(d.pagos).padStart(3)}  ${reais(d.valorPago).padStart(14)}` +
        `   aguardando ${d.aguardando} (${reais(d.valorAguardando)})   cancelados ${d.cancelados} (${reais(d.valorCancelado)})`,
    );
  }

  if (arquivos.automatico) {
    mkdirSync(IMPORTADOS, { recursive: true });
    for (const caminho of [arquivos.pedidos, arquivos.itens]) {
      if (caminho) renameSync(caminho, join(IMPORTADOS, basename(caminho)));
    }
    console.log(`\nArquivos movidos para ${IMPORTADOS}`);
  }
}

principal().catch((e) => {
  if (e instanceof ArquivoDaTrayInvalido) console.error(e.message);
  else console.error(e);
  process.exit(1);
});
