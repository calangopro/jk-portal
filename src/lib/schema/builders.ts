/**
 * Builders puros de dados estruturados (schema.org / JSON-LD).
 *
 * Regra dura: cada objeto reflete o conteúdo VISÍVEL na página.
 * Nunca fabricar `aggregateRating`/`review`: só entram quando houver dado
 * real sincronizado e exibido.
 */
import { SITE, absoluteUrl } from "@/lib/seo/site";
import { canonicalDoGuia } from "@/lib/seo/metadata";
import type { Autor, Content, Location } from "@/lib/content/types";

type Json = Record<string, unknown>;

export function organizationSchema(): Json {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": absoluteUrl("/#organization"),
    name: SITE.name,
    legalName: SITE.legalName,
    url: SITE.url,
    // O logo entra como ImageObject com dimensão, e não como texto solto,
    // porque assim o Google sabe o que está recebendo.
    logo: {
      "@type": "ImageObject",
      url: absoluteUrl("/logo.png"),
      width: 600,
      height: 200,
    },
    // A loja é o mesmo negócio, não um site qualquer. Declarar isso ajuda a
    // ler portal e loja como uma entidade só.
    ...(SITE.lojaUrl ? { subjectOf: { "@type": "WebSite", url: SITE.lojaUrl } } : {}),
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      telephone: SITE.telefone,
      email: SITE.email,
      areaServed: "BR",
      availableLanguage: "Portuguese",
    },
    ...(SITE.sameAs.length ? { sameAs: SITE.sameAs } : {}),
  };
}

export function webSiteSchema(): Json {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": absoluteUrl("/#website"),
    name: SITE.name,
    // `alternateName` é a fonte que o Google lê para montar o nome do site no
    // resultado. Sem ela sobra só o `name`, sem alternativa quando ele decide
    // que o principal não cabe ou não bate com o que a web chama a marca.
    alternateName: SITE.shortName,
    url: SITE.url,
    inLanguage: "pt-BR",
    publisher: { "@id": absoluteUrl("/#organization") },
  };
}

/** Imagem principal de uma página, já com o que o Google lê de direitos. */
export type ImagemDaPagina = {
  url: string;
  width: number;
  height: number;
  alt?: string | null;
  caption?: string | null;
  /** Crédito ou fonte, como cadastrado na biblioteca de mídia. */
  credit?: string | null;
};

/**
 * ImageObject completo.
 *
 * `creditText` e `copyrightNotice` saem do campo `credit` da tabela `media`,
 * que já era coletado no admin e morria ali: nada lia. Com eles a foto entra
 * no Google Imagens com atribuição, que é o que a documentação de metadados de
 * imagem descreve. Sem crédito cadastrado, os campos simplesmente não saem.
 */
function imageObject(img: ImagemDaPagina): Json {
  const credito = img.credit?.trim();
  return {
    "@type": "ImageObject",
    url: img.url,
    width: img.width,
    height: img.height,
    ...(img.alt?.trim() ? { name: img.alt.trim() } : {}),
    ...(img.caption?.trim() ? { caption: img.caption.trim() } : {}),
    ...(credito ? { creditText: credito, copyrightNotice: credito } : {}),
  };
}

/**
 * Person de um autor ou revisor.
 *
 * `name` leva SÓ o nome. Cargo vai em `jobTitle`, credencial vai em
 * `description`, exatamente como a documentação de Article separa.
 */
function pessoaSchema(autor: Autor | null | undefined, nomeSolto?: string | null): Json {
  if (!autor) return { "@type": "Person", name: nomeSolto ?? "" };
  return {
    "@type": "Person",
    "@id": `${absoluteUrl(`/autor/${autor.slug}`)}#pessoa`,
    name: autor.name,
    url: absoluteUrl(`/autor/${autor.slug}`),
    ...(autor.jobTitle ? { jobTitle: autor.jobTitle } : {}),
    ...(autor.credentials ? { description: autor.credentials } : {}),
    ...(autor.foto ? { image: autor.foto.url } : {}),
    ...(autor.sameAs.length ? { sameAs: autor.sameAs } : {}),
  };
}

/**
 * ProfilePage da página de um autor.
 *
 * A documentação descreve este tipo para páginas cujo foco é uma pessoa, e cita
 * "página de autor em site de notícias" como caso de uso direto. `hasPart` liga
 * a pessoa aos textos que ela assina, fechando o caminho nos dois sentidos:
 * do artigo para o autor por `author.url`, e do autor para os artigos aqui.
 */
export function profilePageSchema(
  autor: Autor,
  conteudos: { title: string; slug: string; publishedAt?: string | null }[],
): Json {
  const url = absoluteUrl(`/autor/${autor.slug}`);
  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    "@id": `${url}#profilepage`,
    url,
    inLanguage: "pt-BR",
    isPartOf: { "@id": absoluteUrl("/#website") },
    mainEntity: {
      ...(pessoaSchema(autor) as Record<string, unknown>),
      ...(autor.bio ? { description: autor.bio } : {}),
      worksFor: { "@id": absoluteUrl("/#organization") },
    },
    ...(conteudos.length
      ? {
          hasPart: conteudos.map((c) => ({
            "@type": "Article",
            "@id": `${absoluteUrl(`/guia/${c.slug}`)}#article`,
            headline: c.title,
            url: absoluteUrl(`/guia/${c.slug}`),
            ...(c.publishedAt ? { datePublished: c.publishedAt } : {}),
          })),
        }
      : {}),
  };
}

export function articleSchema(
  c: Content,
  imagem?: ImagemDaPagina,
  /** Comentários APROVADOS e visíveis na página. Nunca o total da fila. */
  comentariosVisiveis = 0,
): Json {
  // Mesma função que o `<link rel="canonical">` usa, para o @id do JSON-LD e a
  // canônica declarada no <head> nunca apontarem para URLs diferentes.
  const url = canonicalDoGuia(c);
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${url}#article`,
    headline: c.title,
    inLanguage: "pt-BR",
    // Amarra o artigo ao site, que por sua vez aponta para a organização.
    isPartOf: { "@id": absoluteUrl("/#website") },
    description: c.excerpt ?? c.metaDescription ?? undefined,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    // Imagem como ImageObject com dimensão, e não como texto solto. A medida
    // vem da tabela `media`, que já guarda o que foi lido no envio.
    ...(imagem
      ? { image: imageObject(imagem) }
      : c.ogImageUrl
        ? { image: c.ogImageUrl }
        : {}),
    // author.url é o que transforma uma assinatura em sinal de E-E-A-T: leva a
    // uma página que identifica a pessoa. Quando não há autor cadastrado, cai no
    // texto livre, que continua valendo mais que nada. Nunca colocamos cargo
    // dentro de `name`: a documentação de Article proíbe explicitamente.
    ...(c.autor || c.authorName
      ? { author: pessoaSchema(c.autor, c.authorName) }
      : {}),
    ...(c.revisor || c.reviewerName
      ? { reviewedBy: pessoaSchema(c.revisor, c.reviewerName) }
      : {}),
    // Só declara comentário quando existe comentário visível na página, para o
    // schema continuar refletindo o que a pessoa realmente vê.
    ...(comentariosVisiveis > 0 ? { commentCount: comentariosVisiveis } : {}),
    ...(c.publishedAt ? { datePublished: c.publishedAt } : {}),
    ...(c.updatedAt ? { dateModified: c.updatedAt } : {}),
    publisher: { "@id": absoluteUrl("/#organization") },
  };
}

/**
 * Nó WebPage da página, com a imagem preferida declarada.
 *
 * `primaryImageOfPage` é a PRIMEIRA fonte da lista de precedência que o Google
 * usa para escolher a miniatura da página, acima da imagem da entidade
 * principal e acima do `og:image`. Sem ela, quem decidia era o `og:image`, que
 * na home é arte de marca genérica, justamente o que a documentação manda
 * evitar como imagem preferida.
 *
 * O nó também amarra cada página ao WebSite por `@id`, fechando um grafo que
 * antes tinha Organization e WebSite soltos, sem ninguém apontando para eles.
 */
export function webPageSchema(input: {
  url: string;
  name: string;
  description?: string | null;
  imagemPrincipal?: ImagemDaPagina;
  breadcrumbUrl?: string;
}): Json {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${input.url}#webpage`,
    url: input.url,
    name: input.name,
    inLanguage: "pt-BR",
    isPartOf: { "@id": absoluteUrl("/#website") },
    ...(input.description ? { description: input.description } : {}),
    ...(input.imagemPrincipal
      ? { primaryImageOfPage: imageObject(input.imagemPrincipal) }
      : {}),
  };
}

/**
 * ItemList de uma página de índice.
 *
 * As páginas /guia e /lojas listam dezenas de itens e não declaravam nenhum.
 * A documentação de dados estruturados pede o tipo mais específico que couber,
 * e uma lista de links para páginas irmãs é exatamente um ItemList.
 */
export function itemListSchema(
  itens: { name: string; url: string }[],
  nome: string,
): Json {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: nome,
    numberOfItems: itens.length,
    itemListElement: itens.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      url: item.url,
    })),
  };
}

export function breadcrumbSchema(
  items: { name: string; url: string }[],
): Json {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function jewelryStoreSchema(l: Location): Json {
  return {
    "@context": "https://schema.org",
    "@type": "JewelryStore",
    // Cada loja precisa de identidade própria e estável no grafo, senão as dez
    // unidades viram dez nós anônimos que nada mais consegue referenciar.
    "@id": `${absoluteUrl(`/lojas/${l.slug}`)}#loja`,
    // Cada unidade pertence à mesma organização. Sem isso, 10 lojas parecem
    // 10 negócios sem relação entre si.
    parentOrganization: { "@id": absoluteUrl("/#organization") },
    name: `${SITE.name} ${l.name}`,
    url: absoluteUrl(`/lojas/${l.slug}`),
    address: {
      "@type": "PostalAddress",
      streetAddress: l.address,
      ...(l.addressLocality ? { addressLocality: l.addressLocality } : {}),
      ...(l.addressRegion ? { addressRegion: l.addressRegion } : {}),
      ...(l.postalCode ? { postalCode: l.postalCode } : {}),
      addressCountry: l.country ?? "BR",
    },
    // A maioria das unidades atende só por WhatsApp, e WhatsApp é telefone.
    // Sem isto, oito das dez lojas iam para o Google sem número nenhum.
    ...(l.phone || l.whatsapp
      ? { telephone: l.phone ?? `+${(l.whatsapp ?? "").replace(/\D/g, "")}` }
      : {}),
    ...(l.latitude != null && l.longitude != null
      ? {
          geo: {
            "@type": "GeoCoordinates",
            latitude: l.latitude,
            longitude: l.longitude,
          },
        }
      : {}),
    ...(l.openingHours?.length
      ? {
          openingHoursSpecification: l.openingHours.map((h) => ({
            "@type": "OpeningHoursSpecification",
            dayOfWeek: h.dayOfWeek,
            opens: h.opens,
            closes: h.closes,
          })),
        }
      : {}),
    ...(l.mapsUrl || l.gbpUrl ? { hasMap: l.mapsUrl ?? l.gbpUrl } : {}),
    ...(l.mallName ? { containedInPlace: { "@type": "ShoppingCenter", name: l.mallName } } : {}),
    ...(l.openedAt ? { foundingDate: l.openedAt } : {}),
    ...(l.about ? { description: l.about } : {}),
    ...(l.fotos?.length
      ? {
          image: l.fotos.slice(0, 6).map((f) => ({
            "@type": "ImageObject",
            url: f.url,
            width: f.width,
            height: f.height,
            ...(f.alt ? { caption: f.alt } : {}),
          })),
        }
      : {}),
    // aggregateRating SÓ com avaliação real e origem registrada. Inventar isto
    // é o caminho mais curto para uma penalidade manual do Google, e o
    // REGRAS.md proíbe em letras maiúsculas.
    ...(l.avaliacoes
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: l.avaliacoes.nota,
            reviewCount: l.avaliacoes.quantidade,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
  };
}

export function faqPageSchema(faqs: { question: string; answer: string }[]): Json {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
}

/** Produto real, vindo da sincronização com a Tray. */
export type ProdutoSchema = {
  name: string;
  url: string | null;
  image: string | null;
  description: string | null;
  brand: string | null;
  price: number | null;
  disponivel: boolean;
};

/**
 * Schema de produto. Só deve ser chamado com produto REAL sincronizado da
 * Tray, nunca com dado digitado à mão. Preço entra apenas quando existe de
 * fato, e nunca inventamos avaliação nem nota.
 *
 * Sem preço, devolve `null` em vez de um `Product` pelado. Um Product sem
 * `offers` e sem avaliação não qualifica para nenhum resultado do Google, e a
 * orientação da documentação é marcar só o que a página realmente entrega.
 * Ficava saindo em toda página de guia sem servir para nada.
 */
export function productSchema(p: ProdutoSchema): Json | null {
  if (!p.name || !p.url) return null;
  if (p.price === null || p.price <= 0) return null;

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    url: p.url,
    ...(p.image ? { image: p.image } : {}),
    ...(p.description ? { description: p.description } : {}),
    brand: { "@type": "Brand", name: p.brand ?? SITE.name },
  };

  schema.offers = {
    "@type": "Offer",
    price: p.price.toFixed(2),
    priceCurrency: "BRL",
    availability: p.disponivel
      ? "https://schema.org/InStock"
      : "https://schema.org/OutOfStock",
    url: p.url,
  };

  return schema as Json;
}

/**
 * HowTo: um passo a passo real da página.
 *
 * Estava escrito inline dentro da página do medidor, único schema do projeto
 * fora dos builders, o que fazia dele o mais fácil de esquecer quando a
 * interface mudasse. Os passos precisam descrever o que a tela realmente faz.
 */
export function howToSchema(dados: {
  nome: string;
  descricao: string;
  tempoTotal?: string;
  materiais?: string[];
  passos: { nome: string; texto: string }[];
}): Json {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: dados.nome,
    description: dados.descricao,
    ...(dados.tempoTotal ? { totalTime: dados.tempoTotal } : {}),
    ...(dados.materiais?.length
      ? {
          supply: dados.materiais.map((nome) => ({
            "@type": "HowToSupply",
            name: nome,
          })),
        }
      : {}),
    step: dados.passos.map((p, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: p.nome,
      text: p.texto,
    })),
  } as Json;
}
