import type { Tutorial } from "../tipos.ts";

export const produtos: Tutorial = {
  href: "/admin/produtos",
  resumo: "Ache uma peça da loja, abra os dados dela, mude o que precisa na Tray e acompanhe as fotos novas.",
  versoes: {
    todos: [
      {
        titulo: "Procure a peça",
        texto: "Digite o nome, o código ou a categoria no campo de busca. A lista já vem por categoria, da que mais vende para a que menos. Marque Só disponíveis para esconder o que está fora de estoque.",
        print: "produtos-1.webp",
        regiao: { x: 24.4, y: 50.3, l: 73.1, a: 5.5 },
        alt: "Campo de busca, caixa Só disponíveis e ordem da lista de produtos.",
      },
      {
        titulo: "Toque na peça para abrir",
        texto: "Abra a categoria e toque na linha da peça. Uma gaveta se abre ao lado com os dados dela. As setas de cima, ou as teclas J e K, passam para a peça seguinte sem fechar.",
        print: "produtos-1.webp",
        regiao: { x: 24.5, y: 65.6, l: 73, a: 8.2 },
        alt: "Linha de um produto dentro da categoria Alianças de ouro 18k.",
      },
      {
        titulo: "Veja os dados e leia a loja de novo",
        texto: "Na aba Dados você vê preço, situação e código. Logo abaixo, o painel lê a peça na Tray na hora e abre o formulário com nome, estoque e se está disponível para venda.",
        print: "produtos-2.webp",
        regiao: { x: 54.1, y: 62, l: 44.3, a: 17 },
        alt: "Gaveta do produto na aba Dados, com o formulário Editar na loja aberto.",
      },
      {
        titulo: "Mude o estoque ou o nome e confira",
        texto: "Escreva o valor novo e toque em Conferir mudanças. O painel mostra o que era e o que vai ficar. Só quando você tocar em Gravar na loja é que a Tray recebe a mudança.",
        print: "produtos-3.webp",
        regiao: { x: 54.1, y: 87.2, l: 44.3, a: 12.8 },
        alt: "Quadro Confira antes de gravar na loja, com o estoque indo de 10 para 12.",
      },
      {
        titulo: "Cuide das fotos na aba Fotos novas",
        texto: "A aba Fotos novas mostra quantas peças faltam foto, quais esperam aprovação e quais já estão na loja. Toque num número para filtrar e abra a peça para aprovar ou pedir para refazer.",
        print: "produtos-6.webp",
        regiao: { x: 24.4, y: 31.5, l: 73.1, a: 33 },
        alt: "Aba Fotos novas com a barra de progresso e os filtros por estado da foto.",
      },
    ],
    diretoria: [
      {
        titulo: "Procure a peça",
        texto: "Digite o nome, o código ou a categoria no campo de busca. Para a diretoria também aparece o filtro Margem, que acha peças sem custo ou com promoção acima do limite.",
        print: "produtos-1.webp",
        regiao: { x: 24.4, y: 50.3, l: 73.1, a: 5.5 },
        alt: "Campo de busca, caixa Só disponíveis e ordem da lista de produtos.",
      },
      {
        titulo: "Toque na peça para abrir",
        texto: "Abra a categoria e toque na linha da peça. A gaveta se abre ao lado, com as abas Dados, Fotos e Custo. As setas de cima, ou as teclas J e K, passam para a peça seguinte.",
        print: "produtos-1.webp",
        regiao: { x: 24.5, y: 65.6, l: 73, a: 8.2 },
        alt: "Linha de um produto dentro da categoria Alianças de ouro 18k.",
      },
      {
        titulo: "Mude o preço e a promoção",
        texto: "Na aba Dados, no formulário Editar na loja, escreva o preço, o preço promocional e as datas da promoção. Preço e promoção só se mudam com a conta da diretoria.",
        print: "produtos-4.webp",
        regiao: { x: 54.1, y: 71, l: 44.3, a: 25 },
        alt: "Formulário Editar na loja com preço, estoque, preço promocional e datas.",
      },
      {
        titulo: "Confira o antes e depois e grave",
        texto: "Toque em Conferir mudanças. O painel mostra cada campo com o valor de antes e o de depois, e avisa se algo parece estranho. Só Gravar na loja manda a mudança para a Tray.",
        print: "produtos-7.webp",
        regiao: { x: 54.1, y: 87.2, l: 44.3, a: 12.8 },
        alt: "Quadro Confira antes de gravar na loja, com o preço promocional passando de sem promoção para R$ 2.700,00.",
      },
      {
        titulo: "Veja o custo e a margem na aba Custo",
        texto: "A aba Custo mostra quanto a peça custa, a margem no preço cheio, o desconto máximo e quanto dá para gastar de anúncio por venda. Preencha o peso ou o custo fixo e toque em Salvar custo.",
        print: "produtos-5.webp",
        regiao: { x: 54.1, y: 30.6, l: 44.3, a: 40 },
        alt: "Aba Custo da gaveta, com custo, margem, desconto máximo e limite de anúncio.",
      },
      {
        titulo: "Cuide das fotos na aba Fotos novas",
        texto: "A aba Fotos novas mostra quantas peças faltam foto, quais esperam aprovação e quais já estão na loja. Toque num número para filtrar e abra a peça para aprovar ou pedir para refazer.",
        print: "produtos-6.webp",
        regiao: { x: 24.4, y: 31.5, l: 73.1, a: 33 },
        alt: "Aba Fotos novas com a barra de progresso e os filtros por estado da foto.",
      },
    ],
  },
};
