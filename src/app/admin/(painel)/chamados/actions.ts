"use server";

import { revalidatePath } from "next/cache";
import { requireArea } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { conferirResposta, lerTema, type RascunhoDeResposta } from "@/lib/time/biblioteca";
import { MAXIMO_DE_IMAGENS, lerPrecisoAte, lerSetor, lerTipo } from "@/lib/time/chamados";
import { abrirChamado, resolverChamado, responderChamado, virarResposta, type ImagemEnviada } from "@/lib/time/dados";

type Feito = { ok: true } | { ok: false; erro: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const texto = (v: unknown, teto: number): string => (typeof v === "string" ? v.trim().slice(0, teto) : "");

/**
 * As imagens que o navegador diz ter subido. Aqui só se confere a forma: quem
 * confere que o arquivo existe, que está na pasta de quem envia e que é
 * imagem é a função do banco, olhando o registro do armazenamento.
 */
function lerImagens(v: unknown): ImagemEnviada[] {
  return (Array.isArray(v) ? v : [])
    .filter((i): i is { caminho: string; nome?: unknown } => Boolean(i) && typeof i === "object" && typeof (i as { caminho?: unknown }).caminho === "string")
    .slice(0, MAXIMO_DE_IMAGENS)
    .map((i) => ({ caminho: i.caminho.slice(0, 200), nome: texto(i.nome, 200) }));
}

export type PedidoDeChamado = {
  tipo: string;
  texto: string;
  paraSetor: string | null;
  paraPessoa: string | null;
  /** Como sai do campo de data e hora: "2026-11-14T18:00", no relógio do Brasil. */
  precisoAte: string | null;
  produto: string | null;
  imagens: ImagemEnviada[];
};

/**
 * Abre um chamado para um setor ou para uma pessoa. A área é conferida aqui e
 * de novo dentro da função do banco, que é quem grava e quem guarda o autor.
 */
export async function abrir(p: PedidoDeChamado): Promise<{ ok: true; numero: number } | { ok: false; erro: string }> {
  await requireArea("time");
  const tipo = lerTipo(p?.tipo);
  if (!tipo) return { ok: false, erro: "Escolha o tipo do chamado." };
  const pedido = texto(p.texto, 4000);
  if (pedido.length < 3) return { ok: false, erro: "Escreva o que você precisa." };
  const paraSetor = lerSetor(p.paraSetor);
  const paraPessoa = typeof p.paraPessoa === "string" && UUID.test(p.paraPessoa) ? p.paraPessoa : null;
  if ((paraSetor === null) === (paraPessoa === null)) return { ok: false, erro: "Escolha para quem vai: um setor ou uma pessoa." };
  const precisoAte = p.precisoAte ? lerPrecisoAte(p.precisoAte) : null;
  if (p.precisoAte && !precisoAte) return { ok: false, erro: "Não entendi a data do prazo. Escolha de novo." };

  const feito = await abrirChamado(await createClient(), {
    tipo,
    texto: pedido,
    paraSetor,
    paraPessoa,
    precisoAte,
    produto: typeof p.produto === "string" && UUID.test(p.produto) ? p.produto : null,
    imagens: lerImagens(p.imagens),
  });
  if (feito.ok) revalidatePath("/admin/chamados");
  return feito;
}

/** Escreve no chamado, com ou sem print. Resposta de outra pessoa leva o chamado para "respondido". */
export async function responder(chamado: string, mensagem: string, imagens: ImagemEnviada[]): Promise<Feito> {
  await requireArea("time");
  if (typeof chamado !== "string" || !UUID.test(chamado)) return { ok: false, erro: "Chamado inválido." };
  const lidas = lerImagens(imagens);
  const escrito = texto(mensagem, 4000);
  if (!escrito && lidas.length === 0) return { ok: false, erro: "Escreva a mensagem ou mande uma imagem." };
  const feito = await responderChamado(await createClient(), chamado, escrito, lidas);
  if (feito.ok) revalidatePath("/admin/chamados", "layout");
  return feito;
}

/** Marca como resolvido. Quem pode é decisão do banco: quem abriu, quem recebeu e a diretoria. */
export async function resolver(chamado: string): Promise<Feito> {
  await requireArea("time");
  if (typeof chamado !== "string" || !UUID.test(chamado)) return { ok: false, erro: "Chamado inválido." };
  const feito = await resolverChamado(await createClient(), chamado);
  if (feito.ok) revalidatePath("/admin/chamados", "layout");
  return feito;
}

/**
 * "Virar resposta da biblioteca": o chamado respondido vira uma resposta "a
 * confirmar", com a origem escrita pelo banco (o número do chamado, quem
 * respondeu e quando).
 */
export async function virar(chamado: string, r: RascunhoDeResposta): Promise<{ ok: true; id: string } | { ok: false; erro: string }> {
  await requireArea("time");
  if (typeof chamado !== "string" || !UUID.test(chamado)) return { ok: false, erro: "Chamado inválido." };
  const limpo = { tema: texto(r?.tema, 40), pergunta: texto(r?.pergunta, 300), explicacao: texto(r?.explicacao, 4000), frase: texto(r?.frase, 2000), origem: "" };
  const erro = conferirResposta(limpo);
  const tema = lerTema(limpo.tema);
  if (erro || !tema) return { ok: false, erro: erro ?? "Escolha o tema da resposta." };
  const feito = await virarResposta(await createClient(), chamado, { tema, pergunta: limpo.pergunta, explicacao: limpo.explicacao, frase: limpo.frase });
  if (feito.ok) {
    revalidatePath("/admin/chamados", "layout");
    revalidatePath("/admin/biblioteca");
  }
  return feito;
}
