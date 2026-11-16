/**
 * Endereço assinado no padrão S3 (AWS Signature Version 4, assinatura na query).
 *
 * Serve para o R2 da Cloudflare, que fala S3: o servidor assina um endereço
 * que vale por pouco tempo, e o navegador sobe o arquivo direto para lá, sem
 * passar pela função da Vercel (que só aceita 4,5 MB de corpo).
 *
 * Sem o SDK da AWS, de propósito: são quarenta linhas de `node:crypto`, e o
 * SDK pesaria megabytes no pacote do servidor. A conta é conferida em
 * `scripts/teste-redes.mts` contra o exemplo publicado na documentação da AWS.
 *
 * Arquivo puro (só `node:crypto`): o teste roda sem servidor.
 */
import { createHash, createHmac } from "node:crypto";

export type PedidoAssinado = {
  metodo: "GET" | "PUT" | "DELETE" | "HEAD";
  /** Host sem esquema: `<conta>.r2.cloudflarestorage.com`. */
  host: string;
  /** Caminho a partir da raiz do host, começando em barra: `/<balde>/<arquivo>`. */
  caminho: string;
  chaveDeAcesso: string;
  chaveSecreta: string;
  /** `auto` no R2. */
  regiao: string;
  /** Segundos de validade do endereço. */
  validade: number;
  agora?: Date;
};

const hmac = (chave: Buffer | string, dado: string) => createHmac("sha256", chave).update(dado, "utf8").digest();
const sha256 = (dado: string) => createHash("sha256").update(dado, "utf8").digest("hex");

/** Codificação da AWS: tudo menos letra, número e `-_.~`. A barra do caminho fica. */
const codificar = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
const codificarCaminho = (c: string) => c.split("/").map(codificar).join("/");

export function enderecoAssinado(p: PedidoAssinado): string {
  const agora = p.agora ?? new Date();
  const datahora = agora.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const dia = datahora.slice(0, 8);
  const escopo = `${dia}/${p.regiao}/s3/aws4_request`;
  const caminho = codificarCaminho(p.caminho);

  const params: [string, string][] = [
    ["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
    ["X-Amz-Credential", `${p.chaveDeAcesso}/${escopo}`],
    ["X-Amz-Date", datahora],
    ["X-Amz-Expires", String(p.validade)],
    ["X-Amz-SignedHeaders", "host"],
  ];
  const query = params.map(([k, v]) => `${codificar(k)}=${codificar(v)}`).sort().join("&");

  const pedido = [p.metodo, caminho, query, `host:${p.host}`, "", "host", "UNSIGNED-PAYLOAD"].join("\n");
  const aAssinar = ["AWS4-HMAC-SHA256", datahora, escopo, sha256(pedido)].join("\n");
  const chave = hmac(hmac(hmac(hmac(`AWS4${p.chaveSecreta}`, dia), p.regiao), "s3"), "aws4_request");
  const assinatura = createHmac("sha256", chave).update(aAssinar, "utf8").digest("hex");

  return `https://${p.host}${caminho}?${query}&X-Amz-Signature=${assinatura}`;
}
