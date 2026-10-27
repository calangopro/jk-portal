import "server-only";
import QRCode from "qrcode";

/**
 * A arte do QR, para baixar no painel e mandar para a gráfica.
 *
 * Preto puro no branco, com a margem de 4 módulos que a norma pede: é o que
 * qualquer câmera lê de primeira, inclusive com luz fraca de banheiro. Quem
 * diagrama pode trocar a cor no SVG, desde que o escuro continue escuro e o
 * fundo claro.
 *
 * Correção de erro M (15%): aguenta um arranhão no adesivo sem deixar o
 * desenho denso demais para um QR de 3 cm.
 */

const OPCOES = {
  errorCorrectionLevel: "M" as const,
  margin: 4,
  color: { dark: "#000000", light: "#ffffff" },
};

export async function qrEmSvg(endereco: string): Promise<string> {
  return QRCode.toString(endereco, { ...OPCOES, type: "svg" });
}

/** 2.400 px de lado: passa de 1.200 dpi num QR de 5 cm. */
export async function qrEmPng(endereco: string): Promise<Buffer> {
  return QRCode.toBuffer(endereco, { ...OPCOES, type: "png", width: 2400 });
}
