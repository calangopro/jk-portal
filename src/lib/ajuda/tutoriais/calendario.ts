import type { Tutorial } from "../tipos.ts";

export const calendario: Tutorial = {
  href: "/admin/calendario",
  resumo: "O mês numa grade: o que já foi ao ar, o que está marcado e onde estão os buracos.",
  versoes: {
    todos: [
      {
        titulo: "Procure os buracos",
        texto: "A grade mostra cada dia do mês. Os dias vazios são o ponto: três semanas sem nada publicado passam despercebidas numa lista, e aqui aparecem na cara.",
        print: "calendario-1.webp",
        regiao: { x: 24.4, y: 52.2, l: 73.1, a: 47.8 },
        alt: "Grade do mês com posts publicados e agendados em alguns dias.",
      },
      {
        titulo: "Leia as cores",
        texto: "Escuro é o que já foi ao ar. Dourado é o que está agendado. Rosa é o que passou da hora e não entrou. O dia de hoje fica com a borda dourada.",
        print: "calendario-2.webp",
        regiao: { x: 24.4, y: 61.5, l: 52.5, a: 5 },
        alt: "Legenda das cores: publicado, agendado e passou da hora.",
      },
      {
        titulo: "Resolva o que passou da hora",
        texto: "Se um post marcado não entrou no ar, um aviso vermelho aparece no topo. Abra o post: o motivo da recusa, como a falta de uma fonte, fica escrito lá.",
        print: "calendario-1.webp",
        regiao: { x: 24.4, y: 34.2, l: 73.1, a: 6.8 },
        alt: "Aviso dizendo que uma página passou da hora marcada e não entrou no ar.",
      },
      {
        titulo: "Mude de mês",
        texto: "Use Mês anterior e Próximo mês para ver outros meses. Toque em Hoje para voltar ao mês atual.",
        print: "calendario-1.webp",
        regiao: { x: 71.7, y: 44.9, l: 25.8, a: 4.8 },
        alt: "Botões Mês anterior, Hoje e Próximo mês.",
      },
      {
        titulo: "Pegue o próximo da lista",
        texto: "Escrito, sem data lista os rascunhos que ainda não têm dia. Abra um deles e marque a hora de sair. É daqui que vem o próximo agendamento.",
        print: "calendario-2.webp",
        regiao: { x: 24.4, y: 71.1, l: 35.3, a: 23 },
        alt: "Lista de rascunhos sem data marcada.",
      },
      {
        titulo: "Veja as pautas esperando",
        texto: "Ao lado ficam as pautas decididas e ainda não escritas. Toque em Ver a fila para abrir a tela de Pautas e transformar uma delas em rascunho.",
        print: "calendario-2.webp",
        regiao: { x: 62.2, y: 71.1, l: 35.3, a: 23 },
        alt: "Lista de pautas decididas que ainda não viraram texto.",
      },
    ],
  },
};
