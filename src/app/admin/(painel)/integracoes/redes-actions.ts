"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { guardarR2, PROVEDOR_R2 } from "@/lib/redes/armazenamento";
import { desligarConta, guardarAplicativo, guardarContas, lerConta } from "@/lib/redes/contas";
import { lerRedes } from "@/lib/redes/leitura";
import { modulo } from "@/lib/redes/plataformas";
import { ehRede, nomeDaRede } from "@/lib/redes/redes";
import { ErroDaRede } from "@/lib/redes/tipos";
import { createAdminClient } from "@/lib/supabase/admin";
import type { IntegracaoState } from "./actions";

/**
 * As ações de ligar e desligar rede social. Todas pedem administrador, dono ou
 * GM: é quem cola chave e autoriza conta em nome da JK.
 *
 * Segredo que entra aqui vai para o cofre (`lib/redes/cofre.ts`) e nunca volta
 * para a tela. Nenhuma ação devolve token, nem inteiro nem pela metade.
 */

function atualizarTelas() {
  revalidatePath("/admin/integracoes");
  revalidatePath("/admin/redes", "layout");
}

/** Salva o aplicativo de uma rede (id e chave secreta). Chave em branco mantém a que já estava. */
export async function salvarAplicativoDaRede(_prev: IntegracaoState, formData: FormData): Promise<IntegracaoState> {
  await requireAdmin();
  const rede = String(formData.get("rede") ?? "");
  const m = ehRede(rede) ? modulo(rede) : null;
  if (!m?.provedorDoAplicativo) return { erro: "Esta rede não usa aplicativo próprio." };
  // O cliente do Google é o do Perfil da Empresa e se salva no cartão dele: aqui não se mexe.
  if (m.provedorDoAplicativo === "google_cliente") return { erro: "O cliente do Google se salva no cartão do Google, mais acima." };

  const id = String(formData.get("app_id") ?? "").trim();
  const segredo = String(formData.get("app_segredo") ?? "").trim();
  if (!/^[\w.-]{6,80}$/.test(id)) return { erro: "Confira o ID do aplicativo: ele não tem espaço nem quebra de linha." };
  if (segredo && (segredo.length < 16 || /\s/.test(segredo))) return { erro: "Cole a chave secreta inteira, sem espaço nem quebra de linha." };

  const erro = await guardarAplicativo(createAdminClient(), m.provedorDoAplicativo, { id, segredo });
  if (erro) return { erro };
  atualizarTelas();
  return { ok: `Aplicativo salvo. Agora é só ligar a conta de ${nomeDaRede(rede)}.` };
}

/**
 * Liga contas por um token colado (o token de usuário do sistema do Meta, que
 * alcança a Página e o Instagram de uma vez). O token é conferido ANTES de
 * gravar: sem conta ao alcance dele, nada é guardado e a resposta diz o que
 * falta.
 */
export async function ligarRedeComToken(_prev: IntegracaoState, formData: FormData): Promise<IntegracaoState> {
  const perfil = await requireAdmin();
  const rede = String(formData.get("rede") ?? "");
  const m = ehRede(rede) ? modulo(rede) : null;
  if (!m?.conectarComToken) return { erro: "Esta rede não liga por token." };

  const token = String(formData.get("valor") ?? "").trim();
  if (token.length < 40 || /\s/.test(token)) return { erro: "Cole o token inteiro, sem espaço nem quebra de linha." };

  const db = createAdminClient();
  try {
    const contas = await m.conectarComToken({ token });
    if (!contas.length) return { erro: "O token foi aceito, mas não alcança nenhuma conta. Confira se a Página e o Instagram estão atribuídos ao usuário do sistema." };
    const gravou = await guardarContas(db, contas, { perfilId: perfil.id, via: "token" });
    if (gravou.erro) return { erro: `O token foi conferido, mas não deu para guardar: ${gravou.erro}` };

    // A primeira leitura roda depois da resposta, para o botão não ficar girando.
    after(async () => {
      for (const id of gravou.ids) await lerRedes(db, { contaId: id, primeira: true, dias: 30, paginas: 3, metricas: 30, prazoMs: 40_000 }).catch((e) => console.error("[redes] primeira leitura", e));
    });
    atualizarTelas();
    const quais = contas.map((c) => `${nomeDaRede(c.rede)} ${c.usuario || c.nome || ""}`.trim()).join(", ");
    return { ok: `Token conferido e guardado. Ligado: ${quais}. Os números aparecem em um ou dois minutos.` };
  } catch (e) {
    if (!(e instanceof ErroDaRede)) console.error("[redes] ligar com token", e);
    return { erro: e instanceof ErroDaRede ? e.message : "Não deu para conferir o token agora. Tente de novo." };
  }
}

/** Desliga uma conta: ela some das telas e a credencial é apagada. Os números já lidos ficam guardados. */
export async function desligarContaDaRede(_prev: IntegracaoState, formData: FormData): Promise<IntegracaoState> {
  await requireAdmin();
  const id = String(formData.get("conta") ?? "");
  if (!/^[0-9a-f-]{36}$/.test(id)) return { erro: "Conta desconhecida." };
  const db = createAdminClient();
  const conta = await lerConta(db, id);
  if (!conta) return { erro: "Conta desconhecida." };
  const erro = await desligarConta(db, id);
  if (erro) return { erro };
  atualizarTelas();
  return { ok: `${nomeDaRede(conta.rede)} desligado. A credencial foi apagada; os números já lidos continuam guardados.` };
}

/**
 * Liga o R2 da Cloudflare como armazenamento das mídias dos posts. As chaves
 * só são guardadas depois de o painel provar que funcionam (ver `guardarR2`).
 * "Voltar ao Supabase" apaga as chaves daqui; os arquivos que já estão no R2
 * continuam lá, e os posts agendados com eles continuam valendo.
 */
export async function salvarArmazenamentoR2(_prev: IntegracaoState, formData: FormData): Promise<IntegracaoState> {
  await requireAdmin();
  const db = createAdminClient();

  if (String(formData.get("remover") ?? "") === "1") {
    const { error } = await db.from("integration_tokens").delete().eq("provider", PROVEDOR_R2);
    if (error) return { erro: error.message };
    atualizarTelas();
    return { ok: "Chaves do R2 apagadas. As próximas mídias sobem para o Supabase, com até 50 MB por arquivo." };
  }

  // Aceita o ID puro ou o endereço S3 inteiro (https://<id>.r2.cloudflarestorage.com).
  const conta = (String(formData.get("conta") ?? "").trim().toLowerCase().match(/[0-9a-f]{32}/) ?? [""])[0];
  const balde = String(formData.get("balde") ?? "").trim();
  const publico = String(formData.get("publico") ?? "").trim().replace(/\/+$/, "");
  const chaveDeAcesso = String(formData.get("chave_id") ?? "").trim();
  const chaveSecreta = String(formData.get("chave_segredo") ?? "").trim();

  if (!conta) return { erro: "Confira o ID da conta da Cloudflare: são 32 letras e números." };
  if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(balde)) return { erro: "Confira o nome do balde." };
  if (!/^https:\/\/[a-z0-9.-]+\.[a-z]{2,}$/i.test(publico)) return { erro: "O endereço público começa com https:// e não tem caminho depois do domínio." };
  if (chaveDeAcesso.length < 20 || /\s/.test(chaveDeAcesso) || chaveSecreta.length < 40 || /\s/.test(chaveSecreta)) {
    return { erro: "Cole o ID da chave de acesso e a chave secreta inteiros, sem espaço nem quebra de linha." };
  }

  const erro = await guardarR2(db, { conta, balde, publico, chaveDeAcesso, chaveSecreta });
  if (erro) return { erro };
  atualizarTelas();
  return { ok: "R2 conferido e ligado: o painel subiu um arquivo de teste, leu pelo endereço público e apagou. As próximas mídias vão para lá." };
}
