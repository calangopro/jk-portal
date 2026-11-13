import { CircleCheck, CircleDashed } from "lucide-react";
import { passosDoColetor, type OrigemDosPedidos, type SaudeDoColetor } from "@/lib/origem/anotado";
import { NOME_DA_CHEGADA, type CanalDeChegada } from "@/lib/origem/chegada";
import { haQuantoTempo, reais } from "../vendas/PainelDeVendas";

/**
 * A origem que a própria loja anota, na tela de tráfego: o que já funciona, o
 * que falta, de onde as visitas chegam e quanto de venda PAGA cada canal trouxe.
 *
 * O bloco se explica sozinho enquanto falta peça: cada passo é decidido por um
 * número do banco (`passosDoColetor`), então ninguém precisa lembrar de marcar
 * nada como feito, e ele não mente dizendo "funcionando" sem chegada nenhuma.
 *
 * CORES. Verde só no passo feito, sempre com ícone e palavra. As barras usam o
 * dourado da venda e o azul do gasto, cada um num gráfico, e toda barra é uma
 * fatia do total daquele gráfico.
 */

const VENDA = "#b8841f";
const VISITA = "#1f86b0";
const BOM = "#047857";

const nomeDoCanal = (c: string) => NOME_DA_CHEGADA[c as CanalDeChegada] ?? c;
const inteiro = (n: number) => n.toLocaleString("pt-BR");
const porcento = (parte: number, todo: number) => (todo > 0 ? `${Math.round((parte / todo) * 100)}%` : "0%");

function Barra({ fatia, cor }: { fatia: number; cor: string }) {
  return (
    <span className="mt-1 block h-2 rounded-full bg-border/60" aria-hidden>
      <span className="block h-2 rounded-full" style={{ width: `${Math.min(Math.max(fatia * 100, 1), 100)}%`, background: cor }} />
    </span>
  );
}

export function OrigemAnotada({ origem, saude }: { origem: OrigemDosPedidos | null; saude: SaudeDoColetor | null }) {
  if (!saude) return null;
  const c = origem?.cobertura ?? null;
  const passos = passosDoColetor(saude, c);
  const feitos = passos.filter((p) => p.feito).length;
  const chegadas = saude.por_canal_7d.reduce((s, l) => s + l.chegadas, 0);
  const canais = (origem?.por_canal ?? []).filter((l) => l.criados > 0);

  return (
    <section className="glass mt-6 rounded-[18px] p-5" aria-label="Origem anotada pela loja">
      <p className="eyebrow">Origem anotada pela loja</p>
      <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted">
        A loja e o portal anotam de onde cada visita chegou (etiquetas, clique no anúncio, site anterior) e o painel liga
        a chegada ao pedido. É o que mostra a venda paga por campanha, conjunto e anúncio, sem depender da etiqueta que
        a Tray guarda.
        {saude.ultima_chegada ? ` Última chegada anotada ${haQuantoTempo(saude.ultima_chegada)}.` : ""}
      </p>

      <p className="mt-4 text-[0.68rem] font-semibold uppercase tracking-wider text-muted">
        {feitos === passos.length ? "Tudo ligado" : `${feitos} de ${passos.length} passos prontos`}
      </p>
      <ol className="mt-2 grid gap-3 md:grid-cols-2">
        {passos.map((p, n) => (
          <li key={p.titulo} className="rounded-[12px] border-l-4 bg-white/50 p-3" style={{ borderLeftColor: p.feito ? BOM : "var(--color-border)" }}>
            <p className="flex items-center gap-1.5 text-[0.66rem] font-bold uppercase tracking-wider" style={{ color: p.feito ? BOM : "var(--color-muted)" }}>
              {p.feito ? <CircleCheck size={13} aria-hidden /> : <CircleDashed size={13} aria-hidden />}
              {p.feito ? "Feito" : "Falta"}
            </p>
            <p className="mt-1 text-sm font-semibold leading-snug text-ink">{n + 1}. {p.titulo}</p>
            <p className="mt-1 text-xs leading-relaxed text-ink/85">{p.texto}</p>
          </li>
        ))}
      </ol>

      {c && c.ligados > 0 ? (
        <div className="mt-6">
          <p className="text-sm font-semibold text-ink">Venda paga do período, pela origem anotada</p>
          <p className="numeros mt-1 text-xs text-muted">
            {inteiro(c.pagos_com_origem)} de {inteiro(c.pagos)} pedidos pagos têm origem anotada, {porcento(c.valor_pago_com_origem, c.valor_pago)} do
            valor pago. Com anúncio reconhecido: {inteiro(c.pagos_com_anuncio)} pedidos, {reais(c.valor_pago_com_anuncio)}.
          </p>
          <ul className="mt-3 space-y-3">
            {canais.map((l) => (
              <li key={l.canal}>
                <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                  <span className="font-semibold text-ink">{nomeDoCanal(l.canal)}</span>
                  <span className="numeros text-ink">{reais(l.valor)}</span>
                </p>
                <Barra fatia={c.valor_pago_com_origem > 0 ? l.valor / c.valor_pago_com_origem : 0} cor={VENDA} />
                <p className="numeros mt-1 text-[0.72rem] text-muted">
                  {inteiro(l.pagos)} {l.pagos === 1 ? "pago" : "pagos"} de {inteiro(l.criados)} {l.criados === 1 ? "pedido criado" : "pedidos criados"}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-3 max-w-3xl text-[0.7rem] leading-relaxed text-muted">
            Vale a última chegada que não foi acesso direto, até trinta dias antes do pedido. A barra é a fatia do valor
            pago com origem anotada.
          </p>
        </div>
      ) : null}

      {chegadas > 0 ? (
        <div className="mt-6">
          <p className="text-sm font-semibold text-ink">De onde as visitas chegaram, nos últimos 7 dias</p>
          <ul className="mt-3 grid gap-x-6 gap-y-3 md:grid-cols-2">
            {saude.por_canal_7d.map((l) => (
              <li key={l.canal}>
                <p className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-semibold text-ink">{nomeDoCanal(l.canal)}</span>
                  <span className="numeros text-ink">{inteiro(l.chegadas)} <span className="text-xs text-muted">({porcento(l.chegadas, chegadas)})</span></span>
                </p>
                <Barra fatia={l.chegadas / chegadas} cor={VISITA} />
              </li>
            ))}
          </ul>
          <p className="mt-3 max-w-3xl text-[0.7rem] leading-relaxed text-muted">
            Cada chegada é uma entrada no site: quem volta no mesmo dia por outro caminho conta de novo. Enquanto o
            script não roda na loja, aqui só aparecem as páginas do portal.
          </p>
        </div>
      ) : null}
    </section>
  );
}
