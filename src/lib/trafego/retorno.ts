/**
 * Retorno de anúncio: gasto de cada plataforma contra a venda PAGA que chegou
 * com a etiqueta dela.
 *
 * A conta é de propósito mais dura que a das plataformas: o Meta e o Google
 * contam pedido criado, e 43% dos pedidos criados na loja são cancelados
 * depois. Aqui só entra pedido pago, lido da Tray.
 *
 * Tem um limite que a tela precisa dizer: perto de metade do faturamento chega
 * sem etiqueta de origem. Venda que o anúncio trouxe e que perdeu a etiqueta no
 * caminho não aparece para a plataforma, então o retorno por plataforma é um
 * PISO, e o retorno geral (tudo que a loja vendeu sobre tudo que gastou) é o
 * TETO. A verdade fica entre os dois.
 *
 * Arquivo puro, para o teste rodar sem banco.
 */
import type { LinhaDeCanal } from "../vendas/origem.ts";

export const PLATAFORMAS = [
  { chave: "meta", nome: "Meta (Instagram e Facebook)", canal: "meta" },
  { chave: "google", nome: "Google Ads", canal: "google_ads" },
  { chave: "pinterest", nome: "Pinterest", canal: "pinterest" },
  { chave: "tiktok", nome: "TikTok", canal: "tiktok" },
  { chave: "outro", nome: "Outra", canal: null },
] as const;

export type Plataforma = (typeof PLATAFORMAS)[number]["chave"];

export const NOME_DA_PLATAFORMA = Object.fromEntries(PLATAFORMAS.map((p) => [p.chave, p.nome])) as Record<string, string>;

export type LinhaDeRetorno = {
  plataforma: string;
  nome: string;
  gasto: number;
  /** Venda paga que chegou com a etiqueta da plataforma. */
  faturamento: number;
  pedidos: number;
  /** Faturamento dividido pelo gasto. `null` sem gasto. */
  retorno: number | null;
  /** Gasto por pedido pago. `null` sem pedido. */
  custoPorPedido: number | null;
  /** Abaixo de 1, a plataforma gastou mais do que a venda etiquetada dela. */
  situacao: "prejuizo" | "positivo" | "sem_venda" | "sem_gasto";
};

const centavos = (n: number) => Math.round(n * 100) / 100;

export function retornoPorPlataforma(
  gastos: { plataforma: string; gasto: number }[],
  canais: LinhaDeCanal[],
): LinhaDeRetorno[] {
  const gastoDe = new Map(gastos.map((g) => [g.plataforma, Number(g.gasto)]));
  const canalDe = new Map(canais.map((c) => [c.canal as string, c]));
  const linhas: LinhaDeRetorno[] = [];

  for (const p of PLATAFORMAS) {
    const gasto = gastoDe.get(p.chave) ?? 0;
    const canal = p.canal ? canalDe.get(p.canal) : undefined;
    const faturamento = canal?.valor ?? 0;
    const pedidos = canal?.pagos ?? 0;
    if (gasto === 0 && faturamento === 0) continue;
    const retorno = gasto > 0 ? centavos(faturamento / gasto) : null;
    linhas.push({
      plataforma: p.chave,
      nome: p.nome,
      gasto: centavos(gasto),
      faturamento: centavos(faturamento),
      pedidos,
      retorno,
      custoPorPedido: gasto > 0 && pedidos > 0 ? centavos(gasto / pedidos) : null,
      situacao: gasto === 0 ? "sem_gasto" : faturamento === 0 ? "sem_venda" : retorno !== null && retorno < 1 ? "prejuizo" : "positivo",
    });
  }
  return linhas.sort((a, b) => b.gasto - a.gasto || b.faturamento - a.faturamento);
}

/**
 * Divide um valor igualmente pelos dias do intervalo, as duas pontas inclusive.
 * O centavo que sobra do arredondamento vai para o último dia, para a soma
 * bater com o que foi digitado.
 */
export function dividirPorDia(total: number, de: string, ate: string): { dia: string; gasto: number }[] {
  const dias: string[] = [];
  const fim = new Date(`${ate}T00:00:00Z`);
  for (const d = new Date(`${de}T00:00:00Z`); d <= fim; d.setUTCDate(d.getUTCDate() + 1)) dias.push(d.toISOString().slice(0, 10));
  if (dias.length === 0) return [];
  const porDia = Math.floor((total * 100) / dias.length) / 100;
  const resto = centavos(total - porDia * dias.length);
  return dias.map((dia, i) => ({ dia, gasto: i === dias.length - 1 ? centavos(porDia + resto) : porDia }));
}
