import { TelaDeRegistrarVenda } from "@/app/admin/(painel)/registrar-venda/Tela";
import type { ResumoPorFora } from "@/lib/vendas/por-fora";
import type { Demo } from "../tipos";

const mes: ResumoPorFora = {
  vendas: 6,
  valor: 8400,
  a_conferir: 0,
  por_vendedor: [],
  por_dia: [{ dia: "2026-11-19", vendas: 1, valor: 1200 }],
  por_forma: [{ forma: "pix", vendas: 4, valor: 6000 }],
  ultimas: [
    { id: "v1", feita_em: "2026-11-19T10:00:00Z", dia: "2026-11-19", vendedor: "Vendedor Exemplo", valor: 1200, forma: "pix", canal: "whatsapp", cliente: "Cliente Exemplo Um", produto: "Par de alianças de ouro 18k", conferir: null },
    { id: "v2", feita_em: "2026-11-17T10:00:00Z", dia: "2026-11-17", vendedor: "Vendedor Exemplo", valor: 2000, forma: "link_de_pagamento", canal: "instagram", cliente: "Cliente Exemplo Dois", produto: "Par de alianças de prata", conferir: null },
    { id: "v3", feita_em: "2026-11-12T10:00:00Z", dia: "2026-11-12", vendedor: "Vendedor Exemplo", valor: 1500, forma: "pix", canal: "whatsapp", cliente: "Cliente Exemplo Três", produto: "Anel de noivado", conferir: null },
  ],
};

const demo: Demo = {
  caminho: "/admin/registrar-venda",
  desenho: (nivel) => (
    <TelaDeRegistrarVenda
      mes={mes}
      hoje="2026-11-19"
      veTodas={nivel !== "vendas"}
      vendedores={nivel !== "vendas" ? [{ id: "a", nome: "Vendedor Exemplo" }, { id: "b", nome: "Vendedora Exemplo" }] : undefined}
      lancadas={[]}
      produtos={[{ codigo: "1", nome: "Par de alianças de ouro 18k", miniatura: null }]}
      lojas={["Loja Exemplo Centro", "Loja Exemplo Shopping"]}
    />
  ),
};
export default demo;
