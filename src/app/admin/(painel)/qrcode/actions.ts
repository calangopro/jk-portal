"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { TAG_QRCODE } from "@/lib/qrcode/ler";
import { MODOS_DO_QRCODE, linkAceito, slugValido, type DestinoDoQrcode, type ModoDoQrcode } from "@/lib/qrcode/tipos";
import { soDigitos, telefoneValido } from "@/lib/leads/telefone";

export type EstadoDoQrcode = { ok?: string; erro?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function lerNome(form: FormData): string | { erro: string } {
  const nome = String(form.get("nome") ?? "").trim();
  if (nome.length < 2 || nome.length > 80) return { erro: "Dê um nome ao lugar, como Banheiros do Shopping Osasco." };
  return nome;
}

/**
 * O destino que veio do formulário. Os dois campos ficam gravados, para a
 * troca de modo não apagar o outro, e só o do modo escolhido precisa estar
 * certo.
 */
function lerDestino(form: FormData): DestinoDoQrcode | { erro: string } {
  const modoBruto = String(form.get("modo") ?? "whatsapp");
  const modo: ModoDoQrcode = (MODOS_DO_QRCODE as readonly string[]).includes(modoBruto)
    ? (modoBruto as ModoDoQrcode)
    : "whatsapp";
  const whatsapp = soDigitos(String(form.get("whatsapp") ?? ""));
  const mensagem = String(form.get("mensagem") ?? "").trim();
  const link = String(form.get("link") ?? "").trim();

  if (modo === "whatsapp" && !telefoneValido(whatsapp)) {
    return { erro: "Confira o número: DDD e número, como (11) 99999-9999." };
  }
  if (modo === "link" && !linkAceito(link)) {
    return { erro: "O link precisa começar com https:// e não pode ser o endereço de um QR." };
  }
  if (mensagem.length > 300) return { erro: "A mensagem passa de 300 caracteres. Encurte um pouco." };

  return {
    modo,
    whatsapp: telefoneValido(whatsapp) ? whatsapp : "",
    mensagem,
    link: linkAceito(link) ? link : "",
  };
}

function revalidar(id?: string) {
  // A tag derruba o destino guardado das rotas públicas; os caminhos, as telas.
  revalidateTag(TAG_QRCODE);
  revalidatePath("/admin/qrcode");
  if (id) revalidatePath(`/admin/qrcode/${id}`);
}

/** Cria um QR e leva para a tela dele, onde a arte está pronta para baixar. */
export async function criarQrcode(_anterior: EstadoDoQrcode, form: FormData): Promise<EstadoDoQrcode> {
  const perfil = await requireStaff();

  const nome = lerNome(form);
  if (typeof nome !== "string") return nome;

  const slug = String(form.get("slug") ?? "").trim().toLowerCase();
  if (!slugValido(slug)) {
    return { erro: "O endereço usa só letras sem acento, números e hífen, de 2 a 40 caracteres." };
  }

  const destino = lerDestino(form);
  if ("erro" in destino) return destino;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("qrcodes")
    .insert({ slug, nome, ...destino, criado_por: perfil.id })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return { erro: "Esse endereço já é de outro QR. Escolha outro." };
    return { erro: error.message };
  }

  revalidar();
  redirect(`/admin/qrcode/${data.id}`);
}

/** Salva nome e destino. O endereço não muda: está impresso. */
export async function salvarQrcode(_anterior: EstadoDoQrcode, form: FormData): Promise<EstadoDoQrcode> {
  await requireStaff();

  const id = String(form.get("id") ?? "");
  if (!UUID.test(id)) return { erro: "QR não encontrado." };

  const nome = lerNome(form);
  if (typeof nome !== "string") return nome;
  const destino = lerDestino(form);
  if ("erro" in destino) return destino;

  const supabase = await createClient();
  const { error } = await supabase
    .from("qrcodes")
    .update({ nome, ...destino, atualizado_em: new Date().toISOString() })
    .eq("id", id);
  if (error) return { erro: error.message };

  revalidar(id);
  return { ok: "Salvo. A próxima leitura já vai para o destino novo." };
}

/**
 * Arquiva ou devolve à lista. Arquivado continua funcionando e contando,
 * porque o adesivo segue colado em algum lugar. O do Tamboré nunca arquiva
 * (o banco também recusa).
 */
export async function arquivarQrcode(form: FormData): Promise<void> {
  await requireStaff();

  const id = String(form.get("id") ?? "");
  if (!UUID.test(id)) return;
  const arquivar = form.get("arquivar") === "1";

  const supabase = await createClient();
  await supabase
    .from("qrcodes")
    .update({ arquivado_em: arquivar ? new Date().toISOString() : null })
    .eq("id", id)
    .neq("slug", "");

  revalidar(id);
}
