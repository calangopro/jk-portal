import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { lerContaDeServico, tokenDeAcesso } from "../search-console/conta";
import {
  CHAVE_DA_CONFIG, CONTA_DO_GOOGLE_ADS, PRAZOS, VERSAO_GOOGLE_ADS, classificarCompraPaga, classificarErroGeral, classificarRetirada,
  corpoDaCompraPaga, corpoDaRetirada, decidirCompraPaga, decidirRetirada, erroGeral, eventoDaCompraPaga, falhasDaRetirada, frase,
  gravacaoDaResposta, lerCandidato, lerConfig, lerLinhaDaFila, montarPrevia, semDadosDoCliente, situacaoDoDataManager,
  violacoesDoDataManager, type Candidato, type Config, type Destino, type Falha, type Gravacao, type LinhaDaFila, type NovaLinha,
  type Previa,
} from "./conversoes";

/**
 * Conversões do Google Ads pelo painel: a parte que fala com o Google e com o
 * banco. A conta mora em `conversoes.ts`; o que fazer em cada resposta também.
 *
 * Quem chama é a rotina `/api/cron/google-conversoes`, com a chave de serviço.
 * Uma rodada: enfileira o que entrou, manda as retiradas, manda as compras
 * pagas e pergunta à Data Manager como ficaram as que foram mandadas antes.
 *
 * A conta de serviço é a do Search Console (`GSC_SERVICE_ACCOUNT_JSON`), com
 * dois escopos: `adwords` para a retirada (API do Google Ads) e `datamanager`
 * para a compra paga (Data Manager API). Nos dois casos ela precisa de acesso
 * PADRÃO à conta do Google Ads: hoje é Somente leitura, e o Google recusa.
 */

const ESCOPO_ADWORDS = "https://www.googleapis.com/auth/adwords";
const ESCOPO_DATA_MANAGER = "https://www.googleapis.com/auth/datamanager";
const URL_RETIRADA = `https://googleads.googleapis.com/${VERSAO_GOOGLE_ADS}/customers/${CONTA_DO_GOOGLE_ADS}:uploadConversionAdjustments`;
const URL_EVENTOS = "https://datamanager.googleapis.com/v1/events:ingest";
const URL_SITUACAO = "https://datamanager.googleapis.com/v1/requestStatus:retrieve";

export async function lerConfigDoGoogle(db: SupabaseClient): Promise<Config> {
  const { data } = await db.from("site_settings").select("value").eq("key", CHAVE_DA_CONFIG).maybeSingle();
  return lerConfig(data?.value);
}

export async function lerCandidatos(db: SupabaseClient, cfg: Config, comCliente = false): Promise<Candidato[]> {
  const { data, error } = await db.rpc("google_conversoes_candidatos", {
    p_retirada_desde: cfg.retirarDesde,
    p_compra_desde: cfg.compraPagaDesde,
    p_com_cliente: comCliente,
  });
  if (error) throw new Error(`Não deu para ler os pedidos: ${error.message}`);
  return ((data ?? []) as Record<string, unknown>[]).map(lerCandidato).filter((c): c is Candidato => c !== null);
}

/** O que seria mandado agora, sem mandar nada e sem gravar nada. Vale com tudo desligado. */
export async function previaDoGoogle(db: SupabaseClient, agora = new Date()): Promise<{ config: Config; previa: Previa }> {
  const config = await lerConfigDoGoogle(db);
  return { config, previa: montarPrevia(await lerCandidatos(db, config), config, agora) };
}

type Resposta = { status: number; corpo: unknown };

async function chamar(url: string, token: string, corpo?: unknown): Promise<Resposta> {
  try {
    const r = await fetch(url, {
      method: corpo === undefined ? "GET" : "POST",
      headers: { Authorization: `Bearer ${token}`, ...(corpo === undefined ? {} : { "content-type": "application/json" }) },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    });
    return { status: r.status, corpo: await r.json().catch(() => null) };
  } catch (e) {
    return { status: 0, corpo: { error: { message: e instanceof Error ? e.message : "falha de rede" } } };
  }
}

/** Abre o token de um escopo. Sem a conta de serviço neste ambiente, diz o que falta. */
async function abrirToken(escopo: string): Promise<{ token: string } | { falha: Falha }> {
  const leitura = lerContaDeServico();
  if (!leitura.conta) return { falha: { codigo: "SEM_CONTA_DE_SERVICO", mensagem: leitura.problema } };
  try {
    return { token: await tokenDeAcesso(leitura.conta, escopo) };
  } catch (e) {
    return { falha: { codigo: "TOKEN_RECUSADO", mensagem: e instanceof Error ? e.message : "O Google recusou a conta de serviço." } };
  }
}

async function gravar(db: SupabaseClient, linhas: Gravacao[]): Promise<void> {
  if (!linhas.length) return;
  const { error } = await db.rpc("google_conversoes_gravar", { p_linhas: linhas });
  if (error) throw new Error(`Não deu para gravar a resposta do Google: ${error.message}`);
}

async function marcar(db: SupabaseClient, tipo: "retirada" | "compra_paga", validar: boolean): Promise<LinhaDaFila[]> {
  const { data, error } = await db.rpc("google_conversoes_marcar", { p_tipo: tipo, p_limite: PRAZOS.lote, p_validar: validar });
  if (error) throw new Error(`Não deu para separar o lote: ${error.message}`);
  return ((data ?? []) as Record<string, unknown>[]).map(lerLinhaDaFila).filter((l): l is LinhaDaFila => l !== null);
}

/** Põe na fila o que entrou desde a última rodada. A chave única (pedido, tipo) não deixa repetir. */
async function enfileirar(db: SupabaseClient, cfg: Config, candidatos: Candidato[], agora: Date): Promise<{ retirada: number; compra_paga: number }> {
  const linhas: NovaLinha[] = [];
  for (const c of candidatos) {
    for (const d of [decidirRetirada(c, cfg, agora), decidirCompraPaga(c, cfg, agora)]) if (d.entra) linhas.push(d.linha);
  }
  if (!linhas.length) return { retirada: 0, compra_paga: 0 };
  const { data, error } = await db
    .from("google_conversoes")
    .upsert(linhas, { onConflict: "pedido,tipo", ignoreDuplicates: true })
    .select("tipo");
  if (error) throw new Error(`Não deu para enfileirar: ${error.message}`);
  const novas = (data ?? []) as { tipo: string }[];
  return { retirada: novas.filter((n) => n.tipo === "retirada").length, compra_paga: novas.filter((n) => n.tipo === "compra_paga").length };
}

export type ResumoDoEnvio = { mandadas: number; aceitas: number; recusadas: number; esperando: number; problema: string | null };

const vazio = (): ResumoDoEnvio => ({ mandadas: 0, aceitas: 0, recusadas: 0, esperando: 0, problema: null });

function contar(resumo: ResumoDoEnvio, g: Gravacao) {
  if (["confirmado", "enviado", "validado"].includes(g.estado) && !g.codigo) resumo.aceitas++;
  else if (g.estado === "pendente") resumo.esperando++;
  else resumo.recusadas++;
}

/** Prazo vencido na fila (a linha esperou demais): sai como fora do prazo, sem chamar o Google. */
function vencida(l: LinhaDaFila, agora: Date): boolean {
  if (l.tipo === "retirada") return agora.getTime() - Date.parse(l.pedido_em) > PRAZOS.retiradaMaximaDias * 86_400_000;
  return Boolean(l.clique_em) && agora.getTime() - Date.parse(l.clique_em as string) > PRAZOS.cliqueMaximoDias * 86_400_000;
}

function separarVencidas(linhas: LinhaDaFila[], agora: Date): { valem: LinhaDaFila[]; vencidas: Gravacao[] } {
  const vencidas: Gravacao[] = [];
  const valem: LinhaDaFila[] = [];
  for (const l of linhas) {
    if (vencida(l, agora)) {
      vencidas.push({ id: l.id, estado: "fora_do_prazo", tentativas: l.tentativas, codigo: "PRAZO_DO_GOOGLE", erro: "Passou do prazo do Google antes de sair." });
    } else valem.push(l);
  }
  return { valem, vencidas };
}

async function mandarRetiradas(db: SupabaseClient, cfg: Config, validar: boolean, agora: Date): Promise<ResumoDoEnvio> {
  const resumo = vazio();
  const lote = await marcar(db, "retirada", validar);
  if (!lote.length) return resumo;
  const { valem, vencidas } = separarVencidas(lote, agora);
  const gravacoes: Gravacao[] = [...vencidas];
  resumo.recusadas += vencidas.length;

  if (valem.length) {
    const corpo = corpoDaRetirada(valem, cfg.acaoDaEtiqueta, validar);
    const aberto = await abrirToken(ESCOPO_ADWORDS);
    const r = "token" in aberto ? await chamar(URL_RETIRADA, aberto.token, corpo) : null;
    resumo.mandadas = valem.length;

    if (!r || r.status !== 200) {
      const falha = "falha" in aberto ? aberto.falha : erroGeral(r?.corpo, r?.status ?? 0);
      const destino: Destino = "falha" in aberto ? { tipo: "configuracao" } : classificarErroGeral(r?.status ?? 0, falha.codigo);
      resumo.problema = frase(falha);
      valem.forEach((l, i) => gravacoes.push({ ...gravacaoDaResposta(l, destino, falha, validar, agora), corpo: corpo.conversionAdjustments[i] }));
    } else {
      const falhas = falhasDaRetirada(r.corpo);
      valem.forEach((l, i) => {
        const falha = falhas.get(i) ?? null;
        const g = gravacaoDaResposta(l, classificarRetirada(falha?.codigo ?? null), falha, validar, agora);
        gravacoes.push({ ...g, corpo: corpo.conversionAdjustments[i], resposta: falha ?? { ok: true, validacao: validar } });
      });
    }
  }
  gravacoes.slice(vencidas.length).forEach((g) => contar(resumo, g));
  await gravar(db, gravacoes);
  return resumo;
}

async function dadosDosClientes(db: SupabaseClient, pedidos: number[]): Promise<Map<number, { email: string | null; telefone: string | null }>> {
  const mapa = new Map<number, { email: string | null; telefone: string | null }>();
  if (!pedidos.length) return mapa;
  const { data } = await db.from("tray_pedidos").select("pedido, cliente_email, cliente_telefone").in("pedido", pedidos);
  for (const p of (data ?? []) as { pedido: number; cliente_email: string | null; cliente_telefone: string | null }[]) {
    mapa.set(Number(p.pedido), { email: p.cliente_email, telefone: p.cliente_telefone });
  }
  return mapa;
}

async function mandarComprasPagas(db: SupabaseClient, cfg: Config, validar: boolean, agora: Date): Promise<ResumoDoEnvio> {
  const resumo = vazio();
  if (!cfg.acaoCompraPaga) {
    resumo.problema = "Falta o número da ação \"Compra paga\" em google:conversoes. As compras ficam na fila, esperando.";
    return resumo;
  }
  const lote = await marcar(db, "compra_paga", validar);
  if (!lote.length) return resumo;
  const { valem, vencidas } = separarVencidas(lote, agora);
  const gravacoes: Gravacao[] = [...vencidas];
  resumo.recusadas += vencidas.length;

  if (valem.length) {
    const clientes = cfg.dadosDoCliente ? await dadosDosClientes(db, valem.filter((l) => l.com_cliente).map((l) => l.pedido)) : new Map();
    const eventos = valem.map((l) => eventoDaCompraPaga(l, l.com_cliente && cfg.dadosDoCliente ? clientes.get(l.pedido) : null));
    const corpo = corpoDaCompraPaga(eventos, cfg.acaoCompraPaga, validar);
    const aberto = await abrirToken(ESCOPO_DATA_MANAGER);
    const r = "token" in aberto ? await chamar(URL_EVENTOS, aberto.token, corpo) : null;
    resumo.mandadas = valem.length;

    if (r && r.status === 200) {
      const requisicao = (r.corpo as { requestId?: string } | null)?.requestId ?? null;
      const avisos = (r.corpo as { fieldWarnings?: unknown } | null)?.fieldWarnings;
      valem.forEach((l, i) => {
        const g = gravacaoDaResposta(l, { tipo: "feito" }, null, validar, agora);
        gravacoes.push({
          ...g,
          corpo: semDadosDoCliente(eventos[i]),
          resposta: { requestId: requisicao, validacao: validar, ...(avisos ? { avisos } : {}) },
          ...(validar || !requisicao ? {} : { requisicao, indice: i }),
        });
      });
    } else {
      const violacoes = r ? violacoesDoDataManager(r.corpo) : new Map<number, Falha>();
      const geral = "falha" in aberto ? aberto.falha : erroGeral(r?.corpo, r?.status ?? 0);
      if (violacoes.size === 0) resumo.problema = frase(geral);
      valem.forEach((l, i) => {
        const propria = violacoes.get(i);
        let g: Gravacao;
        if (propria) g = gravacaoDaResposta(l, { tipo: "recusado" }, propria, validar, agora);
        else if (violacoes.size > 0) {
          // O Google recusou o pedido inteiro por causa de OUTRO evento: este volta para a fila sem gastar tentativa.
          g = validar
            ? gravacaoDaResposta(l, { tipo: "feito" }, null, true, agora)
            : { id: l.id, estado: "pendente", tentativas: l.tentativas, proxima_em: agora.toISOString(), codigo: null, erro: null };
        } else {
          const destino: Destino = "falha" in aberto ? { tipo: "configuracao" } : classificarErroGeral(r?.status ?? 0, geral.codigo);
          g = gravacaoDaResposta(l, destino, geral, validar, agora);
        }
        gravacoes.push({ ...g, corpo: semDadosDoCliente(eventos[i]), ...(propria ? { resposta: propria } : {}) });
      });
    }
  }
  gravacoes.slice(vencidas.length).forEach((g) => contar(resumo, g));
  await gravar(db, gravacoes);
  return resumo;
}

/**
 * Pergunta à Data Manager como ficaram as compras mandadas há mais de 30
 * minutos. Ela processa em até 24 horas; depois de 26 sem resposta, a linha
 * fica como enviada e deixa de ser perguntada.
 */
async function conferirComprasPagas(db: SupabaseClient, agora: Date): Promise<{ conferidas: number; problema: string | null }> {
  const { data } = await db
    .from("google_conversoes")
    .select("*")
    .eq("tipo", "compra_paga")
    .eq("estado", "enviado")
    .not("requisicao", "is", null)
    .lt("enviado_em", new Date(agora.getTime() - PRAZOS.conferirDepoisMinutos * 60_000).toISOString())
    .gt("enviado_em", new Date(agora.getTime() - PRAZOS.desistirDeConferirHoras * 3_600_000).toISOString())
    .limit(2000);
  const linhas = ((data ?? []) as Record<string, unknown>[]).map(lerLinhaDaFila).filter((l): l is LinhaDaFila => l !== null);
  if (!linhas.length) return { conferidas: 0, problema: null };

  const aberto = await abrirToken(ESCOPO_DATA_MANAGER);
  if ("falha" in aberto) return { conferidas: 0, problema: frase(aberto.falha) };

  const porRequisicao = new Map<string, LinhaDaFila[]>();
  for (const l of linhas) porRequisicao.set(l.requisicao as string, [...(porRequisicao.get(l.requisicao as string) ?? []), l]);

  const gravacoes: Gravacao[] = [];
  let problema: string | null = null;
  for (const [requisicao, grupo] of [...porRequisicao].slice(0, 10)) {
    const r = await chamar(`${URL_SITUACAO}?requestId=${encodeURIComponent(requisicao)}`, aberto.token);
    if (r.status !== 200) {
      problema = frase(erroGeral(r.corpo, r.status));
      continue;
    }
    const quantos = Math.max(...grupo.map((l) => (l.indice ?? 0) + 1));
    const situacao = situacaoDoDataManager(r.corpo, quantos);
    for (const l of grupo) {
      const s = situacao[l.indice ?? 0];
      if (!s || s.estado === "processando") continue;
      if (s.estado === "ok") {
        gravacoes.push({ id: l.id, estado: "confirmado", tentativas: l.tentativas, confirmado_em: agora.toISOString(), codigo: null, erro: null });
      } else {
        gravacoes.push({ ...gravacaoDaResposta(l, classificarCompraPaga(s.falha.codigo), s.falha, false, agora), resposta: { situacao: s.falha } });
      }
    }
  }
  await gravar(db, gravacoes);
  return { conferidas: gravacoes.length, problema };
}

export type ResultadoDaRodada =
  | { estado: "desligado" }
  | {
      estado: "ok" | "erro";
      validar: boolean;
      enfileiradas: { retirada: number; compra_paga: number };
      retirada: ResumoDoEnvio | null;
      compraPaga: ResumoDoEnvio | null;
      conferidas: number;
      problema: string | null;
    };

/** Uma rodada da rotina. Desligada, não faz nada (nem enfileira). */
export async function rodarConversoesDoGoogle(db: SupabaseClient, agora = new Date()): Promise<ResultadoDaRodada> {
  const cfg = await lerConfigDoGoogle(db);
  if (!cfg.ligado) return { estado: "desligado" };

  const candidatos = await lerCandidatos(db, cfg, cfg.dadosDoCliente);
  const enfileiradas = await enfileirar(db, cfg, candidatos, agora);
  const retirada = cfg.retirada ? await mandarRetiradas(db, cfg, cfg.validar, agora) : null;
  const compraPaga = cfg.compraPaga ? await mandarComprasPagas(db, cfg, cfg.validar, agora) : null;
  const conferencia = cfg.compraPaga && !cfg.validar ? await conferirComprasPagas(db, agora) : { conferidas: 0, problema: null };

  // Falta só a ação da compra paga não é rotina quebrada: é o estado de antes de 01/12.
  const semAcao = compraPaga?.problema?.startsWith("Falta o número") ?? false;
  const problema = retirada?.problema ?? (semAcao ? null : compraPaga?.problema) ?? conferencia.problema ?? null;
  return {
    estado: problema ? "erro" : "ok",
    validar: cfg.validar,
    enfileiradas,
    retirada,
    compraPaga,
    conferidas: conferencia.conferidas,
    problema: problema ?? (semAcao ? (compraPaga?.problema ?? null) : null),
  };
}

/**
 * O teste contra a conta de verdade: monta os corpos com os pedidos que
 * sairiam agora (até `maximo` de cada tipo) e manda ao Google em validação
 * (`validate_only`), SEM mexer na fila e com o interruptor como estiver. O
 * Google lê e não grava nada. `acaoCompraPaga` permite testar com uma ação
 * antes de o número estar colado.
 */
export async function validarNoGoogle(
  db: SupabaseClient,
  opcoes: { maximo?: number; acaoCompraPaga?: string | null; agora?: Date } = {},
): Promise<{
  retirada: { pedidos: number[]; status: number; falhas: Record<number, string>; problema: string | null };
  compraPaga: { pedidos: number[]; status: number; falhas: Record<number, string>; problema: string | null; requestId: string | null } | null;
}> {
  const agora = opcoes.agora ?? new Date();
  const cfg = await lerConfigDoGoogle(db);
  const ligado = { ...cfg, retirada: true, compraPaga: true };
  const maximo = Math.min(Math.max(opcoes.maximo ?? 20, 1), 200);
  const candidatos = await lerCandidatos(db, cfg);
  const sairiam = (tipo: "retirada" | "compra_paga") =>
    candidatos
      .map((c) => (tipo === "retirada" ? decidirRetirada(c, ligado, agora) : decidirCompraPaga(c, ligado, agora)))
      .flatMap((d) => (d.entra && Date.parse(d.linha.proxima_em) <= agora.getTime() ? [d.linha] : []))
      .slice(0, maximo);

  // Retirada
  const retiradas = sairiam("retirada");
  const corpoR = corpoDaRetirada(retiradas, cfg.acaoDaEtiqueta, true);
  const tokenR = await abrirToken(ESCOPO_ADWORDS);
  const r = "token" in tokenR && retiradas.length ? await chamar(URL_RETIRADA, tokenR.token, corpoR) : null;
  const falhasR = r?.status === 200 ? falhasDaRetirada(r.corpo) : new Map<number, Falha>();
  const retirada = {
    pedidos: retiradas.map((l) => l.pedido),
    status: r?.status ?? 0,
    falhas: Object.fromEntries([...falhasR].map(([i, f]) => [retiradas[i].pedido, frase(f)])),
    problema: "falha" in tokenR ? frase(tokenR.falha) : r && r.status !== 200 ? frase(erroGeral(r.corpo, r.status)) : null,
  };

  // Compra paga
  const acao = opcoes.acaoCompraPaga ?? cfg.acaoCompraPaga;
  let compraPaga = null;
  if (acao) {
    const compras = sairiam("compra_paga");
    const eventos = compras.map((l) => eventoDaCompraPaga({ ...l }));
    const tokenC = await abrirToken(ESCOPO_DATA_MANAGER);
    const c = "token" in tokenC && compras.length ? await chamar(URL_EVENTOS, tokenC.token, corpoDaCompraPaga(eventos, acao, true)) : null;
    const violacoes = c && c.status !== 200 ? violacoesDoDataManager(c.corpo) : new Map<number, Falha>();
    compraPaga = {
      pedidos: compras.map((l) => l.pedido),
      status: c?.status ?? 0,
      falhas: Object.fromEntries([...violacoes].map(([i, f]) => [compras[i].pedido, frase(f)])),
      problema: "falha" in tokenC ? frase(tokenC.falha) : c && c.status !== 200 && violacoes.size === 0 ? frase(erroGeral(c.corpo, c.status)) : null,
      requestId: c?.status === 200 ? ((c.corpo as { requestId?: string } | null)?.requestId ?? null) : null,
    };
  }
  return { retirada, compraPaga };
}
