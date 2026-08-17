/**
 * Extrai o índice do conteúdo a partir dos H2 e coloca âncoras neles.
 *
 * Roda no servidor, sobre o HTML gerado pelo editor, então a âncora já vai no
 * HTML entregue ao Google, sem depender de JavaScript no navegador.
 */

export type ItemIndice = { id: string; titulo: string };

function paraId(texto: string, usados: Set<string>): string {
  const base =
    texto
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/<[^>]*>/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "secao";

  let id = base;
  let n = 2;
  while (usados.has(id)) id = `${base}-${n++}`;
  usados.add(id);
  return id;
}

type H2Encontrado = {
  /** Onde a tag começa e termina no HTML original. */
  inicio: number;
  fim: number;
  atributos: string;
  conteudo: string;
  texto: string;
  id: string;
};

/**
 * Varre os H2 UMA vez e decide a âncora de cada um.
 *
 * Existe para `comIndice` (que reescreve o HTML) e `secoesDoHtml` (que recorta
 * o texto para a busca) nunca discordarem. A âncora precisa ser idêntica nos
 * dois: `paraId` desambigua título repetido com um contador, então duas varreduras
 * separadas dariam sufixos diferentes, e o link da busca cairia na seção errada.
 */
function escanearH2(html: string): H2Encontrado[] {
  const achados: H2Encontrado[] = [];
  const usados = new Set<string>();
  const re = /<h2([^>]*)>([\s\S]*?)<\/h2>/gi;

  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const atributos = m[1];
    const conteudo = m[2];
    const texto = conteudo.replace(/<[^>]*>/g, "").trim();
    // H2 vazio não vira seção, e também não consome um número da
    // desambiguação. Precisa ser igual nos dois usos.
    if (!texto) continue;

    const idExistente = /id\s*=\s*"([^"]+)"/i.exec(atributos)?.[1];
    achados.push({
      inicio: m.index,
      fim: m.index + m[0].length,
      atributos,
      conteudo,
      texto,
      id: idExistente ?? paraId(texto, usados),
    });
  }

  return achados;
}

export type SecaoDoTexto = {
  /** Nulo no trecho que vem antes do primeiro H2. */
  ancora: string | null;
  titulo: string | null;
  html: string;
};

/**
 * Recorta o corpo em seções, uma por H2.
 *
 * A busca indexa por seção, e não a página inteira, para o resultado poder
 * levar direto ao trecho certo (`/slug#ancora`) em vez de jogar a pessoa
 * no topo de um texto longo.
 */
export function secoesDoHtml(html: string): SecaoDoTexto[] {
  if (!html) return [];

  const h2s = escanearH2(html);
  if (h2s.length === 0) {
    return html.trim() ? [{ ancora: null, titulo: null, html }] : [];
  }

  const secoes: SecaoDoTexto[] = [];

  const abertura = html.slice(0, h2s[0].inicio);
  if (abertura.trim()) secoes.push({ ancora: null, titulo: null, html: abertura });

  h2s.forEach((h2, i) => {
    const ate = i + 1 < h2s.length ? h2s[i + 1].inicio : html.length;
    secoes.push({ ancora: h2.id, titulo: h2.texto, html: html.slice(h2.fim, ate) });
  });

  return secoes;
}

/**
 * Prepara as imagens do corpo para carregar bem.
 *
 * A PRIMEIRA imagem costuma estar acima da dobra e muitas vezes é o maior
 * elemento da tela, então adiar o carregamento dela atrasa o LCP de graça.
 * Ela ganha prioridade; as seguintes continuam adiadas.
 *
 * Também garante `decoding="async"`, que evita travar a pintura da página.
 */
function prepararImagens(
  html: string,
  dimensoes?: Map<string, { width: number; height: number }>,
): string {
  let primeira = true;
  return html.replace(/<img\b[^>]*>/gi, (tag) => {
    let nova = tag;

    // Escreve a dimensão real quando ela não está na tag, o que acontece em
    // conteúdo salvo antes de o editor passar a gravar isso.
    if (dimensoes && !/width\s*=/i.test(nova)) {
      const src = /src\s*=\s*"([^"]+)"/i.exec(nova)?.[1];
      const d = src ? dimensoes.get(src) : undefined;
      if (d) {
        nova = nova.replace(/<img/i, `<img width="${d.width}" height="${d.height}"`);
      }
    }

    if (primeira) {
      primeira = false;
      nova = nova.replace(/\s*loading\s*=\s*"[^"]*"/i, "");
      if (!/fetchpriority/i.test(nova)) {
        nova = nova.replace(/<img/i, '<img fetchpriority="high"');
      }
    } else if (!/loading\s*=/i.test(nova)) {
      nova = nova.replace(/<img/i, '<img loading="lazy"');
    }

    if (!/decoding\s*=/i.test(nova)) {
      nova = nova.replace(/<img/i, '<img decoding="async"');
    }
    return nova;
  });
}

/** Devolve o HTML com id nos H2, imagens preparadas, e a lista do índice. */
export function comIndice(
  html: string,
  dimensoes?: Map<string, { width: number; height: number }>,
): { html: string; indice: ItemIndice[] } {
  if (!html) return { html, indice: [] };

  const h2s = escanearH2(html);
  const indice: ItemIndice[] = h2s.map((h) => ({ id: h.id, titulo: h.texto }));

  // Reconstrói de trás para frente para os índices de posição continuarem
  // válidos enquanto o texto cresce com os `id` inseridos.
  let novo = html;
  for (let i = h2s.length - 1; i >= 0; i--) {
    const h = h2s[i];
    const jaTemId = /id\s*=\s*"/i.test(h.atributos);
    const attrs = jaTemId ? h.atributos : `${h.atributos} id="${h.id}"`;
    novo = novo.slice(0, h.inicio) + `<h2${attrs}>${h.conteudo}</h2>` + novo.slice(h.fim);
  }

  return { html: prepararImagens(novo, dimensoes), indice };
}
