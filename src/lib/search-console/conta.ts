import "server-only";
import { createSign } from "node:crypto";

/**
 * Acesso ao Search Console por CONTA DE SERVIÇO do Google.
 *
 * Conta de serviço é um "usuário robô" do Google Cloud: tem e-mail próprio
 * (algo como `leitor@projeto.iam.gserviceaccount.com`) e uma chave privada. O
 * Search Console aceita esse e-mail como usuário de uma propriedade, igual a
 * uma pessoa. Não existe tela de login nem "autorizar app", e por isso a
 * leitura roda sozinha, de madrugada, sem ninguém logado.
 *
 * A chave vem inteira na variável `GSC_SERVICE_ACCOUNT_JSON`, que é o arquivo
 * JSON baixado do Google Cloud colado como está. Só servidor, nunca com
 * prefixo NEXT_PUBLIC_.
 *
 * Sem biblioteca do Google de propósito: o fluxo é um JWT assinado com RS256
 * trocado por token de acesso, e o `crypto` do Node faz isso em poucas linhas.
 * O pacote `googleapis` pesaria dezenas de megabytes na função da Vercel.
 */

export type ContaDeServico = { email: string; chave: string };

/** Lê a conta da variável de ambiente. Null quando falta ou não é o JSON certo. */
export function contaDeServico(): ContaDeServico | null {
  const bruto = process.env.GSC_SERVICE_ACCOUNT_JSON?.trim();
  if (!bruto) return null;
  try {
    const json = JSON.parse(bruto) as { client_email?: string; private_key?: string };
    if (!json.client_email || !json.private_key) return null;
    return {
      email: json.client_email,
      // Colado em alguns painéis, o `\n` da chave chega escapado duas vezes.
      chave: json.private_key.replace(/\\n/g, "\n"),
    };
  } catch {
    return null;
  }
}

const ESCOPO = "https://www.googleapis.com/auth/webmasters.readonly";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

function base64url(texto: string): string {
  return Buffer.from(texto).toString("base64url");
}

/** Troca a assinatura da conta por um token de acesso de uma hora, só leitura. */
export async function tokenDeAcesso(conta: ContaDeServico): Promise<string> {
  const agora = Math.floor(Date.now() / 1000);
  const cabecalho = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const corpo = base64url(
    JSON.stringify({ iss: conta.email, scope: ESCOPO, aud: TOKEN_URL, iat: agora, exp: agora + 3600 }),
  );
  const assinatura = createSign("RSA-SHA256")
    .update(`${cabecalho}.${corpo}`)
    .sign(conta.chave)
    .toString("base64url");

  const resposta = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${cabecalho}.${corpo}.${assinatura}`,
    }),
  });

  const dados = (await resposta.json().catch(() => ({}))) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!resposta.ok || !dados.access_token) {
    throw new Error(
      `O Google recusou a conta de serviço (${dados.error_description ?? dados.error ?? resposta.status}). ` +
        "Confira se a chave colada na Vercel é a do arquivo JSON inteiro e se a API do Search Console está ativada no projeto.",
    );
  }
  return dados.access_token;
}
