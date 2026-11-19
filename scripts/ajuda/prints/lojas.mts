import type { Print } from "../prints.mts";

const prints: Print[] = [
  { arquivo: "lojas-1", demo: "lojas", nivel: "gerente", alvos: { nova: 'button:has-text("Nova loja")', primeira: "li >> nth=0", botoes: 'a:has-text("Editar") >> nth=0', falta: "text=Falta endereço", terceira: "li >> nth=2" } },
];
export default prints;
