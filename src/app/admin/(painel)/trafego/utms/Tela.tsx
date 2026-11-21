"use client";

import { useMemo, useState } from "react";
import { Link2, Megaphone, TriangleAlert } from "lucide-react";
import { SITE } from "@/lib/seo/site";
import { ATALHOS, PADROES, montarLink } from "@/lib/trafego/utms";
import { NOME_DO_CANAL } from "@/lib/vendas/origem";
import { BotaoCopiar } from "../../bio/LinksParaDivulgar";

const campo =
  "h-10 w-full min-w-0 rounded-[10px] border border-border bg-white/80 px-3 text-sm text-ink outline-none focus:border-brand";

/**
 * A tela só desenha e copia. O padrão e a montagem do link moram em
 * `lib/trafego/utms.ts`, com teste.
 */
export function TelaDeUtms() {
  const [atalho, setAtalho] = useState(ATALHOS[0].id);
  const escolhido = ATALHOS.find((a) => a.id === atalho) ?? ATALHOS[0];
  const [destino, setDestino] = useState<string>(SITE.lojaUrl);
  const [source, setSource] = useState(escolhido.source);
  const [medium, setMedium] = useState(escolhido.medium);
  const [campaign, setCampaign] = useState("");
  const [content, setContent] = useState("");

  const escolher = (id: string) => {
    const a = ATALHOS.find((x) => x.id === id);
    if (!a) return;
    setAtalho(id);
    setSource(a.source);
    setMedium(a.medium);
  };

  const link = useMemo(() => montarLink({ destino, source, medium, campaign, content }), [destino, source, medium, campaign, content]);

  return (
    <div className="grid min-w-0 grid-cols-1 gap-5">
      <header>
        <p className="eyebrow">Tráfego</p>
        <h1 className="mt-1 text-2xl font-semibold text-ink">Links e UTMs</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          O padrão de etiqueta da JK, pronto para copiar. É com ele que a origem dos pedidos liga cada venda ao anúncio
          exato, pelo nome e pelo número da campanha, do conjunto e do anúncio.
        </p>
      </header>

      <section className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
        {PADROES.map((p) => (
          <div key={p.plataforma} className="glass min-w-0 rounded-[18px] p-5">
            <div className="flex items-center gap-2">
              <Megaphone size={16} className="text-[var(--setor)]" aria-hidden />
              <h2 className="font-medium text-ink">{p.plataforma}</h2>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted">{p.onde}</p>
            <div className="mt-3 flex min-w-0 items-start gap-2 rounded-[12px] border border-border bg-white/70 p-3">
              <code className="min-w-0 flex-1 text-[0.72rem] leading-relaxed text-ink [overflow-wrap:anywhere]">{p.valor}</code>
              <BotaoCopiar valor={p.valor} />
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted">{p.nota}</p>
          </div>
        ))}
      </section>

      <section className="glass min-w-0 rounded-[18px] p-5">
        <div className="flex items-center gap-2">
          <Link2 size={16} className="text-[var(--setor)]" aria-hidden />
          <h2 className="font-medium text-ink">Link sem anúncio</h2>
        </div>
        <p className="mt-1 text-xs text-muted">
          Para WhatsApp, influenciador, e-mail e o que mais não for anúncio. O link da bio não precisa: a própria bio
          reconhece de onde a pessoa veio.
        </p>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {ATALHOS.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => escolher(a.id)}
              aria-pressed={atalho === a.id}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                atalho === a.id ? "border-[var(--setor)] bg-[var(--setor)] text-white" : "border-ink/15 text-ink hover:border-[var(--setor)]"
              }`}
            >
              {a.nome}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">{escolhido.dica}</p>

        <div className="mt-4 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block min-w-0 sm:col-span-2">
            <span className="text-xs font-semibold text-ink">Destino (página da loja ou do portal)</span>
            <input value={destino} onChange={(e) => setDestino(e.target.value)} className={`mt-1 ${campo}`} inputMode="url" />
          </label>
          <label className="block min-w-0">
            <span className="text-xs font-semibold text-ink">Campanha</span>
            <input value={campaign} onChange={(e) => setCampaign(e.target.value)} placeholder="black_2026" className={`mt-1 ${campo}`} />
          </label>
          <label className="block min-w-0">
            <span className="text-xs font-semibold text-ink">Conteúdo (opcional)</span>
            <input value={content} onChange={(e) => setContent(e.target.value)} placeholder="anel_solitario" className={`mt-1 ${campo}`} />
          </label>
          <label className="block min-w-0">
            <span className="text-xs font-semibold text-ink">Origem (utm_source)</span>
            <input value={source} onChange={(e) => setSource(e.target.value)} className={`mt-1 ${campo}`} />
          </label>
          <label className="block min-w-0">
            <span className="text-xs font-semibold text-ink">Meio (utm_medium)</span>
            <input value={medium} onChange={(e) => setMedium(e.target.value)} className={`mt-1 ${campo}`} />
          </label>
        </div>

        <div className="mt-4 min-w-0 rounded-[12px] border border-border bg-white/70 p-3">
          {link.url ? (
            <div className="flex min-w-0 items-start gap-2">
              <code className="min-w-0 flex-1 text-[0.72rem] leading-relaxed text-ink [overflow-wrap:anywhere]">{link.url}</code>
              <BotaoCopiar valor={link.url} />
            </div>
          ) : (
            <p className="text-xs text-muted">Preencha a campanha para montar o link.</p>
          )}
          {link.canal ? (
            <p className="mt-2 text-xs text-muted">
              Entra na origem dos pedidos como <strong className="text-ink">{NOME_DO_CANAL[link.canal]}</strong>.
            </p>
          ) : null}
        </div>
        {link.avisos.map((a) => (
          <p key={a} className="mt-2 flex items-start gap-1.5 text-xs text-amber-800">
            <TriangleAlert size={13} className="mt-0.5 shrink-0" aria-hidden />
            <span>{a}</span>
          </p>
        ))}
      </section>

      <section className="glass min-w-0 rounded-[18px] p-5">
        <h2 className="font-medium text-ink">Regras que evitam venda perdida na conta</h2>
        <ul className="mt-3 grid gap-2 text-sm leading-relaxed text-muted">
          <li>
            <strong className="text-ink">Link de dentro do site não leva UTM.</strong> Do portal para a loja, da loja para a
            loja: a UTM abre outra sessão e a venda deixa de ser de quem trouxe a pessoa.
          </li>
          <li>
            <strong className="text-ink">Meio paid ou cpc é só de anúncio.</strong> Usado num link de grupo ou de
            influenciador, a venda conta como anúncio e engorda o resultado da campanha.
          </li>
          <li>
            <strong className="text-ink">Um padrão por plataforma, sem texto fixo.</strong> UTM digitada à mão no anúncio
            (como direct_sales) só liga até o conjunto. Com as macros, liga ao anúncio exato.
          </li>
          <li>
            <strong className="text-ink">Campanha com nome em minúsculas e sublinhado</strong> (black_2026, natal_2026). O
            montador já escreve assim.
          </li>
        </ul>
      </section>
    </div>
  );
}
