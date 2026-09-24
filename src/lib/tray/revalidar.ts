import "server-only";
import { revalidatePath, revalidateTag } from "next/cache";

/**
 * Tag do cache que guarda linha de produto fora de uma página, hoje o da rota
 * `/api/produtos/largura`. Revalidar a página não alcança esse cache.
 */
export const TAG_DE_PRECOS = "precos";

/**
 * Refaz tudo o que mostra preço: home, guias, ferramentas e a vitrine da rota
 * de largura.
 *
 * É a árvore inteira de uma vez, e não página por página, porque o preço
 * aparece em lugares demais para listar à mão (home, fim de cada guia, card no
 * corpo do texto, simulador), e lista à mão é justamente o tipo de coisa que
 * esquece a página nova. O site é pequeno, e página revalidada só é refeita
 * na próxima visita, então o custo é de algumas renderizações.
 *
 * Só funciona dentro do Next (rota ou server action). Por isso mora aqui, e
 * não dentro de `sincronizarCatalogo`, que só diz SE precisa.
 */
export function revalidarPrecos(): void {
  revalidatePath("/", "layout");
  revalidateTag(TAG_DE_PRECOS);
}
