import type { Tutorial } from "../tipos.ts";

export const redesIdeias: Tutorial = {
  href: "/admin/redes/ideias",
  resumo: "Guarde o que postar num lugar só, tire ideias do que deu certo e transforme cada uma em post.",
  versoes: {
    todos: [
      {
        titulo: "Guarde uma ideia em uma linha",
        texto: "Escreva a ideia no campo de cima. Se já souber, escolha o dia e o formato. Toque em Guardar e ela entra na coluna Para fazer.",
        print: "redes-ideias-1.webp",
        regiao: { x: 24.4, y: 32.4, l: 73.1, a: 19.5 },
        alt: "Campo Nova ideia com o dia, o formato e o botão Guardar.",
      },
      {
        titulo: "Acompanhe pelas colunas",
        texto: "As ideias andam por quatro colunas: Para fazer, Em produção, Agendadas e Publicadas. As duas últimas mudam sozinhas quando o post ligado à ideia é agendado e publicado.",
        print: "redes-ideias-1.webp",
        regiao: { x: 24.4, y: 54.8, l: 73.1, a: 40 },
        alt: "As quatro colunas de ideias com um cartão em cada.",
      },
      {
        titulo: "Transforme a ideia em post",
        texto: "No cartão, toque em Virar post. O compositor abre com a ideia ao lado, já no formato e no dia dela. Depois de salvar, post e ideia ficam ligados.",
        print: "redes-ideias-1.webp",
        regiao: { x: 24.4, y: 57.8, l: 17.3, a: 27.7 },
        alt: "Cartão de uma ideia com os botões Virar post, Editar e Em produção.",
      },
      {
        titulo: "Tire ideia do que já rendeu",
        texto: "Em Fazer de novo ficam os posts que passaram do normal nos últimos 30 dias. Toque em Guardar para virar uma ideia na coluna Para fazer.",
        print: "redes-ideias-2.webp",
        regiao: { x: 24.4, y: 55.7, l: 23.4, a: 38.4 },
        alt: "Cartão Fazer de novo com dois posts acima do normal e o botão Guardar.",
      },
      {
        titulo: "Responda uma pergunta com um post",
        texto: "Perguntas nos comentários mostra o que perguntaram nos últimos 30 dias, sem o nome de quem escreveu. Toque em Escrever a ideia e o texto vai para o campo de cima.",
        print: "redes-ideias-2.webp",
        regiao: { x: 49.2, y: 55.7, l: 23.4, a: 38.4 },
        alt: "Cartão Perguntas nos comentários com duas perguntas e o link Escrever a ideia.",
      },
      {
        titulo: "Planeje as datas que vêm aí",
        texto: "Datas que vêm aí lista as campanhas da casa e as datas do comércio dos próximos 60 dias. Toque em Planejar e o nome da data vai para o campo de cima.",
        print: "redes-ideias-2.webp",
        regiao: { x: 73.9, y: 55.7, l: 23.4, a: 38.4 },
        alt: "Cartão Datas que vêm aí com Black Friday e outras datas e o botão Planejar.",
      },
    ],
  },
};
