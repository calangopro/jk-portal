import type { Print } from "../prints.mts";

const prints: Print[] = [
  { arquivo: "tutor-1", demo: "tutor", alvos: { campo: "textarea", botoes: "button" } },
  {
    arquivo: "tutor-2", demo: "tutor",
    antes: async (p: any) => {
      await p.locator("textarea").fill("O cliente pergunta se a aliança de prata escurece e como cuidar.");
      await p.getByRole("button", { name: /Perguntar/ }).first().click();
      await p.waitForTimeout(1500);
    },
    alvos: { resposta: "text=Para você", frase: "text=Para o cliente" },
  },
];
export default prints;
