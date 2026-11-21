import { PedidoDoBalcaoNaTela } from "@/app/admin/(painel)/balcao/[id]/Pedido";
import type { Demo } from "../tipos";
import { PEDIDOS_DE_EXEMPLO } from "./balcao-exemplo";

const demo: Demo = {
  caminho: "/admin/balcao",
  desenho: () => <PedidoDoBalcaoNaTela inicial={PEDIDOS_DE_EXEMPLO[0]} hoje="2026-11-20" salvo={null} aviso={null} />,
};
export default demo;
