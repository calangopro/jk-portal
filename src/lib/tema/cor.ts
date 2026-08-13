/**
 * Cor: leitura de HEX, normalização e contraste WCAG.
 *
 * Tudo aqui é função pura, sem dependência de navegador nem de React, porque a
 * mesma conta roda em três lugares: no seletor de cor do admin (enquanto a
 * pessoa arrasta), na validação do servidor antes de gravar e no cálculo do
 * triplete RGB que vai para o CSS.
 */

export type Rgb = { r: number; g: number; b: number; a: number };

/** Aceita #rgb, #rgba, #rrggbb e #rrggbbaa. Devolve nulo no que não for cor. */
export function lerHex(entrada: string): Rgb | null {
  const t = entrada.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]+$/.test(t)) return null;

  const dobrar = (c: string) => parseInt(c + c, 16);
  const par = (i: number) => parseInt(t.slice(i, i + 2), 16);

  if (t.length === 3) return { r: dobrar(t[0]), g: dobrar(t[1]), b: dobrar(t[2]), a: 1 };
  if (t.length === 4) {
    return { r: dobrar(t[0]), g: dobrar(t[1]), b: dobrar(t[2]), a: dobrar(t[3]) / 255 };
  }
  if (t.length === 6) return { r: par(0), g: par(2), b: par(4), a: 1 };
  if (t.length === 8) return { r: par(0), g: par(2), b: par(4), a: par(6) / 255 };
  return null;
}

const doisDigitos = (n: number) =>
  Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");

/** Devolve #rrggbb, ou #rrggbbaa quando há transparência. */
export function paraHex({ r, g, b, a }: Rgb): string {
  const base = `#${doisDigitos(r)}${doisDigitos(g)}${doisDigitos(b)}`;
  return a >= 1 ? base : `${base}${doisDigitos(a * 255)}`;
}

/**
 * Triplete no formato que o CSS espera dentro de `rgb(... / alfa)`.
 * É isto que permite `rgb(var(--jk-brand-rgb) / 0.24)` acompanhar o tema.
 */
export function paraTriplete({ r, g, b }: Rgb): string {
  return `${Math.round(r)} ${Math.round(g)} ${Math.round(b)}`;
}

/** Luminância relativa, na definição da WCAG 2.x. */
export function luminancia({ r, g, b }: Rgb): number {
  const canal = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

/**
 * Achata uma cor com alfa sobre um fundo opaco.
 *
 * Sem isto o contraste de um texto semitransparente sai errado para mais: a
 * conta da WCAG assume cor sólida, e `#171512cc` sobre marfim não contrasta o
 * mesmo que `#171512`.
 */
export function sobrepor(frente: Rgb, fundo: Rgb): Rgb {
  const a = frente.a;
  if (a >= 1) return frente;
  return {
    r: frente.r * a + fundo.r * (1 - a),
    g: frente.g * a + fundo.g * (1 - a),
    b: frente.b * a + fundo.b * (1 - a),
    a: 1,
  };
}

/** Razão de contraste entre duas cores, de 1 a 21. */
export function contraste(frente: Rgb, fundo: Rgb): number {
  const f = luminancia(sobrepor(frente, fundo));
  const g = luminancia(fundo);
  const claro = Math.max(f, g);
  const escuro = Math.min(f, g);
  return (claro + 0.05) / (escuro + 0.05);
}

export type Veredito = {
  razao: number;
  /** 4,5:1 para texto normal. */
  passaAA: boolean;
  /** 3:1 para texto grande (24px, ou 18,66px em negrito). */
  passaAAGrande: boolean;
  /** 7:1, o nível AAA. Informativo, não barra nada. */
  passaAAA: boolean;
};

export function avaliarContraste(frente: Rgb, fundo: Rgb): Veredito {
  const razao = contraste(frente, fundo);
  return {
    razao,
    passaAA: razao >= 4.5,
    passaAAGrande: razao >= 3,
    passaAAA: razao >= 7,
  };
}

/** Formata a razão como a WCAG escreve: "4,81:1", com vírgula decimal. */
export function razaoLegivel(razao: number): string {
  return `${razao.toFixed(2).replace(".", ",")}:1`;
}

/**
 * Escurece ou clareia a cor até ela passar no contraste exigido.
 *
 * Serve para o admin não apenas reprovar uma escolha, mas oferecer o tom mais
 * próximo que funciona. Anda em passos pequenos na direção que aumenta o
 * contraste e para no primeiro que passa, então o resultado continua parecido
 * com o que a pessoa escolheu.
 */
export function aproximarAteAAPassar(
  frente: Rgb,
  fundo: Rgb,
  alvo = 4.5,
): { cor: Rgb; conseguiu: boolean } {
  if (contraste(frente, fundo) >= alvo) return { cor: frente, conseguiu: true };

  // Fundo claro pede frente mais escura, e o contrário também vale.
  const paraEscuro = luminancia(fundo) > 0.18;
  let melhor = frente;

  for (let passo = 1; passo <= 100; passo++) {
    const fator = passo / 100;
    const alvoCanal = paraEscuro ? 0 : 255;
    const tentativa: Rgb = {
      r: frente.r + (alvoCanal - frente.r) * fator,
      g: frente.g + (alvoCanal - frente.g) * fator,
      b: frente.b + (alvoCanal - frente.b) * fator,
      a: frente.a,
    };
    melhor = tentativa;
    if (contraste(tentativa, fundo) >= alvo) return { cor: tentativa, conseguiu: true };
  }

  // Chegou no preto ou no branco puro e ainda não passa: só trocando o fundo.
  return { cor: melhor, conseguiu: false };
}
