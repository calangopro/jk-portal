"use client";

import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, Check, RotateCcw, Wand2 } from "lucide-react";
import { GRUPOS, TOKENS_DE_COR, TOKENS_DE_RAIO, type GrupoDeToken } from "@/lib/tema/tokens";
import { avaliarTema } from "@/lib/tema/contraste";
import { medidaValida, temaPadrao, type Tema } from "@/lib/tema/tipos";
import { SeletorDeCor } from "./SeletorDeCor";
import { Amostra } from "./Amostra";
import { salvarAparencia } from "./actions";

const rotulo = "block text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted";

export function Aparencia({ inicial }: { inicial: Tema }) {
  const padrao = useMemo(() => temaPadrao(), []);
  const [cores, setCores] = useState(inicial.cores);
  const [raios, setRaios] = useState(inicial.raios);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [enviando, iniciar] = useTransition();

  const avaliacoes = useMemo(() => avaliarTema(cores), [cores]);
  const reprovados = avaliacoes.filter((a) => !a.passa);
  const raiosInvalidos = Object.entries(raios).filter(([, v]) => !medidaValida(v));
  const podeSalvar = reprovados.length === 0 && raiosInvalidos.length === 0;

  const mudou =
    JSON.stringify(cores) !== JSON.stringify(inicial.cores) ||
    JSON.stringify(raios) !== JSON.stringify(inicial.raios);

  function trocarCor(nome: string, valor: string) {
    setCores((c) => ({ ...c, [nome]: valor }));
    setSalvo(false);
    setErro(null);
  }

  function aplicarSugestao(token: string, cor: string) {
    trocarCor(token, cor.toLowerCase());
  }

  function voltarTudoAoPadrao() {
    setCores(padrao.cores);
    setRaios(padrao.raios);
    setSalvo(false);
    setErro(null);
  }

  function salvar() {
    setErro(null);
    iniciar(async () => {
      const r = await salvarAparencia({ versao: 1, cores, raios, fonte: inicial.fonte });
      if (r.ok) {
        setSalvo(true);
      } else {
        setErro(r.erro);
      }
    });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_26rem] lg:items-start">
      {/* ------------------------------------------------------- controles */}
      <div className="space-y-7">
        {(Object.keys(GRUPOS) as GrupoDeToken[]).map((grupo) => {
          const doGrupo = TOKENS_DE_COR.filter((t) => t.grupo === grupo);
          if (doGrupo.length === 0) return null;
          return (
            <section key={grupo} className="glass rounded-[18px] p-5">
              <h2 className="text-sm font-semibold text-ink">{GRUPOS[grupo]}</h2>
              <div className="mt-4 space-y-4">
                {doGrupo.map((t) => (
                  <div key={t.nome} className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-start">
                    <div className="min-w-0">
                      <label className={rotulo}>{t.rotulo}</label>
                      <p className="mt-1 text-xs leading-relaxed text-muted">{t.ajuda}</p>
                    </div>
                    <SeletorDeCor
                      rotulo={t.rotulo}
                      valor={cores[t.nome] ?? t.padrao}
                      padrao={t.padrao}
                      aoMudar={(v) => trocarCor(t.nome, v)}
                    />
                  </div>
                ))}
              </div>
            </section>
          );
        })}

        <section className="glass rounded-[18px] p-5">
          <h2 className="text-sm font-semibold text-ink">Cantos</h2>
          <p className="mt-1 text-xs text-muted">
            Quanto os cantos são arredondados. Aceita px ou rem, por exemplo 10px ou 0.75rem.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {TOKENS_DE_RAIO.map((t) => {
              const valor = raios[t.nome] ?? t.padrao;
              const invalido = !medidaValida(valor);
              return (
                <div key={t.nome}>
                  <label className={rotulo} htmlFor={`raio-${t.nome}`}>
                    {t.rotulo}
                  </label>
                  <div className="mt-1.5 flex items-center gap-2">
                    <input
                      id={`raio-${t.nome}`}
                      value={valor}
                      onChange={(e) => {
                        setRaios((r) => ({ ...r, [t.nome]: e.target.value }));
                        setSalvo(false);
                      }}
                      className={`numeros w-28 rounded-[10px] border bg-white/80 px-3 py-2 font-mono text-xs text-ink outline-none transition-colors ${
                        invalido ? "border-wine focus:border-wine" : "border-border focus:border-brand"
                      }`}
                    />
                    <span
                      aria-hidden
                      className="h-9 w-9 shrink-0 border border-brand/40 bg-brand/15"
                      style={{ borderRadius: invalido ? undefined : valor }}
                    />
                  </div>
                  <p className="mt-1 text-[0.68rem] text-muted">{t.ajuda}</p>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* --------------------------------------------- contraste + preview */}
      <div className="space-y-5 lg:sticky lg:top-6">
        <section
          className={`rounded-[18px] border p-5 ${
            reprovados.length > 0 ? "border-wine/40 bg-wine/5" : "border-border bg-white/70"
          }`}
        >
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
            {reprovados.length > 0 ? (
              <AlertTriangle size={15} className="text-wine" />
            ) : (
              <Check size={15} className="text-brand-strong" />
            )}
            Legibilidade
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Cada linha é uma combinação que existe de verdade no site. A conta é a da
            WCAG, o mesmo critério que o Google usa para acessibilidade.
          </p>

          <ul className="mt-3.5 space-y-2">
            {avaliacoes.map((a) => (
              <li
                key={`${a.frente}-${a.fundo}`}
                className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-border/60 pb-2 last:border-0 last:pb-0"
              >
                <span className="text-xs text-ink">{a.onde}</span>
                <span className="flex items-center gap-2">
                  <span
                    className={`numeros text-xs font-semibold ${
                      a.passa ? "text-brand-strong" : "text-wine"
                    }`}
                  >
                    {a.razaoTexto}
                  </span>
                  {!a.passa && a.sugestao && !a.semSaida ? (
                    <button
                      type="button"
                      onClick={() => aplicarSugestao(a.frente, a.sugestao!)}
                      className="inline-flex items-center gap-1 rounded-full bg-ink px-2 py-0.5 text-[0.65rem] font-semibold text-white transition-opacity hover:opacity-85"
                      title={`Usar ${a.sugestao}, o tom mais próximo que passa`}
                    >
                      <Wand2 size={10} />
                      corrigir
                    </button>
                  ) : null}
                  {!a.passa && a.semSaida ? (
                    <span className="text-[0.65rem] text-wine">mude o fundo</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <div>
          <p className={`${rotulo} mb-2`}>Como vai ficar</p>
          <Amostra cores={cores} raios={raios} />
        </div>

        <div className="glass rounded-[18px] p-4">
          {erro ? (
            <p className="mb-3 whitespace-pre-line rounded-[10px] border border-wine/40 bg-wine/10 px-3 py-2 text-xs leading-relaxed text-wine">
              {erro}
            </p>
          ) : null}
          {salvo && !mudou ? (
            <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-brand-strong">
              <Check size={13} /> Salvo. O site já está com a aparência nova.
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={salvar}
              disabled={enviando || !podeSalvar || !mudou}
              className="rounded-full bg-brand px-5 py-2 text-xs font-semibold text-ink transition-colors hover:bg-brand-light disabled:cursor-not-allowed disabled:opacity-50"
            >
              {enviando ? "Salvando…" : "Salvar aparência"}
            </button>
            <button
              type="button"
              onClick={voltarTudoAoPadrao}
              className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 px-4 py-2 text-xs font-semibold text-ink transition-colors hover:border-brand/50 hover:text-brand-nav"
            >
              <RotateCcw size={12} />
              Voltar ao padrão da marca
            </button>
          </div>

          {!podeSalvar ? (
            <p className="mt-2.5 text-[0.68rem] leading-relaxed text-wine">
              {reprovados.length > 0
                ? "Corrija a legibilidade acima antes de salvar. Texto que ninguém lê não é escolha de estilo."
                : "Há um valor de canto fora do formato. Use algo como 10px ou 0.75rem."}
            </p>
          ) : !mudou ? (
            <p className="mt-2.5 text-[0.68rem] text-muted">Nada mudou ainda.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
