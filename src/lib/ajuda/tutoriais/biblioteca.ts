import type { Passo, Tutorial } from "../tipos.ts";

const busca: Passo = {
  titulo: "Procure pela palavra",
  texto: "Digite uma palavra, como polimento, troca, malote ou Pix. A lista mostra só as respostas que têm todas as palavras que você escreveu, sem importar acento.",
  print: "biblioteca-1.webp",
  regiao: { x: 24.4, y: 25.5, l: 73.1, a: 6.5 },
  alt: "Campo de busca da Biblioteca JK.",
};

const filtros: Passo = {
  titulo: "Filtre por tema ou por estado",
  texto: "Os botões de cima separam por tema, como Troca ou Pós-venda. Os de baixo separam as respostas Confirmadas das que ainda estão A confirmar.",
  print: "biblioteca-1.webp",
  regiao: { x: 24, y: 34, l: 73.5, a: 15 },
  alt: "Botões de tema e de estado da Biblioteca JK.",
};

const copiar: Passo = {
  titulo: "Leia a explicação e copie a frase",
  texto: "A explicação é para você: o que vale e o que conferir. A frase pronta é para o cliente. Toque em Copiar a frase, cole na conversa e adapte ao jeito do cliente.",
  print: "biblioteca-1.webp",
  regiao: { x: 24.4, y: 54, l: 73.1, a: 37 },
  alt: "Resposta confirmada, com a explicação e o botão Copiar a frase.",
};

const aConfirmar: Passo = {
  titulo: "Cuidado com o A confirmar",
  texto: "Resposta amarela ainda não foi confirmada pela JK. Ela aparece para você não ficar sem nada, mas antes de prometer ao cliente confira com a diretoria.",
  print: "biblioteca-2.webp",
  regiao: { x: 24.4, y: 11, l: 73.1, a: 31 },
  alt: "Resposta com o aviso em amarelo A JK ainda não confirmou.",
};

const sugerir: Passo = {
  titulo: "Não achou? Sugira uma resposta",
  texto: "Toque em Sugerir uma resposta e escreva a pergunta do jeito que o cliente faz, o que vale e, se tiver, a frase. Ela entra como A confirmar até a diretoria aprovar.",
  print: "biblioteca-1.webp",
  regiao: { x: 82.5, y: 18.5, l: 15, a: 6 },
  alt: "Botão Sugerir uma resposta no topo da tela.",
};

const confirmar: Passo = {
  titulo: "Confirme a resposta que a casa assina",
  texto: "Só a diretoria confirma. Confirmar tira o aviso amarelo e a resposta passa a valer para o time inteiro e para o Tutor. Leia o texto com calma antes de confirmar.",
  print: "biblioteca-3.webp",
  regiao: { x: 24.4, y: 63, l: 73, a: 31 },
  alt: "Resposta A confirmar com os botões Confirmar, Editar e Arquivar.",
};

const tirar: Passo = {
  titulo: "Edite, tire a confirmação ou arquive",
  texto: "Mudou a regra? Edite o texto ou toque em Tirar a confirmação. Arquivar tira a resposta da lista sem apagar: o texto de antes fica guardado.",
  print: "biblioteca-3.webp",
  regiao: { x: 24.4, y: 52, l: 73, a: 10 },
  alt: "Botões Editar, Tirar a confirmação e Arquivar de uma resposta confirmada.",
};

export const biblioteca: Tutorial = {
  href: "/admin/biblioteca",
  resumo: "As respostas da casa para as dúvidas do cliente, com a frase pronta para copiar e colar.",
  versoes: {
    todos: [busca, filtros, copiar, aConfirmar, sugerir],
    diretoria: [busca, copiar, aConfirmar, confirmar, tirar, sugerir],
  },
};
