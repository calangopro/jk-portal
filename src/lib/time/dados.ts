import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  lerEstado, lerTema, respostasProximas, type Estado, type Resposta, type RespostaProxima, type Tema,
} from "./biblioteca";
import { SEM_RESUMO, lerAbertura, lerResumo, type Abertura, type ResumoDoChat } from "./chat";

/**
 * Leitura e escrita do setor Time NO SERVIDOR: a Biblioteca JK (0071) e o que
 * o chat (0079) precisa do servidor.
 *
 * Tudo passa por função do banco, chamada com o cliente da SESSÃO: é a função
 * que confere a área `time`, guarda o autor e traz o nome das pessoas (que
 * mora em `profiles`, tabela que vendas e fábrica não leem).
 *
 * A conversa em si (mandar, sincronizar, marcar como lida) NÃO passa por aqui:
 * a tela chama as mesmas funções direto do navegador, com a sessão da pessoa
 * (`app/admin/(painel)/chat/api.ts`), porque num chat uma ida ao banco a menos
 * aparece. O servidor fica com três coisas: a primeira leitura da tela, o
 * número do menu e o link assinado da imagem.
 *
 * A única coisa feita com o cliente de serviço é assinar o link da imagem. O
 * bucket não tem policy de leitura para a imagem dos outros, de propósito: o
 * link só sai DEPOIS de a função `chat_caminhos` devolver o caminho para a
 * sessão de quem pediu.
 */

/** O bucket privado das imagens. Nasceu com os chamados (0072) e bucket não muda de nome. */
export const BUCKET_DO_CHAT = "chamados";

/** Link assinado vale uma hora: dá para abrir o print, não para guardar o endereço. */
const VALIDADE_DO_LINK_S = 3600;

type Resultado<T = object> = ({ ok: true } & T) | { ok: false; erro: string };

const texto = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);
const numero = (v: unknown): number => (typeof v === "number" ? v : Number(v) || 0);

/**
 * Lê a resposta de uma função de escrita. As funções devolvem `{ok, erro}` com
 * a mensagem já em português, para a pessoa ler. Erro de imagem vem como
 * exceção `P0001` (para desfazer a gravação inteira), também com a mensagem
 * pronta. Qualquer outra falha vira um aviso genérico, e o detalhe vai para o
 * registro do servidor.
 */
function lerResultado<T extends object>(onde: string, r: { data: unknown; error: { code?: string; message: string } | null }, extra?: (d: Record<string, unknown>) => T): Resultado<T> {
  if (r.error) {
    if (r.error.code === "P0001") return { ok: false, erro: r.error.message };
    console.error(`[time] ${onde}:`, r.error.message);
    return { ok: false, erro: "Não deu para gravar agora. Tente de novo em alguns segundos." };
  }
  const d = (r.data ?? {}) as Record<string, unknown>;
  if (d.ok === true) return { ok: true, ...(extra ? extra(d) : ({} as T)) };
  return { ok: false, erro: texto(d.erro) ?? "Não deu para gravar agora." };
}

// ------------------------------------------------------------------ biblioteca

/** A conversa do chat de que a resposta nasceu: a sala e o número da mensagem. */
function lerConversa(v: unknown): Resposta["conversa"] {
  if (!v || typeof v !== "object") return null;
  const c = v as Record<string, unknown>;
  const sala = typeof c.sala === "string" ? c.sala : "";
  const mensagem = numero(c.mensagem);
  return sala && mensagem > 0 ? { sala, mensagem } : null;
}

function lerResposta(l: Record<string, unknown>): Resposta | null {
  const tema = lerTema(l.tema);
  const estado = lerEstado(l.estado);
  if (!tema || !estado || typeof l.id !== "string") return null;
  return {
    id: l.id,
    tema,
    pergunta: String(l.pergunta ?? ""),
    explicacao: String(l.explicacao ?? ""),
    frase: texto(l.frase),
    estado,
    origem: texto(l.origem),
    criadoPor: texto(l.criado_por),
    criadoPorNome: texto(l.criado_por_nome),
    criadoEm: String(l.criado_em ?? ""),
    confirmadoPorNome: texto(l.confirmado_por_nome),
    confirmadoEm: texto(l.confirmado_em),
    atualizadoEm: String(l.atualizado_em ?? ""),
    conversa: lerConversa(l.conversa),
  };
}

/** A biblioteca inteira. Arquivada só vem para administrador, dono e GM. `null` quando a leitura falhou. */
export async function lerBiblioteca(db: SupabaseClient): Promise<Resposta[] | null> {
  const { data, error } = await db.rpc("biblioteca_listar");
  if (error) {
    console.error("[time] biblioteca_listar:", error.message);
    return null;
  }
  return (Array.isArray(data) ? (data as Record<string, unknown>[]) : []).map(lerResposta).filter((r): r is Resposta => r !== null);
}

/**
 * PARA O TUTOR DE IA: dado um texto solto (a pergunta do vendedor, ou o que
 * foi lido de um print), devolve as respostas da casa mais próximas, cada uma
 * com o estado e os pontos.
 *
 * O tutor NÃO deve tratar "a confirmar" como regra: o estado vem junto para
 * ele dizer ao vendedor que a JK ainda não confirmou aquilo. Lista vazia quer
 * dizer que a casa ainda não respondeu a pergunta, e a saída certa é perguntar
 * no chat do time, não inventar.
 *
 * Recebe o cliente da sessão de quem perguntou: a função do banco confere a
 * área `time` e não devolve resposta arquivada para quem não é da diretoria.
 */
export async function respostasParaOTutor(db: SupabaseClient, pergunta: string, limite = 5): Promise<RespostaProxima[]> {
  const biblioteca = await lerBiblioteca(db);
  return biblioteca ? respostasProximas(pergunta, biblioteca, limite) : [];
}

export type TextosDaResposta = { tema: Tema; pergunta: string; explicacao: string; frase: string; origem: string };

export async function sugerirResposta(db: SupabaseClient, a: TextosDaResposta): Promise<Resultado<{ id: string }>> {
  const r = await db.rpc("sugerir_resposta", {
    p_tema: a.tema,
    p_pergunta: a.pergunta,
    p_explicacao: a.explicacao,
    p_frase: a.frase || null,
    p_origem: a.origem || null,
  });
  return lerResultado("sugerir_resposta", r, (d) => ({ id: String(d.id ?? "") }));
}

export async function editarResposta(db: SupabaseClient, id: string, a: TextosDaResposta): Promise<Resultado> {
  const r = await db.rpc("editar_resposta", {
    p_id: id,
    p_tema: a.tema,
    p_pergunta: a.pergunta,
    p_explicacao: a.explicacao,
    p_frase: a.frase || null,
    p_origem: a.origem || null,
  });
  return lerResultado("editar_resposta", r);
}

export async function definirEstadoDaResposta(db: SupabaseClient, id: string, estado: Estado): Promise<Resultado> {
  const r = await db.rpc("definir_estado_da_resposta", { p_id: id, p_estado: estado });
  return lerResultado("definir_estado_da_resposta", r);
}

// ------------------------------------------------------------------------ chat

/**
 * A primeira leitura da tela do chat: as últimas mensagens de cada sala, os
 * pedidos que esperam, até onde a pessoa leu e quem é do time. `null` quando a
 * leitura falhou ou a sessão não tem a área.
 */
export async function lerAberturaDoChat(db: SupabaseClient): Promise<Abertura | null> {
  const { data, error } = await db.rpc("chat_abrir");
  if (error) {
    console.error("[time] chat_abrir:", error.message);
    return null;
  }
  return lerAbertura(data);
}

/**
 * O número do menu e da Visão geral: o que a pessoa não leu e os pedidos que
 * esperam o setor dela. Zeros se a leitura falhar: aviso que não chega é
 * melhor do que painel que não abre.
 */
export async function lerResumoDoChat(db: SupabaseClient): Promise<ResumoDoChat> {
  const { data, error } = await db.rpc("chat_resumo");
  if (error) {
    console.error("[time] chat_resumo:", error.message);
    return SEM_RESUMO;
  }
  return lerResumo(data);
}

/**
 * O link assinado de cada imagem pedida, pelo id.
 *
 * Quem decide o que a pessoa pode ver é a função do banco, chamada com a
 * SESSÃO dela: ela só devolve o caminho de imagem de mensagem que existe, que
 * não foi apagada, e para quem tem a área. Só depois o cliente de serviço
 * assina. Imagem sem link fica de fora do resultado, e a tela mostra o aviso.
 */
export async function linksDasImagensDoChat(db: SupabaseClient, anexos: string[]): Promise<Record<string, string>> {
  if (anexos.length === 0) return {};
  const { data, error } = await db.rpc("chat_caminhos", { p_anexos: anexos });
  if (error) {
    console.error("[time] chat_caminhos:", error.message);
    return {};
  }
  const caminhos = (Array.isArray(data) ? (data as Record<string, unknown>[]) : [])
    .filter((a) => typeof a.id === "string" && typeof a.caminho === "string")
    .map((a) => ({ id: String(a.id), caminho: String(a.caminho) }));
  if (caminhos.length === 0) return {};
  const links: Record<string, string> = {};
  try {
    const { data: assinados } = await createAdminClient().storage.from(BUCKET_DO_CHAT).createSignedUrls(caminhos.map((c) => c.caminho), VALIDADE_DO_LINK_S);
    const porCaminho = new Map((assinados ?? []).filter((a) => a.path && a.signedUrl).map((a) => [a.path as string, a.signedUrl]));
    for (const c of caminhos) {
      const link = porCaminho.get(c.caminho);
      if (link) links[c.id] = link;
    }
  } catch (e) {
    // Sem a chave de serviço (ambiente de teste), a conversa abre sem as imagens.
    console.error("[time] link assinado:", e instanceof Error ? e.message : e);
  }
  return links;
}

/** "Guardar na biblioteca": a mensagem do chat que já tem resposta de outra pessoa vira uma resposta "a confirmar". */
export async function virarResposta(
  db: SupabaseClient,
  mensagem: number,
  a: Omit<TextosDaResposta, "origem">,
): Promise<Resultado<{ id: string }>> {
  const r = await db.rpc("chat_virar_resposta", {
    p_mensagem: mensagem,
    p_tema: a.tema,
    p_pergunta: a.pergunta,
    p_explicacao: a.explicacao,
    p_frase: a.frase || null,
  });
  return lerResultado("chat_virar_resposta", r, (d) => ({ id: String(d.id ?? "") }));
}

/** O nome, o código e o link de uma peça, para a pergunta que nasce na consulta. `products` abre leitura do que está ativo. */
export async function lerProdutoDoChat(db: SupabaseClient, id: string): Promise<{ id: string; nome: string; codigo: string | null; url: string | null } | null> {
  const { data, error } = await db.from("products").select("id, name, tray_id, url").eq("id", id).maybeSingle();
  if (error || !data) return null;
  return { id: String(data.id), nome: texto(data.name) ?? "Produto", codigo: data.tray_id == null ? null : String(data.tray_id), url: texto(data.url) };
}
