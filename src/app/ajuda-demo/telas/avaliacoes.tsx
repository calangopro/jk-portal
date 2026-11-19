import { TelaDeAvaliacoes } from "@/app/admin/(painel)/avaliacoes/Tela";
import type { LojaDoPainel } from "@/lib/google-perfil/painel";
import type { Demo } from "../tipos";

const semana = (opens: string, closes: string, dias: string[]) => ({ opens, closes, dayOfWeek: dias });
const util = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

const lojas: LojaDoPainel[] = [
  {
    name: "locations/1", titulo: "JK Alianças Loja Exemplo Um", nota: 4.8, total: 1200, lidas: 100, semResposta: 3, baixasSemResposta: 1, mapa: "https://maps.example.com/loja-um",
    horarioDoGoogle: [semana("10:00", "22:00", util), semana("10:00", "20:00", ["Saturday", "Sunday"])],
    portal: { id: "p1", slug: "loja-exemplo-um", nome: "Loja Exemplo Um", horario: null, fonte: null },
    pendentes: [
      { name: "locations/1/reviews/a", autor: "Cliente Exemplo Um", nota: 2, texto: "Exemplo de avaliação com nota baixa. A peça precisou de ajuste.", criadaEm: "2026-11-17T12:00:00Z" },
      { name: "locations/1/reviews/b", autor: "Cliente Exemplo Dois", nota: 5, texto: "Exemplo de elogio ao atendimento da loja.", criadaEm: "2026-11-18T12:00:00Z" },
      { name: "locations/1/reviews/c", autor: "Cliente Exemplo Três", nota: 5, texto: "Exemplo de avaliação positiva.", criadaEm: "2026-11-18T15:00:00Z" },
    ],
  },
  {
    name: "locations/2", titulo: "JK Alianças Loja Exemplo Dois", nota: 4.9, total: 800, lidas: 100, semResposta: 0, baixasSemResposta: 0, mapa: null,
    horarioDoGoogle: null, portal: null, pendentes: [],
  },
];

const responder = async () => {
  "use server";
  return { ok: true as const };
};
const usarHorario = async () => {
  "use server";
  return { ok: true as const };
};

const demo: Demo = {
  caminho: "/admin/avaliacoes",
  desenho: () => <TelaDeAvaliacoes lojas={lojas} responder={responder} usarHorario={usarHorario} />,
};
export default demo;
