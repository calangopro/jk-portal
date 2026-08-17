"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Maximize2, Move3d, RotateCcw, X } from "lucide-react";
import {
  ESPESSURA_MAXIMA,
  ESPESSURA_MINIMA,
  ESPESSURA_PADRAO,
  FORMATOS_INFO,
  MODELOS_INFO,
  perfilDaAlianca,
  volumeDeMetal,
  type FormatoDeAlianca,
  type ModeloDeAlianca,
  type PontoDoPerfil,
} from "@/lib/aliancas/perfis";
import { amostraDoMaterial, aparenciaDoMaterial } from "@/lib/aliancas/metais";
import { CorteDaAlianca } from "./CorteDaAlianca";
import { LARGURAS_COMUNS } from "@/lib/medidor/larguras";
import { diametroDoAro } from "@/lib/medidor/aros";

/**
 * A aliança em três dimensões.
 *
 * POR QUE 3D AQUI, E NÃO MAIS UMA FOTO
 *
 * Duas coisas decidem a compra de uma aliança lisa e nenhuma das duas cabe numa
 * imagem parada: o formato do corte e o brilho do metal. Formato some no
 * reflexo, e brilho de metal É movimento, porque o que o olho lê como ouro é a
 * luz correndo pela superfície quando a peça vira. Foto congela justamente a
 * parte que informa.
 *
 * DOIS EIXOS
 *
 * MODELO é a face de fora (abaulada, chanfrada, polida, fosca) e FORMATO é o
 * lado de dentro (reta ou anatômica). São escolhas independentes, então existe
 * abaulada reta e abaulada anatômica, e a tela mostra as duas. Polida e fosca
 * têm a mesma geometria: o que muda é o acabamento, que aqui é a aspereza do
 * material, e não outro contorno.
 *
 * COMO A PEÇA É FEITA
 *
 * Não tem arquivo .obj. A malha nasce do contorno em `lib/aliancas/perfis.ts`,
 * girado 360° em torno do furo, que é como aliança lisa é feita de verdade e
 * como qualquer programa 3D a modelaria. Ganha-se com isso as quatro formas em
 * todas as larguras e em qualquer aro, sem baixar um megabyte de malha, e o
 * desenho do corte ao lado sai dos MESMOS pontos, então nunca discorda do 3D.
 *
 * O metal é `MeshPhysicalMaterial` com `metalness` 1. Metal não tem cor
 * própria na tela: ele só devolve o que tem em volta, e por isso um metal sem
 * ambiente renderiza PRETO. O ambiente aqui é desenhado num canvas (céu claro,
 * corte seco no horizonte, dois painéis de luz), que é a mesma lição que o
 * simulador de largura já tinha aprendido no plano: o que faz o olho ler metal
 * polido é a alternância dura entre escuro, estouro de luz e meio-tom.
 *
 * O three.js só é baixado quando o bloco aparece na tela. A página, a tabela e
 * o texto continuam no HTML da primeira resposta, sem depender disto.
 */

type TresD = typeof import("three");

export type MaterialNoVisor = {
  slug: string;
  nome: string;
  produtos: number;
  precoMediano: number;
};

/** Aro médio, só para a peça ter proporção de peça. Não é escolha de compra. */
const ARO_DE_REFERENCIA = 16;

/** Botão que fica por cima do palco. Altura de dedo, vidro por baixo. */
const BOTAO_DO_PALCO =
  "flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-sm border border-border bg-white/70 px-3 text-nota font-semibold text-ink backdrop-blur transition-colors hover:border-brand/60";

type Props = {
  materiais: MaterialNoVisor[];
  className?: string;
};

export function AliancaEm3D({ materiais, className = "" }: Props) {
  const [modelo, setModelo] = useState<ModeloDeAlianca>("abaulada");
  const [formato, setFormato] = useState<FormatoDeAlianca>("reta");
  const [largura, setLargura] = useState<number>(4);
  const [espessura, setEspessura] = useState<number>(ESPESSURA_PADRAO);
  // Começa no ouro 18k: é mais da metade do catálogo de aliança da JK, e é
  // também onde o brilho do 3D mostra a que veio. Se não existir, o primeiro.
  const [slug, setSlug] = useState<string>(
    materiais.find((m) => m.slug === "ouro-18k")?.slug ?? materiais[0]?.slug ?? "ouro-18k",
  );
  const [pronto, setPronto] = useState(false);
  const [semWebgl, setSemWebgl] = useState(false);
  const [tocou, setTocou] = useState(false);
  // Tela cheia existe por causa do celular: num palco de 390 px a peça sai do
  // tamanho de uma moeda, e é justamente o brilho correndo pela superfície que
  // esta tela tem para contar.
  const [ampliado, setAmpliado] = useState(false);

  // Dois palcos, um canvas. O embutido existe sempre; o de tela cheia só
  // enquanto ela está aberta, e o canvas muda de casa entre os dois.
  const palcoEmbutido = useRef<HTMLDivElement | null>(null);
  const palcoCheio = useRef<HTMLDivElement | null>(null);
  const cena = useRef<Cena | null>(null);

  const material = materiais.find((m) => m.slug === slug) ?? materiais[0];
  const infoModelo = MODELOS_INFO.find((m) => m.id === modelo) ?? MODELOS_INFO[0];
  const infoFormato = FORMATOS_INFO.find((f) => f.id === formato) ?? FORMATOS_INFO[0];
  const aparencia = aparenciaDoMaterial(slug);
  const fosco = infoModelo.fosco === true;

  // ---------------------------------------------------------------- montagem
  useEffect(() => {
    const palco = palcoEmbutido.current;
    if (!palco) return;

    let vivo = true;
    let observador: IntersectionObserver | null = null;

    const iniciar = async () => {
      if (!vivo || cena.current) return;
      try {
        const THREE = await import("three");
        if (!vivo) return;
        cena.current = montar(THREE, palco, aoGirar);
        setPronto(true);
      } catch {
        setSemWebgl(true);
      }
    };

    // Só baixa a biblioteca quando o bloco chega na tela. Quem abriu a página
    // para ler a tabela não paga por isso.
    observador = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) {
          observador?.disconnect();
          void iniciar();
        }
      },
      { rootMargin: "300px" },
    );
    observador.observe(palco);

    return () => {
      vivo = false;
      observador?.disconnect();
      cena.current?.desmontar();
      cena.current = null;
    };
  }, []);

  // ------------------------------------------------------- forma e aparência
  useEffect(() => {
    if (!pronto) return;
    const info = MODELOS_INFO.find((m) => m.id === modelo);
    cena.current?.trocarPeca({
      modelo,
      formato,
      larguraMm: largura,
      espessuraMm: espessura,
      aro: ARO_DE_REFERENCIA,
      aparencia: aparenciaDoMaterial(slug),
      fosco: info?.fosco === true,
    });
  }, [pronto, modelo, formato, largura, espessura, slug]);

  // ------------------------------------------------------------- tela cheia
  // Em tela cheia o gesto é todo da peça (`touch-action: none`), com pinça para
  // aproximar. No palco embutido a rolagem da página continua ganhando o gesto
  // vertical, senão a pessoa fica presa no meio do artigo.
  useEffect(() => {
    cena.current?.definirCapturaTotal(ampliado);
    // O canvas muda de casa depois de o palco novo existir no DOM, e é por isso
    // que este efeito roda DEPOIS do render que abriu a tela cheia.
    const destino = ampliado ? palcoCheio.current : palcoEmbutido.current;
    if (destino) cena.current?.mudarDePalco(destino);
  }, [pronto, ampliado]);

  useEffect(() => {
    if (!ampliado) return;
    // Sem travar o corpo, a página rola atrás do palco e a pessoa fecha a tela
    // cheia num lugar diferente de onde abriu.
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    palcoCheio.current?.focus();
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAmpliado(false);
    };
    window.addEventListener("keydown", aoTeclar);
    return () => {
      document.body.style.overflow = anterior;
      window.removeEventListener("keydown", aoTeclar);
    };
  }, [ampliado]);

  const reiniciar = useCallback(() => {
    cena.current?.reiniciarAngulo();
  }, []);

  // A dica de gesto só sai depois de a peça girar de verdade. Antes ela saía em
  // qualquer `pointerdown`, então quem só rolou a página passando o dedo por
  // cima do palco perdia a única instrução da tela.
  const aoGirar = useCallback(() => setTocou(true), []);

  const nomeDaPeca = `${infoModelo.nome} ${infoFormato.nome.toLowerCase()}`;
  const gesto = ampliado
    ? "Arraste para girar, pince para aproximar, ou use as setas do teclado."
    : "Arraste para o lado para girar, ou use as setas do teclado.";
  const rotulo = `Aliança ${nomeDaPeca.toLowerCase()} de ${largura.toLocaleString("pt-BR")} milímetros em ${material?.nome ?? ""}, em três dimensões. ${gesto}`;

  const dinheiro = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

  const medidas = { larguraMm: largura, espessuraMm: espessura, aro: ARO_DE_REFERENCIA };
  const volume = volumeDeMetal(perfilDaAlianca(modelo, formato, medidas));
  // A referência é a peça mais fina que esta tela produz. Sem um ponto de
  // comparação, "363 mm³" não diz nada para quem vai comprar.
  const volumeDaMaisFina = volumeDeMetal(
    perfilDaAlianca("polida", "reta", {
      larguraMm: 2,
      espessuraMm: ESPESSURA_MINIMA,
      aro: ARO_DE_REFERENCIA,
    }),
  );
  const vezes = volumeDaMaisFina > 0 ? volume / volumeDaMaisFina : 1;

  return (
    <>
      <div className={`glass overflow-hidden rounded-[20px] ${className}`}>
        <div className="grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
          {/* -------------------------------------------------------- palco

              No celular o palco é quase quadrado e ocupa a largura inteira.
              Antes eram 19 rem de altura fixa, e num aparelho de 390 px a
              aliança saía do tamanho de uma moeda, o que é o contrário do
              motivo de existir um 3D aqui. */}
          <div className="relative min-h-[min(86vw,26rem)] sm:min-h-[24rem] lg:min-h-[30rem]">
            <Palco
              palcoRef={palcoEmbutido}
              ampliado={false}
              rotulo={rotulo}
              nomeDaPeca={nomeDaPeca}
              largura={largura}
              espessura={espessura}
              nomeDoMaterial={material?.nome}
              modelo={modelo}
              formato={formato}
              cor={aparencia.cor}
              fosco={fosco}
              semWebgl={semWebgl}
              mostrarDica={!tocou}
              aoReiniciar={reiniciar}
              aoAmpliar={() => setAmpliado(true)}
            />
          </div>

          {/* -------------------------------------------------------- controles */}
          <div className="p-5 sm:p-7">
            <fieldset>
              <legend className="text-apoio font-semibold text-ink">
                Modelo <span className="font-normal text-muted">(a face de fora)</span>
              </legend>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
                {MODELOS_INFO.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setModelo(m.id)}
                    aria-pressed={modelo === m.id}
                    className={`flex min-h-[4.5rem] flex-col items-center justify-center gap-1.5 rounded-sm border px-2 py-2 text-nota font-semibold transition-colors ${
                      modelo === m.id
                        ? "border-brand bg-brand/12 text-ink"
                        : "border-border bg-white/60 text-muted hover:border-brand/50"
                    }`}
                  >
                    {/* O ícone é o corte de verdade, na mesma matemática do 3D.
                        Todos com o interior RETO e na mesma largura, para o botão
                        comparar só a face de fora, que é o que ele decide. */}
                    <CorteDaAlianca
                      modelo={m.id}
                      formato="reta"
                      larguraMm={4}
                      espessuraMm={espessura}
                      aro={ARO_DE_REFERENCIA}
                      cor={aparencia.cor}
                      fosco={m.fosco}
                      compacto
                      className="h-6 w-14 text-ink"
                    />
                    {m.nome}
                  </button>
                ))}
              </div>
            </fieldset>

            <p
              aria-live="polite"
              className="mt-3 min-h-[3.5rem] text-nota leading-relaxed text-muted"
            >
              {infoModelo.descricao}
            </p>

            <fieldset className="mt-6">
              <legend className="text-apoio font-semibold text-ink">
                Formato <span className="font-normal text-muted">(o lado do dedo)</span>
              </legend>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {FORMATOS_INFO.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFormato(f.id)}
                    aria-pressed={formato === f.id}
                    className={`flex min-h-[4.5rem] flex-col items-center justify-center gap-1.5 rounded-sm border px-2 py-2 text-nota font-semibold transition-colors ${
                      formato === f.id
                        ? "border-brand bg-brand/12 text-ink"
                        : "border-border bg-white/60 text-muted hover:border-brand/50"
                    }`}
                  >
                    {/* Aqui é o contrário: face de fora plana em todos, para o
                        botão isolar o lado de dentro. */}
                    <CorteDaAlianca
                      modelo="polida"
                      formato={f.id}
                      larguraMm={3.2}
                      espessuraMm={espessura}
                      aro={ARO_DE_REFERENCIA}
                      cor={aparencia.cor}
                      compacto
                      linhaDoDedo
                      className="h-8 w-14 text-ink"
                    />
                    {f.nome}
                  </button>
                ))}
              </div>
            </fieldset>

            <p
              aria-live="polite"
              className="mt-3 min-h-[3.5rem] text-nota leading-relaxed text-muted"
            >
              {infoFormato.descricao}
            </p>

            <fieldset className="mt-6">
              <legend className="text-apoio font-semibold text-ink">Material</legend>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {materiais.map((m) => (
                  <button
                    key={m.slug}
                    type="button"
                    onClick={() => setSlug(m.slug)}
                    aria-pressed={slug === m.slug}
                    className={`flex min-h-12 items-center gap-2.5 rounded-sm border px-3 text-left text-nota font-semibold transition-colors ${
                      slug === m.slug
                        ? "border-brand bg-brand/12 text-ink"
                        : "border-border bg-white/60 text-muted hover:border-brand/50"
                    }`}
                  >
                    <span
                      aria-hidden
                      className="h-6 w-6 shrink-0 rounded-full border border-black/15"
                      style={{ background: amostraDoMaterial(m.slug) }}
                    />
                    {m.nome}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="mt-6">
              <legend className="text-apoio font-semibold text-ink">Largura</legend>
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

            <label className="mt-6 block text-apoio font-semibold text-ink">
              Espessura <span className="font-normal text-muted">(a parede da peça)</span>
              <input
                type="range"
                min={ESPESSURA_MINIMA}
                max={ESPESSURA_MAXIMA}
                step={0.1}
                value={espessura}
                onChange={(e) => setEspessura(Number(e.target.value))}
                aria-valuetext={`${espessura.toLocaleString("pt-BR", { minimumFractionDigits: 1 })} milímetros de parede`}
                className="jk-slider mt-4"
              />
              <span className="numeros mt-2 block text-nota font-normal text-muted">
                {espessura.toLocaleString("pt-BR", { minimumFractionDigits: 1 })} mm. Mais
                parede é mais metal na peça, e é o que muda entre uma aliança
                fininha e uma encorpada.
              </span>
            </label>

            {/* O corte, grande. É o que separa uma abaulada de uma anatômica, e é
                a única parte que o reflexo do metal esconde. */}
            <div className="mt-7 rounded-sm border border-border bg-white/60 p-4">
              <p className="text-apoio font-semibold text-ink">
                O corte da peça, ampliado
              </p>
              <CorteDaAlianca
                modelo={modelo}
                formato={formato}
                larguraMm={largura}
                espessuraMm={espessura}
                aro={ARO_DE_REFERENCIA}
                cor={aparencia.cor}
                fosco={fosco}
                className="mt-3 h-28 w-full text-ink"
              />
              <p className="numeros mt-2 text-nota text-muted">
                {largura.toLocaleString("pt-BR")} mm de largura por{" "}
                {espessura.toLocaleString("pt-BR", { minimumFractionDigits: 1 })} mm de
                parede, no aro {ARO_DE_REFERENCIA} (
                {diametroDoAro(ARO_DE_REFERENCIA).toFixed(1).replace(".", ",")} mm de furo).
              </p>

              {/* Quanto metal a peça tem. É a resposta de "essa é mais grossa" em
                  número, e é conta de geometria, não afirmação sobre o produto: o
                  volume de um sólido de revolução sai da área do corte vezes a
                  volta que o centro dele dá. */}
              <p className="mt-3 border-t border-border pt-3 text-nota leading-relaxed text-muted">
                <strong className="font-semibold text-ink">
                  {Math.round(volume)} mm³ de metal
                </strong>
                {vezes >= 1.15 ? (
                  <>
                    , {vezes.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} vezes o
                    de uma peça de 2 mm com 1 mm de parede.
                  </>
                ) : (
                  <>, que é perto do mínimo de uma aliança lisa.</>
                )}
              </p>
            </div>

            {material ? (
              <p className="mt-5 text-nota leading-relaxed text-muted">
                <strong className="font-semibold text-ink">{material.nome}</strong>:{" "}
                {material.produtos} {material.produtos === 1 ? "modelo" : "modelos"} de
                aliança no catálogo, com preço mediano de {dinheiro(material.precoMediano)}.
                A tabela abaixo tem a faixa completa.
              </p>
            ) : null}

            {aparencia.nota ? (
              <p className="mt-3 text-nota leading-relaxed text-muted">{aparencia.nota}</p>
            ) : null}

            <p className="mt-3 text-nota leading-relaxed text-muted">
              As medidas do desenho são reais. O brilho é uma representação: metal
              polido devolve o ambiente em volta, então a peça na sua mão vai
              refletir a luz do lugar onde você estiver.
            </p>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------- palco em tela cheia

          Em PORTAL, e não como filho do cartão. `position: fixed` dentro de um
          elemento com `backdrop-filter` (o `.glass` do cartão) não se ancora na
          janela, e sim no cartão: a tela cheia saiu do tamanho do cartão, com a
          peça cortada. Portal em `document.body` também sobrevive a qualquer
          `transform` que apareça no caminho amanhã.

          O canvas é MOVIDO para cá pela cena, não recriado: remontar o WebGL
          custaria compilar shader e gerar o ambiente de novo a cada abertura, e
          a peça voltaria ao ângulo inicial no meio do gesto da pessoa. */}
      {ampliado && typeof document !== "undefined"
        ? createPortal(
            <div
              role="dialog"
              aria-modal
              aria-label="A aliança em três dimensões, em tela cheia"
              className="fixed inset-0 z-[90] flex flex-col bg-[radial-gradient(125%_100%_at_50%_12%,#fffdf9_0%,#f7f0e3_52%,#ecdfc9_100%)]"
            >
              <div className="relative min-h-0 flex-1">
                <Palco
                  palcoRef={palcoCheio}
                  ampliado
                  rotulo={rotulo}
                  nomeDaPeca={nomeDaPeca}
                  largura={largura}
                  espessura={espessura}
                  nomeDoMaterial={material?.nome}
                  modelo={modelo}
                  formato={formato}
                  cor={aparencia.cor}
                  fosco={fosco}
                  semWebgl={semWebgl}
                  mostrarDica={!tocou}
                  aoReiniciar={reiniciar}
                  aoFechar={() => setAmpliado(false)}
                />
              </div>

              {/* Trocar de material sem fechar a tela cheia. Mandar a pessoa
                  sair, mexer e voltar seria pior do que não ter tela cheia. */}
              <ControlesEmTelaCheia
                modelo={modelo}
                definirModelo={setModelo}
                formato={formato}
                definirFormato={setFormato}
                largura={largura}
                definirLargura={setLargura}
                slug={slug}
                definirSlug={setSlug}
                materiais={materiais}
                espessura={espessura}
                cor={aparencia.cor}
              />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

/* ========================================================================== */
/*  O palco, desenhado igual nos dois lugares.                                 */
/* ========================================================================== */

/**
 * O palco da peça: halo, sombra, rótulo, dica de gesto e botões.
 *
 * O MESMO componente serve o bloco embutido e a tela cheia, com `ampliado`
 * mudando só o que precisa mudar. Duas cópias desta marcação era o caminho
 * curto, e o caminho curto é o que faz a tela cheia atrasar uma correção que já
 * foi feita no bloco, ou o contrário.
 *
 * A `div` do palco fica VAZIA de propósito: o canvas é filho dela, colocado
 * pela cena, e a cena o move entre os dois palcos ao abrir e fechar a tela
 * cheia.
 */
function Palco({
  palcoRef,
  ampliado,
  rotulo,
  nomeDaPeca,
  largura,
  espessura,
  nomeDoMaterial,
  modelo,
  formato,
  cor,
  fosco,
  semWebgl,
  mostrarDica,
  aoReiniciar,
  aoAmpliar,
  aoFechar,
}: {
  palcoRef: RefObject<HTMLDivElement | null>;
  ampliado: boolean;
  rotulo: string;
  nomeDaPeca: string;
  largura: number;
  espessura: number;
  nomeDoMaterial?: string;
  modelo: ModeloDeAlianca;
  formato: FormatoDeAlianca;
  cor: string;
  fosco: boolean;
  semWebgl: boolean;
  mostrarDica: boolean;
  aoReiniciar: () => void;
  aoAmpliar?: () => void;
  aoFechar?: () => void;
}) {
  return (
    <>
      {/* Halo dourado atrás da peça e sombra de apoio embaixo, na mesma
          atmosfera do resto do site. Só clima, sem tocar no que é medida. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[70%] w-[85%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(var(--jk-brand-rgb)/0.22),transparent)] blur-2xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-[14%] left-1/2 h-10 w-3/5 -translate-x-1/2 rounded-[50%] bg-[radial-gradient(closest-side,rgb(var(--jk-sombra-rgb)/0.28),transparent)] blur-md"
      />

      {/* `touch-pan-y` no bloco embutido: o gesto vertical continua sendo da
          página, senão a pessoa fica presa no meio do artigo. Em tela cheia não
          existe página para rolar, então o gesto é todo da peça. */}
      <div
        ref={palcoRef}
        role="img"
        aria-label={rotulo}
        tabIndex={0}
        className={`absolute inset-0 cursor-grab outline-none focus-visible:ring-2 focus-visible:ring-brand-nav/70 active:cursor-grabbing ${
          ampliado ? "touch-none" : "touch-pan-y"
        }`}
      />

      {semWebgl ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
          <CorteDaAlianca
            modelo={modelo}
            formato={formato}
            larguraMm={largura}
            espessuraMm={espessura}
            aro={ARO_DE_REFERENCIA}
            cor={cor}
            fosco={fosco}
            className="h-24 w-full max-w-[15rem] text-brand-strong"
          />
          <p className="max-w-[30ch] text-nota leading-relaxed text-muted">
            Este aparelho não conseguiu abrir o desenho em três dimensões. O corte
            da peça continua aí em cima, e os formatos estão descritos ao lado.
          </p>
        </div>
      ) : null}

      {/* Rótulo da peça, por cima do palco, do jeito que vitrine escreve. A linha
          de medidas só aparece onde ela CABE sem cair em cima do metal: no
          celular, com a peça no tamanho novo, ela atravessava a aliança e ficava
          ilegível, e os mesmos números estão logo abaixo no cartão do corte. Em
          tela cheia ela volta, porque lá o cartão do corte não está na tela. */}
      <div className="pointer-events-none absolute left-4 top-4 max-w-[58%] sm:left-5 sm:top-5">
        <p className="font-display text-titulo-bloco leading-none text-ink">{nomeDaPeca}</p>
        <p className={`numeros mt-1.5 text-nota text-muted ${ampliado ? "" : "hidden sm:block"}`}>
          {largura.toLocaleString("pt-BR")} mm de largura,{" "}
          {espessura.toLocaleString("pt-BR", { minimumFractionDigits: 1 })} mm de parede
          {nomeDoMaterial ? `, em ${nomeDoMaterial.toLowerCase()}` : null}
        </p>
      </div>

      {!semWebgl ? (
        <>
          <p
            aria-hidden
            className={`pointer-events-none absolute bottom-4 left-4 flex items-center gap-2 text-nota leading-snug text-muted transition-opacity duration-500 sm:left-5 sm:max-w-none ${
              ampliado ? "max-w-[26ch]" : "max-w-[15ch]"
            } ${mostrarDica ? "opacity-100" : "opacity-0"}`}
          >
            <Move3d size={14} className="shrink-0" />
            {ampliado
              ? "Arraste para girar, pince para aproximar"
              : "Arraste para o lado para girar"}
          </p>

          {/* No celular os dois botões com texto cobriam a dica de gesto, que é
              justamente o que a pessoa precisa ler na primeira vez. O ícone fica,
              o nome volta quando há largura, e o `aria-label` garante o nome para
              quem usa leitor de tela. */}
          <div className="absolute bottom-3 right-3 flex justify-end gap-2 sm:bottom-4 sm:right-4">
            <button
              type="button"
              onClick={aoReiniciar}
              aria-label="Endireitar a peça"
              className={BOTAO_DO_PALCO}
            >
              <RotateCcw size={15} aria-hidden />
              <span className="hidden sm:inline">Endireitar</span>
            </button>
            {aoAmpliar ? (
              <button
                type="button"
                onClick={aoAmpliar}
                aria-label="Ver a peça em tela cheia"
                className={BOTAO_DO_PALCO}
              >
                <Maximize2 size={15} aria-hidden />
                <span className="hidden sm:inline">Ampliar</span>
              </button>
            ) : null}
          </div>

          {aoFechar ? (
            <button
              type="button"
              onClick={aoFechar}
              aria-label="Fechar a tela cheia"
              className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-white/80 text-ink backdrop-blur transition-colors hover:border-brand/60 sm:right-4 sm:top-4"
            >
              <X size={18} aria-hidden />
            </button>
          ) : null}
        </>
      ) : null}
    </>
  );
}

/* ========================================================================== */
/*  Os controles da tela cheia.                                                */
/* ========================================================================== */

/**
 * Modelo, formato, material e largura, em faixas que rolam de lado.
 *
 * É o MESMO estado do painel do desktop, e de propósito: nada aqui é uma
 * segunda versão da ferramenta, é a mesma ferramenta com a mão no lugar onde o
 * polegar alcança. Cada faixa é uma linha rolável em vez de uma grade, porque
 * grade no celular ou vira botão de 30 px ou vira painel de meia tela, e as
 * duas coisas tiram o espaço da peça, que é o que a pessoa veio ver.
 *
 * O painel inteiro tem teto de altura e rola no vertical: em aparelho baixo, ou
 * na horizontal, o que sobra é sempre palco.
 */
function ControlesEmTelaCheia({
  modelo,
  definirModelo,
  formato,
  definirFormato,
  largura,
  definirLargura,
  slug,
  definirSlug,
  materiais,
  espessura,
  cor,
}: {
  modelo: ModeloDeAlianca;
  definirModelo: (m: ModeloDeAlianca) => void;
  formato: FormatoDeAlianca;
  definirFormato: (f: FormatoDeAlianca) => void;
  largura: number;
  definirLargura: (l: number) => void;
  slug: string;
  definirSlug: (s: string) => void;
  materiais: MaterialNoVisor[];
  espessura: number;
  cor: string;
}) {
  return (
    <div className="max-h-[46%] shrink-0 overflow-y-auto border-t border-border bg-white/85 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-md">
      <Faixa titulo="Modelo">
        {MODELOS_INFO.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => definirModelo(m.id)}
            aria-pressed={modelo === m.id}
            className={chipe(modelo === m.id)}
          >
            <CorteDaAlianca
              modelo={m.id}
              formato="reta"
              larguraMm={4}
              espessuraMm={espessura}
              aro={ARO_DE_REFERENCIA}
              cor={cor}
              fosco={m.fosco}
              compacto
              className="h-4 w-9 shrink-0 text-ink"
            />
            {m.nome}
          </button>
        ))}
      </Faixa>

      <Faixa titulo="Formato">
        {FORMATOS_INFO.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => definirFormato(f.id)}
            aria-pressed={formato === f.id}
            className={chipe(formato === f.id)}
          >
            <CorteDaAlianca
              modelo="polida"
              formato={f.id}
              larguraMm={3.2}
              espessuraMm={espessura}
              aro={ARO_DE_REFERENCIA}
              cor={cor}
              compacto
              linhaDoDedo
              className="h-5 w-9 shrink-0 text-ink"
            />
            {f.nome}
          </button>
        ))}
      </Faixa>

      <Faixa titulo="Material">
        {materiais.map((m) => (
          <button
            key={m.slug}
            type="button"
            onClick={() => definirSlug(m.slug)}
            aria-pressed={slug === m.slug}
            className={chipe(slug === m.slug)}
          >
            <span
              aria-hidden
              className="h-5 w-5 shrink-0 rounded-full border border-black/15"
              style={{ background: amostraDoMaterial(m.slug) }}
            />
            {m.nome}
          </button>
        ))}
      </Faixa>

      <Faixa titulo="Largura">
        {LARGURAS_COMUNS.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => definirLargura(l)}
            aria-pressed={largura === l}
            className={chipe(largura === l)}
          >
            {l.toLocaleString("pt-BR")} mm
          </button>
        ))}
      </Faixa>
    </div>
  );
}

/** Uma linha de escolha: o nome à esquerda, os botões rolando de lado. */
function Faixa({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex items-center gap-2 py-1">
      <legend className="sr-only">{titulo}</legend>
      <span aria-hidden className="w-[4.5rem] shrink-0 text-[0.65rem] font-semibold uppercase tracking-wide text-muted">
        {titulo}
      </span>
      {/* `-mx-1 px-1` para o anel de foco do primeiro botão não ser cortado. */}
      <div className="rolagem-discreta -mx-1 flex min-w-0 flex-1 gap-2 overflow-x-auto px-1 py-1">
        {children}
      </div>
    </fieldset>
  );
}

function chipe(ativo: boolean) {
  return `flex min-h-11 shrink-0 items-center gap-2 rounded-sm border px-3 text-nota font-semibold transition-colors ${
    ativo ? "border-brand bg-brand/12 text-ink" : "border-border bg-white/70 text-muted"
  }`;
}

/* ========================================================================== */
/*  A cena. Fora do React de propósito: quem manda em WebGL é o rAF, não o     */
/*  ciclo de render do componente. O React só diz o que mudou.                 */
/* ========================================================================== */

type Peca = {
  modelo: ModeloDeAlianca;
  formato: FormatoDeAlianca;
  larguraMm: number;
  espessuraMm: number;
  aro: number;
  aparencia: ReturnType<typeof aparenciaDoMaterial>;
  /** Acabamento acetinado: espalha o reflexo em vez de devolver a imagem. */
  fosco: boolean;
};

/**
 * O acabamento fosco não é só "menos brilho".
 *
 * Subir a aspereza de 0,1 para 0,5 e parar por aí dá um metal apagado e liso,
 * que parece plástico cinza. Aliança fosca de verdade é acetinada: a superfície
 * tem um risco fino e regular, feito de lixa muito suave, e é esse risco que
 * quebra o reflexo em vez de apagar. O olho reconhece o acabamento pela
 * TEXTURA, não pela falta de luz.
 *
 * Por isso o fosco aqui usa mapa de aspereza e mapa de relevo, desenhados num
 * canvas com milhares de riscos finos no sentido da volta da peça, que é o
 * sentido em que joalheiro acetina. O mapa é gerado uma vez, e só quando alguém
 * escolhe fosca pela primeira vez.
 */
const ASPEREZA_FOSCA = 1;

type Cena = {
  trocarPeca: (p: Peca) => void;
  reiniciarAngulo: () => void;
  /** Em tela cheia o gesto é todo da peça: gira nos dois eixos e aceita pinça. */
  definirCapturaTotal: (v: boolean) => void;
  /** Muda o canvas de palco, levando ouvintes e observadores com ele. */
  mudarDePalco: (novo: HTMLElement) => void;
  desmontar: () => void;
};

/**
 * Quem está com o gesto na mão.
 *
 * "indeciso" é o único estado que importa entender: no celular, o primeiro
 * movimento do dedo é disputado entre girar a peça e rolar a página, e até o
 * gesto se decidir ninguém mexe em nada.
 */
type Gesto = "indeciso" | "girando" | "rolando" | "pinca";

/** Folga em volta da peça ao enquadrar. Menos folga, peça maior na tela. */
const FOLGA = 1.18;
/** O quanto o dedo precisa andar para o gesto se decidir. */
const LIMIAR_DO_GESTO = 6;

const ANGULO_INICIAL = { x: -0.42, y: 0.55 };

function montar(THREE: TresD, palcoInicial: HTMLElement, aoGirar?: () => void): Cena {
  // O palco TROCA: a tela cheia é outro elemento, em portal, e o canvas se muda
  // para lá em vez de a cena ser remontada.
  let palco = palcoInicial;
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  renderer.domElement.style.display = "block";
  palco.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.environment = criarAmbiente(THREE, renderer);

  const camera = new THREE.PerspectiveCamera(28, 1, 1, 400);
  camera.position.set(0, 0, 50);

  // Uma luz direta só para o estalo do reflexo na borda. O corpo da iluminação
  // é o ambiente: metal polido quase não enxerga luz pontual.
  const luz = new THREE.DirectionalLight(0xffffff, 2.2);
  luz.position.set(-1, 1.4, 1.6);
  scene.add(luz);

  const pivo = new THREE.Group();
  pivo.rotation.set(ANGULO_INICIAL.x, ANGULO_INICIAL.y, 0);
  scene.add(pivo);

  const metal = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#f0eeea"),
    metalness: 1,
    roughness: 0.12,
    envMapIntensity: 1.9,
  });
  const metalDoFilete = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#e7c063"),
    metalness: 1,
    roughness: 0.1,
    envMapIntensity: 1.9,
  });

  // Gerado só quando alguém escolhe fosca, e reaproveitado depois.
  let acabamentoFosco: { aspereza: import("three").Texture; relevo: import("three").Texture } | null =
    null;
  const pedirAcabamentoFosco = () => {
    if (!acabamentoFosco) acabamentoFosco = criarAcetinado(THREE, renderer);
    return acabamentoFosco;
  };

  let corpo: import("three").Mesh | null = null;
  let filete: import("three").Mesh | null = null;
  let raioDaPeca = 11;

  const enquadrar = () => {
    const l = palco.clientWidth || 1;
    const a = palco.clientHeight || 1;
    renderer.setSize(l, a, false);
    camera.aspect = l / a;
    // A peça precisa caber na menor das duas aberturas. Sem dividir pelo
    // aspecto, num palco em pé a aliança sai cortada pelas laterais.
    const meioFov = (camera.fov * Math.PI) / 360;
    const distancia = (raioDaPeca * FOLGA) / zoom / Math.tan(meioFov);
    camera.position.z = camera.aspect < 1 ? distancia / camera.aspect : distancia;
    camera.updateProjectionMatrix();
    pedirQuadro();
  };

  // ------------------------------------------------------------------ giro
  //
  // NO CELULAR, GIRAR DISPUTA COM ROLAR, E A PEÇA PERDIA SEMPRE.
  //
  // O palco declara `touch-action: pan-y`, então o navegador fica só com o
  // gesto VERTICAL e o horizontal sobra para a gente. Mas o código antigo
  // começava a girar no `pointerdown`, o que dava o pior dos dois mundos: a
  // pessoa arrastava para cima, o navegador levava o gesto embora, a página
  // descia e a aliança ficava parada, como se estivesse travada.
  //
  // Agora o primeiro movimento decide, que é como carrossel de foto resolve
  // isso. Saiu para o lado, a peça assume o gesto, captura o ponteiro e a
  // partir daí gira nos DOIS eixos, porque o navegador já desistiu de rolar
  // naquele toque. Saiu para cima ou para baixo, a gente não faz nada e a
  // página rola como sempre rolou.
  //
  // Em tela cheia não existe disputa (`touch-action: none`): o gesto é da peça
  // desde o toque, com pinça para aproximar. Mouse e caneta nunca disputaram
  // nada, então giram na hora, dentro e fora da tela cheia.
  let capturaTotal = false;
  let modo: Gesto = "indeciso";
  let inicioX = 0;
  let inicioY = 0;
  let ultimoX = 0;
  let ultimoY = 0;
  let velocidade = 0;
  let zoom = 1;
  let pincaInicial = 0;
  let zoomDaPinca = 1;
  /** Dedos na tela, em ordem de chegada. Dois viram pinça. */
  const dedos = new Map<number, { x: number; y: number }>();
  const semAnimacao = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let girandoSozinha = !semAnimacao;
  let quadro = 0;
  let visivel = true;

  const girando = () => modo === "girando" || modo === "pinca";

  const capturar = (id: number) => {
    try {
      palco.setPointerCapture?.(id);
    } catch {
      /* ponteiro já encerrado: o gesto segue sem captura */
    }
  };

  const soltarCaptura = (id: number) => {
    // Solta só o que foi capturado. Pedir a soltura de um ponteiro que nunca
    // foi capturado levanta exceção em alguns navegadores.
    try {
      if (palco.hasPointerCapture?.(id)) palco.releasePointerCapture(id);
    } catch {
      /* ponteiro já encerrado pelo navegador */
    }
  };

  const definirZoom = (v: number) => {
    // Teto de 2,2: passando disso a peça sai da tela e a pessoa perde a
    // referência do que está vendo, que é o oposto de aproximar.
    const novo = limitar(v, 0.85, 2.2);
    if (Math.abs(novo - zoom) < 0.002) return;
    zoom = novo;
    enquadrar();
  };

  const aoBaixar = (e: PointerEvent) => {
    dedos.set(e.pointerId, { x: e.clientX, y: e.clientY });
    girandoSozinha = false;
    velocidade = 0;

    if (dedos.size === 2) {
      const [a, b] = [...dedos.values()];
      pincaInicial = Math.hypot(a.x - b.x, a.y - b.y);
      zoomDaPinca = zoom;
      modo = "pinca";
      pedirQuadro();
      return;
    }

    inicioX = e.clientX;
    inicioY = e.clientY;
    ultimoX = e.clientX;
    ultimoY = e.clientY;
    modo = capturaTotal || e.pointerType !== "touch" ? "girando" : "indeciso";
    if (modo === "girando") {
      capturar(e.pointerId);
      aoGirar?.();
    }
    pedirQuadro();
  };

  const aoMover = (e: PointerEvent) => {
    const dedo = dedos.get(e.pointerId);
    if (!dedo) return;
    dedo.x = e.clientX;
    dedo.y = e.clientY;

    if (modo === "pinca") {
      if (dedos.size < 2 || pincaInicial <= 0) return;
      const [a, b] = [...dedos.values()];
      definirZoom((zoomDaPinca * Math.hypot(a.x - b.x, a.y - b.y)) / pincaInicial);
      return;
    }

    if (modo === "rolando") return;

    if (modo === "indeciso") {
      const dxTotal = e.clientX - inicioX;
      const dyTotal = e.clientY - inicioY;
      if (Math.hypot(dxTotal, dyTotal) < LIMIAR_DO_GESTO) return;
      if (Math.abs(dxTotal) < Math.abs(dyTotal)) {
        modo = "rolando";
        return;
      }
      modo = "girando";
      capturar(e.pointerId);
      aoGirar?.();
      // Do ponto onde o dedo começou, e não de onde ele está: assim o giro não
      // pula os 6 px que o gesto levou para se decidir.
      ultimoX = inicioX;
      ultimoY = inicioY;
    }

    const dx = e.clientX - ultimoX;
    const dy = e.clientY - ultimoY;
    ultimoX = e.clientX;
    ultimoY = e.clientY;
    pivo.rotation.y += dx * 0.009;
    pivo.rotation.x = limitar(pivo.rotation.x + dy * 0.009, -1.35, 1.35);
    velocidade = dx * 0.009;
    pedirQuadro();
  };

  const aoSoltar = (e: PointerEvent) => {
    dedos.delete(e.pointerId);
    soltarCaptura(e.pointerId);

    if (dedos.size === 0) {
      modo = "indeciso";
    } else if (modo === "pinca") {
      // Levantou um dedo da pinça: o que ficou reassume o giro de onde está,
      // senão a peça dá um salto do tamanho da distância entre os dois.
      const [q] = [...dedos.values()];
      inicioX = q.x;
      inicioY = q.y;
      ultimoX = q.x;
      ultimoY = q.y;
      velocidade = 0;
      modo = capturaTotal ? "girando" : "indeciso";
    }
    pedirQuadro();
  };

  const aoTeclar = (e: KeyboardEvent) => {
    const passo = 0.16;
    if (e.key === "ArrowLeft") pivo.rotation.y -= passo;
    else if (e.key === "ArrowRight") pivo.rotation.y += passo;
    else if (e.key === "ArrowUp") pivo.rotation.x = limitar(pivo.rotation.x - passo, -1.35, 1.35);
    else if (e.key === "ArrowDown") pivo.rotation.x = limitar(pivo.rotation.x + passo, -1.35, 1.35);
    // Aproximar pelo teclado, para quem não tem pinça nem roda.
    else if (e.key === "+" || e.key === "=") definirZoom(zoom * 1.12);
    else if (e.key === "-" || e.key === "_") definirZoom(zoom / 1.12);
    else return;
    e.preventDefault();
    girandoSozinha = false;
    pedirQuadro();
  };

  // A roda só é da peça em tela cheia. No meio do artigo ela é da página, e
  // roubar a rolagem de quem só passou por cima do bloco seria imperdoável.
  const aoRodar = (e: WheelEvent) => {
    if (!capturaTotal) return;
    e.preventDefault();
    definirZoom(zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
  };

  const ligar = (el: HTMLElement) => {
    el.addEventListener("pointerdown", aoBaixar);
    el.addEventListener("pointermove", aoMover);
    el.addEventListener("pointerup", aoSoltar);
    el.addEventListener("pointercancel", aoSoltar);
    el.addEventListener("keydown", aoTeclar);
    el.addEventListener("wheel", aoRodar, { passive: false });
  };
  const desligar = (el: HTMLElement) => {
    el.removeEventListener("pointerdown", aoBaixar);
    el.removeEventListener("pointermove", aoMover);
    el.removeEventListener("pointerup", aoSoltar);
    el.removeEventListener("pointercancel", aoSoltar);
    el.removeEventListener("keydown", aoTeclar);
    el.removeEventListener("wheel", aoRodar);
  };

  ligar(palco);

  // -------------------------------------------------------------- desenho
  const desenhar = () => {
    quadro = 0;
    if (!visivel) return;

    if (girandoSozinha) pivo.rotation.y += 0.0035;
    else if (!girando() && Math.abs(velocidade) > 0.0004) {
      pivo.rotation.y += velocidade;
      velocidade *= 0.93;
    }

    renderer.render(scene, camera);

    if (girandoSozinha || (!girando() && Math.abs(velocidade) > 0.0004)) pedirQuadro();
  };
  function pedirQuadro() {
    if (!quadro && visivel) quadro = requestAnimationFrame(desenhar);
  }

  const observador = new IntersectionObserver(
    (e) => {
      visivel = e.some((x) => x.isIntersecting);
      if (visivel) pedirQuadro();
    },
    { threshold: 0 },
  );
  observador.observe(palco);

  const redimensionador = new ResizeObserver(enquadrar);
  redimensionador.observe(palco);

  const aoPerderContexto = (e: Event) => {
    e.preventDefault();
    if (quadro) cancelAnimationFrame(quadro);
    quadro = 0;
  };
  renderer.domElement.addEventListener("webglcontextlost", aoPerderContexto);

  // ---------------------------------------------------------------- peça
  const trocarPeca = ({
    modelo,
    formato,
    larguraMm,
    espessuraMm,
    aro,
    aparencia,
    fosco,
  }: Peca) => {
    const pontos = perfilDaAlianca(modelo, formato, { larguraMm, espessuraMm, aro });
    const vetores = pontos.map((p) => new THREE.Vector2(p.r, p.y));

    corpo?.geometry.dispose();
    const geometria = new THREE.LatheGeometry(vetores, 160);
    if (corpo) corpo.geometry = geometria;
    else {
      corpo = new THREE.Mesh(geometria, metal);
      // O `LatheGeometry` gira em torno do Y. Deitando a peça, o furo aponta
      // para a câmera e a aliança abre de frente, que é como ela é fotografada.
      corpo.rotation.x = Math.PI / 2;
      pivo.add(corpo);
    }

    metal.color.set(aparencia.cor);
    vestirMetal(metal, fosco, aparencia.aspereza, fosco ? pedirAcabamentoFosco() : null);

    // Dois tons: um filete do segundo metal, colado por cima da face de fora.
    filete?.geometry.dispose();
    if (filete) {
      pivo.remove(filete);
      filete = null;
    }
    if (aparencia.filete) {
      const faixa = faixaDaFaceExterna(pontos, larguraMm, aparencia.filete.fatiaDaLargura);
      if (faixa.length >= 2) {
        const g = new THREE.LatheGeometry(
          faixa.map((p) => new THREE.Vector2(p.r, p.y)),
          160,
        );
        metalDoFilete.color.set(aparencia.filete.cor);
        vestirMetal(
          metalDoFilete,
          fosco,
          aparencia.filete.aspereza,
          fosco ? pedirAcabamentoFosco() : null,
        );
        filete = new THREE.Mesh(g, metalDoFilete);
        filete.rotation.x = Math.PI / 2;
        pivo.add(filete);
      }
    }

    raioDaPeca = Math.hypot(
      Math.max(...pontos.map((p) => p.r)),
      larguraMm / 2,
    );
    enquadrar();
  };

  enquadrar();

  const mudarDePalco = (novo: HTMLElement) => {
    if (!novo || novo === palco) return;
    desligar(palco);
    redimensionador.unobserve(palco);
    observador.unobserve(palco);

    palco = novo;
    palco.appendChild(renderer.domElement);
    ligar(palco);
    redimensionador.observe(palco);
    observador.observe(palco);
    // Palco novo, medida nova: sem isto o canvas fica com o tamanho do antigo
    // até alguém redimensionar a janela.
    visivel = true;
    enquadrar();
  };

  return {
    trocarPeca,
    mudarDePalco,
    reiniciarAngulo: () => {
      pivo.rotation.set(ANGULO_INICIAL.x, ANGULO_INICIAL.y, 0);
      velocidade = 0;
      // "Endireitar" também desfaz a aproximação: é o botão de voltar ao começo,
      // e deixar a peça enorme e torta pela metade não é voltar ao começo.
      zoom = 1;
      enquadrar();
    },
    definirCapturaTotal: (v: boolean) => {
      capturaTotal = v;
      modo = "indeciso";
      dedos.clear();
      // Ao sair da tela cheia, a peça volta ao enquadramento do bloco: uma peça
      // aproximada num palco de 26 rem sai cortada.
      if (!v && zoom !== 1) {
        zoom = 1;
        enquadrar();
      }
    },
    desmontar: () => {
      if (quadro) cancelAnimationFrame(quadro);
      observador.disconnect();
      redimensionador.disconnect();
      desligar(palco);
      renderer.domElement.removeEventListener("webglcontextlost", aoPerderContexto);
      corpo?.geometry.dispose();
      filete?.geometry.dispose();
      metal.dispose();
      metalDoFilete.dispose();
      acabamentoFosco?.aspereza.dispose();
      acabamentoFosco?.relevo.dispose();
      scene.environment?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

function limitar(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

/**
 * O pedaço central da face de fora, para o filete do segundo metal.
 *
 * A face de fora é o começo do contorno, o trecho em que a largura só cresce.
 * Dentro dele o raio é lido por interpolação, porque numa aliança reta a face
 * inteira são dois pontos e uma reta: procurar pontos prontos no meio dela
 * devolveria uma lista vazia.
 */
function faixaDaFaceExterna(
  pontos: PontoDoPerfil[],
  larguraMm: number,
  fatia: number,
): PontoDoPerfil[] {
  const face: PontoDoPerfil[] = [pontos[0]];
  for (let i = 1; i < pontos.length; i++) {
    if (pontos[i].y < pontos[i - 1].y - 1e-9) break;
    face.push(pontos[i]);
  }
  if (face.length < 2) return [];

  const meia = (larguraMm * fatia) / 2;
  const amostras = 16;
  const saida: PontoDoPerfil[] = [];
  for (let i = 0; i <= amostras; i++) {
    const y = -meia + (2 * meia * i) / amostras;
    // 0,02 mm acima da face: o bastante para o filete não brigar com a peça no
    // teste de profundidade, e pouco demais para alguém enxergar degrau.
    saida.push({ r: raioEm(face, y) + 0.02, y });
  }
  return saida;
}

function raioEm(face: PontoDoPerfil[], y: number): number {
  for (let i = 1; i < face.length; i++) {
    const a = face[i - 1];
    const b = face[i];
    if (y >= a.y && y <= b.y) {
      const t = b.y === a.y ? 0 : (y - a.y) / (b.y - a.y);
      return a.r + (b.r - a.r) * t;
    }
  }
  return face[face.length - 1].r;
}

/** Veste o metal de polido ou de acetinado. Um lugar só decide isso. */
function vestirMetal(
  material: import("three").MeshPhysicalMaterial,
  fosco: boolean,
  asperezaPolida: number,
  acetinado: { aspereza: import("three").Texture; relevo: import("three").Texture } | null,
) {
  if (fosco && acetinado) {
    // Com mapa, `roughness` vira multiplicador do que está no mapa, então o
    // valor cheio deixa passar o cinza de base desenhado lá.
    material.roughness = ASPEREZA_FOSCA;
    material.roughnessMap = acetinado.aspereza;
    material.normalMap = acetinado.relevo;
    material.normalScale.set(0.3, 0.3);
    // Fosco devolve menos ambiente. Sem baixar isto, fica com cara de metal
    // molhado em vez de acetinado.
    material.envMapIntensity = 1.5;
  } else {
    material.roughness = asperezaPolida;
    material.roughnessMap = null;
    material.normalMap = null;
    material.envMapIntensity = 1.9;
  }
  // Trocar mapa muda o shader, e sem isto a peça continua com o anterior.
  material.needsUpdate = true;
}

/**
 * O acetinado: riscos de lixa fina, no sentido da volta da peça.
 *
 * São dois mapas do mesmo desenho. O de ASPEREZA diz onde a superfície espalha
 * mais luz, e é ele que tira o espelho. O de RELEVO inclina a normal um
 * pouquinho em cada risco, e é ele que faz o brilho correr em faixas quando a
 * aliança gira, em vez de ficar parado. Só com o primeiro, o fosco fica liso
 * demais e parece pintura.
 *
 * O risco é quase horizontal porque na malha o eixo horizontal da textura
 * acompanha a volta da aliança, que é o sentido em que joalheiro acetina.
 */
function criarAcetinado(TRES: TresD, renderer: import("three").WebGLRenderer) {
  const largura = 1024;
  const altura = 256;
  const tela = document.createElement("canvas");
  tela.width = largura;
  tela.height = altura;
  const p = tela.getContext("2d");

  if (p) {
    // Cinza de base: é a aspereza média do acetinado, por volta de 0,6.
    p.fillStyle = "#9a9a9a";
    p.fillRect(0, 0, largura, altura);
    for (let i = 0; i < 24000; i++) {
      const x = Math.random() * largura;
      const y = Math.random() * altura;
      const comprimento = 6 + Math.random() * 46;
      const claro = Math.random() < 0.5;
      // Contraste baixo de propósito: é lixa fina, não areia. Risco muito
      // marcado vira sujeira na peça em vez de acetinado.
      const tom = Math.round(claro ? 152 + Math.random() * 36 : 128 - Math.random() * 34);
      p.strokeStyle = `rgb(${tom},${tom},${tom})`;
      p.lineWidth = Math.random() < 0.72 ? 0.6 : 1.1;
      p.beginPath();
      p.moveTo(x, y);
      p.lineTo(x + comprimento, y + (Math.random() - 0.5) * 1.2);
      p.stroke();
    }
  }

  const ajustar = (t: import("three").Texture) => {
    t.wrapS = TRES.RepeatWrapping;
    t.wrapT = TRES.RepeatWrapping;
    t.repeat.set(7, 1.4);
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return t;
  };

  return {
    aspereza: ajustar(new TRES.CanvasTexture(tela)),
    relevo: ajustar(new TRES.CanvasTexture(relevoDoRisco(tela, 2.4))),
  };
}

/** Transforma o desenho em claro e escuro num mapa de normais. */
function relevoDoRisco(origem: HTMLCanvasElement, forca: number): HTMLCanvasElement {
  const destino = document.createElement("canvas");
  destino.width = origem.width;
  destino.height = origem.height;
  const de = origem.getContext("2d");
  const para = destino.getContext("2d");
  if (!de || !para) return destino;

  const l = origem.width;
  const a = origem.height;
  const entrada = de.getImageData(0, 0, l, a).data;
  const saida = para.createImageData(l, a);
  const luz = (x: number, y: number) => entrada[((((y % a) + a) % a) * l + (((x % l) + l) % l)) * 4] / 255;

  for (let y = 0; y < a; y++) {
    for (let x = 0; x < l; x++) {
      const dx = (luz(x + 1, y) - luz(x - 1, y)) * forca;
      const dy = (luz(x, y + 1) - luz(x, y - 1)) * forca;
      const n = Math.hypot(-dx, -dy, 1);
      const i = (y * l + x) * 4;
      saida.data[i] = ((-dx / n) * 0.5 + 0.5) * 255;
      saida.data[i + 1] = ((-dy / n) * 0.5 + 0.5) * 255;
      saida.data[i + 2] = (1 / n) * 0.5 * 255 + 127.5;
      saida.data[i + 3] = 255;
    }
  }
  para.putImageData(saida, 0, 0);
  return destino;
}

/**
 * O ambiente que a peça reflete.
 *
 * Metal polido não tem cor própria na tela: ele devolve o que está em volta.
 * Sem ambiente, `metalness: 1` renderiza um anel PRETO, e é o erro mais comum
 * de quem coloca joia em 3D pela primeira vez.
 *
 * O ambiente é desenhado aqui em vez de baixado como imagem HDR, por três
 * motivos: não custa download, não depende de servidor de terceiro, e deixa a
 * luz combinar com a marca. O desenho é o de um estúdio de joia: claro em cima,
 * corte seco no horizonte, escuro embaixo, e dois painéis de luz que viram as
 * duas riscas brancas que correm pela aliança quando ela gira.
 */
function criarAmbiente(THREE: TresD, renderer: import("three").WebGLRenderer) {
  const tela = document.createElement("canvas");
  tela.width = 1024;
  tela.height = 512;
  const p = tela.getContext("2d");

  if (p) {
    const fundo = p.createLinearGradient(0, 0, 0, 512);
    fundo.addColorStop(0, "#fffdf7"); // teto de luz
    fundo.addColorStop(0.4, "#f6efe1");
    fundo.addColorStop(0.49, "#d9cdb6");
    fundo.addColorStop(0.51, "#6f5f47"); // o corte do horizonte, quente
    fundo.addColorStop(0.72, "#4a3d2c");
    fundo.addColorStop(1, "#2e2519"); // chão de madeira, nunca preto
    p.fillStyle = fundo;
    p.fillRect(0, 0, 1024, 512);

    // Painéis de luz do estúdio. Borrados, porque fonte de luz com borda viva
    // vira uma linha dura no reflexo e denuncia o desenho.
    p.filter = "blur(20px)";
    p.fillStyle = "#ffffff";
    p.fillRect(70, 20, 330, 190);
    p.fillRect(600, 40, 250, 160);
    p.fillRect(410, 130, 130, 70);
    // Rebote quente embaixo: é ele que devolve dourado para a parte de baixo da
    // peça em vez de devolver buraco preto.
    p.filter = "blur(26px)";
    p.fillStyle = "#caa470";
    p.fillRect(260, 320, 500, 120);
    p.filter = "none";
  }

  const textura = new THREE.CanvasTexture(tela);
  textura.mapping = THREE.EquirectangularReflectionMapping;
  textura.colorSpace = THREE.SRGBColorSpace;

  const gerador = new THREE.PMREMGenerator(renderer);
  const ambiente = gerador.fromEquirectangular(textura).texture;
  gerador.dispose();
  textura.dispose();
  return ambiente;
}
