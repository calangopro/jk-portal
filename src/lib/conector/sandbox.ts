import "server-only";
import {
  newQuickJSWASMModuleFromVariant,
  shouldInterruptAfterDeadline,
  type QuickJSSyncVariant,
  type QuickJSWASMModule,
} from "quickjs-emscripten-core";

/**
 * Onde o código que o Claude escreve roda: um QuickJS compilado em WebAssembly,
 * dentro da própria função da Vercel.
 *
 * É o lugar do isolado V8 do Code Mode da Cloudflare. Lá o código roda num
 * Worker dinâmico; aqui a Vercel não oferece isso, e `node:vm` não é fronteira
 * de segurança (um `this.constructor.constructor("return process")()` chega no
 * `process.env` e leva a service_role embora). O QuickJS é outro interpretador,
 * com memória própria: lá dentro não existe `process`, `require`, `fetch`,
 * rede, disco nem variável de ambiente. A única porta para fora é a função
 * `__chamar`, e ela só conhece as operações que este acesso pode rodar, que
 * passam pelas travas de `executar.ts` como qualquer outra.
 *
 * Usa a variante "singlefile" (o WebAssembly embutido no próprio JS) para não
 * depender de o empacotamento da Vercel achar um arquivo .wasm solto.
 */

let modulo: Promise<QuickJSWASMModule> | null = null;
function quickjs() {
  if (!modulo) {
    modulo = import("@jitl/quickjs-singlefile-cjs-release-sync").then((m) =>
      newQuickJSWASMModuleFromVariant(((m as { default?: unknown }).default ?? m) as QuickJSSyncVariant),
    );
  }
  return modulo;
}

export type Limites = {
  /** Tempo total, contando a espera das operações. */
  ms: number;
  /** Quantas operações um código pode chamar. */
  chamadas: number;
  memoriaMb: number;
};

export const LIMITES_PADRAO: Limites = { ms: 40_000, chamadas: 80, memoriaMb: 64 };

export type ResultadoDoCodigo =
  | { ok: true; valor: unknown; registros: string[]; chamadas: number }
  | { ok: false; erro: string; registros: string[]; chamadas: number };

type Chamar = (nome: string, args: unknown) => Promise<unknown>;

/**
 * Roda `codigo` como corpo de uma função assíncrona. `jk` já existe lá dentro,
 * montado a partir de `nomes` ("conteudos.listar" vira `jk.conteudos.listar`).
 * O valor do `return` volta como resultado.
 */
export async function rodarCodigo(
  codigo: string,
  nomes: string[],
  chamar: Chamar,
  limites: Limites = LIMITES_PADRAO,
): Promise<ResultadoDoCodigo> {
  const QJS = await quickjs();
  const rt = QJS.newRuntime();
  rt.setMemoryLimit(limites.memoriaMb * 1024 * 1024);
  rt.setMaxStackSize(1024 * 1024);
  const prazo = Date.now() + limites.ms;
  rt.setInterruptHandler(shouldInterruptAfterDeadline(prazo));
  const vm = rt.newContext();

  const registros: string[] = [];
  let tamanhoDosRegistros = 0;
  let chamadas = 0;
  const pendentes = new Set<Promise<void>>();
  let encerrado = false;

  const bombear = () => {
    if (encerrado || !vm.alive) return;
    const r = rt.executePendingJobs();
    if (r.error) r.error.dispose();
  };

  const fnChamar = vm.newFunction("__chamar", (nomeH, argsH) => {
    const nome = vm.getString(nomeH);
    const argsTexto = vm.getString(argsH);
    const adiado = vm.newPromise();
    chamadas++;
    const trabalho = (async () => {
      if (chamadas > limites.chamadas) {
        throw new Error(`Passou de ${limites.chamadas} operações num código só. Divida em mais de um executar.`);
      }
      let args: unknown;
      try {
        args = JSON.parse(argsTexto);
      } catch {
        throw new Error(`Argumentos de ${nome} não viraram JSON.`);
      }
      return chamar(nome, args);
    })()
      .then(
        (valor) => {
          if (encerrado || !vm.alive) return;
          const s = vm.newString(JSON.stringify(valor === undefined ? null : valor));
          adiado.resolve(s);
          s.dispose();
        },
        (e: unknown) => {
          if (encerrado || !vm.alive) return;
          const er = vm.newError(e instanceof Error ? e.message : String(e));
          adiado.reject(er);
          er.dispose();
        },
      )
      .finally(() => {
        pendentes.delete(trabalho);
        bombear();
      });
    pendentes.add(trabalho);
    return adiado.handle;
  });
  vm.setProp(vm.global, "__chamar", fnChamar);
  fnChamar.dispose();

  const fnLog = vm.newFunction("__log", (h) => {
    const s = vm.getString(h);
    if (tamanhoDosRegistros < 20_000) {
      registros.push(s.slice(0, 4000));
      tamanhoDosRegistros += s.length;
    }
  });
  vm.setProp(vm.global, "__log", fnLog);
  fnLog.dispose();

  // O objeto `jk`, com uma função por operação. Nome desconhecido dá erro dizendo o que existe.
  const arvore: Record<string, string[]> = {};
  for (const n of nomes) {
    const [area, acao] = n.split(".");
    (arvore[area] ||= []).push(acao);
  }
  const prelude = `
const __fmt = (v) => typeof v === "string" ? v : (() => { try { return JSON.stringify(v); } catch { return String(v); } })();
const console = { log: (...a) => __log(a.map(__fmt).join(" ")), info: (...a) => __log(a.map(__fmt).join(" ")), warn: (...a) => __log("aviso: " + a.map(__fmt).join(" ")), error: (...a) => __log("erro: " + a.map(__fmt).join(" ")) };
const __op = (nome) => (args) => __chamar(nome, JSON.stringify(args === undefined ? {} : args)).then(JSON.parse);
const __area = (area, acoes) => new Proxy(Object.fromEntries(acoes.map((a) => [a, __op(area + "." + a)])), {
  get(alvo, k) { if (typeof k === "string" && !(k in alvo) && k !== "then") throw new Error("jk." + area + "." + k + " não existe. Em jk." + area + " há: " + acoes.join(", ") + ". Use a ferramenta buscar."); return alvo[k]; }
});
const jk = new Proxy({${Object.entries(arvore)
    .map(([area, acoes]) => `${JSON.stringify(area)}: __area(${JSON.stringify(area)}, ${JSON.stringify(acoes)})`)
    .join(",")}}, {
  get(alvo, k) { if (typeof k === "string" && !(k in alvo) && k !== "then") throw new Error("jk." + k + " não existe. Áreas: " + Object.keys(alvo).join(", ") + ". Use a ferramenta buscar."); return alvo[k]; }
});
`;

  // O código do Claude começa na linha 2 deste texto: o erro diz a linha certa descontando 1.
  const fonte = `(async () => { const __v = await (async () => {\n${codigo}\n})(); return JSON.stringify(__v === undefined ? null : __v); })()`;

  const encerrar = async () => {
    encerrado = true;
    // Espera o que já saiu para o banco terminar antes de desmontar a máquina.
    await Promise.allSettled([...pendentes]);
    if (vm.alive) vm.dispose();
    if (rt.alive) rt.dispose();
  };

  try {
    const base = vm.evalCode(prelude, "base.js");
    if (base.error) {
      base.error.dispose();
      await encerrar();
      return { ok: false, erro: "Não deu para montar o ambiente do código.", registros, chamadas };
    }
    base.value.dispose();
    const avaliado = vm.evalCode(fonte, "codigo.js");
    if (avaliado.error) {
      const erro = descreverErro(vm.dump(avaliado.error));
      avaliado.error.dispose();
      await encerrar();
      return { ok: false, erro, registros, chamadas };
    }
    const promessa = vm.resolvePromise(avaliado.value);
    avaliado.value.dispose();
    bombear();

    let relogio: ReturnType<typeof setTimeout> | undefined;
    const esgotou = new Promise<"esgotou">((r) => {
      relogio = setTimeout(() => r("esgotou"), Math.max(0, prazo - Date.now()) + 50);
    });
    const fim = await Promise.race([promessa, esgotou]);
    clearTimeout(relogio);

    if (fim === "esgotou") {
      await encerrar();
      return {
        ok: false,
        erro: `O código passou de ${Math.round(limites.ms / 1000)} segundos. Peça menos coisa por vez ou divida em mais de um executar.`,
        registros,
        chamadas,
      };
    }
    if (fim.error) {
      const erro = descreverErro(vm.dump(fim.error));
      fim.error.dispose();
      await encerrar();
      return { ok: false, erro, registros, chamadas };
    }
    const texto = vm.getString(fim.value);
    fim.value.dispose();
    await encerrar();
    let valor: unknown = null;
    try {
      valor = JSON.parse(texto);
    } catch {
      valor = texto;
    }
    return { ok: true, valor, registros, chamadas };
  } catch (e) {
    await encerrar();
    return { ok: false, erro: e instanceof Error ? e.message : String(e), registros, chamadas };
  }
}

function descreverErro(d: unknown): string {
  if (d && typeof d === "object") {
    const o = d as { name?: string; message?: string; stack?: string };
    if (o.message === "interrupted") return "O código foi interrompido por passar do tempo (laço sem fim?).";
    const m = o.stack?.match(/codigo\.js:(\d+)/);
    const linha = m ? Number(m[1]) - 1 : 0;
    return `${o.name && o.name !== "Error" ? `${o.name}: ` : ""}${o.message ?? String(d)}${linha > 0 ? ` (linha ${linha} do código)` : ""}`;
  }
  return String(d);
}
