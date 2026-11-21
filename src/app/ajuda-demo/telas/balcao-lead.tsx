import { LeadDoBalcaoNaTela } from "@/app/admin/(painel)/balcao/lead/Lead";
import type { Demo } from "../tipos";
import { VENDEDORES_DE_EXEMPLO } from "./balcao-exemplo";

const demo: Demo = {
  caminho: "/admin/balcao",
  desenho: () => <LeadDoBalcaoNaTela loja="JK Granja" vendedores={VENDEDORES_DE_EXEMPLO} kommoLigada />,
};
export default demo;
