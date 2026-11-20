import { TelaDaMargem } from "@/app/admin/(painel)/margem/TelaDaMargem";
import type { Parametros } from "@/lib/margem/calculo";
import type { FamiliaComProdutos } from "@/lib/margem/dados";
import type { Demo } from "../tipos";

/** Margem com custos e pesos inventados, redondos. */
const parametros: Parametros = { cotacao18k: 500, cotacao10k: 300,
  cotacaoPrata: 10,
  prataGramasPorMm: 0.95,
  prataResto: 30, taxa: 0.05, imposto: 0.1, frete: 0, embalagem: 10, margemMinima: 0.3 };

const familias: FamiliaComProdutos[] = [
  { codigo: "F01", material: "ouro_18k", tipo: "Par de alianças", largura: "4 mm", perfil: "Abaulada", gramas: 8, arosReferencia: "16 e 22", resto: 200, produtos: 12 },
  { codigo: "F02", material: "ouro_18k", tipo: "Par de alianças", largura: "6 mm", perfil: "Reta", gramas: 12, arosReferencia: "16 e 22", resto: 200, produtos: 8 },
  { codigo: "F03", material: "ouro_10k", tipo: "Par de alianças", largura: "4 mm", perfil: "Abaulada", gramas: 6, arosReferencia: "16 e 22", resto: 150, produtos: 10 },
  { codigo: "F04", material: "prata_com_ouro", tipo: "Par de alianças", largura: "5 mm", perfil: "Reta", gramas: null, arosReferencia: null, resto: null, produtos: 5 },
];

const demo: Demo = {
  caminho: "/admin/margem",
  desenho: () => (
    <TelaDaMargem
      parametros={parametros}
      familias={familias}
      comCusto={80}
      total={100}
      hojePassa={{ n: 2, linhas: [
        { codigo: "1", nome: "Par de alianças Exemplo Um", direita: "30% de desconto hoje, máximo 20%. Margem hoje 15%" },
        { codigo: "2", nome: "Par de alianças Exemplo Dois", direita: "25% de desconto hoje, máximo 20%. Margem hoje 25%" },
      ] }}
      abaixo={{ n: 1, linhas: [{ codigo: "3", nome: "Anel Exemplo", direita: "Margem 20% (R$ 200,00)" }] }}
      semCusto={[
        { codigo: "4", nome: "Par de alianças Exemplo Três", direita: "Falta o custo" },
        { codigo: "5", nome: "Anel solitário Exemplo", direita: "Falta o custo" },
      ]}
    />
  ),
};
export default demo;
