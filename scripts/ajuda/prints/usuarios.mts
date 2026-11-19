import type { Print } from "../prints.mts";

const naLista = async (p: any) => {
  await p.locator("table").evaluate((e: Element) => e.scrollIntoView({ block: "start" }));
  await p.waitForTimeout(200);
};

const prints: Print[] = [
  {
    arquivo: "usuarios-1",
    demo: "usuarios",
    nivel: "diretoria",
    alvos: {
      convite: 'h2:has-text("Convidar pessoa")',
      email: 'input[name="email"]',
      nome: 'input[name="full_name"]',
      papel: 'select[name="role"]',
      enviar: 'button:has-text("Enviar convite")',
    },
  },
  {
    arquivo: "usuarios-2",
    demo: "usuarios",
    nivel: "diretoria",
    antes: naLista,
    alvos: {
      lista: "table",
      papelDaLinha: 'select[name="role"] >> nth=1',
      salvar: 'button:has-text("Salvar") >> nth=1',
      reenviar: 'button:has-text("Reenviar convite")',
      semSenha: "text=Ainda não criou a senha",
      desativar: 'button:has-text("Desativar") >> nth=0',
    },
  },
];
export default prints;
