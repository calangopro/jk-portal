import { TelaEmAlta } from "@/app/admin/(painel)/redes/conteudos/Tela";
import { CONTAS, CONTEUDOS } from "../redes-exemplo";
import type { Demo } from "../tipos";

/** Em alta, na ordem padrão (mais vistos), com as quatro acima do normal na frente. */
const demo: Demo = {
  caminho: "/admin/redes/conteudos",
  desenho: () => (
    <TelaEmAlta
      conteudos={[...CONTEUDOS].sort((a, b) => (b.vistos ?? 0) - (a.vistos ?? 0))}
      contas={CONTAS.map((c) => ({ id: c.id, rede: c.rede, nome: c.usuario }))}
      filtro={{ dias: 28, rede: null, grupo: null, ordem: "visualizacoes", todos: false }}
      periodos={[7, 28, 90]}
    />
  ),
};
export default demo;
