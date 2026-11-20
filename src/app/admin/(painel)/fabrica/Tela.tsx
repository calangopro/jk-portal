import Link from "next/link";
import type { FilaDaFabrica } from "@/lib/fabrica/dados";
import { DIAS_ANTES_DO_PRAZO, DIAS_DE_ATENCAO, DIAS_DE_ATRASO, ETAPAS_DE_FABRICA, atrasado, etapasAtivas, type Etapa } from "@/lib/fabrica/etapas";
import { EditorDeEtapas, type SalvarEtapas } from "./EditorDeEtapas";
import { ListaDaFabrica, type Marcar, type Mover, type MoverVarios } from "./Lista";

/**
 * A fila da fábrica, só o desenho. A leitura fica em `page.tsx`, para a tela
 * poder ser vista sem sessão durante o desenvolvimento.
 *
 * DESENHADA PARA O CELULAR DA BANCADA. As etapas ligadas ficam em cima, cada
 * uma com a contagem, e são elas que escolhem a lista. Elas vêm da tabela
 * `fabrica_etapas` (0191): diretoria e gerente mudam pelo botão "Editar
 * etapas", sem publicar código. A lista em si (busca,
 * filtros, foto da peça, seleção de vários) mora em `Lista.tsx`, que roda no
 * navegador: filtrar não vai ao servidor.
 *
 * A ordem é a da bancada (`ordenarFila`): motoboy e urgente primeiro, depois a
 * data interna mais perto, depois a chegada. Nas etapas finais a ordem
 * inverte, para o que acabou de sair ficar em cima.
 */

/** As janelas de dias que a tela oferece. A primeira é a de fábrica. */
export const JANELAS = [15, 30, 60];

export function TelaDaFabrica({
  fila, etapa, dias, hoje, buscaInicial = "", mover, moverVarios, marcar, salvarEtapas,
}: {
  fila: FilaDaFabrica | null;
  etapa: Etapa;
  dias: number;
  hoje: string;
  /** O número de pedido que já vem digitado na busca (quem chega de um pedido marcado no chat). */
  buscaInicial?: string;
  mover: Mover;
  moverVarios: MoverVarios;
  marcar: Marcar;
  /** Só para diretoria e gerente: sem ela, o botão de editar as etapas não aparece. */
  salvarEtapas?: SalvarEtapas;
}) {
  const pedidos = fila?.pedidos ?? [];
  const etapas = fila?.etapas ?? ETAPAS_DE_FABRICA;
  const quantos = (e: Etapa) => pedidos.filter((p) => p.etapa === e).length;
  const atrasados = (e: Etapa) => pedidos.filter((p) => p.etapa === e && atrasado(p, hoje)).length;

  return (
    <div data-painel-largo>
      <header>
        <p className="eyebrow">Fábrica</p>
        <h1 className="font-display mt-2 text-3xl text-ink sm:text-4xl">Fila da fábrica</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted sm:text-base">
          Cada trabalho tem o código da ordem de serviço (OS). Urgente e motoboy vêm primeiro. O botão grande leva para
          a etapa seguinte, Mudar etapa pula direto e Marcar vários move muitos de uma vez.
        </p>
        {salvarEtapas && fila ? <EditorDeEtapas etapas={etapas} pedidos={pedidos} salvar={salvarEtapas} /> : null}
      </header>

      {fila === null ? (
        <p className="glass mt-6 rounded-[18px] p-5 text-sm text-muted">
          <span className="font-semibold text-ink">Não deu para ler a fila agora.</span> Recarregue a página em alguns segundos.
        </p>
      ) : (
        <>
          {/* No celular as etapas rolam de lado numa linha só: em grade eram quatro linhas antes do primeiro pedido. */}
          <nav aria-label="Etapas" className="painel-fila -mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0 sm:pb-0 xl:grid-cols-8">
            {etapasAtivas(etapas).map((e) => {
              const ativa = e.chave === etapa;
              const tarde = atrasados(e.chave);
              return (
                <Link
                  key={e.chave}
                  href={`?etapa=${e.chave}&dias=${dias}`}
                  scroll={false}
                  aria-current={ativa ? "page" : undefined}
                  className={`painel-toque flex w-40 shrink-0 flex-col rounded-[14px] p-3 sm:w-auto ${ativa ? "painel-aba-ativa" : "border border-ink/10 bg-white text-ink"}`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold">
                      <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: e.cor }} />
                      <span className="truncate">{e.nome}</span>
                    </span>
                    <span className="numeros text-xl font-bold leading-none">{quantos(e.chave)}</span>
                  </span>
                  <span className={`mt-1 text-[0.68rem] leading-snug ${ativa ? "opacity-85" : "text-muted"}`}>
                    {tarde > 0 ? `${tarde} atrasado${tarde === 1 ? "" : "s"}` : e.frase}
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

          <ListaDaFabrica pedidos={pedidos} etapas={etapas} etapa={etapa} hoje={hoje} buscaInicial={buscaInicial} mover={mover} moverVarios={moverVarios} marcar={marcar} />

          <p className="mt-5 max-w-3xl text-[0.7rem] leading-relaxed text-muted">
            A fila mostra os pedidos pagos nos últimos {dias} dias, e pedido que a fábrica já pegou continua nela mesmo
            passando disso. Com prazo anotado, a fábrica termina {DIAS_ANTES_DO_PRAZO} dias antes dele (no próprio dia, em urgente e
            motoboy), e o selo fica em âmbar a partir dessa data e em vermelho depois do prazo. Sem prazo, a data fica em
            âmbar a partir de {DIAS_DE_ATENCAO} dias do pagamento e em vermelho a partir de {DIAS_DE_ATRASO}. São regras de partida, a
            confirmar com a fábrica. Pedido que a loja marca como enviado ou finalizado sai da produção sozinho. O rastreio
            anotado aqui ainda não vai para a loja.
          </p>
        </>
      )}
    </div>
  );
}
