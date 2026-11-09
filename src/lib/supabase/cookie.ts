import { BASE_PATH } from "@/lib/seo/base-path";

/**
 * Onde o cookie de sessão do Supabase fica guardado: só em /guias.
 *
 * O domínio é dividido com a loja da Tray, e a "Central do Cliente" dela
 * (/my-account) é servida por um bucket da Amazon que recusa pedidos com mais
 * de 8 KB de cabeçalho. Com o cookie no caminho padrão ("/"), o login do painel
 * (cerca de 2,7 KB) ia junto em toda página da loja e derrubava a Minha Conta
 * de quem usa o painel, com o erro RequestHeaderSectionTooLarge.
 *
 * Todo o portal vive sob o basePath, então nada aqui perde a sessão.
 */
export const OPCOES_DO_COOKIE = { path: BASE_PATH } as const;
