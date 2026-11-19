import type { Print } from "../prints.mts";

/** Abre a resposta da segunda avaliação (5 estrelas) e escolhe o começo pronto. */
const responder = async (p: any) => {
  await p.getByRole("button", { name: "Responder" }).nth(1).click();
  await p.locator("button.rounded-full.text-left").first().click();
  await p.waitForTimeout(200);
};
const conferir = async (p: any) => {
  await responder(p);
  await p.getByRole("button", { name: "Conferir antes de publicar" }).click();
  await p.getByText("Vai sair assim no Google").waitFor();
  await p.waitForTimeout(200);
};

const prints: Print[] = [
  { arquivo: "avaliacoes-1", demo: "avaliacoes", nivel: "gerente", alvos: { resumo: "text=3 avaliações sem resposta", loja: "li >> nth=0", selo: "text=Nota baixa >> nth=0", horario: "text=Horário no Google", usar: 'button:has-text("Usar este horário")', cartaoNota: "text=Cliente Exemplo Um" } },
  { arquivo: "avaliacoes-2", demo: "avaliacoes", nivel: "gerente", antes: responder, alvos: { caixa: "textarea", conferir: 'button:has-text("Conferir antes de publicar")' } },
  { arquivo: "avaliacoes-3", demo: "avaliacoes", nivel: "gerente", antes: conferir, alvos: { previa: "text=Vai sair assim no Google", publicar: 'button:has-text("Publicar no Google")', voltar: 'button:has-text("Voltar e editar")' } },
];
export default prints;
