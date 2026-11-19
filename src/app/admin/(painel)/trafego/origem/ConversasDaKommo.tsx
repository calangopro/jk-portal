"use client";

import { useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import {
  NOME_DA_ORIGEM,
  ORIGENS_DO_NEGOCIO,
  comoLigouONegocio,
  type NegociosPorOrigem,
  type OrigemDoNegocio,
} from "@/lib/kommo/origem";

/**
 * As conversas do WhatsApp (negócios da Kommo) do período, separadas pela
 * origem: anúncio ligado pelo número, número de anúncio que não casou, UTM,
 * código do site e sem origem. Lido por `kommo_negocios_por_origem` (0170).
 *
 * Sem nome do cliente, telefone nem texto da conversa: o negócio, o funil, a
 * etapa, o valor e de onde veio. O número do negócio abre ele na Kommo.
 *
 * No celular cada negócio é um cartão; não há tabela.
 */

const POR_VEZ = 30;
const inteiro = (n: number) => n.toLocaleString("pt-BR");
const reais = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const diaEHora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";

const EXPLICACAO: Record<OrigemDoNegocio, string> = {
  anuncio: "O Meta mandou à Kommo o número do anúncio, e ele está entre os anúncios lidos.",
  id_sem_casar: "Chegou com número de anúncio que não está entre os lidos (anúncio de outra conta ou anterior à leitura).",
  utm: "Chegou com UTM ou clique de anúncio, sem número que case.",
  codigo: "Ainda não existe: depende de um passo do Salesbot na Kommo (ver docs/kommo.md).",
  sem_origem: "Nada que diga de onde veio.",
};

export function ConversasDaKommo({ dados }: { dados: NegociosPorOrigem | null }) {
  const [origem, setOrigem] = useState<OrigemDoNegocio | "todas">("todas");
  const [limite, setLimite] = useState(POR_VEZ);

  const lista = useMemo(() => (dados?.lista ?? []).filter((n) => origem === "todas" || n.origem === origem), [dados, origem]);

  if (!dados) {
    return (
      <section aria-label="Conversas do WhatsApp" className="glass mt-6 rounded-[18px] p-4 sm:p-5">
        <p className="eyebrow">Conversas do WhatsApp, pela Kommo</p>
        <p className="mt-2 text-sm text-muted">Não deu para ler os negócios da Kommo agora.</p>
      </section>
    );
  }

  const total = dados.total;
  const parte = (n: number) => (total > 0 ? `${Math.round((n / total) * 100)}%` : "");

  return (
    <section aria-label="Conversas do WhatsApp" className="glass mt-6 rounded-[18px] p-4 sm:p-5">
      <p className="eyebrow">Conversas do WhatsApp, pela Kommo</p>
      <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted">
        Cada negócio criado na Kommo no período e de onde ele veio. O clique para WhatsApp não passa pelo site, então a origem é o
        número do anúncio que o Meta manda junto da primeira mensagem.
        {dados.lidoEm === null ? " A Kommo ainda não foi lida pelo painel: tudo fica em zero até a chave ser colada em Integrações." : ""}
      </p>

      <div className="mt-3 flex gap-1.5 overflow-x-auto painel-fila pb-1" role="group" aria-label="Filtrar pela origem">
        {(["todas", ...ORIGENS_DO_NEGOCIO] as const).map((o) => {
          const ativo = origem === o;
          const n = o === "todas" ? total : dados.porOrigem[o].negocios;
          return (
            <button
              key={o}
              type="button"
              aria-pressed={ativo}
              onClick={() => {
                setOrigem(o);
                setLimite(POR_VEZ);
              }}
              className={`painel-toque inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold ${
                ativo ? "border-ink bg-ink text-white" : "border-ink/12 bg-white text-ink"
              }`}
            >
              {o === "todas" ? "Todas" : NOME_DA_ORIGEM[o]}
              <span className="numeros">{inteiro(n)}</span>
            </button>
          );
        })}
      </div>

      <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-xs sm:grid-cols-2 lg:grid-cols-3">
        {ORIGENS_DO_NEGOCIO.map((o) => {
          const c = dados.porOrigem[o];
          return (
            <div key={o} className="min-w-0">
              <dt className="font-semibold text-ink">
                {NOME_DA_ORIGEM[o]}{" "}
                <span className="numeros font-normal text-muted">
                  {inteiro(c.negocios)} {c.negocios === 1 ? "negócio" : "negócios"}
                  {c.negocios > 0 ? ` (${parte(c.negocios)})` : ""}
                  {c.ganhos > 0 ? `, ${inteiro(c.ganhos)} ${c.ganhos === 1 ? "ganho" : "ganhos"} (${reais(c.valor)})` : ""}
                </span>
              </dt>
              <dd className="text-muted">{EXPLICACAO[o]}</dd>
            </div>
          );
        })}
      </dl>

      {lista.length === 0 ? (
        <p className="mt-4 text-sm text-muted">Nenhum negócio com essa origem no período.</p>
      ) : (
        <ul className="mt-4 divide-y divide-ink/[0.07]">
          {lista.slice(0, limite).map((n) => (
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
              <p className="mt-0.5 text-xs text-muted [overflow-wrap:anywhere]">
                {[n.funil, n.etapa].filter(Boolean).join(" › ") || "Funil desconhecido"}
                {n.ganho ? ` · ganho${n.valor > 0 ? `, ${reais(n.valor)}` : ""}` : ""}
              </p>
              {n.origem === "anuncio" ? (
                <p className="mt-1 text-sm leading-snug text-ink [overflow-wrap:anywhere]">
                  {n.anuncio ?? n.conjunto ?? n.campanha ?? "Item sem nome"}
                  {n.anuncio && (n.conjunto || n.campanha) ? (
                    <span className="block text-xs text-muted">em {[n.campanha, n.conjunto].filter(Boolean).join(" › ")}</span>
                  ) : n.conjunto && n.campanha ? (
                    <span className="block text-xs text-muted">em {n.campanha}</span>
                  ) : null}
                </p>
              ) : null}
              <p className="mt-1 text-xs leading-relaxed text-muted [overflow-wrap:anywhere]">
                <span className="font-semibold text-ink">{NOME_DA_ORIGEM[n.origem]}.</span> {comoLigouONegocio(n)}
              </p>
            </li>
          ))}
        </ul>
      )}
      {lista.length > limite ? (
        <p className="mt-2 text-center">
          <button
            type="button"
            onClick={() => setLimite((x) => x + POR_VEZ * 2)}
            className="painel-toque inline-flex h-9 items-center rounded-full border border-ink/12 bg-white px-4 text-xs font-semibold text-ink"
          >
            Mostrar mais ({inteiro(lista.length - limite)})
          </button>
        </p>
      ) : null}
      {total > dados.lista.length ? (
        <p className="mt-2 text-[0.7rem] text-muted">
          A lista traz os {inteiro(dados.lista.length)} negócios mais novos do período; as contagens de cima são de todos.
        </p>
      ) : null}
    </section>
  );
}
