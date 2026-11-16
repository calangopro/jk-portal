import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { contaDaLinha, credenciaisAtivas, marcarExpirada } from "./contas";
import { modulo } from "./plataformas";
import { pecaPara } from "./posts";
import { nomeDaRede, type Formato } from "./redes";
import { ErroDaRede, type Midia } from "./tipos";

/**
 * A fila das redes: publica os envios que venceram, cada um pelo módulo da sua
 * rede. Roda pelo relógio (`/api/cron/redes-fila`, de minuto em minuto quando
 * há o que fazer) e logo depois de alguém mandar publicar agora.
 *
 * É o ÚNICO lugar do painel que publica em rede social. Só pega envio que uma
 * pessoa liberou (`posts.ts`, `liberarPost`): a fila não decide nada, cumpre.
 *
 * COMO ERRA
 *
 *   - A rede recusou com uma resposta (formato, permissão): erro definitivo,
 *     com o motivo, sem nova tentativa.
 *   - A rede falhou de um jeito que passa (erro 5xx, limite de uso): tenta de
 *     novo em 5, 10 e 15 minutos, e na terceira vira erro.
 *   - A chamada CAIU no meio (tempo esgotado, rede fora) sem resposta: não dá
 *     para saber se o post saiu. Vira erro com o aviso de conferir na rede, e
 *     NÃO tenta de novo sozinha: publicar em dobro na conta da JK é pior do que
 *     deixar de publicar.
 *   - A rede ainda prepara o vídeo: guarda o ponto em que parou e volta em
 *     seguida. Não conta como tentativa.
 *
 * Portado de `worker/plataformas/fila.js` do auto-agenciasetup.
 */

const MAX_TENTATIVAS = 3;

type LinhaDoEnvio = {
  id: string;
  post_id: string;
  conta_id: string;
  rede: string;
  legenda: string | null;
  titulo: string | null;
  tentativas: number;
  processando_desde: string | null;
};

type LinhaDoPost = { id: string; titulo: string | null; legenda: string; formato: Formato; midias: Midia[]; opcoes: Record<string, unknown> | null };

export type ResultadoDoEnvio = { envio: string; rede: string; estado: "publicado" | "processando" | "erro" | "de_novo" };

const agora = () => new Date().toISOString();

async function fechar(db: SupabaseClient, envioId: string, dados: Record<string, unknown>): Promise<void> {
  const { error } = await db.from("redes_envios").update({ ...dados, pego_em: null, atualizado_em: agora() }).eq("id", envioId);
  if (error) console.error("[redes] fila: não gravei o estado do envio", envioId, error.message);
}

async function falhar(db: SupabaseClient, envio: LinhaDoEnvio, motivo: string): Promise<ResultadoDoEnvio> {
  await fechar(db, envio.id, { status: "erro", erro: motivo.slice(0, 400), proxima_tentativa: null });
  await db.from("redes_envios_andamento").delete().eq("envio_id", envio.id);
  return { envio: envio.id, rede: envio.rede, estado: "erro" };
}

async function publicarUm(db: SupabaseClient, envio: LinhaDoEnvio, post: LinhaDoPost | undefined): Promise<ResultadoDoEnvio> {
  const nome = nomeDaRede(envio.rede);
  if (!post) return falhar(db, envio, "O post deste envio não existe mais.");
  const m = modulo(envio.rede);
  if (!m?.publicar) return falhar(db, envio, `${nome} ainda não publica pelo painel.`);

  const { data: linhaDaConta } = await db
    .from("redes_contas")
    .select("id, rede, conta_id, nome, usuario, foto_url, link, escopos, via, status, expira_em, ultimo_erro, extra, conectada_em, lida_em")
    .eq("id", envio.conta_id)
    .maybeSingle();
  if (!linhaDaConta) return falhar(db, envio, `A conta de ${nome} não está mais ligada.`);
  const conta = contaDaLinha(linhaDaConta as Parameters<typeof contaDaLinha>[0]);
  if (conta.status !== "ativa") return falhar(db, envio, `${nome} precisa ser ligado de novo em Integrações antes de publicar.`);

  const peca = pecaPara({ formato: post.formato, legenda: post.legenda, titulo: post.titulo, midias: Array.isArray(post.midias) ? post.midias : [], opcoes: post.opcoes ?? {} }, envio);
  // A peça pode ter esperado dias na fila: confere de novo, com as regras de hoje.
  const problema = m.validar(peca);
  if (problema) return falhar(db, envio, problema);

  const { data: guardado } = await db.from("redes_envios_andamento").select("andamento").eq("envio_id", envio.id).maybeSingle();
  const andamento = (guardado?.andamento ?? null) as Record<string, unknown> | null;

  try {
    const credenciais = await credenciaisAtivas(db, conta, m);
    const passo = await m.publicar({ credenciais, conta, peca, andamento });

    if (passo.estado === "processando") {
      await db.from("redes_envios_andamento").upsert({ envio_id: envio.id, andamento: passo.andamento, atualizado_em: agora() }, { onConflict: "envio_id" });
      await fechar(db, envio.id, {
        status: "processando",
        erro: null,
        processando_desde: envio.processando_desde ?? agora(),
        proxima_tentativa: new Date(Date.now() + Math.max(15, passo.emSegundos ?? 30) * 1000).toISOString(),
      });
      return { envio: envio.id, rede: envio.rede, estado: "processando" };
    }

    await fechar(db, envio.id, {
      status: "publicado",
      id_na_rede: passo.idNaRede,
      url_publicada: passo.url,
      avisos: (passo.avisos ?? []).map((a) => a.slice(0, 300)).slice(0, 5),
      erro: null,
      proxima_tentativa: null,
      publicado_em: agora(),
    });
    await db.from("redes_envios_andamento").delete().eq("envio_id", envio.id);
    // O post entra nos números na hora, ligado ao envio. A leitura seguinte completa curtidas e alcance.
    if (passo.idNaRede) {
      const { error } = await db.from("redes_publicacoes").upsert(
        {
          conta_id: conta.id,
          rede: conta.rede,
          id_na_rede: passo.idNaRede,
          envio_id: envio.id,
          formato: post.formato,
          legenda: (conta.rede === "youtube" ? peca.titulo || peca.legenda : peca.legenda).slice(0, 2400),
          link: passo.url,
          publicado_em: agora(),
          atualizado_em: agora(),
        },
        { onConflict: "conta_id,id_na_rede" },
      );
      if (error) console.error("[redes] fila: publicação não entrou nos números", error.message);
    }
    return { envio: envio.id, rede: envio.rede, estado: "publicado" };
  } catch (e) {
    if (e instanceof ErroDaRede) {
      if (e.tokenMorto) {
        await marcarExpirada(db, conta.id, e.message);
        return falhar(db, envio, `${e.message} O post não saiu.`);
      }
      if (e.definitivo) return falhar(db, envio, e.message);
      const tentativas = envio.tentativas + 1;
      if (tentativas >= MAX_TENTATIVAS) return falhar(db, envio, `${e.message} (depois de ${MAX_TENTATIVAS} tentativas)`);
      await fechar(db, envio.id, { status: "agendado", tentativas, erro: e.message.slice(0, 400), proxima_tentativa: new Date(Date.now() + 5 * 60_000 * tentativas).toISOString() });
      return { envio: envio.id, rede: envio.rede, estado: "de_novo" };
    }
    // Sem resposta da rede: não dá para saber se saiu.
    console.error("[redes] fila:", envio.rede, e);
    return falhar(db, envio, `A ligação com ${nome} caiu no meio da publicação. Confira na rede se o post saiu antes de tentar de novo.`);
  }
}

/**
 * Processa a fila: pega os envios vencidos (de todos os posts, ou de um só) e
 * publica. Envios de redes diferentes rodam ao mesmo tempo; a função de pegar
 * garante que duas rodadas não peguem o mesmo.
 */
export async function processarFila(db: SupabaseClient, opcoes: { limite?: number; postId?: string } = {}): Promise<ResultadoDoEnvio[]> {
  const { data, error } = await db.rpc("redes_pegar_envios", { p_limite: opcoes.limite ?? 4, p_post: opcoes.postId ?? null });
  if (error) throw new Error(`redes_pegar_envios: ${error.message}`);
  const envios = (data ?? []) as LinhaDoEnvio[];
  if (!envios.length) return [];

  const { data: posts } = await db.from("redes_posts").select("id, titulo, legenda, formato, midias, opcoes").in("id", [...new Set(envios.map((e) => e.post_id))]);
  const porId = new Map(((posts ?? []) as LinhaDoPost[]).map((p) => [p.id, p]));
  return Promise.all(envios.map((e) => publicarUm(db, e, porId.get(e.post_id))));
}
