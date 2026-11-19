import { TelaDeTrafego } from "@/app/admin/(painel)/trafego/Tela";
import type { TrafegoDaTela } from "@/lib/trafego/dados";
import type { Conexao } from "@/lib/trafego/plataformas";
import type { Demo } from "../tipos";

/** Tráfego com gasto e venda inventados, redondos. */
const dia = (i: number) => new Date(Date.UTC(2026, 9, 21 + i, 12)).toISOString().slice(0, 10);
const VENDA = [2000, 3000, 2500, 4000, 1500, 3000, 2000, 3500, 2500, 3000, 2000, 4500, 3000, 2500, 2000, 3000, 3500, 2500, 4000, 3000, 2000, 2500, 3000, 3500, 2000, 3000, 4000, 2500, 3000, 3500];
const GASTO = [500, 500, 600, 500, 400, 500, 500, 600, 500, 500, 400, 600, 500, 500, 500, 500, 600, 500, 500, 500, 400, 500, 500, 600, 500, 500, 500, 500, 500, 600];
const porDia = VENDA.map((v, i) => ({ dia: dia(i), venda: v, gasto: GASTO[i] }));
const gastoTotal = GASTO.reduce((s, v) => s + v, 0);

const dados: TrafegoDaTela = {
  de: dia(0),
  ate: dia(29),
  comparacao: "contra os 30 dias antes",
  gasto: {
    gasto: gastoTotal,
    dias_com_gasto: 30,
    por_plataforma: [
      { plataforma: "meta", gasto: 10000, cliques: 5000, impressoes: 200000, dias: 30, ultimo_dia: dia(29), por_api: true },
      { plataforma: "google", gasto: 5000, cliques: 2000, impressoes: 80000, dias: 30, ultimo_dia: dia(29), por_api: true },
    ],
    por_dia: porDia.map((p) => ({ dia: p.dia, gasto: p.gasto })),
  },
  gastoAnterior: 12000,
  linhas: [
    { plataforma: "meta", nome: "Meta (Instagram e Facebook)", gasto: 10000, faturamento: 40000, pedidos: 30, retorno: 4, custoPorPedido: 333.33, situacao: "positivo" },
    { plataforma: "google", nome: "Google Ads", gasto: 5000, faturamento: 15000, pedidos: 10, retorno: 3, custoPorPedido: 500, situacao: "positivo" },
  ],
  vendaDaLoja: 90000,
  porFora: 10000,
  semEtiqueta: 35000,
  porDia,
};

const conexoes: Conexao[] = [
  { plataforma: "meta", configurada: true, lidaEm: "2026-11-19T11:00:00Z", tentadaEm: "2026-11-19T11:00:00Z", problema: null },
  { plataforma: "google", configurada: true, lidaEm: "2026-11-19T11:00:00Z", tentadaEm: "2026-11-19T11:00:00Z", problema: null },
];

const demo: Demo = {
  caminho: "/admin/trafego",
  desenho: () => (
    <>
      <TelaDeTrafego chave="30d" hoje="2026-11-19" acao={async () => { "use server"; }} conexoes={conexoes} {...dados} />
      {/* Folga no fim, só para o print poder rolar até o formulário. */}
      <div className="h-[420px]" aria-hidden />
    </>
  ),
};
export default demo;
