import type { Demo } from "../tipos";
import ChatDeExemplo from "./chat-cliente";

const demo: Demo = {
  caminho: "/admin/chat",
  desenho: (nivel) => <ChatDeExemplo podeMeta={nivel !== "vendas"} />,
};
export default demo;
