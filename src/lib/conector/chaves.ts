import "server-only";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AppRole } from "@/lib/auth/session";
import { aleatorio, sha256 } from "./cripto";
import type { Acesso, Escopo, QuemUsa } from "./tipos";

/**
 * As chaves do conector. Toda chave começa com "jk_" e só o sha256 dela fica
 * no banco. São dois tipos na mesma tabela:
 *
 * - manual: criada em /admin/conector, para colar no Claude Code. Não vence
 *   sozinha; desliga-se pela tela.
 * - oauth: nasce do login pelo app do Claude, vale uma hora e gira sozinha
 *   pela renovação (`oauth.ts`).
 *
 * A pessoa é relida a cada pedido: perfil desativado perde o acesso na hora,
 * sem esperar a chave vencer.
 */

export const PREFIXO_CHAVE = "jk_";

export const novaChave = () => `${PREFIXO_CHAVE}${aleatorio(40)}`;

export type Identidade = { quem: QuemUsa; acesso: Acesso };

export type FalhaDeAcesso = { erro: string; status: 401 | 403 };

/** Lê o "Authorization: Bearer jk_..." e devolve quem é, ou por que não entrou. */
export async function identificar(req: Request): Promise<Identidade | FalhaDeAcesso> {
  const cab = req.headers.get("authorization") || "";
  const m = /^Bearer\s+(\S+)$/i.exec(cab.trim());
  if (!m) return { erro: "Falta a chave. Conecte pelo login do app do Claude ou use uma chave criada em /admin/conector.", status: 401 };
  const chave = m[1];
  if (!chave.startsWith(PREFIXO_CHAVE) || chave.length < 20 || chave.length > 100) {
    return { erro: "Chave em formato desconhecido.", status: 401 };
  }

  const db = createAdminClient();
  const { data: linha } = await db
    .from("conector_chaves")
    .select("id, nome, escopo, oauth_codigo, expira_em, revogada_em, profile_id, ultimo_uso_em")
    .eq("hash", sha256(chave))
    .maybeSingle();

  if (!linha || linha.revogada_em) return { erro: "Esta chave não vale mais. Conecte de novo.", status: 401 };
  if (linha.expira_em && new Date(linha.expira_em).getTime() <= Date.now()) {
    return { erro: "A chave venceu. O app renova sozinho; se não renovar, conecte de novo.", status: 401 };
  }

  const { data: perfil } = await db
    .from("profiles")
    .select("id, email, full_name, role, is_active")
    .eq("id", linha.profile_id)
    .maybeSingle();
  if (!perfil || !perfil.is_active) {
    return { erro: "A pessoa dona desta chave não está mais ativa no painel.", status: 403 };
  }

  // Marca o último uso depois de responder (no máximo uma vez por minuto). `after`
  // e não promessa solta: na Vercel, o que fica pendente quando a resposta sai
  // pode ser cortado.
  const ultimo = linha.ultimo_uso_em ? new Date(linha.ultimo_uso_em).getTime() : 0;
  if (Date.now() - ultimo > 60_000) {
    after(async () => {
      await db.from("conector_chaves").update({ ultimo_uso_em: new Date().toISOString() }).eq("id", linha.id);
    });
  }

  return {
    quem: {
      id: perfil.id,
      email: perfil.email,
      nome: perfil.full_name,
      papel: perfil.role as AppRole,
    },
    acesso: {
      id: linha.id,
      nome: linha.nome,
      escopo: (linha.escopo as Escopo) ?? "completo",
      via: linha.oauth_codigo ? "oauth" : "manual",
    },
  };
}

/** Cria uma chave manual. Devolve a chave inteira UMA vez; depois só o começo. */
export async function criarChaveManual(dados: {
  nome: string;
  escopo: Escopo;
  profileId: string;
}): Promise<{ id: string; chave: string }> {
  const chave = novaChave();
  const db = createAdminClient();
  const { data, error } = await db
    .from("conector_chaves")
    .insert({
      nome: dados.nome,
      escopo: dados.escopo,
      profile_id: dados.profileId,
      prefixo: chave.slice(0, 9),
      hash: sha256(chave),
      cliente: "manual",
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Não deu para criar a chave.");
  return { id: data.id, chave };
}

export async function revogarChave(id: string, porQuem: string): Promise<void> {
  const db = createAdminClient();
  await db
    .from("conector_chaves")
    .update({ revogada_em: new Date().toISOString(), revogada_por: porQuem })
    .eq("id", id)
    .is("revogada_em", null);
}
