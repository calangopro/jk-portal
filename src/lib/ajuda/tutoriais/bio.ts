import type { Tutorial } from "../tipos.ts";

export const bio: Tutorial = {
  href: "/admin/bio",
  resumo: "Monte a página do link da bio, com uma versão para o dia a dia e uma para cada campanha, e publique quando estiver pronta.",
  versoes: {
    todos: [
      {
        titulo: "Escolha qual versão editar",
        texto: "A aba Normal é a bio de todo dia. Cada campanha tem a sua aba, com blocos, cores e datas próprias. A bolinha verde mostra a que está no ar agora.",
        print: "bio-1.webp",
        regiao: { x: 24.4, y: 51.9, l: 38.6, a: 14 },
        alt: "Abas Normal e Campanha Exemplo acima da lista de blocos.",
      },
      {
        titulo: "Abra um cartão e edite",
        texto: "Cada cartão é uma faixa da bio. Abra, mude o texto e o link, e olhe o celular ao lado: a prévia muda enquanto você escreve.",
        print: "bio-1.webp",
        regiao: { x: 24.4, y: 76, l: 38.6, a: 24 },
        alt: "Cartão de links aberto, com os campos de rótulo e destino.",
      },
      {
        titulo: "Arraste, oculte ou adicione blocos",
        texto: "Arraste pela alça para reordenar e use o olho para ocultar sem apagar. Embaixo, os botões Adicionar nesta aba incluem links, vitrine, oferta ou lojas.",
        print: "bio-3.webp",
        regiao: { x: 24.4, y: 26.5, l: 38.6, a: 35 },
        alt: "Blocos fechados com alça e olho, e os botões de adicionar bloco.",
      },
      {
        titulo: "Monte uma campanha",
        texto: "Em Nova campanha, dê um nome, escolha as cores e as datas de começo e fim. Ela entra e sai do ar sozinha. Deixe desligada enquanto monta.",
        print: "bio-2.webp",
        regiao: { x: 24.4, y: 27.3, l: 38.6, a: 31.9 },
        alt: "Cartão da campanha com nome, visual, datas e a caixa Campanha ligada.",
      },
      {
        titulo: "Toque em Publicar",
        texto: "Nada vai ao ar antes disso. Publicar leva a bio inteira, com as campanhas. Ver a bio no ar abre a página de verdade, e Voltar à de fábrica desfaz tudo.",
        print: "bio-1.webp",
        regiao: { x: 25.7, y: 29.3, l: 29, a: 4 },
        alt: "Botões Publicar, Ver a bio no ar e Voltar à de fábrica.",
      },
      {
        titulo: "Copie o link para divulgar",
        texto: "O link é um só para todo lugar: a bio descobre sozinha se a pessoa veio do Instagram, do TikTok ou de outro canal. Toque em Copiar e cole onde quiser.",
        print: "bio-3.webp",
        regiao: { x: 24.4, y: 66.5, l: 38.6, a: 33 },
        alt: "Cartão Link para divulgar, com o endereço da bio e o botão Copiar.",
      },
    ],
  },
};
