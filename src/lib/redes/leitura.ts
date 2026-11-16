import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { lerComentariosDaConta } from "./comentarios";
import { anotarErro, credenciaisAtivas, listarContas, marcarExpirada } from "./contas";
import { modulo } from "./plataformas";
import { nomeDaRede } from "./redes";
import { ErroDaRede, type Conta, type Credenciais, type ModuloDaRede, type NumerosDoDia, type PublicacaoLida } from "./tipos";

/**
 * A leitura das redes: busca os números de cada conta ligada e grava no banco.
 *
 * É a ÚNICA parte do painel que chama a API de uma rede social para ler. As
 * telas leem do banco. Quem roda isto é a rotina (`/api/cron/redes`), o retorno
 * de uma ligação nova (para a conta não nascer vazia) e o botão "Ler agora".
 *
 * Cada conta é independente: uma que falha (token vencido, limite de uso) não
 * derruba as outras, e o motivo fica na própria conta, que é onde a tela de
 * ligações mostra.
 */

/** O dia de hoje em São Paulo, AAAA-MM-DD. */
export function hojeEmSP(agora = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(agora);
}

export function somarDias(dia: string, n: number): string {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export type ResultadoDaConta = {
  contaId: string;
  rede: string;
  nome: string;
  estado: "ok" | "parcial" | "expirada" | "erro";
  dias: number;
  publicacoes: number;
  metricas: number;
  mensagem: string | null;
};

export type OpcoesDaLeitura = {
  /** Quantos dias para trás regravar. As redes corrigem os dias recentes. */
  dias?: number;
  /** Páginas de publicações por conta. Uma basta na rotina; a primeira leitura pede mais. */
  paginas?: number;
  /** Quantas publicações ganham métricas novas por conta nesta rodada. */
  metricas?: number;
  /** Só esta conta (retorno de ligação, "Ler agora" de uma conta). */
  contaId?: string;
  /** Primeira leitura de uma conta recém-ligada: busca a história que o módulo da rede aguenta (`historico`). */
  primeira?: boolean;
  /** Milissegundos que a rodada pode gastar. A função da Vercel tem teto. */
  prazoMs?: number;
};

const linhaDoDia = (contaId: string, d: NumerosDoDia) => {
  // Só entra a coluna que a rede informou: assim uma leitura que traz o alcance
  // não apaga o total de seguidores gravado por outra chamada no mesmo dia.
  const linha: Record<string, unknown> = { conta_id: contaId, dia: d.dia, lido_em: new Date().toISOString() };
  const por: [keyof NumerosDoDia, string][] = [
    ["seguidores", "seguidores"],
    ["publicacoes", "publicacoes"],
    ["alcance", "alcance"],
    ["visualizacoes", "visualizacoes"],
    ["interacoes", "interacoes"],
    ["visitasAoPerfil", "visitas_ao_perfil"],
    ["cliquesNoLink", "cliques_no_link"],
    ["novosSeguidores", "novos_seguidores"],
  ];
  for (const [de, para] of por) if (d[de] !== undefined) linha[para] = d[de];
  if (d.extra && Object.keys(d.extra).length) linha.extra = d.extra;
  return linha;
};

const linhaDaPublicacao = (conta: Conta, p: PublicacaoLida) => {
  const linha: Record<string, unknown> = {
    conta_id: conta.id,
    rede: conta.rede,
    id_na_rede: p.idNaRede,
    formato: p.formato,
    legenda: (p.legenda ?? "").slice(0, 2400),
    link: p.link?.slice(0, 600) ?? null,
    miniatura_url: p.miniaturaUrl?.slice(0, 1600) ?? null,
    publicado_em: p.publicadoEm,
    curtidas: p.curtidas,
    comentarios: p.comentarios,
    atualizado_em: new Date().toISOString(),
  };
  if (p.visualizacoes !== undefined) linha.visualizacoes = p.visualizacoes;
  if (p.alcance !== undefined) linha.alcance = p.alcance;
  if (p.salvos !== undefined) linha.salvos = p.salvos;
  if (p.compartilhamentos !== undefined) linha.compartilhamentos = p.compartilhamentos;
  if (p.extra && Object.keys(p.extra).length) linha.extra = p.extra;
  return linha;
};

/** Grava em lotes: uma coluna a mais numa linha não pode cair fora do upsert das outras. */
async function gravarDias(db: SupabaseClient, contaId: string, dias: NumerosDoDia[]): Promise<void> {
  // O PostgREST exige as mesmas chaves em todas as linhas de um lote: agrupa por conjunto de colunas.
  const grupos = new Map<string, Record<string, unknown>[]>();
  for (const d of dias) {
    const linha = linhaDoDia(contaId, d);
    const chave = Object.keys(linha).sort().join(",");
    grupos.set(chave, [...(grupos.get(chave) ?? []), linha]);
  }
  for (const linhas of grupos.values()) {
    const { error } = await db.from("redes_contas_dia").upsert(linhas, { onConflict: "conta_id,dia" });
    if (error) throw new Error(`gravar dias: ${error.message}`);
  }
}

async function gravarPublicacoes(db: SupabaseClient, conta: Conta, itens: PublicacaoLida[]): Promise<void> {
  const grupos = new Map<string, Record<string, unknown>[]>();
  for (const p of itens) {
    const linha = linhaDaPublicacao(conta, p);
    const chave = Object.keys(linha).sort().join(",");
    grupos.set(chave, [...(grupos.get(chave) ?? []), linha]);
  }
  for (const linhas of grupos.values()) {
    const { error } = await db.from("redes_publicacoes").upsert(linhas, { onConflict: "conta_id,id_na_rede" });
    if (error) throw new Error(`gravar publicações: ${error.message}`);
  }
}

/** Publicação recente muda rápido; antiga, quase nada. Só a recente ganha leitura de métrica. */
const DIAS_COM_METRICA = 45;

async function lerMetricasPendentes(
  db: SupabaseClient,
  conta: Conta,
  m: ModuloDaRede,
  credenciais: Credenciais,
  quantas: number,
  ate: number,
): Promise<number> {
  if (!m.lerMetricas || quantas <= 0) return 0;
  const desde = new Date(Date.now() - DIAS_COM_METRICA * 86_400_000).toISOString();
  // A que nunca foi lida primeiro, depois a lida há mais tempo.
  const { data } = await db
    .from("redes_publicacoes")
    .select("id, id_na_rede, formato")
    .eq("conta_id", conta.id)
    .gt("publicado_em", desde)
    .order("metricas_em", { ascending: true, nullsFirst: true })
    .limit(quantas);
  let lidas = 0;
  for (const p of (data ?? []) as { id: string; id_na_rede: string; formato: string | null }[]) {
    if (Date.now() > ate) break;
    try {
      const r = await m.lerMetricas({ credenciais, conta, publicacao: { idNaRede: p.id_na_rede, formato: p.formato } });
      const linha: Record<string, unknown> = {
        alcance: r.alcance,
        visualizacoes: r.visualizacoes,
        salvos: r.salvos,
        compartilhamentos: r.compartilhamentos,
        metricas_em: new Date().toISOString(),
        atualizado_em: new Date().toISOString(),
      };
      if (r.curtidas !== undefined) linha.curtidas = r.curtidas;
      if (r.comentarios !== undefined) linha.comentarios = r.comentarios;
      if (r.extra && Object.keys(r.extra).length) linha.extra = r.extra;
      await db.from("redes_publicacoes").update(linha).eq("id", p.id);
      lidas++;
    } catch (e) {
      // Token morto ou limite de uso valem para a conta inteira: sobem. O resto é desta publicação
      // (post apagado, tipo sem métrica): marca como lida para não ficar na frente da fila para sempre.
      if (e instanceof ErroDaRede && (e.tokenMorto || e.parar)) throw e;
      await db.from("redes_publicacoes").update({ metricas_em: new Date().toISOString() }).eq("id", p.id);
    }
  }
  return lidas;
}

async function lerUmaConta(db: SupabaseClient, conta: Conta, o: Required<Omit<OpcoesDaLeitura, "contaId">>, ate: number): Promise<ResultadoDaConta> {
  const base = { contaId: conta.id, rede: conta.rede, nome: conta.usuario || conta.nome || nomeDaRede(conta.rede) };
  const m = modulo(conta.rede);
  if (!m) return { ...base, estado: "erro", dias: 0, publicacoes: 0, metricas: 0, mensagem: `${nomeDaRede(conta.rede)} ainda não tem leitura no painel.` };

  const hoje = hojeEmSP();
  let dias = 0;
  let publicacoes = 0;
  let metricas = 0;
  const avisos: string[] = [];

  try {
    const credenciais = await credenciaisAtivas(db, conta, m);

    // Cada pedaço falha sozinho: sem a permissão de métricas ainda dá para ler seguidores e posts.
    const tentar = async (nome: string, f: () => Promise<void>) => {
      try {
        await f();
      } catch (e) {
        if (e instanceof ErroDaRede && (e.tokenMorto || e.parar)) throw e;
        avisos.push(`${nome}: ${e instanceof Error ? e.message : String(e)}`.slice(0, 160));
      }
    };

    if (m.lerConta) {
      await tentar("conta", async () => {
        const c = await m.lerConta!({ credenciais, conta });
        await gravarDias(db, conta.id, [{ dia: hoje, seguidores: c.seguidores, publicacoes: c.publicacoes }]);
        const perfil: Record<string, unknown> = {};
        if (c.nome) perfil.nome = c.nome.slice(0, 160);
        if (c.usuario) perfil.usuario = c.usuario.slice(0, 160);
        if (c.fotoUrl) perfil.foto_url = c.fotoUrl.slice(0, 1200);
        if (Object.keys(perfil).length) await db.from("redes_contas").update(perfil).eq("id", conta.id);
      });
    }

    if (m.lerDias) {
      await tentar("números por dia", async () => {
        const pedir = o.primeira ? Math.max(o.dias, m.historico ?? o.dias) : o.dias;
        const lidos = await m.lerDias!({ credenciais, conta, de: somarDias(hoje, -(pedir - 1)), ate: hoje });
        if (lidos.length) await gravarDias(db, conta.id, lidos);
        dias = lidos.length;
      });
    }

    if (m.lerPublicacoes) {
      await tentar("publicações", async () => {
        let depois: string | null = null;
        for (let pagina = 0; pagina < o.paginas && Date.now() < ate; pagina++) {
          const r = await m.lerPublicacoes!({ credenciais, conta, limite: 50, depois });
          if (r.itens.length) await gravarPublicacoes(db, conta, r.itens);
          publicacoes += r.itens.length;
          depois = r.depois;
          if (!depois) break;
        }
      });
    }

    await tentar("métricas dos posts", async () => {
      metricas = await lerMetricasPendentes(db, conta, m, credenciais, o.metricas, ate);
    });

    // Por último, porque é o que mais gasta chamada: se o tempo da rodada acabar, fica para a seguinte.
    await tentar("comentários", async () => {
      await lerComentariosDaConta(db, conta, m, credenciais, ate);
    });

    await db
      .from("redes_contas")
      .update({ lida_em: new Date().toISOString(), ultimo_erro: avisos.length ? avisos.join(" | ").slice(0, 300) : null, atualizado_em: new Date().toISOString() })
      .eq("id", conta.id);
    return { ...base, estado: avisos.length ? "parcial" : "ok", dias, publicacoes, metricas, mensagem: avisos.length ? avisos.join(" | ") : null };
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : String(e);
    if (e instanceof ErroDaRede && e.tokenMorto) {
      await marcarExpirada(db, conta.id, mensagem);
      return { ...base, estado: "expirada", dias, publicacoes, metricas, mensagem };
    }
    if (!(e instanceof ErroDaRede)) console.error("[redes] leitura", conta.rede, e);
    await anotarErro(db, conta.id, mensagem);
    return { ...base, estado: "erro", dias, publicacoes, metricas, mensagem };
  }
}

/**
 * Lê todas as contas ativas (ou uma só). As contas rodam ao mesmo tempo: cada
 * uma fala com um servidor diferente, e em fila a rodada não caberia no teto
 * de tempo da função.
 */
export async function lerRedes(db: SupabaseClient, opcoes: OpcoesDaLeitura = {}): Promise<ResultadoDaConta[]> {
  const o = { dias: opcoes.dias ?? 7, paginas: opcoes.paginas ?? 1, metricas: opcoes.metricas ?? 20, prazoMs: opcoes.prazoMs ?? 45_000, primeira: opcoes.primeira ?? false };
  const ate = Date.now() + o.prazoMs;
  let contas = await listarContas(db, { soAtivas: true });
  if (opcoes.contaId) contas = contas.filter((c) => c.id === opcoes.contaId);
  const resultados = await Promise.all(contas.map((c) => lerUmaConta(db, c, o, ate)));
  // Comentário não é arquivo: o que passou de 90 dias sai. Falhar aqui não derruba a leitura.
  if (!opcoes.contaId) {
    const { error } = await db.rpc("redes_limpar_comentarios");
    if (error) console.error("[redes] limpar comentários:", error.message);
  }
  return resultados;
}
