import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { faixasDoGoogle, type Faixa, type HorarioDoGoogle } from "./horario";
import { tokenDeAcesso } from "./oauth";
import { textoOriginal } from "./publico";

/**
 * As avaliações do Google para quem cuida das lojas: o que está sem resposta,
 * por loja, e o horário que o Google tem de cada uma.
 *
 * As tabelas `google_locais` e `google_avaliacoes` não abrem para ninguém pela
 * chave da sessão (são cache da API, 0048), então a leitura é com a chave de
 * serviço, depois de a página conferir a área.
 *
 * RESPONDER PUBLICA NO GOOGLE, no nome da loja, para qualquer pessoa ler. Por
 * isso `responderNoGoogle` só é chamada por ação de servidor que confere quem
 * é a pessoa, e nunca por rotina: resposta de avaliação tem autor.
 */

const V4 = "https://mybusiness.googleapis.com/v4";

/** O nome de recurso de uma avaliação, como o Google devolve. Conferido antes de montar o endereço. */
export const NOME_DA_AVALIACAO = /^accounts\/[0-9]+\/locations\/[0-9]+\/reviews\/[A-Za-z0-9_-]+$/;

export type AvaliacaoDoPainel = {
  name: string;
  autor: string | null;
  nota: number;
  texto: string;
  criadaEm: string | null;
};

export type LojaDoPainel = {
  /** O nome de recurso da loja no Google (`locations/123`). */
  name: string;
  titulo: string;
  nota: number | null;
  total: number | null;
  /** Quantas avaliações o painel tem desta loja (no máximo as 100 mais recentes). */
  lidas: number;
  semResposta: number;
  baixasSemResposta: number;
  mapa: string | null;
  horarioDoGoogle: Faixa[] | null;
  /** A loja do portal ligada a esta loja do Google, quando o painel conseguiu casar as duas. */
  portal: { id: string; slug: string; nome: string; horario: Faixa[] | null; fonte: string | null } | null;
  /** As que estão sem resposta: nota baixa primeiro, depois as mais recentes. */
  pendentes: AvaliacaoDoPainel[];
};

const texto = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

export async function lerAvaliacoesDoPainel(): Promise<LojaDoPainel[] | null> {
  const db = createAdminClient();
  const [locais, avaliacoes, lojas] = await Promise.all([
    db.from("google_locais").select("name, titulo, nota_media, total_avaliacoes, maps_uri, location_id, horario"),
    db.from("google_avaliacoes").select("name, local, autor, autor_anonimo, nota, comentario, resposta, criada_em").order("criada_em", { ascending: false }).limit(2000),
    db.from("locations").select("id, slug, name, opening_hours, hours_source"),
  ]);
  if (locais.error || avaliacoes.error) {
    console.error("[avaliacoes] leitura:", locais.error?.message ?? avaliacoes.error?.message);
    return null;
  }
  const lojaDoPortal = new Map((lojas.data ?? []).map((l) => [String(l.id), l]));

  return (locais.data ?? [])
    .map((l): LojaDoPainel => {
      const daLoja = (avaliacoes.data ?? []).filter((a) => a.local === l.name);
      const abertas = daLoja.filter((a) => !texto(a.resposta));
      const portal = l.location_id ? lojaDoPortal.get(String(l.location_id)) : undefined;
      return {
        name: String(l.name),
        titulo: texto(l.titulo) ?? "Loja",
        nota: typeof l.nota_media === "number" ? l.nota_media : null,
        total: typeof l.total_avaliacoes === "number" ? l.total_avaliacoes : null,
        lidas: daLoja.length,
        semResposta: abertas.length,
        baixasSemResposta: abertas.filter((a) => Number(a.nota) <= 3).length,
        mapa: texto(l.maps_uri),
        horarioDoGoogle: faixasDoGoogle(l.horario as HorarioDoGoogle | null),
        portal: portal
          ? { id: String(portal.id), slug: String(portal.slug), nome: texto(portal.name) ?? "Loja", horario: Array.isArray(portal.opening_hours) ? (portal.opening_hours as Faixa[]) : null, fonte: texto(portal.hours_source) }
          : null,
        pendentes: abertas
          .map((a) => ({
            name: String(a.name),
            autor: a.autor_anonimo ? null : texto(a.autor),
            nota: Number(a.nota) || 0,
            texto: textoOriginal(String(a.comentario ?? "")),
            criadaEm: texto(a.criada_em),
          }))
          // Nota baixa na frente: é a que mais pesa ficar sem resposta. Dentro de cada grupo, a ordem de data já veio do banco.
          .sort((x, y) => Number(y.nota <= 3) - Number(x.nota <= 3)),
      };
    })
    .sort((a, b) => b.baixasSemResposta - a.baixasSemResposta || b.semResposta - a.semResposta || a.titulo.localeCompare(b.titulo, "pt-BR"));
}

/**
 * Publica a resposta da loja numa avaliação. O Google aceita uma resposta por
 * avaliação: mandar de novo troca a anterior.
 */
export async function responderNoGoogle(name: string, resposta: string): Promise<{ ok: true } | { ok: false; erro: string }> {
  if (!NOME_DA_AVALIACAO.test(name)) return { ok: false, erro: "Avaliação desconhecida." };
  const db = createAdminClient();
  let token: string;
  try {
    token = await tokenDeAcesso(db);
  } catch (e) {
    console.error("[avaliacoes] token:", e);
    return { ok: false, erro: "A ligação com o Google não está ativa. Confira em Integrações." };
  }

  let r: Response;
  try {
    r = await fetch(`${V4}/${name}/reply`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ comment: resposta }),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
  } catch (e) {
    console.error("[avaliacoes] responder:", e);
    return { ok: false, erro: "O Google não respondeu a tempo. A resposta NÃO foi publicada: tente de novo." };
  }
  if (!r.ok) {
    const corpo = await r.text().catch(() => "");
    console.error("[avaliacoes] responder:", r.status, corpo.slice(0, 300));
    const motivo = r.status === 401 || r.status === 403 ? "o Google recusou o acesso (confira a ligação em Integrações)" : r.status === 404 ? "a avaliação não existe mais no Google" : `o Google respondeu ${r.status}`;
    return { ok: false, erro: `A resposta NÃO foi publicada: ${motivo}.` };
  }

  // O cache local passa a dizer que está respondida, sem esperar a leitura de amanhã.
  const { error } = await db.from("google_avaliacoes").update({ resposta }).eq("name", name);
  if (error) console.error("[avaliacoes] gravar a resposta no cache:", error.message);
  return { ok: true };
}

/**
 * Copia o horário que o Google tem para a página da loja no portal, com a
 * fonte escrita. Só quando a loja do Google está ligada a uma loja do portal.
 */
export async function usarHorarioDoGoogle(localName: string, hoje: string): Promise<{ ok: true; slug: string } | { ok: false; erro: string }> {
  if (!/^locations\/[0-9]+$/.test(localName)) return { ok: false, erro: "Loja desconhecida." };
  const db = createAdminClient();
  const { data: local } = await db.from("google_locais").select("titulo, location_id, horario").eq("name", localName).maybeSingle();
  if (!local?.location_id) return { ok: false, erro: "Esta loja do Google não está ligada a uma loja do portal." };
  const faixas = faixasDoGoogle(local.horario as HorarioDoGoogle | null);
  if (!faixas) return { ok: false, erro: "O Google não tem horário cadastrado para esta loja." };

  const { data: loja } = await db.from("locations").select("id, slug, hours_note").eq("id", local.location_id).maybeSingle();
  if (!loja) return { ok: false, erro: "A loja do portal não foi encontrada." };

  const [ano, mes, dia] = hoje.split("-");
  const { error } = await db
    .from("locations")
    .update({
      opening_hours: faixas,
      hours_source: `Perfil da loja no Google (${local.titulo}), lido em ${dia}/${mes}/${ano}`,
      // O mesmo aviso que as lojas com horário vindo do Google já usam. Não troca um aviso que alguém escreveu.
      hours_note: loja.hours_note ?? "Em feriados o horário pode mudar. Confirme pelo telefone antes de ir.",
    })
    .eq("id", loja.id);
  if (error) {
    console.error("[avaliacoes] usar horário:", error.message);
    return { ok: false, erro: "Não deu para gravar o horário agora." };
  }
  return { ok: true, slug: String(loja.slug) };
}
