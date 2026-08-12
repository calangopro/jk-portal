/**
 * Fatos institucionais da JK Alianças.
 *
 * Tudo aqui saiu de jkaliancas.com.br/sobre-nos e de jkaliancas.com.br/lojas-fisicas,
 * consultados em 12/08/2026. Cada item carrega a própria origem porque a regra
 * do projeto é dura: afirmação institucional sem fonte não entra no ar.
 *
 * Se a JK mudar o texto do site, o certo é conferir aqui antes de repetir.
 */

export const FONTE_SOBRE = "https://www.jkaliancas.com.br/sobre-nos";
export const FONTE_LOJAS = "https://www.jkaliancas.com.br/lojas-fisicas";
export const CONFERIDO_EM = "2026-08-12";

export const INSTITUCIONAL = {
  /** "A história da JK Alianças começou em 8 de novembro de 2003." */
  fundadaEm: "2003-11-08",
  fundadaEmTexto: "8 de novembro de 2003",
  /** Contagem de unidades físicas declarada pela própria marca. */
  lojasFisicas: 10,
  fonte: FONTE_SOBRE,
} as const;

/** Anos completos de mercado, contados a partir da data de fundação. */
export function anosDeMercado(referencia = new Date()): number {
  const inicio = new Date(INSTITUCIONAL.fundadaEm);
  let anos = referencia.getFullYear() - inicio.getFullYear();
  const aniversarioAindaVem =
    referencia.getMonth() < inicio.getMonth() ||
    (referencia.getMonth() === inicio.getMonth() &&
      referencia.getDate() < inicio.getDate());
  if (aniversarioAindaVem) anos -= 1;
  return anos;
}

/**
 * Provas que aparecem na página de cada loja.
 *
 * São afirmações da própria marca, não medições nossas, e por isso o rodapé do
 * bloco cita de onde vieram.
 */
export const PROVAS_DA_MARCA = [
  {
    titulo: "Fábrica própria",
    texto:
      "As alianças são produzidas e personalizadas pela própria JK, sem depender de terceiros para ajuste e gravação.",
  },
  {
    titulo: "Garantia vitalícia do teor",
    texto:
      "A marca garante por tempo indeterminado o teor dos materiais usados na peça.",
  },
  {
    titulo: "Atendimento presencial",
    texto:
      "Aro de prova, ajuste no dedo e conversa com quem entende, antes de fechar a compra.",
  },
] as const;
