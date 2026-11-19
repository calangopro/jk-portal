import type { Tutorial } from "../tipos.ts";

export const metricas: Tutorial = {
  href: "/admin/metricas",
  resumo: "Quantas pessoas leem o site, de onde vêm e o que o Google mostra sobre a JK.",
  versoes: {
    todos: [
      {
        titulo: "Escolha o período",
        texto: "Toque em 7, 28 ou 90 dias para mudar o período das visitas. Os números vêm do Google Analytics, até ontem, e se atualizam de hora em hora.",
        print: "metricas-1.webp",
        regiao: { x: 79.9, y: 36.4, l: 17.6, a: 4.8 },
        alt: "Botões 7 dias, 28 dias e 90 dias no topo das visitas.",
      },
      {
        titulo: "Leia os quatro cartões",
        texto: "Pessoas e visualizações mostram o tamanho da leitura, e a seta de variação compara com o período anterior. Os cliques para a loja dizem quanto do site leva à compra.",
        print: "metricas-1.webp",
        regiao: { x: 24.4, y: 43.6, l: 73.1, a: 20.4 },
        alt: "Cartões de pessoas, visualizações, tempo médio e cliques para a loja.",
      },
      {
        titulo: "Veja de onde vieram",
        texto: "As barras mostram a origem das visitas: busca, redes, anúncios, direto. Ao lado, a lista de visitas vindas de respostas de IA, que mostra se o conteúdo está sendo citado.",
        print: "metricas-1.webp",
        regiao: { x: 24.4, y: 67, l: 73.1, a: 26.4 },
        alt: "Visitas por origem e visitas vindas de respostas de IA.",
      },
      {
        titulo: "Ataque o que está perto da primeira página",
        texto: "Em Search Console, a lista Perto da primeira página traz as buscas em posição 8 a 20 com volume. É onde um ajuste de conteúdo rende mais rápido.",
        print: "metricas-2.webp",
        regiao: { x: 24.4, y: 42.4, l: 35.8, a: 27.4 },
        alt: "Lista de consultas em posição de segunda página, com impressões.",
      },
      {
        titulo: "Melhore o título de quem não é clicado",
        texto: "A lista Aparece, mas não clicam mostra buscas com muita impressão e CTR abaixo de 1%. Em geral o título e a descrição do post precisam de trabalho.",
        print: "metricas-2.webp",
        regiao: { x: 61.7, y: 42.4, l: 35.8, a: 27.4 },
        alt: "Lista de consultas com muita impressão e pouco clique.",
      },
      {
        titulo: "Importe os dados do Google",
        texto: "O Search Console automático traz os últimos 28 dias toda segunda. Para trazer na hora, ou de outro período, use Importar do Search Console com o arquivo CSV exportado.",
        print: "metricas-3.webp",
        regiao: { x: 24.4, y: 49, l: 36, a: 45 },
        alt: "Caixa Importar do Search Console, com período e escolha do arquivo CSV.",
      },
    ],
  },
};
