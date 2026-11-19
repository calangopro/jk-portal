import type { Print } from "../prints.mts";

const outroDia = async (p: any) => {
  await p.getByRole("button", { name: /terça, 24 de novembro/i }).click();
  await p.waitForTimeout(250);
};

const prints: Print[] = [
  { arquivo: "redes-calendario-1", demo: "redes-calendario", nivel: "diretoria", alvos: { grade: 'section[aria-label^="Calendário de"]', mes: 'section[aria-label^="Calendário de"] h2', legenda: "text=ideia >> nth=0", novo: 'a:has-text("Novo post")' } },
  { arquivo: "redes-calendario-2", demo: "redes-calendario", nivel: "diretoria", antes: outroDia, alvos: { dia: "#t-dia", criar: "text=Criar para este dia", botoes: 'a:has-text("Post às") >> nth=0', horario: "text=Melhor faixa pelo histórico" } },
];
export default prints;
