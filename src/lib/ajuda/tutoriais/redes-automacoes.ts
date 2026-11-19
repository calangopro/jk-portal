import type { Passo, Tutorial } from "../tipos.ts";

const aviso: Passo = {
  titulo: "Leia o aviso do ManyChat primeiro",
  texto: "A JK já usa o ManyChat. Uma palavra que ele responde não deve ter regra aqui, senão a pessoa recebe duas respostas. Confira antes de criar.",
  print: "redes-automacoes-1.webp",
  regiao: { x: 24.4, y: 29.4, l: 73.1, a: 11.3 },
  alt: "Aviso em amarelo explicando que a JK já usa o ManyChat e que não se deve repetir a mesma palavra aqui.",
};

const nova: Passo = {
  titulo: "Toque em Nova regra",
  texto: "Uma regra junta as palavras que disparam, o texto da resposta e a conta onde vale. Toda regra nasce desligada, então dá para montar com calma.",
  print: "redes-automacoes-1.webp",
  regiao: { x: 86.6, y: 21.4, l: 11, a: 5.6 },
  alt: "Botão Nova regra no canto direito do título.",
};

const escrever: Passo = {
  titulo: "Escreva as palavras e a resposta",
  texto: "Dê um nome à regra, escolha a conta e liste as palavras separadas por vírgula. Em Resposta, escreva o texto exato que vai sair, sem preço nem prazo que possa mudar.",
  print: "redes-automacoes-2.webp",
  regiao: { x: 24.4, y: 45.5, l: 73.1, a: 44 },
  alt: "Formulário de nova regra com nome, conta, palavras que disparam e o texto da resposta preenchidos.",
};

const criar: Passo = {
  titulo: "Escolha onde vale e crie a regra",
  texto: "Deixe valendo em qualquer publicação da conta ou escolha um post só. Defina quanto esperar e o máximo por hora, e toque em Criar, desligada.",
  print: "redes-automacoes-5.webp",
  regiao: { x: 24.4, y: 6.5, l: 73.1, a: 34.5 },
  alt: "Fim do formulário com Onde vale, Esperar antes de responder, No máximo por hora e o botão Criar, desligada.",
};

export const redesAutomacoes: Tutorial = {
  href: "/admin/redes/automacoes",
  resumo: "Monte uma resposta pronta a comentário por palavra. A regra nasce desligada e só a diretoria liga.",
  versoes: {
    todos: [
      aviso,
      nova,
      escrever,
      criar,
      {
        titulo: "Confira a regra criada",
        texto: "A regra aparece com o selo Desligada. O cartão mostra as palavras, a resposta e, depois de ligada, quantas respostas ela deu nos últimos 30 dias.",
        print: "redes-automacoes-1.webp",
        regiao: { x: 24.4, y: 43.5, l: 36.1, a: 43.5 },
        alt: "Cartão de uma regra desligada com as palavras, a resposta e os botões Ligar, Editar e Apagar.",
      },
      {
        titulo: "Peça para a diretoria ligar",
        texto: "Ligar é de administrador, dono ou GM. Enquanto a regra está desligada você pode editar ou apagar. Se editar uma regra ligada, ela desliga sozinha.",
        print: "redes-automacoes-4.webp",
        regiao: { x: 24.4, y: 76, l: 36.1, a: 6.5 },
        alt: "Rodapé do cartão com o aviso de que ligar é de administrador, dono ou GM, ao lado dos botões Editar e Apagar.",
      },
    ],
    diretoria: [
      aviso,
      nova,
      escrever,
      criar,
      {
        titulo: "Ligue a regra com o texto na frente",
        texto: "Toque em Ligar. A tela repete o texto exato que vai sair, em público e sem ninguém conferir na hora. Se estiver certo, toque em Sim, ligar a regra.",
        print: "redes-automacoes-3.webp",
        regiao: { x: 26, y: 47, l: 33, a: 35 },
        alt: "Confirmação de ligar a regra, repetindo o texto da resposta e o aviso do ManyChat.",
      },
      {
        titulo: "Desligue quando precisar",
        texto: "Uma regra ligada mostra o dia em que foi ligada, quem ligou e quantas respostas deu. Para parar, toque em Desligar: vale na hora.",
        print: "redes-automacoes-1.webp",
        regiao: { x: 61.5, y: 43.5, l: 36.9, a: 41 },
        alt: "Cartão de uma regra ligada com o resumo de respostas e o botão Desligar.",
      },
    ],
  },
};
