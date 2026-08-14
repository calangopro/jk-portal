/**
 * Base de fatos aprovados.
 *
 * O projeto tem uma regra dura: nenhuma afirmação factual vai ao ar sem fonte
 * registrada, e a publicação trava sem pelo menos uma linha em `sources`.
 * Só que `sources` é por conteúdo, então o mesmo fato precisava ser redigitado
 * em cada guia novo, com a mesma URL e a mesma data. Ninguém faz isso, e foi
 * assim que a tabela ficou zerada enquanto a regra seguia valendo no papel.
 *
 * Aqui o fato é escrito uma vez e reaproveitado. Quando o editor insere um fato
 * no texto, a linha de `sources` daquele conteúdo nasce sozinha apontando para
 * o fato, e a trava de publicação passa a ser consequência do trabalho, não um
 * formulário extra no fim.
 *
 * Este arquivo é só tipo e vocabulário, sem acesso a banco, para poder ser
 * importado tanto do servidor quanto do componente de cliente do editor.
 */

export const STATUS_DO_FATO = ["extraido", "validar", "aprovado", "desatualizado"] as const;
export type StatusDoFato = (typeof STATUS_DO_FATO)[number];

export const MODULOS_DO_FATO = [
  "empresa",
  "produtos",
  "materiais",
  "fabricacao",
  "lojas",
  "garantias",
  "atendimento",
  "vocabulario",
] as const;
export type ModuloDoFato = (typeof MODULOS_DO_FATO)[number];

export type Fato = {
  id: string;
  claim: string;
  detail: string | null;
  module: ModuloDoFato;
  sourceUrl: string | null;
  fileUrl: string | null;
  capturedAt: string | null;
  responsible: string | null;
  status: StatusDoFato;
  /** Do que o fato fala, em slug. É o que liga o fato à linha do comparador. */
  subject: string | null;
  /** Qual característica: teor, durabilidade, manutencao, garantia. */
  attribute: string | null;
  /** Quantos conteúdos já citam este fato. Só a listagem do admin preenche. */
  usos?: number;
};

export const STATUS_LABEL: Record<StatusDoFato, string> = {
  extraido: "Extraído",
  validar: "A validar",
  aprovado: "Aprovado",
  desatualizado: "Desatualizado",
};

/** O que cada status significa na prática, em uma linha, para a tela do admin. */
export const STATUS_EXPLICACAO: Record<StatusDoFato, string> = {
  extraido: "Saiu de algum lugar e ainda ninguém conferiu.",
  validar: "Esperando a JK confirmar. Não pode ir ao ar assim.",
  aprovado: "Pode ser citado em conteúdo.",
  desatualizado: "Não usar mais. Fica guardado porque conteúdo publicado ainda aponta para ele.",
};

export const MODULO_LABEL: Record<ModuloDoFato, string> = {
  empresa: "Empresa e marca",
  produtos: "Produtos e atributos",
  materiais: "Materiais e teor",
  fabricacao: "Fábrica e produção",
  lojas: "Lojas e dados locais",
  garantias: "Garantias e políticas",
  atendimento: "Atendimento e prazos",
  vocabulario: "Vocabulário aprovado",
};

export function ehModulo(v: string): v is ModuloDoFato {
  return (MODULOS_DO_FATO as readonly string[]).includes(v);
}

export function ehStatus(v: string): v is StatusDoFato {
  return (STATUS_DO_FATO as readonly string[]).includes(v);
}

/**
 * Só fato aprovado pode ser citado. A trava do banco cuida da origem, esta
 * função cuida do estágio, e as duas juntas evitam que um rascunho de fato vire
 * afirmação publicada.
 */
export function podeCitar(f: Pick<Fato, "status">): boolean {
  return f.status === "aprovado";
}

/**
 * Texto da evidência que vai para `sources` quando o fato entra num conteúdo.
 *
 * A fonte precisa fazer sentido lida sozinha, meses depois, por outra pessoa,
 * então ela repete a afirmação em vez de dizer apenas "fato da base".
 */
export function evidenciaDoFato(f: Pick<Fato, "claim" | "detail">): string {
  return f.detail ? `${f.claim} (${f.detail})` : f.claim;
}

/** Data no formato que o Brasil lê, aceitando nulo sem quebrar. */
export function dataLegivel(iso: string | null): string | null {
  if (!iso) return null;
  const [ano, mes, dia] = iso.split("-");
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : null;
}
