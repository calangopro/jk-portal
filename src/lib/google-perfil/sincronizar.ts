import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { PROVEDOR_CONTA, tokenDeAcesso, type UltimaSincronizacao } from "./oauth";

/**
 * Lê do Google as lojas e as avaliações do Perfil da Empresa e regrava o cache
 * (`google_locais` e `google_avaliacoes`, migration 0048).
 *
 * Três APIs, porque o Google dividiu o antigo "Meu Negócio":
 *   - Account Management v1: as contas que a jkaliancasmkt administra;
 *   - Business Information v1: os locais de cada conta;
 *   - My Business v4: as avaliações. É a única que tem avaliação, e só abre
 *     para projeto aprovado (o jk-portal foi em 09/11/2026), com cota de 300
 *     pedidos por minuto, muito acima das oito lojas.
 *
 * Tudo gravado nesta rodada leva a MESMA marca `sincronizado_em`, e no fim
 * sai o que ficou com marca anterior: avaliação apagada no Google some daqui
 * também. Se a rodada falhar no meio, nada é apagado, e a limpeza diária do
 * banco cuida do teto de 25 dias (política da API, ver a migration).
 *
 * O conteúdo vai como o Google entregou: texto, nome e nota sem edição, e a
 * média e o total de cada loja são os do Google (`averageRating` e
 * `totalReviewCount`), nunca uma conta feita aqui.
 */

const CONTAS = "https://mybusinessaccountmanagement.googleapis.com/v1/accounts";
const INFORMACOES = "https://mybusinessbusinessinformation.googleapis.com/v1";
const V4 = "https://mybusiness.googleapis.com/v4";

const ESTRELAS: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };

/**
 * Só as 100 avaliações mais recentes de cada loja (2 páginas de 50).
 *
 * A primeira versão lia TODAS, uma página por vez, e a função da Vercel
 * morria no meio (60 s): Guarulhos sozinha tem 3,5 mil avaliações. A vitrine
 * só mostra as recentes, e a política da API pede guardar "quantidade
 * limitada" do conteúdo. A nota e o total continuam sendo os do Google, de
 * todas as avaliações, porque vêm na primeira página.
 */
const PAGINAS_POR_LOJA = 2;

/** Lojas lidas ao mesmo tempo. Oito lojas, quatro por vez, longe da cota de 300 por minuto. */
const LOJAS_EM_PARALELO = 4;

type Conta = { name: string };
type Endereco = {
  addressLines?: string[];
  sublocality?: string;
  locality?: string;
  administrativeArea?: string;
};
type Local = {
  name: string;
  title?: string;
  storefrontAddress?: Endereco;
  metadata?: { mapsUri?: string; newReviewUri?: string; placeId?: string };
  /** O horário de funcionamento, como o Google guarda (0076). */
  regularHours?: unknown;
};
type Avaliacao = {
  name: string;
  reviewer?: { displayName?: string; isAnonymous?: boolean; profilePhotoUrl?: string };
  starRating?: string;
  comment?: string;
  createTime?: string;
  updateTime?: string;
  reviewReply?: { comment?: string };
};
type PaginaDeAvaliacoes = {
  reviews?: Avaliacao[];
  averageRating?: number;
  totalReviewCount?: number;
  nextPageToken?: string;
};

async function pedir<T>(url: string, token: string): Promise<T> {
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) {
    const corpo = await r.text().catch(() => "");
    throw new Error(`O Google respondeu ${r.status} em ${new URL(url).pathname}: ${corpo.slice(0, 240)}`);
  }
  return (await r.json()) as T;
}

/** Junta as páginas de uma listagem do Google (`pageToken` / `nextPageToken`). */
async function listarTudo<T>(url: string, campo: string, token: string): Promise<T[]> {
  const itens: T[] = [];
  let pagina: string | undefined;
  for (let i = 0; i < 20; i++) {
    const u = new URL(url);
    if (pagina) u.searchParams.set("pageToken", pagina);
    const r = await pedir<Record<string, unknown>>(u.toString(), token);
    itens.push(...((r[campo] as T[] | undefined) ?? []));
    pagina = r.nextPageToken as string | undefined;
    if (!pagina) break;
  }
  return itens;
}

/** `cid` do link do Maps que o Google devolve (`...maps?cid=123`). */
function cidDoMaps(uri?: string): string | null {
  const m = uri?.match(/[?&]cid=(\d+)/);
  return m ? m[1] : null;
}

/** `cid` do identificador gravado na loja do portal (`0x...:0x<cid em hexadecimal>`). */
function cidDoPortal(gbp: string | null): string | null {
  const m = gbp?.match(/:0x([0-9a-f]+)$/i);
  if (!m) return null;
  try {
    return BigInt(`0x${m[1]}`).toString();
  } catch {
    return null;
  }
}

function enderecoEmTexto(e?: Endereco): string | null {
  if (!e) return null;
  const partes = [...(e.addressLines ?? []), e.sublocality, e.locality, e.administrativeArea].filter(
    (p): p is string => Boolean(p && p.trim()),
  );
  return partes.length ? partes.join(", ") : null;
}

export async function sincronizarAvaliacoes(): Promise<UltimaSincronizacao> {
  const supabase = createAdminClient();
  const marca = new Date().toISOString();
  let resultado: UltimaSincronizacao;

  try {
    const token = await tokenDeAcesso(supabase);

    const { data: lojasDoPortal } = await supabase.from("locations").select("id, gbp_place_id");
    const lojaPorCid = new Map<string, string>();
    for (const l of (lojasDoPortal ?? []) as { id: string; gbp_place_id: string | null }[]) {
      const cid = cidDoPortal(l.gbp_place_id);
      if (cid) lojaPorCid.set(cid, l.id);
    }

    const contas = await listarTudo<Conta>(`${CONTAS}?pageSize=20`, "accounts", token);

    // Todas as lojas de todas as contas, cada uma uma vez só: a mesma loja
    // aparece na conta pessoal e no grupo de locais.
    const fila: { conta: string; local: Local }[] = [];
    const vistos = new Set<string>();
    for (const conta of contas) {
      const locais = await listarTudo<Local>(
        `${INFORMACOES}/${conta.name}/locations?readMask=name,title,storefrontAddress,metadata,regularHours&pageSize=100`,
        "locations",
        token,
      );
      for (const local of locais) {
        if (vistos.has(local.name)) continue;
        vistos.add(local.name);
        fila.push({ conta: conta.name, local });
      }
    }

    async function lerLoja({ conta, local }: { conta: string; local: Local }) {
      const linhas: Record<string, unknown>[] = [];
      let nota: number | null = null;
      let total: number | null = null;
      let pagina: string | undefined;

      for (let i = 0; i < PAGINAS_POR_LOJA; i++) {
        const u = new URL(`${V4}/${conta}/${local.name}/reviews`);
        u.searchParams.set("pageSize", "50");
        u.searchParams.set("orderBy", "updateTime desc");
        if (pagina) u.searchParams.set("pageToken", pagina);
        const r = await pedir<PaginaDeAvaliacoes>(u.toString(), token);

        if (i === 0) {
          nota = typeof r.averageRating === "number" ? r.averageRating : null;
          total = typeof r.totalReviewCount === "number" ? r.totalReviewCount : null;
        }
        for (const a of r.reviews ?? []) {
          const estrelas = ESTRELAS[a.starRating ?? ""];
          if (!estrelas) continue;
          linhas.push({
            name: a.name,
            local: local.name,
            autor: a.reviewer?.displayName ?? null,
            autor_anonimo: Boolean(a.reviewer?.isAnonymous),
            autor_foto: a.reviewer?.isAnonymous ? null : (a.reviewer?.profilePhotoUrl ?? null),
            nota: estrelas,
            comentario: a.comment?.trim() ? a.comment : null,
            resposta: a.reviewReply?.comment ?? null,
            criada_em: a.createTime ?? null,
            atualizada_em: a.updateTime ?? null,
            sincronizado_em: marca,
          });
        }
        pagina = r.nextPageToken;
        if (!pagina) break;
      }

      const loja = {
        name: local.name,
        conta,
        titulo: local.title ?? local.name,
        endereco: enderecoEmTexto(local.storefrontAddress),
        maps_uri: local.metadata?.mapsUri ?? null,
        avaliar_uri: local.metadata?.newReviewUri ?? null,
        place_id: local.metadata?.placeId ?? null,
        location_id: lojaPorCid.get(cidDoMaps(local.metadata?.mapsUri) ?? "") ?? null,
        nota_media: nota,
        total_avaliacoes: total,
        // Vem na mesma chamada da lista de lojas. Só vai para a página da loja quando alguém manda, na tela de avaliações.
        horario: local.regularHours ?? null,
        sincronizado_em: marca,
      };
      return { loja, linhas };
    }

    // Lê do Google em lotes paralelos; grava no banco em seguida.
    const lidas: Awaited<ReturnType<typeof lerLoja>>[] = [];
    for (let i = 0; i < fila.length; i += LOJAS_EM_PARALELO) {
      lidas.push(...(await Promise.all(fila.slice(i, i + LOJAS_EM_PARALELO).map(lerLoja))));
    }

    let lojas = 0;
    let avaliacoes = 0;
    for (const { loja, linhas } of lidas) {
      let { error: erroLocal } = await supabase.from("google_locais").upsert(loja, { onConflict: "name" });
      // Banco sem a 0076 ainda: grava sem o horário em vez de perder a leitura.
      if (erroLocal && /horario/.test(erroLocal.message)) {
        const { horario: _horario, ...semHorario } = loja;
        ({ error: erroLocal } = await supabase.from("google_locais").upsert(semHorario, { onConflict: "name" }));
      }
      if (erroLocal) throw new Error(`Não deu para gravar a loja ${loja.titulo}: ${erroLocal.message}`);

      if (linhas.length) {
        let { error } = await supabase.from("google_avaliacoes").upsert(linhas, { onConflict: "name" });
        // Banco sem a 0051 ainda: grava sem a foto em vez de perder a leitura.
        if (error && /autor_foto/.test(error.message)) {
          const semFoto = linhas.map(({ autor_foto: _foto, ...resto }) => resto);
          ({ error } = await supabase.from("google_avaliacoes").upsert(semFoto, { onConflict: "name" }));
        }
        if (error) throw new Error(`Não deu para gravar as avaliações de ${loja.titulo}: ${error.message}`);
      }

      lojas += 1;
      avaliacoes += linhas.length;
    }

    // Só depois da rodada inteira: sai o que o Google não devolveu mais.
    await supabase.from("google_avaliacoes").delete().lt("sincronizado_em", marca);
    await supabase.from("google_locais").delete().lt("sincronizado_em", marca);

    resultado = { em: marca, ok: true, lojas, avaliacoes };
  } catch (e) {
    resultado = { em: marca, ok: false, erro: e instanceof Error ? e.message : String(e) };
  }

  const { data } = await supabase
    .from("integration_tokens")
    .select("meta")
    .eq("provider", PROVEDOR_CONTA)
    .maybeSingle();
  if (data) {
    await supabase
      .from("integration_tokens")
      .update({ meta: { ...((data.meta ?? {}) as Record<string, unknown>), ultima: resultado } })
      .eq("provider", PROVEDOR_CONTA);
  }

  return resultado;
}
