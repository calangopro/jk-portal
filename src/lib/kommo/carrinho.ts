/**
 * O carrinho abandonado da Kommo ligado ao visitante da loja (cartão 53,
 * migration 0182).
 *
 * O n8n cria um negócio no funil ECOMM | RECUPERAÇÃO a cada carrinho largado
 * na loja, com o campo "Link do carrinho" no formato
 * `https://www.jkaliancas.com.br/checkout/cart?session_id=<sessão>&store_id=1305187`.
 * Essa sessão é a MESMA que o coletor de origem anota (`origem_sessoes`) e que
 * o pedido da Tray carrega (`tray_pedidos.sessao`). Daí saem duas coisas:
 *
 *   - de onde o carrinho veio, pela regra de `origem_resolvida` (clique em
 *     anúncio nos sete dias antes leva; senão a última chegada que não seja
 *     direta, em trinta dias), que a 0182 passou a morar em
 *     `origem_das_chegadas` para servir aos pedidos e aos carrinhos;
 *   - se o carrinho virou pedido: o pedido da mesma sessão feito depois.
 *
 * Aqui moram a leitura da sessão no link (a MESMA de `kommo_sessao_do_link`,
 * na 0182: o teste confere que o padrão é o mesmo texto nos dois), a leitura
 * do que a função do banco devolve e as frases da tela.
 *
 * Arquivo puro, para o teste rodar sem banco.
 */

/** O campo "Link do carrinho" na conta da Kommo da JK. */
export const CAMPO_LINK_DO_CARRINHO = 3177638;

/** O número da loja da JK na Tray. Link com outro `store_id` (a loja de testes) não vale. */
export const LOJA_DA_JK = "1305187";

/**
 * O link do carrinho, com a sessão no quarto grupo. Só o domínio da JK, com ou
 * sem `www`, em qualquer caminho, com `session_id` em qualquer posição da
 * consulta. É o MESMO texto do padrão da 0182: mudou um, muda o outro.
 */
export const PADRAO_DO_LINK =
  "^https?://(www\\.)?jkaliancas\\.com\\.br(/[^?#\\s]*)?\\?([^#\\s]*&)?session_id=([A-Za-z0-9_-]{16,128})(&[^#\\s]*)?(#.*)?$";

/** O `store_id` do link, quando vem. */
export const PADRAO_DA_LOJA = "[?&]store_id=([^&#]*)";

const LINK = new RegExp(PADRAO_DO_LINK, "i");
const LOJA = new RegExp(PADRAO_DA_LOJA, "i");

/**
 * A sessão da Tray tirada do "Link do carrinho", ou `null`. Endereço de outro
 * domínio, sem `session_id`, com sessão de formato estranho ou de outra loja
 * não vira palpite.
 */
export function sessaoDoLinkDoCarrinho(link: string | null | undefined): string | null {
  const t = (link ?? "").trim();
  if (!t) return null;
  const m = LINK.exec(t);
  if (!m) return null;
  const loja = LOJA.exec(t);
  if (loja && loja[1] !== LOJA_DA_JK) return null;
  return m[4];
}

/** O link do carrinho entre os campos do negócio (`kommo_negocios.campos`). */
export function linkDoCarrinho(campos: { id?: unknown; valor?: unknown }[] | null | undefined): string | null {
  const c = (campos ?? []).find((x) => Number(x.id) === CAMPO_LINK_DO_CARRINHO);
  return typeof c?.valor === "string" && c.valor.trim() ? c.valor.trim() : null;
}

// ---------------------------------------------------------------------------
// A leitura de `kommo_carrinhos_por_origem` (0182), para a tela de Origem.
// ---------------------------------------------------------------------------

export type CarrinhoDaLista = {
  id: number;
  criadoEm: string | null;
  etapa: string | null;
  /** O link trouxe uma sessão da loja. */
  temSessao: boolean;
  /** A sessão é de um visitante que o coletor conhece. */
  ligado: boolean;
  canal: string | null;
  plataforma: "meta" | "google" | null;
  campanha: string | null;
  conjunto: string | null;
  anuncio: string | null;
  /** Só para quem tem a área de vendas: `null` sem ela ou sem pedido. */
  pedido: number | null;
  pago: boolean | null;
  horas: number | null;
  link: string;
};

export type CanalDosCarrinhos = { canal: string; carrinhos: number; anuncio: number; pedidos: number | null; pagos: number | null };

export type CarrinhosAbandonados = {
  lidoEm: string | null;
  total: number;
  comSessao: number;
  ligados: number;
  comOrigem: number;
  comAnuncio: number;
  porCanal: CanalDosCarrinhos[];
  /** `null` para quem não tem a área de vendas. */
  pedidos: { viraram: number; pagos: number; valorPago: number; horasMediana: number | null } | null;
  lista: CarrinhoDaLista[];
};

const texto = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const numero = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0);
const talvez = (v: unknown): number | null => (v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Number(v));

export function lerCarrinhos(data: unknown): CarrinhosAbandonados | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const p = d.pedidos && typeof d.pedidos === "object" ? (d.pedidos as Record<string, unknown>) : null;
  const canais = Array.isArray(d.por_canal) ? (d.por_canal as Record<string, unknown>[]) : [];
  const lista = Array.isArray(d.lista) ? (d.lista as Record<string, unknown>[]) : [];
  return {
    lidoEm: texto(d.lido_em),
    total: numero(d.total),
    comSessao: numero(d.com_sessao),
    ligados: numero(d.ligados),
    comOrigem: numero(d.com_origem),
    comAnuncio: numero(d.com_anuncio),
    porCanal: canais
      .map((c) => ({
        canal: texto(c.canal) ?? "sem_origem",
        carrinhos: numero(c.carrinhos),
        anuncio: numero(c.anuncio),
        pedidos: talvez(c.pedidos),
        pagos: talvez(c.pagos),
      }))
      .sort((a, b) => b.carrinhos - a.carrinhos || a.canal.localeCompare(b.canal)),
    pedidos: p
      ? { viraram: numero(p.viraram), pagos: numero(p.pagos), valorPago: numero(p.valor_pago), horasMediana: talvez(p.horas_mediana) }
      : null,
    lista: lista
      .map((c) => {
        const id = numero(c.id);
        if (!id) return null;
        const plataforma = c.plataforma === "meta" || c.plataforma === "google" ? c.plataforma : null;
        return {
          id,
          criadoEm: texto(c.criado_em),
          etapa: texto(c.etapa),
          temSessao: c.tem_sessao === true,
          ligado: c.ligado === true,
          canal: texto(c.canal),
          plataforma,
          campanha: texto(c.campanha),
          conjunto: texto(c.conjunto),
          anuncio: texto(c.anuncio),
          pedido: talvez(c.pedido),
          pago: typeof c.pago === "boolean" ? c.pago : null,
          horas: talvez(c.horas),
          link: `https://kathleengfz.kommo.com/leads/detail/${id}`,
        } satisfies CarrinhoDaLista;
      })
      .filter((c): c is CarrinhoDaLista => c !== null),
  };
}

/** "em 40 min", "em 5 h", "em 3 dias". Negativo não acontece: o pedido vale do carrinho em diante. */
export function tempoAtePedido(horas: number | null): string | null {
  if (horas === null || !Number.isFinite(horas)) return null;
  const h = Math.max(0, horas);
  if (h < 1) return `em ${Math.max(1, Math.round(h * 60))} min`;
  if (h < 48) return `em ${Math.round(h)} h`;
  const d = Math.round(h / 24);
  return `em ${d} ${d === 1 ? "dia" : "dias"}`;
}

/** Por que o carrinho tem (ou não tem) origem, em uma frase. */
export function comoLigouOCarrinho(c: Pick<CarrinhoDaLista, "temSessao" | "ligado" | "canal">): string {
  if (!c.temSessao) return "O negócio não tem link de carrinho com a sessão da loja.";
  if (!c.ligado) return "A sessão não é de nenhum visitante que o coletor anotou (o coletor só existe desde 13/11/2026).";
  if (!c.canal) return "O visitante é conhecido, mas não chegou ao site nos trinta dias antes do carrinho.";
  if (c.canal === "direto") return "Todas as chegadas deste visitante foram diretas, sem UTM nem site de origem.";
  return "Ligado pela sessão da loja ao visitante, pela mesma regra dos pedidos.";
}
