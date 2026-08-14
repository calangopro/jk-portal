import { createReadClient } from "@/lib/supabase/read";

/**
 * Dados do comparador de materiais.
 *
 * Cada número da tabela tem origem declarada, e as origens são de naturezas
 * diferentes de propósito:
 *
 *   Teor          definição metrológica. "925" significa 92,5% de prata em
 *                 qualquer joalheria do mundo, então é fato aprovado desde o
 *                 primeiro dia.
 *   Faixa de preço catálogo sincronizado da Tray. É dado, não afirmação, e se
 *                 atualiza sozinho a cada sincronização.
 *   Durabilidade  afirmação da JK sobre o próprio produto. Só aparece depois
 *   e garantia    que alguém aprovar o fato. Enquanto não aprovarem, a linha
 *                 simplesmente não existe na página.
 *
 * É o que deixa a ferramenta nascer verdadeira em vez de nascer completa.
 */

export type MaterialComparado = {
  slug: string;
  nome: string;
  /** Nulo quando o fato ainda não foi aprovado. */
  teor: string | null;
  durabilidade: string | null;
  manutencao: string | null;
  produtos: number;
  precoTipicoMin: number;
  precoMediano: number;
  precoTipicoMax: number;
};

/** Nome de tela por slug. O slug é o que liga o fato ao produto. */
const NOMES: Record<string, string> = {
  "prata-925": "Prata 925",
  "prata-950": "Prata 950",
  "prata-banhada": "Prata banhada a ouro",
  "prata-com-ouro": "Prata com ouro",
  "ouro-10k": "Ouro 10k",
  "ouro-18k": "Ouro 18k",
};

type LinhaDaView = {
  material: string;
  produtos: number;
  preco_tipico_min: number;
  preco_tipico_max: number;
  preco_mediano: number;
};

export async function materiaisComparados(): Promise<MaterialComparado[]> {
  const supabase = createReadClient();
  if (!supabase) return [];

  const [{ data: faixas }, { data: fatos }] = await Promise.all([
    supabase
      .from("aliancas_por_material")
      .select("material, produtos, preco_tipico_min, preco_tipico_max, preco_mediano"),
    // `fatos_publicos`, e não `facts`: a tabela é interna e a RLS dela só
    // libera para quem tem perfil ativo, então o site anônimo lia vazio e a
    // coluna de teor saía "a confirmar" mesmo com o fato aprovado. A view
    // devolve só afirmação aprovada e só as colunas que a página imprime.
    supabase
      .from("fatos_publicos")
      .select("subject, attribute, claim")
      .eq("module", "materiais"),
  ]);

  const porAssunto = new Map<string, Record<string, string>>();
  for (const f of (fatos ?? []) as { subject: string; attribute: string | null; claim: string }[]) {
    if (!f.attribute) continue;
    const atual = porAssunto.get(f.subject) ?? {};
    atual[f.attribute] = f.claim;
    porAssunto.set(f.subject, atual);
  }

  return ((faixas ?? []) as LinhaDaView[])
    .filter((l) => NOMES[l.material])
    .map((l) => {
      const fatosDoMaterial = porAssunto.get(l.material) ?? {};
      return {
        slug: l.material,
        nome: NOMES[l.material],
        teor: fatosDoMaterial.teor ?? null,
        durabilidade: fatosDoMaterial.durabilidade ?? null,
        manutencao: fatosDoMaterial.manutencao ?? null,
        produtos: Number(l.produtos),
        precoTipicoMin: Number(l.preco_tipico_min),
        precoMediano: Number(l.preco_mediano),
        precoTipicoMax: Number(l.preco_tipico_max),
      };
    })
    // Do mais acessível ao mais caro: é a ordem em que a pessoa decide.
    .sort((a, b) => a.precoMediano - b.precoMediano);
}
