/**
 * Conversão de imagem para WebP no navegador, antes do upload.
 *
 * Por que WebP: entrega o mesmo resultado visual com arquivo bem menor que
 * JPEG e PNG, é suportado por todos os navegadores atuais e o Google usa
 * velocidade como fator de ranqueamento. AVIF comprime ainda mais, porém
 * codifica devagar no navegador e nem todo editor de imagem abre, então
 * WebP é o melhor equilíbrio para quem publica pelo painel.
 *
 * O que NÃO convertemos: SVG (é vetor, já é leve) e GIF animado (a conversão
 * no canvas perde a animação).
 */

export type Convertida = {
  arquivo: File;
  largura: number;
  altura: number;
  /** Quanto o arquivo encolheu, de 0 a 1. */
  reducao: number;
  convertida: boolean;
};

const LARGURA_MAXIMA = 2000;

export async function paraWebp(
  original: File,
  qualidade = 0.82,
): Promise<Convertida> {
  const naoConverter =
    original.type === "image/svg+xml" ||
    original.type === "image/gif" ||
    original.type === "image/webp";

  const bitmap = await createImageBitmap(original).catch(() => null);
  if (!bitmap) {
    return { arquivo: original, largura: 0, altura: 0, reducao: 0, convertida: false };
  }

  if (naoConverter) {
    const r = { arquivo: original, largura: bitmap.width, altura: bitmap.height, reducao: 0, convertida: false };
    bitmap.close();
    return r;
  }

  // Redimensiona o que vier gigante da câmera, mantendo a proporção.
  const escala = Math.min(1, LARGURA_MAXIMA / bitmap.width);
  const largura = Math.round(bitmap.width * escala);
  const altura = Math.round(bitmap.height * escala);

  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return { arquivo: original, largura: bitmap.width, altura: bitmap.height, reducao: 0, convertida: false };
  }
  ctx.drawImage(bitmap, 0, 0, largura, altura);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", qualidade),
  );

  // Se por algum motivo o WebP sair maior, fica o original.
  if (!blob || blob.size >= original.size) {
    return { arquivo: original, largura, altura, reducao: 0, convertida: false };
  }

  const nome = original.name.replace(/\.[^.]+$/, "") + ".webp";
  return {
    arquivo: new File([blob], nome, { type: "image/webp" }),
    largura,
    altura,
    reducao: 1 - blob.size / original.size,
    convertida: true,
  };
}
