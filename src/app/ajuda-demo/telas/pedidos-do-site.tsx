import { TelaDosPedidos } from "@/app/admin/(painel)/pedidos-do-site/Tela";
import type { ListaDePedidosDoSite } from "@/lib/pedidos/do-site";
import type { Demo } from "../tipos";

const lista = (veTudo: boolean): ListaDePedidosDoSite => ({
  eu: "a",
  de: "2026-10-20",
  ate: "2026-11-19",
  busca: "nada",
  encontrados: 4,
  pode: { atribuir: veTudo, veValor: veTudo },
  vendedores: veTudo ? [{ id: "a", nome: "Vendedor Exemplo" }, { id: "b", nome: "Vendedora Exemplo" }] : [],
  pedidos: [
    { numero: 11001, dia: "2026-11-18", feitoEm: "2026-11-18T14:00:00Z", situacao: "pago", cliente: "Cliente Exemplo Um", cidade: "Cidade Exemplo", uf: "SP", pecas: ["Par de alianças de ouro 18k"], nPecas: 1, vendedor: null, soPorFora: false, meu: false, total: veTudo ? 3000 : null },
    { numero: 11003, dia: "2026-11-17", feitoEm: "2026-11-17T11:00:00Z", situacao: "pago", cliente: "Cliente Exemplo Dois", cidade: "Cidade Exemplo", uf: "RJ", pecas: ["Par de alianças de prata"], nPecas: 1, vendedor: null, soPorFora: false, meu: false, total: veTudo ? 1500 : null },
    { numero: 10997, dia: "2026-11-15", feitoEm: "2026-11-15T16:00:00Z", situacao: "pago", cliente: "Cliente Exemplo Três", cidade: "Cidade Exemplo", uf: "MG", pecas: ["Anel solitário", "Caixinha"], nPecas: 2, vendedor: null, soPorFora: false, meu: false, total: veTudo ? 2000 : null },
    { numero: 10993, dia: "2026-11-13", feitoEm: "2026-11-13T09:00:00Z", situacao: "pago", cliente: "Cliente Exemplo Quatro", cidade: "Cidade Exemplo", uf: "SP", pecas: ["Par de alianças de ouro 18k"], nPecas: 1, vendedor: null, soPorFora: false, meu: false, total: veTudo ? 3000 : null },
  ],
});

const demo: Demo = {
  caminho: "/admin/pedidos-do-site",
  desenho: (nivel) => <TelaDosPedidos inicial={lista(nivel !== "vendas")} hoje="2026-11-19" />,
};
export default demo;
