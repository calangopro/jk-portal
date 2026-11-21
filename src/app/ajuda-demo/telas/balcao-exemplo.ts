import type { PedidoDoBalcao, VendedorDaLoja } from "@/lib/balcao/regras";

/** Pedidos de exemplo do balcão (cartão 71). Nomes de exemplo, valores redondos. */
export const VENDEDORES_DE_EXEMPLO: VendedorDaLoja[] = [
  { id: "00000000-0000-4000-8000-0000000000a1", loja: "JK Granja", nome: "Vendedora Um", ativo: true },
  { id: "00000000-0000-4000-8000-0000000000a2", loja: "JK Granja", nome: "Vendedor Dois", ativo: true },
  { id: "00000000-0000-4000-8000-0000000000a3", loja: "JK Granja", nome: "Vendedora Três", ativo: false },
];

const base: PedidoDoBalcao = {
  id: "00000000-0000-4000-8000-000000000001", numero: 41, loja: "JK Granja", vendedor: VENDEDORES_DE_EXEMPLO[0].id, vendedor_nome: "Vendedora Um",
  cliente_nome: "Cliente Exemplo Um", cliente_telefone: "5511900000001", cliente_email: null, motivo: "casamento", data_especial: "2027-03-20",
  pecas: [{ nome: "Par de Alianças Ouro 18k 5mm Anatômica", quantidade: 1, info: "Numeração - Aro 01: 18<br />Numeração - Aro 02: 24<br />Modelo de Gravação: Gravação Laser<br />Gravação - Aro 01: Ana 20.03.2027<br />Gravação - Aro 02: Beto 20.03.2027<br />", produto_tray_id: null }],
  formulario: null, entrega: "retirada", entrega_texto: "Retire na loja do JK Granja", endereco: null, cidade: null, uf: null,
  prazo: "2026-11-28", total: "3000.00", pago: "1500.00", observacao: "Cliente pediu caixinha de coração.", numero_papel: "522", fotos: [], transcricao: null,
  fabrica_em: "2026-11-14T15:00:00Z", recebido_em: "2026-11-19T15:00:00Z", entregue_em: null, cancelado_em: null, cancelado_motivo: null,
  criado_em: "2026-11-14T14:30:00Z", atualizado_em: "2026-11-19T15:00:00Z", criado_por_nome: "JK", os: 1188, etapa: "enviado", etapa_nome: "Enviado",
  etapa_papel: "final", etapa_em: "2026-11-18T12:00:00Z", rastreio: null, ref: "a00000000-0000-4000-8000-000000000009",
  pagamentos: [{ id: "00000000-0000-4000-8000-0000000000b1", valor: "1500.00", forma: "pix", parcelas: 1, pago_em: "2026-11-14", comprovante: "x", criado_em: "2026-11-14T14:30:00Z", estornado_em: null, estornado_motivo: null }],
  anexos: [], alteracoes: [],
};

export const PEDIDOS_DE_EXEMPLO: PedidoDoBalcao[] = [
  base,
  { ...base, id: "00000000-0000-4000-8000-000000000002", numero: 44, cliente_nome: "Cliente Exemplo Dois", vendedor_nome: "Vendedor Dois", fabrica_em: null, recebido_em: null, os: null, etapa: null, etapa_nome: null, etapa_papel: null, pago: "0", pagamentos: [], prazo: "2026-12-05", pecas: [{ nome: "Anel Solitário Prata 925", quantidade: 1, info: "Numeração Anel Solitário: 15<br />", produto_tray_id: null }], total: "400.00" },
  { ...base, id: "00000000-0000-4000-8000-000000000003", numero: 39, cliente_nome: "Cliente Exemplo Três", recebido_em: null, etapa: "gravacao", etapa_nome: "Gravação", etapa_papel: "meio", prazo: "2026-11-18", pago: "800.00", total: "2000.00" },
  { ...base, id: "00000000-0000-4000-8000-000000000004", numero: 35, cliente_nome: "Cliente Exemplo Quatro", entregue_em: "2026-11-17T18:00:00Z", pago: "1200.00", total: "1200.00" },
];
