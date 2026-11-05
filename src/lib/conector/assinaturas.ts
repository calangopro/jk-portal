import "server-only";
import { z } from "zod";
import type { Operacao } from "./tipos";

/**
 * Transforma o zod de cada operação em duas coisas:
 *
 * - JSON Schema, que é o que a lista de ferramentas do MCP pede;
 * - uma assinatura em TypeScript, que é o que o Claude lê no modo código.
 *
 * TypeScript gasta muito menos token que JSON Schema para dizer a mesma coisa,
 * e é a língua em que o modelo escreve o código depois. É o mesmo raciocínio
 * do Code Mode da Cloudflare.
 */

type Esquema = {
  type?: string | string[];
  properties?: Record<string, Esquema>;
  required?: string[];
  items?: Esquema;
  enum?: unknown[];
  const?: unknown;
  anyOf?: Esquema[];
  oneOf?: Esquema[];
  allOf?: Esquema[];
  additionalProperties?: Esquema | boolean;
  description?: string;
  default?: unknown;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  format?: string;
};

export function jsonSchemaDe(op: Operacao): Record<string, unknown> {
  const s = z.toJSONSchema(op.entrada, { io: "input", unrepresentable: "any" }) as Record<string, unknown>;
  delete s.$schema;
  if (s.type !== "object") return { type: "object", properties: {}, ...s };
  return s;
}

const nomeSeguro = (k: string) => (/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k));

function limites(s: Esquema): string {
  const p: string[] = [];
  if (s.minLength !== undefined || s.maxLength !== undefined) p.push(`${s.minLength ?? 0} a ${s.maxLength ?? "∞"} caracteres`);
  if (s.minimum !== undefined || s.maximum !== undefined) p.push(`de ${s.minimum ?? "-∞"} a ${s.maximum ?? "∞"}`);
  if (s.format === "uuid") p.push("uuid");
  if (s.default !== undefined) p.push(`padrão ${JSON.stringify(s.default)}`);
  return p.join(", ");
}

function ts(s: Esquema | undefined, recuo: string): string {
  if (!s) return "unknown";
  if (s.const !== undefined) return JSON.stringify(s.const);
  if (s.enum) return s.enum.map((v) => JSON.stringify(v)).join(" | ");
  const variantes = s.anyOf || s.oneOf;
  if (variantes) return variantes.map((v) => ts(v, recuo)).join(" | ");
  if (s.allOf) return s.allOf.map((v) => ts(v, recuo)).join(" & ");
  const tipo = Array.isArray(s.type) ? s.type : s.type ? [s.type] : [];
  if (tipo.length > 1) return tipo.map((t) => ts({ ...s, type: t }, recuo)).join(" | ");
  switch (tipo[0]) {
    case "string":
      return "string";
    case "number":
    case "integer":
      return "number";
    case "boolean":
      return "boolean";
    case "null":
      return "null";
    case "array":
      return `Array<${ts(s.items, recuo)}>`;
    case "object": {
      const props = Object.entries(s.properties ?? {});
      if (!props.length) {
        const ap = s.additionalProperties;
        return ap && typeof ap === "object" ? `Record<string, ${ts(ap, recuo)}>` : "Record<string, unknown>";
      }
      const req = new Set(s.required ?? []);
      const dentro = `${recuo}  `;
      const linhas = props.map(([k, v]) => {
        const nota = [v.description?.replace(/\.\s*$/, ""), limites(v)].filter(Boolean).join(". ");
        const comentario = nota ? `${dentro}/** ${nota.replace(/\*\//g, "* /")} */\n` : "";
        return `${comentario}${dentro}${nomeSeguro(k)}${req.has(k) ? "" : "?"}: ${ts(v, dentro)};`;
      });
      return `{\n${linhas.join("\n")}\n${recuo}}`;
    }
    default:
      return "unknown";
  }
}

/** `jk.conteudos.criar(args: {...}): Promise<...>` com o resumo em cima. */
export function assinaturaDe(op: Operacao, detalhada = true): string {
  const esquema = jsonSchemaDe(op) as Esquema;
  const temCampos = Object.keys(esquema.properties ?? {}).length > 0;
  const obrigatorio = (esquema.required ?? []).length > 0;
  const args = temCampos ? `args${obrigatorio ? "" : "?"}: ${ts(esquema, "")}` : "";
  const marca = op.risco === "leitura" ? "" : op.risco === "perigosa" ? " [PERIGOSA: peça o sim]" : " [escreve]";
  const admin = op.soAdmin ? " [só admin]" : "";
  const cabeca = [`/** ${op.resumo}${marca}${admin}`];
  if (detalhada && op.detalhe) cabeca.push(...op.detalhe.split("\n").map((l) => ` * ${l}`));
  cabeca.push(" */");
  return `${cabeca.join("\n")}\njk.${op.nome}(${args}): Promise<${op.retorno ?? "unknown"}>`;
}
