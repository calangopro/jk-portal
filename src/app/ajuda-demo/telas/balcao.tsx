import { TelaDoBalcao } from "@/app/admin/(painel)/balcao/Tela";
import type { Demo } from "../tipos";
import { PEDIDOS_DE_EXEMPLO, VENDEDORES_DE_EXEMPLO } from "./balcao-exemplo";

const demo: Demo = {
  caminho: "/admin/balcao",
  desenho: () => <TelaDoBalcao lista={PEDIDOS_DE_EXEMPLO} vendedores={VENDEDORES_DE_EXEMPLO} loja="JK Granja" minhaLoja="JK Granja" lojas={["JK Granja", "JK Raposo"]} busca="" semLoja={false} hoje="2026-11-20" />,
};
export default demo;
