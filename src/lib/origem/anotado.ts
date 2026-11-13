/**
 * A venda que a LOJA recebeu, ligada a cada campanha, conjunto e anúncio pelo
 * coletor de origem, pronta para ficar ao lado do número da plataforma.
 *
 * Arquivo puro, para o teste rodar sem banco.
 */
import type { Avaliado, Nivel } from "../trafego/diagnostico.ts";

export type LinhaDoItem = { plataforma: string | null; nivel: Nivel; id: string; criados: number; pagos: number; valor: number };
export type VendaDoItem = { criados: number; pagos: number; valor: number };

export type Cobertura = {
  criados: number;
  /** Pedidos que vieram com a sessão da Tray, ou seja, lidos pela API. */
  com_sessao: number;
  /** Pedidos em que se sabe quem é o visitante. */
  ligados: number;
  com_origem: number;
  pagos: number;
  pagos_com_origem: number;
  pagos_com_anuncio: number;
  valor_pago: number;
  valor_pago_com_origem: number;
  valor_pago_com_anuncio: number;
};

export type LinhaDeCanal = { canal: string; criados: number; pagos: number; valor: number };

export type OrigemDosPedidos = { cobertura: Cobertura; por_canal: LinhaDeCanal[]; por_item: LinhaDoItem[] };

/** A chave de um item: o mesmo número pode, em tese, existir em dois níveis. */
export const chaveDoItem = (nivel: Nivel, id: string) => `${nivel}:${id}`;

/** As vendas dos itens de UMA plataforma, por `nivel:id`. */
export function vendasPorItem(linhas: LinhaDoItem[], plataforma: "meta" | "google"): Record<string, VendaDoItem> {
  const mapa: Record<string, VendaDoItem> = {};
  for (const l of linhas) {
    if (l.plataforma !== plataforma) continue;
    mapa[chaveDoItem(l.nivel, l.id)] = { criados: Number(l.criados), pagos: Number(l.pagos), valor: Math.round(Number(l.valor) * 100) / 100 };
  }
  return mapa;
}

export type ItemQueVendeu = VendaDoItem & {
  nivel: Nivel;
  id: string;
  nome: string;
  /** Onde o item está: a campanha, ou "campanha, conjunto" para o anúncio. `null` na campanha. */
  dentroDe: string | null;
  /** Quanto o item gastou no período. `null` quando ele não está na leitura do período. */
  gasto: number | null;
  /** Venda paga da loja dividida pelo gasto. `null` sem gasto. */
  volta: number | null;
  ativo: boolean | null;
};

/**
 * Os itens de um nível que tiveram pedido ligado, do que mais vendeu PAGO para
 * o que menos. Item com pedido criado e nenhum pago fica no fim: também é
 * informação (o anúncio traz gente que não paga).
 */
export function itensQueVenderam(campanhas: Avaliado[], vendas: Record<string, VendaDoItem>, nivel: Nivel): ItemQueVendeu[] {
  const achados = new Map<string, { item: Avaliado; dentroDe: string | null }>();
  const descer = (i: Avaliado, caminho: string[]) => {
    achados.set(chaveDoItem(i.nivel, i.id), { item: i, dentroDe: caminho.length ? caminho.join(", ") : null });
    for (const f of i.filhos) descer(f, [...caminho, i.nome || "Sem nome"]);
  };
  for (const c of campanhas) descer(c, []);

  return Object.entries(vendas)
    .filter(([chave]) => chave.startsWith(`${nivel}:`))
    .map(([chave, v]) => {
      const id = chave.slice(nivel.length + 1);
      const a = achados.get(chave);
      const gasto = a ? a.item.gasto : null;
      return {
        ...v,
        nivel,
        id,
        // Item que vendeu mas não gastou no período (venda de clique antigo) não está na árvore: fica o código.
        nome: a?.item.nome || `Código ${id}`,
        dentroDe: a?.dentroDe ?? null,
        gasto,
        volta: gasto && gasto > 0 ? Math.round((v.valor / gasto) * 100) / 100 : null,
        ativo: a?.item.ativo ?? null,
      };
    })
    .sort((x, y) => y.valor - x.valor || y.pagos - x.pagos || y.criados - x.criados);
}

export type Passo = { feito: boolean; titulo: string; texto: string };

export type SaudeDoColetor = {
  ultima_chegada: string | null;
  ultima_sessao: string | null;
  chegadas_24h: number;
  chegadas_7d: number;
  visitantes_7d: number;
  com_codigo_de_anuncio_7d: number;
  sessoes_7d: number;
  pedidos_vistos_7d: number;
  por_canal_7d: { canal: string; chegadas: number }[];
};

/**
 * O que já funciona e o que falta para a venda aparecer por anúncio, na ordem
 * em que as coisas dependem uma da outra. Cada passo é decidido por um número
 * do banco, não por alguém marcar como feito.
 */
export function passosDoColetor(saude: SaudeDoColetor, cobertura: Cobertura | null): Passo[] {
  const ligados = cobertura?.ligados ?? 0;
  return [
    {
      feito: saude.chegadas_7d > 0,
      titulo: "O painel recebe as chegadas",
      texto:
        saude.chegadas_7d > 0
          ? `${saude.chegadas_7d.toLocaleString("pt-BR")} chegadas de ${saude.visitantes_7d.toLocaleString("pt-BR")} visitantes nos últimos 7 dias.`
          : "Nenhuma chegada anotada nos últimos 7 dias.",
    },
    {
      feito: saude.sessoes_7d > 0,
      titulo: "O script roda na loja",
      texto:
        saude.sessoes_7d > 0
          ? `${saude.sessoes_7d.toLocaleString("pt-BR")} sessões da loja vistas nos últimos 7 dias.`
          : "Nenhuma sessão da loja vista ainda. O script entra na loja por uma etiqueta no GTM, e até lá só as páginas do portal anotam.",
    },
    {
      feito: saude.com_codigo_de_anuncio_7d > 0,
      titulo: "As chegadas trazem o código do anúncio",
      texto:
        saude.com_codigo_de_anuncio_7d > 0
          ? `${saude.com_codigo_de_anuncio_7d.toLocaleString("pt-BR")} chegadas dos últimos 7 dias com código de campanha ou anúncio reconhecido.`
          : "Nenhuma chegada com código reconhecido. O Google manda o da campanha sozinho. No Meta, os anúncios precisam levar {{campaign.id}}, {{adset.id}} e {{ad.id}} nos parâmetros de URL.",
    },
    {
      feito: ligados > 0,
      titulo: "O pedido é ligado a quem chegou",
      texto:
        ligados > 0
          ? `${ligados.toLocaleString("pt-BR")} pedidos do período ligados a um visitante.`
          : saude.pedidos_vistos_7d > 0
            ? `${saude.pedidos_vistos_7d.toLocaleString("pt-BR")} ${saude.pedidos_vistos_7d === 1 ? "pedido foi visto" : "pedidos foram vistos"} na página de compra nos últimos 7 dias, e ainda não ${saude.pedidos_vistos_7d === 1 ? "entrou" : "entraram"} no painel pela importação de pedidos. A ligação aparece na próxima importação.`
            : saude.sessoes_7d === 0
              ? "Depende do script na loja: sem ele, não há chegada para ligar ao pedido."
              : (cobertura?.com_sessao ?? 0) === 0
                ? "Nenhum pedido passou pela página de compra desde que o script entrou na loja. O outro caminho, pela sessão da Tray, depende da API de pedidos, que espera a homologação do aplicativo."
                : "Os pedidos já vêm com a sessão, mas nenhuma delas foi vista pelo script ainda.",
    },
  ];
}
