import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "@/lib/auth/session";
import { ehAdmin } from "@/lib/auth/acessos";
import { lerLojasFisicas, lerOportunidades } from "@/lib/clientes/dados";
import { DIAS_DO_AVISO, NOME_DO_TIPO, prazoEmPalavra, separarParaOAviso, tomDoPrazo } from "@/lib/clientes/oportunidades";
import { lerFilaDaFabrica } from "@/lib/fabrica/dados";
import { NOME_DA_ETAPA, diasEntreDatas, tomDaEspera } from "@/lib/fabrica/etapas";
import { PRAZOS_DA_KOMMO, tomDaEsperaNaKommo, type AlertasDaKommo } from "@/lib/kommo/funil";
import { MOTIVOS, lerListaDaKommo } from "@/lib/kommo/vendas";
import { lerMeuMesNoServidor } from "@/lib/pedidos/dados";
import { sinaisDaSaude } from "@/lib/painel/saude";
import { lerSaude } from "@/lib/painel/saude-dados";
import { esperaDoCaso } from "@/lib/suporte/casos";
import { lerResumoDoSuporteNoServidor } from "@/lib/suporte/dados";
import { esperaDoPedido } from "@/lib/time/chat";
import { lerResumoDoChat } from "@/lib/time/dados";
import { lerFilaDeRecuperacao } from "@/lib/vendas/recuperacao";
import { hojeEmSaoPaulo } from "@/lib/vendas/periodo";
import type { EntradaDoHoje, Espera, NegocioMeu } from "./hoje";

/**
 * As leituras da tela Hoje. Cada fonte é a MESMA função que a tela de origem
 * usa, chamada em paralelo e só quando a pessoa tem a área; o banco confere de
 * novo por dentro. A cor de cada item sai da régua da fonte, aqui, para a conta
 * pura (`hoje.ts`) só juntar e ordenar.
 *
 * Leitura que falhou volta `null`, e a fonte some da lista: nunca vira zero.
 */

const minutosDesde = (quando: string | null, agora: number): number | null => {
  if (!quando) return null;
  const t = Date.parse(quando);
  return Number.isFinite(t) ? Math.max(0, Math.floor((agora - t) / 60_000)) : null;
};

/** Dia `AAAA-MM-DD` contado do meio-dia de São Paulo, para ordenar junto dos relógios. */
const minutosDoDia = (dia: string | null, agora: number) => (dia ? minutosDesde(`${dia}T12:00:00-03:00`, agora) : null);

async function kommoMeus(db: SupabaseClient, agora: number): Promise<EntradaDoHoje["kommoMeus"]> {
  const { data, error } = await db.rpc("kommo_meus_negocios", { p_atencao_min: PRAZOS_DA_KOMMO.atencao, p_limite: 10 });
  if (error) {
    console.error("[hoje] kommo_meus_negocios:", error.message);
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const negocios: NegocioMeu[] = (Array.isArray(d.negocios) ? d.negocios : []).map((x) => {
    const n = (x ?? {}) as Record<string, unknown>;
    const minutos = minutosDesde(typeof n.desde === "string" ? n.desde : null, agora);
    return {
      id: Number(n.id),
      nome: typeof n.nome === "string" ? n.nome : null,
      cliente: typeof n.cliente === "string" ? n.cliente : null,
      motivo: n.motivo === "sem_resposta" ? "sem_resposta" : "esperando_vendedor",
      link: String(n.link ?? ""),
      minutos,
      tom: tomDaEsperaNaKommo(minutos),
    };
  });
  return {
    lidoEm: typeof d.lido_em === "string" ? d.lido_em : null,
    mapeado: d.mapeado === true,
    totais: { sem_resposta: Number(d.sem_resposta ?? 0), esperando_vendedor: Number(d.esperando_vendedor ?? 0) },
    negocios,
  };
}

async function kommoTime(db: SupabaseClient): Promise<EntradaDoHoje["kommoTime"]> {
  const { data, error } = await db.rpc("kommo_alertas", { p_atencao_min: PRAZOS_DA_KOMMO.atencao, p_ruim_min: PRAZOS_DA_KOMMO.ruim });
  if (error || !data) {
    if (error) console.error("[hoje] kommo_alertas:", error.message);
    return null;
  }
  const a = data as AlertasDaKommo;
  // A mesma régua dos sinais da Kommo na Visão geral: passou do prazo de atraso é ruim, senão atenção.
  const caso = (x: AlertasDaKommo["esperando"]) => ({ atencao: x.atencao, ruim: x.ruim, tom: x.ruim > 0 ? ("ruim" as const) : ("atencao" as const), minutos: x.mais_antigo_min });
  return { lidoEm: a.lido_em, esperando: caso(a.esperando), semResposta: caso(a.sem_resposta) };
}

async function vendasDaKommo(db: SupabaseClient, eu: string, agora: number): Promise<EntradaDoHoje["vendasDaKommo"]> {
  // A fila de conferência não depende do período; o dia de hoje só deixa a parte das vendas feitas pequena.
  const hoje = hojeEmSaoPaulo();
  const { data, error } = await db.rpc("kommo_vendas_lista", { p_de: hoje, p_ate: hoje });
  if (error) {
    console.error("[hoje] kommo_vendas_lista:", error.message);
    return null;
  }
  const l = lerListaDaKommo(data);
  if (!l) return null;
  return {
    eu,
    resolve: l.pode.resolver,
    fila: l.fila.map((f) => ({
      negocioId: f.negocio_id,
      quem: f.cliente ?? f.negocio,
      vendedorId: f.vendedor_id,
      motivo: MOTIVOS[f.motivo] ?? "Para conferir",
      link: f.link,
      minutos: minutosDoDia(f.dia, agora),
    })),
  };
}

export async function lerHoje(db: SupabaseClient, profile: Profile): Promise<EntradaDoHoje> {
  const pode = (area: Profile["areas"][number]) => profile.areas.includes(area);
  const agora = Date.now();
  const hoje = hojeEmSaoPaulo();
  const vende = pode("lancar_venda");
  const diretoria = ehAdmin(profile.role);

  const [meus, time, kv, meuMes, oport, suporte, chat, fila, recup, saude] = await Promise.all([
    vende || pode("vendas") || diretoria ? kommoMeus(db, agora) : null,
    pode("vendas") ? kommoTime(db) : null,
    vende ? vendasDaKommo(db, profile.id, agora) : null,
    vende ? lerMeuMesNoServidor(db) : null,
    vende ? lerLojasFisicas().then((lojas) => lerOportunidades(db, hoje, DIAS_DO_AVISO, lojas)) : null,
    vende || pode("suporte") ? lerResumoDoSuporteNoServidor(db) : null,
    pode("time") ? lerResumoDoChat(db) : null,
    pode("fabrica") ? lerFilaDaFabrica(db, 15) : null,
    pode("recuperacao") ? lerFilaDeRecuperacao(db, 14) : null,
    diretoria ? lerSaude(db) : null,
  ]);

  const espera = (e: { tom: Espera["tom"]; minutos: number }): Espera => ({ tom: e.tom, minutos: e.minutos });

  let oportunidades: EntradaDoHoje["oportunidades"] = null;
  if (oport) {
    const { daSemana, atrasadas } = separarParaOAviso(oport.lista);
    oportunidades = {
      daSemana: daSemana.map((o) => ({ cliente: o.cliente, tipo: NOME_DO_TIPO[o.tipo], quando: prazoEmPalavra(o.emDias), tom: tomDoPrazo(o.emDias), minutos: null })),
      atrasadas,
      tomAtrasadas: tomDoPrazo(-1),
    };
  }

  return {
    kommoMeus: meus,
    kommoTime: time,
    vendasDaKommo: kv,
    pedidosSemVendedor: meuMes ? meuMes.semVendedor30d : null,
    oportunidades,
    suporte: suporte
      ? {
          fila: suporte.fila,
          esperaDaFila: suporte.filaDesde
            ? espera(esperaDoCaso({ estado: "na_fila", abertoEm: suporte.filaDesde, assumidoEm: null, assumidoPorNome: null, fechadoPorNome: null }, agora))
            : null,
          comigo: suporte.comigo,
          esperaComigo: suporte.comigoDesde
            ? espera(esperaDoCaso({ estado: "com_suporte", abertoEm: suporte.comigoDesde, assumidoEm: suporte.comigoDesde, assumidoPorNome: null, fechadoPorNome: null }, agora))
            : null,
          novidades: suporte.novidades,
        }
      : null,
    chat: chat
      ? {
          novas: chat.novas,
          pedidosDoSetor: chat.pedidosDoSetor,
          esperaDoPedido: (() => {
            if (chat.pedidosDoSetor === 0 || !chat.desde) return null;
            const e = esperaDoPedido({ pede: true, atendidaEm: null, atendidaPorNome: null, esperandoDesde: chat.desde, apagada: false, em: chat.desde }, agora);
            return e ? espera(e) : null;
          })(),
        }
      : null,
    fabrica: fila
      ? {
          atrasados: fila.pedidos
            .map((p) => {
              const dias = diasEntreDatas(p.dia, hoje);
              return { ref: p.ref, cliente: p.cliente, etapa: NOME_DA_ETAPA[p.etapa], tom: tomDaEspera(dias, p.etapa), minutos: dias * 1440 };
            })
            .filter((p) => p.tom !== "neutro"),
        }
      : null,
    recuperacao: recup ? { clientes: recup.resumo.a_recuperar?.clientes ?? 0 } : null,
    // A MESMA conta dos avisos da Visão geral: ligação quebrada é problema, destinos sem chave viram um aviso só.
    saude: saude
      ? sinaisDaSaude(saude).map((x) => ({
          chave: x.chave,
          tom: x.gravidade === "problema" ? ("ruim" as const) : ("atencao" as const),
          titulo: x.titulo,
          texto: x.texto,
          href: x.link?.href ?? "/admin/saude",
          rotulo: x.link?.rotulo ?? "Ver a saúde",
        }))
      : null,
  };
}
