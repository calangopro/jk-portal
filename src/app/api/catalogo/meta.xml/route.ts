import { responderArquivo } from "@/lib/catalogo/servir";

/**
 * O arquivo do catálogo do Meta (Commerce Manager, catálogo "Products for JK
 * Alianças"), montado pelo painel no lugar do da Tray. Público, como o da
 * Tray: o Meta busca sem login. Liga em 01/12/2026, trocando o endereço na
 * fonte de dados (`docs/catalogo-pelo-painel.md`).
 */

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export function GET() {
  return responderArquivo("meta");
}
