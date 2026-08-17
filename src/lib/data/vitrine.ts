/**
 * O produto como a tela mostra, e o preço como a tela escreve.
 *
 * Mora separado de `data/produtos.ts` porque o cartão de produto agora também é
 * desenhado no NAVEGADOR: a vitrine da ferramenta de largura acompanha o mm que
 * a pessoa escolhe. `data/produtos.ts` importa o cliente do Supabase, e puxar
 * esse arquivo para dentro de um componente cliente carregaria a biblioteca
 * inteira do banco no pacote da página, sem nenhum uso.
 *
 * Só tipo e formatação de texto vivem aqui, ou seja, nada que toque no banco.
 */

export type ProdutoDaVitrine = {
  id: string;
  nome: string;
  imagem: string | null;
  preco: number | null;
  precoPromocional: number | null;
  href: string;
};

/** "R$ 1.234,56". Devolve nulo quando não há preço real, nunca "sob consulta". */
export function precoLegivel(valor: number | null): string | null {
  if (valor == null || !Number.isFinite(valor) || valor <= 0) return null;
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
