"use client";

import { TelaDoChat } from "@/app/admin/(painel)/chat/Tela";
import type { ApiDoChat } from "@/app/admin/(painel)/chat/api";
import type { Abertura, Mensagem, Presenca } from "@/lib/time/chat";
import type { Ligacao } from "@/lib/time/ao-vivo";

/**
 * O chat do time com conversa inventada e uma ligação de mentira, só para os
 * prints do tutorial. É componente de cliente porque a tela recebe funções
 * (`api`), que não atravessam do servidor. Nada aqui fala com o banco.
 */
const m = (id: number, sala: Mensagem["sala"], autor: string, nome: string, papel: string, texto: string, hora: string, extra: Partial<Mensagem> = {}): Mensagem => ({
  id, sala, autor, autorNome: nome, autorPapel: papel, texto, apagada: false, respondeA: null, pede: false, esperandoDesde: null, atendidaEm: null, atendidaPorNome: null,
  respostas: 0, naBiblioteca: null, em: `2026-11-19T${hora}:00Z`, mudou: `2026-11-19T${hora}:00Z`, anexos: [], ...extra,
});

const abertura: Abertura = {
  agora: "2026-11-19T13:00:00Z",
  setores: ["geral", "vendas"],
  lidas: { geral: 3, vendas: 1 },
  janelas: {},
  pessoas: [
    { id: "eu", nome: "Vendedor Exemplo", papel: "vendas" },
    { id: "g", nome: "Gerente Exemplo", papel: "gerente" },
    { id: "f", nome: "Fábrica Exemplo", papel: "fabrica" },
  ],
  mensagens: [
    m(1, "geral", "g", "Gerente Exemplo", "gerente", "Bom dia, time. O malote de hoje sai às 18h.", "11:00"),
    m(2, "geral", "f", "Fábrica Exemplo", "fabrica", "Os pedidos pagos até as 14h entram na produção de amanhã.", "11:20"),
    m(3, "geral", "g", "Gerente Exemplo", "gerente", "Lembrete: marquem os pedidos do site que vocês venderam.", "12:00"),
    m(4, "vendas", "g", "Gerente Exemplo", "gerente", "Quem atendeu o Cliente Exemplo Um? Ele pergunta do prazo da aliança.", "12:30", { pede: true, esperandoDesde: "2026-11-19T12:30:00Z" }),
    m(5, "vendas", "eu", "Vendedor Exemplo", "vendas", "Fui eu. A aliança fica pronta em 2 dias úteis, já avisei o cliente.", "12:40", { respondeA: { id: 4, autor: "g", autorNome: "Gerente Exemplo", trecho: "Quem atendeu o Cliente Exemplo Um?", apagada: false, imagens: 0 } }),
  ],
};

const ligacao: Ligacao = {
  estado: "ao_vivo",
  presenca: new Map<string, Presenca>([["eu", "online"], ["g", "online"]]),
};

const api: ApiDoChat = {
  abrir: async () => abertura,
  sincronizar: async () => ({ cheio: false, lidas: {}, mensagens: [] }),
  anteriores: async () => ({ mensagens: [], temMais: false }),
  enviar: async () => ({ ok: false, erro: "Demonstração: nada é enviado." }),
  resolver: async () => ({ ok: false, erro: "Demonstração." }),
  pedir: async () => ({ ok: false, erro: "Demonstração." }),
  apagar: async () => ({ ok: false, erro: "Demonstração." }),
  marcarLida: async () => {},
  subirImagens: async () => ({ ok: false, erro: "Demonstração." }),
  links: async () => ({}),
  guardarNaBiblioteca: async () => ({ ok: false, erro: "Demonstração." }),
  avisar: () => {},
  buscarPedidos: async () => [],
  previaDoPedido: async () => null,
};

export default function ChatDeExemplo({ podeMeta }: { podeMeta: boolean }) {
  return (
    <TelaDoChat
      abertura={abertura}
      meuId="eu"
      souAdmin={false}
      salaInicial="vendas"
      rascunho=""
      pedirDeInicio={false}
      destaqueInicial={null}
      podeMeta={podeMeta}
      api={api}
      ligacaoDaPrevia={ligacao}
      avisoDaPrevia="desligado"
    />
  );
}
