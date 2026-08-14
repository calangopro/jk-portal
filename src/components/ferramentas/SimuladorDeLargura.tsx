"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Ruler } from "lucide-react";
import {
  DedoComAlianca,
  MATERIAIS,
  TONS,
  gradienteDoMaterial,
  type MaterialDaPeca,
  type TipoDeDedo,
  type TomDePele,
} from "./Dedo";
import {
  LARGURAS_COMUNS,
  comoFicaNoDedo,
  porcentagemNoDedo,
} from "@/lib/medidor/larguras";
import { ARO_MAXIMO, ARO_MINIMO, aroRecomendado, diametroDoAro } from "@/lib/medidor/aros";

/** A mesma chave que o medidor grava. Calibrar uma vez serve para as duas. */
const CHAVE = "jk-medidor-calibracao";
/** Preferência de desenho, que não tem nada a ver com a calibração. */
const CHAVE_DESENHO = "jk-simulador-dedo";

type Salvo = { pxPorMm?: number; diametroMm?: number };
type Preferencia = { tipo?: TipoDeDedo; tom?: TomDePele; material?: MaterialDaPeca };

/**
 * Simulador de largura da aliança.
 *
 * "3 mm é fina" não diz nada para quem nunca comparou, e é por isso que a
 * largura é a segunda dúvida mais cara de errar, depois do aro. Aqui a pessoa
 * vê a peça no tamanho real da tela, sobre um dedo do diâmetro do próprio aro.
 *
 * Reaproveita a calibração do medidor, gravada em `localStorage`: quem já mediu
 * o aro não precisa calibrar de novo. Sem calibração o desenho continua
 * funcionando como comparação relativa, e a tela diz que ali não é tamanho
 * real. Mentir sobre escala seria pior que não desenhar.
 *
 * O dedo mora em `Dedo.tsx`, com a explicação de como ele é construído.
 */
export function SimuladorDeLargura({ aroInicial = 16 }: { aroInicial?: number }) {
  const [pxPorMm, setPxPorMm] = useState<number | null>(null);
  const [aro, setAro] = useState(aroInicial);
  const [largura, setLargura] = useState<number>(4);
  const [tipo, setTipo] = useState<TipoDeDedo>("feminino");
  const [tom, setTom] = useState<TomDePele>("clara");
  const [material, setMaterial] = useState<MaterialDaPeca>("ouro");
  const [carregou, setCarregou] = useState(false);

  useEffect(() => {
    try {
      const bruto = window.localStorage.getItem(CHAVE);
      if (bruto) {
        const s = JSON.parse(bruto) as Salvo;
        if (typeof s.pxPorMm === "number" && s.pxPorMm > 0) setPxPorMm(s.pxPorMm);
        // Quem já mediu o dedo entra com o próprio aro, não com o padrão.
        if (typeof s.diametroMm === "number" && s.diametroMm > 0) {
          setAro(aroRecomendado(s.diametroMm));
        }
      }
      const desenho = window.localStorage.getItem(CHAVE_DESENHO);
      if (desenho) {
        const d = JSON.parse(desenho) as Preferencia;
        if (d.tipo === "feminino" || d.tipo === "masculino") setTipo(d.tipo);
        if (d.tom && TONS.some((t) => t.id === d.tom)) setTom(d.tom);
        if (d.material && MATERIAIS.some((m) => m.id === d.material)) setMaterial(d.material);
      }
    } catch {
      // Armazenamento bloqueado: segue sem escala real, e a tela avisa.
    }
    setCarregou(true);
  }, []);

  // A escolha de dedo e tom é preferência, não medida: guardar evita a pessoa
  // reajustar tudo a cada visita.
  useEffect(() => {
    if (!carregou) return;
    try {
      window.localStorage.setItem(CHAVE_DESENHO, JSON.stringify({ tipo, tom, material }));
    } catch {
      /* sem armazenamento, a escolha vale só nesta visita */
    }
  }, [carregou, tipo, tom, material]);

  // Guard de hidratação: nunca ler localStorage no primeiro render.
  if (!carregou) return <div className="glass h-96 animate-pulse rounded-[20px]" aria-hidden />;

  const escalaReal = pxPorMm !== null;
  // Sem calibração, uma escala de referência só para a comparação entre
  // larguras continuar honesta uma em relação à outra.
  const escala = pxPorMm ?? 7;
  const diametro = diametroDoAro(aro);

  return (
    <div className="glass overflow-hidden rounded-[20px]">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        {/* ------------------------------------------------------ palco */}
        <div className="relative flex flex-col items-center justify-center border-b border-border/70 bg-[radial-gradient(120%_90%_at_50%_0%,var(--color-glow),var(--color-sand))] px-4 py-8 sm:px-6 lg:border-b-0 lg:border-r">
          <div className="flex items-baseline gap-2">
            <span
              key={largura}
              className="font-display troca text-display leading-none text-ink"
            >
              {largura.toLocaleString("pt-BR")}
            </span>
            <span className="text-titulo-bloco text-brand-strong">mm</span>
          </div>
          <p className="numeros mt-1 text-nota text-muted">
            no aro {aro}, {diametro.toFixed(2).replace(".", ",")} mm de diâmetro
          </p>

          {/* O desenho não encolhe: encolher seria mentir sobre o tamanho real.
              Se não couber, a área rola de lado e a escala continua honesta. */}
          <div className="mt-5 w-full overflow-x-auto">
            <div className="mx-auto w-max px-2">
              <DedoComAlianca
                diametroMm={diametro}
                larguraMm={largura}
                escala={escala}
                tipo={tipo}
                tom={tom}
                material={material}
                rotulo={comoFicaNoDedo(largura, aro)}
              />
            </div>
          </div>

          <p className="mt-4 max-w-[34ch] text-center text-nota leading-relaxed text-muted">
            {escalaReal ? (
              <>
                <span className="inline-flex items-center gap-1.5 text-brand-strong">
                  <Check size={13} aria-hidden />
                  Tamanho real na sua tela
                </span>
                {". "}
                {/* Atalho de recalibrar: quem trocou de aparelho ou mexeu no
                    zoom precisa refazer, e mandar a pessoa caçar isso na página
                    do medidor era pedir para ela desistir. */}
                <Link
                  href="/medidor-de-aliancas?calibrar=1"
                  className="font-semibold text-brand-nav underline underline-offset-2"
                >
                  Calibrar de novo
                </Link>
              </>
            ) : (
              <>
                Comparação entre larguras, ainda sem tamanho real.{" "}
                <Link
                  href="/medidor-de-aliancas?calibrar=1"
                  className="font-semibold text-brand-nav underline underline-offset-2"
                >
                  Calibre no medidor
                </Link>{" "}
                para ver na escala certa.
              </>
            )}
          </p>
        </div>

        {/* -------------------------------------------------- controles */}
        <div className="p-5 sm:p-7">
          <fieldset>
            <legend className="text-apoio font-semibold text-ink">
              Largura da aliança
            </legend>
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-3 xl:grid-cols-6">
              {LARGURAS_COMUNS.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLargura(l)}
                  aria-pressed={largura === l}
                  className={`min-h-12 rounded-sm px-2 text-apoio font-semibold transition-all ${
                    largura === l
                      ? "bg-brand text-ink shadow-[var(--jk-sombra-acao)]"
                      : "border border-border bg-white/60 text-ink hover:border-brand/50 hover:bg-white"
                  }`}
                >
                  {l.toLocaleString("pt-BR")} mm
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="mt-7">
            <legend className="text-apoio font-semibold text-ink">Material</legend>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {MATERIAIS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMaterial(m.id)}
                  aria-pressed={material === m.id}
                  className={`flex min-h-12 items-center gap-2.5 rounded-sm border px-3 text-left text-nota font-semibold transition-colors ${
                    material === m.id
                      ? "border-brand bg-brand/12 text-ink"
                      : "border-border bg-white/60 text-muted hover:border-brand/50"
                  }`}
                >
                  {/* A amostra é o mesmo metal do desenho, e não um quadradinho
                      de cor: assim o seletor não promete um dourado e entrega
                      outro. */}
                  <span
                    aria-hidden
                    className="h-6 w-6 shrink-0 rounded-full border border-black/15"
                    style={{ background: gradienteDoMaterial(m.id) }}
                  />
                  {m.nome}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="mt-7 grid gap-5 sm:grid-cols-2">
            <fieldset>
              <legend className="text-apoio font-semibold text-ink">Dedo</legend>
              <div className="mt-3 flex rounded-full border border-border bg-white/60 p-1">
                {(["feminino", "masculino"] as TipoDeDedo[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTipo(t)}
                    aria-pressed={tipo === t}
                    className={`min-h-11 flex-1 rounded-full text-apoio font-semibold capitalize transition-colors ${
                      tipo === t ? "bg-brand text-ink" : "text-muted hover:text-ink"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-apoio font-semibold text-ink">Tom de pele</legend>
              <div className="mt-3 flex items-center gap-3">
                {TONS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTom(t.id)}
                    aria-pressed={tom === t.id}
                    aria-label={t.nome}
                    title={t.nome}
                    className={`h-11 w-11 rounded-full border-2 transition-all ${
                      tom === t.id
                        ? "border-brand ring-2 ring-brand/30"
                        : "border-white/80 hover:border-brand/40"
                    }`}
                    style={{ background: t.amostra }}
                  />
                ))}
              </div>
            </fieldset>
          </div>

          <label className="mt-7 block text-apoio font-semibold text-ink">
            Seu aro
            <input
              type="range"
              min={ARO_MINIMO}
              max={ARO_MAXIMO}
              value={aro}
              onChange={(e) => setAro(Number(e.target.value))}
              aria-valuetext={`Aro ${aro}, ${diametro.toFixed(2).replace(".", ",")} milímetros de diâmetro`}
              className="jk-slider mt-4"
            />
            <span className="numeros mt-2 block text-nota font-normal text-muted">
              Aro {aro}.{" "}
              <Link
                href="/medidor-de-aliancas"
                className="font-semibold text-brand-nav underline underline-offset-2"
              >
                Não sabe o seu?
              </Link>
            </span>
          </label>

          <p
            aria-live="polite"
            className="mt-6 flex items-start gap-2.5 rounded-sm border border-brand/25 bg-brand/10 px-4 py-3 text-apoio leading-relaxed text-ink"
          >
            <Ruler size={15} aria-hidden className="mt-0.5 shrink-0 text-brand-nav" />
            {comoFicaNoDedo(largura, aro)}
          </p>

          {/* Comparação de todas, na mesma escala, para a escolha não depender
              de trocar de aba e voltar. */}
          <div className="mt-7">
            <p className="text-apoio font-semibold text-ink">Todas lado a lado</p>
            <ul className="mt-3 space-y-1.5">
              {LARGURAS_COMUNS.map((l) => (
                <li key={l}>
                  <button
                    type="button"
                    onClick={() => setLargura(l)}
                    aria-pressed={largura === l}
                    className="flex w-full items-center gap-3 rounded-sm px-2 py-1.5 text-left transition-colors hover:bg-brand/8"
                  >
                    <span className="numeros w-14 shrink-0 text-nota text-muted">
                      {l.toLocaleString("pt-BR")} mm
                    </span>
                    <span
                      aria-hidden
                      className="min-w-0 flex-1 rounded-[2px] transition-all"
                      style={{
                        height: `${Math.max(3, l * escala)}px`,
                        background:
                          l === largura
                            ? gradienteDoMaterial(material)
                            : "rgb(190 155 96 / 0.28)",
                      }}
                    />
                    <span className="numeros w-11 shrink-0 text-right text-nota text-muted">
                      {porcentagemNoDedo(l, aro)}%
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-nota leading-relaxed text-muted">
              A porcentagem é quanto da largura visível do dedo a peça ocupa, no
              aro {aro}.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
