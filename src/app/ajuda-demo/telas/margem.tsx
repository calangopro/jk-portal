import { TelaDaMargem } from "@/app/admin/(painel)/margem/TelaDaMargem";
import { REGRAS_VAZIAS, type CoberturaDoCusto, type Parametros } from "@/lib/margem/calculo";
import type { FamiliaComProdutos } from "@/lib/margem/dados";
import type { Demo } from "../tipos";

/** Margem com custos e pesos inventados, redondos. */
const parametros: Parametros = { cotacao18k: 500, cotacao10k: 300,
  cotacaoPrata: 10,
  prataGramasPorMm: null,
  prataResto: null, taxa: 0.05, imposto: 0.1, frete: 0, embalagem: 10, margemMinima: 0.3,
  regras: {
    ...REGRAS_VAZIAS,
    gramasPorMm: { prata_950: { alianca: 1, anel: 1 }, ouro_18k: { alianca: 0.5, anel: null }, ouro_10k: { alianca: null, anel: null } },
    fatorDoModelo: { anatomica: 1.3, chanfrada: null, abaulada: null, fio_de_ouro: null },
    custoDaPedra: { "1,00": 0.03, "1,25": 0.04, "1,50": 0.05 },
    pedrasMeiaVolta: 15, pedrasVoltaCompleta: 40, brinde: 20, caixinha: 15, folga: 0.05,
  } };

const cobertura: CoberturaDoCusto = {
  total: 100,
  porOrigem: { regras: { produtos: 50, vendidos: 700 }, gravado: { produtos: 25, vendidos: 20 }, fixo: { produtos: 5, vendidos: 30 } },
  semCusto: { produtos: 20, vendidos: 250 },
  faltas: [
    { motivo: "semijoia", rotulo: "Semijoia: a JK ainda não passou o custo", produtos: 12, vendidos: 200, exemplos: ["Colar Exemplo Banhado a Ouro", "Brinco Exemplo Banhado a Ouro"] },
    { motivo: "sem_largura", rotulo: "Sem largura em mm no nome", produtos: 5, vendidos: 40, exemplos: ["Anel Exemplo de Prata"] },
    { motivo: "falta_gramas_por_mm", rotulo: "Falta as gramas por mm nas regras", produtos: 3, vendidos: 10, exemplos: ["Par de alianças Exemplo em Ouro 10k 4mm"] },
  ],
};

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
      cobertura={cobertura}
      medidas={[{ material: "ouro_18k", modelo: "reta", mediana: 0.5, produtos: 40 }, { material: "ouro_18k", modelo: "anatomica", mediana: 0.65, produtos: 30 }]}
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
