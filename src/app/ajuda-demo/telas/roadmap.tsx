import type { Demo } from "../tipos";
import { QuadroDeExemplo } from "./roadmap-cliente";

/** Tela só da diretoria. As ações são de mentira e rodam no navegador (veja roadmap-cliente.tsx), sem tocar em nada. */
const demo: Demo = {
  caminho: "/admin/roadmap",
  desenho: () => <QuadroDeExemplo />,
};
export default demo;
