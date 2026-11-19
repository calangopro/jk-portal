import { PainelDeCustos, type MesDaLoja } from "@/app/admin/(painel)/custos/PainelDeCustos";
import type { Despesa } from "@/lib/custos/dados";
import type { Demo } from "../tipos";

const d = (id: string, nome: string, categoria: Despesa["categoria"], tipo: Despesa["tipo"], valor: number, confirmado: boolean, fonte: string | null, anexos: Despesa["anexos"] = []): Despesa => ({
  id, nome, categoria, tipo, valor, confirmado, fonte, observacao: null, ativo: true, atualizado_em: "2026-11-10T12:00:00Z", anexos,
});

const despesas: Despesa[] = [
  d("1", "Equipe de vendas Exemplo", "pessoal", "mensal", 30000, true, "Folha de exemplo", [{ id: "a1", nome: "comprovante-exemplo.pdf", tipo: "application/pdf", tamanho: 1000, link: null }]),
  d("2", "Designer Exemplo", "pessoal", "mensal", 5000, false, "Estimativa de exemplo"),
  d("3", "Anúncios do mês", "anuncios", "mensal", 20000, false, "Estimativa de exemplo"),
  d("4", "Plataforma da loja Exemplo", "plataformas", "mensal", 3000, true, "Boleto de exemplo"),
  d("5", "Aluguel Exemplo", "estrutura", "mensal", 10000, true, "Contrato de exemplo"),
  d("6", "Caixinha de embalagem", "embalagem", "por_pedido", 10, true, "Orçamento de exemplo"),
  d("7", "Garantia e brinde", "embalagem", "por_pedido", 20, false, "Estimativa de exemplo"),
];

const mes: MesDaLoja = { hoje: "2026-11-19", diasNoMes: 30, pedidosPagos: 45, faturamento: 70000, porFora: 10000, anuncio: { gasto: 15000, dias: 18 } };

const acao = async () => { "use server"; };

const demo: Demo = {
  caminho: "/admin/custos",
  desenho: () => <PainelDeCustos despesas={despesas} mes={mes} acoes={{ salvar: acao, ligar: acao }} />,
};
export default demo;
