import type { CSSProperties } from "react";
import { ArrowUpRight, HandCoins, LifeBuoy, PackageSearch, ShoppingBag, Trophy, type LucideIcon } from "lucide-react";
import { LinkRapido } from "@/components/ui/LinkRapido";
import type { Area } from "@/lib/auth/acessos";
import { SETORES } from "@/lib/painel/setores";
import { nomeDoMes, totalDoMes, type MeuMes } from "@/lib/pedidos/do-site";

/**
 * O começo do Início de quem vende: quanto a pessoa vendeu no mês e os
 * atalhos do dia a dia. Pedido do dono em 17/11: "painel do vendedor deveria
 * ser útil pra ele".
 *
 * O número é o MESMO do ranking (0104 e 0105): venda por fora mais o pedido
 * do site marcado como dela. Sem cor de estado: vender pouco no começo do mês
 * não é problema, é calendário. A posição no ranking vem sem o número de
 * ninguém. O lembrete dos pedidos sem vendedor leva à tela de achar o pedido.
 */

const COR = SETORES.find((s) => s.id === "vendas")?.cor;
const reais = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Atalho = { href: string; area: Area; rotulo: string; apoio: string; Icone: LucideIcon };

const ATALHOS: Atalho[] = [
  { href: "/admin/registrar-venda", area: "lancar_venda", rotulo: "Registrar venda", apoio: "Fechou fora da loja", Icone: HandCoins },
  { href: "/admin/pedidos-do-site", area: "lancar_venda", rotulo: "Achar meu pedido", apoio: "Vendeu pelo site", Icone: ShoppingBag },
  { href: "/admin/consulta", area: "consulta", rotulo: "Consultar produto", apoio: "Preço, prazo e loja", Icone: PackageSearch },
  { href: "/admin/suporte", area: "lancar_venda", rotulo: "Passar ao suporte", apoio: "Pedra, ajuste, troca", Icone: LifeBuoy },
];

export function MeuMesNoInicio({ m, areas }: { m: MeuMes; areas: readonly Area[] }) {
  const total = totalDoMes(m);
  const mes = nomeDoMes(m.mes);
  const atalhos = ATALHOS.filter((a) => areas.includes(a.area));

  return (
    <section className="mt-6" aria-label="O seu mês de vendas" style={{ "--setor": COR, "--rotulo-do-setor": COR } as CSSProperties}>
      <div className="glass rounded-[20px] p-4 sm:p-5">
        <p className="eyebrow">Seu mês{mes ? `, ${mes}` : ""}</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <p className="font-display numeros text-4xl leading-none text-ink sm:text-5xl">{reais(total)}</p>
            <p className="mt-1.5 text-sm text-muted">
              {total > 0 ? "vendidos por você" : "Nenhuma venda sua registrada ainda"}
              {m.mesPassado > 0 ? `. No mês passado, ${reais(m.mesPassado)}.` : "."}
            </p>
          </div>
          {m.posicao ? (
            <span className="painel-selo inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold">
              <Trophy size={15} aria-hidden="true" /> {m.posicao}º de {m.noRanking} no ranking
            </span>
          ) : null}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <div className="min-w-0 rounded-[14px] bg-ink/[0.04] p-3">
            <p className="text-xs font-semibold text-muted">Por fora da loja</p>
            <p className="numeros mt-0.5 text-lg font-bold leading-tight text-ink">{reais(m.foraValor)}</p>
            <p className="text-xs text-muted">{m.foraVendas === 1 ? "1 venda" : `${m.foraVendas} vendas`}</p>
          </div>
          <div className="min-w-0 rounded-[14px] bg-ink/[0.04] p-3">
            <p className="text-xs font-semibold text-muted">Pedidos do site</p>
            <p className="numeros mt-0.5 text-lg font-bold leading-tight text-ink">{reais(m.lojaValor)}</p>
            <p className="text-xs text-muted">{m.lojaPedidos === 1 ? "1 pedido marcado" : `${m.lojaPedidos} pedidos marcados`}</p>
          </div>
        </div>

        {m.semVendedor30d > 0 && areas.includes("lancar_venda") ? (
          <LinkRapido
            href="/admin/pedidos-do-site"
            className="painel-toque mt-3 flex items-center gap-2.5 rounded-[14px] border border-ink/10 bg-white p-3 text-sm text-ink transition-shadow hover:shadow-md"
          >
            <span className="painel-selo grid h-9 w-9 shrink-0 place-items-center rounded-full" aria-hidden="true">
              <ShoppingBag size={16} />
            </span>
            <span className="min-w-0 flex-1 leading-snug">
              <span className="font-semibold">
                {m.semVendedor30d === 1 ? "1 pedido do site" : `${m.semVendedor30d} pedidos do site`} dos últimos 30 dias sem vendedor.
              </span>{" "}
              <span className="text-muted">Algum é seu? Marque e ele entra no seu mês.</span>
            </span>
            <ArrowUpRight size={16} className="painel-cor shrink-0" aria-hidden="true" />
          </LinkRapido>
        ) : null}
      </div>

      {atalhos.length > 0 ? (
        <nav aria-label="Atalhos de quem vende" className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {atalhos.map((a) => (
            <LinkRapido
              key={a.href}
              href={a.href}
              className="painel-toque glass flex min-w-0 flex-col gap-2 rounded-[16px] p-3.5 transition-shadow hover:shadow-md"
            >
              <span className="painel-selo grid h-9 w-9 place-items-center rounded-[10px]" aria-hidden="true">
                <a.Icone size={17} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold leading-tight text-ink">{a.rotulo}</span>
                <span className="mt-0.5 block text-xs leading-snug text-muted">{a.apoio}</span>
              </span>
            </LinkRapido>
          ))}
        </nav>
      ) : null}
    </section>
  );
}
