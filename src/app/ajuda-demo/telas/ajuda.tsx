import { TelaDaAjuda } from "@/app/admin/(painel)/ajuda/Tela";
import type { Demo } from "../tipos";

const AREAS = ["time", "consulta", "lancar_venda"];
const demo: Demo = {
  caminho: "/admin/ajuda",
  desenho: (nivel) => <TelaDaAjuda papel={nivel} areas={nivel === "vendas" ? AREAS : [...AREAS, "vendas", "suporte"]} />,
};
export default demo;
