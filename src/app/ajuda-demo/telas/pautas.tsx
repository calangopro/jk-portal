import { TelaDasPautas } from "@/app/admin/(painel)/pautas/Tela";
import type { Oportunidade, Pauta } from "@/lib/content/pautas";
import type { Demo } from "../tipos";

const oportunidades: Oportunidade[] = [
  { consulta: "consulta de exemplo um", impressoes: 12000, cliques: 20, posicao: 9.4, ctr: 0.2, nota: 90, porque: "Muita impressão e quase nenhum clique." },
  { consulta: "consulta de exemplo dois", impressoes: 8000, cliques: 40, posicao: 12.1, ctr: 0.5, nota: 75, porque: "Está na segunda página da busca." },
  { consulta: "consulta de exemplo três", impressoes: 3000, cliques: 10, posicao: 7.2, ctr: 0.3, nota: 60, porque: "Aparece bem, mas o título não chama o clique." },
];

const base = { searchIntent: null, modelo: null, ctr: null, conteudoTitulo: null, conteudoSlug: null, conteudoStatus: null };
const fila: Pauta[] = [
  { ...base, id: "p1", targetQuery: "consulta de exemplo um", title: "Título de exemplo para a pauta um", cluster: "assunto exemplo", notes: "Nota de exemplo sobre o ângulo do texto.", status: "pronta", origem: "gsc", impressions: 12000, clicks: 20, position: 9.4, contentId: null },
  { ...base, id: "p2", targetQuery: "consulta de exemplo quatro", title: "Título de exemplo para a pauta dois", cluster: null, notes: null, status: "escrevendo", origem: "manual", impressions: null, clicks: null, position: null, contentId: "c1" },
  { ...base, id: "p3", targetQuery: "consulta de exemplo cinco", title: null, cluster: null, notes: null, status: "ideia", origem: "manual", impressions: null, clicks: null, position: null, contentId: null },
];

const demo: Demo = {
  caminho: "/admin/pautas",
  desenho: () => <TelaDasPautas fila={fila} oportunidadesDaBusca={oportunidades} clusters={["assunto exemplo", "outro assunto"]} />,
};
export default demo;
