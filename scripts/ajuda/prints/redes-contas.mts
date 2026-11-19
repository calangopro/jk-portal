import type { Print } from "../prints.mts";

const prints: Print[] = [
  { arquivo: "redes-contas-1", demo: "redes-contas", nivel: "diretoria", alvos: { botoes: 'button:has-text("Ler agora")', claude: 'a:has-text("Usar pelo Claude")', ligar: 'a:has-text("Ligar em Integrações")', lista: "ul.mt-6, div.mt-6 > ul", ig: "li.glass >> nth=0", yt: "li.glass >> nth=2", vencida: "text=O acesso foi retirado" } },
  { arquivo: "redes-contas-2", demo: "redes-contas-sem-ligar", nivel: "diretoria", alvos: { botoes: 'button:has-text("Ler agora")', claude: 'a:has-text("Usar pelo Claude")', aviso: "text=Ligar e desligar conta é de administrador" } },
];
export default prints;
