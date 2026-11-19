import type { Hoje } from "@/lib/painel/hoje";
import { TelaDoHoje } from "@/app/admin/(painel)/hoje/Tela";
import type { Demo } from "../tipos";

/** A tela Hoje com três coisas esperando: um cliente na Kommo, um caso de suporte e uma mensagem do chat. */
const hoje: Hoje = {
    avisoDaKommo: null,
    tarefas: [
      {
        chave: "kommo", tipo: "tarefa", fonte: "kommo", tom: "ruim",
        titulo: "2 clientes esperando você na Kommo",
        motivo: "A conversa chegou e ninguém respondeu ainda.",
        espera: "3 h", minutos: 180,
        botao: { href: "/admin/hoje", rotulo: "Abrir na Kommo" },
        itens: [
          { chave: "k1", texto: "Cliente Exemplo Um", apoio: "Esperando há 3 h", href: null, externo: false },
          { chave: "k2", texto: "Cliente Exemplo Dois", apoio: "Esperando há 40 min", href: null, externo: false },
        ],
      },
      {
        chave: "suporte", tipo: "tarefa", fonte: "suporte", tom: "atencao",
        titulo: "Seu caso de suporte foi fechado",
        motivo: "O gerente deixou uma nota para você ler.",
        espera: "1 dia", minutos: 1440,
        botao: { href: "/admin/suporte", rotulo: "Ler a nota" },
        itens: [],
      },
      {
        chave: "chat", tipo: "tarefa", fonte: "chat", tom: "neutro",
        titulo: "Uma mensagem pede sua resposta no chat",
        motivo: "Alguém do time marcou você na sala Vendas.",
        espera: "20 min", minutos: 20,
        botao: { href: "/admin/chat", rotulo: "Abrir o chat" },
        itens: [],
      },
    ],
    convites: [
      {
        chave: "oport", tipo: "convite", fonte: "vendas", tom: "bom",
        titulo: "3 clientes valem uma mensagem esta semana",
        motivo: "Aniversário de namoro chegando.",
        espera: null, minutos: null,
        botao: { href: "/admin/oportunidades", rotulo: "Ver oportunidades" },
        itens: [],
      },
    ],
};

const demo: Demo = {
  caminho: "/admin/hoje",
  desenho: () => <TelaDoHoje nome="Vendedor" dia="quinta, 19 de novembro" hoje={hoje} depois={[]} />,
};
export default demo;
