import { EditorDeCampanha, type ProdutoParaAdicionar } from "@/app/admin/(painel)/campanhas/[id]/EditorDeCampanha";
import type { Avaliacao, Campanha, ItemDaCampanha } from "@/lib/campanhas/dados";
import type { Demo } from "../tipos";

/** Uma campanha de exemplo, em rascunho ou esperando aprovação. A chave da tela é a do print. */
export const campanha = (status: Campanha["status"]): Campanha => ({
  id: "c-exemplo", nome: "Black Friday Exemplo", inicio: "2026-11-27", fim: "2026-11-30", status, nota: null, criadaPor: "Gerente Exemplo",
  enviadaEm: null, decididaPor: null, decididaEm: null, exportadaEm: null, itens: 3,
});

const item = (n: number, nome: string, cheio: number, campanhaPreco: number): ItemDaCampanha => ({
  productId: `p${n}`, trayId: String(1000 + n), nome, categoria: "Alianças de ouro 18k", url: null, miniatura: null, disponivel: true,
  precoCheio: cheio, precoCampanha: campanhaPreco, desconto: 1 - campanhaPreco / cheio,
});
export const itens: ItemDaCampanha[] = [
  item(1, "Par de alianças de ouro 18k", 3000, 2399.9),
  item(2, "Par de alianças de ouro 18k abauladas", 3500, 2799.9),
  item(3, "Par de alianças de ouro 18k anatômicas", 4000, 2199.9),
];

export const avaliacaoDoGerente: Record<string, Avaliacao> = { p1: { situacao: "ok" }, p2: { situacao: "ok" }, p3: { situacao: "passa" } };
export const avaliacaoDaDiretoria: Record<string, Avaliacao> = {
  p1: { situacao: "ok", custo: 1200, margem: 0.5, margemReais: 1200, descontoMaximo: 0.3, cpaMaximo: 300 },
  p2: { situacao: "ok", custo: 1400, margem: 0.5, margemReais: 1400, descontoMaximo: 0.3, cpaMaximo: 350 },
  p3: { situacao: "passa", custo: 1600, margem: 0.27, margemReais: 600, descontoMaximo: 0.3, precoMinimo: 2800, cpaMaximo: 0 },
};

export const paraAdicionar: ProdutoParaAdicionar[] = [
  { id: "p4", trayId: "1004", nome: "Par de alianças de prata", categoria: "Alianças de prata", precoCheio: 500, vendidos: 60 },
  { id: "p5", trayId: "1005", nome: "Par de alianças de prata lisas", categoria: "Alianças de prata", precoCheio: 600, vendidos: 30 },
  { id: "p6", trayId: "1006", nome: "Anel solitário de prata", categoria: "Anéis", precoCheio: 400, vendidos: 20 },
];

const demo: Demo = {
  caminho: "/admin/campanhas",
  desenho: () => (
    <EditorDeCampanha campanha={campanha("rascunho")} itens={itens} avaliacao={avaliacaoDoGerente} margemMinima={null} admin={false} paraAdicionar={paraAdicionar} />
  ),
};
export default demo;
