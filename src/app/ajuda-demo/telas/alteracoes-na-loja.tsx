import { TelaDeAlteracoes, type Linha } from "@/app/admin/(painel)/alteracoes-na-loja/Tela";
import type { Demo } from "../tipos";

const base = { loja: "jk" as const, recurso: "produto" as const, antes: {}, depois: {}, erro: null, feita_por: "pessoa-1" };
const linhas: Linha[] = [
  { ...base, id: 3, feita_em: "2026-11-19T14:10:00Z", recurso_id: "1002", rotulo: "Par de alianças de ouro 18k abauladas", antes: { estoque: 5 }, depois: { estoque: 8 }, resultado: "ok" },
  { ...base, id: 2, feita_em: "2026-11-19T11:30:00Z", recurso_id: "1001", rotulo: "Par de alianças de ouro 18k", antes: { preco: 3000, promocional: null }, depois: { preco: 3000, promocional: 2700 }, resultado: "ok" },
  { ...base, id: 1, feita_em: "2026-11-18T16:45:00Z", recurso_id: "1004", rotulo: "Par de alianças de prata", antes: { preco: 500 }, depois: { preco: 5000 }, resultado: "recusada", erro: "A Tray recusou o valor enviado para o preço. Confira o preço e tente de novo." },
];

const demo: Demo = {
  caminho: "/admin/alteracoes-na-loja",
  desenho: () => <TelaDeAlteracoes linhas={linhas} nomes={{ "pessoa-1": "Gerente Exemplo" }} erro={false} />,
};
export default demo;
