"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { ROTULO_DO_MATERIAL } from "@/lib/margem/calculo";
import { salvarCustoDeProduto } from "../margem/actions";
import { lerNumero } from "../margem/PainelDeMargem";
import { pct, reais, type MargemNaLista } from "./util";

const mostrar = (n: number | null) => (n === null ? "" : n.toLocaleString("pt-BR", { maximumFractionDigits: 3, useGrouping: false }));

/**
 * Custo e margem do produto, na gaveta. Só aparece para administrador. Peça de
 * ouro mostra o peso (vazio = o da família); o resto, o custo fixo.
 */
export function MargemNaGaveta({ productId, margem }: { productId: string; margem: MargemNaLista | null }) {
  const router = useRouter();
  const ouro = Boolean(margem?.material);
  const [gramas, setGramas] = useState(mostrar(margem?.gramas ?? null));
  const [resto, setResto] = useState(mostrar(margem?.resto ?? null));
  const [fixo, setFixo] = useState(mostrar(margem?.custoFixo ?? null));
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [salvando, comecar] = useTransition();

  const salvar = () =>
    comecar(async () => {
      const patch = ouro
        ? { gramas: lerNumero(gramas), resto: lerNumero(resto) }
        : { custoFixo: lerNumero(fixo) };
      if (Object.values(patch).some((v) => v !== null && (!Number.isFinite(v) || v < 0))) {
        setAviso({ ok: false, texto: "Número inválido." });
        return;
      }
      const r = await salvarCustoDeProduto(productId, patch);
      setAviso(r.ok ? { ok: true, texto: "Custo salvo." } : { ok: false, texto: r.erro });
      if (r.ok) router.refresh();
    });

  const campo = "mt-1 h-9 w-full rounded-[8px] border border-border bg-white px-2 text-sm outline-none focus:border-brand";

  return (
    <section className="mt-6 rounded-[14px] border border-border bg-white/70 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-ink">Custo e margem</p>
        <Link href="/admin/margem" className="text-xs font-semibold text-brand-nav hover:underline">
          Parâmetros
        </Link>
      </div>

      {margem && margem.custo !== null && margem.fracao !== null ? (
        <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
          <div>
            <dt className="text-xs text-muted">Custo</dt>
            <dd className="font-semibold text-ink">{reais(margem.custo)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Margem no preço cheio</dt>
            <dd className={`font-semibold ${margem.abaixo ? "text-wine" : "text-emerald-800"}`}>
              {pct(margem.fracao, 1)} <span className="text-xs font-normal text-muted">({reais(margem.reais)})</span>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Desconto máximo</dt>
            <dd className="font-semibold text-ink">{pct(margem.descontoMaximo)}</dd>
          </div>
        </dl>
      ) : (
        <p className="mt-2 text-sm text-muted">{margem?.falta ?? "Sem custo"}.</p>
      )}
      {margem?.detalhe ? <p className="mt-2 text-xs text-muted">{margem.detalhe}</p> : null}

      {margem?.cpaMaximo !== null && margem?.cpaMaximo !== undefined ? (
        <div className={`mt-3 rounded-[10px] px-3 py-2 text-sm ${margem.cpaMaximo > 0 ? "bg-emerald-50 text-emerald-900" : "bg-wine/10 text-wine"}`}>
          {margem.cpaMaximo > 0 ? (
            <>
              <span className="font-semibold">Anúncio: pode pagar até {reais(margem.cpaMaximo)} por venda</span>{" "}
              (ROAS mínimo de {margem.roasMinimo!.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}x). Empata em{" "}
              {reais(margem.cpaEmpate ?? 0)}.
            </>
          ) : (
            <span className="font-semibold">
              Neste preço não aguenta anúncio: qualquer real tira a peça da margem mínima
              {margem.cpaEmpate && margem.cpaEmpate > 0 ? ` (empata em ${reais(margem.cpaEmpate)})` : ""}.
            </span>
          )}
          <Link href="/admin/anuncios" className="ml-1 text-xs font-semibold underline">
            Ver todos
          </Link>
        </div>
      ) : null}

      {margem?.descontoHoje ? (
        <p className={`mt-2 flex items-center gap-1.5 text-xs ${margem.hojePassa ? "text-wine" : "text-muted"}`}>
          {margem.hojePassa ? <AlertTriangle size={12} /> : null}
          Promoção de hoje: {pct(margem.descontoHoje)} de desconto, margem {pct(margem.fracaoHoje, 1)}
          {margem.hojePassa ? ", abaixo da mínima" : ""}.
        </p>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-3">
        {ouro ? (
          <>
            <label className="text-xs font-semibold text-ink">
              Gramas deste produto
              <input inputMode="decimal" value={gramas} onChange={(e) => setGramas(e.target.value)} className={campo}
                placeholder={margem?.familia ? `vazio: o da ${margem.familia}` : ""} />
            </label>
            <label className="text-xs font-semibold text-ink">
              Resto da peça (R$)
              <input inputMode="decimal" value={resto} onChange={(e) => setResto(e.target.value)} className={campo}
                placeholder={margem?.familia ? `vazio: o da ${margem.familia}` : ""} />
            </label>
            <p className="col-span-2 text-[0.7rem] text-muted">
              {ROTULO_DO_MATERIAL[margem!.material!]}
              {margem?.familia ? `, família ${margem.familia}. Preencha só se este produto pesar diferente da família.` : ", sem família: preencha o peso aqui."}
            </p>
          </>
        ) : (
          <label className="col-span-2 text-xs font-semibold text-ink sm:col-span-1">
            Custo da peça (R$)
            <input inputMode="decimal" value={fixo} onChange={(e) => setFixo(e.target.value)} className={campo} />
          </label>
        )}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={salvar}
          disabled={salvando}
          className="rounded-full bg-ink px-4 py-1.5 text-sm font-semibold text-white hover:bg-charcoal disabled:opacity-60"
        >
          {salvando ? "Salvando…" : "Salvar custo"}
        </button>
        {aviso ? <p className={`text-xs ${aviso.ok ? "text-brand-strong" : "text-wine"}`}>{aviso.texto}</p> : null}
      </div>
    </section>
  );
}
