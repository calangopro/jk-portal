import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PedirKommo } from "./cliente";
import {
  camposParaKommo,
  corpoDaNota,
  corpoDoNegocioDoBalcao,
  lerDefinicoes,
  type DefinicaoDeCampo,
  buscaDoContato,
  contatosDoCliente,
  corpoDaTarefa,
  corpoDoMovimento,
  corpoDoNegocio,
  erroCurto,
  estadoDoErro,
  idDaTarefaCriada,
  idDoNegocioCriado,
  lerNegocio,
  motivoParaNaoMover,
  type Acao,
} from "./automacoes-regra";

/**
 * O ÚNICO caminho por onde o painel escreve na Kommo (cartão 49, 0173).
 *
 * Criar ou mover negócio pode disparar o Salesbot da etapa e mandar WhatsApp
 * para cliente de verdade. Por isso cada escrita segue os mesmos passos, nesta
 * ordem, no molde de `src/lib/loja/alterar.ts`:
 *
 *   1. RESERVA no banco (`kommo_escrita_reservar`): confere que a automação
 *      está ligada, que quem ligou continua diretoria ativa (é o AUTOR da
 *      escrita; sem autor, nada é gravado), o teto por hora e que este evento
 *      nunca foi escrito (a chave única). Daqui em diante a chave está gasta:
 *      o que falhar NÃO é tentado de novo sozinho;
 *   2. LÊ na Kommo AGORA (o espelho pode ter dez minutos de atraso): o negócio
 *      a mover, o negócio da tarefa, ou o contato do cliente e os negócios
 *      dele;
 *   3. CONFERE contra essa leitura e desiste quando não vale mais (negócio
 *      fechado, já adiante, cliente já com negócio aberto no funil);
 *   4. GRAVA só o que muda;
 *   5. LÊ DE NOVO e confere que ficou como pedido;
 *   6. TERMINA o registro com o antes, o pedido, o depois e a resposta, inclusive
 *      a recusa da Kommo.
 *
 * `pedir` é o cliente da Kommo (`clienteDaKommo`), ou um de mentira no teste.
 * Rotina nenhuma chama a Kommo com POST ou PATCH por outro arquivo: o teste
 * `verificar:kommo` confere.
 */

export type ResultadoDaEscrita =
  | { estado: "pulada"; motivo: "desligada" | "sem_autor" | "ja" | "teto" | "dados" | "banco" }
  | { estado: "ok" | "desistiu" | "recusada" | "erro"; id: number; negocioId: number | null; detalhe: string | null };

type Registro = { antes: unknown; pedido: unknown; depois: unknown; http: number | null; erro: string | null; negocioId: number | null };

async function terminar(db: SupabaseClient, id: number, estado: "ok" | "desistiu" | "recusada" | "erro", r: Registro): Promise<void> {
  const { error } = await db.rpc("kommo_escrita_terminar", {
    p_id: id,
    p_estado: estado,
    p_negocio: r.negocioId,
    p_antes: r.antes ?? null,
    p_pedido: r.pedido ?? null,
    p_depois: r.depois ?? null,
    p_http: r.http,
    p_erro: r.erro,
  });
  if (error) console.error("[kommo/escrever] escrita feita e não registrada:", id, error.message);
}

export async function escreverNaKommo(db: SupabaseClient, pedir: PedirKommo, a: Acao): Promise<ResultadoDaEscrita> {
  const { data: reserva, error: semReserva } = await db.rpc("kommo_escrita_reservar", {
    p_chave: a.chave,
    p_automacao: a.automacao,
    // O negócio do balcão (0201) é "criar_negocio" no registro: só a regra de montar muda.
    p_acao: a.tipo === "criar_negocio_balcao" ? "criar_negocio" : a.tipo,
    p_cliente: a.cliente,
    p_referencia: a.referencia,
    p_rotulo: a.rotulo,
    p_negocio: a.tipo === "criar_negocio" || a.tipo === "criar_negocio_balcao" ? null : a.negocioId,
  });
  if (semReserva) {
    console.error("[kommo/escrever] reservar:", semReserva.message);
    return { estado: "pulada", motivo: "banco" };
  }
  const r = (reserva ?? {}) as { ok?: boolean; id?: number; motivo?: string; feita_por?: string };
  if (!r.ok || !r.id || !r.feita_por) {
    const motivo = (["desligada", "sem_autor", "ja", "teto", "dados"].includes(r.motivo ?? "") ? r.motivo : "dados") as "desligada";
    return { estado: "pulada", motivo };
  }
  const id = r.id;
  const fim = async (estado: "ok" | "desistiu" | "recusada" | "erro", reg: Registro): Promise<ResultadoDaEscrita> => {
    await terminar(db, id, estado, reg);
    return { estado, id, negocioId: reg.negocioId, detalhe: reg.erro };
  };

  // ---- mover negócio
  if (a.tipo === "mover_negocio") {
    let antes;
    try {
      antes = lerNegocio(await pedir<unknown>(`/api/v4/leads/${a.negocioId}`));
    } catch (e) {
      const { http, texto } = erroCurto(e);
      return fim(http === 404 ? "desistiu" : "erro", { antes: null, pedido: null, depois: null, http, erro: http === 404 ? "O negócio não existe mais na Kommo." : texto, negocioId: a.negocioId });
    }
    const motivo = motivoParaNaoMover(a, antes);
    if (motivo) return fim("desistiu", { antes, pedido: null, depois: null, http: null, erro: motivo, negocioId: a.negocioId });
    const corpo = corpoDoMovimento(a);
    try {
      await pedir(`/api/v4/leads/${a.negocioId}`, { metodo: "PATCH", corpo });
    } catch (e) {
      const { http, texto } = erroCurto(e);
      return fim(estadoDoErro(http), { antes, pedido: corpo, depois: null, http, erro: texto, negocioId: a.negocioId });
    }
    let depois;
    try {
      depois = lerNegocio(await pedir<unknown>(`/api/v4/leads/${a.negocioId}`));
    } catch {
      depois = null;
    }
    if (!depois || depois.funilId !== a.funilId || depois.etapaId !== a.paraEtapaId) {
      return fim("erro", { antes, pedido: corpo, depois, http: 200, erro: "A Kommo aceitou, mas o negócio não ficou na etapa pedida.", negocioId: a.negocioId });
    }
    return fim("ok", { antes, pedido: corpo, depois, http: 200, erro: null, negocioId: a.negocioId });
  }

  // ---- tarefa
  if (a.tipo === "criar_tarefa") {
    let antes;
    try {
      antes = lerNegocio(await pedir<unknown>(`/api/v4/leads/${a.negocioId}`));
    } catch (e) {
      const { http, texto } = erroCurto(e);
      return fim(http === 404 ? "desistiu" : "erro", { antes: null, pedido: null, depois: null, http, erro: http === 404 ? "O negócio não existe mais na Kommo." : texto, negocioId: a.negocioId });
    }
    if (!antes || antes.apagado || antes.fechado) {
      return fim("desistiu", { antes, pedido: null, depois: null, http: null, erro: "O negócio já foi fechado na Kommo.", negocioId: a.negocioId });
    }
    // O responsável é o de AGORA, lido na Kommo; o do espelho pode ter mudado.
    const acao = { ...a, responsavelId: antes.responsavelId ?? a.responsavelId };
    const corpo = corpoDaTarefa(acao);
    let resposta;
    try {
      resposta = await pedir<unknown>("/api/v4/tasks", { metodo: "POST", corpo });
    } catch (e) {
      const { http, texto } = erroCurto(e);
      return fim(estadoDoErro(http), { antes, pedido: corpo, depois: null, http, erro: texto, negocioId: a.negocioId });
    }
    const tarefa = idDaTarefaCriada(resposta);
    let depois: unknown = null;
    if (tarefa) {
      try {
        depois = await pedir<unknown>(`/api/v4/tasks/${tarefa}`);
      } catch {
        depois = null;
      }
    }
    const confere = (depois as { entity_id?: unknown } | null)?.entity_id;
    if (!tarefa || Number(confere) !== a.negocioId) {
      return fim("erro", { antes, pedido: corpo, depois: depois ?? resposta, http: 200, erro: "A Kommo respondeu, mas a tarefa não apareceu no negócio.", negocioId: a.negocioId });
    }
    return fim("ok", { antes, pedido: corpo, depois: { tarefa, ...(depois as object) }, http: 200, erro: null, negocioId: a.negocioId });
  }

  // ---- criar negócio (o do balcão tem caminho próprio, logo abaixo)
  if (a.tipo === "criar_negocio_balcao") return criarDoBalcao(pedir, a, fim);
  const busca = buscaDoContato(a.contato);
  let contatos: { id: number; negocios: number[] }[] = [];
  let abertosNoFunil: number[] = [];
  try {
    if (busca) {
      const achados = await pedir<unknown>("/api/v4/contacts", { busca: new URLSearchParams({ query: busca, with: "leads", limit: "50" }) });
      contatos = contatosDoCliente(achados, a.contato);
    }
    const ids = [...new Set(contatos.flatMap((c) => c.negocios))].slice(0, 50);
    if (ids.length) {
      const q = new URLSearchParams({ limit: "50" });
      ids.forEach((n, i) => q.append(`filter[id][${i}]`, String(n)));
      const lidos = await pedir<{ _embedded?: { leads?: unknown[] } }>("/api/v4/leads", { busca: q });
      abertosNoFunil = (lidos?._embedded?.leads ?? [])
        .map(lerNegocio)
        .filter((n): n is NonNullable<typeof n> => Boolean(n && !n.apagado && !n.fechado && n.funilId === a.negocio.funilId))
        .map((n) => n.id);
    }
  } catch (e) {
    const { http, texto } = erroCurto(e);
    return fim("erro", { antes: null, pedido: null, depois: null, http, erro: `Não deu para ler o contato na Kommo antes de criar: ${texto}`, negocioId: null });
  }
  const antes = { contatos: contatos.map((c) => c.id), abertos_no_funil: abertosNoFunil };
  if (abertosNoFunil.length) {
    return fim("desistiu", { antes, pedido: null, depois: null, http: null, erro: "O cliente já tem negócio aberto nesse funil.", negocioId: abertosNoFunil[0] });
  }
  // Mais de um contato com o mesmo telefone: usa o primeiro, e o registro guarda todos.
  const corpo = corpoDoNegocio(a, contatos[0]?.id ?? null);
  let resposta;
  try {
    resposta = await pedir<unknown>("/api/v4/leads/complex", { metodo: "POST", corpo });
  } catch (e) {
    const { http, texto } = erroCurto(e);
    return fim(estadoDoErro(http), { antes, pedido: corpo, depois: null, http, erro: texto, negocioId: null });
  }
  const criado = idDoNegocioCriado(resposta);
  let depois = null;
  if (criado) {
    try {
      depois = lerNegocio(await pedir<unknown>(`/api/v4/leads/${criado}`));
    } catch {
      depois = null;
    }
  }
  if (!criado || !depois || depois.funilId !== a.negocio.funilId) {
    return fim("erro", { antes, pedido: corpo, depois: depois ?? resposta, http: 200, erro: "A Kommo respondeu, mas o negócio criado não pôde ser conferido.", negocioId: criado });
  }
  return fim("ok", { antes, pedido: corpo, depois, http: 200, erro: null, negocioId: criado });
}

type Fim = (estado: "ok" | "desistiu" | "recusada" | "erro", reg: Registro) => Promise<ResultadoDaEscrita>;

/** As definições dos campos de negócio, lidas uma vez a cada dez minutos (a lista quase nunca muda). */
let definicoes: { em: number; lista: DefinicaoDeCampo[] } | null = null;
async function lerCampos(pedir: PedirKommo): Promise<DefinicaoDeCampo[]> {
  if (definicoes && Date.now() - definicoes.em < 600_000) return definicoes.lista;
  const lista = lerDefinicoes(await pedir<unknown>("/api/v4/leads/custom_fields", { busca: new URLSearchParams({ limit: "250" }) }));
  definicoes = { em: Date.now(), lista };
  return lista;
}

/**
 * O pedido ou o lead do balcão (cartão 72): acha o contato pelo telefone, lê
 * os campos da Kommo para trocar nome por id, cria o negócio com campos e
 * tags, confere lendo de novo e deixa a nota com o resumo. A nota que falha
 * não desfaz o negócio: fica escrito no registro.
 */
async function criarDoBalcao(pedir: PedirKommo, a: Extract<Acao, { tipo: "criar_negocio_balcao" }>, fim: Fim): Promise<ResultadoDaEscrita> {
  const busca = buscaDoContato(a.contato);
  let contatos: { id: number; negocios: number[] }[] = [];
  let abertosNoFunil: number[] = [];
  let defs: DefinicaoDeCampo[] = [];
  try {
    if (busca) {
      const achados = await pedir<unknown>("/api/v4/contacts", { busca: new URLSearchParams({ query: busca, with: "leads", limit: "50" }) });
      contatos = contatosDoCliente(achados, a.contato);
    }
    const ids = a.desistirSeAberto ? [...new Set(contatos.flatMap((c) => c.negocios))].slice(0, 50) : [];
    if (ids.length) {
      const q = new URLSearchParams({ limit: "50" });
      ids.forEach((n, i) => q.append(`filter[id][${i}]`, String(n)));
      const lidos = await pedir<{ _embedded?: { leads?: unknown[] } }>("/api/v4/leads", { busca: q });
      abertosNoFunil = (lidos?._embedded?.leads ?? [])
        .map(lerNegocio)
        .filter((n): n is NonNullable<typeof n> => Boolean(n && !n.apagado && !n.fechado && n.funilId === a.negocio.funilId))
        .map((n) => n.id);
    }
    defs = await lerCampos(pedir);
  } catch (e) {
    const { http, texto } = erroCurto(e);
    return fim("erro", { antes: null, pedido: null, depois: null, http, erro: `Não deu para ler a Kommo antes de criar: ${texto}`, negocioId: null });
  }
  const antes = { contatos: contatos.map((c) => c.id), abertos_no_funil: abertosNoFunil };
  if (abertosNoFunil.length) {
    return fim("desistiu", { antes, pedido: null, depois: null, http: null, erro: "O cliente já tem negócio aberto nesse funil.", negocioId: abertosNoFunil[0] });
  }
  const { valores, faltaram } = camposParaKommo(a.negocio.campos, defs);
  const corpo = corpoDoNegocioDoBalcao(a, contatos[0]?.id ?? null, valores);
  let resposta;
  try {
    resposta = await pedir<unknown>("/api/v4/leads/complex", { metodo: "POST", corpo });
  } catch (e) {
    const { http, texto } = erroCurto(e);
    return fim(estadoDoErro(http), { antes, pedido: corpo, depois: null, http, erro: texto, negocioId: null });
  }
  const criado = idDoNegocioCriado(resposta);
  let depois = null;
  if (criado) {
    try {
      depois = lerNegocio(await pedir<unknown>(`/api/v4/leads/${criado}`));
    } catch {
      depois = null;
    }
  }
  if (!criado || !depois || depois.funilId !== a.negocio.funilId) {
    return fim("erro", { antes, pedido: corpo, depois: depois ?? resposta, http: 200, erro: "A Kommo respondeu, mas o negócio criado não pôde ser conferido.", negocioId: criado });
  }
  let nota: string | null = null;
  try {
    await pedir("/api/v4/leads/notes", { metodo: "POST", corpo: corpoDaNota(criado, a.nota) });
  } catch (e) {
    nota = `A nota com o resumo não entrou: ${erroCurto(e).texto}`;
  }
  const aviso = [faltaram.length ? `Campos que a Kommo não tem: ${faltaram.join(", ")}.` : null, nota].filter(Boolean).join(" ") || null;
  return fim("ok", { antes, pedido: corpo, depois: { ...depois, campos_faltaram: faltaram }, http: 200, erro: aviso, negocioId: criado });
}
