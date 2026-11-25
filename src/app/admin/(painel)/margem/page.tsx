import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { listarCatalogo } from "@/lib/catalogo/fotos";
import { lerFamilias, margensDoCatalogo } from "@/lib/margem/dados";
import { coberturaDoCusto, gramasPorMmMedidas, porcento, reais, type Custo } from "@/lib/margem/calculo";
import { TelaDaMargem, type LinhaDaMargem } from "./TelaDaMargem";

export const metadata = { title: "Margem" };

/**
 * Custo e margem do catálogo. Só administrador: é custo da empresa.
 *
 * O topo responde a pergunta da Black: quais produtos já estão com promoção
 * abaixo da margem mínima, e quais nem custo têm. Embaixo fica o que o dono
 * preenche (preço do grama, taxas, as regras de custo das peças e o peso de cada
 * família de ouro), igual à planilha que foi para ele, que também pode ser
 * importada aqui. A cobertura diz quanto do catálogo as regras já calculam.
 */
export default async function MargemPage() {
  await requireAdmin();
  const db = await createClient();
  const itens = (await listarCatalogo(db)).filter((p) => p.disponivel);
  const [{ parametros, daLista, porProduto }, familias] = await Promise.all([margensDoCatalogo(db, itens), lerFamilias(db)]);

  const comCusto = itens.filter((p) => porProduto[p.id]?.custo !== null);
  const porVenda = (a: { vendidos: number }, b: { vendidos: number }) => b.vendidos - a.vendidos;
  const hojePassa = itens.filter((p) => porProduto[p.id]?.margem?.hojePassa).sort(porVenda);
  const abaixo = itens.filter((p) => porProduto[p.id]?.margem?.abaixoDoMinimo).sort(porVenda);
  const semCustoMaisVendidos = itens.filter((p) => porProduto[p.id]?.custo === null).sort(porVenda).slice(0, 10);

  const cobertura = coberturaDoCusto(
    itens.map((p) => {
      const c = porProduto[p.id];
      const custo: Custo = c && c.custo !== null
        ? { valor: c.custo, detalhe: c.detalhe ?? "", falta: null, origem: c.origem ?? "gravado" }
        : { valor: null, detalhe: null, falta: c?.falta ?? "Sem custo", motivo: c?.motivo ?? "sem_material" };
      return { nome: p.nome, vendidos: p.vendidos, custo };
    }),
  );
  const medidas = gramasPorMmMedidas(itens.map((p) => ({ nome: p.nome, material: porProduto[p.id]?.material ?? null, gramas: porProduto[p.id]?.gravado?.gramas ?? null })));

  const linhaDe = (p: (typeof itens)[number], direita: string): LinhaDaMargem => ({ codigo: p.trayId, nome: p.nome, direita });
  return (
    <TelaDaMargem
      parametros={parametros}
      daLista={daLista}
      familias={familias}
      comCusto={comCusto.length}
      total={itens.length}
      hojePassa={{
        n: hojePassa.length,
        linhas: hojePassa.slice(0, 15).map((p) => {
          const m = porProduto[p.id].margem!;
          return linhaDe(p, `${porcento(m.descontoHoje ?? 0, 0)} de desconto hoje, máximo ${porcento(m.descontoMaximo, 0)}. Margem hoje ${porcento(m.fracaoHoje ?? 0)}`);
        }),
      }}
      abaixo={{
        n: abaixo.length,
        linhas: abaixo.slice(0, 15).map((p) => {
          const m = porProduto[p.id].margem!;
          return linhaDe(p, `Margem ${porcento(m.fracao)} (${reais(m.reais)})`);
        }),
      }}
      cobertura={cobertura}
      medidas={medidas}
      semCusto={semCustoMaisVendidos.map((p) => linhaDe(p, porProduto[p.id].falta ?? "Sem custo"))}
    />
  );
}
