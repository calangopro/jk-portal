/**
 * O que o navegador faz com um arquivo antes de ele ir para o armazenamento:
 * converte imagem para JPEG, mede vídeo e sobe com barra de progresso.
 *
 * Só roda no navegador (usa canvas, <video> e XMLHttpRequest). O arquivo vai
 * DIRETO para o armazenamento, pelo endereço assinado que o servidor deu: a
 * função da Vercel aceita 4,5 MB de corpo e não serve de passagem.
 */

/** A largura máxima que o Instagram aceita. Acima disso ele mesmo reduziria, com perda. */
const LARGURA_MAXIMA = 1440;
const QUALIDADE = 0.92;

export type ImagemPronta = { blob: Blob; mime: "image/jpeg"; largura: number; altura: number };
export type VideoMedido = { largura: number; altura: number; duracao: number };

/**
 * Deixa a imagem como as redes aceitam: JPEG, com até 1440 px de largura, na
 * orientação certa (foto de celular vem deitada com uma marca dizendo "gire").
 * JPEG que já cabe sobe como está, sem recomprimir.
 */
export async function prepararImagem(arquivo: File): Promise<ImagemPronta> {
  const bitmap = await createImageBitmap(arquivo, { imageOrientation: "from-image" });
  try {
    if (arquivo.type === "image/jpeg" && bitmap.width <= LARGURA_MAXIMA) {
      return { blob: arquivo, mime: "image/jpeg", largura: bitmap.width, altura: bitmap.height };
    }
    const escala = Math.min(1, LARGURA_MAXIMA / bitmap.width);
    const largura = Math.round(bitmap.width * escala);
    const altura = Math.round(bitmap.height * escala);
    const tela = document.createElement("canvas");
    tela.width = largura;
    tela.height = altura;
    const ctx = tela.getContext("2d");
    if (!ctx) throw new Error("O navegador não conseguiu preparar a imagem.");
    // JPEG não tem transparência: PNG com fundo vazado ganha fundo branco, e não preto.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, largura, altura);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, largura, altura);
    const blob = await new Promise<Blob | null>((ok) => tela.toBlob(ok, "image/jpeg", QUALIDADE));
    if (!blob) throw new Error("O navegador não conseguiu converter a imagem.");
    return { blob, mime: "image/jpeg", largura, altura };
  } finally {
    bitmap.close();
  }
}

/** Largura, altura e duração de um vídeo, lidas pelo próprio navegador. Formato que ele não abre devolve null, e quem confere é a rede. */
export function medirVideo(arquivo: File): Promise<VideoMedido | null> {
  return new Promise((ok) => {
    const url = URL.createObjectURL(arquivo);
    const v = document.createElement("video");
    const fim = (r: VideoMedido | null) => {
      URL.revokeObjectURL(url);
      ok(r);
    };
    v.preload = "metadata";
    v.muted = true;
    v.onloadedmetadata = () => fim(Number.isFinite(v.duration) && v.videoWidth ? { largura: v.videoWidth, altura: v.videoHeight, duracao: Math.round(v.duration * 10) / 10 } : null);
    v.onerror = () => fim(null);
    setTimeout(() => fim(null), 8000);
    v.src = url;
  });
}

/**
 * Sobe o arquivo para o endereço assinado, avisando o progresso de 0 a 1.
 * É XMLHttpRequest porque o `fetch` não informa progresso de envio.
 */
export function subir(url: string, cabecalhos: Record<string, string>, corpo: Blob, aoAndar: (fracao: number) => void, sinal?: AbortSignal): Promise<void> {
  return new Promise((ok, falhou) => {
    const x = new XMLHttpRequest();
    x.open("PUT", url);
    for (const [k, v] of Object.entries(cabecalhos)) x.setRequestHeader(k, v);
    x.upload.onprogress = (e) => {
      if (e.lengthComputable) aoAndar(e.loaded / e.total);
    };
    x.onload = () => (x.status >= 200 && x.status < 300 ? ok() : falhou(new Error(x.status === 413 ? "O arquivo é grande demais para o armazenamento." : `O armazenamento recusou o arquivo (${x.status}).`)));
    x.onerror = () => falhou(new Error("A ligação caiu no meio do envio. Tente de novo."));
    x.onabort = () => falhou(new Error("Envio cancelado."));
    sinal?.addEventListener("abort", () => x.abort());
    x.send(corpo);
  });
}

/** "12,4 MB", "830 KB". */
export function tamanhoEmPalavra(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** "0:42", "3:05". */
export function duracaoEmPalavra(segundos: number): string {
  const s = Math.round(segundos);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * O valor de um campo `datetime-local` ("2026-11-20T18:30") como instante, no
 * relógio de São Paulo. O Brasil não tem horário de verão desde 2019, então é
 * UTC-3 o ano inteiro; escrito assim o post sai na hora certa mesmo se quem
 * agenda estiver com o computador em outro fuso.
 */
export function horaDeSaoPaulo(valor: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(valor)) return null;
  const d = new Date(`${valor}:00-03:00`);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

/** O contrário: um instante como valor de `datetime-local`, no relógio de São Paulo. */
export function paraCampoDeHora(iso: string | Date): string {
  const d = new Date(iso);
  const p = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  return p.replace(" ", "T");
}
