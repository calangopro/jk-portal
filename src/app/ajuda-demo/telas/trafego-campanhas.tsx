import { TelaDeCampanhas } from "@/app/admin/(painel)/trafego/campanhas/Tela";
import { diagnosticar, type Item } from "@/lib/trafego/diagnostico";
import type { CampanhasDaTela } from "@/lib/trafego/dados";
import type { Demo } from "../tipos";

/** Campanhas, conjuntos e anúncios inventados, com números redondos. O diagnóstico é o de verdade, calculado sobre eles. */
const item = (nivel: Item["nivel"], id: string, nome: string, pai: [string | null, string | null], n: Partial<Item>): Item => ({
  nivel, id, nome, campanha_id: pai[0], conjunto_id: pai[1], tipo: null, ativo: true,
  gasto: 0, impressoes: 0, cliques: 0, cliques_todos: null, visitas: null, carrinhos: null, checkouts: null, compras: null, valor: null, conversas: null,
  ...n,
});

const itens: Item[] = [
  item("campanha", "c1", "Campanha Exemplo Vendas", [null, null], { tipo: "vendas", gasto: 6000, impressoes: 150000, cliques: 3000, visitas: 2400, carrinhos: 300, checkouts: 150, compras: 30, valor: 45000 }),
  item("conjunto", "s1", "Conjunto Exemplo Casais", ["c1", null], { gasto: 6000, impressoes: 150000, cliques: 3000, visitas: 2400, carrinhos: 300, checkouts: 150, compras: 30, valor: 45000 }),
  item("anuncio", "a1", "Anúncio Exemplo Vídeo", ["c1", "s1"], { gasto: 4000, impressoes: 100000, cliques: 2200, visitas: 1800, carrinhos: 240, checkouts: 120, compras: 26, valor: 39000 }),
  item("anuncio", "a2", "Anúncio Exemplo Foto", ["c1", "s1"], { gasto: 2000, impressoes: 50000, cliques: 800, visitas: 600, carrinhos: 60, checkouts: 30, compras: 4, valor: 6000 }),
  item("campanha", "c2", "Campanha Exemplo Remarketing", [null, null], { tipo: "vendas", gasto: 3000, impressoes: 60000, cliques: 1500, visitas: 1200, carrinhos: 200, checkouts: 100, compras: 25, valor: 40000 }),
  item("conjunto", "s2", "Conjunto Exemplo Visitantes", ["c2", null], { gasto: 3000, impressoes: 60000, cliques: 1500, visitas: 1200, carrinhos: 200, checkouts: 100, compras: 25, valor: 40000 }),
  item("anuncio", "a3", "Anúncio Exemplo Carrossel", ["c2", "s2"], { gasto: 3000, impressoes: 60000, cliques: 1500, visitas: 1200, carrinhos: 200, checkouts: 100, compras: 25, valor: 40000 }),
  item("campanha", "c3", "Campanha Exemplo Teste", [null, null], { tipo: "vendas", gasto: 2000, impressoes: 80000, cliques: 900, visitas: 700, carrinhos: 30, checkouts: 10, compras: 1, valor: 1500 }),
  item("conjunto", "s3", "Conjunto Exemplo Amplo", ["c3", null], { gasto: 2000, impressoes: 80000, cliques: 900, visitas: 700, carrinhos: 30, checkouts: 10, compras: 1, valor: 1500 }),
  item("anuncio", "a4", "Anúncio Exemplo Imagem", ["c3", "s3"], { gasto: 2000, impressoes: 80000, cliques: 900, visitas: 700, carrinhos: 30, checkouts: 10, compras: 1, valor: 1500 }),
];

const dados: CampanhasDaTela = {
  plataforma: "meta",
  de: "2026-10-21",
  ate: "2026-11-19",
  diagnostico: diagnosticar(itens, "meta"),
  loja: { criados: 60, pagos: 30, valor: 40000 },
  anotado: {
    itens: {
      "campanha:c1": { criados: 20, pagos: 12, valor: 18000 },
      "conjunto:s1": { criados: 20, pagos: 12, valor: 18000 },
      "anuncio:a1": { criados: 15, pagos: 10, valor: 15000 },
      "anuncio:a2": { criados: 5, pagos: 2, valor: 3000 },
      "campanha:c2": { criados: 10, pagos: 6, valor: 9000 },
      "conjunto:s2": { criados: 10, pagos: 6, valor: 9000 },
      "anuncio:a3": { criados: 10, pagos: 6, valor: 9000 },
    },
    cobertura: { criados: 60, com_sessao: 50, ligados: 45, com_origem: 40, pagos: 30, pagos_com_origem: 25, pagos_com_anuncio: 18, valor_pago: 40000, valor_pago_com_origem: 35000, valor_pago_com_anuncio: 27000 },
  },
  whats: null,
};

const demo: Demo = {
  caminho: "/admin/trafego/campanhas",
  desenho: () => <TelaDeCampanhas {...dados} chave="30d" lidaEm="2026-11-19T11:00:00Z" />,
};
export default demo;
