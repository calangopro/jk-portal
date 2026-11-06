import type { z } from "zod";
import type { esquemaDoLayout } from "./tipos";

const TRAVESSAO = /[—–]/;

/**
 * A conferência do layout da home antes de gravar: travessão em texto de bloco
 * e a abertura com busca visível (é o H1 da home). Mora aqui porque a tela
 * /admin/home e o conector do Claude gravam pelo mesmo caminho.
 */
export function conferirLayout(layout: z.infer<typeof esquemaDoLayout>): string | null {
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
    return (
      `Tem travessão em: ${[...new Set(comTravessao)].join(", ")}. Use vírgula, dois pontos ou parênteses.`
    );
  }

  // A abertura com busca é a porta de entrada da home. Sem ela, a página perde
  // o H1 e o campo de busca de uma vez.
  const heroVisivel = layout.blocos.some((b) => b.tipo === "hero-busca" && b.visivel);
  if (!heroVisivel) {
    return "A abertura com busca não pode ficar oculta: é o H1 e a busca da home.";
  }

  return null;
}
