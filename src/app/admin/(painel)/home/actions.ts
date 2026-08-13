"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/session";
import { esquemaDoLayout, layoutPadraoDaHome } from "@/lib/blocos/tipos";
import { TAG_LAYOUT } from "@/lib/blocos/ler";

export type ResultadoDaHome = { ok: true } | { ok: false; erro: string };

/** Travessão é proibido em qualquer texto do projeto (REGRAS.md §1). */
const TRAVESSAO = /[—–]/;

export async function salvarHome(bruto: unknown): Promise<ResultadoDaHome> {
  const perfil = await requireStaff();

  const lido = esquemaDoLayout.safeParse(bruto);
  if (!lido.success) return { ok: false, erro: "O layout chegou num formato que não reconheço." };
  const layout = lido.data;

  // Regra absoluta do projeto, conferida no servidor. Deixar só no formulário
  // seria conselho, e conselho se contorna.
  const comTravessao: string[] = [];
  for (const bloco of layout.blocos) {
    for (const [chave, valor] of Object.entries(bloco.props)) {
      if (typeof valor === "string" && TRAVESSAO.test(valor)) comTravessao.push(`${bloco.tipo}.${chave}`);
      if (Array.isArray(valor)) {
        for (const item of valor) {
          if (typeof item === "string" && TRAVESSAO.test(item)) comTravessao.push(`${bloco.tipo}.${chave}`);
        }
      }
    }
  }
  if (comTravessao.length > 0) {
    return {
      ok: false,
      erro: `Tem travessão em: ${[...new Set(comTravessao)].join(", ")}. Use vírgula, dois pontos ou parênteses.`,
    };
  }

  // A abertura com busca é a porta de entrada da home. Sem ela, a página perde
  // o H1 e o campo de busca de uma vez.
  const heroVisivel = layout.blocos.some((b) => b.tipo === "hero-busca" && b.visivel);
  if (!heroVisivel) {
    return { ok: false, erro: "A abertura com busca não pode ficar oculta: é o H1 e a busca da home." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("site_settings").upsert(
    {
      key: "pagina:home",
      value: layout as unknown as Record<string, unknown>,
      updated_by: perfil.id,
    },
    { onConflict: "key" },
  );
  if (error) return { ok: false, erro: error.message };

  // Tag derruba o dado cacheado; caminho derruba o HTML já renderizado. Só a
  // tag deixaria o Next servir a home antiga até o ISR de uma hora expirar.
  revalidateTag(TAG_LAYOUT);
  revalidatePath("/");
  return { ok: true };
}

/** Volta a home ao layout de fábrica, sem apagar nada além do que ela mesma gravou. */
export async function restaurarHome(): Promise<ResultadoDaHome> {
  await requireStaff();
  return salvarHome(layoutPadraoDaHome());
}
