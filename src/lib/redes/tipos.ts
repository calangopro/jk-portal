import type { Formato, Recurso, RedeId } from "./redes";

/**
 * O contrato de uma rede. Cada arquivo de `plataformas/` exporta um objeto
 * deste formato, e o resto do sistema (ligações, rotina de leitura, fila,
 * conector do Claude) só fala com o contrato. Ligar uma rede nova é escrever o
 * arquivo dela.
 *
 * Portado de `worker/plataformas/LEIA.md` do auto-agenciasetup, com três
 * diferenças: tipos, credencial num cofre à parte, e a publicação em PASSOS
 * (`publicar` pode devolver "ainda processando"), porque aqui quem roda é uma
 * função da Vercel com teto de tempo, e não um Worker esperando o vídeo.
 *
 * Só tipos: nada aqui roda, então o arquivo serve ao servidor e ao teste.
 */

/** O que fica cifrado no cofre. Cada rede guarda o que precisa (token, renovação, id). */
export type Credenciais = Record<string, unknown>;

/** A conta como o módulo a devolve ao ligar. */
export type ContaLigada = {
  rede: RedeId;
  /** O id da conta na rede. */
  contaId: string;
  nome: string | null;
  usuario: string | null;
  fotoUrl: string | null;
  link: string | null;
  credenciais: Credenciais;
  escopos: string[];
  /** Quando a credencial vence. Nulo: não vence sozinha. */
  expiraEm: string | null;
  /** O que não é segredo e a rotina precisa (lista de envios do canal, Página ligada). */
  extra?: Record<string, unknown>;
};

/** A linha de `redes_contas`, do jeito que o código usa. */
export type Conta = {
  id: string;
  rede: RedeId;
  contaId: string;
  nome: string | null;
  usuario: string | null;
  fotoUrl: string | null;
  link: string | null;
  escopos: string[];
  via: "oauth" | "token";
  status: "ativa" | "expirada" | "desligada";
  expiraEm: string | null;
  ultimoErro: string | null;
  extra: Record<string, unknown>;
  conectadaEm: string;
  lidaEm: string | null;
};

/** Os números da conta num dia. Nulo: a rede não informa. */
export type NumerosDoDia = {
  dia: string;
  seguidores?: number | null;
  publicacoes?: number | null;
  alcance?: number | null;
  visualizacoes?: number | null;
  interacoes?: number | null;
  visitasAoPerfil?: number | null;
  cliquesNoLink?: number | null;
  novosSeguidores?: number | null;
  extra?: Record<string, unknown>;
};

/** Uma publicação lida da rede. */
export type PublicacaoLida = {
  idNaRede: string;
  formato: Formato | "outro";
  legenda: string;
  link: string | null;
  miniaturaUrl: string | null;
  publicadoEm: string | null;
  curtidas: number | null;
  comentarios: number | null;
  /** Só quando a listagem já traz (o YouTube traz as visualizações junto). */
  visualizacoes?: number | null;
  alcance?: number | null;
  salvos?: number | null;
  compartilhamentos?: number | null;
  extra?: Record<string, unknown>;
};

export type MetricasDaPublicacao = {
  alcance: number | null;
  visualizacoes: number | null;
  salvos: number | null;
  compartilhamentos: number | null;
  curtidas?: number | null;
  comentarios?: number | null;
  extra?: Record<string, unknown>;
};

/** Uma mídia da peça, já no Storage, com endereço que a rede consegue buscar. */
export type Midia = {
  tipo: "imagem" | "video";
  url: string;
  /** Caminho no bucket, para apagar depois. */
  caminho?: string;
  alt?: string;
  mime?: string;
  largura?: number;
  altura?: number;
  /** Segundos, para vídeo. */
  duracao?: number;
  /** Bytes. */
  tamanho?: number;
};

/** A peça que vai para UMA rede. */
export type Peca = {
  formato: Formato;
  legenda: string;
  /** Título: obrigatório no YouTube e no Pinterest, ignorado no resto. */
  titulo?: string | null;
  midias: Midia[];
  /** O que cada rede aceita além da legenda (primeiro comentário, capa, link). */
  opcoes: Record<string, unknown>;
};

/**
 * O resultado de um passo da publicação.
 * `publicado`: está no ar. `processando`: a rede ainda prepara a mídia; a fila
 * chama de novo com o mesmo `andamento` (o id do contêiner, o ponto do envio).
 */
export type PassoDaPublicacao =
  | { estado: "publicado"; idNaRede: string | null; url: string | null; avisos?: string[] }
  | { estado: "processando"; andamento: Record<string, unknown>; emSegundos?: number };

export type ComentarioLido = {
  idNaRede: string;
  /** Comentário de primeiro nível: nulo. Resposta: o id do comentário de cima. */
  paiIdNaRede: string | null;
  texto: string;
  /** O @ ou o nome público de quem escreveu. */
  autor: string;
  autorId: string | null;
  quando: string | null;
  /** Escrito pela própria conta (resposta da casa). */
  nosso: boolean;
  curtidas?: number | null;
};

/**
 * Erro de rede social com mensagem que a pessoa consegue ler.
 * `tokenMorto`: a credencial venceu ou foi retirada (a conta vira "expirada").
 * `definitivo`: não adianta tentar de novo (formato recusado, permissão que falta).
 * `parar`: limite de uso ou cota: a rotina larga esta conta até a próxima rodada.
 */
export class ErroDaRede extends Error {
  tokenMorto: boolean;
  definitivo: boolean;
  parar: boolean;
  codigo: number | string | null;
  constructor(mensagem: string, opcoes: { tokenMorto?: boolean; definitivo?: boolean; parar?: boolean; codigo?: number | string | null } = {}) {
    super(mensagem);
    this.name = "ErroDaRede";
    this.tokenMorto = Boolean(opcoes.tokenMorto);
    this.definitivo = Boolean(opcoes.definitivo) || this.tokenMorto;
    this.parar = Boolean(opcoes.parar);
    this.codigo = opcoes.codigo ?? null;
  }
}

/** O aplicativo da rede (id e segredo do cliente OAuth), quando ela usa um. */
export type Aplicativo = { id: string; segredo: string; extra?: Record<string, string> };

export type ModuloDaRede = {
  id: RedeId;
  /** O provedor de `integration_tokens` que guarda o aplicativo desta rede. Nulo: não usa aplicativo próprio. */
  provedorDoAplicativo: string | null;
  /** Recurso -> permissão que a conta precisa ter liberado. */
  recursos: Partial<Record<Recurso, string[]>>;
  /**
   * Quantos dias para trás a PRIMEIRA leitura pede (ao ligar a conta). Sem isto, os 30 de sempre.
   * Existe para a comparação com o período anterior valer desde o primeiro dia: 28 dias pedem 56 de história.
   * Cada rede diz o que aguenta: o YouTube devolve meses numa chamada, o Instagram cobra uma chamada por dia.
   */
  historico?: number;

  // ------------------------------------------------------------ ligar
  /** Para onde mandar a pessoa autorizar. `estado` já vem assinado. */
  urlConectar?(a: { aplicativo: Aplicativo; estado: string; retorno: string }): string;
  /** A rede voltou com `?code=`: troca pelo token e diz qual conta é (ou quais). */
  concluirConexao?(a: { aplicativo: Aplicativo; url: URL; retorno: string }): Promise<ContaLigada[]>;
  /** Token colado em Integrações: confere e diz quais contas ele alcança. */
  conectarComToken?(a: { token: string }): Promise<ContaLigada[]>;
  /** Renova a credencial perto de vencer. Nulo: ainda não precisa. */
  renovar?(a: { aplicativo: Aplicativo | null; credenciais: Credenciais }): Promise<{ credenciais: Credenciais; expiraEm: string | null } | null>;

  // ------------------------------------------------------------ ler
  /** Total de agora (seguidores, publicações) e o perfil público. */
  lerConta?(a: { credenciais: Credenciais; conta: Conta }): Promise<{ seguidores: number | null; publicacoes: number | null; nome?: string | null; usuario?: string | null; fotoUrl?: string | null }>;
  /** Os números por dia entre duas datas (AAAA-MM-DD, as duas inclusive). */
  lerDias?(a: { credenciais: Credenciais; conta: Conta; de: string; ate: string }): Promise<NumerosDoDia[]>;
  /** Uma página de publicações, da mais nova para a mais antiga. */
  lerPublicacoes?(a: { credenciais: Credenciais; conta: Conta; limite: number; depois?: string | null }): Promise<{ itens: PublicacaoLida[]; depois: string | null }>;
  /** As métricas que pedem chamada própria por publicação. */
  lerMetricas?(a: { credenciais: Credenciais; conta: Conta; publicacao: { idNaRede: string; formato: string | null } }): Promise<MetricasDaPublicacao>;
  lerComentarios?(a: { credenciais: Credenciais; conta: Conta; publicacaoIdNaRede: string; desde: number }): Promise<ComentarioLido[]>;

  // ------------------------------------------------------------ escrever
  /** Confere se a peça cabe na rede. Devolve o problema em uma frase, ou null. */
  validar(peca: Peca): string | null;
  publicar?(a: { credenciais: Credenciais; conta: Conta; peca: Peca; andamento: Record<string, unknown> | null }): Promise<PassoDaPublicacao>;
  responderComentario?(a: { credenciais: Credenciais; conta: Conta; comentarioIdNaRede: string; texto: string }): Promise<{ idNaRede: string | null }>;
  ocultarComentario?(a: { credenciais: Credenciais; conta: Conta; comentarioIdNaRede: string; ocultar: boolean }): Promise<void>;
};
