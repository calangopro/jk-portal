"use client";

import { prepararEnvio } from "./actions";

/**
 * Subir arquivo do balcão pelo celular da loja, que nem sempre tem boa
 * internet: a foto é reduzida no aparelho (lado maior até 1600 px, JPEG) antes
 * de sair, e vai direto para o balde privado por um endereço assinado, sem
 * passar pela função da Vercel (que recusa corpo acima de 4,5 MB). PDF vai
 * como está, até 10 MB.
 */

const TETO_PDF = 10 * 1024 * 1024;

/** Reduz uma foto. Volta um JPEG, ou o próprio arquivo se o navegador não conseguir abrir (HEIC antigo, por exemplo). */
export async function reduzirFoto(arquivo: File, lado = 1600, alvo = 1_400_000): Promise<Blob> {
  const img = await createImageBitmap(arquivo);
  const escala = Math.min(1, lado / Math.max(img.width, img.height));
  const tela = document.createElement("canvas");
  tela.width = Math.round(img.width * escala);
  tela.height = Math.round(img.height * escala);
  tela.getContext("2d")!.drawImage(img, 0, 0, tela.width, tela.height);
  let q = 0.82;
  for (;;) {
    const blob = await new Promise<Blob | null>((ok) => tela.toBlob(ok, "image/jpeg", q));
    if (!blob) throw new Error("foto");
    if (blob.size <= alvo || q <= 0.4) return blob;
    q -= 0.12;
  }
}

/** A foto reduzida em dataURL, para a leitura da IA (que recebe a imagem pela ação de servidor, até 1,2 MB). */
export async function fotoEmDataUrl(arquivo: File): Promise<string> {
  const blob = await reduzirFoto(arquivo, 1600, 1_100_000);
  return await new Promise<string>((ok, falha) => {
    const leitor = new FileReader();
    leitor.onload = () => ok(String(leitor.result));
    leitor.onerror = () => falha(leitor.error);
    leitor.readAsDataURL(blob);
  });
}

export type Subido = { ok: true; caminho: string; nome: string } | { ok: false; erro: string };

/** Sobe um arquivo para a pasta do pedido. O pedido pode ainda não estar salvo. */
export async function subirArquivo(pedido: string, arquivo: File): Promise<Subido> {
  const nome = arquivo.name.slice(0, 120) || "arquivo";
  let corpo: Blob = arquivo;
  let tipo = arquivo.type;
  if (tipo === "application/pdf") {
    if (arquivo.size > TETO_PDF) return { ok: false, erro: "PDF acima de 10 MB. Mande uma foto da página." };
  } else if (tipo.startsWith("image/")) {
    try {
      corpo = await reduzirFoto(arquivo);
      tipo = "image/jpeg";
    } catch {
      return { ok: false, erro: "Não deu para abrir esta foto. Tire de novo pela câmera." };
    }
  } else {
    return { ok: false, erro: "Mande foto ou PDF." };
  }
  const ender = await prepararEnvio(pedido, tipo);
  if (!ender.ok) return ender;
  // O cliente do Supabase só baixa aqui, no primeiro envio: não entra no pacote da tela, que abre no celular do balcão.
  const { createClient } = await import("@/lib/supabase/client");
  // Até duas tentativas: no celular do balcão, a rede cai no meio.
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const { error } = await createClient().storage.from("loja-pedidos").uploadToSignedUrl(ender.dados.caminho, ender.dados.token, corpo, { contentType: tipo });
    if (!error) return { ok: true, caminho: ender.dados.caminho, nome };
  }
  return { ok: false, erro: "A internet falhou no envio. Tente de novo." };
}

export const novoId = () => crypto.randomUUID();
