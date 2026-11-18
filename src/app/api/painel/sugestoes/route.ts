import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getSessionProfile } from "@/lib/auth/session";
import {
  BALDE_DAS_SUGESTOES,
  LADO_DO_PRINT,
  MAXIMO_DE_PRINTS,
  MENSAGEM_DA_RECUSA,
  MINIMO_DO_TEXTO,
  TETO_DO_ENVIO,
  TETO_DO_PRINT_RECEBIDO,
  TETO_DO_TEXTO,
  origemDaCasa,
} from "@/lib/sugestoes/sugestoes";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Recebe uma sugestão de melhoria: o texto, a tela de onde veio e até quatro
 * prints.
 *
 * É rota e não ação de servidor por causa dos prints: a ação aceita 1 MB, e
 * quatro prints passam disso. O navegador já manda cada um reduzido; aqui
 * cada um vira WEBP pelo sharp, sempre (o Safari do iPhone não gera webp, e
 * reconverter também tira os metadados da foto), e vai para o balde privado
 * na pasta da pessoa. Só depois a função do banco registra a sugestão, que
 * confere o acesso de novo e confere que cada print existe e é da pessoa.
 *
 * Fica fora de `/admin` e confere a sessão e a origem por conta própria: sem
 * pessoa ativa, 401; pedido que não veio de página nossa, 403.
 */
export async function POST(request: NextRequest) {
  const responder = (status: number, corpo: Record<string, unknown>) =>
    NextResponse.json(corpo, { status, headers: { "Cache-Control": "no-store" } });

  if (!origemDaCasa(request.headers.get("origin"), request.headers.get("host"), process.env.NODE_ENV === "production")) {
    return responder(403, { erro: "Pedido de fora do painel." });
  }
  const perfil = await getSessionProfile();
  if (!perfil || !perfil.isActive) return responder(401, { erro: "Sua sessão caiu. Entre de novo no painel e mande outra vez." });
  if (!perfil.areas.includes("time")) return responder(403, { erro: MENSAGEM_DA_RECUSA.sem_acesso });
  if (Number(request.headers.get("content-length") ?? 0) > TETO_DO_ENVIO) {
    return responder(413, { erro: "Os prints ficaram grandes demais juntos. Mande menos prints ou prints menores." });
  }

  let formulario: FormData;
  try {
    formulario = await request.formData();
  } catch {
    return responder(400, { erro: "Não deu para ler o envio. Tente de novo." });
  }
  const texto = String(formulario.get("texto") ?? "").trim();
  if (texto.length < MINIMO_DO_TEXTO || texto.length > TETO_DO_TEXTO) return responder(400, { erro: MENSAGEM_DA_RECUSA.texto });
  const arquivos = formulario.getAll("imagem").filter((x): x is File => typeof x === "object" && x !== null && "arrayBuffer" in x);
  if (arquivos.length > MAXIMO_DE_PRINTS) return responder(400, { erro: MENSAGEM_DA_RECUSA.imagens });

  // Todos os prints são convertidos antes de qualquer um ser gravado: com um ruim, nada vai para o balde.
  const sharp = (await import("sharp")).default;
  const convertidos: Buffer[] = [];
  for (const arquivo of arquivos) {
    if (arquivo.size === 0 || arquivo.size > TETO_DO_PRINT_RECEBIDO || !/^image\//.test(arquivo.type)) {
      return responder(400, { erro: "Um dos anexos não é imagem ou é grande demais." });
    }
    try {
      convertidos.push(
        await sharp(Buffer.from(await arquivo.arrayBuffer()), { failOn: "error", limitInputPixels: 50_000_000 })
          .rotate()
          .resize({ width: LADO_DO_PRINT, height: LADO_DO_PRINT, fit: "inside", withoutEnlargement: true })
          .webp({ quality: 80 })
          .toBuffer(),
      );
    } catch {
      return responder(400, { erro: "Não deu para ler um dos prints. Tente outra imagem." });
    }
  }

  const balde = createAdminClient().storage.from(BALDE_DAS_SUGESTOES);
  const caminhos: string[] = [];
  const desfazer = async () => {
    if (caminhos.length > 0) await balde.remove(caminhos).catch(() => undefined);
  };
  for (const dados of convertidos) {
    const caminho = `${perfil.id}/${randomUUID()}.webp`;
    const { error } = await balde.upload(caminho, dados, { contentType: "image/webp", upsert: false });
    if (error) {
      console.error("[sugestoes] print não gravado:", error.message);
      await desfazer();
      return responder(502, { erro: "Não deu para guardar os prints agora. Tente de novo em alguns segundos." });
    }
    caminhos.push(caminho);
  }

  const db = await createClient();
  const { data, error } = await db.rpc("sugestao_enviar", {
    p_tela: String(formulario.get("tela") ?? "").slice(0, 200),
    p_tela_nome: String(formulario.get("telaNome") ?? "").slice(0, 120),
    p_aparelho: String(formulario.get("aparelho") ?? ""),
    p_janela: String(formulario.get("janela") ?? "").slice(0, 20),
    p_texto: texto,
    p_imagens: caminhos,
  });
  const r = (data ?? {}) as { ok?: boolean; id?: number; motivo?: string };
  if (error || !r.ok) {
    if (error) console.error("[sugestoes] sugestao_enviar:", error.message);
    await desfazer();
    return responder(error ? 502 : 400, {
      erro: error ? "Não deu para guardar agora. Tente de novo em alguns segundos." : (MENSAGEM_DA_RECUSA[r.motivo ?? ""] ?? "Não deu para guardar a sugestão."),
    });
  }
  return responder(200, { ok: true, id: r.id });
}
