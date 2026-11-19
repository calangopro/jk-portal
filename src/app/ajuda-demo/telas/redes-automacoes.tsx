import { TelaDeAutomacoes } from "@/app/admin/(painel)/redes/automacoes/Tela";
import { ehAdmin } from "@/lib/auth/acessos";
import type { AutomacaoNaTela } from "@/lib/redes/automacoes";
import type { Demo } from "../tipos";

const regras: AutomacaoNaTela[] = [
  {
    id: "r1", nome: "Catálogo", contaId: "c-ig", rede: "instagram", conta: "@exemplo", publicacaoId: null, publicacao: null,
    palavras: ["catálogo", "modelos"], resposta: "Oi! O catálogo completo está no link da bio. Qualquer dúvida, é só chamar.",
    esperaMin: 30, limitePorHora: 20, ativa: false, ativadaEm: null, ativadaPor: null, criadaPor: "Social Media Exemplo", respondidas: 0, falhas: 0, contaPronta: true,
  },
  {
    id: "r2", nome: "Entrega", contaId: "c-fb", rede: "facebook", conta: "Página Exemplo", publicacaoId: null, publicacao: null,
    palavras: ["entrega", "frete"], resposta: "Olá! Entregamos em todo o Brasil. Os detalhes de prazo ficam na página do produto.",
    esperaMin: 60, limitePorHora: 10, ativa: true, ativadaEm: "2026-11-10T13:00:00Z", ativadaPor: "Diretoria Exemplo", criadaPor: "Social Media Exemplo", respondidas: 12, falhas: 0, contaPronta: true,
  },
];

const ok = async () => {
  "use server";
  return { ok: true as const, aviso: "Pronto." };
};

const demo: Demo = {
  caminho: "/admin/redes/automacoes",
  desenho: (nivel) => (
    <TelaDeAutomacoes
      regras={regras}
      contas={[{ id: "c-ig", rede: "instagram", nome: "@exemplo", ativa: true }, { id: "c-fb", rede: "facebook", nome: "Página Exemplo", ativa: true }]}
      publicacoes={[]}
      podeLigar={ehAdmin(nivel)}
      acoes={{ salvar: ok, ligar: ok, desligar: ok, apagar: ok }}
    />
  ),
};
export default demo;
