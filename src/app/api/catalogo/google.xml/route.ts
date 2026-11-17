import { responderArquivo } from "@/lib/catalogo/servir";

/**
 * O arquivo do catálogo para o Google Merchant. Os mesmos produtos e campos do
 * arquivo do Meta, com `parceiro=1517` no link, que é como a Tray e o coletor
 * de origem reconhecem a venda que veio do Google Shopping
 * (`docs/catalogo-pelo-painel.md`).
 */

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export function GET() {
  return responderArquivo("google");
}
