"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Check, Circle } from "lucide-react";
import type { EstadoDaAppmax } from "@/lib/appmax/estado";
import type { IntegracaoState } from "./actions";
import { salvarCredencialDaAppmax } from "./appmax-actions";

const campo =
  "w-full rounded-[10px] border border-border bg-white/80 px-3 py-2 text-sm text-ink outline-none transition-colors hover:border-brand/40 focus:border-brand";

const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (f: number) => `${(f * 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
const ROTULO_DO_MEIO: Record<string, string> = { credit_card: "Cartão", pix: "Pix", bank_slip: "Boleto", outro: "Outro" };

function BotaoSalvar() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-brand px-4 py-2 text-xs font-semibold text-ink transition-colors hover:bg-brand-light disabled:opacity-60"
    >
      {pending ? "Conferindo na Appmax…" : "Salvar"}
    </button>
  );
}

/**
 * Credencial da Appmax (Client ID e Client Secret de Produção) e o que a leitura já trouxe. Os campos são só de
 * escrita: nascem vazios mesmo com credencial salva, e o segredo nunca volta para a tela.
 */
export function CartaoDaAppmax({ estado }: { estado: EstadoDaAppmax }) {
  const [resposta, salvar] = useActionState<IntegracaoState, FormData>(salvarCredencialDaAppmax, {});
  const lendo = estado.configurada && estado.lidos > 0 && (estado.pulso?.ok ?? false);
  const r = estado.resumo;
  const total = r?.porMeio.reduce((s, m) => s + m.total, 0) ?? 0;
  const descontado = r?.porMeio.reduce((s, m) => s + m.descontado, 0) ?? 0;

  return (
    <form action={salvar} className="glass rounded-[18px] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-ink">Appmax, taxa real de cada venda</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Lê na Appmax, de 10 em 10 minutos, o que foi descontado de cada venda paga: taxa de processamento, gateway e
            antifraude, parcelamento e o líquido. O painel só lê: não cria pedido, não estorna e não mexe em saque nem
            antecipação.
          </p>
        </div>
        <span
          className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.68rem] font-semibold ${
            lendo ? "bg-brand/15 text-brand-strong" : "bg-ink/8 text-muted"
          }`}
        >
          {lendo ? <Check size={11} /> : <Circle size={9} />}
          {lendo ? "Lendo" : estado.configurada ? "Com credencial" : "Sem credencial"}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold text-ink">Client ID</span>
          <input
            name="client_id"
            autoComplete="off"
            placeholder={estado.configurada ? "Salvo. Cole outro para trocar." : "Client ID de Produção"}
            className={`${campo} mt-1`}
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-ink">Client Secret</span>
          <input
            name="client_secret"
            type="password"
            autoComplete="off"
            placeholder={estado.configurada ? "Salvo. Cole outro para trocar." : "Client Secret de Produção"}
            className={`${campo} mt-1`}
          />
        </label>
      </div>
      <p className="mt-1 text-[0.68rem] leading-snug text-muted">
        Na Appmax: API, Gerar credenciais, ambiente Produção. O Client Secret aparece uma vez só. Cole os dois aqui, nunca
        em conversa.
      </p>

      {estado.configurada ? (
        <dl className="mt-4 grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-[10px] bg-white/60 p-2.5">
            <dt className="text-muted">Pedidos ligados</dt>
            <dd className="mt-0.5 text-base font-semibold text-ink">{estado.vinculados}</dd>
          </div>
          <div className="rounded-[10px] bg-white/60 p-2.5">
            <dt className="text-muted">Taxa já lida</dt>
            <dd className="mt-0.5 text-base font-semibold text-ink">{estado.lidos}</dd>
          </div>
          <div className="rounded-[10px] bg-white/60 p-2.5">
            <dt className="text-muted">Com erro</dt>
            <dd className={`mt-0.5 text-base font-semibold ${estado.comErro > 0 ? "text-wine" : "text-ink"}`}>{estado.comErro}</dd>
          </div>
        </dl>
      ) : null}

      {estado.pulso && !estado.pulso.ok ? <p className="mt-3 text-xs text-wine">Última leitura: {estado.pulso.detalhe}</p> : null}

      {r && r.lidos > 0 ? (
        <div className="mt-4 text-xs text-ink">
          <p className="font-semibold">O que a Appmax descontou nos últimos 30 dias</p>
          <p className="mt-0.5 text-muted">
            {r.lidos} de {r.pagosNoPeriodo} pedidos pagos já lidos. No total, {reais(descontado)} sobre {reais(total)} vendidos:{" "}
            <span className="font-semibold text-ink">{total > 0 ? pct(descontado / total) : "sem venda"}</span> em média.
          </p>
          <ul className="mt-2 space-y-1">
            {r.porMeio.map((m) => (
              <li key={m.meio} className="flex flex-wrap justify-between gap-x-3 rounded-[10px] bg-white/60 px-2.5 py-1.5">
                <span className="font-semibold">{ROTULO_DO_MEIO[m.meio] ?? m.meio}</span>
                <span className="text-muted">
                  {m.pedidos} pedidos, {reais(m.descontado)} ({m.total > 0 ? pct(m.descontado / m.total) : "-"})
                  {m.parcelasMedias ? `, ${m.parcelasMedias.toLocaleString("pt-BR")}x em média` : ""}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[0.68rem] leading-snug text-muted">
            Não inclui a antecipação, o saque nem o estorno: a Appmax não entrega esses por pedido.
          </p>
        </div>
      ) : null}

      {resposta.erro ? <p className="mt-3 text-xs text-wine">{resposta.erro}</p> : null}
      {resposta.ok ? <p className="mt-3 text-xs text-brand-strong">{resposta.ok}</p> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <BotaoSalvar />
        {estado.configurada ? (
          <button
            type="submit"
            name="remover"
            value="1"
            className="rounded-full border border-ink/15 px-4 py-2 text-xs font-semibold text-ink transition-colors hover:border-wine/50 hover:text-wine"
          >
            Remover credencial
          </button>
        ) : null}
      </div>
    </form>
  );
}
