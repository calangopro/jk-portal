import { TelaDeSugestoes } from "@/app/admin/(painel)/sugestoes/Tela";
import { ehAdmin } from "@/lib/auth/acessos";
import type { RoadmapNaTela, SugestaoNaTela } from "@/lib/sugestoes/dados";
import type { Demo } from "../tipos";

const base: Omit<SugestaoNaTela, "id" | "texto" | "estado" | "tela" | "telaNome" | "criadaEm"> = {
  minha: true, autor: "Vendedor Exemplo", aparelho: "computador", janela: "1280x800", imagens: [], resposta: null,
  estadoMudouEm: null, estadoPor: null, cartao: null,
};

const proprias: SugestaoNaTela[] = [
  { ...base, id: 3, criadaEm: "2026-11-19T12:00:00Z", tela: "/admin/pedidos-do-site", telaNome: "Pedidos do site", texto: "Seria bom filtrar os pedidos pela cidade do cliente, para eu achar quem vai retirar na minha loja.", estado: "nova" },
  { ...base, id: 2, criadaEm: "2026-11-17T15:00:00Z", tela: "/admin/oportunidades", telaNome: "Oportunidades", texto: "Um botão para copiar a mensagem pronta de aniversário.", estado: "em_andamento", estadoMudouEm: "2026-11-18T10:00:00Z", estadoPor: "Gerente Exemplo", resposta: "Entra nesta semana, junto com a melhoria das oportunidades." },
  { ...base, id: 1, criadaEm: "2026-11-12T09:00:00Z", tela: "/admin/consulta", telaNome: "Consulta", texto: "Mostrar a foto do produto na busca.", estado: "feita", estadoMudouEm: "2026-11-16T10:00:00Z", estadoPor: "Gerente Exemplo", resposta: "Pronto, a foto já aparece na busca." },
];

const detodos: SugestaoNaTela[] = [
  { ...base, minha: false, autor: "Vendedora Exemplo", id: 4, criadaEm: "2026-11-19T13:00:00Z", tela: "/admin/fabrica", telaNome: "Fábrica", texto: "Dava para marcar o pedido com urgência, quando o cliente tem data de casamento marcada.", estado: "nova", aparelho: "celular" },
  proprias[0],
  { ...proprias[1], estado: "planejada", cartao: { id: 57, coluna: "a_fazer" }, resposta: null },
  proprias[2],
];

const roadmap = (diretoria: boolean): RoadmapNaTela => ({ diretoria, itens: diretoria ? detodos.map((s) => ({ ...s, minha: s.id === 3 })) : proprias });

const mudar = async () => {
  "use server";
  return { ok: true as const };
};

const demo: Demo = {
  caminho: "/admin/sugestoes",
  desenho: (nivel) => {
    const diretoria = ehAdmin(nivel);
    return <TelaDeSugestoes roadmap={roadmap(diretoria)} mudar={diretoria ? mudar : undefined} />;
  },
};
export default demo;
