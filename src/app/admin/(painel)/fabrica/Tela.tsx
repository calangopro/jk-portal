import Link from "next/link";
import { Hammer, PackageCheck, PackageOpen, Truck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { FilaDaFabrica } from "@/lib/fabrica/dados";
import { DIAS_DE_ATENCAO, DIAS_DE_ATRASO, ETAPAS, diasEntreDatas, tomDaEspera, type Etapa } from "@/lib/fabrica/etapas";
import { ListaDaFabrica, type Mover, type MoverVarios } from "./Lista";

/**
 * A fila da fábrica, só o desenho. A leitura fica em `page.tsx`, para a tela
 * poder ser vista sem sessão durante o desenvolvimento.
 *
 * DESENHADA PARA O CELULAR DA BANCADA. As quatro etapas ficam em cima, cada uma
 * com a contagem, e são elas que escolhem a lista. A lista em si (busca,
 * filtros, foto da peça, seleção de vários) mora em `Lista.tsx`, que roda no
 * navegador: filtrar não vai ao servidor.
 *
 * A ordem é a de chegada, o mais antigo primeiro: é o que está esperando há
 * mais tempo. Em "Enviado" a ordem inverte, para o que acabou de sair ficar em
 * cima.
 */

/** As janelas de dias que a tela oferece. A primeira é a de fábrica. */
export const JANELAS = [15, 30, 60];

const ICONE_DA_ETAPA: Record<Etapa, LucideIcon> = { a_produzir: PackageOpen, em_producao: Hammer, pronto: PackageCheck, enviado: Truck };

export function TelaDaFabrica({
  fila, etapa, dias, hoje, buscaInicial = "", mover, moverVarios,
}: {
  fila: FilaDaFabrica | null;
  etapa: Etapa;
  dias: number;
  hoje: string;
  /** O número de pedido que já vem digitado na busca (quem chega de um pedido marcado no chat). */
  buscaInicial?: string;
  mover: Mover;
  moverVarios: MoverVarios;
}) {
  const pedidos = fila?.pedidos ?? [];
  const quantos = (e: Etapa) => pedidos.filter((p) => p.etapa === e).length;
  const atrasados = (e: Etapa) => pedidos.filter((p) => p.etapa === e && tomDaEspera(diasEntreDatas(p.dia, hoje), e) === "ruim").length;

  return (
    <div data-painel-largo>
      <header>
        <p className="eyebrow">Fábrica</p>
        <h1 className="font-display mt-2 text-3xl text-ink sm:text-4xl">Fila da fábrica</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted sm:text-base">
          Os pedidos pagos na loja, do mais antigo para o mais novo. O botão grande leva para a etapa seguinte, Mudar
          etapa pula direto (de A produzir para Enviado, por exemplo) e Marcar vários move muitos de uma vez.
        </p>
      </header>

      {fila === null ? (
        <p className="glass mt-6 rounded-[18px] p-5 text-sm text-muted">
          <span className="font-semibold text-ink">Não deu para ler a fila agora.</span> Recarregue a página em alguns segundos.
        </p>
      ) : (
        <>
          <nav aria-label="Etapas" className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {ETAPAS.map((e) => {
              const ativa = e.chave === etapa;
              const Icone = ICONE_DA_ETAPA[e.chave];
              const tarde = atrasados(e.chave);
              return (
                <Link
                  key={e.chave}
                  href={`?etapa=${e.chave}&dias=${dias}`}
                  scroll={false}
                  aria-current={ativa ? "page" : undefined}
                  className={`painel-toque flex flex-col rounded-[14px] p-3 ${ativa ? "painel-aba-ativa" : "border border-ink/10 bg-white text-ink"}`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-xs font-semibold">
                      <Icone size={14} aria-hidden="true" /> {e.nome}
                    </span>
                    <span className="numeros text-xl font-bold leading-none">{quantos(e.chave)}</span>
                  </span>
                  <span className={`mt-1 text-[0.68rem] leading-snug ${ativa ? "opacity-85" : "text-muted"}`}>
                    {tarde > 0 ? `${tarde} há ${DIAS_DE_ATRASO} dias ou mais` : e.frase}
                  </span>
                </Link>
              );
            })}
          </nav>

          {/* No celular a frase some: o que importa ali é chegar logo no primeiro pedido. Ela está no rodapé. */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="hidden text-xs text-muted sm:block">
              Pedidos pagos nos últimos {dias} dias. Pedido que a fábrica já pegou continua na fila mesmo passando disso.
            </p>
            <nav aria-label="Janela de dias" className="flex gap-1 rounded-full border border-border bg-surface/60 p-1">
              {JANELAS.map((d) => (
                <Link
                  key={d}
                  href={`?etapa=${etapa}&dias=${d}`}
                  scroll={false}
                  aria-current={d === dias ? "page" : undefined}
                  className={"whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold " + (d === dias ? "painel-aba-ativa" : "text-muted hover:text-ink")}
                >
                  {d} dias
                </Link>
              ))}
            </nav>
          </div>

          <ListaDaFabrica pedidos={pedidos} etapa={etapa} hoje={hoje} buscaInicial={buscaInicial} mover={mover} moverVarios={moverVarios} />

          <p className="mt-5 max-w-3xl text-[0.7rem] leading-relaxed text-muted">
            A fila mostra os pedidos pagos nos últimos {dias} dias, e pedido que a fábrica já pegou continua nela mesmo
            passando disso. A data fica em âmbar a partir de {DIAS_DE_ATENCAO} dias do pagamento e em vermelho a partir de {DIAS_DE_ATRASO}. São prazos de
            partida, não o prazo de produção da JK: dá para trocar. Pedido que a loja marca como enviado ou finalizado sai
            da produção sozinho. O rastreio anotado aqui ainda não vai para a loja.
          </p>
        </>
      )}
    </div>
  );
}
