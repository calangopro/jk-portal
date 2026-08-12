/**
 * Dias da semana, na ordem, com o nome que o schema.org espera.
 *
 * Fica fora de actions.ts de propósito: um arquivo "use server" só pode
 * exportar funções assíncronas, e exportar esta constante de lá quebra a
 * página inteira.
 */
export const DIAS = [
  { chave: "Monday", nome: "Segunda" },
  { chave: "Tuesday", nome: "Terça" },
  { chave: "Wednesday", nome: "Quarta" },
  { chave: "Thursday", nome: "Quinta" },
  { chave: "Friday", nome: "Sexta" },
  { chave: "Saturday", nome: "Sábado" },
  { chave: "Sunday", nome: "Domingo" },
] as const;
