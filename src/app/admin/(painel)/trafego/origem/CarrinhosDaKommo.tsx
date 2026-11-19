"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { NOME_DA_CHEGADA, type CanalDeChegada } from "@/lib/origem/chegada";
import { comoLigouOCarrinho, tempoAtePedido, type CarrinhosAbandonados } from "@/lib/kommo/carrinho";
import { abrirHistoricoDoPedido } from "../../pedido/abrir";

/**
 * O recorte "Carrinho abandonado" do bloco da Kommo: os negócios que o n8n
 * cria a cada carrinho largado na loja, ligados ao visitante pela sessão da
 * Tray que vem no "Link do carrinho", e daí à origem pela mesma regra dos
 * pedidos. Lido por `kommo_carrinhos_por_origem` (0182).
 *
 * Quantos viraram pedido, pagos e em quanto tempo só aparecem para quem tem a
 * área de vendas (a função devolve nulo para os outros). Sem nome nem telefone
 * do cliente: o negócio, a etapa, de onde veio e o número do pedido.
 */

const POR_VEZ = 20;
const inteiro = (n: number) => n.toLocaleString("pt-BR");
const reais = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const diaEHora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";

const GRUPOS: Record<string, string> = {
  sem_sessao: "Link sem sessão da loja",
  sem_visitante: "Visitante que o coletor não viu",
  sem_chegada: "Sem chegada em 30 dias",
};
const nomeDoGrupo = (g: string | null) =>
  g ? (GRUPOS[g] ?? NOME_DA_CHEGADA[g as CanalDeChegada] ?? g) : "Sem origem";

export function CarrinhosDaKommo({ dados }: { dados: CarrinhosAbandonados | null }) {
  const [limite, setLimite] = useState(POR_VEZ);

  if (!dados) {
    return (
      <div className="mt-6 border-t border-ink/[0.07] pt-4">
        <p className="eyebrow">Carrinho abandonado</p>
        <p className="mt-2 text-sm text-muted">Não deu para ler os carrinhos abandonados agora.</p>
      </div>
    );
  }

  const p = dados.pedidos;
  const parte = (n: number) => (dados.total > 0 ? ` (${Math.round((n / dados.total) * 100)}%)` : "");

  return (
    <div className="mt-6 border-t border-ink/[0.07] pt-4" aria-label="Carrinho abandonado">
      <p className="eyebrow">Carrinho abandonado</p>
      <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted">
        O negócio que o n8n cria na Kommo a cada carrinho largado traz o link do carrinho com a sessão da loja. É a mesma sessão que
        o site anota na chegada e que o pedido carrega: daí sai de onde a pessoa veio (pela regra dos pedidos) e se o carrinho virou
        pedido depois.
      </p>

      {dados.total === 0 ? (
        <p className="mt-3 text-sm text-muted">Nenhum carrinho abandonado criado na Kommo no período.</p>
      ) : (
        <>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-xs sm:grid-cols-4">
            <div className="min-w-0">
              <dt className="text-muted">Carrinhos</dt>
              <dd className="numeros text-lg font-semibold text-ink">{inteiro(dados.total)}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-muted">Ligados ao visitante</dt>
              <dd className="numeros text-lg font-semibold text-ink">
                {inteiro(dados.ligados)}
                <span className="text-xs font-normal text-muted">{parte(dados.ligados)}</span>
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-muted">Com origem</dt>
              <dd className="numeros text-lg font-semibold text-ink">
                {inteiro(dados.comOrigem)}
                <span className="block text-xs font-normal text-muted">{inteiro(dados.comAnuncio)} ligados a anúncio</span>
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-muted">Viraram pedido pago</dt>
              {p ? (
                <dd className="numeros text-lg font-semibold text-ink">
                  {inteiro(p.pagos)}
                  <span className="block text-xs font-normal text-muted">
                    {p.pagos > 0 ? `${reais(p.valorPago)}${p.horasMediana !== null ? `, metade ${tempoAtePedido(p.horasMediana)}` : ""}` : `${inteiro(p.viraram)} com pedido`}
                  </span>
                </dd>
              ) : (
                <dd className="text-xs text-muted">Só para quem vê vendas.</dd>
              )}
            </div>
          </dl>

          {dados.ligados < dados.comSessao ? (
            <p className="mt-2 max-w-3xl text-[0.7rem] leading-relaxed text-muted">
              {inteiro(dados.comSessao - dados.ligados)} carrinhos têm sessão, mas de um visitante que o site não anotou: o coletor existe
              desde 13/11/2026, e quem chegou antes disso não tem chegada guardada.
            </p>
          ) : null}

          <ul className="mt-3 space-y-1.5 text-xs">
            {dados.porCanal.map((c) => (
              <li key={c.canal} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-ink/[0.05] pb-1.5">
                <span className="min-w-0 font-semibold text-ink [overflow-wrap:anywhere]">{nomeDoGrupo(c.canal)}</span>
                <span className="numeros text-muted">
                  {inteiro(c.carrinhos)} {c.carrinhos === 1 ? "carrinho" : "carrinhos"}
                  {c.anuncio > 0 ? `, ${inteiro(c.anuncio)} de anúncio` : ""}
                  {c.pagos !== null && c.pagos > 0 ? `, ${inteiro(c.pagos)} ${c.pagos === 1 ? "pago" : "pagos"}` : ""}
                </span>
              </li>
            ))}
          </ul>

          <ul className="mt-4 divide-y divide-ink/[0.07]">
            {dados.lista.slice(0, limite).map((n) => {
              const item = n.anuncio ?? n.conjunto ?? n.campanha;
              return (
                <li key={n.id} className="py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <a
                      href={n.link}
                      target="_blank"
                      rel="noreferrer"
                      className="numeros inline-flex items-center gap-1 text-sm font-semibold text-brand-nav hover:underline"
                      title="Abrir o negócio na Kommo"
                    >
                      Negócio {n.id} <ExternalLink size={12} aria-hidden="true" />
                    </a>
                    <span className="numeros text-xs text-muted">{diaEHora(n.criadoEm)}</span>
                  </div>
                  {n.etapa ? <p className="mt-0.5 text-xs text-muted [overflow-wrap:anywhere]">{n.etapa}</p> : null}
                  <p className="mt-1 text-xs leading-relaxed text-muted [overflow-wrap:anywhere]">
                    <span className="font-semibold text-ink">{n.canal ? nomeDoGrupo(n.canal) : "Sem origem"}.</span>{" "}
                    {item ? <span className="text-ink">{item}. </span> : null}
                    {comoLigouOCarrinho(n)}
                  </p>
                  {n.pedido !== null ? (
                    <p className="mt-1 text-xs text-ink">
                      Este carrinho virou o{" "}
                      <button
                        type="button"
                        onClick={(e) => abrirHistoricoDoPedido(n.pedido as number, e.currentTarget)}
                        className="numeros font-semibold text-brand-nav underline-offset-2 hover:underline"
                      >
                        pedido {n.pedido}
                      </button>
                      {n.pago === false ? " (ainda não pago)" : ""}
                      {tempoAtePedido(n.horas) ? `, ${tempoAtePedido(n.horas)}` : ""}.
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {dados.lista.length > limite ? (
            <p className="mt-2 text-center">
              <button
                type="button"
                onClick={() => setLimite((x) => x + POR_VEZ * 2)}
                className="painel-toque inline-flex h-9 items-center rounded-full border border-ink/12 bg-white px-4 text-xs font-semibold text-ink"
              >
                Mostrar mais ({inteiro(dados.lista.length - limite)})
              </button>
            </p>
          ) : null}
          {dados.total > dados.lista.length ? (
            <p className="mt-2 text-[0.7rem] text-muted">
              A lista traz os {inteiro(dados.lista.length)} carrinhos mais novos do período; as contagens de cima são de todos.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
