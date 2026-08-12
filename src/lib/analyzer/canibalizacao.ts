/**
 * Canibalização, medida sem IA.
 *
 * Duas páginas disputando a mesma consulta se enfraquecem: o Google escolhe uma
 * e nem sempre é a melhor, e o sinal fica dividido. A checagem que existia antes
 * dependia da IA olhar uma lista de títulos, o que custa dinheiro, demora e não
 * dá o mesmo resultado duas vezes. Isto aqui é comparação de texto, roda em
 * milissegundos e sempre responde igual.
 */

/** Palavras que não distinguem assunto nenhum em pt-BR. */
const VAZIAS = new Set([
  "a", "o", "as", "os", "um", "uma", "uns", "umas", "de", "da", "do", "das", "dos",
  "e", "ou", "em", "no", "na", "nos", "nas", "por", "para", "pra", "com", "sem",
  "que", "se", "ao", "aos", "à", "às", "the", "of",
]);

/** Minúsculas, sem acento, sem pontuação, sem palavra vazia. */
export function tokens(texto: string): string[] {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !VAZIAS.has(t));
}

/** Assinatura estável de uma consulta: mesmas palavras, mesma assinatura. */
export function assinatura(texto: string): string {
  return [...new Set(tokens(texto))].sort().join(" ");
}

/** Quanto dois conjuntos de palavras se sobrepõem, de 0 a 1. */
export function sobreposicao(a: string, b: string): number {
  const A = new Set(tokens(a));
  const B = new Set(tokens(b));
  if (A.size === 0 || B.size === 0) return 0;
  let comuns = 0;
  for (const t of A) if (B.has(t)) comuns++;
  return comuns / new Set([...A, ...B]).size;
}

export type PaginaComparavel = {
  id: string;
  title: string;
  slug: string;
  targetQuery: string | null;
  status: string;
  /** Usados pelo analisador para achar título e meta repetidos entre páginas. */
  metaTitle?: string | null;
  metaDescription?: string | null;
};

export type Choque = {
  id: string;
  title: string;
  slug: string;
  status: string;
  /** "alvo" quando a consulta alvo é a mesma; "titulo" quando só o assunto bate. */
  motivo: "alvo" | "titulo";
  gravidade: "erro" | "alerta";
  explicacao: string;
};

/**
 * Compara a página em edição com as outras. Consulta alvo idêntica é erro,
 * porque é disputa declarada. Assunto muito parecido é alerta, porque às vezes
 * é legítimo (um pilar e um artigo do mesmo cluster se parecem de propósito).
 */
export function acharChoques(
  atual: { titulo: string; consultaAlvo: string },
  outras: PaginaComparavel[],
): Choque[] {
  const alvoAtual = assinatura(atual.consultaAlvo);
  const achados: Choque[] = [];

  for (const o of outras) {
    if (alvoAtual && o.targetQuery && assinatura(o.targetQuery) === alvoAtual) {
      achados.push({
        id: o.id, title: o.title, slug: o.slug, status: o.status,
        motivo: "alvo",
        gravidade: "erro",
        explicacao: `Tem a mesma consulta alvo: "${o.targetQuery}". Escolha uma das duas para essa busca e mude o alvo da outra.`,
      });
      continue;
    }

    // 0,7 é alto de propósito. Abaixo disso aparece parecença de vocabulário
    // que não é disputa de verdade, e alerta que grita à toa passa a ser ignorado.
    const semelhanca = Math.max(
      sobreposicao(atual.titulo, o.title),
      atual.consultaAlvo && o.targetQuery ? sobreposicao(atual.consultaAlvo, o.targetQuery) : 0,
    );
    if (semelhanca >= 0.7) {
      achados.push({
        id: o.id, title: o.title, slug: o.slug, status: o.status,
        motivo: "titulo",
        gravidade: "alerta",
        explicacao: `Trata quase do mesmo assunto (${Math.round(semelhanca * 100)}% das palavras em comum). Se as duas ficarem no ar, deixe claro o recorte de cada uma e ligue uma na outra.`,
      });
    }
  }

  // Erro antes de alerta, e publicado antes de rascunho: publicado já está
  // disputando de verdade.
  const peso = (c: Choque) => (c.gravidade === "erro" ? 0 : 1) + (c.status === "published" ? 0 : 0.5);
  return achados.sort((a, b) => peso(a) - peso(b)).slice(0, 8);
}
