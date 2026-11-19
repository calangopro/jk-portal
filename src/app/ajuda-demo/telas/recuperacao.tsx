import { PainelDeRecuperacao } from "@/app/admin/(painel)/recuperacao/PainelDeRecuperacao";
import type { Caso, FilaDeRecuperacao } from "@/lib/vendas/recuperacao";
import type { Demo } from "../tipos";

const base: Omit<Caso, "pedido" | "maior_valor" | "valor" | "cliente" | "pagamento" | "itens" | "fase"> = {
  tentativas: 1, primeira: new Date(Date.now() - 6 * 3_600_000).toISOString(), ultima: new Date(Date.now() - 6 * 3_600_000).toISOString(),
  telefone: "5511900000000", email: null, cidade: "Cidade Exemplo", uf: "SP", status: "CANCELADO", aguardando: false, origem: "Instagram",
  pago_pedido: null, pago_valor: null, pago_em: null, nota: null, valor_fora: null, estado_em: null, quem: null,
};

const casos: Caso[] = [
  { ...base, pedido: 11011, maior_valor: 3000, valor: 3000, cliente: "Cliente Exemplo Um", pagamento: "Cartão de crédito", itens: "Par de alianças de ouro 18k", fase: "a_recuperar", tentativas: 2 },
  { ...base, pedido: 11009, maior_valor: 1500, valor: 1500, cliente: "Cliente Exemplo Dois", pagamento: "Pix", itens: "Par de alianças de prata", fase: "a_recuperar", aguardando: true, status: "AGUARDANDO PAGAMENTO" },
  { ...base, pedido: 11005, maior_valor: 1200, valor: 1200, cliente: "Cliente Exemplo Três", pagamento: "Cartão de crédito", itens: "Anel solitário", fase: "em_contato", estado_em: new Date(Date.now() - 2 * 3_600_000).toISOString(), quem: "Vendedor" },
];

const fila: FilaDeRecuperacao = {
  dias: 14,
  resumo: {
    a_recuperar: { clientes: 2, valor: 4500 },
    em_contato: { clientes: 1, valor: 1200 },
    recuperado: { clientes: 1, valor: 3000 },
    pago_por_fora: { clientes: 1, valor: 1500 },
  },
  casos,
};

const marcar = async () => {
  "use server";
};

const demo: Demo = {
  caminho: "/admin/recuperacao",
  desenho: () => <PainelDeRecuperacao fila={fila} janela={14} acao={marcar} comFicha />,
};
export default demo;
