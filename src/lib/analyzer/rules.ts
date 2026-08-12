/**
 * Analisador determinístico de SEO, GEO e voz da marca.
 *
 * Roda no cliente enquanto a pessoa digita (sem IA, sem custo, instantâneo).
 * A camada com IA é complementar e fica em src/lib/analyzer/ai.ts.
 *
 * As regras vêm de REGRAS.md. Se a regra mudar lá, mude aqui.
 */

export type Nivel = "ok" | "aviso" | "erro";

export type Check = {
  id: string;
  grupo: "SEO" | "GEO" | "Voz";
  titulo: string;
  nivel: Nivel;
  /** O que fazer para resolver. Escrito para humano, sem jargão. */
  dica?: string;
};

export type Entrada = {
  titulo: string;
  slug: string;
  metaTitle: string;
  metaDescription: string;
  /** Bloco de resposta rápida (GEO). */
  resposta: string;
  /** Texto puro do corpo. */
  texto: string;
  /** HTML do corpo, para inspecionar headings, links e imagens. */
  html: string;
  faqs: { question: string; answer: string }[];
  /** Consulta principal que a página quer ganhar. */
  consultaAlvo: string;
  autor: string;
  revisor: string;
  /**
   * Título e meta das OUTRAS páginas, para detectar repetição entre páginas.
   * A documentação do Google chama isso de micro-boilerplate e lista como um
   * dos motivos de o buscador reescrever o título que você escolheu.
   */
  outrasPaginas?: { titulo: string; metaDescription: string }[];
  /**
   * Se alguma página publicada aponta para esta. Página sem link de entrada é
   * órfã: o Google descobre a maioria das páginas novas seguindo links.
   */
  temLinkDeEntrada?: boolean;
};

/**
 * Erros que BARRAM a publicação.
 *
 * A lista é curta de propósito. São defeitos objetivos, que não dependem de
 * julgamento editorial e que ninguém quer no ar: quebram uma regra absoluta do
 * projeto (travessão), quebram acessibilidade (imagem sem alt), quebram a
 * estrutura da página (H1 no corpo), ou publicam texto de esqueleto.
 *
 * Todo o resto continua sendo conselho. Um analisador que barra tudo vira
 * obstáculo, e obstáculo se contorna.
 */
export const ERROS_QUE_BARRAM = new Set([
  "travessao",
  "img",
  "h1",
  "modelo",
  "titulo",
  "meta",
  "slug",
]);

/** Os erros bloqueantes de um resultado, prontos para virar mensagem. */
export function bloqueiosDePublicacao(r: Resultado): Check[] {
  return r.checks.filter((c) => c.nivel === "erro" && ERROS_QUE_BARRAM.has(c.id));
}

export type Resultado = {
  nota: number;
  notaSeo: number;
  notaGeo: number;
  /** Pesa 20% da nota final e não era exibida em lugar nenhum. */
  notaVoz: number;
  checks: Check[];
};

/* ------------------------------------------------------------------ voz */

/** Travessão longo e traço médio. Proibidos em qualquer texto. */
const TRAVESSAO = /[—–]/;

/** Expressões que denunciam texto de robô ou gerado por IA. */
const FRASES_ROBO = [
  "vamos mergulhar",
  "neste artigo",
  "você vai descobrir",
  "é importante ressaltar",
  "é importante destacar",
  "vale ressaltar",
  "em resumo",
  "em suma",
  "no mundo de hoje",
  "nos dias de hoje",
  "cabe destacar",
  "otimize sua experiência",
  "solução completa",
  "não perca tempo",
  "fique por dentro",
  "sem mais delongas",
  "por fim, mas não menos importante",
  "espero que este artigo",
  "vamos explorar",
  "desvendar os segredos",
];

/** Afirmação genérica que serve para qualquer joalheria. */
const FRASES_GENERICAS = [
  "a melhor opção do mercado",
  "qualidade superior",
  "excelência em atendimento",
  "referência no mercado",
  "os melhores preços",
  "atendimento diferenciado",
  "produtos de alta qualidade",
];

const EMOJI =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{1F900}-\u{1F9FF}]/u;

/* -------------------------------------------------------------- helpers */

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const contem = (texto: string, alvo: string) =>
  alvo.trim().length > 0 && norm(texto).includes(norm(alvo));

function frases(texto: string): string[] {
  return texto
    .split(/(?<=[.!?])\s+/)
    .map((f) => f.trim())
    .filter((f) => f.length > 0);
}

function contarPalavras(texto: string): number {
  return texto.trim().split(/\s+/).filter(Boolean).length;
}

/** Headings do HTML, na ordem em que aparecem. */
function headings(html: string): number[] {
  const out: number[] = [];
  const re = /<h([1-6])\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) out.push(Number(m[1]));
  return out;
}

function imagens(html: string): { alt: string | null }[] {
  const out: { alt: string | null }[] = [];
  const re = /<img\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const alt = /alt\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(m[0]);
    out.push({ alt: alt ? (alt[1] ?? alt[2] ?? null) : null });
  }
  return out;
}

/** Atributos que interessam de cada `<img>`. */
function imagensDetalhadas(
  html: string,
): { alt: string | null; temDimensao: boolean; arquivo: string }[] {
  const out: { alt: string | null; temDimensao: boolean; arquivo: string }[] = [];
  const re = /<img\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const tag = m[0];
    const alt = /alt\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(tag);
    const src = /src\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(tag);
    const bruto = src ? (src[1] ?? src[2] ?? "") : "";
    const arquivo = bruto.split("/").pop()?.split("?")[0] ?? "";
    out.push({
      alt: alt ? (alt[1] ?? alt[2] ?? null) : null,
      temDimensao: /\bwidth\s*=/i.test(tag) && /\bheight\s*=/i.test(tag),
      arquivo,
    });
  }
  return out;
}

function links(html: string): { href: string; texto: string }[] {
  const out: { href: string; texto: string }[] = [];
  const re = /<a\b[^>]*href\s*=\s*(?:"([^"]*)"|\'([^\']*)\')[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    out.push({ href: m[1] ?? m[2] ?? "", texto: (m[3] ?? "").replace(/<[^>]*>/g, "").trim() });
  }
  return out;
}

/* ------------------------------------------------------------ analisador */

export function analisar(e: Entrada): Resultado {
  const checks: Check[] = [];
  const add = (c: Check) => checks.push(c);

  const tituloFinal = e.metaTitle.trim() || e.titulo.trim();
  const hs = headings(e.html);
  const imgs = imagens(e.html);
  const ls = links(e.html);
  const palavras = contarPalavras(e.texto);
  const textoTudo = `${e.titulo}\n${e.resposta}\n${e.texto}`;
  const primeirosParagrafos = `${e.resposta}\n${e.texto.slice(0, 600)}`;

  /* ---------------------------------------------------------------- SEO */

  // Título
  if (!e.titulo.trim()) {
    add({ id: "titulo", grupo: "SEO", titulo: "Título", nivel: "erro", dica: "A página precisa de um título." });
  } else if (tituloFinal.length > 60) {
    add({ id: "titulo", grupo: "SEO", titulo: `Título com ${tituloFinal.length} caracteres`, nivel: "aviso", dica: "O Google corta perto de 60. Encurte para não perder o final." });
  } else if (tituloFinal.length < 25) {
    add({ id: "titulo", grupo: "SEO", titulo: `Título curto (${tituloFinal.length})`, nivel: "aviso", dica: "Use entre 25 e 60 caracteres para aproveitar o espaço da busca." });
  } else {
    add({ id: "titulo", grupo: "SEO", titulo: `Título com ${tituloFinal.length} caracteres`, nivel: "ok" });
  }

  // Meta description
  const md = e.metaDescription.trim().length;
  if (md === 0) {
    add({ id: "meta", grupo: "SEO", titulo: "Meta description vazia", nivel: "erro", dica: "Escreva de 140 a 160 caracteres pensando no clique." });
  } else if (md < 140 || md > 160) {
    // 140 a 160, o mesmo número que aparece na dica, no contador embaixo do
    // campo e no prompt da IA. Antes a regra usava 120 a 165 e as três outras
    // camadas diziam 140 a 160, então o painel ficava verde com a meta que o
    // resto do sistema considerava fora do ponto.
    add({ id: "meta", grupo: "SEO", titulo: `Meta description com ${md} caracteres`, nivel: "aviso", dica: md < 140 ? "Faltam caracteres para explicar o conteúdo. O ideal fica entre 140 e 160." : "O Google corta o que passa de 160. Enxugue." });
  } else {
    add({ id: "meta", grupo: "SEO", titulo: `Meta description com ${md} caracteres`, nivel: "ok" });
  }

  // Slug
  if (!e.slug.trim()) {
    add({ id: "slug", grupo: "SEO", titulo: "Slug vazio", nivel: "erro", dica: "Defina o endereço da página." });
  } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(e.slug)) {
    add({ id: "slug", grupo: "SEO", titulo: "Slug fora do padrão", nivel: "erro", dica: "Use só minúsculas, números e hífen. Sem acento e sem espaço." });
  } else if (e.slug.split("-").length > 7) {
    add({ id: "slug", grupo: "SEO", titulo: "Slug longo demais", nivel: "aviso", dica: "Deixe curto e direto, até umas 6 palavras." });
  } else {
    add({ id: "slug", grupo: "SEO", titulo: "Slug no padrão", nivel: "ok" });
  }

  // Consulta alvo
  if (!e.consultaAlvo.trim()) {
    add({ id: "alvo", grupo: "SEO", titulo: "Consulta principal não definida", nivel: "erro", dica: "Diga qual busca esta página quer ganhar. Sem isso não dá para medir nada." });
  } else {
    const noTitulo = contem(tituloFinal, e.consultaAlvo);
    const noSlug = contem(e.slug.replace(/-/g, " "), e.consultaAlvo);
    const noInicio = contem(primeirosParagrafos, e.consultaAlvo);
    const faltas = [!noTitulo && "título", !noSlug && "slug", !noInicio && "início do texto"].filter(Boolean);
    if (faltas.length === 0) {
      add({ id: "alvo", grupo: "SEO", titulo: "Consulta principal bem posicionada", nivel: "ok" });
    } else {
      add({ id: "alvo", grupo: "SEO", titulo: `Consulta principal ausente em: ${faltas.join(", ")}`, nivel: faltas.length > 1 ? "erro" : "aviso", dica: "Inclua a consulta de forma natural, sem repetir à força." });
    }
  }

  // Headings
  if (hs.includes(1)) {
    add({ id: "h1", grupo: "SEO", titulo: "Há um H1 dentro do conteúdo", nivel: "erro", dica: "O H1 é o título da página. No corpo use H2 e H3." });
  }
  let pulou = false;
  for (let i = 1; i < hs.length; i++) if (hs[i] - hs[i - 1] > 1) pulou = true;
  if (pulou) {
    add({ id: "hierarquia", grupo: "SEO", titulo: "Hierarquia de títulos com salto", nivel: "aviso", dica: "Não pule de H2 para H4. Siga a ordem." });
  } else if (hs.length > 0) {
    add({ id: "hierarquia", grupo: "SEO", titulo: `Estrutura com ${hs.length} subtítulos`, nivel: "ok" });
  } else if (palavras > 250) {
    add({ id: "hierarquia", grupo: "SEO", titulo: "Texto sem subtítulos", nivel: "aviso", dica: "Quebre em seções com H2 para facilitar a leitura e a extração por IA." });
  }

  // Imagens
  const semAlt = imgs.filter((i) => !i.alt || !i.alt.trim()).length;
  if (imgs.length === 0) {
    add({ id: "img", grupo: "SEO", titulo: "Nenhuma imagem", nivel: "aviso", dica: "Uma imagem própria ajuda o tempo de permanência e a busca por imagens." });
  } else if (semAlt > 0) {
    add({ id: "img", grupo: "SEO", titulo: `${semAlt} imagem(ns) sem texto alternativo`, nivel: "erro", dica: "Descreva a imagem para quem não enxerga. É exigência de acessibilidade e vale para SEO." });
  } else {
    add({ id: "img", grupo: "SEO", titulo: `${imgs.length} imagem(ns), todas com alt`, nivel: "ok" });
  }

  // Imagem sem dimensão declarada: é o que causa o salto de layout (CLS) que a
  // documentação de page experience mede.
  const detalhadas = imagensDetalhadas(e.html);
  const semDimensao = detalhadas.filter((i) => !i.temDimensao).length;
  if (detalhadas.length > 0) {
    if (semDimensao > 0) {
      add({ id: "imgDimensao", grupo: "SEO", titulo: `${semDimensao} imagem(ns) sem largura e altura`, nivel: "aviso", dica: "Sem width e height o texto pula quando a foto carrega. Reenvie pela biblioteca, que grava a dimensão." });
    } else {
      add({ id: "imgDimensao", grupo: "SEO", titulo: "Todas as imagens com dimensão", nivel: "ok" });
    }

    // Alt repetido ou igual ao nome do arquivo. A documentação de imagens pede
    // texto descritivo e específico, e alerta contra empilhar palavra-chave.
    const alts = detalhadas
      .map((i) => (i.alt ?? "").trim().toLowerCase())
      .filter(Boolean);
    const repetidos = alts.length - new Set(alts).size;
    const igualAoArquivo = detalhadas.filter((i) => {
      const alt = (i.alt ?? "").trim().toLowerCase();
      if (!alt || !i.arquivo) return false;
      const nome = i.arquivo.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").toLowerCase();
      return alt === nome;
    }).length;

    if (repetidos > 0 || igualAoArquivo > 0) {
      const partes = [
        repetidos > 0 && `${repetidos} alt repetido${repetidos > 1 ? "s" : ""}`,
        igualAoArquivo > 0 && `${igualAoArquivo} igual ao nome do arquivo`,
      ].filter(Boolean);
      add({ id: "altRepetido", grupo: "SEO", titulo: `Texto alternativo fraco: ${partes.join(", ")}`, nivel: "aviso", dica: "Cada imagem descreve uma coisa diferente. Escreva o que se vê nela, não o nome do arquivo." });
    } else if (alts.length > 1) {
      add({ id: "altRepetido", grupo: "SEO", titulo: "Cada imagem com alt próprio", nivel: "ok" });
    }
  }

  // Densidade da consulta alvo. Repetir a expressão à exaustão é o exemplo que
  // a política de spam do Google dá para keyword stuffing, e o REGRAS.md diz a
  // mesma coisa com outras palavras.
  if (e.consultaAlvo.trim() && palavras >= 100) {
    const alvoNorm = norm(e.consultaAlvo.trim());
    const ocorrencias = norm(textoTudo).split(alvoNorm).length - 1;
    const palavrasDoAlvo = Math.max(1, contarPalavras(e.consultaAlvo));
    const densidade = (ocorrencias * palavrasDoAlvo) / palavras;
    if (densidade > 0.025) {
      add({ id: "densidade", grupo: "SEO", titulo: `Consulta principal repetida ${ocorrencias} vezes`, nivel: "aviso", dica: "Passou de 2,5% do texto. Troque parte das repetições por sinônimo ou pronome, que o Google entende igual." });
    } else {
      add({ id: "densidade", grupo: "SEO", titulo: "Consulta usada com naturalidade", nivel: "ok" });
    }
  }

  // Título e meta repetidos entre páginas. A documentação de title link chama
  // isso de micro-boilerplate e cita como motivo para o Google reescrever o
  // título que você escolheu.
  if (e.outrasPaginas?.length) {
    const meuTitulo = norm(tituloFinal);
    const minhaMeta = norm(e.metaDescription.trim());
    const tituloIgual = e.outrasPaginas.some((o) => norm(o.titulo) === meuTitulo && meuTitulo);
    const metaIgual =
      minhaMeta.length > 0 &&
      e.outrasPaginas.some((o) => norm(o.metaDescription) === minhaMeta);
    if (tituloIgual || metaIgual) {
      const oque = [tituloIgual && "o título", metaIgual && "a meta description"].filter(Boolean);
      add({ id: "tituloUnico", grupo: "SEO", titulo: `Outra página já usa ${oque.join(" e ")}`, nivel: "aviso", dica: "Texto repetido entre páginas faz o Google reescrever o seu. Diferencie pelo que cada página tem de específico." });
    } else {
      add({ id: "tituloUnico", grupo: "SEO", titulo: "Título e meta únicos no portal", nivel: "ok" });
    }
  }

  // Página órfã. O Google descobre a maioria das páginas novas seguindo links.
  if (e.temLinkDeEntrada !== undefined) {
    if (e.temLinkDeEntrada) {
      add({ id: "orfa", grupo: "SEO", titulo: "Tem link de entrada", nivel: "ok" });
    } else {
      add({ id: "orfa", grupo: "SEO", titulo: "Nenhuma página publicada aponta para esta", nivel: "aviso", dica: "Cite esta página em outro guia. Sem link de entrada, o Google só chega por sitemap e ela vale menos." });
    }
  }

  // Links internos
  const internos = ls.filter((l) => l.href.startsWith("/") || l.href.includes("jkaliancas"));
  const ancoraRuim = ls.filter((l) => /^(clique aqui|aqui|saiba mais|leia mais)$/i.test(l.texto.trim()));
  if (internos.length < 2) {
    add({ id: "links", grupo: "SEO", titulo: `Apenas ${internos.length} link(s) interno(s)`, nivel: "aviso", dica: "Ligue a outros guias, categorias ou lojas. O mínimo do projeto são 2 de saída." });
  } else {
    add({ id: "links", grupo: "SEO", titulo: `${internos.length} links internos`, nivel: "ok" });
  }
  if (ancoraRuim.length > 0) {
    add({ id: "ancora", grupo: "SEO", titulo: "Âncora genérica encontrada", nivel: "aviso", dica: 'Troque "clique aqui" por texto que descreve o destino.' });
  }

  // Tamanho
  if (palavras < 300) {
    add({ id: "tamanho", grupo: "SEO", titulo: `Texto curto (${palavras} palavras)`, nivel: palavras < 150 ? "erro" : "aviso", dica: "Para guia, mire acima de 600 palavras respondendo de verdade." });
  } else {
    add({ id: "tamanho", grupo: "SEO", titulo: `${palavras} palavras`, nivel: "ok" });
  }

  // Autor e revisor
  if (!e.autor.trim() || !e.revisor.trim()) {
    add({ id: "autoria", grupo: "SEO", titulo: "Autor ou revisor em branco", nivel: "aviso", dica: "Pessoa real assinando e revisando é sinal de confiança para o Google." });
  } else {
    add({ id: "autoria", grupo: "SEO", titulo: "Autor e revisor preenchidos", nivel: "ok" });
  }

  /* ---------------------------------------------------------------- GEO */

  const respLen = e.resposta.trim().length;
  const respFrases = frases(e.resposta).length;
  if (respLen === 0) {
    add({ id: "resposta", grupo: "GEO", titulo: "Sem bloco de resposta rápida", nivel: "erro", dica: "É o bloco que a IA cita. Responda a dúvida principal em 2 a 4 frases." });
  } else if (respLen < 120) {
    add({ id: "resposta", grupo: "GEO", titulo: "Resposta rápida muito curta", nivel: "aviso", dica: "Ela precisa fazer sentido sozinha, fora da página." });
  } else if (respFrases > 5 || respLen > 700) {
    add({ id: "resposta", grupo: "GEO", titulo: "Resposta rápida longa demais", nivel: "aviso", dica: "Enxugue para 2 a 4 frases. O resto vai no corpo." });
  } else {
    add({ id: "resposta", grupo: "GEO", titulo: "Resposta rápida no ponto", nivel: "ok" });
  }

  if (contem(primeirosParagrafos, "jk aliancas") || contem(primeirosParagrafos, "jk alianças")) {
    add({ id: "entidade", grupo: "GEO", titulo: "Marca citada no início", nivel: "ok" });
  } else {
    add({ id: "entidade", grupo: "GEO", titulo: "Marca não citada no início", nivel: "aviso", dica: 'Escreva "JK Alianças" por extenso nos primeiros parágrafos para a IA associar a resposta à marca.' });
  }

  if (e.faqs.filter((f) => f.question.trim() && f.answer.trim()).length < 2) {
    add({ id: "faq", grupo: "GEO", titulo: "Menos de 2 perguntas frequentes", nivel: "aviso", dica: "FAQ real alimenta o schema e é muito citada por IA." });
  } else {
    add({ id: "faq", grupo: "GEO", titulo: `${e.faqs.length} perguntas frequentes`, nivel: "ok" });
  }

  const temTabela = /<table\b/i.test(e.html);
  const temLista = /<(ul|ol)\b/i.test(e.html);
  if (temTabela) {
    add({ id: "tabela", grupo: "GEO", titulo: "Tem tabela comparativa", nivel: "ok" });
  } else if (temLista) {
    add({ id: "tabela", grupo: "GEO", titulo: "Tem lista, sem tabela", nivel: "aviso", dica: "Se o conteúdo compara opções, tabela é o formato que a IA extrai melhor." });
  } else {
    add({ id: "tabela", grupo: "GEO", titulo: "Sem lista nem tabela", nivel: "aviso", dica: "Estruture parte do conteúdo em lista ou tabela." });
  }

  // Tabela sem cabeçalho e sem legenda. A tabela é o formato que a IA extrai
  // melhor, mas só quando dá para saber o que cada coluna significa.
  if (temTabela) {
    const semTh = !/<th\b/i.test(e.html);
    const semCaption = !/<caption\b/i.test(e.html);
    if (semTh || semCaption) {
      const faltando = [semTh && "cabeçalho", semCaption && "legenda"].filter(Boolean);
      add({ id: "tabelaCabecalho", grupo: "GEO", titulo: `Tabela sem ${faltando.join(" e sem ")}`, nivel: "aviso", dica: "Sem cabeçalho ninguém sabe o que cada coluna compara, nem a pessoa nem a IA." });
    } else {
      add({ id: "tabelaCabecalho", grupo: "GEO", titulo: "Tabela com cabeçalho e legenda", nivel: "ok" });
    }
  }

  // Vídeo sem título acessível.
  const iframes = e.html.match(/<iframe\b[^>]*>/gi) ?? [];
  if (iframes.length > 0) {
    const semTitulo = iframes.filter(
      (t) => !/\btitle\s*=\s*(?:"[^"]+"|'[^']+')/i.test(t),
    ).length;
    if (semTitulo > 0) {
      add({ id: "videoTitulo", grupo: "GEO", titulo: `${semTitulo} vídeo(s) sem título`, nivel: "aviso", dica: "Sem title o leitor de tela anuncia apenas um quadro sem nome. Reinsira o vídeo pelo bloco, que pede o título." });
    } else {
      add({ id: "videoTitulo", grupo: "GEO", titulo: "Vídeo com título", nivel: "ok" });
    }
  }

  // Trechos citáveis: frases com dado concreto
  const citaveis = frases(textoTudo).filter(
    (f) => /\d/.test(f) && f.length > 40 && f.length < 300,
  ).length;
  if (citaveis === 0) {
    add({ id: "citavel", grupo: "GEO", titulo: "Nenhum trecho com dado concreto", nivel: "aviso", dica: "Números e medidas (teor, largura em mm, prazo) são o que a IA cita com segurança." });
  } else {
    add({ id: "citavel", grupo: "GEO", titulo: `${citaveis} trecho(s) com dado concreto`, nivel: "ok" });
  }

  /* ---------------------------------------------------------------- Voz */

  const alvoVoz = `${e.titulo}\n${e.metaTitle}\n${e.metaDescription}\n${e.resposta}\n${e.texto}\n${e.faqs.map((f) => `${f.question} ${f.answer}`).join("\n")}`;

  if (TRAVESSAO.test(alvoVoz)) {
    add({ id: "travessao", grupo: "Voz", titulo: "Travessão encontrado", nivel: "erro", dica: "Regra absoluta do projeto: nada de travessão. Troque por vírgula, dois pontos ou ponto." });
  } else {
    add({ id: "travessao", grupo: "Voz", titulo: "Sem travessão", nivel: "ok" });
  }

  const achadasRobo = FRASES_ROBO.filter((f) => contem(alvoVoz, f));
  if (achadasRobo.length > 0) {
    add({ id: "robo", grupo: "Voz", titulo: `Expressão de robô: "${achadasRobo[0]}"${achadasRobo.length > 1 ? ` e mais ${achadasRobo.length - 1}` : ""}`, nivel: "erro", dica: "Reescreva com linguagem direta, como alguém explicando para um cliente." });
  } else {
    add({ id: "robo", grupo: "Voz", titulo: "Sem linguagem de robô", nivel: "ok" });
  }

  const achadasGen = FRASES_GENERICAS.filter((f) => contem(alvoVoz, f));
  if (achadasGen.length > 0) {
    add({ id: "generico", grupo: "Voz", titulo: `Afirmação genérica: "${achadasGen[0]}"`, nivel: "aviso", dica: "Troque por fato verificável. Se serve para qualquer joalheria, não serve para a JK." });
  } else {
    add({ id: "generico", grupo: "Voz", titulo: "Sem afirmação genérica", nivel: "ok" });
  }

  // Sobra de modelo. O esqueleto do modelo de conteúdo marca cada trecho a
  // preencher, e publicar com a marca ainda lá é o pior erro possível: vai ao
  // ar um texto que se dirige a quem escreve, não a quem lê.
  // Estas três regras só entravam na lista quando FALHAVAM. Como a nota é a
  // média dos itens, aparecer só no erro empurrava a nota para baixo sem nunca
  // poder somar a favor. Agora entram sempre, com estado ok quando passam.
  const pendentes = (alvoVoz.match(/Escreva aqui/gi) ?? []).length;
  if (pendentes > 0) {
    add({ id: "modelo", grupo: "Voz", titulo: `${pendentes} trecho${pendentes > 1 ? "s" : ""} do modelo por preencher`, nivel: "erro", dica: 'Substitua tudo que começa com "Escreva aqui" pelo texto de verdade.' });
  } else {
    add({ id: "modelo", grupo: "Voz", titulo: "Nada do modelo por preencher", nivel: "ok" });
  }

  if (EMOJI.test(`${e.titulo}${e.resposta}${e.texto}`)) {
    add({ id: "emoji", grupo: "Voz", titulo: "Emoji no conteúdo", nivel: "aviso", dica: "Emoji não entra em conteúdo editorial." });
  } else {
    add({ id: "emoji", grupo: "Voz", titulo: "Sem emoji no conteúdo", nivel: "ok" });
  }

  // Frases longas atrapalham leitura e extração
  const longas = frases(e.texto).filter((f) => contarPalavras(f) > 35).length;
  if (longas > 2) {
    add({ id: "leitura", grupo: "Voz", titulo: `${longas} frases muito longas`, nivel: "aviso", dica: "Quebre frases acima de 35 palavras. Uma ideia por frase." });
  } else {
    add({ id: "leitura", grupo: "Voz", titulo: "Frases no tamanho certo", nivel: "ok" });
  }

  /* -------------------------------------------------------------- notas */

  const nota = (grupos: Check[]) => {
    if (grupos.length === 0) return 100;
    const peso = grupos.reduce((acc, c) => acc + (c.nivel === "ok" ? 1 : c.nivel === "aviso" ? 0.5 : 0), 0);
    return Math.round((peso / grupos.length) * 100);
  };

  const seo = checks.filter((c) => c.grupo === "SEO");
  const geo = checks.filter((c) => c.grupo === "GEO");
  const voz = checks.filter((c) => c.grupo === "Voz");

  const notaSeo = nota(seo);
  const notaGeo = nota(geo);
  const notaVoz = nota(voz);

  return {
    notaSeo,
    notaGeo,
    notaVoz,
    nota: Math.round(notaSeo * 0.4 + notaGeo * 0.4 + notaVoz * 0.2),
    checks,
  };
}
