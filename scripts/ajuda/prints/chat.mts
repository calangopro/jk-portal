import type { Print } from "../prints.mts";

const prints: Print[] = [
  { arquivo: "chat-1", demo: "chat", alvos: { salas: "text=Geral >> nth=0", escrever: "textarea", pede: 'button:has-text("Pedir resposta")' } },
  { arquivo: "chat-2", demo: "chat", antes: async (p: any) => { await p.locator("textarea").click(); await p.locator("textarea").pressSequentially("@Ger"); await p.waitForTimeout(500); }, alvos: { lista: "[role=listbox]" } },
  { arquivo: "chat-3", demo: "chat", celular: true },
];
export default prints;
