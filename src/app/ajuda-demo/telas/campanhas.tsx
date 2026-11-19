import { TelaDeCampanhas } from "@/app/admin/(painel)/campanhas/Tela";
import type { Campanha } from "@/lib/campanhas/dados";
import type { Demo } from "../tipos";

const base: Campanha = {
  id: "c-exemplo", nome: "", inicio: "2026-11-27", fim: "2026-11-30", status: "rascunho", nota: null, criadaPor: "Gerente Exemplo",
  enviadaEm: null, decididaPor: null, decididaEm: null, exportadaEm: null, itens: 0,
};
const campanhas: Campanha[] = [
  { ...base, id: "c1", nome: "Black Friday Exemplo", status: "em_aprovacao", itens: 3 },
  { ...base, id: "c2", nome: "Semana das Alianças Exemplo", inicio: "2026-12-01", fim: "2026-12-07", status: "rascunho", itens: 2 },
  { ...base, id: "c3", nome: "Dia dos Namorados Exemplo", inicio: "2026-06-05", fim: "2026-06-12", status: "encerrada", itens: 4 },
];

const demo: Demo = {
  caminho: "/admin/campanhas",
  desenho: () => <TelaDeCampanhas campanhas={campanhas} alertas={new Map([["c1", 1]])} />,
};
export default demo;
