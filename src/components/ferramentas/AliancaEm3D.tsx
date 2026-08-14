"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RotateCcw, Move3d } from "lucide-react";
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

  const palcoRef = useRef<HTMLDivElement | null>(null);
  const cena = useRef<Cena | null>(null);

  const material = materiais.find((m) => m.slug === slug) ?? materiais[0];
  const infoModelo = MODELOS_INFO.find((m) => m.id === modelo) ?? MODELOS_INFO[0];
  const infoFormato = FORMATOS_INFO.find((f) => f.id === formato) ?? FORMATOS_INFO[0];
  const aparencia = aparenciaDoMaterial(slug);
  const fosco = infoModelo.fosco === true;

  // ---------------------------------------------------------------- montagem
  useEffect(() => {
    const palco = palcoRef.current;
    if (!palco) return;

    let vivo = true;
    let observador: IntersectionObserver | null = null;

    const iniciar = async () => {
      if (!vivo || cena.current) return;
      try {
        const THREE = await import("three");
        if (!vivo) return;
        cena.current = montar(THREE, palco);
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

  const reiniciar = useCallback(() => {
    cena.current?.reiniciarAngulo();
  }, []);

  const aoTocar = useCallback(() => setTocou(true), []);

  const nomeDaPeca = `${infoModelo.nome} ${infoFormato.nome.toLowerCase()}`;
  const rotulo = `Aliança ${nomeDaPeca.toLowerCase()} de ${largura.toLocaleString("pt-BR")} milímetros em ${material?.nome ?? ""}, em três dimensões. Arraste para girar, ou use as setas do teclado.`;

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
    <div className={`glass overflow-hidden rounded-[20px] ${className}`}>
      <div className="grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        {/* ------------------------------------------------------------ palco

            Marfim quente, não carvão. Joia de ouro em fundo escuro vira anúncio
            de relógio: o metal fica dramático e a peça fica FRIA. O que a JK
            vende é peça de vitrine iluminada, e vitrine de joalheria é clara.
            O fundo escuro continua existindo, mas dentro do reflexo: sem uma
            faixa escura no ambiente, o dourado não tem contra o que brilhar e
            achata. */}
        <div className="relative min-h-[19rem] bg-[radial-gradient(125%_100%_at_50%_12%,#fffdf9_0%,#f7f0e3_52%,#ecdfc9_100%)] sm:min-h-[23rem] lg:min-h-[30rem]">
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
          <div
            ref={palcoRef}
            role="img"
            aria-label={rotulo}
            tabIndex={0}
            onPointerDown={aoTocar}
            className="absolute inset-0 cursor-grab touch-pan-y outline-none focus-visible:ring-2 focus-visible:ring-brand-nav/70 active:cursor-grabbing"
          />

          {semWebgl ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
              <CorteDaAlianca
                modelo={modelo}
                formato={formato}
                larguraMm={largura}
                espessuraMm={espessura}
                aro={ARO_DE_REFERENCIA}
                cor={aparencia.cor}
                fosco={fosco}
                className="h-24 w-full max-w-[15rem] text-brand-strong"
              />
              <p className="max-w-[30ch] text-nota leading-relaxed text-muted">
                Este aparelho não conseguiu abrir o desenho em três dimensões. O
                corte da peça continua aí em cima, e os formatos estão descritos
                ao lado.
              </p>
            </div>
          ) : null}

          {/* Rótulo da peça, por cima do palco, do jeito que vitrine escreve. */}
          <div className="pointer-events-none absolute left-4 top-4 sm:left-5 sm:top-5">
            <p className="font-display text-titulo-bloco leading-none text-ink">
              {nomeDaPeca}
            </p>
            <p className="numeros mt-1.5 text-nota text-muted">
              {largura.toLocaleString("pt-BR")} mm de largura,{" "}
              {espessura.toLocaleString("pt-BR", { minimumFractionDigits: 1 })} mm de
              parede, em {material?.nome.toLowerCase()}
            </p>
          </div>

          {!semWebgl ? (
            <>
              <p
                aria-hidden
                className={`pointer-events-none absolute bottom-4 left-4 flex items-center gap-2 text-nota text-muted transition-opacity duration-500 sm:left-5 ${
                  tocou ? "opacity-0" : "opacity-100"
                }`}
              >
                <Move3d size={14} />
                Arraste para girar
              </p>

              <button
                type="button"
                onClick={reiniciar}
                className="absolute bottom-3 right-3 flex min-h-11 items-center gap-2 rounded-sm border border-border bg-white/70 px-3 text-nota font-semibold text-ink backdrop-blur transition-colors hover:border-brand/60 sm:bottom-4 sm:right-4"
              >
                <RotateCcw size={14} aria-hidden />
                Endireitar
              </button>
            </>
          ) : null}
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
  );
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
  desmontar: () => void;
};

const ANGULO_INICIAL = { x: -0.42, y: 0.55 };

function montar(THREE: TresD, palco: HTMLElement): Cena {
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
    const distancia = (raioDaPeca * 1.42) / Math.tan(meioFov);
    camera.position.z = camera.aspect < 1 ? distancia / camera.aspect : distancia;
    camera.updateProjectionMatrix();
    pedirQuadro();
  };

  // ------------------------------------------------------------------ giro
  let arrastando = false;
  let ultimoX = 0;
  let ultimoY = 0;
  let velocidade = 0;
  const semAnimacao = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let girandoSozinha = !semAnimacao;
  let quadro = 0;
  let visivel = true;

  const aoBaixar = (e: PointerEvent) => {
    arrastando = true;
    girandoSozinha = false;
    velocidade = 0;
    ultimoX = e.clientX;
    ultimoY = e.clientY;
    palco.setPointerCapture?.(e.pointerId);
    pedirQuadro();
  };
  const aoMover = (e: PointerEvent) => {
    if (!arrastando) return;
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
    arrastando = false;
    palco.releasePointerCapture?.(e.pointerId);
    pedirQuadro();
  };
  const aoTeclar = (e: KeyboardEvent) => {
    const passo = 0.16;
    if (e.key === "ArrowLeft") pivo.rotation.y -= passo;
    else if (e.key === "ArrowRight") pivo.rotation.y += passo;
    else if (e.key === "ArrowUp") pivo.rotation.x = limitar(pivo.rotation.x - passo, -1.35, 1.35);
    else if (e.key === "ArrowDown") pivo.rotation.x = limitar(pivo.rotation.x + passo, -1.35, 1.35);
    else return;
    e.preventDefault();
    girandoSozinha = false;
    pedirQuadro();
  };

  palco.addEventListener("pointerdown", aoBaixar);
  palco.addEventListener("pointermove", aoMover);
  palco.addEventListener("pointerup", aoSoltar);
  palco.addEventListener("pointercancel", aoSoltar);
  palco.addEventListener("keydown", aoTeclar);

  // -------------------------------------------------------------- desenho
  const desenhar = () => {
    quadro = 0;
    if (!visivel) return;

    if (girandoSozinha) pivo.rotation.y += 0.0035;
    else if (!arrastando && Math.abs(velocidade) > 0.0004) {
      pivo.rotation.y += velocidade;
      velocidade *= 0.93;
    }

    renderer.render(scene, camera);

    if (girandoSozinha || (!arrastando && Math.abs(velocidade) > 0.0004)) pedirQuadro();
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

  return {
    trocarPeca,
    reiniciarAngulo: () => {
      pivo.rotation.set(ANGULO_INICIAL.x, ANGULO_INICIAL.y, 0);
      velocidade = 0;
      pedirQuadro();
    },
    desmontar: () => {
      if (quadro) cancelAnimationFrame(quadro);
      observador.disconnect();
      redimensionador.disconnect();
      palco.removeEventListener("pointerdown", aoBaixar);
      palco.removeEventListener("pointermove", aoMover);
      palco.removeEventListener("pointerup", aoSoltar);
      palco.removeEventListener("pointercancel", aoSoltar);
      palco.removeEventListener("keydown", aoTeclar);
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
