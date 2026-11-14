import Link from "next/link";
import { Bike, Clock, Hammer, PackageCheck, PackageOpen, Store, Truck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { FilaDaFabrica, PedidoDaFabrica } from "@/lib/fabrica/dados";
import {
  DIAS_DE_ATENCAO, DIAS_DE_ATRASO, ETAPAS, NOME_DA_ETAPA, diasEntreDatas, esperaEmPalavra, lerEntrega, lerEspecificacoes,
  tomDaEspera, type Entrega, type Especificacao, type Etapa,
} from "@/lib/fabrica/etapas";
import { nomeLimpo } from "@/lib/vendas/origem";
import { diaCurto } from "@/lib/vendas/periodo";
import { SeloDeTom } from "../Pecas";
import { AcoesDoPedido } from "./AcoesDoPedido";

/**
 * A fila da fábrica, só o desenho. A leitura fica em `page.tsx`, para a tela
 * poder ser vista sem sessão durante o desenvolvimento.
 *
 * DESENHADA PARA O CELULAR DA BANCADA. As quatro etapas ficam em cima, cada uma
 * com a contagem, e são elas que filtram a lista. Cada pedido é um cartão com o
 * que não pode errar em destaque: a numeração de cada aro e o texto que vai
 * gravado. O botão grande do cartão leva o pedido para a etapa seguinte.
 *
 * A ordem é a de chegada, o mais antigo primeiro: é o que está esperando há
 * mais tempo. Em "Enviado" a ordem inverte, para o que acabou de sair ficar em
 * cima.
 */

/** As janelas de dias que a tela oferece. A primeira é a de fábrica. */
export const JANELAS = [15, 30, 60];

type Mover = (pedido: number, etapa: string, extras?: { rastreio?: string; nota?: string }) => Promise<{ ok: true } | { ok: false; erro: string }>;

const ICONE_DA_ETAPA: Record<Etapa, LucideIcon> = { a_produzir: PackageOpen, em_producao: Hammer, pronto: PackageCheck, enviado: Truck };
const ICONE_DA_ENTREGA: Record<Entrega["tipo"], LucideIcon> = { retirada: Store, motoboy: Bike, correios: Truck, envio: Truck };

/** A loja marcou o pedido como saído: a fábrica não tem mais o que mover. */
const SAIU_PELA_LOJA = new Set(["ENVIADO", "FINALIZADO", "PROBLEMAS NA ENTREGA"]);

const rotuloCurto = (rotulo: string) => rotulo.replace(/^(?:Numeração|Gravação)\s*-?\s*/i, "").trim() || rotulo;

function Especificacoes({ lista }: { lista: Especificacao[] }) {
  const aros = lista.filter((e) => e.tipo === "aro");
  const gravar = lista.filter((e) => e.tipo === "gravar");
  const outros = lista.filter((e) => e.tipo === "outro");
  if (lista.length === 0) return null;
  return (
    <div className="mt-2 space-y-2">
      {aros.length > 0 ? (
        <dl className="flex flex-wrap gap-1.5">
          {aros.map((e, i) => (
            <div key={i} className="painel-selo flex items-baseline gap-1.5 rounded-[9px] px-2.5 py-1">
              <dt className="text-[0.68rem] font-semibold">{rotuloCurto(e.rotulo)}</dt>
              <dd className="numeros text-base font-bold leading-none text-ink">{e.valor}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {gravar.length > 0 ? (
        <div className="rounded-[10px] border border-ink/15 bg-white p-2.5">
          <p className="text-[0.62rem] font-bold uppercase tracking-wider text-muted">Gravar</p>
          <dl className="mt-1 space-y-1">
            {gravar.map((e, i) => (
              <div key={i} className="flex flex-wrap items-baseline gap-x-2">
                <dt className="shrink-0 text-xs text-muted">{rotuloCurto(e.rotulo)}</dt>
                {/* O texto vai como o cliente escreveu: é o que será gravado na peça. */}
                <dd className="min-w-0 whitespace-pre-wrap break-words text-base font-bold leading-snug text-ink">{e.valor}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}

      {outros.length > 0 ? (
        <dl className="grid gap-x-4 gap-y-0.5 text-xs sm:grid-cols-2">
          {outros.map((e, i) => (
            <div key={i} className="flex min-w-0 gap-1.5">
              <dt className="shrink-0 text-muted">{e.rotulo}:</dt>
              <dd className="min-w-0 break-words font-medium text-ink">{e.valor}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

function CartaoDoPedido({ p, hoje, mover }: { p: PedidoDaFabrica; hoje: string; mover: Mover }) {
  const dias = diasEntreDatas(p.dia, hoje);
  const tom = tomDaEspera(dias, p.etapa);
  const entrega = lerEntrega(p.entrega);
  const IconeDaEntrega = entrega ? ICONE_DA_ENTREGA[entrega.tipo] : null;
  const peloLoja = SAIU_PELA_LOJA.has((p.statusDaLoja ?? "").toUpperCase());

  return (
    <li className="glass flex flex-col rounded-[16px] p-4">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
        <div className="min-w-0">
          <p className="numeros text-base font-bold leading-tight text-ink">Pedido {p.pedido}</p>
          <p className="mt-0.5 break-words text-xs text-muted">
            {p.cliente ?? "Cliente sem nome"}
            {p.cidade ? `, ${p.cidade}${p.uf ? ` (${p.uf})` : ""}` : ""}
          </p>
        </div>
        <SeloDeTom tom={tom} titulo={`Pago em ${diaCurto(p.dia)}`}>
          {/* Com tom, o selo já traz o ícone do tom: dois ícones lado a lado só confundem. */}
          {tom === "neutro" ? <Clock size={11} aria-hidden="true" /> : null} {diaCurto(p.dia)}, {esperaEmPalavra(dias)}
        </SeloDeTom>
      </div>

      {entrega && IconeDaEntrega ? (
        <p className="mt-2 inline-flex items-center gap-1.5 self-start rounded-full bg-ink/[0.05] px-2.5 py-1 text-xs font-semibold text-ink">
          <IconeDaEntrega size={13} className="shrink-0" aria-hidden="true" /> {entrega.nome}
        </p>
      ) : null}

      <ul className="mt-3 space-y-3 border-t border-ink/[0.07] pt-3">
        {p.pecas.map((peca, i) => (
          <li key={i}>
            <p className="break-words text-sm font-semibold leading-snug text-ink">
              <span className="numeros">{peca.quantidade}×</span> {nomeLimpo(peca.nome)}
            </p>
            {peca.referencia ? <p className="numeros text-[0.7rem] text-muted">Ref. {peca.referencia}</p> : null}
            <Especificacoes lista={lerEspecificacoes(peca.info)} />
          </li>
        ))}
      </ul>

      {p.nota ? <p className="mt-3 rounded-[10px] bg-[#fcefd9] p-2.5 text-xs leading-relaxed text-[#6d3505]">{p.nota}</p> : null}
      {p.rastreio ? <p className="numeros mt-2 text-xs text-ink">Rastreio: <span className="font-semibold">{p.rastreio}</span></p> : null}
      {p.movidoPor && p.etapaEm ? (
        <p className="mt-2 text-[0.7rem] text-muted">
          {NOME_DA_ETAPA[p.etapa]} desde {new Date(p.etapaEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}, por {p.movidoPor}.
        </p>
      ) : null}

      <div className="mt-auto pt-3">
        {peloLoja ? (
          <p className="text-xs text-muted">A loja já marcou este pedido como {(p.statusDaLoja ?? "").toLowerCase()}.</p>
        ) : (
          <AcoesDoPedido pedido={p.pedido} etapa={p.etapa} nota={p.nota} rastreio={p.rastreio} mover={mover} />
        )}
      </div>
    </li>
  );
}

export function TelaDaFabrica({
  fila, etapa, dias, hoje, mover,
}: {
  fila: FilaDaFabrica | null;
  etapa: Etapa;
  dias: number;
  hoje: string;
  mover: Mover;
}) {
  const pedidos = fila?.pedidos ?? [];
  const daEtapa = pedidos.filter((p) => p.etapa === etapa);
  const lista = etapa === "enviado" ? [...daEtapa].reverse() : daEtapa;
  const quantos = (e: Etapa) => pedidos.filter((p) => p.etapa === e).length;
  const atrasados = (e: Etapa) => pedidos.filter((p) => p.etapa === e && tomDaEspera(diasEntreDatas(p.dia, hoje), e) === "ruim").length;

  return (
    <div data-painel-largo>
      <header>
        <p className="eyebrow">Fábrica</p>
        <h1 className="font-display mt-2 text-3xl text-ink sm:text-4xl">Fila da fábrica</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted sm:text-base">
          Os pedidos pagos na loja, do que chegou primeiro para o que chegou por último. Cada cartão traz a numeração e a
          gravação de cada peça, e o botão leva o pedido para a etapa seguinte.
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

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted">
              {lista.length === 0 ? "Nenhum pedido" : lista.length === 1 ? "1 pedido" : `${lista.length} pedidos`} nesta etapa, entre os pagos nos
              últimos {dias} dias. Pedido que a fábrica já pegou continua na fila mesmo passando disso.
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

          {lista.length === 0 ? (
            <p className="glass mt-4 rounded-[18px] p-6 text-sm text-muted">
              <span className="font-semibold text-ink">Nenhum pedido nesta etapa.</span>{" "}
              {etapa === "a_produzir" ? "Pedido novo entra aqui sozinho, quando a loja confirma o pagamento." : "Os pedidos aparecem aqui conforme andam na fila."}
            </p>
          ) : (
            <ul className="mt-4 grid gap-3 lg:grid-cols-2">
              {lista.map((p) => (
                <CartaoDoPedido key={p.pedido} p={p} hoje={hoje} mover={mover} />
              ))}
            </ul>
          )}

          <p className="mt-5 max-w-3xl text-[0.7rem] leading-relaxed text-muted">
            A data fica em âmbar a partir de {DIAS_DE_ATENCAO} dias do pagamento e em vermelho a partir de {DIAS_DE_ATRASO}. São prazos de
            partida, não o prazo de produção da JK: dá para trocar. Pedido que a loja marca como enviado ou finalizado sai
            da produção sozinho. O rastreio anotado aqui ainda não vai para a loja.
          </p>
        </>
      )}
    </div>
  );
}
