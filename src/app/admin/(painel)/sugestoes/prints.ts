import { TETO_DO_PRINT_NO_NAVEGADOR } from "@/lib/sugestoes/sugestoes";

/**
 * Reduz o print no navegador antes de mandar: print de celular tem 2 a 3 MB, e
 * a função da Vercel recusa corpo acima de 4,5 MB. Tenta webp; o Safari não
 * gera webp e devolve outro formato, e aí vai JPEG. Tanto faz: o servidor
 * converte tudo para webp de novo. `null` quando não é imagem ou não dá para
 * ler.
 */
export async function prepararPrint(arquivo: Blob): Promise<Blob | null> {
  if (!arquivo.type.startsWith("image/")) return null;
  const url = URL.createObjectURL(arquivo);
  try {
    const img = await new Promise<HTMLImageElement>((ok, falha) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = falha;
      i.src = url;
    });
    for (const [lado, qualidade] of [[1800, 0.85], [1600, 0.78], [1400, 0.72], [1200, 0.65]] as const) {
      const escala = Math.min(1, lado / Math.max(img.naturalWidth, img.naturalHeight));
      const tela = document.createElement("canvas");
      tela.width = Math.max(1, Math.round(img.naturalWidth * escala));
      tela.height = Math.max(1, Math.round(img.naturalHeight * escala));
      const ctx = tela.getContext("2d");
      if (!ctx) return null;
      // Fundo branco: print em PNG com transparência viraria preto no JPEG.
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, tela.width, tela.height);
      ctx.drawImage(img, 0, 0, tela.width, tela.height);
      const comoBlob = (tipo: string) => new Promise<Blob | null>((ok) => tela.toBlob(ok, tipo, qualidade));
      let pronto = await comoBlob("image/webp");
      if (!pronto || pronto.type !== "image/webp") pronto = await comoBlob("image/jpeg");
      if (pronto && pronto.size <= TETO_DO_PRINT_NO_NAVEGADOR) return pronto;
    }
    return null;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}
