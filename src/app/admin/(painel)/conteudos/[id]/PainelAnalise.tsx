"use client";

import { useMemo, useState, useTransition } from "react";
import {
  ChevronRight, Sparkles, Check, Copy, AlertTriangle, CircleAlert, CircleCheck,
} from "lucide-react";
import { analisar, type Check as Item, type Entrada, type Nivel } from "@/lib/analyzer/rules";
import { analisarIA, ajudarComItem } from "./actions";
import type { SugestaoIA } from "@/lib/analyzer/ai";

const ICONE: Record<Nivel, typeof CircleAlert> = {
  ok: CircleCheck,
  aviso: AlertTriangle,
  erro: CircleAlert,
};

const COR: Record<Nivel, string> = {
  ok: "text-brand-strong",
  aviso: "text-[#9a7b16]",
  erro: "text-wine",
};

function Medidor({ rotulo, valor }: { rotulo: string; valor: number }) {
  const cor = valor >= 80 ? "bg-brand" : valor >= 55 ? "bg-[#c9a227]" : "bg-wine";
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="eyebrow text-[0.62rem]">{rotulo}</span>
        <span className="font-display text-2xl text-ink">{valor}</span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-ink/10">
        <div className={`h-full rounded-full ${cor} transition-all duration-500`} style={{ width: `${valor}%` }} />
      </div>
    </div>
  );
}

/** Item do checklist, com assistente de IA embutido. */
function ItemCheck({
  item,
  ctx,
  aoAplicar,
}: {
  item: Item;
  ctx: { titulo: string; consultaAlvo: string; resposta: string; texto: string; metaDescription: string };
  aoAplicar?: (id: string, texto: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [ajuda, setAjuda] = useState<{ sugestao: string; explicacao: string; passos: string[] } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [carregando, iniciar] = useTransition();

  const Icone = ICONE[item.nivel];

  const abrir = () => {
    const novo = !aberto;
    setAberto(novo);
    if (novo && !ajuda && !carregando) {
      setErro(null);
      iniciar(async () => {
        const r = await ajudarComItem({ id: item.id, titulo: item.titulo, dica: item.dica }, ctx);
        if (r.ok) setAjuda({ sugestao: r.sugestao, explicacao: r.explicacao, passos: r.passos });
        else setErro(r.erro);
      });
    }
  };

  const copiar = async () => {
    if (!ajuda?.sugestao) return;
    await navigator.clipboard.writeText(ajuda.sugestao);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1600);
  };

  return (
    <li className="rounded-[12px] border border-transparent transition-colors hover:border-border/70 hover:bg-white/40">
      <button
        type="button"
        onClick={abrir}
        className="flex w-full items-start gap-2.5 px-2.5 py-2 text-left"
        aria-expanded={aberto}
      >
        <Icone size={14} className={`mt-0.5 shrink-0 ${COR[item.nivel]}`} />
        <span className="min-w-0 flex-1">
          <span className={`block text-sm font-medium ${COR[item.nivel]}`}>{item.titulo}</span>
          {item.dica ? (
            <span className="mt-0.5 block text-xs leading-relaxed text-muted">{item.dica}</span>
          ) : null}
        </span>
        <ChevronRight
          size={15}
          className={`mt-0.5 shrink-0 text-muted transition-transform ${aberto ? "rotate-90" : ""}`}
        />
      </button>

      {aberto ? (
        <div className="border-t border-border/60 px-3 py-3">
          {carregando ? (
            <p className="flex items-center gap-2 text-xs text-muted">
              <Sparkles size={13} className="animate-pulse text-brand-nav" />
              A IA está lendo seu conteúdo…
            </p>
          ) : erro ? (
            <p className="text-xs text-wine">{erro}</p>
          ) : ajuda ? (
            <div className="space-y-3">
              <p className="text-xs leading-relaxed text-muted">{ajuda.explicacao}</p>

              {ajuda.sugestao ? (
                <div className="rounded-[10px] border border-brand/25 bg-brand/6 p-3">
                  <p className="whitespace-pre-wrap text-xs leading-relaxed text-ink">{ajuda.sugestao}</p>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {aoAplicar ? (
                      <button
                        type="button"
                        onClick={() => aoAplicar(item.id, ajuda.sugestao)}
                        className="flex items-center gap-1.5 rounded-full bg-brand px-3 py-1.5 text-[0.7rem] font-semibold text-ink hover:bg-brand-light"
                      >
                        <Check size={12} /> Aplicar
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={copiar}
                      className="flex items-center gap-1.5 rounded-full border border-ink/15 px-3 py-1.5 text-[0.7rem] font-semibold text-ink hover:border-brand/50"
                    >
                      {copiado ? <Check size={12} /> : <Copy size={12} />}
                      {copiado ? "Copiado" : "Copiar"}
                    </button>
                  </div>
                </div>
              ) : null}

              {ajuda.passos.length > 0 ? (
                <ul className="space-y-1.5">
                  {ajuda.passos.map((p, i) => (
                    <li key={i} className="flex gap-2 text-xs text-muted">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand" />
                      {p}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

export function PainelAnalise({
  entrada,
  contentId,
  intencao,
  aoAplicar,
}: {
  entrada: Entrada;
  contentId: string;
  intencao: string;
  aoAplicar?: (id: string, texto: string) => void;
}) {
  const resultado = useMemo(() => analisar(entrada), [entrada]);
  const [ia, setIa] = useState<SugestaoIA | null>(null);
  const [erroIa, setErroIa] = useState<string | null>(null);
  const [carregando, iniciar] = useTransition();

  const problemas = resultado.checks.filter((c) => c.nivel !== "ok");
  const oks = resultado.checks.filter((c) => c.nivel === "ok");

  const ctx = {
    titulo: entrada.titulo,
    consultaAlvo: entrada.consultaAlvo,
    resposta: entrada.resposta,
    texto: entrada.texto,
    metaDescription: entrada.metaDescription,
  };

  const rodarIA = () => {
    setErroIa(null);
    iniciar(async () => {
      const r = await analisarIA({ id: contentId, intencao, ...ctx });
      if (r.ok) setIa(r.dados);
      else setErroIa(r.erro);
    });
  };

  return (
    <div className="space-y-5">
      <div className="glass rounded-[18px] p-5">
        <div className="flex items-baseline justify-between">
          <p className="eyebrow">Análise</p>
          <span className="font-display text-4xl text-ink">{resultado.nota}</span>
        </div>
        {/* Voz entra aqui porque pesa 20% da nota grande ao lado e não aparecia
            em lugar nenhum: a nota caía e não havia como saber por quê. */}
        <div className="mt-4 grid grid-cols-3 gap-3">
          <Medidor rotulo="SEO" valor={resultado.notaSeo} />
          <Medidor rotulo="GEO" valor={resultado.notaGeo} />
          <Medidor rotulo="Voz" valor={resultado.notaVoz} />
        </div>
      </div>

      <div className="glass rounded-[18px] p-4">
        <div className="flex items-center gap-2 px-1.5 pb-2">
          <p className="eyebrow">
            {problemas.length > 0 ? `${problemas.length} a resolver` : "Tudo certo"}
          </p>
          <span className="flex items-center gap-1 text-[0.65rem] text-muted">
            <Sparkles size={11} className="text-brand-nav" />
            clique para a IA ajudar
          </span>
        </div>

        <ul className="space-y-0.5">
          {problemas.map((c) => (
            <ItemCheck key={c.id} item={c} ctx={ctx} aoAplicar={aoAplicar} />
          ))}
        </ul>

        {problemas.length === 0 ? (
          <p className="px-2 py-2 text-sm text-muted">
            Passou nas checagens automáticas. Rode a análise com IA antes de publicar.
          </p>
        ) : null}

        {oks.length > 0 ? (
          <details className="mt-3 px-1.5">
            <summary className="cursor-pointer text-xs font-semibold text-brand-nav">
              Ver {oks.length} itens aprovados
            </summary>
            <ul className="mt-2 space-y-1.5 pb-1">
              {oks.map((c) => (
                <li key={c.id} className="flex items-start gap-2 text-xs text-muted">
                  <CircleCheck size={12} className="mt-0.5 shrink-0 text-brand" />
                  {c.titulo}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>

      <div className="glass rounded-[18px] p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="eyebrow">Revisão completa</p>
            <p className="mt-1 text-xs text-muted">Profundidade, citabilidade e voz da marca.</p>
          </div>
          <button
            type="button"
            onClick={rodarIA}
            disabled={carregando}
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-charcoal disabled:opacity-60"
          >
            <Sparkles size={13} />
            {carregando ? "Revisando…" : ia ? "Revisar de novo" : "Revisar"}
          </button>
        </div>

        {erroIa ? (
          <p className="mt-4 rounded-[12px] border border-wine/25 bg-wine/5 px-3 py-2 text-xs text-wine">{erroIa}</p>
        ) : null}

        {ia ? (
          <div className="mt-5 space-y-5 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <Medidor rotulo="SEO por IA" valor={ia.notaSeo} />
              <Medidor rotulo="GEO por IA" valor={ia.notaGeo} />
            </div>

            <p className="leading-relaxed text-foreground">{ia.resumo}</p>

            <p className={`text-xs font-semibold ${ia.respondeIntencao ? "text-brand-strong" : "text-wine"}`}>
              {ia.respondeIntencao ? "Responde a intenção declarada." : "Não responde totalmente a intenção declarada."}
            </p>

            {ia.problemasDeVoz.length > 0 ? (
              <div>
                <p className="eyebrow text-[0.62rem]">Voz da marca</p>
                <ul className="mt-2 space-y-2.5">
                  {ia.problemasDeVoz.map((p, i) => (
                    <li key={i} className="rounded-[12px] border border-wine/20 bg-wine/5 p-3">
                      <p className="text-xs font-semibold text-wine">&ldquo;{p.trecho}&rdquo;</p>
                      <p className="mt-1 text-xs text-muted">{p.porque}</p>
                      {p.sugestao ? <p className="mt-1.5 text-xs text-ink">Troque por: {p.sugestao}</p> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {ia.problemas.length > 0 ? (
              <div>
                <p className="eyebrow text-[0.62rem]">O que melhorar</p>
                <ul className="mt-2 space-y-2.5">
                  {ia.problemas.map((p, i) => (
                    <li key={i}>
                      <p className="text-xs font-semibold text-ink">{p.titulo}</p>
                      <p className="mt-0.5 text-xs text-muted">{p.porque}</p>
                      <p className="mt-0.5 text-xs text-brand-strong">{p.comoResolver}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {ia.trechosCitaveis.length > 0 ? (
              <div>
                <p className="eyebrow text-[0.62rem]">Trechos que a IA citaria</p>
                <ul className="mt-2 space-y-1.5">
                  {ia.trechosCitaveis.map((t, i) => (
                    <li key={i} className="rounded-[10px] bg-brand/8 px-3 py-2 text-xs leading-relaxed text-ink">{t}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {ia.faqSugeridas.length > 0 ? (
              <div>
                <p className="eyebrow text-[0.62rem]">Perguntas que faltam</p>
                <ul className="mt-2 space-y-2">
                  {ia.faqSugeridas.map((f, i) => (
                    <li key={i}>
                      <p className="text-xs font-semibold text-ink">{f.question}</p>
                      {f.answer ? <p className="text-xs text-muted">{f.answer}</p> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {ia.metaDescriptionSugerida ? (
              <div>
                <p className="eyebrow text-[0.62rem]">Meta description sugerida</p>
                <p className="mt-1.5 text-xs leading-relaxed text-muted">{ia.metaDescriptionSugerida}</p>
                {aoAplicar ? (
                  <button
                    type="button"
                    onClick={() => aoAplicar("meta", ia.metaDescriptionSugerida)}
                    className="mt-2 flex items-center gap-1.5 rounded-full bg-brand px-3 py-1.5 text-[0.7rem] font-semibold text-ink hover:bg-brand-light"
                  >
                    <Check size={12} /> Aplicar
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
