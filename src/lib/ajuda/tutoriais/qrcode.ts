import type { Tutorial } from "../tipos.ts";

export const qrcode: Tutorial = {
  href: "/admin/qrcode",
  resumo: "Crie um QR code para cada lugar onde vai adesivo, troque o destino sem reimprimir e veja quantas vezes cada um foi lido.",
  versoes: {
    todos: [
      {
        titulo: "Veja os QR codes e as leituras",
        texto: "Cada linha é um lugar com adesivo. A tabela mostra para onde ele leva e quantas leituras teve hoje, em 7 dias, em 30 dias e no total.",
        print: "qrcode-1.webp",
        regiao: { x: 24.5, y: 35.3, l: 73, a: 28.6 },
        alt: "Tabela com os QR codes, o destino de cada um e as leituras.",
      },
      {
        titulo: "Toque em Novo QR code e dê o nome",
        texto: "Crie um QR para cada lugar, assim você sabe de onde vem cada contato. O nome é só para você. O endereço vai dentro do QR e não muda depois, porque vai impresso.",
        print: "qrcode-2.webp",
        regiao: { x: 25.7, y: 11.5, l: 50, a: 25 },
        alt: "Campos Nome do lugar e Endereço do QR.",
      },
      {
        titulo: "Escolha para onde ele leva",
        texto: "WhatsApp abre a conversa com a mensagem já escrita: cite o lugar nela, para o atendimento saber de onde veio. Outro link serve para a bio ou uma página. Depois toque em Criar QR code.",
        print: "qrcode-2.webp",
        regiao: { x: 25.7, y: 39, l: 50, a: 53 },
        alt: "Opções WhatsApp e Outro link, número, mensagem pronta e o botão Criar QR code.",
      },
      {
        titulo: "Baixe a arte para a gráfica",
        texto: "Na página do QR, baixe em SVG, que não perde nitidez em tamanho nenhum, ou em PNG. Deixe o QR com pelo menos 2,5 cm de lado e borda branca em volta.",
        print: "qrcode-3.webp",
        regiao: { x: 24.4, y: 31.7, l: 21, a: 44 },
        alt: "Arte do QR com o endereço e os botões SVG e PNG.",
      },
      {
        titulo: "Troque o destino quando precisar",
        texto: "Mude o número, a mensagem ou o link e toque em Salvar. O adesivo já impresso passa a levar ao destino novo. Testar este destino abre o link para você conferir.",
        print: "qrcode-3.webp",
        regiao: { x: 49.5, y: 29, l: 48, a: 70 },
        alt: "Formulário do QR com nome, destino, número e mensagem, e o botão Salvar.",
      },
      {
        titulo: "Acompanhe as leituras",
        texto: "Cada QR conta as leituras por dia, separadas de iPhone e Android. Dá para ver se o adesivo de um lugar está funcionando e comparar com os outros.",
        print: "qrcode-4.webp",
        regiao: { x: 24.4, y: 25, l: 73.1, a: 58 },
        alt: "Números de leituras e gráfico das leituras por dia nos últimos 30 dias.",
      },
    ],
  },
};
