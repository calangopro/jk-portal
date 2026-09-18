"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Ruler } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  MATERIAIS,
  gradienteDoMaterial,
  type MaterialDaPeca,
} from "@/lib/ferramentas/materiais";
import { MaoComAlianca } from "./MaoComAlianca";
import type { TipoDeMao } from "@/lib/ferramentas/maos";
import {
  LARGURAS_COMUNS,
  comoFicaNoDedo,
  porcentagemNoDedo,
} from "@/lib/medidor/larguras";
import { useLarguraEscolhida } from "./LarguraEscolhida";
import { ARO_MAXIMO, ARO_MINIMO, aroRecomendado, diametroDoAro } from "@/lib/medidor/aros";

/** A mesma chave que o medidor grava. Calibrar uma vez serve para as duas. */
const CHAVE = "jk-medidor-calibracao";
/** Preferência de desenho, que não tem nada a ver com a calibração. */
const CHAVE_DESENHO = "jk-simulador-dedo";

type Salvo = { pxPorMm?: number; diametroMm?: number };
/**
 * O `tom` saiu da interface junto com a ilustração, mas continua aceito aqui: já
 * existe gravado no navegador de quem usou a ferramenta antes, e um campo a mais
 * no JSON não atrapalha ninguém. No dia em que existir foto de pele média e
 * escura ele volta a ser lido.
 */
type Preferencia = { tipo?: TipoDeMao; tom?: string; material?: MaterialDaPeca };

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
  const [tipo, setTipo] = useState<TipoDeMao>("feminino");
  const [material, setMaterial] = useState<MaterialDaPeca>("ouro");
  const [carregou, setCarregou] = useState(false);

  // A vitrine da página escuta a largura escolhida. Fora da página da
  // ferramenta (dentro de um artigo, por exemplo) não existe vitrine, e aí isto
  // é nulo e não muda nada.
  const escolhaCompartilhada = useLarguraEscolhida();
  const escolherLargura = (mm: number) => {
    setLargura(mm);
    escolhaCompartilhada?.definirLargura(mm);
  };

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
      window.localStorage.setItem(CHAVE_DESENHO, JSON.stringify({ tipo, material }));
    } catch {
      /* sem armazenamento, a escolha vale só nesta visita */
    }
  }, [carregou, tipo, material]);

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
        {/* `min-w-0` não é enfeite: sem ele, esta coluna cresce até o tamanho
            da mão (463 px no celular), estoura o grid e o `overflow-hidden` do
            cartão passa a cortar TAMBÉM os controles ao lado. Item de grid e de
            flex tem largura mínima igual ao conteúdo, e é ela que precisa ser
            desligada para o `overflow-x-auto` de dentro voltar a funcionar.
            A ilustração de traço era mais estreita e escondia o defeito. */}
        <div className="relative flex min-w-0 flex-col items-center justify-center border-b border-border/70 bg-[radial-gradient(120%_90%_at_50%_0%,var(--color-glow),var(--color-sand))] px-4 py-8 sm:px-6 lg:border-b-0 lg:border-r">
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
          <div className="relative mt-5 w-full">
            <div
              className={`w-full overflow-x-auto transition-[opacity,filter] duration-500 ${
                escalaReal ? "" : "pointer-events-none opacity-35 blur-[2px]"
              }`}
              aria-hidden={escalaReal ? undefined : true}
            >
              <div className="mx-auto w-max px-2">
                <MaoComAlianca
                  diametroMm={diametro}
                  larguraMm={largura}
                  escala={escala}
                  tipo={tipo}
                  material={material}
                  rotulo={comoFicaNoDedo(largura, aro)}
                />
              </div>
            </div>

            {/* SEM CALIBRAÇÃO, A MÃO NÃO PODE PARECER TAMANHO REAL.
                Isto nasceu de um teste com aliança de verdade encostada na tela:
                sem calibrar, a ferramenta usa uma escala de reserva e o desenho
                saiu cerca de 1,5 vez maior que a peça. O aviso existia, mas em
                texto pequeno embaixo do desenho, e ninguém lê aviso pequeno
                quando a imagem parece confiável.
                O H1 da página promete "no tamanho real". Enquanto a promessa não
                puder ser cumprida, o desenho fica embaçado e a única coisa nítida
                é o caminho para cumpri-la. */}
            {escalaReal ? null : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-5 text-center">
                <div className="glass max-w-[30ch] rounded-lg px-6 py-6">
                  <p className="text-corpo font-semibold leading-snug text-ink">
                    Esta tela ainda não foi medida, então o desenho não está em
                    tamanho real.
                  </p>
                  <Button
                    href="/medidor-de-aliancas?calibrar=1"
                    size="sm"
                    className="mt-4"
                    icone={<Ruler size={16} aria-hidden />}
                  >
                    Calibrar a tela
                  </Button>
                  <p className="mt-3 text-nota leading-relaxed text-muted">
                    Leva 20 segundos, com uma moeda de R$ 1 ou um cartão. Depois
                    vale para o site inteiro.
                  </p>
                </div>
              </div>
            )}
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
              "As larguras abaixo continuam valendo uma em relação à outra: a de 6 mm é o dobro da de 3 mm em qualquer tela."
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
                  onClick={() => escolherLargura(l)}
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

          {/* SEM seletor de tom de pele enquanto existir foto de um tom só.
              A ilustração de traço tinha três tons, e as fotos começam pela pele
              clara. Manter o seletor com duas opções sem imagem seria anunciar
              uma falta; mandar quem escolhe pele escura de volta para o desenho
              seria entregar a versão pior justamente para ela. Quando
              `mao-feminina-media.webp` e companhia existirem, ele volta: as
              medidas de cada mão são por arquivo, em `lib/ferramentas/maos.ts`,
              e o componente não muda.
              O grid de duas colunas saiu junto: com um campo só, ele deixava
              metade da linha vazia. */}
          <fieldset className="mt-7">
              <legend className="text-apoio font-semibold text-ink">Mão</legend>
              <div className="mt-3 flex max-w-sm rounded-full border border-border bg-white/60 p-1">
                {(["feminino", "masculino"] as TipoDeMao[]).map((t) => (
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
                    onClick={() => escolherLargura(l)}
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
