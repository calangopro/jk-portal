import "server-only";
import { ehAdmin } from "@/lib/auth/acessos";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { ErroDoConector, type Contexto, type Operacao, type Risco } from "./tipos";

/**
 * A ÚNICA porta por onde uma operação roda, nos dois modos (código e
 * ferramentas). Aqui moram as travas que valem para todas:
 *
 * 1. escopo do acesso: acesso "só leitura" não roda nada que escreve;
 * 2. modo de leitura: o `consultar` não roda nada que escreve, mesmo com acesso completo;
 * 3. papel: operação de administrador pede perfil administrador;
 * 4. entrada validada pelo mesmo zod que gera a documentação;
 * 5. registro de tudo em `conector_registro`, deu certo ou não.
 */

export type Registro = {
  ferramenta: string;
  operacao: string | null;
  risco: Risco | null;
  ok: boolean;
  erro: string | null;
  ms: number;
  entrada: unknown;
  alvo: string | null;
};

/** Junta as linhas de um pedido e grava de uma vez no fim, sem segurar a resposta. */
export class Diario {
  private linhas: Registro[] = [];
  constructor(private ctx: Pick<Contexto, "quem" | "acesso">) {}
  anotar(r: Registro) {
    this.linhas.push(r);
  }
  async gravar() {
    if (!this.linhas.length) return;
    const linhas = this.linhas.splice(0).map((r) => ({
      chave_id: this.ctx.acesso.id,
      profile_id: this.ctx.quem.id,
      ferramenta: r.ferramenta,
      operacao: r.operacao,
      risco: r.risco,
      ok: r.ok,
      erro: r.erro?.slice(0, 500) ?? null,
      ms: r.ms,
      entrada: r.entrada as object,
      alvo: r.alvo?.slice(0, 200) ?? null,
    }));
    try {
      await createAdminClient().from("conector_registro").insert(linhas);
    } catch (e) {
      console.error("[conector] não gravei o registro", e);
    }
  }
}

/**
 * Resumo da entrada para o registro: campo longo vira o tamanho, para o
 * histórico mostrar o que foi pedido sem guardar o corpo inteiro de um artigo.
 */
export function resumirEntrada(v: unknown, fundo = 0): unknown {
  if (typeof v === "string") return v.length > 300 ? `[texto de ${v.length} caracteres]` : v;
  if (Array.isArray(v)) {
    if (fundo > 2) return `[lista de ${v.length}]`;
    return v.slice(0, 10).map((x) => resumirEntrada(x, fundo + 1));
  }
  if (v && typeof v === "object") {
    if (fundo > 2) return "[objeto]";
    return Object.fromEntries(Object.entries(v).slice(0, 30).map(([k, x]) => [k, resumirEntrada(x, fundo + 1)]));
  }
  return v;
}

/** O alvo de uma operação, para a tela do histórico: id, slug ou caminho. */
function alvoDe(args: unknown): string | null {
  if (!args || typeof args !== "object") return null;
  const a = args as Record<string, unknown>;
  for (const k of ["id", "slug", "conteudo_id", "caminho", "path", "consulta"]) {
    if (typeof a[k] === "string" && a[k]) return a[k] as string;
  }
  return null;
}

/** Mensagem legível de um erro de validação do zod, campo por campo. */
function mensagemDoZod(e: z.ZodError): string {
  return e.issues
    .slice(0, 8)
    .map((i) => `${i.path.length ? i.path.join(".") : "entrada"}: ${i.message}`)
    .join("; ");
}

export type ModoDeExecucao = "leitura" | "completo";

export async function executarOperacao(
  op: Operacao,
  bruto: unknown,
  ctx: Contexto,
  diario: Diario,
  modo: ModoDeExecucao,
  ferramenta: string,
): Promise<unknown> {
  const t0 = Date.now();
  const anotar = (ok: boolean, erro: string | null, args: unknown) =>
    diario.anotar({
      ferramenta,
      operacao: op.nome,
      risco: op.risco,
      ok,
      erro,
      ms: Date.now() - t0,
      entrada: resumirEntrada(args),
      alvo: alvoDe(args),
    });

  try {
    if (op.risco !== "leitura" && ctx.acesso.escopo === "leitura") {
      throw new ErroDoConector(
        `${op.nome} muda o site, e este acesso é só de leitura. Para escrever, conecte de novo escolhendo "Completo" ou use uma chave completa.`,
        403,
      );
    }
    if (op.risco !== "leitura" && modo === "leitura") {
      throw new ErroDoConector(`${op.nome} muda o site: rode pela ferramenta "executar", não pela "consultar".`, 403);
    }
    if (op.soAdmin && !ehAdmin(ctx.quem.papel)) {
      throw new ErroDoConector(`${op.nome} é só para administrador, e o seu perfil é ${ctx.quem.papel}.`, 403);
    }

    const lido = op.entrada.safeParse(bruto ?? {});
    if (!lido.success) throw new ErroDoConector(`Entrada inválida em ${op.nome}. ${mensagemDoZod(lido.error)}`);

    const r = await op.executar(lido.data, ctx);
    anotar(true, null, lido.data);
    return r;
  } catch (e) {
    const msg =
      e instanceof ErroDoConector
        ? e.message
        : `Erro inesperado em ${op.nome}. Tente de novo; se continuar, avise quem cuida do site.`;
    if (!(e instanceof ErroDoConector)) console.error("[conector]", op.nome, e);
    anotar(false, e instanceof ErroDoConector ? msg : `${msg} (${e instanceof Error ? e.message : String(e)})`.slice(0, 500), bruto);
    throw new ErroDoConector(msg, e instanceof ErroDoConector ? e.status : 500);
  }
}
