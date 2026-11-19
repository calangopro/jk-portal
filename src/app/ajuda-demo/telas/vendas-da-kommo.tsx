import { TelaDasVendasDaKommo } from "@/app/admin/(painel)/vendas-da-kommo/Tela";
import type { ListaDaKommo } from "@/lib/kommo/vendas";
import type { Demo } from "../tipos";

const lista = (gerencia: boolean): ListaDaKommo => ({
  pode: { resolver: gerencia, ver_valor: gerencia },
  desde: "2026-10-20",
  vendedores: [{ id: "a", nome: "Vendedor Exemplo" }, { id: "b", nome: "Vendedora Exemplo" }],
  resumo: { marcadas: 2, registradas: 1, desfeitas: 0, esperando_pedido: 1, na_fila: 2, valor: gerencia ? 6200 : null },
  vendas: [
    { negocio_id: 1001, negocio: "Negócio Exemplo Um", cliente: "Cliente Exemplo Um", funil: "Vendas", estado: "marcada", pedido: 11001, dia: "2026-11-18", vendedor_id: "a", vendedor: "Vendedor Exemplo", valor: 3000, motivo_desfeito: null, link: "#" },
    { negocio_id: 1002, negocio: "Negócio Exemplo Dois", cliente: "Cliente Exemplo Dois", funil: "Vendas", estado: "registrada", pedido: null, dia: "2026-11-17", vendedor_id: "a", vendedor: "Vendedor Exemplo", valor: 1200, motivo_desfeito: null, link: "#" },
    { negocio_id: 1003, negocio: "Negócio Exemplo Três", cliente: "Cliente Exemplo Três", funil: "Vendas", estado: "aguardando_pedido", pedido: null, dia: "2026-11-19", vendedor_id: "b", vendedor: "Vendedora Exemplo", valor: 2000, motivo_desfeito: null, link: "#" },
  ],
  fila: [
    { negocio_id: 1004, negocio: "Negócio Exemplo Quatro", cliente: "Cliente Exemplo Quatro", funil: "Vendas", motivo: "ja_na_loja", pedido: null, pedido_tray: "10990", dia: "2026-11-16", responsavel: "Vendedor Exemplo", vendedor_id: "a", vendedor: "Vendedor Exemplo", valor: 1500, erro: null, parecida_com: null, tem_venda: false, link: "#" },
    { negocio_id: 1005, negocio: "Negócio Exemplo Cinco", cliente: "Cliente Exemplo Cinco", funil: "Vendas", motivo: "sem_valor", pedido: null, pedido_tray: null, dia: "2026-11-18", responsavel: "Vendedora Exemplo", vendedor_id: "b", vendedor: "Vendedora Exemplo", valor: null, erro: null, parecida_com: null, tem_venda: false, link: "#" },
  ],
});

const demo: Demo = {
  caminho: "/admin/vendas-da-kommo",
  desenho: (nivel) => <TelaDasVendasDaKommo inicial={lista(nivel !== "vendas")} hoje="2026-11-19" faltasNaFabrica={[]} />,
};
export default demo;
