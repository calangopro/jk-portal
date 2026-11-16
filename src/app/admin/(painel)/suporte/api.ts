"use client";

import { createClient } from "@/lib/supabase/client";
import { avisarAqui, avisarOTime } from "@/lib/time/ao-vivo";
import { caminhoDaImagem, lerPedidosAchados, type PedidoAchado } from "@/lib/time/chat";
import type { RascunhoDeResposta } from "@/lib/time/biblioteca";
import { lerLista, type ListaDoSuporte } from "@/lib/suporte/casos";
import { assinarPrints } from "./actions";

/**
 * As chamadas do suporte ao banco, DIRETO DO NAVEGADOR, com a sessão da
 * pessoa. Cada função confere a área por dentro (0102), e nenhuma tabela
 * aceita leitura ou escrita direta.
 *
 * A tela recebe isto como propriedade (`ApiDoSuporte`), para poder ser vista
 * sem sessão durante o desenvolvimento.
 */

export type Feito<T = object> = ({ ok: true } & T) | { ok: false; erro: string };

export type NovoCaso = { assunto: string; relato: string; ref: string | null; nome: string | null; telefone: string | null; urgente: boolean; imagens: string[] };

export type ApiDoSuporte = {
  lista: () => Promise<ListaDoSuporte | null>;
  abrir: (c: NovoCaso) => Promise<Feito<{ id: number }>>;
  assumir: (caso: number) => Promise<Feito>;
  fechar: (caso: number, resultado: "resolvido" | "devolvido", nota: string) => Promise<Feito>;
  /** Quem passou os casos viu como eles fecharam: o número do menu dele zera. */
  marcarVisto: () => Promise<void>;
  /** Os links assinados dos prints de um caso. */
  prints: (caso: number) => Promise<string[]>;
  virarResposta: (caso: number, r: RascunhoDeResposta) => Promise<Feito>;
  /** A busca do pedido do cliente: pelo número, ou pelo nome. É a mesma do "/pedido" do chat. */
  buscarPedidos: (busca: string) => Promise<PedidoAchado[]>;
  /** Os prints sobem direto para o bucket privado do chat, na pasta de quem envia. */
  subirPrints: (quem: string, arquivos: File[]) => Promise<Feito<{ caminhos: string[] }>>;
  /** Avisa o time, pelo canal ao vivo, de que o suporte mudou: o número do menu anda na hora. */
  avisar: () => void;
};

const SEM_REDE = "Não deu para falar com o servidor. Confira a conexão e tente de novo.";

async function chamar(funcao: string, argumentos?: Record<string, unknown>): Promise<{ data: unknown; error: { message: string } | null }> {
  try {
    const r = await createClient().rpc(funcao, argumentos);
    return { data: r.data, error: r.error };
  } catch {
    return { data: null, error: { message: SEM_REDE } };
  }
}

function lerFeito<T extends object>(r: { data: unknown; error: { message: string } | null }, extra?: (d: Record<string, unknown>) => T): Feito<T> {
  if (r.error) return { ok: false, erro: SEM_REDE };
  const d = (r.data ?? {}) as Record<string, unknown>;
  if (d.ok === true) return { ok: true, ...(extra ? extra(d) : ({} as T)) };
  return { ok: false, erro: typeof d.erro === "string" ? d.erro : "Não deu para gravar agora." };
}

export const apiDoSuporte: ApiDoSuporte = {
  async lista() {
    const r = await chamar("suporte_lista");
    return r.error ? null : lerLista(r.data);
  },

  async abrir(c) {
    const r = await chamar("suporte_abrir", {
      p_assunto: c.assunto,
      p_relato: c.relato,
      p_ref: c.ref,
      p_nome: c.nome,
      p_telefone: c.telefone,
      p_urgente: c.urgente,
      p_imagens: c.imagens,
    });
    return lerFeito(r, (d) => ({ id: Number(d.id) || 0 }));
  },

  async assumir(caso) {
    return lerFeito(await chamar("suporte_assumir", { p_caso: caso }));
  },

  async fechar(caso, resultado, nota) {
    return lerFeito(await chamar("suporte_fechar", { p_caso: caso, p_resultado: resultado, p_nota: nota }));
  },

  async marcarVisto() {
    const r = await chamar("suporte_marcar_visto");
    // O número do menu é refeito na hora, nesta aba.
    if (!r.error && Number(r.data) > 0) avisarAqui({ tipo: "lida" });
  },

  async prints(caso) {
    try {
      return await assinarPrints(caso);
    } catch {
      return [];
    }
  },

  async virarResposta(caso, rr) {
    return lerFeito(
      await chamar("suporte_virar_resposta", {
        p_caso: caso,
        p_tema: rr.tema,
        p_pergunta: rr.pergunta,
        p_explicacao: rr.explicacao,
        p_frase: rr.frase || null,
      }),
    );
  },

  async buscarPedidos(busca) {
    const r = await chamar("chat_buscar_pedidos", { p_busca: busca });
    return r.error ? [] : lerPedidosAchados(r.data);
  },

  /** O nome do arquivo não entra no caminho: print costuma se chamar pelo nome do cliente. */
  async subirPrints(quem, arquivos) {
    const caminhos: string[] = [];
    try {
      const armazenamento = createClient().storage.from("chamados");
      for (const arquivo of arquivos) {
        const caminho = caminhoDaImagem(quem, crypto.randomUUID(), arquivo.type);
        const { error } = await armazenamento.upload(caminho, arquivo, { upsert: false, contentType: arquivo.type });
        if (error) return { ok: false, erro: "Não deu para enviar o print. Confira a conexão e tente de novo." };
        caminhos.push(caminho);
      }
    } catch {
      return { ok: false, erro: "Não deu para enviar o print. Confira a conexão e tente de novo." };
    }
    return { ok: true, caminhos };
  },

  avisar() {
    avisarOTime("suporte");
    avisarAqui({ tipo: "lida" });
  },
};
