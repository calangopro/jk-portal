"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Ruler, RotateCcw, Coins, CreditCard, ArrowRight, TriangleAlert } from "lucide-react";
import { ModoMedicao } from "./ModoMedicao";
import { TabelaAros } from "./TabelaAros";
import { REFERENCIAS, type ReferenciaId, aroRecomendado } from "@/lib/medidor/aros";

/**
 * Medidor digital de aliança.
 *
 * REGRA DE OURO: pixel serve só para desenhar. Toda medida real vem da
 * calibração feita pela pessoa com um objeto de tamanho conhecido, porque
 * nenhuma informação do navegador (px, devicePixelRatio, resolução)
 * corresponde ao tamanho físico da tela.
 *
 * Este componente é só o estado e a moldura clara da página. A medição em si
 * acontece no modo de tela cheia, onde nada compete com o anel.
 */

const CHAVE = "jk-medidor-calibracao";

/** Só a primeira letra: `toLowerCase()` inteiro estragava o "R$" do nome. */
function minusculaInicial(texto: string) {
  return texto.charAt(0).toLowerCase() + texto.slice(1);
}

type Salvo = {
  pxPorMm: number;
  referencia: ReferenciaId;
  largura: number;
  diametroMm?: number;
};

export function Medidor({ children }: { children?: ReactNode }) {
  const [pxPorMm, setPxPorMm] = useState<number | null>(null);
  const [referencia, setReferencia] = useState<ReferenciaId>("moeda");
  const [diametroMm, setDiametroMm] = useState(18.46); // aro 18, o mais comum
  const [mediu, setMediu] = useState(false);
  const [larguraSalva, setLarguraSalva] = useState<number | null>(null);
  const [carregou, setCarregou] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [entrarCalibrando, setEntrarCalibrando] = useState(false);
  const abrir = useRef<HTMLButtonElement>(null);

  /* ------------------------------------------------------- calibração */

  useEffect(() => {
    try {
      const bruto = localStorage.getItem(CHAVE);
      if (bruto) {
        const s = JSON.parse(bruto) as Salvo;
        if (s.pxPorMm > 0) {
          setPxPorMm(s.pxPorMm);
          setReferencia(s.referencia);
          setLarguraSalva(s.largura ?? null);
          if (s.diametroMm) {
            setDiametroMm(s.diametroMm);
            setMediu(true);
          }
        }
      }
    } catch {
      // localStorage indisponível: segue sem calibração salva.
    }

    // Atalho de recalibrar: `/medidor-de-aliancas?calibrar=1` abre direto na
    // escolha do objeto. É lido de `window.location` e não de `useSearchParams`
    // de propósito, porque o hook tornaria esta página dinâmica, e ela é uma das
    // que mais rende na busca justamente por ser estática.
    try {
      if (new URLSearchParams(window.location.search).get("calibrar") === "1") {
        setEntrarCalibrando(true);
        setAberto(true);
      }
    } catch {
      /* sem window, sem atalho */
    }

    setCarregou(true);
  }, []);

  const guardar = useCallback(
    (dados: Partial<Salvo>) => {
      try {
        const atual: Salvo = {
          pxPorMm: pxPorMm ?? 0,
          referencia,
          largura: window.innerWidth,
          diametroMm,
          ...dados,
        };
        localStorage.setItem(CHAVE, JSON.stringify(atual));
        setLarguraSalva(atual.largura);
      } catch {
        // Sem localStorage a medição continua funcionando nesta visita.
      }
    },
    [pxPorMm, referencia, diametroMm],
  );

  const definirCalibragem = useCallback(
    (px: number, ref: ReferenciaId) => {
      setPxPorMm(px);
      setReferencia(ref);
      guardar({ pxPorMm: px, referencia: ref, largura: window.innerWidth });
    },
    [guardar],
  );

  const definirDiametro = useCallback((mm: number) => {
    setDiametroMm(mm);
    setMediu(true);
  }, []);

  const fechar = useCallback(() => {
    setAberto(false);
    setEntrarCalibrando(false);
    guardar({ diametroMm });
    abrir.current?.focus();
  }, [guardar, diametroMm]);

  const recalibrar = () => {
    setPxPorMm(null);
    setMediu(false);
    setLarguraSalva(null);
    try {
      localStorage.removeItem(CHAVE);
    } catch {
      /* ignora */
    }
    setAberto(true);
  };

  const aro = aroRecomendado(diametroMm);
  const ref = REFERENCIAS[referencia];
  const Icone = referencia === "moeda" ? Coins : CreditCard;

  // A calibração vale para o tamanho de tela em que foi feita. Se a janela
  // mudou muito, o zoom provavelmente mudou junto e a medida saiu de escala.
  // O arquivo já gravava a largura desde o começo, mas ninguém a lia.
  const larguraMudou =
    carregou &&
    larguraSalva != null &&
    typeof window !== "undefined" &&
    Math.abs(window.innerWidth - larguraSalva) > 120;

  if (!carregou) {
    return <div className="glass h-64 animate-pulse rounded-xl" aria-hidden />;
  }

  return (
    <>
      <div className="glass relative overflow-hidden rounded-xl p-6 sm:p-9">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-brand/20 blur-3xl"
        />

        <div className="relative flex flex-col gap-7 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {mediu && pxPorMm ? (
              <>
                <p className="eyebrow">Sua última medida</p>
                <p className="font-display mt-1 flex items-baseline gap-3 text-display leading-none text-ink">
                  {aro}
                  <span className="numeros text-apoio font-sans font-normal text-muted">
                    {diametroMm.toFixed(2).replace(".", ",")} mm
                  </span>
                </p>
              </>
            ) : (
              <>
                <p className="eyebrow">Ferramenta</p>
                <p className="font-display mt-2 max-w-sm text-titulo-secao text-ink">
                  Descubra seu aro pela tela, em dois minutos
                </p>
                <p className="mt-3 max-w-md text-apoio leading-relaxed text-muted">
                  Você vai precisar da aliança que já serve e de uma moeda de
                  R$ 1 ou um cartão, para o site aprender a escala da sua tela.
                </p>
              </>
            )}
          </div>

          <div className="flex shrink-0 flex-col items-start gap-3">
            <button
              ref={abrir}
              type="button"
              onClick={() => setAberto(true)}
              className="inline-flex min-h-14 items-center justify-center gap-2.5 rounded-full bg-brand px-8 text-corpo font-semibold text-ink shadow-[var(--jk-sombra-acao-larga)] transition-[transform,background-color] duration-300 hover:-translate-y-0.5 hover:bg-brand-light"
            >
              <Ruler size={18} aria-hidden />
              {mediu ? "Medir de novo" : "Medir meu aro"}
            </button>

            {pxPorMm ? (
              <span className="flex items-center gap-1.5 text-nota text-muted">
                <Icone size={12} aria-hidden />
                Calibrado com {minusculaInicial(ref.nome)}
                <button
                  type="button"
                  onClick={recalibrar}
                  className="inline-flex items-center gap-1 font-semibold text-brand-nav underline-offset-2 hover:underline"
                >
                  <RotateCcw size={11} aria-hidden /> refazer
                </button>
              </span>
            ) : null}
          </div>
        </div>

        {larguraMudou ? (
          <p className="relative mt-6 flex items-start gap-2.5 rounded-sm border border-brand/30 bg-brand/10 px-4 py-3 text-apoio leading-relaxed text-brand-strong">
            <TriangleAlert size={15} aria-hidden className="mt-0.5 shrink-0" />
            A tela está com um tamanho diferente de quando você calibrou. Se
            trocou de aparelho ou mexeu no zoom, vale calibrar de novo.
          </p>
        ) : null}

        {mediu && pxPorMm ? (
          <div className="relative mt-7 flex flex-wrap gap-3 border-t border-border pt-6">
            <a
              href={`https://www.jkaliancas.com.br/namoro-e-compromisso?utm_source=portal&utm_medium=medidor&utm_content=aro-${aro}`}
              target="_blank"
              rel="noopener"
              data-evento="clique_produto"
              data-destino="medidor"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-ink px-6 text-apoio font-semibold text-white transition-colors hover:bg-charcoal"
            >
              Ver alianças no aro {aro}
              <ArrowRight size={15} aria-hidden />
            </a>
            <a
              href="/lojas"
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-ink/20 px-6 text-apoio font-semibold text-ink transition-colors hover:border-brand hover:text-brand-nav"
            >
              Medir numa loja
            </a>
          </div>
        ) : null}
      </div>

      {children}

      <TabelaAros aroDestacado={mediu ? aro : null} />

      {aberto ? (
        <ModoMedicao
          pxPorMm={pxPorMm}
          referencia={referencia}
          diametroMm={diametroMm}
          jaMediu={mediu}
          etapaInicial={entrarCalibrando ? "escolha" : undefined}
          aoDefinirCalibragem={definirCalibragem}
          aoDefinirDiametro={definirDiametro}
          aoFechar={fechar}
        />
      ) : null}
    </>
  );
}
