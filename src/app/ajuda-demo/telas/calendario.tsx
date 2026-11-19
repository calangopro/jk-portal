import { TelaDoCalendario, type Item } from "@/app/admin/(painel)/calendario/Tela";
import type { Demo } from "../tipos";

/** Novembro de 2026, com o "hoje" no dia 19: dois posts no ar, dois agendados e um que passou da hora. */
const porDia = new Map<string, Item[]>([
  ["2026-11-03", [{ id: "c1", titulo: "Post de exemplo um", quando: "2026-11-03T15:00:00Z", tipo: "publicado" }]],
  ["2026-11-10", [{ id: "c2", titulo: "Post de exemplo dois", quando: "2026-11-10T15:00:00Z", tipo: "publicado" }]],
  ["2026-11-17", [{ id: "c3", titulo: "Post de exemplo atrasado", quando: "2026-11-17T15:00:00Z", tipo: "agendado", erro: "Falta fonte registrada." }]],
  ["2026-11-24", [{ id: "c4", titulo: "Post de exemplo agendado", quando: "2026-11-24T15:00:00Z", tipo: "agendado" }]],
  ["2026-11-27", [{ id: "c5", titulo: "Outro post de exemplo", quando: "2026-11-27T15:00:00Z", tipo: "agendado" }]],
]);

const demo: Demo = {
  caminho: "/admin/calendario",
  desenho: () => (
    <TelaDoCalendario
      ano={2026}
      numeroDoMes={11}
      hojeEmSp="2026-11-19"
      porDia={porDia}
      comAtraso={1}
      semData={[
        { id: "c6", title: "Rascunho de exemplo um", status: "draft" },
        { id: "c7", title: "Rascunho de exemplo dois", status: "in_review" },
      ]}
      pautas={[
        { id: "p1", target_query: "consulta de exemplo", title: "Pauta de exemplo um", status: "pronta" },
        { id: "p2", target_query: "outra consulta de exemplo", title: null, status: "ideia" },
      ]}
    />
  ),
};
export default demo;
