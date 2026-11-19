import type { Tutorial } from "../tipos.ts";

export const usuarios: Tutorial = {
  href: "/admin/usuarios",
  resumo: "Convide pessoas para o painel, defina o papel de cada uma e desative quem não deve mais entrar.",
  versoes: {
    todos: [
      {
        titulo: "Preencha o e-mail e o nome",
        texto: "No quadro Convidar pessoa, escreva o e-mail de quem vai entrar e o nome. O acesso é só por convite, não existe cadastro aberto.",
        print: "usuarios-1.webp",
        regiao: { x: 26, y: 49.5, l: 46, a: 8 },
        alt: "Quadro Convidar pessoa com os campos de e-mail e de nome.",
      },
      {
        titulo: "Escolha o papel da pessoa",
        texto: "O papel decide o que ela vê no painel. Cada opção traz uma frase dizendo para que serve. Se tiver dúvida, escolha o de menos acesso, dá para trocar depois.",
        print: "usuarios-1.webp",
        regiao: { x: 72.6, y: 49.5, l: 23.4, a: 8 },
        alt: "Campo Papel do convite, com a lista de níveis de acesso.",
      },
      {
        titulo: "Envie o convite",
        texto: "Toque em Enviar convite. A pessoa recebe um e-mail, clica no link e cria a própria senha. O link só funciona uma vez.",
        print: "usuarios-1.webp",
        regiao: { x: 26, y: 58.5, l: 13.6, a: 7.6 },
        alt: "Botão Enviar convite abaixo do formulário.",
      },
      {
        titulo: "Troque o papel de alguém",
        texto: "Na lista, escolha outro papel no campo da pessoa e toque em Salvar. O seu próprio papel não muda por aqui.",
        print: "usuarios-2.webp",
        regiao: { x: 43, y: 56.5, l: 18, a: 7 },
        alt: "Linha de uma pessoa com o campo de papel e o botão Salvar.",
      },
      {
        titulo: "Reenvie o convite que venceu",
        texto: "Quem aparece com Ainda não criou a senha pode ter perdido o e-mail. Toque em Reenviar convite e a pessoa recebe um link novo.",
        print: "usuarios-2.webp",
        regiao: { x: 63.5, y: 73, l: 27, a: 10.5 },
        alt: "Linha com o aviso Ainda não criou a senha e o botão Reenviar convite.",
      },
      {
        titulo: "Desative quem saiu",
        texto: "Toque em Desativar para a pessoa não entrar mais. Nada é apagado, o histórico fica. Se ela voltar, o mesmo botão vira Reativar.",
        print: "usuarios-2.webp",
        regiao: { x: 77.5, y: 56.5, l: 9.5, a: 6 },
        alt: "Botão Desativar no fim da linha de uma pessoa ativa.",
      },
    ],
  },
};
