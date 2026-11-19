import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { lerChaves } from "@/lib/leads/chaves";
import { clienteDaKommo, type PedirKommo } from "./cliente";
import {
  TIPOS_DE_EVENTO,
  emLotes,
  janelaDeEventos,
  linhaDoContato,
  linhaDoEvento,
  linhaDoNegocio,
  linhasDosFunis,
  linhasDosMotivos,
  linhasDosUsuarios,
  proximoCursor,
  segundos,
  type ContatoDaKommo,
  type EventoDaKommo,
  type FunilDaKommoApi,
  type MotivoDePerdaDaKommo,
  type LinhaEvento,
  type NegocioDaKommo,
  type UsuarioDaKommo,
} from "./conta";
import { palpitesDasFases } from "./funil";

/**
 * O espelho da Kommo (0160 e 0161): a rotina de 10 em 10 minutos e o
 * processamento do que o webhook avisou. Só LÊ a Kommo.
 *
 * Em cada rodada, nesta ordem, até o prazo:
 *   1. usuários, funis, etapas e motivos de perda (três pedidos), e o palpite da fase das etapas novas;
 *   2. o que o webhook avisou e ainda não foi relido (`kommo_pendentes`);
 *   3. os eventos desde o último ponto, em janelas de uma hora;
 *   4. os negócios e os contatos alterados desde o último ponto. Na primeira
 *      rodada o ponto é 90 dias atrás: é a carga inicial, que anda em várias
 *      rodadas (31,7 mil negócios mexidos em 90 dias, em 18/11/2026).
 * Cada passo guarda o ponto ao terminar uma página, então rodada cortada pelo
 * prazo continua de onde parou.
 */

const PAGINA = 250;
const DIAS_DA_CARGA = 90;

export type ResultadoDaLeitura = {
  estado: "sem_chave" | "ok" | "parcial";
  negocios: number;
  contatos: number;
  eventos: number;
  pendentes: number;
  apagados: number;
  cargaEmAndamento: boolean;
  detalhe: string;
};

type Estado = {
  eventos_ate: string | null;
  carga_desde: string | null;
  carga_concluida_em: string | null;
  negocios_ate: string | null;
  negocios_pagina: number;
  contatos_ate: string | null;
  contatos_pagina: number;
};

async function gravar(db: SupabaseClient, tabela: string, linhas: object[], conflito: string): Promise<void> {
  for (const lote of emLotes(linhas, 500)) {
    const { error } = await db.from(tabela).upsert(lote, { onConflict: conflito });
    if (error) throw new Error(`${tabela}: ${error.message}`);
  }
}

async function salvarEstado(db: SupabaseClient, mudancas: Record<string, unknown>): Promise<void> {
  const { error } = await db.from("kommo_estado").update(mudancas).eq("id", 1);
  if (error) throw new Error(`kommo_estado: ${error.message}`);
}

async function lerUsuariosEFunis(db: SupabaseClient, pedir: PedirKommo, agora: string): Promise<void> {
  const usuarios: UsuarioDaKommo[] = [];
  for (let pagina = 1; pagina <= 10; pagina++) {
    const r = await pedir<{ _embedded?: { users?: UsuarioDaKommo[] } }>("/api/v4/users", {
      busca: new URLSearchParams({ limit: "250", page: String(pagina) }),
    });
    const lote = r?._embedded?.users ?? [];
    usuarios.push(...lote);
    if (lote.length < 250) break;
  }
  await gravar(db, "kommo_usuarios", linhasDosUsuarios(usuarios, agora), "id");

  const f = await pedir<{ _embedded?: { pipelines?: FunilDaKommoApi[] } }>("/api/v4/leads/pipelines");
  const { funis, etapas } = linhasDosFunis(f?._embedded?.pipelines ?? [], agora);
  await gravar(db, "kommo_funis", funis, "id");
  await gravar(db, "kommo_etapas", etapas, "funil_id,id");

  // A fase padrão de cada etapa (0162) é do painel: a leitura só preenche a etapa que ainda não tem
  // linha, com o palpite pelo nome. O que a diretoria ligou nunca é regravado aqui.
  const nomeDoFunil = new Map(funis.map((x) => [x.id, x.nome]));
  const palpites = palpitesDasFases(
    etapas.map((e) => ({ funil_id: e.funil_id, funil: nomeDoFunil.get(e.funil_id) ?? "", etapa_id: e.id, etapa: e.nome, tipo: e.tipo })),
  );
  for (const lote of emLotes(palpites, 500)) {
    const { error } = await db.from("fases_da_kommo").upsert(lote, { onConflict: "funil_id,etapa_id", ignoreDuplicates: true });
    if (error) throw new Error(`fases_da_kommo: ${error.message}`);
  }

  const m = await pedir<{ _embedded?: { loss_reasons?: MotivoDePerdaDaKommo[] } }>("/api/v4/leads/loss_reasons", {
    busca: new URLSearchParams({ limit: "250" }),
  });
  await gravar(db, "kommo_motivos_perda", linhasDosMotivos(m?._embedded?.loss_reasons ?? [], agora), "id");
}

/** Relê pela API os negócios e contatos pedidos; o que não voltar foi apagado na Kommo. */
export async function relerPorId(
  db: SupabaseClient,
  pedir: PedirKommo,
  ids: { negocios: number[]; contatos: number[] },
  agora: string,
): Promise<{ negocios: number; contatos: number; apagados: number }> {
  let negocios = 0;
  let contatos = 0;
  let apagados = 0;

  for (const lote of emLotes([...new Set(ids.negocios)], 50)) {
    const busca = new URLSearchParams({ with: "contacts", limit: "250" });
    for (const id of lote) busca.append("filter[id][]", String(id));
    const r = await pedir<{ _embedded?: { leads?: NegocioDaKommo[] } }>("/api/v4/leads", { busca });
    const vieram = r?._embedded?.leads ?? [];
    await gravar(db, "kommo_negocios", vieram.map((n) => linhaDoNegocio(n, agora)), "id");
    negocios += vieram.length;
    const faltaram = lote.filter((id) => !vieram.some((n) => n.id === id));
    if (faltaram.length) {
      const { error } = await db.from("kommo_negocios").update({ apagado: true, espelhado_em: agora }).in("id", faltaram);
      if (error) throw new Error(`kommo_negocios: ${error.message}`);
      apagados += faltaram.length;
    }
  }

  for (const lote of emLotes([...new Set(ids.contatos)], 50)) {
    const busca = new URLSearchParams({ limit: "250" });
    for (const id of lote) busca.append("filter[id][]", String(id));
    const r = await pedir<{ _embedded?: { contacts?: ContatoDaKommo[] } }>("/api/v4/contacts", { busca });
    const vieram = r?._embedded?.contacts ?? [];
    await gravar(db, "kommo_contatos", vieram.map((c) => linhaDoContato(c, agora)), "id");
    contatos += vieram.length;
    const faltaram = lote.filter((id) => !vieram.some((c) => c.id === id));
    if (faltaram.length) {
      const { error } = await db.from("kommo_contatos").update({ apagado: true, espelhado_em: agora }).in("id", faltaram);
      if (error) throw new Error(`kommo_contatos: ${error.message}`);
      apagados += faltaram.length;
    }
  }
  return { negocios, contatos, apagados };
}

/** O que o webhook avisou e ainda não foi relido. Tira da fila só depois de gravar. */
export async function processarPendentes(db: SupabaseClient, pedir: PedirKommo, agora: string, limite = 500) {
  const { data, error } = await db.from("kommo_pendentes").select("entidade, id, acao, avisado_em").order("avisado_em").limit(limite);
  if (error) throw new Error(`kommo_pendentes: ${error.message}`);
  const linhas = (data ?? []) as { entidade: "negocio" | "contato"; id: number; acao: "atualizar" | "apagar"; avisado_em: string }[];
  if (!linhas.length) return { negocios: 0, contatos: 0, apagados: 0, pendentes: 0 };

  // "Apagar" também passa pela releitura: se a Kommo não devolver, fica apagado; se devolver, foi restaurado.
  const r = await relerPorId(db, pedir, {
    negocios: linhas.filter((l) => l.entidade === "negocio").map((l) => l.id),
    contatos: linhas.filter((l) => l.entidade === "contato").map((l) => l.id),
  }, agora);

  // Só sai da fila o aviso que já estava lá quando a leitura começou: um aviso novo do mesmo id fica para a próxima.
  for (const entidade of ["negocio", "contato"] as const) {
    const desta = linhas.filter((l) => l.entidade === entidade);
    for (const lote of emLotes(desta, 200)) {
      const ate = lote.reduce((m, l) => (l.avisado_em > m ? l.avisado_em : m), "");
      const { error: e } = await db.from("kommo_pendentes").delete().eq("entidade", entidade).in("id", lote.map((l) => l.id)).lte("avisado_em", ate);
      if (e) throw new Error(`kommo_pendentes: ${e.message}`);
    }
  }
  return { ...r, pendentes: linhas.length };
}

async function lerEventos(db: SupabaseClient, pedir: PedirKommo, estado: Estado, prazo: number) {
  let lidos = 0;
  const apagados = new Set<number>();
  let ate = estado.eventos_ate;
  while (Date.now() < prazo) {
    const agora = new Date().toISOString();
    const janela = janelaDeEventos(ate, agora);
    const linhas: LinhaEvento[] = [];
    let completa = true;
    for (let pagina = 1; ; pagina++) {
      if (Date.now() > prazo) {
        completa = false;
        break;
      }
      const busca = new URLSearchParams({
        limit: "100",
        page: String(pagina),
        "filter[created_at][from]": String(segundos(janela.de)),
        "filter[created_at][to]": String(segundos(janela.ate)),
      });
      busca.set("filter[type]", TIPOS_DE_EVENTO.join(","));
      const r = await pedir<{ _embedded?: { events?: EventoDaKommo[] } }>("/api/v4/events", { busca });
      const lote = r?._embedded?.events ?? [];
      for (const e of lote) {
        const l = linhaDoEvento(e);
        if (l) linhas.push(l);
        if (e.type === "lead_deleted") apagados.add(e.entity_id);
      }
      if (lote.length < 100) break;
    }
    if (!completa) break;
    await gravar(db, "kommo_eventos", linhas, "id");
    lidos += linhas.length;
    ate = janela.ate;
    await salvarEstado(db, { eventos_ate: ate });
    if (Date.parse(janela.ate) >= Date.parse(agora) - 1000) break;
  }
  if (apagados.size) {
    const { error } = await db.from("kommo_negocios").update({ apagado: true }).in("id", [...apagados]);
    if (error) throw new Error(`kommo_negocios: ${error.message}`);
  }
  return { lidos, apagados: apagados.size, emDia: ate !== null && Date.now() - Date.parse(ate) < 15 * 60_000 };
}

/** Negócios ou contatos "alterados desde", página a página, guardando o ponto. */
async function lerAlterados(
  db: SupabaseClient,
  pedir: PedirKommo,
  qual: "negocios" | "contatos",
  inicio: { ate: string; pagina: number },
  prazo: number,
): Promise<{ lidos: number; emDia: boolean }> {
  let { ate, pagina } = inicio;
  let lidos = 0;
  while (Date.now() < prazo) {
    const agora = new Date().toISOString();
    const busca = new URLSearchParams({
      limit: String(PAGINA),
      page: String(pagina),
      "filter[updated_at][from]": String(segundos(ate)),
      "order[updated_at]": "asc",
    });
    let atualizados: (string | null)[];
    if (qual === "negocios") {
      busca.set("with", "contacts");
      const r = await pedir<{ _embedded?: { leads?: NegocioDaKommo[] } }>("/api/v4/leads", { busca });
      const linhas = (r?._embedded?.leads ?? []).map((n) => linhaDoNegocio(n, agora));
      await gravar(db, "kommo_negocios", linhas, "id");
      atualizados = linhas.map((l) => l.atualizado_na_kommo);
    } else {
      const r = await pedir<{ _embedded?: { contacts?: ContatoDaKommo[] } }>("/api/v4/contacts", { busca });
      const linhas = (r?._embedded?.contacts ?? []).map((c) => linhaDoContato(c, agora));
      await gravar(db, "kommo_contatos", linhas, "id");
      atualizados = linhas.map((l) => l.atualizado_na_kommo);
    }
    lidos += atualizados.length;
    const prox = proximoCursor(ate, pagina, atualizados, PAGINA);
    ate = prox.cursor;
    pagina = prox.pagina;
    await salvarEstado(db, qual === "negocios" ? { negocios_ate: ate, negocios_pagina: pagina } : { contatos_ate: ate, contatos_pagina: pagina });
    if (prox.acabou) return { lidos, emDia: true };
  }
  return { lidos, emDia: false };
}

/** A rodada inteira. `prazoMs` é quanto ela pode durar (a função da Vercel tem 60 s). */
export async function rodarLeituraDaKommo(db: SupabaseClient, opcoes: { prazoMs?: number } = {}): Promise<ResultadoDaLeitura> {
  const inicio = Date.now();
  const prazo = inicio + (opcoes.prazoMs ?? 45_000);
  const chave = (await lerChaves(db)).kommo;
  const vazio = { negocios: 0, contatos: 0, eventos: 0, pendentes: 0, apagados: 0, cargaEmAndamento: false };
  if (!chave) return { estado: "sem_chave", ...vazio, detalhe: "sem chave da Kommo" };

  const pedir = clienteDaKommo(chave);
  const agora = new Date(inicio).toISOString();
  const lidoDesde = new Date(inicio - 60_000).toISOString();

  const { data: e, error } = await db
    .from("kommo_estado")
    .select("eventos_ate, carga_desde, carga_concluida_em, negocios_ate, negocios_pagina, contatos_ate, contatos_pagina")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new Error(`kommo_estado: ${error.message}`);
  const estado: Estado = (e as Estado | null) ?? { eventos_ate: null, carga_desde: null, carga_concluida_em: null, negocios_ate: null, negocios_pagina: 1, contatos_ate: null, contatos_pagina: 1 };

  // Primeira rodada: a carga começa 90 dias atrás, e os eventos começam agora (a carga já traz o estado de hoje).
  if (!estado.negocios_ate || !estado.contatos_ate) {
    const desde = new Date(inicio - DIAS_DA_CARGA * 24 * 60 * 60_000).toISOString();
    estado.negocios_ate = estado.negocios_ate ?? desde;
    estado.contatos_ate = estado.contatos_ate ?? desde;
    estado.eventos_ate = estado.eventos_ate ?? agora;
    estado.carga_desde = estado.carga_desde ?? agora;
    await salvarEstado(db, {
      negocios_ate: estado.negocios_ate,
      contatos_ate: estado.contatos_ate,
      eventos_ate: estado.eventos_ate,
      carga_desde: estado.carga_desde,
      negocios_pagina: 1,
      contatos_pagina: 1,
    });
  }

  await lerUsuariosEFunis(db, pedir, agora);
  const p = await processarPendentes(db, pedir, agora);
  const ev = await lerEventos(db, pedir, estado, prazo);
  // Negócios ficam com dois terços do tempo que sobrar; contatos, com o resto.
  const sobra = Math.max(0, prazo - Date.now());
  const ng = await lerAlterados(db, pedir, "negocios", { ate: estado.negocios_ate, pagina: estado.negocios_pagina }, Date.now() + (sobra * 2) / 3);
  const ct = await lerAlterados(db, pedir, "contatos", { ate: estado.contatos_ate, pagina: estado.contatos_pagina }, prazo);

  await db.rpc("kommo_marcar_mensagens", { p_desde: lidoDesde });

  const emDia = ng.emDia && ct.emDia && ev.emDia;
  const cargaEmAndamento = !estado.carga_concluida_em && !(ng.emDia && ct.emDia);
  const resultado: ResultadoDaLeitura = {
    estado: emDia ? "ok" : "parcial",
    negocios: ng.lidos + p.negocios,
    contatos: ct.lidos + p.contatos,
    eventos: ev.lidos,
    pendentes: p.pendentes,
    apagados: p.apagados + ev.apagados,
    cargaEmAndamento,
    detalhe: "",
  };
  resultado.detalhe = `${resultado.negocios} negócios, ${resultado.contatos} contatos, ${resultado.eventos} eventos, ${resultado.pendentes} avisos do webhook${cargaEmAndamento ? " (carga inicial em andamento)" : emDia ? "" : " (ficou para a próxima rodada)"}`;

  await salvarEstado(db, {
    ultima_leitura_em: new Date().toISOString(),
    ultima_leitura: { ...resultado, segundos: Math.round((Date.now() - inicio) / 1000) },
    ...(!estado.carga_concluida_em && ng.emDia && ct.emDia ? { carga_concluida_em: new Date().toISOString() } : {}),
  });
  return resultado;
}
