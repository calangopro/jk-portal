import { PainelDeVendas } from "@/app/admin/(painel)/vendas/PainelDeVendas";
import type { Dia, Hora, PedidoRecente, ResumoDeVendas } from "@/lib/vendas/dados";
import type { Demo } from "../tipos";

/** Dias 1 a 19 de novembro, com valores redondos inventados. */
const pagosPorDia = [3, 2, 4, 3, 5, 2, 1, 4, 3, 5, 4, 3, 6, 2, 3, 4, 5, 3, 4];
const dias: Dia[] = pagosPorDia.map((pagos, i) => ({
  dia: `2026-11-${String(i + 1).padStart(2, "0")}`,
  pagos,
  valor_pago: pagos * 1500,
  aguardando: i % 4 === 0 ? 1 : 0,
  valor_aguardando: i % 4 === 0 ? 1500 : 0,
  cancelados: i % 3 === 0 ? 1 : 0,
  valor_cancelado: i % 3 === 0 ? 1500 : 0,
}));
const horas: Hora[] = [9, 10, 11, 12, 14, 15, 16, 19, 20, 21].map((hora, i) => ({ hora, pagos: [2, 4, 6, 5, 4, 7, 5, 6, 9, 4][i], valor: [2, 4, 6, 5, 4, 7, 5, 6, 9, 4][i] * 1500 }));
const totalPagos = pagosPorDia.reduce((s, n) => s + n, 0);

const pedido = (n: number, cliente: string, itens: string, total: number, situacao: PedidoRecente["situacao"], pagamento: string, origem: string, dia: string): PedidoRecente => ({
  pedido: n, feito_em: `${dia}T15:00:00Z`, cliente, cidade: "Cidade Exemplo", uf: "SP", total,
  status: situacao === "pago" ? "A ENVIAR" : situacao === "aguardando" ? "AGUARDANDO PAGAMENTO" : "CANCELADO",
  situacao, origem, pagamento, itens,
});

const resumo: ResumoDeVendas = {
  totais: {
    pagos: totalPagos, valor_pago: totalPagos * 1500, aguardando: 5, valor_aguardando: 7500, cancelados: 7, valor_cancelado: 10500,
    frete: 0, desconto: 0, clientes: totalPagos - 4, com_itens: totalPagos,
  },
  por_dia: dias,
  por_hora: horas,
  por_origem: [
    { origem: "Instagram", pagos: 30, valor: 45000, criados: 40 },
    { origem: "Google Ads", pagos: 20, valor: 30000, criados: 26 },
    { origem: "Sem etiqueta", pagos: 20, valor: 30000, criados: 26 },
  ] as ResumoDeVendas["por_origem"],
  por_pagamento: [
    { tipo: "Pix", pagos: 40, valor: 60000, criados: 46, cancelados: 6 },
    { tipo: "Cartão de crédito", pagos: 30, valor: 45000, criados: 50, cancelados: 20 },
  ],
  produtos: [
    { produto_tray_id: "1", nome: "Par de alianças de ouro 18k", quantidade: 20, valor: 60000, pedidos: 20, url: null, imagem: null },
    { produto_tray_id: "2", nome: "Par de alianças de prata", quantidade: 30, valor: 30000, pedidos: 30, url: null, imagem: null },
    { produto_tray_id: "3", nome: "Anel solitário", quantidade: 15, valor: 15000, pedidos: 15, url: null, imagem: null },
  ],
  pedidos: [
    pedido(11001, "Cliente Exemplo Um", "Par de alianças de ouro 18k", 3000, "pago", "Pix", "Instagram", "2026-11-19"),
    pedido(11003, "Cliente Exemplo Dois", "Par de alianças de prata", 1500, "pago", "Cartão de crédito", "Google Ads", "2026-11-19"),
    pedido(10997, "Cliente Exemplo Três", "Anel solitário", 1200, "aguardando", "Pix", "Sem etiqueta", "2026-11-18"),
    pedido(10993, "Cliente Exemplo Quatro", "Par de alianças de ouro 18k", 3000, "cancelado", "Cartão de crédito", "Instagram", "2026-11-18"),
  ],
};

const anterior: ResumoDeVendas = { ...resumo, totais: { ...resumo.totais, pagos: 60, valor_pago: 90000 } };

const demo: Demo = {
  caminho: "/admin/vendas",
  desenho: () => (
    <PainelDeVendas
      chave="mes"
      hoje="2026-11-19"
      topo={resumo}
      resumo={resumo}
      anterior={anterior}
      ultima={{ quando: new Date().toISOString(), ok: true, erro: null, fonte: "api" }}
      porFora={{ vendas: 6, valor: 9000, a_conferir: 0, por_vendedor: [], por_dia: [], por_forma: [], ultimas: [] }}
    />
  ),
};
export default demo;
