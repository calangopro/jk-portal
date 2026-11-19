import type { ReactNode } from "react";
import type { AppRole } from "@/lib/auth/acessos";

/**
 * Uma tela com dados de exemplo. Cada tela é um arquivo em `telas/<chave>.tsx`
 * com `export default` disto; a chave é o nome do arquivo do print
 * (`public/ajuda/<chave>-<n>.webp`). `caminho` é o endereço do painel que a
 * moldura acende no menu. Nomes sempre de exemplo ("Cliente Exemplo"), valores redondos.
 */
export type Demo = { caminho: string; desenho: (nivel: AppRole) => ReactNode };
