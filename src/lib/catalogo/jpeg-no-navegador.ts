/**
 * Converte a foto escolhida no painel para JPEG antes de subir.
 *
 * O destino é a Tray, então JPEG e não WebP (ver `guardarFotoDeBytes`). A
 * conversão é no navegador porque foto de IA passa fácil de 1 MB, que é o teto
 * de uma Server Action, e assim o arquivo vai direto para o storage.
 * Fundo transparente vira branco: no JPEG ele sairia preto.
 */

const LADO_MAXIMO = 2000;

export type JpegPronto = { arquivo: Blob; largura: number; altura: number };

export async function paraJpeg(original: File, qualidade = 0.9): Promise<JpegPronto> {
  const bitmap = await createImageBitmap(original).catch(() => null);
  if (!bitmap) throw new Error("Não consegui abrir essa imagem. Use JPG, PNG ou WebP.");

  const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));
  const largura = Math.round(bitmap.width * escala);
  const altura = Math.round(bitmap.height * escala);

  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("O navegador não deixou converter a imagem.");
  }
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, largura, altura);
  ctx.drawImage(bitmap, 0, 0, largura, altura);
  bitmap.close();

  const arquivo = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", qualidade));
  if (!arquivo) throw new Error("A conversão para JPEG falhou.");
  return { arquivo, largura, altura };
}

export const nomeDeArquivo = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "produto";
