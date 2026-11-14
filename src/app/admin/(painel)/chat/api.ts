"use client";

import { createClient } from "@/lib/supabase/client";
import type { RascunhoDeResposta } from "@/lib/time/biblioteca";
import { avisarOTime } from "@/lib/time/ao-vivo";
import {
  caminhoDaImagem, lerAbertura, lerLidas, lerMensagem, lerMensagens, lerPedidosAchados, lerPreviaDoPedido,
  type Abertura, type Lidas, type Mensagem, type PedidoAchado, type PreviaDoPedido, type Sala,
} from "@/lib/time/chat";
import { assinarImagens, guardarNaBiblioteca } from "./actions";

/**
 * As chamadas do chat ao banco, DIRETO DO NAVEGADOR.
 *
 * Mandar, sincronizar e marcar como lida não passam pelo servidor do painel:
 * o navegador chama a função do banco com a sessão da pessoa. É uma ida em vez
 * de duas, e num chat isso se sente. A segurança não muda de lugar: cada
 * função confere a área `time` por dentro e nenhuma tabela aceita leitura ou
 * escrita direta (0079).
 *
 * A tela recebe isto como propriedade (`ApiDoChat`), para poder ser vista sem
 * sessão durante o desenvolvimento, com uma conversa de mentira no lugar.
 */

export type Feito<T = object> = ({ ok: true } & T) | { ok: false; erro: string };

export type ImagemEnviada = { caminho: string };

export type Envio = { sala: Sala; texto: string; respondeA: number | null; pede: boolean; imagens: ImagemEnviada[] };

export type Sincronia = { cheio: boolean; lidas: Lidas; mensagens: Mensagem[] };

export type ApiDoChat = {
  /** A leitura inteira de novo. A tela usa quando ficou tempo demais sem sincronizar. */
  abrir: () => Promise<Abertura | null>;
  /** O que mudou desde um instante. `null` quando a leitura falhou (sem rede, sessão vencida). */
  sincronizar: (desde: string) => Promise<Sincronia | null>;
  anteriores: (sala: Sala, antes: number) => Promise<{ mensagens: Mensagem[]; temMais: boolean } | null>;
  enviar: (a: Envio) => Promise<Feito<{ mensagem: Mensagem }>>;
  resolver: (mensagem: number) => Promise<Feito<{ mensagem: Mensagem }>>;
  pedir: (mensagem: number) => Promise<Feito<{ mensagem: Mensagem }>>;
  apagar: (mensagem: number) => Promise<Feito<{ mensagem: Mensagem }>>;
  marcarLida: (sala: Sala, ate: number) => Promise<void>;
  subirImagens: (quem: string, arquivos: File[]) => Promise<Feito<{ imagens: ImagemEnviada[] }>>;
  /** O link assinado de cada imagem, pelo id. */
  links: (anexos: string[]) => Promise<Record<string, string>>;
  guardarNaBiblioteca: (mensagem: number, r: RascunhoDeResposta) => Promise<Feito<{ id: string }>>;
  /** Avisa o time, pelo canal ao vivo, de que há novidade na sala. */
  avisar: (sala: Sala) => void;
  /** A busca do "/pedido": pelo número, ou pelo nome do cliente para quem pode ver cliente. */
  buscarPedidos: (busca: string) => Promise<PedidoAchado[]>;
  /** A prévia de um pedido marcado, montada pelo banco para quem está olhando. */
  previaDoPedido: (numero: number) => Promise<PreviaDoPedido | null>;
};

const BUCKET = "chamados";
const SEM_REDE = "Não deu para falar com o servidor. Confira a conexão e tente de novo.";

type Resposta = { data: unknown; error: { code?: string; message: string } | null };

/** Lê a resposta de uma função que devolve a mensagem gravada. O erro já vem em português, pronto para a pessoa ler. */
function lerGravada(r: Resposta): Feito<{ mensagem: Mensagem }> {
  if (r.error) {
    // P0001 é o erro de imagem: a função desfaz a mensagem inteira e manda a frase.
    if (r.error.code === "P0001") return { ok: false, erro: r.error.message };
    return { ok: false, erro: SEM_REDE };
  }
  const d = (r.data ?? {}) as Record<string, unknown>;
  if (d.ok !== true) return { ok: false, erro: typeof d.erro === "string" ? d.erro : "Não deu para gravar agora." };
  const mensagem = lerMensagem(d.mensagem);
  return mensagem ? { ok: true, mensagem } : { ok: false, erro: "Não deu para gravar agora." };
}

async function chamar(funcao: string, argumentos?: Record<string, unknown>): Promise<Resposta> {
  try {
    const r = await createClient().rpc(funcao, argumentos);
    return { data: r.data, error: r.error };
  } catch {
    return { data: null, error: { message: SEM_REDE } };
  }
}

export const apiDoChat: ApiDoChat = {
  async abrir() {
    const r = await chamar("chat_abrir");
    return r.error ? null : lerAbertura(r.data);
  },

  async sincronizar(desde) {
    const r = await chamar("chat_sincronizar", { p_desde: desde });
    if (r.error || !r.data || typeof r.data !== "object") return null;
    const d = r.data as Record<string, unknown>;
    return { cheio: d.cheio === true, lidas: lerLidas(d.lidas), mensagens: lerMensagens(d.mensagens) };
  },

  async anteriores(sala, antes) {
    const r = await chamar("chat_anteriores", { p_sala: sala, p_antes: antes });
    if (r.error || !r.data || typeof r.data !== "object") return null;
    const d = r.data as Record<string, unknown>;
    return { mensagens: lerMensagens(d.mensagens), temMais: d.tem_mais === true };
  },

  async enviar(a) {
    return lerGravada(await chamar("chat_enviar", { p_sala: a.sala, p_texto: a.texto, p_responde_a: a.respondeA, p_pede: a.pede, p_anexos: a.imagens }));
  },

  async resolver(mensagem) {
    return lerGravada(await chamar("chat_resolver", { p_mensagem: mensagem }));
  },

  async pedir(mensagem) {
    return lerGravada(await chamar("chat_pedir", { p_mensagem: mensagem }));
  },

  async apagar(mensagem) {
    return lerGravada(await chamar("chat_apagar", { p_mensagem: mensagem }));
  },

  async marcarLida(sala, ate) {
    await chamar("chat_marcar_lida", { p_sala: sala, p_ate: ate });
  },

  /**
   * A imagem sobe direto do navegador para o bucket privado, na pasta de quem
   * envia, e só depois a mensagem é gravada com o caminho. O nome do arquivo
   * não entra no caminho: print costuma se chamar pelo nome do cliente.
   */
  async subirImagens(quem, arquivos) {
    const imagens: ImagemEnviada[] = [];
    try {
      const armazenamento = createClient().storage.from(BUCKET);
      for (const arquivo of arquivos) {
        const caminho = caminhoDaImagem(quem, crypto.randomUUID(), arquivo.type);
        const { error } = await armazenamento.upload(caminho, arquivo, { upsert: false, contentType: arquivo.type });
        if (error) return { ok: false, erro: "Não deu para enviar a imagem. Confira a conexão e tente de novo." };
        imagens.push({ caminho });
      }
    } catch {
      return { ok: false, erro: "Não deu para enviar a imagem. Confira a conexão e tente de novo." };
    }
    return { ok: true, imagens };
  },

  async links(anexos) {
    try {
      return await assinarImagens(anexos);
    } catch {
      return {};
    }
  },

  async guardarNaBiblioteca(mensagem, r) {
    try {
      return await guardarNaBiblioteca(mensagem, r);
    } catch {
      return { ok: false, erro: SEM_REDE };
    }
  },

  avisar: avisarOTime,

  async buscarPedidos(busca) {
    const r = await chamar("chat_buscar_pedidos", { p_busca: busca });
    return r.error ? [] : lerPedidosAchados(r.data);
  },

  async previaDoPedido(numero) {
    const r = await chamar("chat_previa_do_pedido", { p_numero: numero });
    return r.error ? null : lerPreviaDoPedido(r.data);
  },
};
