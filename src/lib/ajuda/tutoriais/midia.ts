import type { Tutorial } from "../tipos.ts";

export const midia: Tutorial = {
  href: "/admin/midia",
  resumo: "A biblioteca de imagens do site, com texto alternativo, legenda e crédito de cada uma.",
  versoes: {
    todos: [
      {
        titulo: "Envie as imagens",
        texto: "Arraste os arquivos para a caixa ou toque em Escolher imagens. Prefira WebP ou AVIF. O nome do arquivo vira o endereço da imagem, e isso ajuda na busca por imagens.",
        print: "midia-1.webp",
        regiao: { x: 24.4, y: 32, l: 73.1, a: 26.5 },
        alt: "Caixa de envio com o botão Escolher imagens.",
      },
      {
        titulo: "Ache as imagens sem alt",
        texto: "O aviso vermelho conta quantas imagens estão sem texto alternativo. Cada uma aparece marcada com Falta o alt. Sem ele, a imagem não ajuda no Google e falha em acessibilidade.",
        print: "midia-1.webp",
        regiao: { x: 24.4, y: 61.2, l: 73.1, a: 15 },
        alt: "Aviso de imagens sem texto alternativo e uma imagem marcada com Falta o alt.",
      },
      {
        titulo: "Escreva o texto alternativo",
        texto: "Descreva a imagem para quem não consegue vê-la, com palavras simples. É obrigatório: sem ele a imagem não pode virar capa.",
        print: "midia-2.webp",
        regiao: { x: 25.7, y: 40, l: 20.5, a: 9 },
        alt: "Campo Texto alternativo no cartão de uma imagem.",
      },
      {
        titulo: "Deixe a IA ajudar no alt",
        texto: "Toque em Descrever com IA e ela lê a foto e escreve uma sugestão. Leia antes de salvar e corrija o que não for exato.",
        print: "midia-2.webp",
        regiao: { x: 25.7, y: 50, l: 20.5, a: 4.6 },
        alt: "Botão Descrever com IA abaixo do campo de texto alternativo.",
      },
      {
        titulo: "Preencha legenda e crédito",
        texto: "A legenda aparece embaixo da imagem no post. Em Crédito ou fonte, diga de onde a foto veio, principalmente quando não é da JK.",
        print: "midia-2.webp",
        regiao: { x: 25.7, y: 59.5, l: 20.5, a: 8 },
        alt: "Campos Legenda e Crédito ou fonte do cartão de uma imagem.",
      },
      {
        titulo: "Salve e copie o endereço",
        texto: "Toque em Salvar para guardar as mudanças. Copiar URL leva o endereço da imagem para a área de transferência. Desativar guarda a imagem sem apagar o arquivo.",
        print: "midia-2.webp",
        regiao: { x: 25.7, y: 83.5, l: 20.5, a: 4.8 },
        alt: "Botões Salvar e Copiar URL no fim do cartão.",
      },
    ],
  },
};
