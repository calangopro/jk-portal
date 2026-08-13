import { z } from "zod";
import { TOKENS_DE_COR, TOKENS_DE_RAIO } from "./tokens";

/**
 * Formato do tema, e a validação que ele atravessa antes de virar CSS.
 *
 * O valor sai do banco, e o banco é editado por gente. Esse valor termina
 * dentro de um `<style>` no HTML, então validar aqui não é preciosismo de
 * tipagem: é a barreira contra injeção de CSS. Um valor como
 * `#fff}body{display:none}` derrubaria o site inteiro se passasse direto.
 */

/** #rgb, #rgba, #rrggbb ou #rrggbbaa. Nada além disso. */
const HEX = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/** Medida CSS simples: 10px, 1.5rem, 0. Sem calc, sem var, sem função. */
const MEDIDA = /^(?:0|-?\d+(?:\.\d+)?(?:px|rem|em))$/;

/** Identificador de par de fonte: letras, números e hífen. */
const ID_DE_FONTE = /^[a-z0-9-]{1,40}$/;

export const esquemaDoTema = z.object({
  versao: z.number().int().positive().catch(1),
  cores: z.record(z.string(), z.string().regex(HEX)).catch({}),
  raios: z.record(z.string(), z.string().regex(MEDIDA)).catch({}),
  fonte: z.object({ par: z.string().regex(ID_DE_FONTE).catch("cormorant-montserrat") }).catch({
    par: "cormorant-montserrat",
  }),
});

export type Tema = {
  versao: number;
  /** Sempre completo: todo token conhecido tem valor, nem que seja o padrão. */
  cores: Record<string, string>;
  raios: Record<string, string>;
  fonte: { par: string };
};

export function temaPadrao(): Tema {
  return {
    versao: 1,
    cores: Object.fromEntries(TOKENS_DE_COR.map((t) => [t.nome, t.padrao])),
    raios: Object.fromEntries(TOKENS_DE_RAIO.map((t) => [t.nome, t.padrao])),
    fonte: { par: "cormorant-montserrat" },
  };
}

/**
 * Transforma o que veio do banco num tema utilizável, sem nunca lançar erro.
 *
 * Chave desconhecida é descartada e chave que falta cai no padrão. É o modo
 * seguro: se alguém renomear um token no código, o site continua no ar com a
 * cor de fábrica em vez de quebrar ou ficar sem cor nenhuma.
 */
export function normalizarTema(bruto: unknown): Tema {
  const padrao = temaPadrao();
  const lido = esquemaDoTema.safeParse(bruto);
  if (!lido.success) return padrao;

  const cores = { ...padrao.cores };
  for (const t of TOKENS_DE_COR) {
    const v = lido.data.cores[t.nome];
    if (typeof v === "string") cores[t.nome] = v;
  }

  const raios = { ...padrao.raios };
  for (const t of TOKENS_DE_RAIO) {
    const v = lido.data.raios[t.nome];
    if (typeof v === "string") raios[t.nome] = v;
  }

  return { versao: lido.data.versao, cores, raios, fonte: lido.data.fonte };
}

/** Confere um valor isolado, para o formulário do admin avisar campo a campo. */
export function corValida(valor: string): boolean {
  return HEX.test(valor.trim());
}

export function medidaValida(valor: string): boolean {
  return MEDIDA.test(valor.trim());
}
