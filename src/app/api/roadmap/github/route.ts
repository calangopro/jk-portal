import { revalidatePath } from "next/cache";
import type { JsonWebKey } from "node:crypto";
import { comentarioDoPr, eventoDoGitHub, type RespostaDoGitHub } from "@/lib/roadmap/github";
import { CHAVES_DO_GITHUB, conferirClaims, verificarToken } from "@/lib/roadmap/oidc";
import { ENDERECO_DO_ROADMAP } from "@/lib/roadmap/roadmap";
import { absoluteUrl } from "@/lib/seo/site";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * O GitHub contando ao Roadmap o que mudou num ramo ou num pedido de revisão.
 *
 * Quem chama é o workflow `.github/workflows/roadmap.yml`, com o token OIDC
 * que o próprio GitHub assina a cada execução. Aqui se confere a assinatura e
 * o que o token diz (repositório, workflow, validade, público), monta-se o
 * evento (`lib/roadmap/github.ts`) e o banco decide o que fazer com o cartão
 * (`roadmap_github`, 0143). A resposta traz o comentário que o workflow
 * escreve no pedido de revisão.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

type Jwk = JsonWebKey & { kid?: string };
let chaves: { lidas: number; lista: Jwk[] } | null = null;

/** As chaves públicas do GitHub, guardadas por uma hora. Chave nova (`kid` desconhecido) faz ler de novo. */
async function chavesDoGitHub(forcar = false): Promise<Jwk[]> {
  if (!forcar && chaves && Date.now() - chaves.lidas < 3_600_000) return chaves.lista;
  const r = await fetch(CHAVES_DO_GITHUB, { cache: "no-store" });
  if (!r.ok) throw new Error(`JWKS do GitHub respondeu ${r.status}`);
  const corpo = (await r.json()) as { keys?: Jwk[] };
  chaves = { lidas: Date.now(), lista: Array.isArray(corpo.keys) ? corpo.keys : [] };
  return chaves.lista;
}

const resposta = (corpo: object, status = 200) => Response.json(corpo, { status, headers: { "cache-control": "no-store" } });

export async function POST(req: Request) {
  const m = /^Bearer\s+(\S+)$/i.exec(req.headers.get("authorization") ?? "");
  if (!m) return resposta({ ok: false, motivo: "sem_token" }, 401);

  let claims;
  try {
    claims = verificarToken(m[1], await chavesDoGitHub()) ?? verificarToken(m[1], await chavesDoGitHub(true));
  } catch (e) {
    console.error("[roadmap/github] chaves do GitHub:", e);
    return resposta({ ok: false, motivo: "chaves" }, 503);
  }
  if (!claims) return resposta({ ok: false, motivo: "assinatura" }, 401);
  const conferido = conferirClaims(claims, Math.floor(Date.now() / 1000));
  if (!conferido.ok) return resposta({ ok: false, motivo: conferido.motivo }, 403);

  const bruto = await req.text();
  if (bruto.length > 300_000) return resposta({ ok: false, motivo: "grande" }, 413);
  let corpo: unknown;
  try {
    corpo = JSON.parse(bruto || "{}");
  } catch {
    return resposta({ ok: false, motivo: "json" }, 400);
  }
  const evento = eventoDoGitHub(claims, corpo);
  if (!evento) return resposta({ ok: true, ignorado: "evento" });

  const { data, error } = await createAdminClient().rpc("roadmap_github", { p: evento });
  if (error) {
    console.error("[roadmap/github] roadmap_github:", error.message);
    return resposta({ ok: false, motivo: "banco" }, 500);
  }
  const r = (data ?? {}) as RespostaDoGitHub;
  if (r.ok) revalidatePath(ENDERECO_DO_ROADMAP);
  return resposta({ ...r, ...comentarioDoPr(r, evento, absoluteUrl(ENDERECO_DO_ROADMAP)) });
}
