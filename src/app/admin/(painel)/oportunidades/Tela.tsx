import Link from "next/link";
import { CalendarClock, CalendarDays, TriangleAlert } from "lucide-react";
import type { ListaDeOportunidades as Dados } from "@/lib/clientes/dados";
import { CARENCIA_DA_GRAVACAO, DIAS_DEPOIS, JANELAS, MESES_DO_NAMORO } from "@/lib/clientes/oportunidades";
import { Cartao } from "../Pecas";
import type { Marcar } from "../clientes/CartaoDaOportunidade";
import { ListaDeOportunidades } from "./ListaDeOportunidades";

/**
 * As oportunidades de venda, só o desenho. A leitura fica em `page.tsx`, para
 * a tela poder ser vista sem sessão durante o desenvolvimento.
 *
 * Em cima, três números que dizem o tamanho do trabalho; no meio, a lista com
 * os filtros; embaixo, por extenso, de onde a lista sai e quais prazos são
 * premissa nossa e não regra da JK.
 */
export function TelaDeOportunidades({ dados, dias, marcar }: { dados: Dados | null; dias: number; marcar: Marcar }) {
  const lista = dados?.lista ?? [];
  const atrasadas = lista.filter((o) => o.emDias < 0).length;
  const daSemana = lista.filter((o) => o.emDias >= 0 && o.emDias <= 7).length;
  const sugeridas = lista.filter((o) => o.origem === "gravacao").length;

  return (
    <div data-painel-largo>
      <header>
        <p className="eyebrow">Vendas</p>
        <h1 className="font-display mt-2 text-3xl text-ink sm:text-4xl">Oportunidades</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted sm:text-base">
          Quem vale chamar nos próximos dias, e por quê: aniversário, data do casal, casamento chegando, namoro que já
          dura e um ano da compra. O painel só abre a conversa no WhatsApp. Quem escreve é você.
        </p>
      </header>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted">O que vence nos próximos {dias} dias.</p>
        <nav aria-label="Janela de dias" className="flex gap-1 rounded-full border border-border bg-surface/60 p-1">
          {JANELAS.map((d) => (
            <Link
              key={d}
              href={`?dias=${d}`}
              scroll={false}
              aria-current={d === dias ? "page" : undefined}
              className={"whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold " + (d === dias ? "painel-aba-ativa" : "text-muted hover:text-ink")}
            >
              {d} dias
            </Link>
          ))}
        </nav>
      </div>

      {dados === null ? (
        <p className="glass mt-5 rounded-[18px] p-5 text-sm text-muted">
          <span className="font-semibold text-ink">Não deu para ler as oportunidades agora.</span> Recarregue a página em alguns segundos.
        </p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Cartao Icone={CalendarClock} rotulo="Nesta semana" apoio="vencem de hoje a sete dias">
              <span className="numeros">{daSemana}</span>
            </Cartao>
            <Cartao Icone={CalendarDays} rotulo={`Em ${dias} dias`} apoio={sugeridas > 0 ? `${sugeridas} com data sugerida pela gravação` : "todas com data da ficha ou da compra"}>
              <span className="numeros">{lista.length - atrasadas}</span>
            </Cartao>
            {/* No celular os cartões andam de dois em dois: o terceiro ocupa a linha inteira, para não sobrar um buraco. */}
            <div className="col-span-2 grid sm:col-span-1">
              <Cartao
                Icone={TriangleAlert}
                rotulo="Passaram da data"
                tom={atrasadas > 0 ? "atencao" : "neutro"}
                aviso="Ninguém marcou ainda"
                apoio="continuam na lista por alguns dias"
              >
                <span className="numeros">{atrasadas}</span>
              </Cartao>
            </div>
          </div>

          {lista.length === 0 ? (
            <p className="glass mt-5 rounded-[18px] p-6 text-sm text-muted">
              <span className="font-semibold text-ink">Nenhuma oportunidade nos próximos {dias} dias.</span> A lista cresce
              conforme as fichas ganham datas (aniversário, começo do namoro, casamento) e conforme as compras completam dez
              meses e um ano.
            </p>
          ) : (
            <ListaDeOportunidades lista={lista} eu={dados.eu} marcar={marcar} />
          )}
        </>
      )}

      <section className="mt-9 max-w-3xl text-[0.72rem] leading-relaxed text-muted" aria-label="Como a lista é feita">
        <p>
          <span className="font-semibold text-ink">Como a lista é feita.</span> É conta, refeita a cada visita, em cima da ficha
          de cada cliente e das compras pagas. Aniversário e data do casal saem da ficha. Data com o selo “Sugerida pela
          gravação” foi lida do texto gravado na aliança e ninguém confirmou: ela só vale a partir de {CARENCIA_DA_GRAVACAO} dias
          depois da compra, e vira dado quando alguém confirma na ficha. “Namoro sem noivado” aparece {MESES_DO_NAMORO} meses
          depois da compra da aliança de namoro, para quem não comprou de noivado nem de casamento.
        </p>
        <p className="mt-2">
          Marcada como “Já falei” ou “Não vale”, a oportunidade some; a do ano seguinte volta. Sem marca, o aniversário fica
          mais {DIAS_DEPOIS.aniversario_cliente} dias depois da data e os marcos de compra, mais {DIAS_DEPOIS.um_ano_da_compra}. Esses
          prazos são ponto de partida nosso, não regra da JK: dá para trocar.
        </p>
      </section>
    </div>
  );
}
