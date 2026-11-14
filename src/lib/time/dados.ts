import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  lerEstado, lerTema, respostasProximas, type Estado, type Resposta, type RespostaProxima, type Tema,
} from "./biblioteca";
import {
  lerEstadoDoChamado, lerSetor, lerTipo, type Chamado, type ChamadoInteiro, type Imagem, type Mensagem, type SetorDoChamado,
  type TipoDeChamado,
} from "./chamados";

/**
 * Leitura e escrita do setor Time: a Biblioteca JK (0071) e os chamados entre
 * setores (0072).
 *
 * Tudo passa por função do banco, chamada com o cliente da SESSÃO: é a função
 * que confere a área `time`, guarda o autor e traz o nome das pessoas (que
 * mora em `profiles`, tabela que vendas e fábrica não leem).
 *
 * A única coisa feita com o cliente de serviço é assinar o link do print. O
 * bucket `chamados` não tem policy de leitura para o print dos outros, de
 * propósito: o link só sai DEPOIS de a função `chamado_detalhe` devolver o
 * chamado para a sessão de quem pediu.
 */

export const BUCKET_DOS_CHAMADOS = "chamados";

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
    chamado: l.chamado == null ? null : numero(l.chamado),
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
 * dizer que a casa ainda não respondeu a pergunta, e a saída certa é abrir um
 * chamado, não inventar.
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

// -------------------------------------------------------------------- chamados

function lerChamadoDaLista(l: Record<string, unknown>): Chamado | null {
  const tipo = lerTipo(l.tipo);
  const estado = lerEstadoDoChamado(l.estado);
  if (!tipo || !estado || typeof l.id !== "string") return null;
  const ultima = l.ultima && typeof l.ultima === "object" ? (l.ultima as Record<string, unknown>) : null;
  return {
    id: l.id,
    numero: numero(l.numero),
    tipo,
    texto: String(l.texto ?? ""),
    paraSetor: lerSetor(l.para_setor),
    paraPessoa: texto(l.para_pessoa),
    paraPessoaNome: texto(l.para_pessoa_nome),
    abertoPor: texto(l.aberto_por),
    abertoPorNome: texto(l.aberto_por_nome),
    estado,
    precisoAte: texto(l.preciso_ate),
    produto: texto(l.produto),
    aguardandoDesde: String(l.aguardando_desde ?? ""),
    criadoEm: String(l.criado_em ?? ""),
    atualizadoEm: String(l.atualizado_em ?? ""),
    mensagens: numero(l.mensagens),
    anexos: numero(l.anexos),
    ultima: ultima ? { autor: texto(ultima.autor), texto: String(ultima.texto ?? ""), em: String(ultima.em ?? "") } : null,
    naBiblioteca: l.na_biblioteca === true,
  };
}

/** Os chamados em andamento e os resolvidos dos últimos 30 dias. `null` quando a leitura falhou. */
export async function lerChamados(db: SupabaseClient): Promise<Chamado[] | null> {
  const { data, error } = await db.rpc("chamados_listar");
  if (error) {
    console.error("[time] chamados_listar:", error.message);
    return null;
  }
  return (Array.isArray(data) ? (data as Record<string, unknown>[]) : []).map(lerChamadoDaLista).filter((c): c is Chamado => c !== null);
}

/** Os setores a que a pessoa responde nos chamados. Vazio se a leitura falhar: ela ainda vê tudo, só não tem "para mim". */
export async function lerMeusSetores(db: SupabaseClient): Promise<SetorDoChamado[]> {
  const { data, error } = await db.rpc("meus_setores");
  if (error) {
    console.error("[time] meus_setores:", error.message);
    return [];
  }
  return (Array.isArray(data) ? data : []).map(lerSetor).filter((s): s is SetorDoChamado => s !== null);
}

export type Pessoa = { id: string; nome: string; papel: string };

/** As pessoas ativas, para escolher a quem mandar um chamado. */
export async function lerPessoas(db: SupabaseClient): Promise<Pessoa[]> {
  const { data, error } = await db.rpc("pessoas_do_time");
  if (error) {
    console.error("[time] pessoas_do_time:", error.message);
    return [];
  }
  return (Array.isArray(data) ? (data as Record<string, unknown>[]) : [])
    .filter((p) => typeof p.id === "string")
    .map((p) => ({ id: String(p.id), nome: texto(p.nome) ?? "Sem nome", papel: String(p.papel ?? "") }));
}

export type AvisoDeChamados = { paraResponder: number; respondidos: number };

/**
 * O número do menu: quantos chamados abertos esperam a pessoa (no nome dela ou
 * no setor dela) e quantos chamados dela já têm resposta. Zeros se a leitura
 * falhar: aviso que não chega é melhor do que painel que não abre.
 */
export async function lerAvisoDeChamados(db: SupabaseClient): Promise<AvisoDeChamados> {
  const { data, error } = await db.rpc("chamados_para_mim");
  if (error) {
    console.error("[time] chamados_para_mim:", error.message);
    return { paraResponder: 0, respondidos: 0 };
  }
  const d = (data ?? {}) as Record<string, unknown>;
  return { paraResponder: numero(d.abertos), respondidos: numero(d.respondidos) };
}

type AnexoCru = { id: string; caminho: string; nome: string | null };

const lerAnexos = (v: unknown): AnexoCru[] =>
  (Array.isArray(v) ? (v as Record<string, unknown>[]) : [])
    .filter((a) => typeof a.id === "string" && typeof a.caminho === "string")
    .map((a) => ({ id: String(a.id), caminho: String(a.caminho), nome: texto(a.nome) }));

/**
 * Um chamado inteiro, pelo número, com o link assinado de cada print.
 *
 * `null` quando o chamado não existe OU quando a sessão não tem a área: a
 * função do banco devolve nada nos dois casos, e por isso o link assinado
 * nunca é emitido para quem não poderia ver o chamado.
 */
export async function lerChamado(db: SupabaseClient, n: number): Promise<ChamadoInteiro | null> {
  const { data, error } = await db.rpc("chamado_detalhe", { p_numero: n });
  if (error) {
    console.error("[time] chamado_detalhe:", error.message);
    return null;
  }
  const l = (data ?? null) as Record<string, unknown> | null;
  if (!l || typeof l.id !== "string") return null;
  const tipo = lerTipo(l.tipo);
  const estado = lerEstadoDoChamado(l.estado);
  if (!tipo || !estado) return null;

  const daAbertura = lerAnexos(l.anexos);
  const mensagensCruas = (Array.isArray(l.mensagens) ? (l.mensagens as Record<string, unknown>[]) : []).map((m) => ({ m, anexos: lerAnexos(m.anexos) }));

  // Todos os links de uma vez. Sem a chave de serviço (ambiente de teste), o chamado abre sem as imagens.
  const caminhos = [...daAbertura, ...mensagensCruas.flatMap((x) => x.anexos)].map((a) => a.caminho);
  const links = new Map<string, string>();
  if (caminhos.length > 0) {
    try {
      const { data: assinados } = await createAdminClient().storage.from(BUCKET_DOS_CHAMADOS).createSignedUrls(caminhos, VALIDADE_DO_LINK_S);
      for (const a of assinados ?? []) if (a.path && a.signedUrl) links.set(a.path, a.signedUrl);
    } catch (e) {
      console.error("[time] link assinado:", e instanceof Error ? e.message : e);
    }
  }
  const comLink = (a: AnexoCru): Imagem => ({ id: a.id, nome: a.nome, link: links.get(a.caminho) ?? null });

  const produto = l.produto && typeof l.produto === "object" ? (l.produto as Record<string, unknown>) : null;
  const mensagens: Mensagem[] = mensagensCruas.map(({ m, anexos }) => ({
    id: numero(m.id),
    autor: texto(m.autor),
    autorNome: texto(m.autor_nome),
    autorPapel: texto(m.autor_papel),
    texto: String(m.texto ?? ""),
    em: String(m.em ?? ""),
    imagens: anexos.map(comLink),
  }));

  return {
    id: l.id,
    numero: numero(l.numero),
    tipo,
    texto: String(l.texto ?? ""),
    paraSetor: lerSetor(l.para_setor),
    paraPessoa: texto(l.para_pessoa),
    paraPessoaNome: texto(l.para_pessoa_nome),
    abertoPor: texto(l.aberto_por),
    abertoPorNome: texto(l.aberto_por_nome),
    abertoPorPapel: texto(l.aberto_por_papel),
    estado,
    precisoAte: texto(l.preciso_ate),
    produto: produto && typeof produto.id === "string"
      ? { id: produto.id, nome: String(produto.nome ?? "Produto"), url: texto(produto.url), codigo: produto.codigo == null ? null : String(produto.codigo) }
      : null,
    aguardandoDesde: String(l.aguardando_desde ?? ""),
    criadoEm: String(l.criado_em ?? ""),
    resolvidoEm: texto(l.resolvido_em),
    resolvidoPorNome: texto(l.resolvido_por_nome),
    podeResolver: l.pode_resolver === true,
    respostaDaBiblioteca: texto(l.resposta_da_biblioteca),
    imagens: daAbertura.map(comLink),
    mensagens,
  };
}

/** A imagem que o navegador já subiu para o bucket, pronta para ser presa ao chamado. */
export type ImagemEnviada = { caminho: string; nome: string };

export type NovoChamado = {
  tipo: TipoDeChamado;
  texto: string;
  paraSetor: SetorDoChamado | null;
  paraPessoa: string | null;
  /** Já com o fuso: ver `lerPrecisoAte`. */
  precisoAte: string | null;
  produto: string | null;
  imagens: ImagemEnviada[];
};

export async function abrirChamado(db: SupabaseClient, a: NovoChamado): Promise<Resultado<{ numero: number }>> {
  const r = await db.rpc("abrir_chamado", {
    p_tipo: a.tipo,
    p_texto: a.texto,
    p_para_setor: a.paraSetor,
    p_para_pessoa: a.paraPessoa,
    p_preciso_ate: a.precisoAte,
    p_produto: a.produto,
    p_anexos: a.imagens,
  });
  return lerResultado("abrir_chamado", r, (d) => ({ numero: numero(d.numero) }));
}

export async function responderChamado(db: SupabaseClient, chamado: string, mensagem: string, imagens: ImagemEnviada[]): Promise<Resultado> {
  const r = await db.rpc("responder_chamado", { p_chamado: chamado, p_texto: mensagem, p_anexos: imagens });
  return lerResultado("responder_chamado", r);
}

export async function resolverChamado(db: SupabaseClient, chamado: string): Promise<Resultado> {
  const r = await db.rpc("resolver_chamado", { p_chamado: chamado });
  return lerResultado("resolver_chamado", r);
}

export async function virarResposta(
  db: SupabaseClient,
  chamado: string,
  a: Omit<TextosDaResposta, "origem">,
): Promise<Resultado<{ id: string }>> {
  const r = await db.rpc("chamado_virar_resposta", {
    p_chamado: chamado,
    p_tema: a.tema,
    p_pergunta: a.pergunta,
    p_explicacao: a.explicacao,
    p_frase: a.frase || null,
  });
  return lerResultado("chamado_virar_resposta", r, (d) => ({ id: String(d.id ?? "") }));
}

/** O nome, o código e o link de uma peça, para o chamado que nasce na consulta. `products` abre leitura do que está ativo. */
export async function lerProdutoDoChamado(db: SupabaseClient, id: string): Promise<{ id: string; nome: string; codigo: string | null; url: string | null } | null> {
  const { data, error } = await db.from("products").select("id, name, tray_id, url").eq("id", id).maybeSingle();
  if (error || !data) return null;
  return { id: String(data.id), nome: texto(data.name) ?? "Produto", codigo: data.tray_id == null ? null : String(data.tray_id), url: texto(data.url) };
}
