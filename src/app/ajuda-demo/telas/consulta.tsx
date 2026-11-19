import { TelaDaConsulta } from "@/app/admin/(painel)/consulta/Tela";
import type { Aviso, LojaDaConsulta, ProdutoDaConsulta } from "@/lib/consulta/dados";
import type { Demo } from "../tipos";

const p = (n: number, nome: string, preco: number, extra: Partial<ProdutoDaConsulta> = {}): ProdutoDaConsulta => ({
  id: `prod-${n}`, codigo: String(1000 + n), nome, modelo: "Modelo Exemplo", categoria: "Alianças de casamento", url: "#", foto: null, miniatura: null,
  preco, precoCheio: null, desconto: null, disponivel: true, disponibilidade: "Disponível em 2 dias úteis", diasUteis: 2, vendidos: 10 - n, ...extra,
});

const produtos = [
  p(1, "Par de alianças de ouro 18k, 4 mm", 3000),
  p(2, "Par de alianças de prata, 4 mm", 1000, { precoCheio: 1250, desconto: 20 }),
  p(3, "Par de alianças de namoro de aço", 500, { diasUteis: 1, disponibilidade: "Disponível em 1 dia útil" }),
  p(4, "Anel solitário de ouro 18k", 2000, { categoria: "Anéis", diasUteis: 3, disponibilidade: "Disponível em 3 dias úteis" }),
];

const lojas: LojaDaConsulta[] = [
  { id: "l1", slug: "centro", nome: "Loja Exemplo Centro", shopping: null, cidade: "Cidade Exemplo", endereco: "Rua Exemplo, 100", telefone: null, whatsapp: null, mapa: null },
  { id: "l2", slug: "shopping", nome: "Loja Exemplo Shopping", shopping: "Shopping Exemplo", cidade: "Cidade Exemplo", endereco: "Av. Exemplo, 200", telefone: null, whatsapp: null, mapa: null },
];

const quadro: Aviso[] = [
  { loja: "Loja Exemplo Centro", produto: "prod-1", tem: true, numeracoes: "12 a 20", observacao: null, por: "Vendedor Exemplo", em: "2026-11-19T10:00:00Z" },
];

const demo: Demo = {
  caminho: "/admin/consulta",
  desenho: () => (
    <TelaDaConsulta
      produtos={produtos}
      lojas={lojas}
      quadro={quadro}
      regras={{ diasDoMalote: [3, 5], horaDoMalote: 20, confirmadas: true }}
      hoje="2026-11-19"
      informar={async () => {
        "use server";
        return { ok: true as const };
      }}
    />
  ),
};
export default demo;
