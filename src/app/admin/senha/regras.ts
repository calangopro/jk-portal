/**
 * Regras da senha e do link, compartilhadas entre a tela e a ação.
 *
 * Moram fora de `actions.ts` porque arquivo com "use server" só pode exportar
 * função assíncrona, e a tela precisa do mínimo para o `minLength` do campo.
 */

/**
 * Oito, e não os seis que o Supabase aceita por padrão. Se o mínimo do painel
 * do Supabase subir (Authentication, Providers, Email, "Minimum password
 * length"), este número sobe junto, senão a tela aprova uma senha que o
 * servidor recusa DEPOIS de o link já ter sido gasto.
 */
export const SENHA_MINIMA = 8;

/** Os dois links de e-mail que terminam nesta tela. */
export type TipoDeLink = "invite" | "recovery";

export function tipoDeLink(valor: unknown): TipoDeLink | null {
  return valor === "invite" || valor === "recovery" ? valor : null;
}

/**
 * Confere a senha antes de qualquer chamada ao Supabase. A ordem importa: o
 * link do e-mail vale uma vez só, então um erro de digitação descoberto depois
 * de verificar o link obrigaria a pessoa a pedir outro.
 */
export function problemaNaSenha(senha: string, repetida: string): string | null {
  if (senha.length < SENHA_MINIMA) {
    return `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`;
  }
  if (senha !== repetida) return "As duas senhas não são iguais. Digite de novo.";
  return null;
}
