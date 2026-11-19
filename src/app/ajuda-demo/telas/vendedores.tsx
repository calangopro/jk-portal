import { TelaDeVendedores } from "@/app/admin/(painel)/vendedores/Tela";
import type { ResumoPorFora } from "@/lib/vendas/por-fora";
import type { Ranking } from "@/lib/vendas/ranking";
import type { Demo } from "../tipos";

const atual: ResumoPorFora = {
  vendas: 8,
  valor: 12000,
  a_conferir: 1,
  por_vendedor: [],
  por_dia: [],
  por_forma: [],
  ultimas: [
    { id: "v1", feita_em: "2026-11-18T14:00:00Z", dia: "2026-11-18", vendedor: "Vendedora Exemplo", valor: 1200, forma: "pix", canal: "whatsapp", cliente: "Cliente Exemplo Um", produto: null, conferir: "Mesmo telefone e valor de outra venda dos últimos 7 dias." },
  ],
};
const anterior: ResumoPorFora = { ...atual, valor: 10000, ultimas: [] };

const ranking: Ranking = {
  por_vendedor: [
    { vendedor_id: "a", vendedor: "Vendedor Exemplo", fora_vendas: 5, fora_valor: 7500, recuperadas: 1, valor_recuperado: 1500, loja_pedidos: 4, loja_valor: 6000, vendas: 9, valor: 13500 },
    { vendedor_id: "b", vendedor: "Vendedora Exemplo", fora_vendas: 3, fora_valor: 4500, recuperadas: 0, valor_recuperado: 0, loja_pedidos: 2, loja_valor: 3000, vendas: 5, valor: 7500 },
  ],
  loja: { pedidos: 6, valor: 9000 },
  sem_vendedor: { pedidos: 12, valor: 18000 },
};

const demo: Demo = {
  caminho: "/admin/vendedores",
  desenho: () => (
    <TelaDeVendedores atual={atual} anterior={anterior} ranking={ranking} chave="mes" de="2026-11-01" ate="2026-11-19" comparacao="contra o mês passado" />
  ),
};
export default demo;
