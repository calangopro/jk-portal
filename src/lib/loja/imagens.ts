/**
 * As fotos do produto na loja: como a Tray guarda, o que acontece quando o
 * painel manda uma foto nova e como saber se ela entrou.
 *
 * TUDO AQUI FOI MEDIDO NA LOJA DE TESTES em 14/11/2026 (produto 93525), porque
 * a documentação diz uma coisa e a API faz outra:
 *
 *   - As fotos formam uma FILA, sem buraco. `picture_source_N` é a enésima da
 *     fila de agora, não uma gaveta fixa: mandar a 2 SUBSTITUI a segunda foto
 *     que a loja mostra. Mandar um número além do fim ACRESCENTA no fim.
 *   - A resposta é sempre `{"message":"Uploaded images","code":200}`, mesmo
 *     quando a Tray descarta a foto. Descartou a de 2,4 MB e a de 2,7 MB sem
 *     dizer nada, e aceitou a de 1,83 MB. A documentação fala em 350 KB; o
 *     corte de verdade fica perto de 2 MB. O teto do painel é 1,5 MB, com folga.
 *   - 2000 x 2000 px entra. O arquivo não é recomprimido: chega do tamanho que
 *     foi mandado.
 *   - Três fotos trocadas de uma vez apareceram em menos de 6 segundos. A
 *     documentação fala em "alguns minutos", então quem confere espera um
 *     pouco e, se não vir, diz que ainda está processando em vez de dar erro.
 *   - Remover é mandar um espaço (`" "`) na posição: a fila encolhe e as de
 *     trás andam uma casa.
 *   - O NOME DO ARQUIVO NA TRAY TERMINA COM O MD5 DO CONTEÚDO, e ela serve os
 *     mesmos bytes que recebeu. É a prova de que a foto no lugar é a que foi
 *     mandada. Sem isso, mandar de novo a mesma foto deixava o endereço igual
 *     e a conferência dizia "ainda não entrou" para sempre.
 *
 * A REGRA DO PAINEL: a foto de produto vai na posição 1, a de face na 2 e a de
 * uso na 3, que é o padrão que a JK já usa. O que estiver nessas posições sai
 * da loja, e a pessoa vê isso foto por foto antes de confirmar. Da posição 4 em
 * diante nada muda.
 *
 * Arquivo puro, para o teste rodar sem rede.
 */

export type TipoDeFoto = "produto" | "face" | "uso";

export const POSICAO_DA_FOTO: Record<TipoDeFoto, number> = { produto: 1, face: 2, uso: 3 };
export const NOME_DO_TIPO: Record<TipoDeFoto, string> = { produto: "produto", face: "face", uso: "uso" };

/** Acima disto a Tray pode descartar a foto em silêncio. Medido: 1,83 MB entra, 2,4 MB não. */
export const TETO_DE_BYTES = 1_500_000;
export const LADO_MAXIMO = 2000;

export type ImagemNaLoja = { url: string; miniatura: string };

export type FotoNova = {
  id: string;
  tipo: TipoDeFoto;
  url: string;
  /** Caminho no storage, para o servidor baixar e reduzir quando passar do teto. */
  caminho: string | null;
  bytes: number | null;
  largura: number | null;
  altura: number | null;
  /** MD5 dos bytes que vão de fato para a Tray (da cópia leve, quando há). O servidor preenche. */
  md5?: string | null;
};

export type Troca = {
  fotoId: string;
  tipo: TipoDeFoto;
  /** A posição que o painel pede: 1, 2 ou 3. */
  posicao: number;
  /** Onde a foto fica de fato. Difere da pedida quando o produto tem menos fotos que isso. */
  ficaEm: number;
  /** A foto que a loja mostra hoje nesse lugar e que vai sair. `null` quando a nova só acrescenta. */
  antes: ImagemNaLoja | null;
  depois: string;
  /** O arquivo passa do teto (ou não se sabe o tamanho): o servidor manda uma cópia reduzida. */
  reduzir: boolean;
  /** MD5 do que vai ser mandado. Com ele a conferência é exata. */
  md5: string | null;
  /** A loja já mostra ESTA foto nesse lugar: não precisa mandar de novo. */
  jaEsta: boolean;
};

export type PreparoDeFotos =
  | { ok: true; trocas: Troca[]; avisos: string[] }
  | { ok: false; erro: string };

const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** As fotos do produto como `GET /products/:id` devolve em `ProductImage`, na ordem da loja. */
export function lerImagens(cru: Record<string, unknown> | null | undefined): ImagemNaLoja[] {
  const lista = Array.isArray(cru?.ProductImage) ? (cru.ProductImage as unknown[]) : [];
  const imagens: ImagemNaLoja[] = [];
  for (const item of lista) {
    const i = (item ?? {}) as { https?: unknown; http?: unknown; thumbs?: Record<string, { https?: unknown; http?: unknown }> };
    const url = texto(i.https) || texto(i.http).replace(/^http:/, "https:");
    if (!url) continue;
    const t = i.thumbs?.["180"] ?? i.thumbs?.["90"];
    imagens.push({ url, miniatura: texto(t?.https) || texto(t?.http).replace(/^http:/, "https:") || url });
  }
  return imagens;
}

/** O MD5 que a Tray põe no fim do nome do arquivo, ou `null` se o endereço não for dela. */
export function codigoDaImagem(url: string | null | undefined): string | null {
  return /_([0-9a-f]{32})\.(?:jpe?g|png)$/i.exec(url ?? "")?.[1]?.toLowerCase() ?? null;
}

/**
 * A Tray pede endereço público, sem espaço, acento nem caractere especial, em
 * JPG ou PNG. Os endereços do storage do painel já nascem assim; a conferência
 * existe para uma foto de fora não ser mandada e sumir em silêncio.
 */
export function enderecoAceito(url: string): boolean {
  return /^https:\/\/[A-Za-z0-9.-]+(\/[A-Za-z0-9._~-]+)+\.(jpe?g|png)$/.test(url);
}

const megas = (bytes: number) => `${(bytes / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;

/**
 * Confere as fotos novas contra a fila que a loja tem agora e diz, foto por
 * foto, onde cada uma entra e o que sai. Não manda nada.
 */
export function prepararFotos(atuais: ImagemNaLoja[], novas: FotoNova[]): PreparoDeFotos {
  if (novas.length === 0) return { ok: false, erro: "Este produto não tem foto aprovada esperando ir para a loja." };

  // Uma por tipo: a lista chega da mais nova para a mais velha.
  const porTipo = new Map<TipoDeFoto, FotoNova>();
  for (const f of novas) if (!porTipo.has(f.tipo)) porTipo.set(f.tipo, f);
  const fotos = [...porTipo.values()].sort((a, b) => POSICAO_DA_FOTO[a.tipo] - POSICAO_DA_FOTO[b.tipo]);

  for (const f of fotos) {
    if (!enderecoAceito(f.url)) {
      return { ok: false, erro: `O endereço da foto de ${NOME_DO_TIPO[f.tipo]} tem espaço, acento ou outro formato que a Tray não aceita. Envie a foto de novo pelo painel.` };
    }
    if ((f.largura ?? 0) > LADO_MAXIMO || (f.altura ?? 0) > LADO_MAXIMO) {
      return { ok: false, erro: `A foto de ${NOME_DO_TIPO[f.tipo]} tem ${f.largura} x ${f.altura} px. A Tray aceita até ${LADO_MAXIMO} px de lado.` };
    }
  }

  const trocas: Troca[] = [];
  let acrescentadas = 0;
  for (const f of fotos) {
    const posicao = POSICAO_DA_FOTO[f.tipo];
    const substitui = posicao <= atuais.length;
    if (!substitui) acrescentadas++;
    const md5 = f.md5?.toLowerCase() ?? null;
    const antes = substitui ? atuais[posicao - 1] : null;
    trocas.push({
      fotoId: f.id,
      tipo: f.tipo,
      posicao,
      ficaEm: substitui ? posicao : atuais.length + acrescentadas,
      antes,
      depois: f.url,
      reduzir: f.bytes === null || f.bytes > TETO_DE_BYTES,
      md5,
      jaEsta: md5 !== null && codigoDaImagem(antes?.url) === md5,
    });
  }

  const avisos: string[] = [];
  const saem = trocas.filter((t) => t.antes && !t.jaEsta).length;
  if (saem > 0) {
    avisos.push(
      saem === 1
        ? "A foto que a loja mostra hoje nessa posição sai da loja. As outras ficam como estão."
        : `As ${saem} fotos que a loja mostra hoje nessas posições saem da loja. As outras ficam como estão.`,
    );
  }
  for (const t of trocas) {
    if (t.jaEsta) {
      avisos.push(`A foto de ${NOME_DO_TIPO[t.tipo]} já é a que a loja mostra na posição ${t.ficaEm}. Ela não vai de novo: só recebe a baixa.`);
      continue;
    }
    if (t.ficaEm !== t.posicao) {
      avisos.push(
        `A foto de ${NOME_DO_TIPO[t.tipo]} entra na posição ${t.ficaEm}, e não na ${t.posicao}: o produto tem ${atuais.length === 0 ? "nenhuma foto" : atuais.length === 1 ? "só 1 foto" : `só ${atuais.length} fotos`} na loja hoje.`,
      );
    }
    if (t.ficaEm === 1 && t.tipo !== "produto") {
      avisos.push(`A foto de ${NOME_DO_TIPO[t.tipo]} vira a foto principal do produto, a que aparece na vitrine.`);
    }
  }
  const grandes = fotos.filter((f) => f.bytes !== null && f.bytes > TETO_DE_BYTES);
  for (const f of grandes) {
    avisos.push(`A foto de ${NOME_DO_TIPO[f.tipo]} tem ${megas(f.bytes ?? 0)}. A Tray descarta arquivo grande sem avisar, então vai uma cópia mais leve, do mesmo tamanho em pixels.`);
  }
  return { ok: true, trocas, avisos };
}

/**
 * O corpo de `POST /products/:id/images`. `enderecos` troca o endereço da foto
 * que foi reduzida. A foto que a loja já mostra fica de fora.
 */
export function corpoDasFotos(trocas: Troca[], enderecos: Record<string, string> = {}): Record<string, string> {
  return Object.fromEntries(trocas.filter((t) => !t.jaEsta).map((t) => [`picture_source_${t.posicao}`, enderecos[t.fotoId] ?? t.depois]));
}

/**
 * As trocas que ainda NÃO aparecem na loja. A Tray responde "enviado" mesmo
 * quando descarta, então esta é a única prova.
 *
 * Com o MD5 da foto, a prova é exata: o arquivo no lugar dela tem aquele MD5
 * no nome. Sem ele (não deu para ler o arquivo), vale a prova mais fraca: o
 * lugar mostra um endereço que não estava ali antes.
 */
export function fotosQueNaoEntraram(antes: ImagemNaLoja[], depois: ImagemNaLoja[], trocas: Troca[]): Troca[] {
  return trocas.filter((t) => {
    const agora = depois[t.ficaEm - 1];
    if (!agora) return true;
    if (t.md5) return codigoDaImagem(agora.url) !== t.md5;
    return agora.url === antes[t.ficaEm - 1]?.url;
  });
}
