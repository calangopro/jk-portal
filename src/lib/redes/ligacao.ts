/**
 * O que a tela de ligações diz sobre cada rede: como se liga, o que precisa
 * existir antes, e o que a rede não deixa fazer pela API.
 *
 * É texto para gente, escrito a partir da documentação de cada rede lida em
 * 16/11/2026. Arquivo puro: a tela (navegador) e o servidor leem daqui.
 * Quando uma rede mudar a regra, é aqui que o texto muda.
 */
import type { RedeId } from "./redes.ts";

export type InfoDaLigacao = {
  /** `login`: a pessoa autoriza na tela da própria rede. `token`: o administrador cola um token. */
  por: "login" | "token";
  /** O texto do botão de ligar. */
  botao: string;
  /** Com qual conta entrar, ou de onde vem o token. */
  comQuem: string;
  /** Campos do aplicativo, quando a rede usa um aplicativo próprio que o administrador cadastra. */
  aplicativo?: { rotuloDoId: string; exemploDoId: string; rotuloDoSegredo: string; ondeAchar: string };
  /** Quando o aplicativo é um que o painel já tem (o cliente do Google). */
  aplicativoPronto?: string;
  aplicativoFalta?: string;
  token?: { rotulo: string; exemplo: string; ondeAchar: string };
  /** Quando o token desta rede se cola no cartão de OUTRA (o do Meta liga as duas de uma vez): o nome dela. */
  tokenNoCartaoDe?: string;
  /** O que precisa existir fora do painel, na ordem de fazer. */
  passos: string[];
  /** O que a rede não deixa fazer pela API, dito por extenso. */
  limites: string[];
};

const PERMISSOES_DA_META =
  "pages_show_list, pages_read_engagement, business_management, read_insights, pages_manage_posts, pages_read_user_content, pages_manage_engagement, instagram_basic, instagram_manage_insights, instagram_content_publish e instagram_manage_comments";

const META: InfoDaLigacao = {
  por: "token",
  botao: "Conferir e ligar",
  comQuem: "Um token de usuário do sistema do portfólio da JK liga a Página do Facebook e o Instagram de uma vez.",
  token: {
    rotulo: "Token do usuário do sistema",
    exemplo: "EAA...",
    ondeAchar:
      "Nas Configurações do negócio do Meta: Usuários, Usuários do sistema. É um token NOVO, diferente do que lê o gasto de anúncio. Ele liga o Instagram e a Página do Facebook de uma vez.",
  },
  passos: [
    "Nas Configurações do negócio do Meta (portfólio da JK), em Usuários do sistema, criar um usuário só para isto (por exemplo painel-redes), com função de administrador.",
    "Em Adicionar ativos, atribuir a esse usuário a Página do Facebook da JK e a conta do Instagram, as duas com controle total.",
    "Conferir que o Instagram está ligado à Página (na Página: Configurações, Contas vinculadas) e que é conta profissional.",
    `Clicar em Gerar token, escolher o aplicativo JK Alianças Painel Compras, validade Nunca, e marcar: ${PERMISSOES_DA_META}.`,
    "O pedido de token vira uma solicitação que outro administrador do portfólio precisa aprovar (Configurações do negócio, Solicitações). Aprovado, o token aparece no próprio usuário do sistema, uma vez só.",
    "Colar o token aqui. O painel confere antes de guardar e diz quais contas ele alcança.",
  ],
  limites: [
    "Direct de cliente (Instagram e Messenger) pede análise do aplicativo pela Meta e verificação do negócio. Fica para depois dessa aprovação.",
    "O Instagram não agenda pela API: quem agenda é a fila do painel, que publica na hora marcada.",
    "Story sai sem figurinha de link, enquete ou local: a API não tem. As métricas do story somem em 24 horas, e o painel guarda a última leitura.",
    "O Instagram só aceita imagem JPEG. O compositor converte antes de subir.",
  ],
};

/** O Facebook entra pelo mesmo token: o campo fica só no cartão do Instagram, para ninguém colar duas vezes. */
const META_SEM_CAMPO: InfoDaLigacao = { ...META, token: undefined, tokenNoCartaoDe: "Instagram" };

export const INFO_DA_LIGACAO: Partial<Record<RedeId, InfoDaLigacao>> = {
  instagram: META,
  facebook: META_SEM_CAMPO,
  youtube: {
    por: "login",
    botao: "Ligar com o Google",
    comQuem: "Entre com a conta do Google que é DONA do canal da JK (ou proprietária da Conta de Marca) e escolha o canal. Convidado pelo YouTube Studio não serve: a API não aceita.",
    aplicativoPronto: "Usa o mesmo cliente OAuth do Google que já está salvo no cartão do Google, mais acima.",
    aplicativoFalta: "Falta o cliente OAuth do Google. Ele se salva no cartão do Google, mais acima.",
    passos: [
      "No Google Cloud, projeto jk-portal-509621, em APIs e serviços, Biblioteca: ativar a YouTube Data API v3 e a YouTube Analytics API.",
      "No mesmo projeto, em Google Auth Platform, Clientes, abrir o cliente JK Alianças Portal e acrescentar o endereço de volta que aparece neste cartão em URIs de redirecionamento autorizados.",
      "Em Google Auth Platform, Acesso a dados, acrescentar os quatro escopos do YouTube: youtube.upload, youtube.readonly, youtube.force-ssl e yt-analytics.readonly.",
      "Clicar em Ligar com o Google aqui, entrar com a conta dona do canal e deixar todas as caixas marcadas. Vai aparecer a tela de aplicativo não verificado: é esperado, e segue por Avançado.",
    ],
    limites: [
      "Os números por dia chegam com 2 a 3 dias de atraso. Inscritos e visualizações de cada vídeo são do momento.",
      "O YouTube não informa alcance (pessoas únicas) nem impressões por esta API: o que há é visualização.",
      "Não existe mensagem direta no YouTube. Posts da Comunidade estão em piloto fechado até 2027.",
      "Short não é uma opção que se marca: o YouTube transforma em Short o vídeo em pé ou quadrado de até 3 minutos.",
      "São 100 envios de vídeo por dia e 10.000 unidades de cota para o resto. Responder comentário custa 50: dá 200 respostas por dia.",
    ],
  },
};
