import "server-only";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enderecos } from "./base";
import { identificar } from "./chaves";
import { CORS, desafio } from "./oauth";
import { Diario, executarOperacao, resumirEntrada } from "./executar";
import { assinaturaDe, jsonSchemaDe } from "./assinaturas";
import { GUIAS, INSTRUCOES_CODIGO, INSTRUCOES_FERRAMENTAS } from "./guias";
import { OPERACOES, AREAS } from "./operacoes";
import { rodarCodigo } from "./sandbox";
import { ErroDoConector, type Contexto, type Operacao } from "./tipos";

/**
 * O servidor MCP (HTTP sem sessão, só POST com JSON). Dois modos no mesmo
 * núcleo:
 *
 * - "codigo" (/api/mcp): três ferramentas, buscar, consultar e executar. O
 *   Claude lê as assinaturas em TypeScript e escreve código que chama
 *   `jk.area.acao()`. É o Code Mode da Cloudflare: em vez de 90 ferramentas na
 *   conversa, três; em vez de cada resultado intermediário passar pelo
 *   contexto, o código filtra e devolve só o que importa.
 * - "ferramentas" (/api/mcp/ferramentas): uma ferramenta por operação, para
 *   cliente que lida melhor assim.
 *
 * Nos dois, toda operação passa por `executarOperacao`, que é onde moram as
 * travas e o registro.
 */

export type Modo = "codigo" | "ferramentas";

const VERSOES = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
const LIMITE_RESPOSTA = 90_000;

type Msg = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> };

const resposta = (id: Msg["id"], result: unknown) => ({ jsonrpc: "2.0", id, result });
const falha = (id: Msg["id"], code: number, message: string) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

const json = (dados: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(dados), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...CORS, ...extra },
  });

/** As operações que este acesso enxerga (escopo e papel). */
function visiveis(ctx: Contexto, soLeitura: boolean): Operacao[] {
  return OPERACOES.filter(
    (op) =>
      (!soLeitura || op.risco === "leitura") &&
      (ctx.acesso.escopo === "completo" || op.risco === "leitura") &&
      (!op.soAdmin || ctx.quem.papel === "admin"),
  );
}

const PORNOME = new Map(OPERACOES.map((o) => [o.nome, o]));

/** Corta resposta grande demais, avisando o Claude para filtrar no código. */
function caber(texto: string): string {
  if (texto.length <= LIMITE_RESPOSTA) return texto;
  return `${texto.slice(0, LIMITE_RESPOSTA)}\n…[cortado: a resposta tinha ${texto.length} caracteres. Filtre ou resuma dentro do código e devolva só o que precisa.]`;
}

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// ---------------------------------------------------------------- ferramentas do modo código

const FERRAMENTAS_CODIGO = {
  buscar: {
    name: "buscar",
    title: "Buscar operações do painel",
    description:
      'Acha operações do painel da JK e devolve a assinatura TypeScript de cada uma (jk.area.acao). Sem nada: as áreas e o que cada uma tem. area: a área inteira. consulta: procura por palavra (ex.: "publicar", "comentário"). guia: "escrita" (regras de texto), "blocos" (HTML do editor), "seo" (checklist) ou "site" (o que existe e onde).',
    inputSchema: {
      type: "object",
      properties: {
        consulta: { type: "string", description: "Palavras do que você quer fazer." },
        area: { type: "string", description: "Uma área inteira, ex.: conteudos, midia, metricas." },
        guia: { type: "string", enum: Object.keys(GUIAS) },
      },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
  consultar: {
    name: "consultar",
    title: "Consultar o painel (só leitura)",
    description:
      "Roda JavaScript que só LÊ o painel. O código é o corpo de uma função async: use await jk.area.acao({...}) e devolva com return só o que interessa (filtre e resuma no código). Sem fetch, require ou process. Operações que escrevem não existem aqui.",
    inputSchema: {
      type: "object",
      properties: { codigo: { type: "string", description: "Corpo de função async. Ex.: const r = await jk.conteudos.listar({}); return r.itens.length;" } },
      required: ["codigo"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
  executar: {
    name: "executar",
    title: "Executar no painel (pode escrever)",
    description:
      "Roda JavaScript com todas as operações deste acesso, inclusive as que escrevem e publicam. Mesmo formato do consultar. Antes de operação PERIGOSA (publicar, tirar do ar, responder comentário, redirect, bio, home, grupo, QR, convite), diga o que vai fazer e espere o sim da pessoa.",
    inputSchema: {
      type: "object",
      properties: { codigo: { type: "string", description: "Corpo de função async que chama jk.area.acao({...})." } },
      required: ["codigo"],
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  },
};

function buscar(args: Record<string, unknown>, ctx: Contexto): string {
  const guia = typeof args.guia === "string" ? args.guia : "";
  if (guia) return GUIAS[guia] ?? `Guia desconhecido. Existem: ${Object.keys(GUIAS).join(", ")}.`;

  const ops = visiveis(ctx, false);
  const area = typeof args.area === "string" ? semAcento(args.area.trim()) : "";
  const consulta = typeof args.consulta === "string" ? semAcento(args.consulta.trim()) : "";

  if (!area && !consulta) {
    const linhas = AREAS.map((a) => {
      const daArea = ops.filter((o) => o.nome.startsWith(`${a.nome}.`));
      if (!daArea.length) return null;
      return `## ${a.nome}: ${a.descricao}\n${daArea.map((o) => `- ${o.nome.split(".")[1]}: ${o.resumo}${o.risco === "perigosa" ? " [PERIGOSA]" : o.risco === "escrita" ? " [escreve]" : ""}`).join("\n")}`;
    }).filter(Boolean);
    return `Áreas do painel (${ops.length} operações para este acesso, escopo ${ctx.acesso.escopo}). Peça buscar({ area }) para as assinaturas.\n\n${linhas.join("\n\n")}`;
  }

  let achadas = ops;
  if (area) achadas = achadas.filter((o) => semAcento(o.nome).startsWith(`${area}.`));
  if (consulta) {
    const termos = consulta.split(/\s+/).filter(Boolean);
    const pontos = (o: Operacao) => {
      const alvo = semAcento(`${o.nome} ${o.resumo} ${o.detalhe ?? ""}`);
      return termos.reduce((n, t) => n + (alvo.includes(t) ? (semAcento(o.nome).includes(t) ? 3 : 1) : 0), 0);
    };
    achadas = achadas
      .map((o) => [o, pontos(o)] as const)
      .filter(([, p]) => p > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([o]) => o);
  }
  if (!achadas.length) return `Nada encontrado. Áreas: ${AREAS.map((a) => a.nome).join(", ")}.`;
  return achadas.map((o) => assinaturaDe(o)).join("\n\n");
}

async function rodar(codigo: unknown, ctx: Contexto, diario: Diario, soLeitura: boolean): Promise<{ texto: string; erro: boolean }> {
  if (typeof codigo !== "string" || !codigo.trim()) return { texto: 'Mande o código em "codigo".', erro: true };
  if (codigo.length > 100_000) return { texto: "Código grande demais (máximo de 100 mil caracteres).", erro: true };
  const ferramenta = soLeitura ? "consultar" : "executar";
  const ops = visiveis(ctx, soLeitura);
  const t0 = Date.now();
  const r = await rodarCodigo(
    codigo,
    ops.map((o) => o.nome),
    async (nome, args) => {
      const op = PORNOME.get(nome);
      if (!op || !ops.includes(op)) throw new ErroDoConector(`Operação ${nome} não está disponível aqui.`);
      return executarOperacao(op, args, ctx, diario, soLeitura ? "leitura" : "completo", ferramenta);
    },
  );
  diario.anotar({
    ferramenta,
    operacao: null,
    risco: null,
    ok: r.ok,
    erro: r.ok ? null : r.erro,
    ms: Date.now() - t0,
    entrada: { codigo: codigo.length > 6000 ? `${codigo.slice(0, 6000)}…` : codigo, chamadas: r.chamadas },
    alvo: null,
  });
  const corpo = r.ok
    ? { resultado: r.valor, ...(r.registros.length ? { console: r.registros } : {}) }
    : { erro: r.erro, ...(r.registros.length ? { console: r.registros } : {}) };
  return { texto: caber(JSON.stringify(corpo)), erro: !r.ok };
}

// ---------------------------------------------------------------- ferramentas do modo clássico

const nomeDaFerramenta = (op: Operacao) => op.nome.replace(".", "_");
const MARCAS = {
  leitura: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  escrita: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  perigosa: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
} as const;

function listaClassica(ctx: Contexto) {
  return [
    {
      name: "ler_guia",
      title: "Ler guia",
      description: 'Guias do site: "escrita" (regras de texto, leia antes de escrever), "blocos" (HTML do editor), "seo" (checklist) e "site" (o que existe e onde).',
      inputSchema: { type: "object", properties: { guia: { type: "string", enum: Object.keys(GUIAS) } }, required: ["guia"] },
      annotations: MARCAS.leitura,
    },
    ...visiveis(ctx, false).map((op) => ({
      name: nomeDaFerramenta(op),
      title: op.resumo.slice(0, 60),
      description: `${op.risco === "perigosa" ? "PERIGOSA: peça o sim da pessoa. " : ""}${op.resumo}${op.detalhe ? `\n${op.detalhe}` : ""}${op.retorno ? `\nDevolve: ${op.retorno}` : ""}`,
      inputSchema: jsonSchemaDe(op),
      annotations: MARCAS[op.risco],
    })),
  ];
}

// ---------------------------------------------------------------- JSON-RPC

async function tratar(msg: Msg, ctx: Contexto, diario: Diario, modo: Modo): Promise<object | null> {
  if (!msg || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") return falha(msg?.id, -32600, "Pedido inválido");
  const { id, method } = msg;
  const params = msg.params ?? {};
  const notificacao = id === undefined || id === null;

  switch (method) {
    case "initialize": {
      const pedida = String(params.protocolVersion ?? "");
      return resposta(id, {
        protocolVersion: VERSOES.includes(pedida) ? pedida : VERSOES[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "jk-aliancas", title: "JK Alianças (painel)", version: "1.0.0" },
        instructions: modo === "codigo" ? INSTRUCOES_CODIGO : INSTRUCOES_FERRAMENTAS,
      });
    }
    case "notifications/initialized":
    case "notifications/cancelled":
      return null;
    case "ping":
      return resposta(id, {});
    case "resources/list":
      return resposta(id, { resources: [] });
    case "prompts/list":
      return resposta(id, { prompts: [] });
    case "tools/list": {
      if (modo === "codigo") {
        const f = [FERRAMENTAS_CODIGO.buscar, FERRAMENTAS_CODIGO.consultar];
        if (ctx.acesso.escopo === "completo") f.push(FERRAMENTAS_CODIGO.executar);
        return resposta(id, { tools: f });
      }
      return resposta(id, { tools: listaClassica(ctx) });
    }
    case "tools/call": {
      const nome = String(params.name ?? "");
      const args = (params.arguments ?? {}) as Record<string, unknown>;
      try {
        if (modo === "codigo") {
          if (nome === "buscar") return resposta(id, { content: [{ type: "text", text: buscar(args, ctx) }] });
          if (nome === "consultar" || nome === "executar") {
            if (nome === "executar" && ctx.acesso.escopo !== "completo") {
              throw new ErroDoConector("Este acesso é só de leitura. Use consultar.", 403);
            }
            const r = await rodar(args.codigo, ctx, diario, nome === "consultar");
            return resposta(id, { content: [{ type: "text", text: r.texto }], ...(r.erro ? { isError: true } : {}) });
          }
          throw new ErroDoConector(`Ferramenta desconhecida: ${nome}. Existem buscar, consultar e executar.`);
        }
        if (nome === "ler_guia") {
          const g = GUIAS[String(args.guia ?? "")];
          return resposta(id, { content: [{ type: "text", text: g ?? `Guias: ${Object.keys(GUIAS).join(", ")}.` }] });
        }
        const op = visiveis(ctx, false).find((o) => nomeDaFerramenta(o) === nome);
        if (!op) throw new ErroDoConector(`Ferramenta desconhecida ou fora do alcance deste acesso: ${nome}.`);
        const r = await executarOperacao(op, args, ctx, diario, "completo", nome);
        return resposta(id, {
          content: [{ type: "text", text: caber(JSON.stringify(r ?? null)) }],
          ...(r && typeof r === "object" && !Array.isArray(r) ? { structuredContent: r } : {}),
        });
      } catch (e) {
        const texto = e instanceof ErroDoConector ? e.message : "Erro inesperado no painel. Tente de novo.";
        if (!(e instanceof ErroDoConector)) console.error("[conector] tools/call", nome, e);
        if (modo === "codigo" && nome === "buscar") {
          diario.anotar({ ferramenta: nome, operacao: null, risco: null, ok: false, erro: texto, ms: 0, entrada: resumirEntrada(args), alvo: null });
        }
        return resposta(id, { content: [{ type: "text", text: texto }], isError: true });
      }
    }
    default:
      return notificacao ? null : falha(id, -32601, `Método não suportado: ${method}`);
  }
}

/** A rota inteira: CORS, chave, corpo, lote e registro. */
export async function atender(req: Request, modo: Modo): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") {
    return json(falha(null, -32000, "Este conector não abre fluxo contínuo: use POST."), 405, { allow: "POST, OPTIONS" });
  }

  const temChave = /^Bearer\s+\S/i.test(req.headers.get("authorization") || "");
  const quem = await identificar(req);
  if ("erro" in quem) {
    return json(falha(null, -32001, quem.erro), quem.status, { "www-authenticate": desafio(req, temChave) });
  }

  let corpo: unknown;
  try {
    const texto = await req.text();
    if (texto.length > 1_000_000) return json(falha(null, -32600, "Pedido grande demais."), 413);
    corpo = JSON.parse(texto);
  } catch {
    return json(falha(null, -32700, "JSON inválido"), 400);
  }

  const ctx: Contexto = { ...quem, db: createAdminClient(), base: enderecos(req).base, req };
  const diario = new Diario(ctx);
  after(() => diario.gravar());

  if (Array.isArray(corpo)) {
    if (corpo.length > 20) return json(falha(null, -32600, "Lote grande demais."), 400);
    const r = (await Promise.all(corpo.map((m) => tratar(m as Msg, ctx, diario, modo)))).filter(Boolean);
    return r.length ? json(r) : new Response(null, { status: 202, headers: CORS });
  }
  const r = await tratar(corpo as Msg, ctx, diario, modo);
  return r ? json(r) : new Response(null, { status: 202, headers: CORS });
}
