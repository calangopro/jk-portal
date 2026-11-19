import type { Print } from "../prints.mts";

const rolar = async (p: any) => {
  await p.evaluate(() => (document.querySelector("main") ?? window).scrollTo?.(0, 520));
  await p.evaluate(() => window.scrollTo(0, 520));
  await p.waitForTimeout(200);
};

const prints: Print[] = [
  { arquivo: "redes-hoje-1", demo: "redes-hoje", nivel: "diretoria", alvos: { botoes: 'a:has-text("Story")', saindo: 'h2:has-text("Saindo nas próximas")', comentarios: 'h2:has-text("Comentários esperando")', alta: 'h2:has-text("Em alta nos")' } },
  { arquivo: "redes-hoje-2", demo: "redes-hoje", nivel: "diretoria", antes: rolar, alvos: { periodo: 'nav[aria-label="Período"]', total: 'section[aria-label="Total das redes"]', conta: "text=Rede por rede" } },
];
export default prints;
