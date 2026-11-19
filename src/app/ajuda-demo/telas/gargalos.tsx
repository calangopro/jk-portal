import { TelaDeGargalos } from "@/app/admin/(painel)/gargalos/Tela";
import type { GargalosDaTela } from "@/lib/painel/gargalos-dados";
import type { Demo } from "../tipos";

/** Gargalos com números redondos e inventados. */
const dados: GargalosDaTela = {
  de: "2026-10-21",
  ate: "2026-11-19",
  totais: { pedidos: 200, pagos: 100, cancelados: 80, aguardando: 20, valor_pago: 150000, valor_cancelado: 120000, clientes: 180, clientes_que_pagaram: 95 },
  faixas: [
    { faixa: 1, pedidos: 40, pagos: 28, cancelados: 8, valor_pago: 6000, valor_cancelado: 1600 },
    { faixa: 2, pedidos: 50, pagos: 30, cancelados: 15, valor_pago: 12000, valor_cancelado: 6000 },
    { faixa: 3, pedidos: 50, pagos: 25, cancelados: 20, valor_pago: 16000, valor_cancelado: 14000 },
    { faixa: 4, pedidos: 40, pagos: 15, cancelados: 20, valor_pago: 20000, valor_cancelado: 24000 },
    { faixa: 5, pedidos: 20, pagos: 2, cancelados: 17, valor_pago: 4000, valor_cancelado: 40000 },
  ],
  meios: [
    { nome: "Pix", pedidos: 80, pagos: 60, cancelados: 15, valor_cancelado: 20000 },
    { nome: "Cartão", pedidos: 100, pagos: 40, cancelados: 55, valor_cancelado: 90000 },
    { nome: "Boleto", pedidos: 20, pagos: 0, cancelados: 10, valor_cancelado: 10000 },
  ],
  repetidos: { pedidos_a_mais: 20, clientes: 15 },
  site: { funil: { tudo: { entraram: 10000, viramProduto: 5000, carrinho: 800, pagamento: 400, pedido: 200 }, celular: { entraram: 7000, viramProduto: 3500, carrinho: 400, pagamento: 200, pedido: 100 }, computador: { entraram: 3000, viramProduto: 1500, carrinho: 400, pagamento: 200, pedido: 100 } } },
  plataformas: [
    { plataforma: "meta", nome: "Meta", gasto: 10000, gastoComImposto: 11000, comprasInformadas: 50, valorInformado: 60000, criados: 90, pagos: 30, cancelados: 50, valorPago: 40000, valorCancelado: 70000, volta: 3.6, custoPorVendaPaga: 366, foraDeVenda: 0.2 },
    { plataforma: "google", nome: "Google Ads", gasto: 5000, gastoComImposto: 5000, comprasInformadas: 20, valorInformado: 30000, criados: 40, pagos: 20, cancelados: 15, valorPago: 25000, valorCancelado: 20000, volta: 5, custoPorVendaPaga: 250, foraDeVenda: null },
  ],
  margem: 0.3,
  empate: 3.33,
  gargalos: [
    { chave: "pagamento-alto", sistema: "Pagamento", situacao: "grave", titulo: "Pedido acima de R$ 1.500 quase nunca é pago", texto: "Dos 20 pedidos nessa faixa, 17 foram cancelados. É dinheiro que chegou até o fim do caminho e travou no pagamento.", peso: 40000, link: { href: "/admin/recuperacao", rotulo: "Abrir a fila de recuperação" } },
    { chave: "boleto", sistema: "Pagamento", situacao: "medio", titulo: "Boleto emitido e nenhum pago", texto: "Foram 20 boletos neste período e nenhum virou venda.", peso: 10000 },
    { chave: "meta-volta", sistema: "Meta", situacao: "atencao", titulo: "O Meta diz que vendeu mais do que a loja recebeu", texto: "O Meta informa R$ 60.000 e a loja recebeu R$ 40.000 pagos com a etiqueta dele.", peso: 20000, link: { href: "/admin/trafego/campanhas", rotulo: "Ver as campanhas" } },
    { chave: "pix", sistema: "Pagamento", situacao: "ok", titulo: "O Pix converte bem", texto: "", peso: 0 },
  ],
  vencedores: [{ tipo: "crescer", nivel: "anuncio", objetivo: "venda", nome: "Anúncio Exemplo Um", dentroDe: "Campanha Exemplo", texto: "Custa 40% menos por compra que a média da conta.", peso: 5000, plataforma: "Meta" }],
  pessimos: [{ tipo: "rever", nivel: "anuncio", objetivo: "venda", nome: "Anúncio Exemplo Dois", dentroDe: "Campanha Exemplo", texto: "Gastou R$ 2.000 e não trouxe nenhuma compra.", peso: 2000, plataforma: "Meta" }],
};

const demo: Demo = {
  caminho: "/admin/gargalos",
  desenho: () => <TelaDeGargalos {...dados} chave="30d" />,
};
export default demo;
