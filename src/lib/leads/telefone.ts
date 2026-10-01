/**
 * Telefone de WhatsApp brasileiro, do jeito que o formulário recebe e do jeito
 * que os destinos querem.
 *
 * Mora fora do formulário porque o servidor confere de novo com as MESMAS
 * regras: validação que existe só no navegador é sugestão, e um contato com
 * telefone torto chegaria à Kommo e ao grupo sem ninguém conseguir chamar.
 */

/** Só os dígitos do número local (DDD + número), sem o 55 do país. */
export function soDigitos(v: string): string {
  let d = v.replace(/\D/g, "");
  // Quem digita +55 na frente.
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  return d.slice(0, 11);
}

export function mascara(d: string): string {
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function telefoneValido(d: string): boolean {
  if (d.length !== 10 && d.length !== 11) return false;
  const ddd = Number(d.slice(0, 2));
  if (ddd < 11 || ddd > 99) return false;
  // Celular com 11 dígitos começa em 9 depois do DDD.
  return d.length === 10 || d.charAt(2) === "9";
}

/** Número local para o formato com país, como fica gravado: `5511999999999`. */
export function comPais(local: string): string {
  return `55${local}`;
}

/** `5511999999999` para `+55 11 99999-9999`, que é como o RD e a Kommo mostram. */
export function legivel(comPais55: string): string {
  const local = comPais55.replace(/^55/, "");
  return `+55 ${mascara(local).replace(/[()]/g, "")}`;
}

export const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
