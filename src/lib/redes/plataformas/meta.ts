import "server-only";
import { ErroDaRede, type ContaLigada } from "../tipos";
import { erroDaMeta, permissoesDoToken } from "./meta-forma";

/**
 * O que o Instagram e a Página do Facebook têm em comum: a Graph API e o token.
 *
 * COMO A JK LIGA. Por um token de USUÁRIO DO SISTEMA do portfólio empresarial,
 * colado em Integrações. É o caminho que já funciona para o gasto de anúncio,
 * não depende de login de pessoa (que vence e sai quando a pessoa sai da
 * empresa) e não pede aplicativo novo. Um token só alcança a Página e o
 * Instagram ligado a ela.
 *
 * NÃO é o token do gasto de anúncio (`meta_ads`): aquele só lê gasto e
 * continua só lendo gasto. Este é outro token, de preferência de outro usuário
 * do sistema, guardado no cofre das redes.
 *
 * Por que não o "Instagram Login" do auto-agenciasetup (graph.instagram.com):
 * a Meta não deixa mais aplicativo novo configurar esse login. Tudo aqui passa
 * por graph.facebook.com, com as permissões `instagram_*` e `pages_*`.
 *
 * Com acesso padrão (sem análise do aplicativo), nas contas do próprio negócio,
 * a documentação libera publicar, ler métricas e ler e responder comentário
 * por consulta. Direct de cliente e aviso em tempo real pedem a análise.
 */

export const VERSAO = "v27.0";
export const GRAPH = `https://graph.facebook.com/${VERSAO}`;

/** As permissões que o painel usa, e para quê. É a lista que a tela de ligações mostra para marcar ao gerar o token. */
export const PERMISSOES_DA_META = {
  base: ["pages_show_list", "pages_read_engagement", "business_management"],
  metricas: ["read_insights", "instagram_basic", "instagram_manage_insights"],
  publicar: ["pages_manage_posts", "instagram_content_publish"],
  comentarios: ["pages_read_user_content", "pages_manage_engagement", "instagram_manage_comments"],
  mensagens: ["pages_messaging", "instagram_manage_messages"],
} as const;

type Json = Record<string, unknown>;

function erro(corpo: unknown, status: number, onde: string): ErroDaRede {
  const e = erroDaMeta(corpo, status, onde);
  return new ErroDaRede(e.mensagem, { tokenMorto: e.tokenMorto, parar: e.parar, definitivo: e.definitivo, codigo: e.codigo });
}

async function lerCorpo(r: Response): Promise<Json> {
  const t = await r.text();
  try {
    return t ? (JSON.parse(t) as Json) : {};
  } catch {
    return { error: { message: t.slice(0, 200) } };
  }
}

/**
 * GET na Graph API. O token vai no cabeçalho, nunca no endereço, para não
 * parar em registro de servidor. `caminho` pode ser um endereço inteiro (a
 * página seguinte que a própria Meta devolve em `paging.next`).
 */
export async function ler(token: string, caminho: string, params: Record<string, string> = {}, onde = "A Meta"): Promise<Json> {
  const url = new URL(caminho.startsWith("http") ? caminho : `${GRAPH}/${caminho.replace(/^\//, "")}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  // A página seguinte vem com o token no endereço: tira, e manda pelo cabeçalho como o resto.
  url.searchParams.delete("access_token");
  const r = await fetch(url, { headers: { authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(20_000) });
  const d = await lerCorpo(r);
  if (!r.ok || d.error) throw erro(d, r.status, onde);
  return d;
}

/** POST de formulário na Graph API. */
export async function enviar(token: string, caminho: string, dados: Record<string, string>, onde = "A Meta", espera = 30_000): Promise<Json> {
  const r = await fetch(`${GRAPH}/${caminho.replace(/^\//, "")}`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(dados),
    cache: "no-store",
    signal: AbortSignal.timeout(espera),
  });
  const d = await lerCorpo(r);
  if (!r.ok || d.error) throw erro(d, r.status, onde);
  return d;
}

export async function apagar(token: string, caminho: string, onde = "A Meta"): Promise<void> {
  const r = await fetch(`${GRAPH}/${caminho.replace(/^\//, "")}`, { method: "DELETE", headers: { authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(20_000) });
  const d = await lerCorpo(r);
  if (!r.ok || d.error) throw erro(d, r.status, onde);
}

/** Todas as páginas de uma lista, até o teto. O teto existe para um erro de paginação não virar laço. */
export async function listar(token: string, caminho: string, params: Record<string, string>, onde: string, paginas = 3): Promise<Json[]> {
  const itens: Json[] = [];
  let proxima: string | null = caminho;
  let primeira = true;
  for (let i = 0; proxima && i < paginas; i++) {
    const d: Json = await ler(token, proxima, primeira ? params : {}, onde);
    primeira = false;
    itens.push(...((d.data ?? []) as Json[]));
    proxima = ((d.paging as Json | undefined)?.next as string | undefined) ?? null;
  }
  return itens;
}

const str = (v: unknown) => (typeof v === "string" ? v : "");

/**
 * As contas que um token alcança: cada Página vira uma conta do Facebook, e o
 * Instagram profissional ligado a ela vira uma conta do Instagram.
 *
 * As duas guardam o token DA PÁGINA, que é o que publica, lê métricas e
 * modera, na Página e no Instagram. Tirado de um token de usuário do sistema,
 * ele não tem data de validade.
 */
export async function contasDoToken(token: string): Promise<ContaLigada[]> {
  // Quais permissões o token tem. `me/permissions` serve para token de pessoa e de usuário do sistema.
  let escopos: string[] = [];
  try {
    escopos = permissoesDoToken(await ler(token, "me/permissions", {}, "A Meta"));
  } catch (e) {
    if (e instanceof ErroDaRede && e.tokenMorto) throw e;
    // Sem a lista de permissões a ligação segue: cada função diz o que falta quando for usada.
  }

  const paginas = await listar(
    token,
    "me/accounts",
    {
      fields: "id,name,username,link,access_token,picture{url},instagram_business_account{id,username,name,profile_picture_url}",
      limit: "50",
    },
    "A Meta",
    4,
  );
  if (!paginas.length) {
    throw new ErroDaRede(
      "O token foi aceito, mas não alcança nenhuma Página. Nas Configurações do negócio, atribua a Página da JK ao usuário do sistema (controle total) e gere o token de novo com pages_show_list marcada.",
      { definitivo: true },
    );
  }

  const contas: ContaLigada[] = [];
  for (const p of paginas) {
    const tokenDaPagina = str(p.access_token);
    const paginaId = str(p.id);
    if (!tokenDaPagina || !paginaId) continue;
    const foto = str(((p.picture as Json | undefined)?.data as Json | undefined)?.url) || null;
    contas.push({
      rede: "facebook",
      contaId: paginaId,
      nome: str(p.name) || null,
      usuario: str(p.username) ? `@${str(p.username)}` : null,
      fotoUrl: foto,
      link: str(p.link) || `https://www.facebook.com/${paginaId}`,
      credenciais: { token: tokenDaPagina, pagina: paginaId },
      escopos,
      expiraEm: null,
    });

    const ig = (p.instagram_business_account ?? null) as Json | null;
    if (ig && str(ig.id)) {
      contas.push({
        rede: "instagram",
        contaId: str(ig.id),
        nome: str(ig.name) || null,
        usuario: str(ig.username) ? `@${str(ig.username)}` : null,
        fotoUrl: str(ig.profile_picture_url) || null,
        link: str(ig.username) ? `https://www.instagram.com/${str(ig.username)}` : null,
        credenciais: { token: tokenDaPagina, usuario: str(ig.id), pagina: paginaId },
        escopos,
        expiraEm: null,
        extra: { pagina: paginaId, pagina_nome: str(p.name) },
      });
    }
  }
  return contas;
}

/** Espera curta entre duas consultas ao estado de um vídeo em preparo. */
export const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
