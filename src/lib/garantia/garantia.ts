/**
 * Garantia digital (cartão 65): as contas puras, para o teste rodar sem banco.
 *
 * O código vai impresso num cartão pequeno e às vezes é digitado à mão: são
 * 10 letras e números sem I, O, 0 e 1, que se confundem no papel. Quem digita
 * em minúscula ou com espaço acha do mesmo jeito.
 */
export const CODIGO_DA_GARANTIA = /^[A-HJ-NP-Z2-9]{10}$/;

export function lerCodigo(cru: unknown): string | null {
  if (typeof cru !== "string") return null;
  const c = cru.replace(/[\s-]/g, "").toUpperCase();
  return CODIGO_DA_GARANTIA.test(c) ? c : null;
}

/** O código em dois blocos de cinco, para ler no cartão: "WPAWR 4XMRW". */
export const codigoEmBlocos = (c: string) => `${c.slice(0, 5)} ${c.slice(5)}`;

/**
 * A data do formulário do cliente para o formato da ficha (`data_parcial`):
 * "15/03" vira "03-15" e "15/03/1995" vira "1995-03-15". Dia e mês que não
 * existem viram `null`, e o banco descarta.
 */
export function dataDoFormulario(cru: unknown): string | null {
  if (typeof cru !== "string") return null;
  const m = /^\s*(\d{1,2})\s*\/\s*(\d{1,2})(?:\s*\/\s*(\d{4}))?\s*$/.exec(cru);
  if (!m) return null;
  const dia = Number(m[1]);
  const mes = Number(m[2]);
  const ano = m[3] ? Number(m[3]) : null;
  if (mes < 1 || mes > 12 || dia < 1) return null;
  const dias = [31, ano && ((ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0) ? 29 : ano ? 28 : 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mes - 1];
  if (dia > dias) return null;
  if (ano !== null && (ano < 1900 || ano > 2100)) return null;
  const md = `${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  return ano ? `${ano}-${md}` : md;
}

/** A data da ficha de volta para quem lê: "03-15" vira "15/03". */
export function dataParaLer(d: string | null | undefined): string {
  if (!d) return "";
  const m = /^(?:(\d{4})-)?(\d{2})-(\d{2})$/.exec(d);
  return m ? `${m[3]}/${m[2]}${m[1] ? `/${m[1]}` : ""}` : "";
}

/** Os 4 dígitos que o cliente digita para abrir o que é pessoal. */
export const digitosValidos = (v: unknown): v is string => typeof v === "string" && /^[0-9]{4}$/.test(v);
