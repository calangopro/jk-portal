import type { Passo, Tutorial } from "../tipos.ts";

const texto = {
  estado: "Cada rede tem um cartão com o selo do estado: Ligada, Falta ligar ou Ligar de novo. Embaixo do selo ficam as contas ligadas.",
  conta: "Em cada conta aparece quando foi ligada, quando o painel leu pela última vez e o que ela libera, como ler números, publicar e ler comentários. Se faltar uma permissão, a tela escreve qual.",
  lerAgora: "O painel lê as contas sozinho, de meia em meia hora. Se quiser ver número novo já, toque em Ler agora e espere a leitura terminar.",
  claude: "Usar pelo Claude leva ao conector, que deixa o Claude consultar os números e montar posts por você. Quem cuida das redes usa só as operações das redes.",
};

const lerAgora = (print: string): Passo => ({
  titulo: "Peça uma leitura agora",
  texto: texto.lerAgora,
  print,
  regiao: { x: 24.4, y: 28.8, l: 8.7, a: 4.3 },
  alt: "Botão Ler agora no alto da tela.",
});

const claude = (print: string): Passo => ({
  titulo: "Use as redes pelo Claude",
  texto: texto.claude,
  print,
  regiao: { x: 33.7, y: 28.8, l: 12.2, a: 4.3 },
  alt: "Botão Usar pelo Claude ao lado de Ler agora.",
});

export const redesContas: Tutorial = {
  href: "/admin/redes/contas",
  resumo: "Veja quais redes estão ligadas ao painel, quando foram lidas e quais precisam ser ligadas de novo.",
  versoes: {
    todos: [
      {
        titulo: "Veja o estado de cada rede",
        texto: texto.estado,
        print: "redes-contas-2.webp",
        regiao: { x: 24.4, y: 41, l: 73.1, a: 33.6 },
        alt: "Cartões do Instagram e do Facebook, ambos com o selo Ligada.",
      },
      {
        titulo: "Leia o que cada conta libera",
        texto: texto.conta,
        print: "redes-contas-2.webp",
        regiao: { x: 24.4, y: 56, l: 35.9, a: 10.5 },
        alt: "Conta do Instagram com a data em que foi ligada, a última leitura e o que está liberado.",
      },
      {
        titulo: "Repare no Ligar de novo",
        texto: "Quando o acesso vence ou é retirado, o cartão fica vermelho e diz o motivo. Enquanto isso, a rede não é lida e não publica.",
        print: "redes-contas-2.webp",
        regiao: { x: 24.4, y: 76.9, l: 35.9, a: 23 },
        alt: "Cartão do YouTube com o selo Ligar de novo e a mensagem de que o acesso foi retirado.",
      },
      {
        titulo: "Avise a diretoria",
        texto: "Ligar e desligar conta é de administrador, dono ou GM. Se uma rede aparecer como Ligar de novo, avise um deles, porque a conta não volta sozinha.",
        print: "redes-contas-2.webp",
        regiao: { x: 24.4, y: 35, l: 60, a: 3.4 },
        alt: "Frase explicando que ligar e desligar conta é de administrador, dono ou GM.",
      },
      lerAgora("redes-contas-2.webp"),
      claude("redes-contas-2.webp"),
    ],
    diretoria: [
      {
        titulo: "Veja o estado de cada rede",
        texto: texto.estado,
        print: "redes-contas-1.webp",
        regiao: { x: 24.4, y: 36, l: 73.1, a: 33.7 },
        alt: "Cartões do Instagram e do Facebook, ambos com o selo Ligada.",
      },
      {
        titulo: "Leia o que cada conta libera",
        texto: texto.conta,
        print: "redes-contas-1.webp",
        regiao: { x: 24.4, y: 51.5, l: 35.9, a: 10.5 },
        alt: "Conta do Instagram com a data em que foi ligada, a última leitura e o que está liberado.",
      },
      {
        titulo: "Religue o que venceu",
        texto: "Quando o acesso vence ou é retirado, o cartão fica vermelho com o motivo e a rede para de ser lida. Para religar, vá em Integrações e ligue a conta de novo.",
        print: "redes-contas-1.webp",
        regiao: { x: 24.4, y: 71.8, l: 35.9, a: 28 },
        alt: "Cartão do YouTube com o selo Ligar de novo e a mensagem de que o acesso foi retirado.",
      },
      {
        titulo: "Ligue ou desligue em Integrações",
        texto: "Ligar em Integrações leva à tela onde a diretoria liga e desliga cada rede e cola as chaves quando a rede pede. É lá que ficam as chaves de todas as redes.",
        print: "redes-contas-1.webp",
        regiao: { x: 46.5, y: 28.8, l: 14.1, a: 4.3 },
        alt: "Botão escuro Ligar em Integrações.",
      },
      lerAgora("redes-contas-1.webp"),
      claude("redes-contas-1.webp"),
    ],
  },
};
