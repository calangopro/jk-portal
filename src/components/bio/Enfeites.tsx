import type { CSSProperties } from "react";
import type { TemaDaBio } from "@/lib/bio/tipos";

/**
 * O que se mexe no topo da bio em campanha de data: confete no aniversário,
 * bolas penduradas e flocos no Natal, bolinhas douradas subindo no ano novo.
 *
 * Três regras que valem para todos:
 *
 *   1. Só no topo e ATRÁS do conteúdo. A camada tem a altura do cabeçalho e da
 *      oferta, e o conteúdo passa por cima dela. Na primeira versão o confete
 *      cruzava o título da oferta e cortava letra. Agora ele aparece nítido em
 *      volta do logo e nas bordas, e desfocado através do cartão de vidro da
 *      oferta (`BlocoCampanha`).
 *   2. CSS puro, sem JavaScript. Posição, tamanho e atraso saem de um sorteio
 *      com semente fixa, então servidor e navegador desenham IGUAL (sem erro de
 *      hidratação) e a animação começa no meio do caminho, sem tela vazia.
 *   3. Quem pede menos movimento no celular vê o enfeite parado (regra em
 *      `globals.css`, `.bio-enfeites`).
 *
 * Nada aqui é lido por leitor de tela, nem recebe toque.
 */

/** Sorteio com semente fixa (Park-Miller): o mesmo resultado em todo lugar. */
function sorteio(semente: number) {
  let s = semente;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

type Estilo = CSSProperties & Record<`--${string}`, string>;

const CORES_DO_CONFETE = ["#7A2230", "#BE9B60", "#B76E79", "#D6BD96", "#D8B877", "#9C3A48"];

const CONFETES = (() => {
  const r = sorteio(23);
  return Array.from({ length: 26 }, (_, i) => ({
    esquerda: r() * 100,
    duracao: 7 + r() * 6,
    atraso: -r() * 13,
    deriva: Math.round((r() - 0.5) * 120),
    giro: Math.round(360 + r() * 720),
    cor: CORES_DO_CONFETE[i % CORES_DO_CONFETE.length],
    circulo: i % 4 === 0,
    largura: 5 + r() * 3,
  }));
})();

function Confetes() {
  return (
    <>
      {CONFETES.map((c, i) => (
        <span
          key={i}
          className="bio-enfeite-movel absolute top-0 block animate-[bio-cair_var(--duracao)_linear_infinite]"
          style={
            {
              left: `${c.esquerda}%`,
              width: `${c.largura}px`,
              height: c.circulo ? `${c.largura}px` : `${c.largura * 1.9}px`,
              borderRadius: c.circulo ? "999px" : "1.5px",
              background: c.cor,
              animationDelay: `${c.atraso}s`,
              "--duracao": `${c.duracao}s`,
              "--deriva": `${c.deriva}px`,
              "--giro": `${c.giro}deg`,
            } as Estilo
          }
        />
      ))}
    </>
  );
}

const BOLAS_DE_NATAL = (() => {
  const r = sorteio(12);
  // Só nas laterais: o meio do topo é do logo.
  const posicoes = [4, 11, 18, 82, 89, 96];
  const cores = [
    ["#9C3A48", "#7A2230"],
    ["#2E6B4C", "#1F4D36"],
    ["#E3CB9C", "#BE9B60"],
  ];
  return posicoes.map((esquerda, i) => ({
    esquerda,
    fio: Math.round(14 + r() * 34),
    tamanho: Math.round(11 + r() * 5),
    cor: cores[i % cores.length],
    duracao: 3 + r() * 2,
    atraso: -r() * 4,
  }));
})();

const FLOCOS = (() => {
  const r = sorteio(2512);
  const cores = ["#7A2230", "#1F4D36", "#BE9B60"];
  return Array.from({ length: 14 }, (_, i) => ({
    esquerda: r() * 100,
    duracao: 11 + r() * 7,
    atraso: -r() * 18,
    deriva: Math.round((r() - 0.5) * 70),
    giro: Math.round(90 + r() * 180),
    tamanho: Math.round(9 + r() * 7),
    cor: cores[i % cores.length],
  }));
})();

function Floco({ tamanho, cor }: { tamanho: number; cor: string }) {
  return (
    <svg viewBox="0 0 24 24" width={tamanho} height={tamanho} fill="none" stroke={cor} strokeWidth={1.8} strokeLinecap="round">
      <path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M9 3.5 12 6l3-2.5M9 20.5 12 18l3 2.5" />
    </svg>
  );
}

function Natal() {
  return (
    <>
      {BOLAS_DE_NATAL.map((b, i) => (
        <span
          key={`bola-${i}`}
          className="absolute top-0 flex origin-top animate-[bio-balancar_var(--duracao)_ease-in-out_infinite] flex-col items-center"
          style={
            {
              left: `${b.esquerda}%`,
              animationDelay: `${b.atraso}s`,
              "--duracao": `${b.duracao}s`,
            } as Estilo
          }
        >
          <span className="block w-px bg-[#1F4D36]/45" style={{ height: `${b.fio}px` }} />
          <span className="block h-1 w-1.5 rounded-t-[1px] bg-[#BE9B60]" />
          <span
            className="block rounded-full shadow-[0_3px_6px_-2px_rgb(0_0_0/0.35)]"
            style={{
              width: `${b.tamanho}px`,
              height: `${b.tamanho}px`,
              background: `radial-gradient(circle at 32% 30%, rgb(255 255 255 / 0.75) 0 14%, ${b.cor[0]} 38%, ${b.cor[1]} 100%)`,
            }}
          />
        </span>
      ))}
      {FLOCOS.map((f, i) => (
        <span
          key={`floco-${i}`}
          className="bio-enfeite-movel absolute top-0 block opacity-50 animate-[bio-cair_var(--duracao)_linear_infinite]"
          style={
            {
              left: `${f.esquerda}%`,
              animationDelay: `${f.atraso}s`,
              "--duracao": `${f.duracao}s`,
              "--deriva": `${f.deriva}px`,
              "--giro": `${f.giro}deg`,
            } as Estilo
          }
        >
          <Floco tamanho={f.tamanho} cor={f.cor} />
        </span>
      ))}
    </>
  );
}

const BOLHAS = (() => {
  const r = sorteio(2027);
  return Array.from({ length: 22 }, () => {
    const tamanho = Math.round(4 + r() * 11);
    return {
      esquerda: r() * 100,
      tamanho,
      duracao: 8 + r() * 8,
      atraso: -r() * 16,
      deriva: Math.round((r() - 0.5) * 60),
      opacidade: (0.5 + r() * 0.45).toFixed(2),
      // As maiores ficam um pouco desfocadas, como luz fora de foco.
      desfoque: tamanho > 11 ? 1 : 0,
    };
  });
})();

const BRILHOS = (() => {
  const r = sorteio(3112);
  return Array.from({ length: 7 }, () => ({
    esquerda: 4 + r() * 92,
    topo: 6 + r() * 60,
    tamanho: Math.round(8 + r() * 8),
    duracao: 2.4 + r() * 2.4,
    atraso: -r() * 4,
  }));
})();

function AnoNovo() {
  return (
    <>
      {BOLHAS.map((b, i) => (
        <span
          key={`bolha-${i}`}
          className="bio-enfeite-movel absolute bottom-0 block rounded-full animate-[bio-subir_var(--duracao)_ease-out_infinite]"
          style={
            {
              left: `${b.esquerda}%`,
              width: `${b.tamanho}px`,
              height: `${b.tamanho}px`,
              background: "radial-gradient(circle at 35% 32%, #FBF1D6 0 18%, #D8B877 48%, #BE9B60 78%, rgb(190 155 96 / 0) 100%)",
              filter: b.desfoque ? "blur(1px)" : undefined,
              animationDelay: `${b.atraso}s`,
              "--duracao": `${b.duracao}s`,
              "--deriva": `${b.deriva}px`,
              "--opacidade": b.opacidade,
            } as Estilo
          }
        />
      ))}
      {BRILHOS.map((b, i) => (
        <svg
          key={`brilho-${i}`}
          viewBox="0 0 24 24"
          width={b.tamanho}
          height={b.tamanho}
          className="absolute animate-[bio-cintilar_var(--duracao)_ease-in-out_infinite]"
          style={
            {
              left: `${b.esquerda}%`,
              top: `${b.topo}%`,
              animationDelay: `${b.atraso}s`,
              "--duracao": `${b.duracao}s`,
            } as Estilo
          }
        >
          <path d="M12 1c.6 5.2 2.4 8.3 11 11-8.6 2.7-10.4 5.8-11 11-.6-5.2-2.4-8.3-11-11 8.6-2.7 10.4-5.8 11-11Z" fill="#BE9B60" />
        </svg>
      ))}
    </>
  );
}

export function Enfeites({ tema }: { tema: TemaDaBio }) {
  const conteudo =
    tema === "aniversario" ? <Confetes /> : tema === "natal" ? <Natal /> : tema === "anonovo" ? <AnoNovo /> : null;
  if (!conteudo) return null;
  return (
    <div aria-hidden className="bio-enfeites pointer-events-none absolute inset-x-0 top-0 z-0 h-[34rem] overflow-hidden">
      {conteudo}
    </div>
  );
}

/**
 * Chapéu de Papai Noel, pequeno, no canto de cima do cartão de produto.
 *
 * Vinho, e não o vermelho de fantasia, para ficar na paleta da marca. Mora
 * FORA do link do cartão, porque o cartão recorta o que sai da borda, e o
 * charme do chapéu é justamente estar pendurado no canto.
 */
export function ChapeuDeNatal() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 48 40"
      width={34}
      height={28}
      className="pointer-events-none absolute -right-1.5 -top-3 z-10 rotate-[18deg] drop-shadow-[0_3px_3px_rgb(0_0_0/0.25)]"
    >
      <path d="M8 31C9 18 18 6 31 5c6-.5 10 3 11 8-4-2-7-2-9 1-3 4-3 10-1 17Z" fill="#7A2230" />
      <path d="M31 5c6-.5 10 3 11 8-4-2-7-2-9 1" fill="none" stroke="#5C1922" strokeWidth={1.2} opacity={0.5} />
      <rect x="4" y="28" width="32" height="9" rx="4.5" fill="#FFFDF9" />
      <circle cx="42" cy="14" r="4.5" fill="#FFFDF9" />
    </svg>
  );
}
