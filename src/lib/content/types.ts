/**
 * Tipos de domínio do portal editorial.
 * Espelham as tabelas do Supabase (ver supabase/migrations).
 */

export type ContentType = "home" | "guia" | "artigo" | "loja" | "faq";
export type ContentStatus = "draft" | "in_review" | "published" | "archived";

export type Faq = {
  question: string;
  answer: string;
};

/** Um guia/artigo editorial. */
/**
 * Quem assina ou revisa um conteúdo.
 *
 * Existe como entidade própria porque a documentação do Google sobre conteúdo
 * confiável pergunta quem escreveu, e espera que a assinatura leve a uma página
 * com informação sobre a pessoa. Nome solto em campo de texto não responde isso.
 *
 * `jobTitle` fica separado de propósito: a documentação de Article manda que
 * author.name leve SÓ o nome, sem cargo e sem título honorífico.
 */
export type Autor = {
  id: string;
  slug: string;
  name: string;
  jobTitle?: string | null;
  credentials?: string | null;
  bio?: string | null;
  foto?: Imagem | null;
  /** Perfis públicos reais da pessoa. Vira `sameAs`. Nunca inventar. */
  sameAs: string[];
  isActive: boolean;
};

export type Content = {
  id: string;
  type: ContentType;
  title: string;
  slug: string;
  /** Intenção de busca principal (ex.: informacional, transacional). */
  searchIntent?: string | null;
  status: ContentStatus;
  /** Texto livre. Sobra para conteúdo antigo e colaborador não cadastrado. */
  authorName?: string | null;
  reviewerName?: string | null;
  /** Autor cadastrado. Quando existe, tem prioridade sobre `authorName`. */
  autor?: Autor | null;
  /** Revisor cadastrado. Quando existe, tem prioridade sobre `reviewerName`. */
  revisor?: Autor | null;
  /** Canonical absoluto opcional (override); se ausente, derivado da rota. */
  canonicalUrl?: string | null;
  excerpt?: string | null;
  /** Resposta direta no topo (importante para GEO / citação por IA). */
  answer?: string | null;
  bodyMd?: string | null;
  /** HTML vindo do editor em blocos. Quando existe, tem prioridade sobre bodyMd. */
  bodyHtml?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  ogImageUrl?: string | null;
  faqs?: Faq[] | null;
  /** Assunto que agrupa as páginas do mesmo cluster. */
  cluster?: string | null;
  /** Capa do artigo (content_media com role 'hero'). */
  capa?: Imagem | null;
  publishedAt?: string | null;
  updatedAt?: string | null;
};

/**
 * Uma imagem da biblioteca de mídia, já pronta para virar `<Figura>`.
 *
 * Espelha a tabela `media` (ver 0004_media.sql). `alt` é obrigatório na
 * publicação, por isso vem como string e não como opcional.
 */
export type Imagem = {
  id: string;
  url: string;
  alt: string;
  width: number;
  height: number;
  caption?: string | null;
  credit?: string | null;
  /** LQIP para o blur enquanto carrega. */
  placeholder?: string | null;
  /** Ponto focal (0 a 1) para o corte não decapitar o assunto. */
  focalX?: number | null;
  focalY?: number | null;
};

/** Especificação de horário de funcionamento (schema.org OpeningHoursSpecification). */
export type OpeningHours = {
  /** Dias em inglês schema.org: "Monday", "Tuesday"... */
  dayOfWeek: string[];
  opens: string; // "09:00"
  closes: string; // "18:00"
};

/**
 * Avaliações de uma unidade.
 *
 * Só existe com origem registrada. O banco tem uma constraint que recusa nota
 * sem `reviews_source`, porque avaliação inventada é o tipo de dado que
 * destrói a confiança que o portal inteiro tenta construir.
 */
export type Avaliacoes = {
  nota: number;
  quantidade: number;
  fonte: string;
  conferidoEm?: string | null;
};

/** Uma loja física (NAP + geo + horário + apresentação da unidade). */
export type Location = {
  id: string;
  slug: string; // cidade-bairro
  name: string;
  /** Shopping onde a unidade fica, quando for o caso. */
  mallName?: string | null;
  /** Localização dentro do shopping, ex.: "1º piso, loja 1022". */
  unitLabel?: string | null;
  address: string;
  addressLocality?: string | null;
  addressRegion?: string | null;
  postalCode?: string | null;
  country?: string | null;
  phone?: string | null;
  /** Só dígitos, com DDI, pronto para o wa.me. */
  whatsapp?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  openingHours?: OpeningHours[] | null;
  /** De onde veio o horário. Sem fonte, o horário não é publicado. */
  hoursSource?: string | null;
  hoursNote?: string | null;
  gbpUrl?: string | null;
  gbpPlaceId?: string | null;
  mapsUrl?: string | null;
  wazeUrl?: string | null;
  utm?: Record<string, string> | null;
  services?: string[] | null;
  /** Data de inauguração da unidade. */
  openedAt?: string | null;
  /** Apresentação da unidade, escrita pela redação. */
  about?: string | null;
  highlights?: string[] | null;
  faqs?: Faq[] | null;
  avaliacoes?: Avaliacoes | null;
  /** Fotos da unidade (galeria). A primeira serve de capa. */
  fotos?: Imagem[] | null;
  sortOrder?: number | null;
  status: ContentStatus;
  publishedAt?: string | null;
  updatedAt?: string | null;
};
